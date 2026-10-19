---
name: skill-bench
description: Runs a skill's evals in every installed AI tool, side by side. Use for "does it work in Codex or Gemini too", or before publishing to people on other tools.
---

# The same tests in every tool

A skill written in one tool often half-works in another: a path one tool doesn't have, a feature it ignores, a description its list cuts. This runs the skill's own evals in each installed tool so "it works in Codex too" is a number.

The engine runs as `npx -y @thenavidm/skill-builder@latest`. Where `skill-builder` is installed (`npm install -g @thenavidm/skill-builder`), run `skill-builder` instead: it's the same engine, without the download.

1. Run `check` first: anything it flags as one tool's feature will show up here as a gap.
2. Say how many runs it takes (tasks x 2 x runs x tools), then:

```bash
npx -y @thenavidm/skill-builder@latest bench <skill> --runs 3
```

3. Read the table with them: for each tool, the share passed with and without the skill, the difference, the time, and how often the skill never ran. Then the tasks where the tools disagree.

## When a tool falls behind

| Pattern | Look at |
|---|---|
| The skill never ran in one tool | Its description in that tool's crowded list: `tokens`, then `skill-description` |
| It ran but failed in one tool | A path or feature only another tool has: `check`'s tool-only findings |
| Runs were blocked | That tool asked for a permission headless mode can't give; the result says which runs |
| Gemini CLI didn't run | It refuses free personal accounts (October 2026); it needs a paid or API-key account |

The `skill-analyzer` agent can read all the tools' results together and name the likely cause of each gap. Each tool has its own review page under the output folder. Fix in the skill, then run the bench again on the tool that fell behind.
