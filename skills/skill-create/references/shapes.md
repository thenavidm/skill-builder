# Skill shapes

Read this at step 3, when you choose the type, name, description and files.

## Types, and how each may start

| Type | It | Starts | Example |
|---|---|---|---|
| Act | Writes, sends, deploys, deletes, buys | Only when asked, if it reaches anything outside the project | deploy, send-newsletter |
| Make | Produces a file or text in a set way | On its own | release-notes, invoice |
| Research | Gathers and weighs information | On its own | competitor-scan |
| Knowledge | Holds rules the model should follow while it works | On its own, often alongside other work | house-dates, api-conventions |
| Live context | Pulls in the current state before working | On its own | pr-summary |

"Only when asked" in each tool:

| Tool | How |
|---|---|
| Claude Code, Cursor | `disable-model-invocation: true` in SKILL.md |
| Codex | `policy: allow_implicit_invocation: false` in `agents/openai.yaml`; `skill package` writes it from the line above |
| Gemini CLI, Antigravity | No switch: the description says plainly that it runs only when the user asks for it by name |

## The name

In lowercase, with hyphens between words, starting with the prefix in setup, saying what it does in the words people use: `seo-audit`, not `seo-helper`. Names do as much routing as descriptions: in our tests on 19 October 2026, clear names routed every prompt correctly in Claude Code, Codex and Antigravity even when the descriptions were vague, and opaque names with vague descriptions routed 50 to 88% of prompts correctly.

## The description

Four parts, in this order, in about 300 characters or fewer:

1. What it does, starting with a verb, in the user's words.
2. When to use it, with two or three phrases people actually say.
3. One boundary against the nearest skill that could be confused with it: "Not for X (use Y)."
4. Nothing else. Long lists of keywords cost context on every message and dilute the match.

Every installed skill's description is in context on every message. Claude Code fits the whole list into 1% of the model's context window and Codex into 2% (their documentation, October 2026); past that, descriptions are dropped and those skills stop firing. A short, specific description is a courtesy to every other skill the person has.

## The files

| Shape | When |
|---|---|
| `SKILL.md` only | Most skills. Everything the task needs fits in a few hundred lines |
| `+ references/` | Detail needed only in some cases: one file per case, each linked from the step that needs it, with when to read it |
| `+ scripts/` | Work code does better than instructions: counting, checking, converting, calling an API the same way every time |
| `+ assets/` | Files the output is built from: a template, a logo, a font |

Keep references one level below SKILL.md and inside the skill's folder, so the skill still works where skills install one folder at a time.

## Starting points

### Make

```markdown
---
name: <prefix>-<what-it-makes>
description: Writes <thing> from <input>, in <their> style. Use when <phrases>. Not for <near thing> (use <other>).
---

# <Thing>

<One paragraph: what good looks like and why.>

## Steps
1. <Read the input. What to look for.>
2. <Write it. The rules, each with its reason.>
3. <Check it against the finish line before showing it.>

## Never
- <Their never-dos, each with why.>

## Finished when
<Their finish line, as the standard.>
```

### Act

The same, with `disable-model-invocation: true`, a step that shows exactly what will happen and asks for a yes before it happens, and a step that confirms it happened.

### Knowledge

No steps: the rules, each with its reason and one example, and when they apply.

### Live context

A first step that runs the command which shows the current state (in Claude Code this can be `!`command``, which runs before the skill loads; elsewhere, tell the model to run it), then the steps that use it.
