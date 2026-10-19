/**
 * install: finding the plugin's entry skill.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { entryOf } from "../lib/install.mjs";

const root = mkdtempSync(join(tmpdir(), "skill-install-test-"));
after(() => rmSync(root, { recursive: true, force: true }));

describe("the entry skill", () => {
  it("is the one named after the prefix, else the first", () => {
    for (const n of ["release", "release-notes"]) {
      mkdirSync(join(root, "skills", n), { recursive: true });
      writeFileSync(join(root, "skills", n, "SKILL.md"), `---\nname: ${n}\ndescription: x\n---\n`);
    }
    writeFileSync(join(root, "product.json"), JSON.stringify({ name: "release-kit", prefix: "release" }));
    assert.deepEqual(entryOf(root), { name: "release-kit", entry: "release", skills: ["release", "release-notes"] });
    writeFileSync(join(root, "product.json"), JSON.stringify({ name: "release-kit", prefix: "other" }));
    assert.equal(entryOf(root).entry, "release");
  });
});
