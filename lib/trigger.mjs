/**
 * Does a description fire on the prompts it should, and stay quiet on the ones
 * it shouldn't? And in a plugin, does each prompt reach the right sibling?
 *
 * Every prompt runs in the real tool, in a throwaway project that holds the
 * real skill folders (not a stand-in written from the description), with
 * everything else the user has installed still there. So a result says what
 * this person will actually see, including when another installed skill takes
 * the prompt first, and it names that skill.
 *
 * A prompt passes when it gets the right outcome in most of its runs: models
 * don't pick the same way every time, so one run proves little.
 */
import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { TOOLS, runPrompt, skillDirFor } from "./tools.mjs";

/** The skill folders at a path: one skill, or every skill of a plugin. */
export function skillFolders(path) {
  const root = resolve(path);
  if (existsSync(join(root, "SKILL.md"))) return [root];
  const dir = join(root, "skills");
  return readdirSync(dir).map((n) => join(dir, n)).filter((d) => existsSync(join(d, "SKILL.md"))).sort();
}

/**
 * Reads a prompt set. Each entry is { prompt, expect } where expect is the skill
 * that should fire or null for none; for a single skill, { prompt, should } is
 * also accepted.
 */
export function loadSet(file, skillNames) {
  const raw = JSON.parse(readFileSync(file, "utf8"));
  const list = Array.isArray(raw) ? raw : raw.prompts;
  if (!Array.isArray(list) || list.length === 0) throw new Error(`${file}: expected a list of { prompt, expect } entries`);
  return list.map((e, i) => {
    if (typeof e.prompt !== "string" || !e.prompt.trim()) throw new Error(`${file}: entry ${i + 1} has no prompt`);
    let expect = e.expect;
    if (expect === undefined && typeof e.should === "boolean") {
      if (skillNames.length !== 1) throw new Error(`${file}: entry ${i + 1} uses "should", which needs a single skill; name the skill in "expect"`);
      expect = e.should ? skillNames[0] : null;
    }
    if (expect !== null && !skillNames.includes(expect)) throw new Error(`${file}: entry ${i + 1} expects "${expect}", which isn't one of ${skillNames.join(", ")}`);
    return { prompt: e.prompt, expect };
  });
}

/**
 * Splits a set into prompts to improve against and prompts held back to test
 * on, the same way every time (by a hash of the prompt), keeping the share of
 * should-fire and should-not prompts in both.
 */
export function split(set, holdout = 0.4) {
  const key = (p) => createHash("sha256").update(p.prompt).digest("hex");
  const train = [];
  const test = [];
  for (const group of [set.filter((p) => p.expect !== null), set.filter((p) => p.expect === null)]) {
    const sorted = [...group].sort((a, b) => key(a).localeCompare(key(b)));
    const n = Math.round(sorted.length * holdout);
    test.push(...sorted.slice(0, n));
    train.push(...sorted.slice(n));
  }
  return { train, test };
}

/** One run's outcome: which of our skills fired first, and anything else that did. */
export function outcome(fired, ours) {
  const first = fired.find((s) => ours.includes(s)) ?? null;
  const others = fired.filter((s) => !ours.includes(s));
  return { first, others };
}

/** Scores the runs of one prompt. */
export function scorePrompt(entry, runs, ours) {
  const outcomes = runs.map((r) => ({ ...outcome(r.fired, ours), status: r.status }));
  const hits = outcomes.filter((o) => o.first === entry.expect).length;
  const counted = outcomes.filter((o) => o.status !== "error" && o.status !== "blocked").length;
  const tally = (key) => {
    const t = {};
    for (const o of outcomes) for (const s of [].concat(o[key] ?? [])) if (s) t[s] = (t[s] ?? 0) + 1;
    return t;
  };
  return {
    prompt: entry.prompt,
    expect: entry.expect,
    runs: runs.length,
    errors: runs.length - counted,
    hits,
    rate: counted ? hits / counted : 0,
    // every run errored or was blocked: there is no result to pass or fail
    pass: counted > 0 ? hits / counted > 0.5 : null,
    ours: tally("first"),
    others: tally("others"),
  };
}

/** A tool's results across all prompts. */
export function summarise(scored) {
  const should = scored.filter((s) => s.expect !== null);
  const not = scored.filter((s) => s.expect === null);
  const pass = (l) => l.filter((s) => s.pass === true).length;
  const counted = (l) => l.filter((s) => s.pass !== null).length;
  const stolen = {};
  for (const s of should) for (const [k, v] of Object.entries(s.others)) stolen[k] = (stolen[k] ?? 0) + v;
  return {
    shouldFire: { passed: pass(should), of: counted(should) },
    shouldNot: { passed: pass(not), of: counted(not) },
    accuracy: counted(scored) ? pass(scored) / counted(scored) : 0,
    noResult: scored.filter((s) => s.pass === null).map((s) => s.prompt),
    misrouted: should.filter((s) => s.pass === false && Object.keys(s.ours).some((k) => k !== s.expect)).map((s) => ({ prompt: s.prompt, expect: s.expect, went: s.ours })),
    otherSkills: stolen,
  };
}

/** Runs async jobs with at most `n` at once, keeping their order. */
async function pool(jobs, n) {
  const results = new Array(jobs.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, jobs.length) }, async () => {
      while (next < jobs.length) {
        const i = next++;
        results[i] = await jobs[i]();
      }
    }),
  );
  return results;
}

/** A throwaway project holding the skills where each tool looks for them. */
export function workspace(folders, tools) {
  const dir = mkdtempSync(join(tmpdir(), "skill-trigger-"));
  for (const sub of new Set(tools.map(skillDirFor))) {
    mkdirSync(join(dir, sub), { recursive: true });
    for (const f of folders) cpSync(f, join(dir, sub, basename(f)), { recursive: true });
  }
  return dir;
}

/**
 * Runs every prompt in every tool, `runs` times each.
 * @returns {Promise<{ skills: string[], tools: Record<string, { label, unverified, summary, prompts }> }>}
 */
export async function trigger(path, set, { tools, runs = 3, concurrency = 3, timeoutS = 120, onRun, keep = false, extra = {} } = {}) {
  const folders = skillFolders(path);
  const ours = folders.map((f) => basename(f));
  const dir = workspace(folders, tools);
  try {
    const jobs = [];
    for (const tool of tools) for (const entry of set) for (let r = 0; r < runs; r++) jobs.push({ tool, entry });
    const results = await pool(
      jobs.map((j) => async () => {
        const res = await runPrompt(j.tool, j.entry.prompt, { cwd: dir, timeoutS, extra: extra[j.tool] ?? [] });
        onRun?.(res);
        return { ...j, res };
      }),
      concurrency,
    );
    const out = {};
    for (const tool of tools) {
      const prompts = set.map((entry) => scorePrompt(entry, results.filter((r) => r.tool === tool && r.entry === entry).map((r) => r.res), ours));
      out[tool] = { label: TOOLS[tool].label, unverified: Boolean(TOOLS[tool].unverified), summary: summarise(prompts), prompts };
    }
    return { skills: ours, tools: out, ...(keep ? { workspace: dir } : {}) };
  } finally {
    if (!keep) rmSync(dir, { recursive: true, force: true });
  }
}
