/**
 * tokens: listing and load costs, on skills written for the test.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { CHARS_PER_TOKEN, listingText, measure } from "../lib/tokens.mjs";

const root = mkdtempSync(join(tmpdir(), "skill-tokens-"));
after(() => rmSync(root, { recursive: true, force: true }));

describe("tokens", () => {
  it("uses the measured rate", () => {
    assert.equal(CHARS_PER_TOKEN, 3);
  });
  it("caps the listing as Claude Code does", () => {
    const t = listingText("a", { description: "x".repeat(2000) });
    assert.equal(t.length, "a: ".length + 1536);
  });
  it("adds up a plugin's skills and agents, and its share of each tool's budget", () => {
    for (const [name, desc] of [["one", "d".repeat(297)], ["two", "e".repeat(597)]]) {
      mkdirSync(join(root, "skills", name, "references"), { recursive: true });
      writeFileSync(join(root, "skills", name, "SKILL.md"), `---\nname: ${name}\ndescription: ${desc}\n---\n\n${"b".repeat(300)}\n`);
      writeFileSync(join(root, "skills", name, "references", "more.md"), "r".repeat(90));
    }
    mkdirSync(join(root, "agents"));
    writeFileSync(join(root, "agents", "helper.md"), "---\nname: helper\ndescription: Helps.\n---\n\nHelp.\n");
    const m = measure(root);
    const one = m.skills.find((s) => s.name === "one");
    assert.equal(one.listingTokens, Math.ceil(("one: " + "d".repeat(297)).length / 3));
    assert.equal(one.files[0].path, "references/more.md");
    assert.equal(one.files[0].tokens, 30);
    assert.equal(m.listing, m.skills.reduce((n, s) => n + s.listingTokens, 0));
    assert.equal(m.agents.length, 1);
    const claude = m.budgets.find((b) => b.tool === "Claude Code");
    assert.equal(claude.of200k, m.listing / 2000);
  });
});
