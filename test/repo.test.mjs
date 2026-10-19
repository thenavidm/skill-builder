/**
 * repo: a new plugin repository that passes its own checks the moment it is written.
 */
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { profile, publishSteps, scaffold } from "../lib/repo.mjs";
import { packagePlugin } from "../lib/package.mjs";
import { check } from "../lib/check.mjs";

const root = mkdtempSync(join(tmpdir(), "skill-repo-"));
after(() => rmSync(root, { recursive: true, force: true }));
const P = {
  name: "release-kit",
  displayName: "Release Kit",
  description: "Release notes plugin and skills for Claude Code and AI agents. Release notes, changelogs, version bumps.",
  keywords: ["release-notes", "changelog", "claude-code-plugin"],
  author: { name: "Test Author", url: "https://example.com" },
  repository: "example/release-kit",
  prefix: "release",
};

describe("a new plugin repository", () => {
  it("refuses a profile that would make a broken repo, and says what's missing", () => {
    assert.throws(() => profile({ ...P, name: "Release Kit" }), /name:/);
    assert.throws(() => profile({ ...P, repository: "release-kit" }), /repository/);
    assert.throws(() => profile({ ...P, prefix: "release-kit" }), /prefix/);
  });
  it("is written with every house file, its manifests build, and check finds no errors", async () => {
    const dir = join(root, "kit");
    const r = scaffold(dir, P);
    for (const f of ["README.md", "LICENSE", "CHANGELOG.md", "CONTRIBUTING.md", "SECURITY.md", "AGENTS.md", "CLAUDE.md", ".gitignore", ".github/topics", ".github/workflows/ci.yml", "product.json", "package.json", "skills/release/SKILL.md", "scripts/manifests/build.mjs"]) {
      assert.ok(r.written.includes(f), f);
    }
    const built = await packagePlugin(dir);
    assert.ok(built.ownBuilder);
    assert.ok(built.manifests.written.includes(".claude-plugin/plugin.json"));
    assert.deepEqual((await packagePlugin(dir, { check: true })).stale, []);
    const errors = check(dir).findings.filter((f) => f.level === "error");
    assert.deepEqual(errors, []);
    const readme = readFileSync(join(dir, "README.md"), "utf8");
    assert.ok(readme.startsWith(`# Release Kit\n\n${P.description}`), "the README's first line is the description");
    assert.match(readFileSync(join(dir, "LICENSE"), "utf8"), /Copyright \(c\) \d{4} Test Author/);
    assert.ok(!/—/.test(readme), "no em dashes");
  });
  it("never overwrites a file that is already there", () => {
    const dir = join(root, "existing");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "README.md"), "mine\n");
    const r = scaffold(dir, P);
    assert.ok(r.kept.includes("README.md"));
    assert.equal(readFileSync(join(dir, "README.md"), "utf8"), "mine\n");
  });
  it("writes nothing on a dry run", () => {
    const dir = join(root, "dry");
    const r = scaffold(dir, P, { dry: true });
    assert.ok(r.written.length > 10);
    assert.equal(existsSync(dir), false);
  });
  it("lists the GitHub steps private first, public only after", () => {
    const steps = publishSteps(P).map((s) => s.run);
    assert.match(steps[0], /--private/);
    assert.ok(steps.findIndex((s) => /--visibility public/.test(s)) > 0);
    assert.ok(steps.some((s) => /private-vulnerability-reporting/.test(s)));
  });
});
