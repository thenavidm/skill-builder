/**
 * check, one rule at a time, on skills written into a temporary folder.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { check, checkSkill, references } from "../lib/check.mjs";
import { facts } from "../lib/facts.mjs";

const root = mkdtempSync(join(tmpdir(), "skill-check-"));
after(() => rmSync(root, { recursive: true, force: true }));

let n = 0;
/** Writes skills/<name>/SKILL.md (plus extra files) in a fresh folder and returns the skill's path. */
function skill(name, frontmatter, body = "Do the job.\n", files = {}) {
  const dir = join(root, String(n++), name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "SKILL.md"), `---\n${frontmatter}\n---\n\n${body}`);
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(join(dir, path, ".."), { recursive: true });
    writeFileSync(join(dir, path), text);
  }
  return dir;
}
const codes = (dir) => checkSkill(dir).map((f) => `${f.level}:${f.code}`);
const OK = "description: Writes release notes from merged pull requests. Use when the user asks for release notes or a changelog entry.";

describe("a clean skill", () => {
  it("has nothing to report", () => {
    assert.deepEqual(codes(skill("release-notes", `name: release-notes\n${OK}`)), []);
  });
});

describe("names", () => {
  it("must match the folder", () => {
    assert.ok(codes(skill("release-notes", `name: notes\n${OK}`)).includes("error:name-folder"));
  });
  it("must be lowercase with single hyphens", () => {
    assert.ok(codes(skill("Bad--Name", `name: Bad--Name\n${OK}`)).includes("error:name-shape"));
  });
  it("must be there", () => {
    assert.ok(codes(skill("x", OK)).includes("error:name-missing"));
  });
});

describe("descriptions", () => {
  it("must be there", () => {
    assert.ok(codes(skill("a", "name: a")).includes("error:description-missing"));
  });
  it("may not pass the standard's limit", () => {
    assert.ok(codes(skill("a", `name: a\ndescription: ${"word ".repeat(220).trim()}`)).includes("error:description-long"));
  });
  it("warns when Claude Code's listing would cut it", () => {
    const long = "word ".repeat(180).trim();
    assert.ok(codes(skill("a", `name: a\ndescription: ${long}\nwhen_to_use: ${long}`)).includes("warning:listing-cut"));
  });
});

describe("fields", () => {
  it("names a field no tool reads, and what to use instead", () => {
    const fs = checkSkill(skill("deploy", `name: deploy\n${OK}\nauto-activate: false`));
    const f = fs.find((x) => x.code === "field-unread");
    assert.equal(f.level, "warning");
    assert.match(f.message, /disable-model-invocation: true/);
    assert.match(f.message, /allow_implicit_invocation: false/);
    assert.equal(f.fact, "skills.claude-code.unknown-fields");
  });
  it("notes a field only some tools read, without failing", () => {
    const fs = checkSkill(skill("deploy", `name: deploy\n${OK}\ndisable-model-invocation: true`));
    const f = fs.find((x) => x.code === "field-tool-only");
    assert.equal(f.level, "note");
    assert.match(f.message, /Claude Code and Cursor/);
  });
  it("wants true or false for a switch", () => {
    assert.ok(codes(skill("deploy", `name: deploy\n${OK}\ndisable-model-invocation: yes`)).includes("error:not-boolean"));
  });
  it("catches a misspelled switch", () => {
    const f = checkSkill(skill("a", `name: a\n${OK}\nuser-invokable: false`)).find((x) => x.code === "field-unread");
    assert.match(f.message, /Did you mean `user-invocable`/);
  });
  it("reads past nested YAML it can't check, instead of failing the skill", () => {
    const c = codes(skill("a", `name: a\n${OK}\nhooks:\n  PreToolUse:\n    - matcher: Bash`));
    assert.deepEqual(c, ["note:nested-yaml", "note:field-tool-only"]);
  });
  it("warns about an unquoted colon, which real tools load and strict readers refuse", () => {
    assert.deepEqual(codes(skill("a", "name: a\ndescription: Use when: the user asks for it")), ["warning:yaml-unquoted"]);
  });
  it("still refuses frontmatter that doesn't open on line 1", () => {
    const dir = join(root, String(n++), "a");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "SKILL.md"), "\n---\nname: a\n---\n");
    assert.deepEqual(codes(dir), ["error:frontmatter"]);
  });
});

describe("references", () => {
  it("finds links and backticked paths, skipping URLs, code blocks and placeholders", () => {
    const body = "See [the guide](references/guide.md) and `scripts/run.mjs`.\n[site](https://x.dev) `references/<name>.md`\n```\n[not](references/in-code.md)\n```\n";
    assert.deepEqual(references(body).sort(), ["references/guide.md", "scripts/run.mjs"]);
  });
  it("fails a reference that isn't there and passes one that is", () => {
    const dir = skill("a", `name: a\n${OK}`, "Read [the guide](references/guide.md) and [the other](references/other.md).\n", { "references/guide.md": "# Guide\n" });
    const fs = checkSkill(dir).filter((f) => f.code === "missing-reference");
    assert.equal(fs.length, 1);
    assert.match(fs[0].message, /other\.md/);
    assert.ok(fs[0].line > 1);
  });
  it("only warns about a missing path in backticks, which may be an example, and skips placeholders", () => {
    const c = codes(skill("a", `name: a\n${OK}`, "Run `scripts/build.mjs`, then copy `scripts/*.py` and `agents/agent-name.md`.\n"));
    assert.deepEqual(c, ["warning:missing-path"]);
  });
  it("finds a reference at the plugin's root and says where it won't work", () => {
    const plugin = join(root, "rooted");
    mkdirSync(join(plugin, "skills", "a"), { recursive: true });
    mkdirSync(join(plugin, "agents"), { recursive: true });
    writeFileSync(join(plugin, "agents", "helper.md"), "x");
    writeFileSync(join(plugin, "skills", "a", "SKILL.md"), `---\nname: a\n${OK}\n---\n\nStart \`agents/helper.md\`.\n`);
    assert.deepEqual(codes(join(plugin, "skills", "a")), ["warning:plugin-root-reference"]);
  });
  it("fails an absolute path", () => {
    assert.ok(codes(skill("a", `name: a\n${OK}`, "Read [it](/Users/me/notes.md).\n")).includes("error:absolute-path"));
  });
  it("warns about a reference outside the skill's folder", () => {
    assert.ok(codes(skill("a", `name: a\n${OK}`, "Read [it](../shared.md).\n")).includes("warning:outside-skill"));
  });
});

describe("one tool's features", () => {
  it("warns about ${CLAUDE_SKILL_DIR} and notes $ARGUMENTS and command injection", () => {
    const c = codes(skill("a", `name: a\n${OK}`, "Read `${CLAUDE_SKILL_DIR}/x.md`.\nThe user asked: $ARGUMENTS\nBranch: !`git branch --show-current`\n"));
    assert.ok(c.includes("warning:claude-skill-dir"));
    assert.ok(c.includes("note:claude-arguments"));
    assert.ok(c.includes("note:claude-injection"));
  });
  it("doesn't take the words 'say' and 'open' in prose for commands", () => {
    const c = codes(skill("a", `name: a\n${OK}`, 'When they say "turn this into a skill", open the plan.\n'));
    assert.ok(!c.includes("warning:mac-only"));
  });
  it("warns about macOS-only commands and one tool's folders", () => {
    const c = codes(skill("a", `name: a\n${OK}`, "Copy it with `pbcopy`, then save to ~/.claude/skills.\n"));
    assert.ok(c.includes("warning:mac-only"));
    assert.ok(c.includes("warning:tool-path"));
  });
});

describe("a plugin", () => {
  it("checks every skill and every agent", () => {
    const plugin = join(root, "plugin");
    mkdirSync(join(plugin, "skills", "notes"), { recursive: true });
    writeFileSync(join(plugin, "skills", "notes", "SKILL.md"), `---\nname: notes\n${OK}\n---\n\nStart the notes-writer agent.\n`);
    mkdirSync(join(plugin, "agents", "nested"), { recursive: true });
    writeFileSync(join(plugin, "agents", "notes-writer.md"), "---\nname: notes-writer\ndescription: Writes the notes.\nmodel: opus\n---\n\nWrite.\n");
    writeFileSync(join(plugin, "agents", "lonely.md"), "---\nname: lonely\ndescription: Nobody starts me.\n---\n\nWait.\n");
    const r = check(plugin);
    assert.equal(r.kind, "plugin");
    assert.deepEqual(r.skills, ["notes"]);
    const c = r.findings.map((f) => `${f.level}:${f.code}:${f.file}`);
    assert.ok(c.includes("warning:agent-model:agents/notes-writer.md"));
    assert.ok(c.includes("warning:agent-orphan:agents/lonely.md"));
    assert.ok(c.includes("error:agent-nested:agents/nested"));
  });
});

describe("the facts behind the rules", () => {
  it("each has a source and a date", () => {
    for (const f of facts().values()) {
      assert.ok(f.sources.length > 0, f.id);
      for (const s of f.sources) assert.ok(s.url.startsWith("https://") && (s.checked || f.notes), f.id);
    }
  });
});

describe("real-world frontmatter", () => {
  it("reads past a list of maps, which is valid YAML", () => {
    const dir = skill("a", `name: a\n${OK}\nrequires:\n  - key: OPENAI_API_KEY\n    why: images`);
    assert.ok(!codes(dir).some((c) => c.startsWith("error")));
  });
  it("skips link targets that are placeholders in capitals", () => {
    assert.deepEqual(codes(skill("a", `name: a\n${OK}`, "Open [the harness](HARNESS_URL).\n")), []);
  });
});

describe("secrets in what ships", () => {
  it("fails a .env file and a pasted key, says what kind, and never prints the key", () => {
    const fake = "sk-" + "a1B2c3D4e5F6g7H8i9J0k1L2m3N4";
    const dir = skill("a", `name: a\n${OK}`, "Run the script.\n", { ".env": "ELEVENLABS_API_KEY=abc", "scripts/run.py": `KEY = "${fake}"\n`, ".env.example": "ELEVENLABS_API_KEY=your-key-here\n" });
    const fs = checkSkill(dir).filter((f) => f.code.startsWith("secret"));
    assert.deepEqual(fs.map((f) => f.code).sort(), ["secret", "secret-file"]);
    const key = fs.find((f) => f.code === "secret");
    assert.match(key.message, /OpenAI or Anthropic API key/);
    assert.ok(!JSON.stringify(fs).includes(fake), "the key itself is never in a finding");
  });
  it("leaves placeholders alone", () => {
    const dir = skill("a", `name: a\n${OK}`, "Set `OPENAI_API_KEY=your-key-goes-here-please` first.\n");
    assert.ok(!codes(dir).some((c) => c.includes("secret")));
  });
});
