---
name: skill-description
description: Checks that a skill's description fires on the right prompts and not on near misses, in each tool, and rewrites it until it does. Use when a skill won't fire or misfires.
---

# Tune a description

A skill fires when the model, reading its name and description among all the others, decides it fits. This finds out what really happens in each tool, then improves the description without fitting it to the prompts you looked at.

The engine runs as `npx -y @thenavidm/skill-builder@latest`; in the Skill Builder repository, `node bin/skill-builder.mjs`.

## 1. The prompts

Use the skill's `evals/triggers.json` if it has one. Otherwise write one with them:

- 8 to 10 prompts that should fire it, said the way people really talk: casual and formal, with typos and abbreviations, some that never name the skill, a few where another of their skills is also plausible but this one should win.
- 8 to 10 near misses that share its words but need something else. An unrelated prompt tests nothing.

Show them the list before running it: a bad set produces a bad description.

## 2. Measure

Say how many runs it takes, then:

```bash
npx -y @thenavidm/skill-builder@latest trigger <skill> --set <triggers.json> --runs 3 --split
```

`--split` holds back 40% of the prompts. For each tool you get which prompts fired the skill, which near misses fired it wrongly, and which other installed skill took a prompt instead. A run marked blocked stopped on a permission and doesn't count.

## 3. Find the cause

| Pattern | Usual cause |
|---|---|
| Misses across every tool | The description doesn't use the words people say, or the name says nothing |
| Misses in one tool only | That tool's list is crowded: check `skill-builder tokens` |
| Another skill takes it | The two overlap; add a boundary to each ("Not for X, use Y") |
| Fires on near misses | Too broad: say what it's not for |

## 4. Rewrite and prove

Rewrite the description (what it does, when, one boundary, about 300 characters) and, if it says nothing, the name. Run `trigger` again on the same set. Keep the version that scores best on the held-back prompts, not the ones you studied, so the improvement holds for prompts nobody has written yet. Stop after three rewrites that don't improve the held-back score, and say which version is best.

Show the old and new description side by side with the scores in each tool.
