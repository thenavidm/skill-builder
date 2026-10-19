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
 *   skill-builder package <skill> --skill-file [--out dir]   a .skill file to upload to claude.ai
 *   skill-builder repo new <dir> --profile p.json [--dry]   a new plugin repo with every house file,
 *                                                     its manifests built, then checked
 *   skill-builder repo publish --profile p.json       the GitHub steps, in order, for a yes on each
 *   skill-builder eval <skill> [--tool claude] [--runs 3] [--grader claude] [--only <eval>] [--out dir]
 *                 the skill's evals with and without it, graded, with a review page
 *   skill-builder install <plugin> [--tools ...]      each tool's own validator, then the plugin loaded
 *                                                     for one run and its entry skill asked for
 *   skill-builder bench <skill> [--tools ...] [--runs 3]   the evals in every installed tool, side by side
 *   skill-builder overlap <ours> <theirs> [--min 8]   runs of words shared with another skill
 *   skill-builder changelog [plugin]                  the commits since the last release, for the notes
 *   skill-builder release [plugin] [--bump patch|minor|major|x.y.z] [--dry]
 *                 the version bumped, the notes moved under it, the manifests rebuilt, then the steps
 */
import { check } from "../lib/check.mjs";
import { facts } from "../lib/facts.mjs";
import { measure } from "../lib/tokens.mjs";
import { TOOLS, installedTools } from "../lib/tools.mjs";
import { loadSet, skillFolders, split, trigger } from "../lib/trigger.mjs";
import { packagePlugin } from "../lib/package.mjs";
import { skillFile } from "../lib/skillfile.mjs";
import { publishSteps, scaffold } from "../lib/repo.mjs";
import { readFileSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { evaluate, loadEvals } from "../lib/eval.mjs";
import { writeReview } from "../lib/review.mjs";
import { installTest } from "../lib/install.mjs";
import { bench } from "../lib/bench.mjs";
import { overlap } from "../lib/overlap.mjs";
import { changesSinceTag, release, unreleased } from "../lib/release.mjs";
import { BuildError } from "../scripts/manifests/build.mjs";
import { basename } from "node:path";

const [cmd, ...rest] = process.argv.slice(2);
// Switches never take a value, so `--check` can't swallow the path after it, and a
// flag with nothing after it counts as a switch: a check must never become a write.
const SWITCHES = new Set(["json", "dry", "split", "keep", "check", "skill-file"]);
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
    if (flags["skill-file"]) {
      const r = skillFile(args[0] ?? ".", flags.out ?? ".");
      if (json) console.log(JSON.stringify(r, null, 2));
      else {
        console.log(`wrote ${r.file} (${r.entries.length} files)`);
        if (r.removed.length) console.log(`left out of its SKILL.md, because uploads take the Agent Skills fields only: ${r.removed.join(", ")}`);
      }
      break;
    }
    let r;
    try {
      r = await packagePlugin(args[0] ?? ".", { check: Boolean(flags.check) });
    } catch (e) {
      if (!(e instanceof BuildError) && e?.name !== "BuildError") throw e;
      // a repository without product.json writes its manifests by hand, so they drift: say that, not "stale"
      if (e.problems.some((p) => /product\.json: missing/.test(p))) {
        console.error("This repository has no product.json, so each tool's manifest is written by hand and they drift apart. Add product.json (skill-builder repo new writes one) and every manifest is built from it.");
        process.exitCode = 2;
        break;
      }
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
    const line = (c, label) => {
      const x = b.configs[c];
      if (!x) return "";
      const rate = x.passRate ? `${String(Math.round(x.passRate.mean * 100)).padStart(3)}% of assertions passed (± ${Math.round(x.passRate.sd * 100)})` : "no run finished";
      const left = [x.blocked ? `${x.blocked} blocked by a permission headless mode can't ask for` : "", x.failed ? `${x.failed} failed or timed out` : ""].filter(Boolean).join(", ");
      return `  ${label.padEnd(16)} ${rate}, ${Math.round(x.seconds.mean)} s a run${x.tokens ? `, ${Math.round(x.tokens.mean)} tokens` : ""}${left ? ` (left out: ${left})` : ""}`;
    };
    console.log(`${b.skill} in ${TOOLS[tool].label}, ${runs} runs of each:`);
    console.log(line("with", "with the skill"));
    console.log(line("without", "without"));
    if (b.delta !== null) console.log(`  difference: ${b.delta >= 0 ? "+" : ""}${Math.round(b.delta * 100)} points`);
    if (b.configs.with?.skillUnused) console.log(`  In ${b.configs.with.skillUnused} runs with the skill, the skill never ran.`);
    if (b.nonDiscriminating.length) console.log(`  Passed as often without the skill, so they prove nothing: ${b.nonDiscriminating.join("; ")}`);
    console.log(`\nReview page: ${page}`);
    break;
  }
  case "install": {
    const installed = await installedTools();
    const tools = flags.tools ? String(flags.tools).split(",") : installed;
    const r = await installTest(args[0] ?? ".", { tools: tools.filter((t) => installed.includes(t)), live: !flags.dry });
    if (json) {
      console.log(JSON.stringify(r, null, 2));
      break;
    }
    console.log(`${r.name}: entry skill ${r.entry}, ${r.skills.length} skills`);
    let failed = false;
    for (const t of Object.values(r.results)) {
      const v = t.validate;
      const vText = v.ok === null ? v.note : v.ok ? `its validator passes${v.warnings?.length ? ` (${v.warnings.length} warnings)` : ""}` : `its validator fails: ${v.problems.join("; ")}`;
      const l = t.load;
      const lText = !l ? "not loaded" : l.ran ? `loaded (${l.scope}) and ${r.entry} ran` : `loaded (${l.scope}) but ${r.entry} didn't run (${l.fired.length ? `got ${l.fired.join(", ")}` : l.status})`;
      console.log(`  ${t.label.padEnd(12)} ${vText}; ${lText}`);
      for (const w of v.warnings ?? []) {
        // the root AGENTS.md and CLAUDE.md guide agents working on the repo; tools rightly don't load them as plugin content
        const expected = /^(AGENTS|CLAUDE)\.md:/.test(w);
        console.log(`               ${expected ? "expected" : "warning"}: ${w}${expected ? " (it's the guide for working on the repo, not part of the plugin)" : ""}`);
      }
      if (v.ok === false || (l && !l.ran)) failed = true;
    }
    for (const t of tools.filter((x) => !installed.includes(x))) console.log(`  ${TOOLS[t]?.label ?? t}: not installed here`);
    if (failed) process.exitCode = 1;
    break;
  }
  case "bench": {
    const skillDir = resolve(args[0] ?? ".");
    const installed = await installedTools();
    const tools = flags.tools ? String(flags.tools).split(",").filter((t) => installed.includes(t)) : installed.filter((t) => !TOOLS[t].unverified);
    const evals = loadEvals(skillDir);
    const runs = num("runs", 3);
    console.error(`${evals.length} evals x 2 x ${runs} runs in each of ${tools.map((t) => TOOLS[t].label).join(", ")} = ${evals.length * 2 * runs * tools.length} runs, each a real request on your own account.`);
    if (flags.dry) break;
    const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const out = resolve(flags.out ?? join(".agents", "skill", "bench", skillDir.split("/").pop(), stamp));
    const r = await bench(skillDir, { tools, runs, out, timeoutS: num("timeout", 300) });
    if (json) {
      console.log(JSON.stringify({ out, disagree: r.disagree, tools: Object.fromEntries(Object.entries(r.perTool).map(([t, v]) => [t, { ...v.benchmark, review: v.review }])) }, null, 2));
      break;
    }
    console.log(`${"tool".padEnd(12)} ${"with".padStart(6)} ${"without".padStart(8)} ${"change".padStart(7)}  time with  skill never ran`);
    for (const [t, v] of Object.entries(r.perTool)) {
      const b = v.benchmark;
      const p = (c) => (b.configs[c]?.passRate ? `${Math.round(b.configs[c].passRate.mean * 100)}%` : "n/a");
      console.log(`${TOOLS[t].label.padEnd(12)} ${p("with").padStart(6)} ${p("without").padStart(8)} ${(b.delta === null ? "n/a" : `${b.delta >= 0 ? "+" : ""}${Math.round(b.delta * 100)}`).padStart(7)}  ${String(Math.round(b.configs.with?.seconds.mean ?? 0)).padStart(6)} s  ${b.configs.with?.skillUnused ?? 0} of ${b.configs.with?.runs ?? 0}`);
    }
    for (const [t, v] of Object.entries(r.perTool)) {
      const bl = (v.benchmark.configs.with?.blocked ?? 0) + (v.benchmark.configs.without?.blocked ?? 0);
      if (bl) console.log(`${TOOLS[t].label}: ${bl} runs stopped on a permission headless mode can't ask for, and are left out.`);
    }
    if (r.disagree.length) console.log(`\nThe tools disagree on: ${r.disagree.join(", ")}`);
    console.log(`\nReview pages: ${out}/<tool>/review.html`);
    break;
  }
  case "overlap": {
    if (args.length < 2) {
      console.error("usage: skill-builder overlap <ours> <theirs> [--min 8]");
      process.exitCode = 2;
      break;
    }
    const runs = overlap(args[0], args[1], { min: num("min", 8) });
    if (json) console.log(JSON.stringify(runs, null, 2));
    else if (!runs.length) console.log(`No run of ${num("min", 8)} or more words is shared.`);
    else for (const r of runs) console.log(`${r.words} words, ${r.file} and their ${r.theirs}: "${r.text}"`);
    if (runs.length) process.exitCode = 1;
    break;
  }
  case "changelog": {
    const root = resolve(args[0] ?? ".");
    const c = changesSinceTag(root);
    const notes = unreleased(readFileSync(join(root, "CHANGELOG.md"), "utf8"));
    if (json) {
      console.log(JSON.stringify({ ...c, unreleased: notes }, null, 2));
      break;
    }
    console.log(`${c.commits.length} commits since ${c.since ?? "the start"}:`);
    for (const line of c.commits) console.log(`  ${line}`);
    console.log(`\nUnreleased in CHANGELOG.md now:\n${notes || "  (empty)"}`);
    break;
  }
  case "release": {
    const r = await release(args[0] ?? ".", { bump: flags.bump ?? "patch", dry: Boolean(flags.dry) });
    if (json) {
      console.log(JSON.stringify(r, null, 2));
      break;
    }
    console.log(`${r.dry ? "Would release" : "Released"} ${r.from} -> ${r.version}, ${r.date}${r.dry ? " (nothing changed)" : ": package.json, CHANGELOG.md and every manifest updated"}.`);
    console.log(`\nNotes:\n${r.notes}\n\nThe steps that reach live systems, each for a yes:`);
    r.steps.forEach((st, i) => console.log(`${i + 1}. ${st.what}\n   ${st.run}`));
    break;
  }
  default:
    console.error("usage: skill-builder <check|tokens|trigger|package|repo|eval|install|bench|overlap|changelog|release> <path> [options]");
    process.exitCode = 2;
}
