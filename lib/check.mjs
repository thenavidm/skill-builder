/**
 * Validation in code, for one skill or a whole plugin.
 *
 * Every AI tool reads a skill a little differently, and most of them fail
 * quietly: Claude Code ignores a field it doesn't know, Codex drops
 * descriptions when the list runs long, a path that exists only in one tool
 * simply isn't found in the next. So each rule here comes from a fact in
 * facts/ (each finding names it), and the result is the same on every run.
 *
 * A finding is { level, code, file, line, message, fact }. Levels:
 *   error    a tool will refuse or misread the skill
 *   warning  it loads, but something in it does nothing or works in one tool only
 *   note     worth knowing, nothing to fix
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, dirname, join, normalize, relative, resolve, sep } from "node:path";
import { FrontmatterError, parseFrontmatter } from "../scripts/manifests/frontmatter.mjs";
import { value } from "./facts.mjs";
import { estimateTokens } from "./tokens.mjs";

const STD = "skills.agent-skills.fields";
const SIZE = "skills.agent-skills.size";
const CLAUDE = "skills.claude-code.fields";
const CURSOR = "skills.cursor.fields";
const UNKNOWN = "skills.claude-code.unknown-fields";
const SUBS = "skills.claude-code.substitutions";
const TOLERATED = "skills.extra-fields.tolerated";

/** For each field some tool reads, which tools read it. */
function fieldReaders() {
  const readers = new Map();
  const add = (field, tool) => readers.set(field, [...(readers.get(field) ?? []), tool]);
  const std = value(STD);
  for (const f of [...std.required, ...std.optional]) add(f, "the Agent Skills standard");
  for (const f of value(CLAUDE).fields) add(f, "Claude Code");
  for (const f of value(CURSOR).fields) add(f, "Cursor");
  return readers;
}

/** Fields people write that no tool reads, and what does the job instead. */
const INSTEAD = {
  "auto-activate": "To keep a skill from starting on its own, set `disable-model-invocation: true` (Claude Code, Cursor) and `policy.allow_implicit_invocation: false` in `agents/openai.yaml` (Codex). `skill package` writes both.",
  "auto_activate": "See `auto-activate`: use `disable-model-invocation: true`.",
  "autoActivate": "See `auto-activate`: use `disable-model-invocation: true`.",
  "version": "Put it under `metadata` (`metadata:` then `  version: \"1.0\"`), which every tool keeps.",
  "author": "Put it under `metadata`.",
  "tags": "Put the words people use in the description instead: that is what every tool matches on.",
  "triggers": "Put trigger phrases in the description (or `when_to_use` in Claude Code).",
  "globs": "Cursor still reads `globs` as a fallback, but its current field and Claude Code's is `paths`.",
  "user-invokable": "Did you mean `user-invocable`? This spelling is never read, so the switch it was meant to set is off.",
  "disable-model-invokation": "Did you mean `disable-model-invocation`?",
  "tools": "For a skill the field is `allowed-tools` (`tools` is an agent's field).",
};
const METADATA_HINT = "If your own scripts read it, put it under `metadata`, the standard's place for extra data.";

/**
 * Reads frontmatter with the strict reader, and when a top-level key holds YAML
 * nested deeper than that reader takes (hooks, lists of maps), leaves that key
 * out instead of failing the skill: such YAML is valid, it just isn't checked.
 */
function readFrontmatter(text, shown) {
  const complex = [];
  const loosened = [];
  let source = text;
  for (let tries = 0; tries < 20; tries++) {
    try {
      return { ...parseFrontmatter(source, shown), complex, loosened };
    } catch (e) {
      if (!(e instanceof FrontmatterError)) throw e;
      const at = Number(/:(\d+):/.exec(e.message)?.[1]);
      const lines = source.split("\n");
      // a problem inside an indented block is nested YAML this reader doesn't take;
      // a problem on a top-level line is real and is reported
      const nested = /only one level of nesting|list items must share|expected a `- item`/.test(e.message) || /^\s/.test(lines[at - 1] ?? "");
      // an unquoted ": " or " #" in a top-level value: real tools load it (fact
      // skills.yaml.unquoted-colon), strict readers don't. Quote it, read on, and warn.
      const loose = /contains ": "|contains " #"/.test(e.message) && /^[A-Za-z0-9_-]+:[ \t]+\S/.test(lines[at - 1] ?? "");
      if (loose) {
        const m = /^([A-Za-z0-9_-]+):[ \t]+(.*)$/.exec(lines[at - 1]);
        let end = at;
        while (end < lines.length && lines[end] !== "---" && /^\s+\S/.test(lines[end])) end++;
        const value = [m[2], ...lines.slice(at, end).map((l) => l.trim())].join(" ");
        lines.splice(at - 1, end - at + 1, `${m[1]}: ${JSON.stringify(value)}`);
        loosened.push(m[1]);
        source = lines.join("\n");
        continue;
      }
      if (!nested) throw e;
      let top = at - 1;
      while (top > 0 && /^\s/.test(lines[top] ?? "")) top--;
      const key = /^([A-Za-z0-9_-]+):/.exec(lines[top] ?? "")?.[1];
      if (!key || top < 1) throw e;
      let end = top + 1;
      while (end < lines.length && lines[end] !== "---" && (/^\s/.test(lines[end]) || lines[end] === "")) end++;
      complex.push(key);
      lines.splice(top, end - top);
      source = lines.join("\n");
    }
  }
  return { ...parseFrontmatter(source, shown), complex, loosened };
}

/** The plugin root above a skill folder at <root>/skills/<name>, or null. */
function pluginRootOf(dir) {
  const parent = dirname(resolve(dir));
  return basename(parent) === "skills" ? dirname(parent) : null;
}

/** Reference text that is an example or a pattern, not a file: globs, placeholders. */
const PLACEHOLDER = /[*?{}]|\b(name|example|foo|bar|your|my|xxx)[-_.]|\.\.\.$|^[A-Z_]+$/;

const BOOLEAN_FIELDS = ["disable-model-invocation", "user-invocable", "background"];

/** Commands that exist on macOS only, and what to offer instead. */
const MAC_ONLY = [
  [/(^|[\s`(])open\s+(-a\s+|"?\/|"?~|https?:)/m, "`open`", "`xdg-open` on Linux, `start` on Windows"],
  [/\bpbcopy\b|\bpbpaste\b/, "`pbcopy`/`pbpaste`", "`xclip` or `wl-copy` on Linux, `clip` on Windows"],
  [/\bosascript\b/, "`osascript`", "nothing on Linux or Windows; say what it does in words"],
  [/\bsed -i ''/, "`sed -i ''`", "`sed -i` differs between macOS and Linux; prefer a small script"],
  [/\bmdfind\b/, "`mdfind`", "`find` or `locate`"],
  [/(^|\s)say\s+["'-]/m, "`say`", "`espeak` on Linux"],
  [/\bbrew install\b/, "`brew install`", "the Linux package manager, or a note for each system"],
];

/** Paths and names that belong to one tool. */
const TOOL_PATHS = [
  [/~\/\.claude\b|\.claude\/(skills|agents|commands|settings)/, "a Claude Code folder"],
  [/~\/\.codex\b/, "a Codex folder"],
  [/~\/\.gemini\b|\.gemini\/skills/, "a Gemini folder"],
  [/~\/\.cursor\b|\.cursor\/skills/, "a Cursor folder"],
];

function finding(level, code, file, message, fact, line) {
  return { level, code, file, ...(line ? { line } : {}), message, ...(fact ? { fact } : {}) };
}

/** Line number (1-based) of the first match of `re` in `text`, or undefined. */
function lineOf(text, re) {
  const m = re.exec(text);
  return m ? text.slice(0, m.index).split("\n").length : undefined;
}

/** The code in a Markdown body: fenced blocks and inline code spans, each on its own line, prose replaced by blank lines. */
export function codeOnly(body) {
  const lines = body.split("\n");
  let fenced = false;
  return lines
    .map((line) => {
      if (/^\s*```/.test(line)) {
        fenced = !fenced;
        return "";
      }
      if (fenced) return line;
      return [...line.matchAll(/`([^`]+)`/g)].map((m) => m[1]).join("\n");
    })
    .join("\n");
}

/** Relative file references in a skill's body: Markdown links and backticked paths under the usual folders. */
export function references(body) {
  const out = new Set();
  const noCode = body.replace(/^```[\s\S]*?^```/gm, "");
  for (const m of noCode.matchAll(/\]\(([^)\s#]+)(?:#[^)]*)?\)/g)) out.add(m[1]);
  for (const m of noCode.matchAll(/`((?:references|scripts|assets|templates|examples|agents)\/[^`\s]+)`/g)) out.add(m[1]);
  return [...out].filter((r) => !/^[a-z]+:/i.test(r) && !r.startsWith("#") && !r.includes("${") && !r.includes("<"));
}

/**
 * Checks one skill folder.
 * @param {string} dir the folder holding SKILL.md
 * @param {{ base?: string }} opts base: the path findings are written relative to
 */
export function checkSkill(dir, opts = {}) {
  const base = opts.base ?? dirname(resolve(dir));
  const file = join(dir, "SKILL.md");
  const shown = relative(base, file) || file;
  const out = [];
  if (!existsSync(file)) return [finding("error", "no-skill-md", shown, "There is no SKILL.md here, so no tool will find a skill.", STD)];

  const text = readFileSync(file, "utf8");
  let data;
  let body;
  let complex;
  let loosened;
  try {
    ({ data, body, complex, loosened } = readFrontmatter(text, shown));
  } catch (e) {
    if (!(e instanceof FrontmatterError)) throw e;
    return [finding("error", "frontmatter", shown, `${e.message}. Tools parse frontmatter with different YAML libraries, so anything ambiguous breaks in one of them.`, STD)];
  }
  for (const key of loosened) {
    out.push(finding("warning", "yaml-unquoted", shown, `\`${key}\` holds ": " or " #" without quotes. Claude Code, Codex and Antigravity still load it, but a strict YAML reader stops there. Wrap the value in double quotes.`, "skills.yaml.unquoted-colon"));
  }
  for (const key of complex) {
    out.push(finding("note", "nested-yaml", shown, `\`${key}\` holds nested YAML deeper than this check reads, so its contents weren't checked.`, null));
    data[key] = {};
  }

  const std = value(STD);
  const folder = basename(resolve(dir));

  // name
  if (typeof data.name !== "string" || data.name === "") {
    out.push(finding("error", "name-missing", shown, "`name` is missing. Every tool needs it.", STD));
  } else {
    if (data.name.length > std.nameMax) out.push(finding("error", "name-long", shown, `\`name\` is ${data.name.length} characters; the limit is ${std.nameMax}.`, STD));
    if (!new RegExp(std.namePattern).test(data.name)) {
      out.push(finding("error", "name-shape", shown, `\`name: ${data.name}\` must be lowercase letters, digits and single hyphens, not starting or ending with a hyphen.`, STD));
    }
    if (std.nameMatchesFolder && data.name !== folder) {
      out.push(finding("error", "name-folder", shown, `\`name: ${data.name}\` doesn't match its folder \`${folder}\`. Some tools look the skill up by folder, others by name.`, STD));
    }
  }

  // description
  if (typeof data.description !== "string" || data.description.trim() === "") {
    out.push(finding("error", "description-missing", shown, "`description` is missing. The standard and Codex require it, and it is what a tool reads to decide when to use the skill; Claude Code alone falls back to the first paragraph.", STD));
  } else {
    if (data.description.length > std.descriptionMax) {
      out.push(finding("error", "description-long", shown, `\`description\` is ${data.description.length} characters; the standard's limit is ${std.descriptionMax}.`, STD));
    }
    const listed = data.description.length + (typeof data.when_to_use === "string" ? data.when_to_use.length : 0);
    const cap = value(CLAUDE).listingMax;
    if (listed > cap) {
      out.push(finding("warning", "listing-cut", shown, `\`description\` and \`when_to_use\` together run ${listed} characters; Claude Code cuts the listing at ${cap}, so the end is never read.`, CLAUDE));
    }
  }

  if (typeof data.compatibility === "string" && data.compatibility.length > std.compatibilityMax) {
    out.push(finding("error", "compatibility-long", shown, `\`compatibility\` is ${data.compatibility.length} characters; the limit is ${std.compatibilityMax}.`, STD));
  }
  if (data.metadata !== undefined && (data.metadata === null || typeof data.metadata !== "object" || Array.isArray(data.metadata))) {
    out.push(finding("error", "metadata-shape", shown, "`metadata` must be a map of keys to text values.", STD));
  }
  if (Array.isArray(data["allowed-tools"])) {
    out.push(finding("note", "allowed-tools-list", shown, "The standard writes `allowed-tools` as one space-separated line, such as `Bash(git:*) Read`; a list may not read the same in every tool.", STD));
  }
  for (const f of BOOLEAN_FIELDS) {
    if (data[f] !== undefined && data[f] !== "true" && data[f] !== "false") {
      out.push(finding("error", "not-boolean", shown, `\`${f}\` must be true or false, unquoted.`, CLAUDE));
    }
  }

  // fields no tool reads, and fields only some tools read
  const readers = fieldReaders();
  const standard = new Set([...std.required, ...std.optional]);
  for (const key of Object.keys(data)) {
    const who = readers.get(key);
    if (!who) {
      out.push(finding("warning", "field-unread", shown, `\`${key}\` is not a field any AI tool reads, so it does nothing. Claude Code skips unknown fields without an error, so nothing else will tell you. ${INSTEAD[key] ?? METADATA_HINT}`, UNKNOWN));
    } else if (!standard.has(key)) {
      out.push(finding("note", "field-tool-only", shown, `\`${key}\` is read by ${[...new Set(who)].join(" and ")} only. The other tools still load the skill and skip it.${INSTEAD[key] ? ` ${INSTEAD[key]}` : ""}`, TOLERATED));
    }
  }

  // size
  const size = value(SIZE);
  const lines = text.split("\n").length;
  if (lines > size.maxLines) {
    out.push(finding("warning", "long", shown, `SKILL.md is ${lines} lines; keep it under ${size.maxLines} and move detail into references the skill reads only when a step needs it.`, SIZE));
  }
  const tokens = estimateTokens(body);
  if (tokens > size.maxInstructionTokens) {
    out.push(finding("warning", "heavy", shown, `The instructions run to about ${tokens} tokens (estimated from characters); the standard recommends under ${size.maxInstructionTokens}.`, SIZE));
  }

  // references: present, relative, one level deep. A Markdown link is certainly a
  // reference; a path in backticks may be an example or a file in the user's
  // project, so a missing one is a warning, not an error.
  const root = resolve(dir);
  const pluginRoot = pluginRootOf(dir);
  const links = new Set([...body.replace(/^```[\s\S]*?^```/gm, "").matchAll(/\]\(([^)\s#]+)/g)].map((m) => m[1]));
  for (const ref of references(body)) {
    if (PLACEHOLDER.test(ref)) continue;
    const line = lineOf(body, new RegExp(ref.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))) + (text.split("\n").length - body.split("\n").length);
    if (ref.startsWith("/") || ref.startsWith("~")) {
      out.push(finding("error", "absolute-path", shown, `\`${ref}\` is an absolute path, which exists only on one computer. Use a path relative to the skill folder.`, SIZE, line));
      continue;
    }
    const target = normalize(join(root, ref));
    if (!target.startsWith(root + sep) && target !== root) {
      out.push(finding("warning", "outside-skill", shown, `\`${ref}\` points outside the skill's folder. A tool that installs skills one folder at a time (the skills CLI, for one) won't have it.`, SIZE, line));
    }
    if (existsSync(target)) {
      if (ref.split("/").filter((p) => p && p !== ".").length > 2) {
        out.push(finding("note", "deep-reference", shown, `\`${ref}\` is more than one level below SKILL.md; the standard recommends keeping references one level deep.`, SIZE, line));
      }
    } else if (pluginRoot && existsSync(join(pluginRoot, ref))) {
      out.push(finding("warning", "plugin-root-reference", shown, `\`${ref}\` is found at the plugin's root, not in the skill's folder. That works when the whole plugin installs, but not where skills install one folder at a time (the skills CLI).`, SIZE, line));
    } else if (links.has(ref)) {
      out.push(finding("error", "missing-reference", shown, `\`${ref}\` is linked but doesn't exist.`, SIZE, line));
    } else {
      out.push(finding("warning", "missing-path", shown, `\`${ref}\` is named but not found in the skill's folder. If it is meant to be a file of the skill's, it is missing.`, SIZE, line));
    }
  }

  // features that exist in one tool only
  const offset = text.split("\n").length - body.split("\n").length;
  const at = (re) => {
    const l = lineOf(body, re);
    return l ? l + offset : undefined;
  };
  if (/\$\{CLAUDE_SKILL_DIR\}/.test(body)) {
    out.push(finding("warning", "claude-skill-dir", shown, "`${CLAUDE_SKILL_DIR}` is filled in by Claude Code only; in other tools it stays as text. A path relative to the skill folder works everywhere.", SUBS, at(/\$\{CLAUDE_SKILL_DIR\}/)));
  }
  if (/\$ARGUMENTS\b|(^|\s)\$[0-9]\b/m.test(body)) {
    out.push(finding("note", "claude-arguments", shown, "`$ARGUMENTS` and `$0`, `$1`... are filled in by Claude Code only (and `$0` is the first argument, not all of them). Say in words what to do with the user's request too, so other tools follow it.", SUBS, at(/\$ARGUMENTS\b|(^|\s)\$[0-9]\b/m)));
  }
  if (/(^|\s)!`[^`]+`/m.test(body) || /^```!/m.test(body)) {
    out.push(finding("note", "claude-injection", shown, "`!`command`` runs before the skill loads in Claude Code only; elsewhere the model sees the text. Add a step telling the model to run the command, so every tool gets the same context.", SUBS, at(/(^|\s)!`[^`]+`|^```!/m)));
  }
  for (const [re, what] of TOOL_PATHS) {
    if (re.test(body)) out.push(finding("warning", "tool-path", shown, `The instructions name ${what}, which other tools don't have.`, "skills.locations", at(re)));
  }
  // commands are looked for in code only: in prose, "say" and "open" are just words
  const code = codeOnly(body);
  for (const [re, what, instead] of MAC_ONLY) {
    if (re.test(code)) out.push(finding("warning", "mac-only", shown, `${what} exists on macOS only. Offer ${instead}.`, null, at(re)));
  }
  return out;
}

/** Agent files: flat, with a name and a description, never pinned to a model. */
export function checkAgents(root, skillBodies) {
  const dir = join(root, "agents");
  const out = [];
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir).sort()) {
    const path = join(dir, entry);
    const shown = relative(root, path);
    if (statSync(path).isDirectory()) {
      out.push(finding("error", "agent-nested", shown, "Agents must be flat files in agents/: Claude Code turns a subfolder into part of the agent's name and other tools don't.", null));
      continue;
    }
    if (!entry.endsWith(".md")) continue;
    let data;
    try {
      ({ data } = parseFrontmatter(readFileSync(path, "utf8"), shown));
    } catch (e) {
      if (!(e instanceof FrontmatterError)) throw e;
      out.push(finding("error", "frontmatter", shown, e.message, null));
      continue;
    }
    const name = entry.replace(/\.md$/, "");
    if (data.name !== name) out.push(finding("error", "agent-name", shown, `\`name\` should be \`${name}\`, the file's name.`, null));
    if (typeof data.description !== "string" || !data.description.trim()) out.push(finding("error", "agent-description", shown, "`description` is missing; it is how a tool decides to start the agent.", null));
    if (data.model !== undefined && data.model !== "inherit") {
      out.push(finding("warning", "agent-model", shown, `\`model: ${data.model}\` pins the agent to a model name one tool knows and others don't. Leave it out so the agent runs on the model in use.`, null));
    }
    if (!skillBodies.some((b) => b.includes(name))) {
      out.push(finding("warning", "agent-orphan", shown, `No skill starts \`${name}\`. An agent nothing starts only runs if a tool picks it on its own.`, null));
    }
  }
  return out;
}

/** True when `path` is a plugin (or skills) repo rather than one skill. */
export function isPlugin(path) {
  return existsSync(join(path, "skills")) && !existsSync(join(path, "SKILL.md"));
}

/** Checks every skill in skills/, the agents, and duplicate names. */
export function checkPlugin(root) {
  const out = [];
  const skillsDir = join(root, "skills");
  const skills = readdirSync(skillsDir).filter((n) => statSync(join(skillsDir, n)).isDirectory()).sort();
  const bodies = [];
  for (const name of skills) {
    out.push(...checkSkill(join(skillsDir, name), { base: root }));
    const md = join(skillsDir, name, "SKILL.md");
    if (existsSync(md)) bodies.push(readFileSync(md, "utf8"));
  }
  out.push(...checkAgents(root, bodies));
  return { skills, findings: out };
}

/** Checks a skill folder or a plugin root. */
export function check(path) {
  const root = resolve(path);
  if (isPlugin(root)) {
    const { skills, findings } = checkPlugin(root);
    return { kind: "plugin", path: root, skills, findings };
  }
  return { kind: "skill", path: root, skills: [basename(root)], findings: checkSkill(root) };
}
