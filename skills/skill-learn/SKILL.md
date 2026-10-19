---
name: skill-learn
description: Applies a correction to every skill it touches, with a diff to approve for each and their evals run again. Use for "from now on, never X" or after correcting an output.
---

# Learn from a correction

A correction given once should reach every skill it applies to, and stay proven. This finds those skills, changes each with the person's yes, and runs their tests again so the lesson doesn't break something else.

The engine runs as `npx -y @thenavidm/skill-builder@latest`; in the Skill Builder repository, `node bin/skill-builder.mjs`.

## 1. State the lesson

Write it as one rule with its reason, in their words: "Links never go in the body of a post, because the platforms show posts with links to fewer people." Collect lessons from what they said in this conversation, from review notes (`feedback.json`), or from what they pasted. Several lessons go through these steps one at a time.

## 2. Rule or memory?

Ask, with your recommendation:

- **A rule for skills**: about how a task is done ("dates as 10 November 2026"). It goes into the skills.
- **A general preference**: about how they like to work with the AI ("explain before you change things"). It goes to their AI tool's memory or instructions file, not into skills.

## 3. Find every skill it touches

Read the description and steps of every skill where `.agents/skill/setup.md` says their skills live, and any plugin repositories they name. Sort them:

| Sure | The skill does the thing the rule is about |
|---|---|
| Likely | The skill sometimes does it |
| No | Unrelated |

Show the list and let them confirm which to change.

## 4. One change per skill, each approved

For each, have the `skill-writer` agent draft the change (or draft it yourself), then show the exact diff: where the rule goes and how it's worded for that skill. Change only what the rule needs. If a skill already has a rule that contradicts this one, ask which wins. Apply the ones they approve, and bump the skill's version in `metadata` (or the plugin's in `package.json` through `skill-release`).

## 5. Prove nothing broke

For each changed skill that has evals, run them and compare with before:

```bash
npx -y @thenavidm/skill-builder@latest eval <skill> --runs 3
```

Add a task to the skill that checks the new rule, so it stays proven. Report, per skill: changed, the before and after pass rate, and anything that got worse.
