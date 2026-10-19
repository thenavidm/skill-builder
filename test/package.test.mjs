/**
 * package: Codex's "only when asked" file written from SKILL.md, and only ever
 * our own file replaced or removed.
 */
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { codexSidecar, syncSidecars } from "../lib/package.mjs";

const root = mkdtempSync(join(tmpdir(), "skill-package-"));
after(() => rmSync(root, { recursive: true, force: true }));
const skill = (name, extra = "") => {
  mkdirSync(join(root, "skills", name), { recursive: true });
  writeFileSync(join(root, "skills", name, "SKILL.md"), `---\nname: ${name}\ndescription: Does ${name}.${extra}\n---\n\nGo.\n`);
};
const sidecar = (name) => join(root, "skills", name, "agents", "openai.yaml");

describe("Codex's file for skills that only run when asked", () => {
  it("is written for a skill with disable-model-invocation: true, and not for others", () => {
    skill("deploy", "\ndisable-model-invocation: true");
    skill("notes");
    const r = syncSidecars(root);
    assert.deepEqual(r.written, ["skills/deploy/agents/openai.yaml"]);
    assert.equal(readFileSync(sidecar("deploy"), "utf8"), codexSidecar());
    assert.match(codexSidecar(), /allow_implicit_invocation: false/);
    assert.equal(existsSync(sidecar("notes")), false);
  });
  it("is reported stale by --check and unchanged once written", () => {
    assert.deepEqual(syncSidecars(root, { check: true }).stale, []);
    skill("release", "\ndisable-model-invocation: true");
    assert.deepEqual(syncSidecars(root, { check: true }).stale, ["skills/release/agents/openai.yaml"]);
  });
  it("is removed when the skill no longer waits to be asked, but a hand-written one is left alone", () => {
    syncSidecars(root);
    skill("release");
    mkdirSync(join(root, "skills", "notes", "agents"), { recursive: true });
    writeFileSync(sidecar("notes"), "interface:\n  display_name: Notes\n");
    skill("notes", "\ndisable-model-invocation: true");
    const r = syncSidecars(root);
    assert.deepEqual(r.removed, ["skills/release/agents/openai.yaml"]);
    assert.deepEqual(r.kept, ["skills/notes/agents/openai.yaml"]);
    assert.equal(readFileSync(sidecar("notes"), "utf8"), "interface:\n  display_name: Notes\n");
  });
});

describe("the builder a repository gets", () => {
  it("is its own when it has one", async () => {
    const { builderFor } = await import("../lib/package.mjs");
    const own = join(root, "own");
    mkdirSync(join(own, "scripts", "manifests"), { recursive: true });
    writeFileSync(join(own, "scripts", "manifests", "build.mjs"), "export function build() { return { written: ['mine'], stale: [], unchanged: [] }; }\n");
    const b = await builderFor(own);
    assert.equal(b.own, true);
    assert.deepEqual(b.build().written, ["mine"]);
  });
});

describe("the package command", () => {
  it("never writes when asked to check, whatever comes after --check", async () => {
    const { spawnSync } = await import("node:child_process");
    const { fileURLToPath } = await import("node:url");
    const bin = fileURLToPath(new URL("../bin/skill-builder.mjs", import.meta.url));
    const repo = join(root, "check-only");
    mkdirSync(join(repo, "skills", "deploy"), { recursive: true });
    writeFileSync(join(repo, "skills", "deploy", "SKILL.md"), "---\nname: deploy\ndescription: Deploys.\ndisable-model-invocation: true\n---\n\nGo.\n");
    mkdirSync(join(repo, "scripts", "manifests"), { recursive: true });
    writeFileSync(join(repo, "scripts", "manifests", "build.mjs"), "export function build(root, { check }) { if (!check) throw new Error('wrote during a check'); return { written: [], stale: [], unchanged: [] }; }\n");
    for (const args of [["package", repo, "--check"], ["package", "--check", repo]]) {
      const r = spawnSync(process.execPath, [bin, ...args], { encoding: "utf8" });
      assert.equal(existsSync(join(repo, "skills", "deploy", "agents", "openai.yaml")), false, args.join(" "));
      assert.equal(r.status, 1, r.stderr);
      assert.match(r.stderr, /out of date: skills\/deploy\/agents\/openai.yaml/);
    }
  });
});
