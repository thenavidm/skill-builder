/**
 * trigger: reading each tool's events, and scoring, on lines copied from real
 * runs (Claude Code 2.1.299, Codex 0.159.3, Antigravity CLI 1.4.2).
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { TOOLS } from "../lib/tools.mjs";
import { loadSet, outcome, scorePrompt, split, summarise } from "../lib/trigger.mjs";

const root = mkdtempSync(join(tmpdir(), "skill-trigger-test-"));
after(() => rmSync(root, { recursive: true, force: true }));

describe("seeing a skill fire", () => {
  it("in Claude Code: a Skill tool call, plugin prefix removed", () => {
    const line = { type: "assistant", message: { content: [{ type: "tool_use", name: "Skill", input: { skill: "my-plugin:release-notes" } }] } };
    assert.equal(TOOLS.claude.fired(line), "release-notes");
    assert.equal(TOOLS.claude.fired({ type: "assistant", message: { content: [{ type: "tool_use", name: "Read", input: {} }] } }), null);
  });
  it("in Codex: a command that reads the skill's SKILL.md", () => {
    const line = { type: "item.started", item: { type: "command_execution", command: "/bin/zsh -lc 'cat .agents/skills/fieldcheck-plain/SKILL.md'" } };
    assert.equal(TOOLS.codex.fired(line), "fieldcheck-plain");
    assert.equal(TOOLS.codex.fired({ type: "item.started", item: { type: "command_execution", command: "ls" } }), null);
  });
  it("in Antigravity: a view_file step that opens the skill's SKILL.md", () => {
    const line = { event: "step_update", step_update: { tool_name: "view_file", tool_info: { parameters: { AbsolutePath: "/tmp/x/.agents/skills/fieldcheck-plain/SKILL.md" } } } };
    assert.equal(TOOLS.antigravity.fired(line), "fieldcheck-plain");
  });
  it("reads each tool's final answer", () => {
    assert.equal(TOOLS.claude.answer({ type: "result", result: "PLAIN-OK" }), "PLAIN-OK");
    assert.equal(TOOLS.codex.answer({ type: "item.completed", item: { type: "agent_message", text: "PLAIN-OK" } }), "PLAIN-OK");
    assert.equal(TOOLS.antigravity.answer({ event: "result", result: { response: "PLAIN-OK\n" } }), "PLAIN-OK\n");
  });
});

describe("prompt sets", () => {
  it("accepts should for one skill and expect for a plugin, and refuses an unknown skill", () => {
    const f = join(root, "set.json");
    writeFileSync(f, JSON.stringify([{ prompt: "write the release notes", should: true }, { prompt: "fix this bug", should: false }]));
    assert.deepEqual(loadSet(f, ["release-notes"]), [{ prompt: "write the release notes", expect: "release-notes" }, { prompt: "fix this bug", expect: null }]);
    writeFileSync(f, JSON.stringify([{ prompt: "x", expect: "nope" }]));
    assert.throws(() => loadSet(f, ["a", "b"]), /isn't one of/);
  });
  it("splits the same way every time, keeping both kinds in each half", () => {
    const set = Array.from({ length: 10 }, (_, i) => ({ prompt: `p${i}`, expect: i < 5 ? "a" : null }));
    const a = split(set);
    assert.deepEqual(split(set), a);
    assert.equal(a.test.filter((p) => p.expect).length, 2);
    assert.equal(a.test.filter((p) => !p.expect).length, 2);
    assert.equal(a.train.length, 6);
  });
});

describe("scoring", () => {
  const ours = ["notes", "changelog"];
  it("counts the first of our skills to fire, and the others separately", () => {
    assert.deepEqual(outcome(["web-search", "changelog", "notes"], ours), { first: "changelog", others: ["web-search"] });
  });
  it("passes a prompt that gets the right skill in most runs, and leaves errors out", () => {
    const runs = [{ fired: ["notes"], status: "fired" }, { fired: ["changelog"], status: "fired" }, { fired: ["notes"], status: "fired" }, { fired: [], status: "error" }];
    const s = scorePrompt({ prompt: "p", expect: "notes" }, runs, ours);
    assert.equal(s.hits, 2);
    assert.equal(s.errors, 1);
    assert.equal(s.pass, true);
  });
  it("fails a should-not prompt when one of ours fires, but not when another installed skill does", () => {
    const quiet = scorePrompt({ prompt: "p", expect: null }, [{ fired: ["web-search"], status: "fired" }], ours);
    assert.equal(quiet.pass, true);
    const loud = scorePrompt({ prompt: "p", expect: null }, [{ fired: ["notes"], status: "fired" }], ours);
    assert.equal(loud.pass, false);
  });
  it("names misrouted prompts and the installed skills that took them", () => {
    const scored = [
      scorePrompt({ prompt: "a", expect: "notes" }, [{ fired: ["changelog"], status: "fired" }], ours),
      scorePrompt({ prompt: "b", expect: "notes" }, [{ fired: ["web-search"], status: "fired" }], ours),
    ];
    const s = summarise(scored);
    assert.equal(s.shouldFire.passed, 0);
    assert.deepEqual(s.misrouted.map((m) => m.prompt), ["a"]);
    assert.deepEqual(s.otherSkills, { "web-search": 1 });
  });
});

describe("starting a tool on Windows", () => {
  it("reads the script an npm .cmd wrapper runs, so no shell is needed", async () => {
    const { cmdTarget, resolveCommand } = await import("../lib/tools.mjs");
    const wrapper = '@ECHO off\r\nGOTO start\r\n:find_dp0\r\nSET dp0=%~dp0\r\nEXIT /b\r\n:start\r\nSETLOCAL\r\nCALL :find_dp0\r\n"%_prog%"  "%dp0%\\node_modules\\@openai\\codex\\bin\\codex.js" %*\r\n';
    assert.equal(cmdTarget(wrapper, "C:\\npm"), join("C:\\npm", "node_modules", "@openai", "codex", "bin", "codex.js"));
    assert.equal(cmdTarget("@echo off\r\necho nothing\r\n", "C:\\npm"), null);
    assert.deepEqual(resolveCommand("codex", "darwin"), ["codex", []]);
  });
});
