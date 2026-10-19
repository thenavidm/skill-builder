/**
 * Does the skill help? The same tasks run with the skill and without it, several
 * times each, in each AI tool, and every output is graded against written
 * assertions.
 *
 * Code grades whatever code can (a file exists, contains or matches something,
 * is valid JSON, the answer says something), so those grades are the same every
 * time. A model grades only what needs judgment, and its grade counts only if it
 * quotes the output and the quote is really there. A run with the skill where the
 * skill never fired is reported, because it measures the model, not the skill.
 *
 * The eval file is skills/<name>/evals/evals.json:
 *   { "evals": [ { "name", "prompt", "files": [paths under evals/], "allow": [tools],
 *                  "assertions": [ { "name", "file"?, "answer"?, "contains"?, "notContains"?,
 *                                    "matches"?, "flags"?, "json"?, "maxWords"?, "judge"? } ] } ] }
 */
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, relative, resolve } from "node:path";
import { runPrompt, skillDirFor } from "./tools.mjs";

const TEXT_MAX = 200_000;

/** Reads and checks an eval file, so a typo fails before any run is paid for. */
export function loadEvals(skillDir) {
  const file = join(skillDir, "evals", "evals.json");
  if (!existsSync(file)) throw new Error(`No evals yet: ${relative(process.cwd(), file)} is missing. skill-create writes one with the skill.`);
  const raw = JSON.parse(readFileSync(file, "utf8"));
  const problems = [];
  const evals = raw.evals ?? [];
  if (!evals.length) problems.push("no evals in the file");
  const names = new Set();
  evals.forEach((e, i) => {
    const at = `eval ${i + 1}${e.name ? ` (${e.name})` : ""}`;
    if (!e.name || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(e.name)) problems.push(`${at}: a name in lowercase words joined by hyphens`);
    if (names.has(e.name)) problems.push(`${at}: the name is used twice`);
    names.add(e.name);
    if (!e.prompt) problems.push(`${at}: no prompt`);
    for (const f of e.files ?? []) if (!existsSync(join(skillDir, "evals", f))) problems.push(`${at}: input file ${f} is missing`);
    if (!e.assertions?.length) problems.push(`${at}: no assertions, so nothing would be graded`);
    (e.assertions ?? []).forEach((a, j) => {
      const where = `${at}, assertion ${j + 1}`;
      if (!a.name) problems.push(`${where}: no name`);
      const checks = ["contains", "notContains", "matches", "json", "maxWords"].filter((k) => a[k] !== undefined);
      if (!a.judge && !a.file && !a.answer) problems.push(`${where}: say what it looks at: "file", "answer": true, or "judge"`);
      if (a.judge && checks.length) problems.push(`${where}: a judged assertion is graded by a model; put code checks in their own assertion`);
      if (a.matches) {
        try {
          new RegExp(a.matches, a.flags);
        } catch (e2) {
          problems.push(`${where}: ${e2.message}`);
        }
      }
    });
  });
  if (problems.length) throw new Error(`${file}:\n  ${problems.join("\n  ")}`);
  return evals;
}

/** The text an assertion looks at, from a run's folder and answer. */
function target(a, run) {
  if (a.answer) return { text: run.answer ?? "", what: "the answer" };
  const file = join(run.dir, a.file);
  if (!existsSync(file)) return { missing: true, what: a.file };
  return { text: readFileSync(file, "utf8").slice(0, TEXT_MAX), what: a.file };
}

/** Grades one code assertion. @returns {{ passed: boolean, evidence: string }} */
export function gradeCode(a, run) {
  const t = target(a, run);
  if (t.missing) return { passed: false, evidence: `${t.what} was not written` };
  const checks = [];
  if (a.contains !== undefined) {
    const ok = t.text.toLowerCase().includes(String(a.contains).toLowerCase());
    checks.push([ok, ok ? `${t.what} contains "${a.contains}"` : `${t.what} does not contain "${a.contains}"`]);
  }
  if (a.notContains !== undefined) {
    const ok = !t.text.toLowerCase().includes(String(a.notContains).toLowerCase());
    checks.push([ok, ok ? `${t.what} leaves out "${a.notContains}"` : `${t.what} contains "${a.notContains}"`]);
  }
  if (a.matches !== undefined) {
    const m = new RegExp(a.matches, a.flags).exec(t.text);
    checks.push([Boolean(m), m ? `${t.what} matches: "${m[0].slice(0, 80)}"` : `${t.what} has nothing matching /${a.matches}/`]);
  }
  if (a.json) {
    let ok = true;
    try {
      JSON.parse(t.text);
    } catch {
      ok = false;
    }
    checks.push([ok, ok ? `${t.what} is valid JSON` : `${t.what} is not valid JSON`]);
  }
  if (a.maxWords !== undefined) {
    const n = t.text.split(/\s+/).filter(Boolean).length;
    checks.push([n <= a.maxWords, `${t.what} has ${n} words (limit ${a.maxWords})`]);
  }
  if (!checks.length) checks.push([true, `${t.what} exists`]);
  const failed = checks.filter(([ok]) => !ok);
  return { passed: failed.length === 0, evidence: (failed.length ? failed : checks).map(([, e]) => e).join("; ") };
}

const squash = (s) => s.replace(/\s+/g, " ").trim().toLowerCase();

/**
 * Accepts a model's grade only when its quote is really in the output, so a
 * grader can't pass a run on evidence it imagined.
 */
export function verifyJudgement(j, outputText) {
  if (typeof j?.passed !== "boolean") return { passed: false, evidence: "the grader gave no clear pass or fail" };
  const quote = typeof j.quote === "string" ? j.quote.trim() : "";
  if (j.passed && (!quote || !squash(outputText).includes(squash(quote)))) {
    return { passed: false, evidence: `the grader said it passed, but its quote isn't in the output${quote ? `: "${quote.slice(0, 80)}"` : ""}` };
  }
  return { passed: j.passed, evidence: `${j.why ?? ""}${quote ? ` Quote: "${quote.slice(0, 160)}"` : ""}`.trim() };
}

/** Pulls the first JSON object out of a model's reply. */
export function parseJudgement(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end < start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

/** Everything a run produced, as one text a grader can read: the answer and each new text file. */
export function outputText(run) {
  const parts = [`ANSWER:\n${run.answer ?? ""}`];
  for (const f of run.files ?? []) {
    const p = join(run.dir, f);
    if (statSync(p).size < 60_000) parts.push(`FILE ${f}:\n${readFileSync(p, "utf8")}`);
  }
  return parts.join("\n\n").slice(0, TEXT_MAX);
}

async function gradeJudge(a, run, grader, timeoutS) {
  const text = outputText(run);
  const prompt = [
    "You are grading one output against one statement. Do not use any skill or tool.",
    'Reply with JSON only: {"passed": true or false, "quote": "a short exact quote from the output that shows it", "why": "one sentence"}.',
    `Statement: ${a.judge}`,
    "Output:",
    "<<<",
    text,
    ">>>",
  ].join("\n");
  // graded from an empty folder, so the grader can't pick up the skill being tested
  const empty = mkdtempSync(join(tmpdir(), "skill-grade-"));
  try {
    const r = await runPrompt(grader, prompt, { cwd: empty, timeoutS, full: true });
    return verifyJudgement(parseJudgement(r.answer), text);
  } finally {
    rmSync(empty, { recursive: true, force: true });
  }
}

/** Files a run wrote, relative to its folder, leaving out the skill folders and inputs that weren't changed. */
function writtenFiles(dir, before) {
  const out = [];
  const walk = (d) => {
    for (const e of readdirSync(d)) {
      const p = join(d, e);
      const rel = relative(dir, p);
      if (rel.startsWith(".claude") || rel.startsWith(".agents") || rel.startsWith(".git") || e === "node_modules") continue;
      if (statSync(p).isDirectory()) walk(p);
      else if (before.get(rel) !== readFileSync(p, "utf8")) out.push(rel);
    }
  };
  walk(dir);
  return out.sort();
}

const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const sd = (xs) => {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1));
};

/** Pass rates, time and tokens per configuration, and assertions that don't tell the configurations apart. */
export function aggregate(graded) {
  const configs = [...new Set(graded.map((g) => g.config))];
  const by = Object.fromEntries(
    configs.map((c) => {
      const runs = graded.filter((g) => g.config === c);
      const rates = runs.map((r) => (r.grades.length ? r.grades.filter((g) => g.passed).length / r.grades.length : 0));
      const secs = runs.map((r) => r.seconds);
      const toks = runs.filter((r) => r.tokens).map((r) => r.tokens.input + r.tokens.output);
      return [c, { runs: runs.length, passRate: { mean: mean(rates), sd: sd(rates) }, seconds: { mean: mean(secs), sd: sd(secs) }, tokens: toks.length ? { mean: mean(toks), sd: sd(toks) } : null, skillUnused: runs.filter((r) => r.config === "with" && !r.skillFired).length }];
    }),
  );
  // an assertion that passes as often without the skill as with it measures the model, not the skill
  const names = [...new Set(graded.flatMap((g) => g.grades.map((x) => `${g.eval} :: ${x.name}`)))];
  const rate = (config, key) => {
    const gs = graded.filter((g) => g.config === config).flatMap((g) => g.grades.filter((x) => `${g.eval} :: ${x.name}` === key));
    return gs.length ? gs.filter((x) => x.passed).length / gs.length : null;
  };
  const assertions = names.map((key) => ({ key, with: rate("with", key), without: rate("without", key) }));
  return {
    configs: by,
    delta: by.with && by.without ? by.with.passRate.mean - by.without.passRate.mean : null,
    nonDiscriminating: assertions.filter((a) => a.with !== null && a.without !== null && a.with === a.without).map((a) => a.key),
    assertions,
  };
}

/**
 * Runs every eval with and without the skill, `runs` times each, in one tool,
 * and grades every run.
 */
export async function evaluate(skillDir, { tool, runs = 3, configs = ["with", "without"], grader, timeoutS = 300, concurrency = 2, out, only, onRun } = {}) {
  const dir = resolve(skillDir);
  const name = basename(dir);
  const evals = loadEvals(dir).filter((e) => !only || e.name === only);
  const jobs = [];
  for (const e of evals) for (const config of configs) for (let n = 1; n <= runs; n++) jobs.push({ e, config, n });
  const graded = [];
  let next = 0;
  const worker = async () => {
    while (next < jobs.length) {
      const { e, config, n } = jobs[next++];
      const ws = mkdtempSync(join(tmpdir(), `skill-eval-${name}-`));
      const before = new Map();
      for (const f of e.files ?? []) {
        cpSync(join(dir, "evals", f), join(ws, basename(f)), { recursive: true });
        before.set(basename(f), readFileSync(join(ws, basename(f)), "utf8"));
      }
      if (config === "with") {
        const sub = join(ws, skillDirFor(tool), name);
        mkdirSync(sub, { recursive: true });
        cpSync(dir, sub, { recursive: true, filter: (src) => !src.includes(`${dir}/evals`) });
      }
      const r = await runPrompt(tool, e.prompt, { cwd: ws, timeoutS, full: true, write: true, allow: e.allow ?? [] });
      const run = { eval: e.name, config, n, dir: ws, answer: r.answer, status: r.status, seconds: r.seconds, tokens: r.tokens, skillFired: r.fired.includes(name), files: writtenFiles(ws, before) };
      run.grades = [];
      for (const a of e.assertions) {
        const g = a.judge ? await gradeJudge(a, run, grader ?? tool, 180) : gradeCode(a, run);
        run.grades.push({ name: a.name, kind: a.judge ? "judge" : "code", ...g });
      }
      if (out) {
        const keep = join(out, "runs", `${e.name}-${config}-${n}`);
        mkdirSync(keep, { recursive: true });
        for (const f of run.files) {
          mkdirSync(join(keep, "outputs", f, ".."), { recursive: true });
          cpSync(join(ws, f), join(keep, "outputs", f));
        }
        writeFileSync(join(keep, "answer.md"), `${run.answer}\n`);
        writeFileSync(join(keep, "grades.json"), `${JSON.stringify({ ...run, dir: undefined }, null, 2)}\n`);
      }
      rmSync(ws, { recursive: true, force: true });
      delete run.dir;
      graded.push(run);
      onRun?.(run);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, jobs.length) }, worker));
  graded.sort((a, b) => a.eval.localeCompare(b.eval) || a.config.localeCompare(b.config) || a.n - b.n);
  const benchmark = { skill: name, tool, runsEach: runs, date: new Date().toISOString(), ...aggregate(graded) };
  if (out) writeFileSync(join(out, "benchmark.json"), `${JSON.stringify({ ...benchmark, runs: graded }, null, 2)}\n`);
  return { benchmark, runs: graded, evals };
}
