/**
 * What a skill costs. Two numbers matter, and they matter differently:
 *
 *   listing  the name and description, in context on every message of every
 *            session, used or not. Tools cap the whole list (Claude Code at 1%
 *            of the context window, Codex at 2%) and drop descriptions when it
 *            overflows, so a heavy plugin can stop its own skills triggering.
 *   load     the SKILL.md body, paid only when the skill runs.
 *
 * Exact counts need each vendor's API, so these are estimates from characters,
 * at the rate measured on Claude Code's own counts (fact
 * tokens.claude.chars-per-token), and every number shown says so.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { parseFrontmatter } from "../scripts/manifests/frontmatter.mjs";
import { value } from "./facts.mjs";

export const CHARS_PER_TOKEN = value("tokens.claude.chars-per-token").charsPerToken;

export function estimateTokens(text) {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/** The text a tool lists for a skill: its name and description (Claude Code adds when_to_use), capped as Claude Code caps it. */
export function listingText(name, data) {
  const cap = value("skills.claude-code.fields").listingMax;
  const text = [data.description ?? "", data.when_to_use ?? ""].filter(Boolean).join(" ");
  return `${name}: ${text.slice(0, cap)}`;
}

function frontmatterOf(path) {
  try {
    return parseFrontmatter(readFileSync(path, "utf8"), path);
  } catch {
    // check reports broken frontmatter; here, count the raw text so a broken skill still has a cost
    const text = readFileSync(path, "utf8");
    return { data: {}, body: text };
  }
}

/** One skill's listing and load cost, and the size of each file it can load later. */
export function measureSkill(dir) {
  const md = join(dir, "SKILL.md");
  const { data, body } = frontmatterOf(md);
  const name = typeof data.name === "string" ? data.name : basename(resolve(dir));
  const files = [];
  const walk = (d, rel) => {
    for (const e of readdirSync(d).sort()) {
      const p = join(d, e);
      const r = rel ? `${rel}/${e}` : e;
      if (statSync(p).isDirectory()) walk(p, r);
      else if (r !== "SKILL.md" && /\.(md|txt|json|ya?ml)$/i.test(e)) files.push({ path: r, tokens: estimateTokens(readFileSync(p, "utf8")) });
    }
  };
  walk(dir, "");
  return {
    name,
    listingTokens: estimateTokens(listingText(name, data)),
    loadTokens: estimateTokens(body),
    manualOnly: data["disable-model-invocation"] === "true",
    files,
  };
}

/** Every skill and agent in a plugin, with the listing total against each tool's budget. */
export function measure(path) {
  const root = resolve(path);
  const skillDirs = existsSync(join(root, "SKILL.md"))
    ? [root]
    : existsSync(join(root, "skills"))
      ? readdirSync(join(root, "skills")).map((n) => join(root, "skills", n)).filter((d) => existsSync(join(d, "SKILL.md")))
      : [];
  const skills = skillDirs.map(measureSkill);
  const agents = existsSync(join(root, "agents"))
    ? readdirSync(join(root, "agents"))
        .filter((f) => f.endsWith(".md"))
        .map((f) => {
          const { data, body } = frontmatterOf(join(root, "agents", f));
          return { name: f.replace(/\.md$/, ""), listingTokens: estimateTokens(`${data.name ?? f}: ${data.description ?? ""}`), loadTokens: estimateTokens(body) };
        })
    : [];
  // a skill that only runs when asked still sits in the listing in most tools, so it still counts
  const listing = skills.reduce((n, s) => n + s.listingTokens, 0);
  const budgets = [
    { tool: "Claude Code", share: value("skills.claude-code.listing-budget").budgetShare, fact: "skills.claude-code.listing-budget" },
    { tool: "Codex", share: value("skills.codex.listing-budget").budgetShare, fact: "skills.codex.listing-budget" },
  ].map((b) => ({
    ...b,
    // two common context windows, so the share is concrete
    of200k: listing / (200_000 * b.share),
    of1m: listing / (1_000_000 * b.share),
  }));
  return { path: root, charsPerToken: CHARS_PER_TOKEN, skills, agents, listing, agentListing: agents.reduce((n, a) => n + a.listingTokens, 0), budgets };
}
