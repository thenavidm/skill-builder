/**
 * The .skill upload file: the standard's fields only, no tests inside, a zip
 * any unzip tool reads.
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { inflateRawSync } from "node:zlib";
import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { portableSkillMd, skillFile } from "../lib/skillfile.mjs";

const root = mkdtempSync(join(tmpdir(), "skill-file-"));
after(() => rmSync(root, { recursive: true, force: true }));

describe("the .skill file", () => {
  it("keeps only the standard's frontmatter fields and says which it dropped", () => {
    const r = portableSkillMd("---\nname: a\ndescription: Does a.\ndisable-model-invocation: true\nhooks:\n  Stop: x\nmetadata:\n  v: \"1\"\n---\n\nBody.\n");
    assert.deepEqual(r.removed, ["disable-model-invocation", "hooks"]);
    assert.equal(r.text, "---\nname: a\ndescription: Does a.\nmetadata:\n  v: \"1\"\n---\n\nBody.\n");
  });
  it("zips the skill under its folder name, leaving out evals and caches", () => {
    const dir = join(root, "release-notes");
    mkdirSync(join(dir, "references"), { recursive: true });
    mkdirSync(join(dir, "evals"), { recursive: true });
    mkdirSync(join(dir, "__pycache__"), { recursive: true });
    writeFileSync(join(dir, "SKILL.md"), "---\nname: release-notes\ndescription: Writes notes.\ndisable-model-invocation: true\n---\n\nWrite them.\n");
    writeFileSync(join(dir, "references", "style.md"), "Short lines.\n");
    writeFileSync(join(dir, "evals", "evals.json"), "{}");
    writeFileSync(join(dir, "__pycache__", "x.pyc"), "x");
    const r = skillFile(dir, join(root, "out"));
    assert.deepEqual(r.entries, ["release-notes/SKILL.md", "release-notes/references/style.md"]);
    assert.deepEqual(r.removed, ["disable-model-invocation"]);
    // read it back: the first entry inflates to the trimmed SKILL.md
    const buf = readFileSync(r.file);
    assert.equal(buf.readUInt32LE(0), 0x04034b50);
    const nameLen = buf.readUInt16LE(26);
    const size = buf.readUInt32LE(18);
    const text = inflateRawSync(buf.subarray(30 + nameLen, 30 + nameLen + size)).toString("utf8");
    assert.ok(!text.includes("disable-model-invocation"));
    assert.ok(text.includes("name: release-notes"));
  });
});
