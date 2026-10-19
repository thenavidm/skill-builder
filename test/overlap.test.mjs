import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { overlap } from "../lib/overlap.mjs";

const root = mkdtempSync(join(tmpdir(), "skill-overlap-"));
after(() => rmSync(root, { recursive: true, force: true }));

describe("overlap", () => {
  it("finds a copied run of eight or more words, whatever the case and punctuation, and nothing shorter", () => {
    mkdirSync(join(root, "ours"));
    mkdirSync(join(root, "theirs"));
    writeFileSync(join(root, "theirs", "SKILL.md"), "Keep the main skill file short and move detail into references the agent reads only when needed.");
    writeFileSync(join(root, "ours", "SKILL.md"), "Our rule: keep the main skill FILE short, and move detail into references. Also, the agent reads it.");
    const runs = overlap(join(root, "ours"), join(root, "theirs"));
    assert.equal(runs.length, 1);
    assert.equal(runs[0].words, 11);
    assert.equal(runs[0].text, "keep the main skill file short and move detail into references");
    assert.deepEqual(overlap(join(root, "ours"), join(root, "theirs"), { min: 12 }), []);
  });
});
