#!/usr/bin/env node
/**
 * Builds every AI tool's manifest from one source.
 *
 * Claude Code, Codex, Gemini CLI, Cursor and the Agent Plugins standard each
 * read their own file, but all of them describe the same plugin. Written by
 * hand they drift apart; built from product.json, package.json (for the
 * version) and the skills/ and agents/ folders, a change reaches every tool at
 * once. The sources are also checked against the strictest rule any of those
 * tools applies, so a name or a skill that one tool would reject fails here
 * instead of in a user's install.
 *
 * npm lists the same product, and it reads search keywords and people from
 * package.json alone, so the build also keeps those fields of package.json
 * equal to product.json (PACKAGE_FIELDS) and leaves the rest of it as it is.
 *
 *   node scripts/manifests/build.mjs                write every manifest and the package.json fields
 *   node scripts/manifests/build.mjs --check        exit 1 if any is stale (CI)
 *   node scripts/manifests/build.mjs --root <dir>   build another checkout
 *
 * Node 22 built-ins only, so it runs before `npm install`. The format of each
 * file, with the documentation it follows, is in docs/clients.md.
 *
 * Taken from AI SEO OS (scripts/manifests/build.mjs, 2026-10-13) by way of AI
 * Ads OS, which made the MCP server optional. One more change here: product.json
 * mcp may also be a list, because some plugins bundle several house MCP servers
 * (one per service they reach). Absent means no server, an object means one, a
 * list means several, each under its own name in every manifest.
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { FrontmatterError, parseFrontmatter } from "./frontmatter.mjs";

export const AGENT_PLUGINS_PLUGIN_SCHEMA = "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json";
export const AGENT_PLUGINS_MCP_SCHEMA = "https://agent-plugins.org/schemas/1.0.0/mcp.schema.json";

/** product.json writes the plugin's install folder as this token, the Agent Plugins name for it. */
export const ROOT_TOKEN = "${PLUGIN_ROOT}";

/**
 * Each tool's own name for the plugin's install folder, from its docs:
 * Claude Code https://code.claude.com/docs/en/plugins-reference#environment-variables,
 * Agent Plugins https://agent-plugins.org/specification (section 9),
 * Gemini CLI https://geminicli.com/docs/extensions/reference (Variables),
 * Cursor https://cursor.com/docs/reference/plugins (MCP servers). Checked 2026-10-13.
 */
export const ROOT_VARIABLES = Object.freeze({
  claude: "${CLAUDE_PLUGIN_ROOT}",
  agentPlugins: "${PLUGIN_ROOT}",
  gemini: "${extensionPath}",
  cursor: "${CURSOR_PLUGIN_ROOT}",
});

/** Every file this script owns, in the order it reports them. */
export const TARGETS = Object.freeze([
  { path: ".claude-plugin/plugin.json", client: "Claude Code", render: claudePlugin },
  { path: ".claude-plugin/marketplace.json", client: "Claude Code", render: claudeMarketplace },
  { path: "plugin.json", client: "Agent Plugins (Codex, Cursor and others)", render: portablePlugin },
  { path: "mcp.json", client: "Agent Plugins (Codex, Cursor and others)", render: portableMcp, needsMcp: true },
  { path: ".agents/plugins/marketplace.json", client: "Codex", render: codexMarketplace },
  { path: "gemini-extension.json", client: "Gemini CLI", render: geminiExtension },
  { path: ".cursor-plugin/plugin.json", client: "Cursor", render: cursorPlugin },
]);

/**
 * The package.json fields the build keeps equal to product.json. package.json
 * is a source, not a generated file, so these two are all the build writes in
 * it. npm: https://docs.npmjs.com/cli/v11/configuring-npm/package-json#keywords
 * and #people-fields-author-contributors. Checked 2026-10-13.
 */
export const PACKAGE_FIELDS = Object.freeze(["keywords", "contributors"]);

// Names Claude Code refuses, or flags as passing for one of Anthropic's own,
// which `claude plugin validate --strict` turns into a failure. Plugin names:
// https://code.claude.com/docs/en/plugins-reference#name; marketplace names:
// https://code.claude.com/docs/en/plugins/marketplace-reference#reserved-names. Checked 2026-10-13.
const RESERVED_PLUGIN_PREFIXES = ["claude-", "anthropic-", "anthropics-", "cc-plugin-"];
const RESERVED_MARKETPLACE_PREFIXES = [...RESERVED_PLUGIN_PREFIXES, "claudeai-"];
const RESERVED_WORDS = ["claude", "anthropic", "anthropics"];
const RESERVED_MARKETPLACE_NAMES = new Set([
  "claude-code-marketplace", "claude-code-plugins", "claude-plugins-official", "anthropic-marketplace",
  "anthropic-plugins", "agent-skills", "anthropic-agent-skills", "life-sciences", "knowledge-work-plugins",
  "claude-for-legal", "claude-for-financial-services", "financial-services-plugins", "first-party-plugins",
  "claude-tag-plugins", "claude-community", "claude-plugins-community", "healthcare",
  "anthropic-plugin-directory", "claude-plugin-directory", "inline", "builtin", "skills-dir", "synced",
  "claude-plugin-test", "npm", "pip", "uv", "cargo", "github", "gh", "constructor",
]);

// The intersection of every tool's naming rule: Agent Plugins allows dots,
// which Antigravity rejects; Antigravity allows capitals and underscores,
// which Agent Plugins rejects; Claude Code wants kebab-case; Gemini CLI and
// Cursor want lowercase with hyphens. Only this shape passes all of them.
const PORTABLE_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// The Agent Skills spec fields (https://agentskills.io/specification). Claude
// Code reads more, but claude.ai uploads and the Skills API reject any other
// key, and the other tools ignore them, so a skill that uses one would behave
// differently from tool to tool.
const PORTABLE_SKILL_KEYS = new Set(["name", "description", "license", "compatibility", "metadata", "allowed-tools"]);

const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const HTTPS_URL = /^https:\/\/[^\s/$.?#][^\s]*$/;

export class BuildError extends Error {
  constructor(problems) {
    super(problems.join("\n"));
    this.name = "BuildError";
    this.problems = problems;
  }
}

const here = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = resolve(here, "..", "..");

/**
 * Reads everything the manifests are built from.
 * @param {string} root the repository root
 */
export function loadSources(root) {
  const problems = [];
  const product = readJson(join(root, "product.json"), problems);
  const pkg = readJson(join(root, "package.json"), problems);
  const skills = readSkills(root, problems);
  const agents = readAgents(root, problems);
  if (problems.length > 0) throw new BuildError(problems);
  return { product, version: pkg.version, pkg, skills, agents };
}

function readJson(file, problems) {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch (error) {
    problems.push(`${file}: ${error.code === "ENOENT" ? "missing" : error.message}`);
    return {};
  }
}

function isDirectory(path) {
  return existsSync(path) && statSync(path).isDirectory();
}

function readSkills(root, problems) {
  const dir = join(root, "skills");
  if (!isDirectory(dir)) return [];
  const skills = [];
  for (const entry of sortedEntries(dir)) {
    const folder = join(dir, entry);
    if (!isDirectory(folder)) continue;
    const file = join(folder, "SKILL.md");
    const shown = toPosix(relative(root, file));
    if (!existsSync(file)) {
      // npx skills finds SKILL.md files nested in catalog folders, while Claude
      // Code and the Agent Plugins standard only look one level down, so a
      // nested skill would exist in some tools and not in others.
      const nested = findNestedSkill(folder, 2);
      if (nested) problems.push(`${toPosix(relative(root, nested))}: skills must sit at skills/<name>/SKILL.md, or some tools will not load them`);
      continue;
    }
    try {
      const { data } = parseFrontmatter(readFileSync(file, "utf8"), shown);
      skills.push({ dir: entry, file: shown, data });
    } catch (error) {
      if (error instanceof FrontmatterError) problems.push(error.message);
      else throw error;
    }
  }
  return skills;
}

function findNestedSkill(folder, depth) {
  if (depth === 0) return null;
  for (const entry of sortedEntries(folder)) {
    const path = join(folder, entry);
    if (!isDirectory(path)) continue;
    if (existsSync(join(path, "SKILL.md"))) return join(path, "SKILL.md");
    const deeper = findNestedSkill(path, depth - 1);
    if (deeper) return deeper;
  }
  return null;
}

function readAgents(root, problems) {
  const dir = join(root, "agents");
  if (!isDirectory(dir)) return [];
  const agents = [];
  for (const entry of sortedEntries(dir)) {
    const path = join(dir, entry);
    const shown = toPosix(relative(root, path));
    if (isDirectory(path)) {
      // Claude Code turns subfolders into part of the agent's name and the
      // other tools do not, so the same agent would be called two things.
      problems.push(`${shown}: agents must be flat .md files directly in agents/`);
      continue;
    }
    if (!entry.endsWith(".md")) continue;
    try {
      const { data } = parseFrontmatter(readFileSync(path, "utf8"), shown);
      agents.push({ file: shown, stem: entry.slice(0, -3), data });
    } catch (error) {
      if (error instanceof FrontmatterError) problems.push(error.message);
      else throw error;
    }
  }
  return agents;
}

function sortedEntries(dir) {
  // Sorted so the output never depends on the order the file system lists them in.
  return readdirSync(dir).filter((name) => !name.startsWith(".")).sort();
}

function toPosix(path) {
  return path.split(sep).join("/");
}

/**
 * Checks the sources against the strictest rule of every tool.
 * @returns {string[]} one line per problem; empty when everything passes
 */
export function validateSources(sources) {
  const problems = [];
  const { product: p, version, skills, agents } = sources;
  const at = (field) => `product.json ${field}`;

  checkPluginName(p.name, at("name"), problems);
  requireText(p.displayName, at("displayName"), problems, 30);
  requireText(p.description, at("description"), problems, 4000);
  requireText(p.shortDescription, at("shortDescription"), problems, 30);
  if (typeof version !== "string" || !SEMVER.test(version)) {
    problems.push(`package.json version: "${version}" is not a semantic version, which Cursor and the Agent Plugins standard expect`);
  }
  if (!p.author || typeof p.author !== "object") {
    problems.push(`${at("author")}: required, with a name`);
  } else {
    requireText(p.author.name, at("author.name"), problems, 120);
    if (p.author.url !== undefined) requireHttps(p.author.url, at("author.url"), problems);
    if (p.author.email !== undefined) problems.push(`${at("author.email")}: leave it out; the repository carries no email addresses`);
    for (const key of Object.keys(p.author)) {
      if (!["name", "url", "email"].includes(key)) problems.push(`${at(`author.${key}`)}: not a field any tool reads`);
    }
  }
  requireHttps(p.homepage, at("homepage"), problems);
  requireHttps(p.repository, at("repository"), problems);
  requireText(p.license, at("license"), problems);
  requireText(p.category, at("category"), problems);
  if (!Array.isArray(p.keywords) || p.keywords.some((k) => typeof k !== "string" || k.trim() === "")) {
    problems.push(`${at("keywords")}: must be a list of words`);
  } else if (new Set(p.keywords).size !== p.keywords.length) {
    problems.push(`${at("keywords")}: has duplicates`);
  }
  if (typeof p.prefix !== "string" || !/^[a-z0-9]+$/.test(p.prefix)) {
    problems.push(`${at("prefix")}: must be lowercase letters and digits, such as "seo"`);
  }

  const m = p.marketplace ?? {};
  checkMarketplaceName(m.name, at("marketplace.name"), problems);
  requireText(m.displayName, at("marketplace.displayName"), problems);
  requireText(m.description, at("marketplace.description"), problems);

  if (p.mcp !== undefined) {
    const list = mcpList(p);
    if (list.length === 0) problems.push("product.json mcp: an empty list; leave mcp out instead");
    list.forEach((mcp, index) => checkMcp(mcp, problems, Array.isArray(p.mcp) ? `product.json mcp[${index}]` : "product.json mcp"));
    const names = list.map((mcp) => mcp?.server);
    if (new Set(names).size !== names.length) problems.push("product.json mcp: two servers share a name, and every manifest keys servers by name");
  }

  const seen = new Set();
  for (const skill of skills) checkSkill(skill, p.prefix, seen, problems);
  for (const agent of agents) checkAgent(agent, p.prefix, seen, problems);
  return problems;
}

function requireText(value, where, problems, max) {
  if (typeof value !== "string" || value.trim() === "") {
    problems.push(`${where}: required`);
  } else if (max !== undefined && value.length > max) {
    problems.push(`${where}: ${value.length} characters, over the ${max} some tools allow`);
  }
}

function requireHttps(value, where, problems) {
  if (typeof value !== "string" || !HTTPS_URL.test(value)) problems.push(`${where}: must be an https:// URL`);
}

/** Plugin names: portable shape, at most 64 characters, and nothing Claude Code reserves. */
export function checkPluginName(name, where, problems) {
  if (typeof name !== "string" || !PORTABLE_NAME.test(name) || name.length > 64) {
    problems.push(`${where}: "${name}" must be 1 to 64 lowercase letters, digits and single hyphens, the one shape every tool accepts`);
    return;
  }
  checkReserved(name, RESERVED_PLUGIN_PREFIXES, where, problems);
}

function checkMarketplaceName(name, where, problems) {
  if (typeof name !== "string" || !PORTABLE_NAME.test(name) || name.length > 64) {
    problems.push(`${where}: "${name}" must be 1 to 64 lowercase letters, digits and single hyphens`);
    return;
  }
  if (RESERVED_MARKETPLACE_NAMES.has(name)) problems.push(`${where}: "${name}" is a marketplace name Claude Code reserves`);
  checkReserved(name, RESERVED_MARKETPLACE_PREFIXES, where, problems);
}

function checkReserved(name, prefixes, where, problems) {
  const prefix = prefixes.find((start) => name.startsWith(start));
  if (prefix) {
    problems.push(`${where}: "${name}" starts with "${prefix}", which Claude Code reserves for Anthropic`);
    return;
  }
  const words = name.split("-");
  const word = words.find((part) => RESERVED_WORDS.includes(part));
  if (word) problems.push(`${where}: "${name}" contains the word "${word}", which Claude Code reads as one of Anthropic's own`);
}

function checkMcp(mcp, problems, where = "product.json mcp") {
  if (!mcp || typeof mcp !== "object") {
    problems.push(`${where}: required`);
    return;
  }
  if (typeof mcp.server !== "string" || !PORTABLE_NAME.test(mcp.server)) {
    problems.push(`${where}.server: must be lowercase letters, digits and single hyphens`);
  }
  // The Agent Plugins standard launches a single executable token and expands
  // no variables in it, so only a bare name such as node or npx means the same
  // thing in every tool.
  if (typeof mcp.command !== "string" || !/^[A-Za-z0-9._-]+$/.test(mcp.command)) {
    problems.push(`${where}.command: must be a bare executable name such as "node" or "npx"`);
  }
  if (!Array.isArray(mcp.args) || mcp.args.some((arg) => typeof arg !== "string")) {
    problems.push(`${where}.args: must be a list of strings`);
  } else {
    mcp.args.forEach((arg, index) => checkVariables(arg, `${where}.args[${index}]`, problems));
  }
  if (mcp.env !== undefined) {
    if (!mcp.env || typeof mcp.env !== "object" || Array.isArray(mcp.env)) {
      problems.push(`${where}.env: must be a map of names to values`);
    } else {
      for (const [key, value] of Object.entries(mcp.env)) {
        if (key === "PLUGIN_ROOT" || key === "PLUGIN_DATA") problems.push(`${where}.env.${key}: reserved; the tool sets it`);
        if (typeof value !== "string") problems.push(`${where}.env.${key}: must be a string`);
        else checkVariables(value, `${where}.env.${key}`, problems);
      }
    }
  }
}

function checkVariables(value, where, problems) {
  for (const found of value.match(/\$\{[^}]*\}/g) ?? []) {
    if (found !== ROOT_TOKEN) {
      problems.push(`${where}: ${found} is not portable; ${ROOT_TOKEN} is the only variable every tool can be given`);
    }
  }
}

function checkName(name, prefix, where, problems) {
  if (typeof name !== "string" || !PORTABLE_NAME.test(name) || name.length > 64) {
    problems.push(`${where}: "${name}" must be 1 to 64 lowercase letters, digits and single hyphens (Agent Skills rule)`);
    return false;
  }
  if (typeof prefix === "string" && name !== prefix && !name.startsWith(`${prefix}-`)) {
    problems.push(`${where}: "${name}" must be "${prefix}" or start with "${prefix}-", so it cannot clash with another product's skills in a combined install`);
    return false;
  }
  return true;
}

function checkSkill(skill, prefix, seen, problems) {
  const { data, dir, file } = skill;
  for (const key of Object.keys(data)) {
    if (!PORTABLE_SKILL_KEYS.has(key)) {
      problems.push(`${file}: frontmatter key "${key}" is not in the Agent Skills spec, so tools would treat this skill differently`);
    }
  }
  if (checkName(dir, prefix, `${file} folder`, problems) && data.name !== dir) {
    problems.push(`${file}: name "${data.name}" must match its folder "${dir}"`);
  }
  if (typeof data.description !== "string" || data.description.trim() === "") {
    problems.push(`${file}: description is required`);
  } else if (data.description.length > 1024) {
    problems.push(`${file}: description is ${data.description.length} characters, over the 1024 the Agent Skills spec allows`);
  }
  if (data.compatibility !== undefined && (typeof data.compatibility !== "string" || data.compatibility.length > 500)) {
    problems.push(`${file}: compatibility must be text of at most 500 characters`);
  }
  if (data.metadata !== undefined) {
    const valid = data.metadata && typeof data.metadata === "object" && !Array.isArray(data.metadata) &&
      Object.values(data.metadata).every((value) => typeof value === "string");
    if (!valid) problems.push(`${file}: metadata must map names to text`);
  }
  if (data["allowed-tools"] !== undefined && typeof data["allowed-tools"] !== "string") {
    problems.push(`${file}: allowed-tools must be one space-separated line`);
  }
  if (seen.has(dir)) problems.push(`${file}: the name "${dir}" is already used`);
  seen.add(dir);
}

function checkAgent(agent, prefix, seen, problems) {
  const { data, stem, file } = agent;
  if (checkName(stem, prefix, `${file} file name`, problems) && data.name !== stem) {
    problems.push(`${file}: name "${data.name}" must match its file name "${stem}"`);
  }
  if (typeof data.description !== "string" || data.description.trim() === "") {
    problems.push(`${file}: description is required`);
  }
  if (data.model !== undefined) {
    problems.push(`${file}: model is set; agents inherit the user's model, and no tool shares model names with another`);
  }
  if (seen.has(stem)) problems.push(`${file}: the name "${stem}" is already used by a skill or agent`);
  seen.add(stem);
}

// ---------------------------------------------------------------------------
// Rendering. Objects are built in a fixed key order and printed the same way
// every time, so the same sources always give byte-identical files.

function author(p, { withUrl = true } = {}) {
  const out = { name: p.author.name };
  if (withUrl && p.author.url) out.url = p.author.url;
  return out;
}

/** The MCP server entry in one tool's dialect, with the install folder named the way that tool names it. */
/** product.json mcp as a list: absent is none, one object is one server, a list is several. */
export function mcpList(p) {
  if (p.mcp === undefined) return [];
  return Array.isArray(p.mcp) ? p.mcp : [p.mcp];
}

function mcpServers(p, rootVariable, options) {
  return Object.fromEntries(mcpList(p).map((mcp) => [mcp.server, mcpServer(mcp, rootVariable, options)]));
}

export function mcpServer(mcp, rootVariable, { withType = false } = {}) {
  const swap = (value) => value.split(ROOT_TOKEN).join(rootVariable);
  const server = {};
  if (withType) server.type = "stdio";
  server.command = mcp.command;
  server.args = mcp.args.map(swap);
  const env = Object.entries(mcp.env ?? {});
  if (env.length > 0) server.env = Object.fromEntries(env.map(([key, value]) => [key, swap(value)]));
  return server;
}

// Claude Code: https://code.claude.com/docs/en/plugins-reference
function claudePlugin({ product: p, version }) {
  return {
    name: p.name,
    displayName: p.displayName,
    version,
    description: p.description,
    author: author(p),
    homepage: p.homepage,
    repository: p.repository,
    license: p.license,
    keywords: p.keywords,
    ...(mcpList(p).length > 0 ? { mcpServers: mcpServers(p, ROOT_VARIABLES.claude) } : {}),
  };
}

// Claude Code: https://code.claude.com/docs/en/plugins/marketplace-reference
// "./" makes the repository root the plugin, so one repo is both.
function claudeMarketplace({ product: p }) {
  return {
    name: p.marketplace.name,
    owner: author(p),
    description: p.marketplace.description,
    plugins: [
      {
        name: p.name,
        source: "./",
        description: p.description,
        category: p.category,
      },
    ],
  };
}

// Agent Plugins 1.0.0 (https://agent-plugins.org/specification): read by Codex
// (https://developers.openai.com/codex/plugins/build) and Cursor. The manifest
// is closed, so Codex's listing details go under extensions["com.openai"].
function portablePlugin({ product: p, version }) {
  return {
    $schema: AGENT_PLUGINS_PLUGIN_SCHEMA,
    name: p.name,
    version,
    description: p.description,
    author: author(p),
    homepage: p.homepage,
    repository: p.repository,
    license: p.license,
    keywords: p.keywords,
    extensions: {
      "com.openai": {
        interface: {
          displayName: p.displayName,
          shortDescription: p.shortDescription,
          longDescription: p.description,
          developerName: p.author.name,
          category: p.category,
          websiteURL: p.homepage,
        },
      },
    },
  };
}

// Agent Plugins MCP configuration: the only place Codex reads a portable
// plugin's MCP servers from.
function portableMcp({ product: p }) {
  return {
    $schema: AGENT_PLUGINS_MCP_SCHEMA,
    mcpServers: mcpServers(p, ROOT_VARIABLES.agentPlugins, { withType: true }),
  };
}

// Codex repo marketplace: https://developers.openai.com/codex/plugins/build#marketplace-metadata
// The plugin is the marketplace root, so its path is "./".
function codexMarketplace({ product: p }) {
  return {
    name: p.marketplace.name,
    interface: { displayName: p.marketplace.displayName },
    plugins: [
      {
        name: p.name,
        source: { source: "local", path: "./" },
        policy: { installation: "AVAILABLE", authentication: "ON_INSTALL" },
        category: p.category,
      },
    ],
  };
}

// Gemini CLI: https://geminicli.com/docs/extensions/reference
// No contextFileName: a context file would load into every session, and the
// skills already load only when they are needed.
function geminiExtension({ product: p, version }) {
  return {
    name: p.name,
    version,
    description: p.description,
    ...(mcpList(p).length > 0 ? { mcpServers: mcpServers(p, ROOT_VARIABLES.gemini) } : {}),
  };
}

// Cursor: https://cursor.com/docs/reference/plugins
// Cursor documents only name and email for the author. The inline MCP entry
// replaces Cursor's default reading of mcp.json, which matters because Cursor
// does not expand ${PLUGIN_ROOT} there.
function cursorPlugin({ product: p, version }) {
  return {
    name: p.name,
    version,
    description: p.description,
    author: author(p, { withUrl: false }),
    homepage: p.homepage,
    repository: p.repository,
    license: p.license,
    keywords: p.keywords,
    ...(mcpList(p).length > 0 ? { mcpServers: mcpServers(p, ROOT_VARIABLES.cursor) } : {}),
  };
}

// npm's one-line person, "Name (url)". Never an email: product.json may not
// hold one, and npm republishes these fields on the package page.
function npmPerson(person) {
  return person.url ? `${person.name} (${person.url})` : person.name;
}

/** The value the build gives each of PACKAGE_FIELDS. */
export function packageFields({ product: p }) {
  return { keywords: p.keywords, contributors: [npmPerson(p.author)] };
}

/**
 * package.json with PACKAGE_FIELDS set from product.json. A field already in
 * the file keeps its place, a missing one is added at the end, and every other
 * field is left as it is.
 */
export function renderPackage(sources) {
  return stringify({ ...sources.pkg, ...packageFields(sources) });
}

export function stringify(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

/**
 * Renders every manifest in memory.
 * @returns {Map<string, string>} repository-relative path to file contents
 */
export function renderManifests(sources) {
  const problems = validateSources(sources);
  if (problems.length > 0) throw new BuildError(problems);
  return new Map(activeTargets(sources).map((target) => [target.path, stringify(target.render(sources))]));
}

/** The targets this product needs: mcp.json only when it ships an MCP server. */
export function activeTargets(sources) {
  return TARGETS.filter((target) => !target.needsMcp || mcpList(sources.product).length > 0);
}

/**
 * Builds, or with check only compares, every manifest and the package.json
 * fields under root. package.json is reported after the manifests.
 * @returns {{ written: string[], stale: string[], unchanged: string[] }}
 */
export function build(root, { check = false } = {}) {
  const sources = loadSources(root);
  const outputs = renderManifests(sources);
  outputs.set("package.json", renderPackage(sources));
  const result = { written: [], stale: [], unchanged: [] };
  for (const [path, contents] of outputs) {
    const file = join(root, path);
    const current = existsSync(file) ? readFileSync(file, "utf8") : null;
    if (current === contents) {
      result.unchanged.push(path);
    } else if (check) {
      result.stale.push(path);
    } else {
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, contents);
      result.written.push(path);
    }
  }
  return result;
}

function parseArgs(argv) {
  const options = { check: false, root: REPO_ROOT };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--check") options.check = true;
    else if (arg === "--root" && argv[i + 1]) options.root = resolve(argv[++i]);
    else if (arg === "--help" || arg === "-h") options.help = true;
    else throw new BuildError([`unknown argument "${arg}"; use --check or --root <dir>`]);
  }
  return options;
}

function main(argv) {
  let options;
  try {
    options = parseArgs(argv);
    if (options.help) {
      process.stdout.write("Usage: node scripts/manifests/build.mjs [--check] [--root <dir>]\n");
      return 0;
    }
    const result = build(options.root, { check: options.check });
    if (options.check) {
      if (result.stale.length > 0) {
        for (const path of result.stale) process.stderr.write(`out of date: ${path}\n`);
        process.stderr.write("Run `node scripts/manifests/build.mjs` and commit the result.\n");
        return 1;
      }
      process.stdout.write(`All ${result.unchanged.length - 1} manifests and the package.json ${PACKAGE_FIELDS.join(" and ")} match product.json.\n`);
      return 0;
    }
    for (const path of result.written) process.stdout.write(`wrote ${path}\n`);
    process.stdout.write(`${result.written.length} written, ${result.unchanged.length} unchanged.\n`);
    return 0;
  } catch (error) {
    if (!(error instanceof BuildError)) throw error;
    for (const problem of error.problems) process.stderr.write(`${problem}\n`);
    return 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
