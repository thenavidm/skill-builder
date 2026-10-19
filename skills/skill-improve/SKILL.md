---
name: skill-improve
description: Fixes a skill that gets something wrong, proven on the failing case and on everything it did right before. Not for tidying (skill-tidy) or new skills (skill-create).
---

# Improve a skill

One standard: prove it. An edit that only looks right, with the hope that it works next time, hasn't fixed anything. To clean up a skill that works, use `skill-tidy`.

The engine runs as `npx -y @thenavidm/skill-builder@latest`. Where `skill-builder` is installed (`npm install -g @thenavidm/skill-builder`), run `skill-builder` instead: it's the same engine, without the download.

## First, save the current version

Copy the whole skill folder to `.agents/skill/history/<name>/<date-and-time>/` and confirm the copy matches. It is the baseline the new version is measured against, and the way back if the change makes things worse. If the skill came from someone else's plugin, ask before changing it: edit a copy under a name of theirs, or suggest the fix to the plugin's author.

## Fix it

1. **The exact failure.** Ask for the real input and the output that was wrong, or their review notes (`feedback.json` from an eval run). "It's off" isn't enough to fix; "it wrote the date as November 10" is.
2. **The cause.** Read the whole skill and find the instruction that produced it, the rule that's missing, or the description that let another skill fire. Say it in one sentence, pointing at the line. A guess isn't a cause.
3. **The smallest change** that removes the cause, written by the `skill-writer` agent from your one-sentence cause, or by you in a tool without agents. A skill that grows a new rule for every case becomes a list nobody can follow. Prefer explaining the reason behind an existing rule over adding a new one.
4. **Prove it.** Add the failing case to `evals/evals.json` as a task with an assertion that failed before. Run `eval` on the new version and on the saved one:

```bash
npx -y @thenavidm/skill-builder@latest eval <skill> --runs 3
```

The failing task must now pass, and every task that passed before must still pass. Where assertions can't capture the difference, give the old and new outputs to the `skill-comparator` agent unlabelled; then have the `skill-reviewer` agent check the changed skill. If the cause was triggering, use `skill-description` instead and prove it with `trigger`.

## Either way

Two attempts. If the second still fails its proof, put the saved version back (copy the whole folder, confirm it matches) and say plainly what's left: the fix may need a rebuild with `skill-create`. Report what changed, the before and after numbers, and where the old version is kept.
