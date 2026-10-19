#!/usr/bin/env node
/**
 * The engine every Skill Builder skill runs. Plain words on stdout, or JSON
 * with --json so a skill can read the result. Node 22 built-ins only, so it
 * runs straight from a clone or through npx with nothing to install.
 *
 *   skill-builder check <skill-or-plugin> [--json]   every tool's rules, with the fact behind each
 */
import { check } from "../lib/check.mjs";
import { facts } from "../lib/facts.mjs";

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
  default:
    console.error("usage: skill-builder check <skill-or-plugin> [--json]");
    process.exitCode = 2;
}
