---
name: skill-eval
description: Runs a skill's tasks with and without it in a real AI tool, grades every output and opens a review page. Use for "does this skill actually help", or to test one.
---

# Does the skill help?

Run the same tasks with the skill and without it, grade each run, and show the difference. A skill that doesn't beat the plain model on its own tasks is weight in every conversation.

The engine runs as `npx -y @thenavidm/skill-builder@latest`; in the Skill Builder repository, `node bin/skill-builder.mjs`.

## 1. The tasks

The skill's `evals/evals.json` holds them. If it has none, write it with them first: one task per thing the skill promises, real input files in `evals/files/`, and assertions that check outcomes. The format and what makes a test prove something are in [the eval format](references/format.md).

## 2. Run

Say how many runs it will take (tasks x 2 x runs), then:

```bash
npx -y @thenavidm/skill-builder@latest eval <skill> --tool <their main tool> --runs 3
```

Each run gets its own throwaway folder and may write only there. Nothing switches permission checks off. Where no AI tool can be run headless (in claude.ai, say), the `skill-executor` agent runs each task in a fresh context and the `skill-grader` agent grades it, so the numbers come the same way.

## 3. Read the result with them

- **With and without**: the share of assertions passed in each, with the spread across runs, and the difference.
- **The skill never ran** in some runs with it: those measure the model, not the skill. Usually a description problem: use `skill-description`.
- **Passed as often without the skill**: those assertions prove nothing. Sharpen them.
- **Blocked**: the run stopped on a permission headless mode can't ask for; it's left out of the numbers.
- **Time and tokens**: a skill that helps but costs much more is worth knowing about.

For the patterns the averages hide, start the `skill-analyzer` agent on the results.

Open the review page it wrote (`review.html`) and ask them to look at the outputs. Their notes, saved as `feedback.json`, are what `skill-improve` fixes next.

## 4. In every tool

To see the same tasks in each AI tool they have installed, use `skill-bench`.
