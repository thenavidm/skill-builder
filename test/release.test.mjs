/**
 * release: version, changelog and manifests moved together, on a real repository
 * written by repo new.
 */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { dateFor, moveNotes, nextVersion, notesFor, release, unreleased } from "../lib/release.mjs";
import { scaffold } from "../lib/repo.mjs";

const root = mkdtempSync(join(tmpdir(), "skill-release-"));
after(() => rmSync(root, { recursive: true, force: true }));
const day = new Date("2026-10-19T12:00:00Z");

describe("versions and dates", () => {
  it("bumps by name or takes an exact version", () => {
    assert.equal(nextVersion("0.4.1"), "0.4.2");
    assert.equal(nextVersion("0.4.1", "minor"), "0.5.0");
    assert.equal(nextVersion("0.4.1", "major"), "1.0.0");
    assert.equal(nextVersion("0.4.1", "1.2.3"), "1.2.3");
    assert.throws(() => nextVersion("0.4.1", "huge"), /bump must be/);
  });
  it("writes the date the way the changelog already does", () => {
    assert.equal(dateFor("## 0.1.0, 18 October 2026\n", day), "19 October 2026");
    assert.equal(dateFor("## 0.4.0, 2026-10-14\n", day), "2026-10-19");
    assert.equal(dateFor("# Changelog\n", day), "2026-10-19");
  });
});

describe("the changelog", () => {
  const log = "# Changelog\n\n## Unreleased\n\n- Dark mode.\n- Faster search.\n\n---\n\n## 0.1.0, 2026-10-01\n\n- First release.\n";
  it("moves the Unreleased notes under the new version and keeps the separators", () => {
    const out = moveNotes(log, "0.2.0", "2026-10-19");
    assert.match(out, /## Unreleased\n\n---\n\n## 0\.2\.0, 2026-10-19\n\n- Dark mode\.\n- Faster search\.\n\n---\n\n## 0\.1\.0/);
    assert.equal(unreleased(out), "");
    assert.equal(notesFor(out, "0.2.0"), "- Dark mode.\n- Faster search.");
  });
  it("refuses to release with nothing written", () => {
    assert.throws(() => moveNotes("# Changelog\n\n## Unreleased\n\n## 0.1.0, 2026-10-01\n", "0.2.0", "x"), /empty/);
  });
});

describe("a release", () => {
  it("bumps package.json, moves the notes and rebuilds every manifest; a dry run changes nothing", async () => {
    const dir = join(root, "kit");
    scaffold(dir, { name: "release-kit", displayName: "Release Kit", description: "Release notes plugin and skills for Claude Code and AI agents. Release notes, changelogs.", keywords: ["changelog"], author: { name: "T" }, repository: "example/release-kit", prefix: "release" });
    const { packagePlugin } = await import("../lib/package.mjs");
    await packagePlugin(dir);
    const dry = await release(dir, { bump: "minor", dry: true, now: day });
    assert.equal(dry.version, "0.1.0");
    assert.equal(JSON.parse(readFileSync(join(dir, "package.json"), "utf8")).version, "0.0.1");
    const r = await release(dir, { bump: "minor", now: day });
    assert.equal(JSON.parse(readFileSync(join(dir, "package.json"), "utf8")).version, "0.1.0");
    assert.equal(JSON.parse(readFileSync(join(dir, ".claude-plugin", "plugin.json"), "utf8")).version, "0.1.0");
    assert.match(readFileSync(join(dir, "CHANGELOG.md"), "utf8"), /## 0\.1\.0, 2026-10-19/);
    assert.match(r.notes, /specification/);
    assert.ok(r.steps.some((s) => /git tag v0\.1\.0/.test(s.run)));
    assert.ok(!r.steps.some((s) => /npm publish/.test(s.run)), "a private package isn't published to npm");
  });
});
