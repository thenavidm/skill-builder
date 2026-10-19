---
name: skill-tokens
description: Measures what skills and plugins cost in context on every message, against each tool's budget. Use when skills stopped firing after installing more, or to slim a plugin.
---

# What skills cost

Every installed skill's name and description sit in context on every message, whether it's used or not. Tools cap that list: Claude Code at 1% of the model's context window and Codex at 2% (their documentation, October 2026). When the list overflows, descriptions are dropped and those skills can't be matched to a request any more, so they go quiet. This measures how close a person is to that.

```bash
npx -y @thenavidm/skill-builder@latest tokens <skill-or-plugin>
```

## Reading the result

- **every message**: the skill's name and description. This is the cost that adds up across everything they have installed.
- **when it runs**: its `SKILL.md` body, paid only when it fires.
- **files it can load**: references it reads only when a step needs them.
- The plugin's share of each tool's budget on a 200,000-token model and on a 1,000,000-token one. Over 100% means this plugin alone overflows the list on that model.

The numbers are estimates at about 3 characters a token, measured against Claude Code's own counts (19 October 2026). Say so when you quote them.

## When it's too heavy

In order of how much each saves:

1. **Shorten descriptions.** What it does and when, in about 300 characters. Lists of keywords cost the most and help the least.
2. **Fewer skills that start on their own.** A plugin's entry skill can route to the rest; skills that only run when asked (`disable-model-invocation: true`) can leave the list in Claude Code and Cursor.
3. **Merge skills that always run together.**
4. **Move detail out of `SKILL.md`** into references, to cut the cost when it runs.

After each change, run `tokens` again and show the before and after. If they also have `evals/triggers.json`, run `skill-builder trigger` to confirm the shorter descriptions still fire.
