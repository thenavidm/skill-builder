#!/usr/bin/env node
/**
 * The engine every Skill Builder skill runs. Plain words on stdout, or JSON
 * with --json so a skill can read the result. Node 22 built-ins only, so it
 * runs straight from a clone or through npx with nothing to install.
 *
 *   skill-builder check <skill-or-plugin> [--json]   every tool's rules, with the fact behind each
 *   skill-builder tokens <skill-or-plugin> [--json]  what each skill costs on every message and when it runs
 *   skill-builder trigger <skill-or-plugin> --set prompts.json [--tools claude,codex,antigravity]
 *                 [--runs 3] [--concurrency 3] [--timeout 120] [--split] [--dry] [--json]
 *                 each prompt in each real tool: did the right skill fire, and what fired instead
 */
import { check } from "../lib/check.mjs";
import { facts } from "../lib/facts.mjs";
import { measure } from "../lib/tokens.mjs";
import { TOOLS, installedTools } from "../lib/tools.mjs";
import { loadSet, skillFolders, split, trigger } from "../lib/trigger.mjs";
import { basename } from "node:path";

const [cmd, ...rest] = process.argv.slice(2);
const SWITCHES = new Set(["json", "dry", "split", "keep"]);
const flags = {};
const args = [];
for (let i = 0; i < rest.length; i++) {
  const a = rest[i];
  if (!a.startsWith("--")) args.push(a);
  else if (SWITCHES.has(a.slice(2))) flags[a.slice(2)] = true;
  else flags[a.slice(2)] = rest[++i];
}
const json = Boolean(flags.json);
const num = (k, d) => (flags[k] === undefined ? d : Number(flags[k]));

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
  case "trigger": {
    const path = args[0] ?? ".";
    if (!flags.set) {
      console.error("trigger needs --set <prompts.json>: a list of { prompt, expect } (expect: the skill that should fire, or null)");
      process.exitCode = 2;
      break;
    }
    const names = skillFolders(path).map((f) => basename(f));
    const set = loadSet(flags.set, names);
    const installed = await installedTools();
    const tools = flags.tools ? String(flags.tools).split(",") : installed.filter((t) => !TOOLS[t].unverified);
    const missing = tools.filter((t) => !installed.includes(t));
    if (missing.length) {
      console.error(`Not installed here: ${missing.join(", ")}.`);
      process.exitCode = 2;
      break;
    }
    const runs = num("runs", 3);
    const total = tools.length * set.length * runs;
    if (flags.dry || !json) console.error(`${set.length} prompts x ${runs} runs x ${tools.length} tools (${tools.map((t) => TOOLS[t].label).join(", ")}) = ${total} runs, each a real request on your own account.`);
    if (flags.dry) break;
    let doneRuns = 0;
    const result = await trigger(path, set, {
      tools,
      runs,
      concurrency: num("concurrency", 3),
      timeoutS: num("timeout", 120),
      keep: Boolean(flags.keep),
      onRun: () => {
        doneRuns++;
        if (!json && process.stderr.isTTY) process.stderr.write(`\r${doneRuns}/${total} runs`);
      },
    });
    if (!json && process.stderr.isTTY) process.stderr.write("\n");
    const halves = flags.split ? split(set) : null;
    if (json) {
      console.log(JSON.stringify({ ...result, ...(halves ? { split: { train: halves.train.map((p) => p.prompt), test: halves.test.map((p) => p.prompt) } } : {}) }, null, 2));
      break;
    }
    for (const t of Object.values(result.tools)) {
      const s = t.summary;
      console.log(`\n${t.label}${t.unverified ? " (unverified: how it shows a skill firing isn't confirmed)" : ""}`);
      console.log(`  should fire: ${s.shouldFire.passed} of ${s.shouldFire.of}   should not: ${s.shouldNot.passed} of ${s.shouldNot.of}   right on ${Math.round(s.accuracy * 100)}% of prompts`);
      for (const p of t.prompts.filter((x) => !x.pass)) {
        const went = Object.entries({ ...p.ours, ...p.others }).map(([k, v]) => `${k} x${v}`).join(", ") || "nothing";
        console.log(`  missed  "${p.prompt.slice(0, 70)}${p.prompt.length > 70 ? "..." : ""}"  wanted ${p.expect ?? "none of these"}, got ${went} (${p.hits}/${p.runs - p.errors})`);
      }
      const other = Object.entries(s.otherSkills);
      if (other.length) console.log(`  other installed skills that took these prompts: ${other.map(([k, v]) => `${k} x${v}`).join(", ")}`);
    }
    break;
  }
  default:
    console.error("usage: skill-builder <check|tokens|trigger> <skill-or-plugin> [options]");
    process.exitCode = 2;
}
