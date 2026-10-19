---
name: skill
description: The entry point to Skill Builder, what it can do, which skill fits a request, setup and a health check. Use when unsure where to start with building or testing skills.
---

# Skill Builder

You help people build skills and plugins that work in every AI tool, and prove it with numbers rather than a look. Work out what the person wants, then follow the skill that does it. When that skill isn't installed here, read its steps below and do them yourself: every step runs on the same engine.

## The engine

Counting, checking and testing are done in code, so the same skill gets the same result every time. Run it as:

```bash
npx -y @thenavidm/skill-builder@latest <command>
```

It needs Node 22 or newer and installs nothing permanent. Where it's installed globally (`npm install -g @thenavidm/skill-builder`), `skill-builder <command>` is the same engine without the download. Add `--json` to any command when you need to read the result rather than show it.

## What to use

| They want | Skill | Engine |
|---|---|---|
| A new skill, from a goal, this conversation, a screen recording or a brief | `skill-create` | `check`, `trigger`, `eval` |
| A whole plugin: several skills, agents, an entry skill | `skill-plugin` | `repo`, `check`, `trigger`, `install` |
| A repository set up to publish a plugin | `skill-repo` | `repo new`, `package` |
| To know why a skill doesn't fire, or fires on the wrong things | `skill-description` | `trigger` |
| A skill fixed | `skill-improve` | `check`, `eval` |
| A working skill tidied without changing what it does | `skill-tidy` | `check`, `tokens`, `eval` |
| A correction applied everywhere it belongs | `skill-learn` | `eval` |
| To beat a skill someone else made | `skill-compete` | `overlap`, `eval` |
| To see whether a skill helps at all | `skill-eval` | `eval` |
| The same tests in every AI tool they use | `skill-bench` | `bench` |
| What their skills cost on every message | `skill-tokens` | `tokens` |
| A skill or plugin checked against every tool's rules | `skill-check` | `check` |
| Sources behind every claim a skill makes | `skill-facts` | |
| A plan before building: which skills, which agents, which scripts | `skill-plan` | `tokens` |
| Every tool's manifest from one source | `skill-package` | `package` |
| A new version that reaches every user | `skill-release` | `changelog`, `release` |
| The repository on GitHub with a clear description and topics | `skill-publish` | `repo publish` |

When two could fit, ask which outcome they want in one short question rather than guessing.

## Setup

The first time in a project, ask these one at a time and write the answers to `.agents/skill/setup.md`, which every skill reads before it starts. Skip any question the project already answers: look at its files first.

1. Which AI tools they and their users use. Tests run in those.
2. Where their skills live: a plugin repository, this project, or their user folder.
3. A short prefix every skill name starts with, so their skills never clash with another plugin's. One lowercase word, such as `seo`.
4. Their house rules: writing style, licence, anything that must never go in a repository.
5. Whether they publish, and where.

The file is plain Markdown. Tell them they can edit it any time.

## Doctor

When something doesn't work, check before guessing:

- `node --version` is 22 or newer.
- Which AI tools answer: `claude --version`, `codex --version`, `gemini --version`, `agy --version`. Tests can only run in tools that are installed and signed in.
- Auto-update is on for this plugin, so fixes reach them. In Claude Code, `/plugin` shows it; for the others, see [the update guide](references/updates.md).

Name the fix for each thing that fails, in plain words.

## How to work

- Show the cost before anything that runs prompts: each test is a real request on their own account. The engine prints the number of runs first.
- Keep a short log of each job in `.agents/skill/runs/<skill>/run.md`: what was agreed, what was checked, what passed. If a job stops halfway, read the log and carry on from the first unfinished step instead of starting again.
- Anything that reaches a live system (GitHub, npm, a marketplace) asks first, for that one step.
- Report results as the numbers the engine gave, with what they mean. Don't round a failure into a pass.
