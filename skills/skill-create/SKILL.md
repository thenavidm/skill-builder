---
name: skill-create
description: Builds a new skill that does a task the user's way, from a goal, this chat or a brief, and proves it fires and helps before installing. Not for fixing one (skill-improve).
---

# Create a skill

Build a skill that does a person's task their way, prove it works on their real inputs in the AI tools they use, then install it. The value is the judgment you capture: anything the model already does well on its own doesn't need a skill.

Every step below names its gate. Don't move on until the gate holds. The engine runs as `npx -y @thenavidm/skill-builder@latest <command>`, or `skill-builder <command>` where it's installed globally.

## Keep the job recoverable

As soon as there is a working name, keep a log at `.agents/skill/runs/<name>/run.md`: the agreed plan, what each check found, what the person approved, what passed. Draft the skill in `.agents/skill/runs/<name>/draft/<name>/`, never in a live skills folder. Write to the log after every step. If the job is picked up later, read the log and continue from the first step whose gate isn't recorded as passed; never assume a gate passed because the conversation suggests it.

Never put keys, passwords or private data in the log or the draft. Note where they live instead.

## 1. Start from what's already there

Read `.agents/skill/setup.md` if it exists: which AI tools to test in, where skills live, the name prefix, house rules. If it doesn't, ask those questions first (the `skill` entry skill lists them).

Then look before asking anything:

- **This conversation.** If they say "turn what we just did into a skill", take the steps, tools, inputs, outputs and every correction they made from the conversation itself. Their corrections are the most valuable part.
- **A screen recording.** Work from its transcript and the frames you can see: the order of steps, what they clicked and typed, what they checked before finishing. Say what you couldn't see.
- **A brief or a document.** Take the steps and rules as written.
- **Their existing skills.** Run `check` on the folder where skills live, and `tokens` to see how much room their list has left. If a skill already does most of this, say so: improving it may beat adding one.

Gate: you can say in two sentences what the skill will do and where it came from.

## 2. Interview for the judgment

If they already gave you everything below (a full brief, or they say not to ask), don't interview: go to step 3 and confirm the plan once. Otherwise follow [the interview guide](references/interview.md), one question at a time. Questions with a few clear answers can be choices; anything that is theirs to say in their own words is asked open, because a list of your guesses pulls their answer toward yours.

Before you stop, you need:

- **What they never do**: "Which mistake would make you redo it from scratch?"
- **How it should sound and be structured**: chase every vague word ("clean", "casual") to a concrete example.
- **The finish line**: what has to be true before they call one done. Ask: "What do you check before you call one finished?"
- **A real input** the skill will genuinely get, now or soon. A made-up case can't prove a promise.

Gate: you could hand them a result they would accept without edits.

## 3. The moat test, then the shape

Say in one sentence what this skill knows that the model doesn't do on its own. If the answer is generic ("writes good emails"), tell them honestly that a skill would add steps without making the result any better, offer a saved prompt instead, record `no-build` in the log, and stop.

Then choose the smallest shape that holds the job, from [skill shapes](references/shapes.md):

- **Type**: does it act (writes, sends, deploys), research, hold knowledge, or pull in live context? A skill that reaches a live system runs only when asked: `disable-model-invocation: true` (Claude Code, Cursor), and `skill package` writes Codex's matching file.
- **Name**: say what it does in words people use. In our tests on 19 October 2026, clear names routed every prompt to the right skill in three tools even with vague descriptions; opaque names dropped routing to 50 to 88%. Start it with their prefix.
- **Description**: lead with what it does and the words people type, add when to use it, and one boundary for the nearest sibling. Keep it under about 300 characters: every description is in context on every message, and tools drop descriptions when the list overflows.
- **Files**: a single `SKILL.md` for most skills; `references/` for detail needed only in some cases; `scripts/` only when code does the job more reliably than instructions (counting, checking, transforming).

Gate: the moat sentence exists, and each rule, each never and the finish line from step 2 has a place in the plan.

## 4. Confirm the plan

Show a short plain summary: what it does, the moat, the rules, the finish line, the type and name, which tools it must work in, where it will be installed (their user folder, this project, or a plugin repository). Ask whether it's right. If they correct it, take the correction in their words, update the plan, and ask again.

Gate: they said yes to this version of the plan.

## 5. Write the tests before the skill

Write `evals/evals.json` in the draft (format in [writing evals](references/evals.md)):

- One task per core promise, using their real input files.
- Assertions code can check wherever possible: a file is written, contains or leaves out something, matches a pattern, stays under a length. A model judges only what needs judgment, such as tone.
- Assert what the result does, not the wording you expect.

Write `evals/triggers.json`: 8 to 10 prompts that should fire the skill, in the different ways a person would really say it, and 8 to 10 near misses that share its words but need something else.

Gate: every core promise has a task, and every task has at least one assertion that would fail without the skill.

## 6. Draft the skill

Start the `skill-writer` agent with the confirmed plan and the draft folder (in a tool without agents, write it yourself the same way). Explain why each rule matters rather than shouting it: a model that knows the reason handles cases the rule didn't foresee. Write the finish line into the skill as the bar it checks its own work against. Keep `SKILL.md` under 500 lines and the instructions under about 5,000 tokens. For anything only one tool has, follow [working in every tool](references/portable.md).

Gate: every rule from the plan is in the files. Check the list item by item.

## 7. Check it in code

```bash
npx -y @thenavidm/skill-builder@latest check <draft-folder>
```

If the skill states numbers, limits or platform rules, start the `skill-fact-checker` agent on the draft and source or remove each claim. Fix every error. For each warning, fix it or note in the log why it stays. For each `risky-surface` note, explain to them, without jargon, what the script can do (reach the network, delete, run programs, read keys) and get a yes for it in the same turn; if they say no, take it out.

Gate: no errors, every warning handled, every risky action approved.

## 8. Measure it in their tools

Tell them how many runs this takes first, then:

```bash
npx -y @thenavidm/skill-builder@latest trigger <draft-folder> --set <draft-folder>/evals/triggers.json
npx -y @thenavidm/skill-builder@latest eval <draft-folder>
```

`trigger` runs every prompt in each AI tool they named and reports which skill fired, including another installed skill that took the prompt. `eval` runs each task with and without the skill and opens a review page. Read the numbers with them:

- A should-fire prompt that missed: improve the description or the name, then run `trigger` again on the held-back prompts (`--split`) so the fix isn't fitted to the prompts you looked at.
- A task that doesn't pass with the skill: fix the instruction that caused it.
- An assertion that passes as often without the skill proves nothing: sharpen it or drop it.
- A run marked blocked stopped on a permission, not on the skill.

Gate: every should-fire prompt fires in most runs in each tool, no near miss fires it, and each task passes clearly more often with the skill than without.

## 9. Independent review

Start the `skill-reviewer` agent (in a tool without agents, review it yourself and say so) to read the draft against the confirmed plan using [the review guide](references/review.md). Fix what blocks it. Allow two rounds: if it still fails after the second, narrow what the skill promises or stop, rather than looping.

Gate: no unresolved blocker.

## 10. Their sign-off

Show them a real output from the eval run on their own input, with the numbers, and ask whether they would put their name to it. If they wouldn't, ask what they'd change, fix the cause in the skill, and run again the checks that change touches.

Gate: they said yes.

## 11. Install where they choose

Follow [installing](references/install.md): their user folder (every project on this computer), this project (shared with their team), or a plugin repository. If a skill with that name exists, list what it contains and let them choose: overwrite it, or pick a different name. Before replacing, save the old version under `.agents/skill/history/<name>/<date>/` so it can be put back. Replace the folder whole, never copy over it, then confirm the installed files match the draft exactly.

Gate: the installed file list and every file's content match the draft.

## 12. Close

Tell them its name, where it is, which tools it works in, one sentence that will bring it up, and how to put the old version back if they replaced one. It fires from their next conversation, not this one. If it doesn't, that's a description to fix with `skill-description`, not a broken skill.
