/**
 * eval: code grading, the check on a model's quote, aggregation, and eval files.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { aggregate, gradeCode, loadEvals, parseJudgement, verifyJudgement } from "../lib/eval.mjs";

const root = mkdtempSync(join(tmpdir(), "skill-eval-test-"));
after(() => rmSync(root, { recursive: true, force: true }));
const run = { dir: root, answer: "Moved to 3 November 2026." };
writeFileSync(join(root, "notes.md"), "## New\n- Dark mode\n## Fixed\n- Crash on start\n");
writeFileSync(join(root, "data.json"), '{"ok": true}');

describe("code grading", () => {
  it("checks a file exists, contains, leaves out and matches", () => {
    assert.equal(gradeCode({ file: "notes.md" }, run).passed, true);
    assert.equal(gradeCode({ file: "missing.md" }, run).passed, false);
    assert.equal(gradeCode({ file: "notes.md", contains: "dark mode" }, run).passed, true);
    assert.equal(gradeCode({ file: "notes.md", notContains: "crash" }, run).passed, false);
    const m = gradeCode({ file: "notes.md", matches: "^## (New|Fixed)", flags: "m" }, run);
    assert.equal(m.passed, true);
    assert.match(m.evidence, /## New/);
  });
  it("checks the answer, JSON and length", () => {
    assert.equal(gradeCode({ answer: true, matches: "\\b3 November 2026\\b" }, run).passed, true);
    assert.equal(gradeCode({ file: "data.json", json: true }, run).passed, true);
    assert.equal(gradeCode({ file: "notes.md", json: true }, run).passed, false);
    assert.equal(gradeCode({ answer: true, maxWords: 3 }, run).passed, false);
  });
});

describe("a model's grade", () => {
  it("counts only when its quote is really in the output", () => {
    const out = "The notes group changes into New and Fixed.";
    assert.equal(verifyJudgement({ passed: true, quote: "group changes into New", why: "grouped" }, out).passed, true);
    const made = verifyJudgement({ passed: true, quote: "sorted by impact", why: "sorted" }, out);
    assert.equal(made.passed, false);
    assert.match(made.evidence, /isn't in the output/);
    assert.equal(verifyJudgement({ passed: false, why: "not grouped" }, out).passed, false);
    assert.equal(verifyJudgement(null, out).passed, false);
  });
  it("is read from a reply with words around the JSON", () => {
    assert.deepEqual(parseJudgement('Sure.\n{"passed": true, "quote": "x"}\nDone.'), { passed: true, quote: "x" });
    assert.equal(parseJudgement("no json here"), null);
  });
});

describe("aggregation", () => {
  const g = (config, n, a, b) => ({ eval: "e", config, n, seconds: 10 * n, tokens: { input: 100, output: 10 * n }, skillFired: config === "with", grades: [{ name: "date format", passed: a }, { name: "file written", passed: b }] });
  const graded = [g("with", 1, true, true), g("with", 2, true, true), g("without", 1, false, true), g("without", 2, false, true)];
  it("gives each configuration's pass rate with its spread, and the difference", () => {
    const r = aggregate(graded);
    assert.equal(r.configs.with.passRate.mean, 1);
    assert.equal(r.configs.without.passRate.mean, 0.5);
    assert.equal(r.delta, 0.5);
    assert.equal(r.configs.with.seconds.mean, 15);
  });
  it("names an assertion that passes as often without the skill", () => {
    assert.deepEqual(aggregate(graded).nonDiscriminating, ["e :: file written"]);
  });
});

describe("eval files", () => {
  it("are refused with every problem listed before anything is paid for", () => {
    const dir = join(root, "skill-a");
    mkdirSync(join(dir, "evals"), { recursive: true });
    writeFileSync(join(dir, "evals", "evals.json"), JSON.stringify({ evals: [{ name: "Bad Name", prompt: "", assertions: [{ name: "x", judge: "good", contains: "y" }, { name: "z" }] }] }));
    assert.throws(() => loadEvals(dir), (e) => /lowercase words/.test(e.message) && /no prompt/.test(e.message) && /code checks in their own/.test(e.message) && /say what it looks at/.test(e.message));
  });
});
