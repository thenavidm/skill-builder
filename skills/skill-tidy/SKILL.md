---
name: skill-tidy
description: Tidies a working skill that grew long, repetitive or stale while keeping its behaviour, proven by the same eval results at fewer tokens. Not for wrong output (skill-improve).
---

# Tidy a skill

Cutting is easy; proving nothing broke is the job. Change how the skill is written, never what it does.

The engine runs as `npx -y @thenavidm/skill-builder@latest`. Where `skill-builder` is installed (`npm install -g @thenavidm/skill-builder`), run `skill-builder` instead: it's the same engine, without the download.

## 1. Save it and measure it

Copy the whole skill folder to `.agents/skill/history/<name>/<date-and-time>/` and confirm the copy matches: it's the baseline and the way back. Then take the before numbers:

```bash
npx -y @thenavidm/skill-builder@latest check <skill>
npx -y @thenavidm/skill-builder@latest tokens <skill>
npx -y @thenavidm/skill-builder@latest eval <skill> --runs 3
```

If the skill has no evals, write a few for what it does now first (the format is in `skill-eval`): without them there is nothing to prove the tidy against.

## 2. Find what to change

| Problem | Change |
|---|---|
| The same rule in several places | Keep it once, where it's needed |
| Two rules that contradict | Ask which wins; keep that one |
| Generic advice the model follows anyway | Remove it |
| A rule without its reason | Add the reason in a sentence, or remove the rule if nobody knows why it's there |
| Detail only some cases need | Move it into a reference, linked from the step that needs it |
| Links to files that moved | Fix or remove them |
| A long description | What it does, when, one boundary, about 300 characters |

## 3. One approval

Show the changes grouped by kind, with what each saves, and get a yes for the set. Apply them.

## 4. Prove nothing changed

Run the same three commands. `eval` must give the same results as before (within the usual spread between runs), `check` must be as clean or cleaner, and `tokens` shows what was saved. If any eval result got worse, find the change that caused it, undo that one change, and run again. Two tries; after that, put the saved version back and report what you found.

Report the before and after numbers side by side and where the old version is kept.
