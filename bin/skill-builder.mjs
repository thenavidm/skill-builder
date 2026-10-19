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
 *   skill-builder package [plugin] [--check]          product.json into every tool's manifest, plus each
 *                                                     "only when asked" skill's Codex file
 *   skill-builder repo new <dir> --profile p.json [--dry]   a new plugin repo with every house file,
 *                                                     its manifests built, then checked
 *   skill-builder repo publish --profile p.json       the GitHub steps, in order, for a yes on each
 *   skill-builder eval <skill> [--tool claude] [--runs 3] [--grader claude] [--only <eval>] [--out dir]
 *                 the skill's evals with and without it, graded, with a review page
 */
import { check } from "../lib/check.mjs";
import { facts } from "../lib/facts.mjs";
import { measure } from "../lib/tokens.mjs";
import { TOOLS, installedTools } from "../lib/tools.mjs";
import { loadSet, skillFolders, split, trigger } from "../lib/trigger.mjs";
import { packagePlugin } from "../lib/package.mjs";
import { publishSteps, scaffold } from "../lib/repo.mjs";
import { readFileSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { evaluate, loadEvals } from "../lib/eval.mjs";
import { writeReview } from "../lib/review.mjs";
import { BuildError } from "../scripts/manifests/build.mjs";
import { basename } from "node:path";

const [cmd, ...rest] = process.argv.slice(2);
// Switches never take a value, so `--check` can't swallow the path after it, and a
// flag with nothing after it counts as a switch: a check must never become a write.
const SWITCHES = new Set(["json", "dry", "split", "keep", "check"]);
const flags = {};
const args = [];
for (let i = 0; i < rest.length; i++) {
  const a = rest[i];
  if (!a.startsWith("--")) args.push(a);
  else if (SWITCHES.has(a.slice(2)) || rest[i + 1] === undefined || rest[i + 1].startsWith("--")) flags[a.slice(2)] = true;
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
  case "package": {
    let r;
    try {
      r = await packagePlugin(args[0] ?? ".", { check: Boolean(flags.check) });
    } catch (e) {
      if (!(e instanceof BuildError)) throw e;
      for (const p of e.problems) console.error(p);
      process.exitCode = 1;
      break;
    }
    if (json) {
      console.log(JSON.stringify(r, null, 2));
    } else if (flags.check) {
      for (const p of r.stale) console.error(`out of date: ${p}`);
      if (r.stale.length) console.error("Run `skill-builder package` and commit the result.");
      else console.log(`Every manifest and skill file matches product.json and the skills.`);
    } else {
      for (const p of [...r.manifests.written, ...r.sidecars.written]) console.log(`wrote ${p}`);
      for (const p of r.sidecars.removed) console.log(`removed ${p} (the skill no longer waits to be asked)`);
      for (const p of r.sidecars.kept) console.log(`left ${p} as it is: it was written by hand`);
      console.log(`${r.manifests.written.length + r.sidecars.written.length} written, ${r.manifests.unchanged.length + r.sidecars.unchanged.length} unchanged.`);
    }
    if (r.stale.length) process.exitCode = 1;
    break;
  }
  case "repo": {
    const [sub, dir] = args;
    if (!flags.profile || !["new", "publish"].includes(sub)) {
      console.error("usage: skill-builder repo new <dir> --profile profile.json [--dry] | repo publish --profile profile.json");
      process.exitCode = 2;
      break;
    }
    const input = JSON.parse(readFileSync(flags.profile, "utf8"));
    if (sub === "publish") {
      const steps = publishSteps(input);
      if (json) console.log(JSON.stringify(steps, null, 2));
      else steps.forEach((st, i) => console.log(`${i + 1}. ${st.what}\n   ${st.run}`));
      break;
    }
    const r = scaffold(dir ?? ".", input, { dry: Boolean(flags.dry) });
    let built = null;
    let checked = null;
    if (!flags.dry) {
      built = await packagePlugin(r.root);
      checked = check(r.root);
    }
    if (json) {
      console.log(JSON.stringify({ ...r, manifests: built?.manifests.written ?? [], findings: checked?.findings ?? [] }, null, 2));
      break;
    }
    for (const f of r.written) console.log(`${flags.dry ? "would write" : "wrote"} ${f}`);
    for (const f of r.kept) console.log(`kept ${f} (it already exists)`);
    if (built) for (const f of built.manifests.written) console.log(`built ${f}`);
    if (checked) {
      const errors = checked.findings.filter((f) => f.level === "error").length;
      console.log(`\ncheck: ${errors} errors, ${checked.findings.length - errors} warnings and notes.`);
      if (errors) process.exitCode = 1;
    }
    break;
  }
  case "eval": {
    const skillDir = resolve(args[0] ?? ".");
    const tool = flags.tool ?? (await installedTools()).find((t) => !TOOLS[t].unverified);
    if (!tool) {
      console.error("No AI tool to run the evals in: install Claude Code, Codex or Antigravity.");
      process.exitCode = 2;
      break;
    }
    const evals = loadEvals(skillDir).filter((e) => !flags.only || e.name === flags.only);
    const runs = num("runs", 3);
    const judged = evals.reduce((n, e) => n + e.assertions.filter((a) => a.judge).length, 0);
    const total = evals.length * 2 * runs;
    console.error(`${evals.length} evals x 2 (with and without the skill) x ${runs} runs in ${TOOLS[tool].label} = ${total} runs${judged ? `, plus ${judged * 2 * runs} grading calls` : ""}, each a real request on your own account.`);
    if (flags.dry) break;
    const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const out = resolve(flags.out ?? join(".agents", "skill", "runs", skillDir.split("/").pop(), stamp));
    mkdirSync(out, { recursive: true });
    let done = 0;
    const result = await evaluate(skillDir, {
      tool,
      runs,
      grader: flags.grader,
      only: flags.only,
      timeoutS: num("timeout", 300),
      concurrency: num("concurrency", 2),
      out,
      onRun: () => {
        done++;
        if (process.stderr.isTTY) process.stderr.write(`\r${done}/${total} runs`);
      },
    });
    if (process.stderr.isTTY) process.stderr.write("\n");
    const page = writeReview(out, result);
    if (json) {
      console.log(JSON.stringify({ ...result.benchmark, out, review: page }, null, 2));
      break;
    }
    const b = result.benchmark;
    const line = (c, label) => (b.configs[c] ? `  ${label.padEnd(16)} ${String(Math.round(b.configs[c].passRate.mean * 100)).padStart(3)}% of assertions passed (± ${Math.round(b.configs[c].passRate.sd * 100)}), ${Math.round(b.configs[c].seconds.mean)} s a run${b.configs[c].tokens ? `, ${Math.round(b.configs[c].tokens.mean)} tokens` : ""}` : "");
    console.log(`${b.skill} in ${TOOLS[tool].label}, ${runs} runs of each:`);
    console.log(line("with", "with the skill"));
    console.log(line("without", "without"));
    if (b.delta !== null) console.log(`  difference: ${b.delta >= 0 ? "+" : ""}${Math.round(b.delta * 100)} points`);
    if (b.configs.with?.skillUnused) console.log(`  In ${b.configs.with.skillUnused} runs with the skill, the skill never ran.`);
    if (b.nonDiscriminating.length) console.log(`  Passed as often without the skill, so they prove nothing: ${b.nonDiscriminating.join("; ")}`);
    console.log(`\nReview page: ${page}`);
    break;
  }
  default:
    console.error("usage: skill-builder <check|tokens|trigger|package|repo|eval> <skill-or-plugin> [options]");
    process.exitCode = 2;
}
