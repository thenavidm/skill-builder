#!/usr/bin/env node
/**
 * The engine every Skill Builder skill runs. Plain words on stdout, or JSON
 * with --json so a skill can read the result. Node 22 built-ins only, so it
 * runs straight from a clone or through npx with nothing to install.
 *
 *   skill-builder check <skill-or-plugin> [--json]   every tool's rules, with the fact behind each
 *   skill-builder tokens <skill-or-plugin> [--json]  what each skill costs on every message and when it runs
 */
import { check } from "../lib/check.mjs";
import { facts } from "../lib/facts.mjs";
import { measure } from "../lib/tokens.mjs";

const [cmd, ...rest] = process.argv.slice(2);
const json = rest.includes("--json");
const args = rest.filter((a) => !a.startsWith("--"));

function printFindings(result) {
  const order = { error: 0, warning: 1, note: 2 };
  const fs = [...result.findings].sort((a, b) => order[a.level] - order[b.level] || a.file.localeCompare(b.file));
  const count = (l) => fs.filter((f) => f.level === l).length;
  const what = result.kind === "plugin" ? `${result.skills.length} skills` : "1 skill";
  console.log(`${what}: ${count("error")} errors, ${count("warning")} warnings, ${count("note")} notes`);
  for (const f of fs) {
    const where = f.line ? `${f.file}:${f.line}` : f.file;
    const source = f.fact ? ` [${f.fact}, checked ${facts().get(f.fact)?.sources?.[0]?.checked ?? "never"}]` : "";
    console.log(`  ${f.level.padEnd(7)} ${where}  ${f.message}${source}`);
  }
}

switch (cmd) {
  case "check": {
    const result = check(args[0] ?? ".");
    if (json) console.log(JSON.stringify(result, null, 2));
    else printFindings(result);
    if (result.findings.some((f) => f.level === "error")) process.exitCode = 1;
    break;
  }
  case "tokens": {
    const m = measure(args[0] ?? ".");
    if (json) {
      console.log(JSON.stringify(m, null, 2));
      break;
    }
    const pct = (x) => `${Math.round(x * 100)}%`;
    console.log(`Estimates at ${m.charsPerToken} characters a token, measured on Claude Code's own counts.`);
    console.log(`\n${"skill".padEnd(28)} ${"every message".padStart(13)} ${"when it runs".padStart(13)}  files it can load`);
    for (const s of [...m.skills].sort((a, b) => b.listingTokens - a.listingTokens)) {
      const files = s.files.reduce((n, f) => n + f.tokens, 0);
      console.log(`${s.name.padEnd(28)} ${String(s.listingTokens).padStart(13)} ${String(s.loadTokens).padStart(13)}  ${files ? `${s.files.length} files, ${files} tokens` : "none"}`);
    }
    console.log(`\nThe plugin's skills cost about ${m.listing} tokens on every message${m.agents.length ? `, and its ${m.agents.length} agents another ${m.agentListing}` : ""}.`);
    for (const b of m.budgets) {
      console.log(`  ${b.tool} lists skills within ${pct(b.share)} of the context window: this plugin alone uses ${pct(b.of200k)} of that on a 200,000-token model, ${pct(b.of1m)} on a 1,000,000-token one.`);
    }
    console.log("  When the list overflows, descriptions are dropped and those skills stop triggering.");
    break;
  }
  default:
    console.error("usage: skill-builder <check|tokens> <skill-or-plugin> [--json]");
    process.exitCode = 2;
}
