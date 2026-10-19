---
name: skill-compete
description: Builds a better version of someone else's skill or plugin from scratch and proves it on the same tasks, with nothing copied. Use for "beat this skill".
---

# Beat a skill

Read theirs, build ours from scratch, measure both the same way. Better means better on the same tasks with the numbers to show it, not longer.

The engine runs as `npx -y @thenavidm/skill-builder@latest`; in the Skill Builder repository, `node bin/skill-builder.mjs`.

## 1. Get it and read its licence

From GitHub, a skills directory, their disk, or pasted text. Read the licence before anything else and tell them what it allows: reading it to learn is always fine; reusing its code needs a licence that permits it and a credit; copying its text is never what we do, whatever the licence.

## 2. Take it apart

- **What it does**, step by step.
- **What it does well**: list every strength. Ours must match each one or beat it, or the comparison isn't honest.
- **Where it stops**: tools it doesn't work in, steps it skips, claims it doesn't test.

Run the engine on it, since numbers are fairer than impressions:

```bash
npx -y @thenavidm/skill-builder@latest check <theirs>
npx -y @thenavidm/skill-builder@latest tokens <theirs>
```

## 3. Build ours

With `skill-create`, from the job, not from their text. Close the window with their skill before writing, so the words are ours.

## 4. The same tasks, both skills

Write the tasks once, covering what both promise, with real inputs. Run each skill on them in the same tools:

```bash
npx -y @thenavidm/skill-builder@latest eval <ours> --runs 3
npx -y @thenavidm/skill-builder@latest eval <theirs> --runs 3
```

Add `trigger` on the same prompts if triggering matters, and `bench` if they use several tools. A blind comparison helps when assertions can't capture quality: give an independent agent the two outputs for each task, unlabelled, and ask which is better and why.

## 5. Prove it's ours

```bash
npx -y @thenavidm/skill-builder@latest overlap <ours> <theirs>
```

It lists every run of eight or more words the two share. Rewrite any in our own words and run it again until there are none.

## 6. Report

A table: each strength of theirs and where ours has it; where ours goes further; the numbers for both on the same tasks; the overlap result. Say plainly where theirs still wins.
