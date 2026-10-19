# Skill Builder: Skill Creator Plugin and Skills for Claude Code, Codex and AI Agents

[![License](https://img.shields.io/badge/License-MIT-green)](./LICENSE)
[![YouTube](https://img.shields.io/badge/YouTube-@thenavidm-red?logo=youtube&logoColor=white)](https://youtube.com/@thenavidm?sub_confirmation=1)
[![X](https://img.shields.io/badge/X-@thenavidm-black?logo=x)](https://x.com/thenavidm)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-thenavidm-0A66C2?logo=linkedin&logoColor=white)](https://linkedin.com/in/thenavidm)

Skill creator plugin and skills for Claude Code, Codex and AI agents. Plan, write, check, eval, benchmark, package, and publish agent skills and plugins for every AI tool.

> **Not published yet.** Skill Builder is in development and private. This README is the specification for the first release: every skill and agent below is built to it, and each one ships only after it passes its evals. What is built so far is in the [changelog](CHANGELOG.md).

Skill Builder helps your AI tool build agent skills that work, everywhere.

You say "build me a skill that writes our release notes" or "make a plugin like these three repos, but better", and it does the work. It plans the skills and agents first, writes each one to the Agent Skills standard, checks it in code, tests it with and without the skill on the same prompts, and measures it in Claude Code, Codex, Gemini CLI and Cursor. Then it packages one source into every tool's plugin and publishes the repository.

It also works from what you already did. Say "turn what we just did into a skill" and it builds one from this chat, a screen recording or a brief. Correct it once, and the correction reaches every skill it touches, with the evals run again to prove nothing broke. Point it at someone else's skill, and it builds a better one from scratch and shows you the numbers, without copying a line.

A skill that only works in one tool, or only on the prompt you tried, is not finished. Skill Builder measures both before it calls a skill done.

Code does the validating, the counting and the statistics, so the same skill gets the same result every time. The model only judges what needs judgment, such as whether an output answered the task, and says when it did. Every format rule it uses names the tool's own documentation and the date it was checked.

It has 24 skills and 8 agents, and works in Claude Code, Codex, Gemini CLI, Antigravity and Cursor.

Built by [Navid Moazzez](https://navid.me).

```
> /skill create "write our release notes from merged pull requests"

Plan           1 skill, 1 agent (a writer started at step 3), 2 scripts
Written        skills/release-notes/SKILL.md, description 412 of 1,024 characters
Check          frontmatter: Agent Skills fields only; name matches folder;
               YAML reads the same in every parser; no tool-only paths
Triggers       20 prompts that should fire it: 19; 20 that should not: 0 fired
Evals          8 tasks with and without the skill, 3 runs each
               with the skill: 8 of 8 passed; without: 3 of 8
Every tool     Claude Code, Codex, Gemini CLI, Cursor: all 8 tasks passed
Cost           listing: 96 tokens a message; when loaded: 1,840 tokens

Packaged for every tool from product.json. Not published.
```

The output above shows the shape on an example skill. Every number in it is invented.

This one is real: the engine on 19 October 2026, testing a small skill that sets a team's style for dates, on two tasks, with and without the skill, in three tools.

```
$ skill-builder bench house-dates --runs 1
tool           with  without  change
Claude Code    100%      58%     +42
Codex          100%      25%     +75
Antigravity    100%      n/a     n/a
Antigravity: 2 runs stopped on a permission headless mode can't ask for, and are left out.
```

## How you use it

Install the plugin, then ask in plain words. Your AI tool picks the right skill and runs it from start to finish.

You can also type a command. One entry point routes everything: `/skill <command>`.

```
/skill setup                     one interview, saved for every skill
/skill plan "<goal or repos>"    which skills and agents, and why
/skill create "<job>"            a skill to the standard, checked
/skill eval <path>               with and without the skill, on the same prompts
/skill bench <path>              the evals in every AI tool
/skill package                   one source into every tool's plugin
```

Commands are written `/skill ...` here. In Claude Code and Codex the full name carries the plugin's prefix, `/skill-builder:skill create ...`.

## Features

| Capability | Command |
|---|---|
| A plan from a goal or from example repos | `/skill plan` |
| A skill written to the Agent Skills standard | `/skill create` |
| A skill from this chat, a screen recording or a brief | `/skill create` |
| A correction spread to every skill it touches, then proven | `/skill learn` |
| A better skill than one you point at, with the numbers | `/skill compete` |
| A description tested for triggering | `/skill description` |
| Validation in code | `/skill check` |
| Evals with and without the skill | `/skill eval` |
| The same evals in Claude Code, Codex, Gemini CLI and Cursor | `/skill bench` |
| What a skill costs in tokens | `/skill tokens` |
| One source packaged into every tool's plugin | `/skill package` |
| A whole plugin from a goal: its skills, agents and entry skill | `/skill plugin` |
| A repository set up with every file a release needs | `/skill repo` |
| A repository published to a clear standard | `/skill publish` |
| A release that reaches every user: version, notes, manifests | `/skill release` |

All 24 skills are in [section 5](#5-skills), and all 8 agents in [section 6](#6-agents).

## Contents

| # | Section | What it covers |
|---|---|---|
| 1 | [What you can ask it](#1-what-you-can-ask-it) | Real prompts, not features |
| 2 | [Install](#2-install) | Every AI tool, copy and paste |
| 3 | [Set up](#3-set-up) | One interview, saved for every skill |
| 4 | [How a skill is built](#4-how-a-skill-is-built) | Plan, write, check, test, measure, package |
| 5 | [Skills](#5-skills) | All 24, grouped by job |
| 6 | [Agents](#6-agents) | All 8, and what each returns |
| 7 | [Evidence](#7-evidence) | Every format rule and where it comes from |
| 8 | [Your data](#8-your-data) | What is stored, and where |
| 9 | [Notes and gotchas](#9-notes-and-gotchas) | What catches people out |
| 10 | [Troubleshooting](#10-troubleshooting) | Symptom and cause |
| 11 | [FAQ](#11-faq-) | Including what a plugin, a skill and an agent are |

## 1. What you can ask it

- Build me a skill that writes our release notes from merged pull requests.
- Turn what we just did into a skill.
- Here is a screen recording of how I do our weekly report. Make it a skill.
- From now on, links never go in the body of a post. Apply that to every skill it affects.
- Here is a skill someone else made. Build a better one and prove it.
- Here are three repos that do something like what I want. Tear them down and plan a better plugin: which skills, which agents, and why.
- Why does my skill not trigger when I ask for it? Fix the description and prove it.
- Run my skill's evals with and without it, three times each, and show me where it helps.
- Does this skill work in Codex and Gemini CLI too, or only in Claude Code?
- How many tokens does my plugin cost on every message?
- Turn this Claude Code skill into a plugin that installs in every AI tool, from one source.
- Publish it as a repository with a README, topics, a changelog and a release.

The fifth one is the point. A skill that only works where it was written is half a skill.

## 2. Install

You need one of the AI tools below. Its checks run on Node 22 or newer.

**Claude Code**

```bash
claude plugin marketplace add thenavidm/skill-builder
claude plugin install skill-builder@skill-builder
```

Or inside a session: `/plugin marketplace add thenavidm/skill-builder`, then `/plugin install skill-builder@skill-builder`. Turn on auto-update in `/plugin` so new releases reach you.

**Codex**

```bash
codex plugin marketplace add thenavidm/skill-builder
codex plugin add skill-builder@skill-builder
```

Or run `codex`, type `/plugins`, and install Skill Builder from the marketplace you added. Start a new session before you use it.

**Gemini CLI**

```bash
gemini extensions install https://github.com/thenavidm/skill-builder --auto-update
```

**Antigravity**

```bash
agy plugin install https://github.com/thenavidm/skill-builder
```

That is the Antigravity CLI. For the Antigravity app, copy the repository folder into `~/.gemini/config/plugins/` for every workspace, or into `.agents/plugins/` for one project. Antigravity gets the skills.

**Cursor**

Copy the repository folder to `~/.cursor/plugins/local/skill-builder` and run **Developer: Reload Window**. Copy it rather than linking it: Cursor skips a link there that points outside that folder.

**Any tool the `skills` CLI supports** (Windsurf, OpenCode, GitHub Copilot, Cline and others), the skills only:

```bash
npx skills add thenavidm/skill-builder
```

**Claude Desktop and claude.ai** (Pro, Max, Team and Enterprise plans)

1. Open **Customize** in the left sidebar, then the **Plugins** tab.
2. Click **Add**, choose **Add marketplace**, then **Add from a repository**.
3. Enter `thenavidm/skill-builder` and install Skill Builder from it.

The whole plugin runs in **Cowork**: the skills, the agents. In chat, on the web or in the desktop app's Chat tab, the skills run, but agents do not.

### What each tool runs

| | Claude Code | Codex | Gemini CLI | Cursor | skills CLI |
|---|---|---|---|---|---|
| Skills | yes | yes | yes | yes | yes |
| Agents | yes | no: the skill does the agent's steps itself | yes (preview) | yes | no |


Where a tool has no agents, the skills run the same steps one after another in your main conversation and reach the same result. Only the time differs.

## 3. Set up

Run `/skill setup` once in your project. It asks a short interview and writes the answers to `.agents/skill/setup.md`, which every skill reads before it starts.

| It asks | Why it matters |
|---|---|
| Which AI tools you and your users use | Checks and benchmarks run in those |
| Where your skills live: a plugin repo, a project, your user folder | Files are written there |
| The name prefix for your skills | So they never clash with another plugin's |
| Your house rules: writing style, licence, what never goes in a repo | Every skill and README follows them |
| Whether you publish, and where | So `/skill publish` follows your workflow |

`.agents/skill/setup.md` is plain Markdown in your project. Edit it by hand any time.

## 4. How a skill is built

1. **Plan.** From a goal, from what you just did (this chat, a screen recording, a pasted brief), or from example repos torn down side by side: what each does, what is missing, which skills and agents a better one needs, and which jobs code should do instead of the model.
2. **Write.** Each skill to the Agent Skills standard: a name that says what it does, a description that leads with the words people use, steps, and references loaded only when a step needs them.
3. **Check, in code.** Only the fields every tool reads, the name matching its folder, YAML that reads the same in every parser, no paths that exist in only one tool, every reference file present, and no number without a source.
4. **Test.** The same prompts with and without the skill, several runs each, graded against written assertions, with a page that shows you every output.
5. **Measure in every tool.** The same evals in Claude Code, Codex, Gemini CLI and Cursor, with tokens, time and how often the results agree.
6. **Package.** One `product.json` builds every tool's manifest, so nothing is copied by hand and nothing drifts.
7. **Learn.** Every correction you give is applied to each skill it touches, after your yes on each change, and their evals run again. A lesson that reaches beyond skills goes to your AI tool's memory instead.
8. **Prove.** Against a plain AI and against the skill you wanted to beat, on the same tasks and the same model, with the numbers in the README.

## 5. Skills

Skill Builder has 24 skills, each a folder in `skills/` with a `SKILL.md` your AI tool loads only when the job needs it. Every skill also works without agents, so results are the same in every AI tool. Skills marked **Release 1** ship first.

### Start and plan

| Skill | Command | What it does | Ships in |
|---|---|---|---|
| `skill` | `/skill` | The entry point. Routes every command, runs `setup` and `doctor`, and answers "which command do I need?" | Release 1 |
| `skill-plugin` | `/skill plugin` | A whole plugin from a goal or example repos: the skills and agents planned and written, an entry skill that routes to them, and a routing test proving each prompt reaches the right sibling in each tool | Release 1 |
| `skill-plan` | `/skill plan` | A plan from a goal or from example repos: a teardown of each, a table of what each covers, and the skills and agents a better one needs | Release 1 |
| `skill-compete` | `/skill compete` | A skill or plugin you point at, from GitHub, skills.sh, agentskills.io, your disk or pasted: taken apart, ours built from scratch, both run on the same evals with the numbers side by side, its licence read, and a check that none of its text came across | Release 1 |

### Write

| Skill | Command | What it does | Ships in |
|---|---|---|---|
| `skill-create` | `/skill create` | A skill written to the Agent Skills standard, with its steps, references and scripts, working in every tool. From a goal, this chat, a screen recording or a pasted brief: it cites where each rule came from, asks only the questions that matter, puts the skill in the right repo of yours, and runs it with and without before you see it | Release 1 |
| `skill-description` | `/skill description` | The description written and tested for triggering: prompts that should fire it and prompts that should not, run until it fires on the first and not the second | Release 1 |
| `skill-facts` | `/skill facts` | A facts registry for any skill: every claim it makes with a source and a date, and a test that blocks advice nobody can source | Release 1 |
| `skill-agents` | `/skill agents` | Agents a skill starts at a fixed step, each with its own evals, and a test that fails if an agent exists that no skill starts | Release 2 |
| `skill-from-docs` | `/skill from-docs` | An API's or a product's documentation turned into a skill, with every rule sourced | Release 2 |

### Check and test

| Skill | Command | What it does | Ships in |
|---|---|---|---|
| `skill-check` | `/skill check` | Validation in code: allowed fields, names, YAML, paths, references, sizes, numbers without a source, AI tells in the text, and portability: one tool's names or memory paths, and macOS-only commands with no Linux fallback | Release 1 |
| `skill-eval` | `/skill eval` | The same prompts with and without the skill, several runs each, graded against assertions, shown on a review page | Release 1 |
| `skill-bench` | `/skill bench` | The evals in Claude Code, Codex, Gemini CLI and Cursor, with tokens, time, cost and how often runs agree | Release 1 |
| `skill-tokens` | `/skill tokens` | What a skill or a whole plugin costs on every message, and when each skill loads | Release 1 |
| `skill-review` | `/skill review` | Any existing skill or plugin audited, scored from measured checks, with the fixes ranked | Release 2 |
| `skill-library` | `/skill library` | Every skill you have installed: overlaps, duplicates and ones that fight over the same prompts | Release 2 |

### Improve and ship

| Skill | Command | What it does | Ships in |
|---|---|---|---|
| `skill-improve` | `/skill improve` | A rewrite from eval failures and your feedback, proven on the failing case and everything that passed before | Release 1 |
| `skill-tidy` | `/skill tidy` | A skill that works but grew long, repetitive or stale, tidied without changing what it does, proven by the same eval results with fewer tokens | Release 1 |
| `skill-learn` | `/skill learn` | Corrections and lessons from this chat, a brief or a skill's recent runs, each applied to every skill it touches across your repos, sorted by how sure it is. It asks whether each is a rule for the skill or a principle for memory, shows a diff per file for your yes, bumps each skill's version, and runs the affected evals again so nothing regresses | Release 1 |
| `skill-package` | `/skill package` | One `product.json` built into the manifests for Claude Code, Codex, Gemini CLI, Cursor and the `skills` CLI, and checked in CI | Release 1 |
| `skill-repo` | `/skill repo` | A repository set up with every file a published plugin needs, its manifests built and checked, so it passes each tool's own validator from the first commit | Release 1 |
| `skill-release` | `/skill release` | The version bumped, the changelog notes moved under it, every manifest rebuilt, then the tag, the GitHub release and npm, each for your yes | Release 1 |
| `skill-publish` | `/skill publish` | A repository with a README, a description and topics people search for, a changelog, version tags and a release | Release 1 |
| `skill-convert` | `/skill convert` | A skill written for one tool made portable: tool-only paths, fields and commands replaced | Release 2 |
| `skill-update` | `/skill update` | Facts checked again and evals run again on a schedule, so a skill does not go stale, and a watch on every skill you competed with: when it changes, the comparison runs again | Release 2 |

## 6. Agents

An agent is a helper your AI tool starts for one job. It gets its own instructions and a fresh context, does the job, writes its result to a file, and reports back in a few lines. Your main conversation stays short, and several agents can work at the same time. No agent is pinned to a model: each runs on the one you already use.

1. **A skill starts it, at a fixed step.** This is the normal way. You never have to name an agent.
2. **Your AI tool starts it on its own**, when what you ask matches the agent's description.
3. **You ask for it by name.** In Claude Code you can also type `@` and pick it.

Codex has no agents in plugins, so there the skill does each agent's steps itself and writes the same file. A test fails if an agent exists that no skill starts.

### What an eval runs

```
/skill eval skills/release-notes
  reads the skill, its assertions and its prompts
  at the same time, for every prompt and every run:
    skill-executor (with the skill)       -> runs/<prompt>-with-<n>/
    skill-executor (without the skill)    -> runs/<prompt>-without-<n>/
  skill-grader                            -> grades-<date>.json
  skill-analyzer                          -> benchmark-<date>.json
  the review page
```

### The agents

| Agent | Started by | What it does that code cannot | It writes |
|---|---|---|---|
| `skill-architect` | `skill-plan`, `skill-create`, `skill-compete` | Decides which jobs need a skill, which an agent and which a script, from the goal or the example repos | `plan-<date>.md` |
| `skill-writer` | `skill-create`, `skill-improve`, `skill-learn` | Writes the skill's instructions, explaining why each step matters rather than shouting rules | the skill's files |
| `skill-executor` | `skill-eval`, `skill-bench`, `skill-compete`, `skill-learn` | Runs one prompt in a fresh context, with or without the skill, and saves everything it produced | `runs/<prompt>-<n>/` |
| `skill-grader` | `skill-eval`, `skill-bench`, `skill-compete`, `skill-learn` | Grades each output against its assertions, with a quote from the output behind every grade | `grades-<date>.json` |
| `skill-comparator` | `skill-eval`, `skill-improve`, `skill-compete` | Compares two versions' outputs without knowing which is which, and says which is better and why | `compare-<date>.json` |
| `skill-analyzer` | `skill-eval`, `skill-bench` | Finds the patterns in the results: which prompts fail, which assertions never discriminate, where runs disagree | `benchmark-<date>.json` |
| `skill-fact-checker` | `skill-create`, `skill-facts` | Lists every claim a skill makes and the source behind it, or "none" | `claims-<skill>-<date>.json` |
| `skill-reviewer` | `skill-create`, `skill-improve` | Reads a drafted skill cold, the way a model will, against its confirmed plan, and sorts what it finds into blockers, fixes and later | `review-<round>.md` |

## 7. Evidence

Every platform rule, limit and number a skill relies on lives in `facts/`, with its source, the date that source was last checked, and how strong the evidence is. A skill points at the fact; it never states an undated claim. Each release checks every source again.

| Evidence level | Means |
|---|---|
| Official, confirmed | The platform states it in its own documentation or help pages |
| Official guidance | The platform recommends it, without saying how much it matters |
| Strong study | Two or more large, independent studies point the same way |
| Single study | One study, named with its sample and its date |
| Anecdote | Practitioner reports. Shown as such, never as a rule |

A result is never stronger than the weakest fact behind it.

### The format rules it checks

Checked against each tool's own documentation on 2026-10-13.

| Rule | Why | Source |
|---|---|---|
| Skills at `skills/<name>/SKILL.md`, the name matching the folder | Some tools only look one level down | [Agent Skills specification](https://agentskills.io/specification) |
| Frontmatter uses only `name`, `description`, `license`, `compatibility`, `metadata` and `allowed-tools` | Other keys work in some tools and not others | [Agent Skills specification](https://agentskills.io/specification) |
| A description of at most 1,024 characters | The standard's limit | [Agent Skills specification](https://agentskills.io/specification) |
| Names of lowercase letters, digits and single hyphens | The one shape every tool accepts | Each tool's plugin reference |
| Agents as flat files with no pinned model | Claude Code turns subfolders into part of an agent's name and other tools do not; no two tools share model names | Each tool's agent format, as recorded in the house manifest builder |
| Each tool's own manifest | Claude Code, Codex, Gemini CLI and Cursor each read a different file | [Claude Code](https://code.claude.com/docs/en/plugins-reference), [Codex](https://developers.openai.com/codex/plugins/build), [Gemini CLI](https://geminicli.com/docs/extensions/reference), [Cursor](https://cursor.com/docs/reference/plugins), [Agent Plugins](https://agent-plugins.org/specification) |

Ask for the evidence behind anything: `/skill facts description length` or `/skill facts codex agents`.

### How Skill Builder proves itself

Every release runs the same tasks through Skill Builder, a plain AI with no plugin, and other skill-creation tools, on the same model:

1. A skill built from a described workflow.
2. One correction spread across three skills.
3. A published skill beaten.

| Measure | What it means |
|---|---|
| Valid in every tool | The created skill loads in Claude Code, Codex, Gemini CLI and Cursor |
| Triggers | Prompts that should fire it, and prompts that should not |
| Helps | The created skill's evals, with it against without it |
| Nothing broken | Other skills' evals before and after a correction |
| Tokens | What it costs on every message, and when loaded |
| Copied | Runs of eight or more words shared with the skill it beat. It should be none |

The results, with the date and the versions, go in this section at each release.

## 8. Your data

Nothing is uploaded anywhere. Evals run in your own AI tool, on your own account.

| What | Where |
|---|---|
| Your setup | `.agents/skill/setup.md` in your project |
| Plans, eval runs, grades and benchmarks | `.agents/skill/` |
| The skills you build | wherever setup says they live |

There is no telemetry and no backend of ours.

## 9. Notes and gotchas

- **Evals cost tokens.** Every prompt runs with and without the skill, several times. The skill shows the estimate first.
- **Codex has no agents in plugins.** A skill that needs an agent there does the agent's steps itself, so `skill-bench` measures both paths.
- **A description that names a phrase can make a model use it.** Descriptions are written as what the skill does and when, not as lists of forbidden words.
- **Many skills crowd the listing.** With a lot installed, a tool may shorten the descriptions it lists, so every description leads with the words people use, and `skill-tokens` shows the total.
- **A green check is not a working skill.** `skill-check` proves the shape; only `skill-eval` proves the skill does its job.

## 10. Troubleshooting

Run `/skill doctor` first. It checks Node, the scripts and which AI tools it can run, and names the fix for anything missing.

| Symptom | Cause |
|---|---|
| The skill never triggers | The description does not use the words people say. Run `/skill description` |
| It triggers on the wrong prompts | The description is too broad. The same skill narrows it and proves it |
| It works in Claude Code but not in Codex | A tool-only path, field or command. `/skill check` names it |
| A manifest is stale | It was edited by hand. Edit `product.json` and run `/skill package` |
| The skills do not appear | Restart your AI tool after installing, and check that auto-update did not leave an old version |

## 11. FAQ ❓

<details>
<summary><b>What is Skill Builder?</b></summary>

A plugin that builds agent skills and whole plugins, and proves they work. It plans them, writes them to the Agent Skills standard, checks them in code against each AI tool's own rules, tests them with and without the skill, measures them in Claude Code, Codex, Gemini CLI, Antigravity and Cursor, then sets up, packages and releases the repository.

</details>

<details>
<summary><b>What is a plugin, a skill and an agent?</b></summary>

A plugin is a bundle you install into your AI tool. A skill is a set of instructions and tools the AI tool loads only when a job needs it. An agent is a helper the AI tool can run in parallel for part of a job, such as grading outputs while others run the prompts.

</details>

<details>
<summary><b>Why doesn't my skill trigger?</b></summary>

Three causes, in the order we see them.

1. **The list of skills is full.** Claude Code fits every skill's name and description into 1% of the model's context window, and Codex into 2%. Past that, descriptions are dropped (in Claude Code, the least-used skills' first), and a skill without its description can't be matched to a request. On a 200,000-token model, one 27-skill plugin we measured needs 168% of Claude Code's budget on its own. `/skill tokens` shows what yours cost.
2. **The name says nothing.** In our tests, clear names routed every prompt to the right skill in Claude Code, Codex and Antigravity, even with vague descriptions. With vague descriptions and names like `helper-one`, routing fell to 88%, 63% and 50%.
3. **The description leads with the wrong words.** `/skill description` tests it on prompts that should fire it and prompts that shouldn't, in each tool, and rewrites it until it does.

</details>

<details>
<summary><b>How many skills can I install before they stop working?</b></summary>

There is no fixed number. It depends on the model's context window and on how long every installed description is. A model with a 1,000,000-token window has five times the room of a 200,000-token one. `/skill tokens` shows each skill's cost on every message and the whole set's share of each tool's budget, so you can see the list fill before skills go quiet.

</details>

<details>
<summary><b>I set a field in my skill and nothing changed. Why?</b></summary>

Claude Code skips a frontmatter field it doesn't know, without an error. A field no tool reads, such as `auto-activate`, or a misspelling, such as `user-invokable`, does nothing and nothing tells you. On one computer we found that misspelling in 32 skills. `/skill check` names every field no tool reads, and what to use instead.

</details>

<details>
<summary><b>How do I make a skill run only when I ask for it?</b></summary>

Each tool has its own switch: `disable-model-invocation: true` in SKILL.md for Claude Code and Cursor, and `allow_implicit_invocation: false` in `agents/openai.yaml` for Codex. Write the first; `/skill package` writes the second for you. Gemini CLI and Antigravity have no switch yet, so for them the description says when the skill is for.

</details>

<details>
<summary><b>Will a skill I wrote for Claude Code work in Codex, Gemini CLI or Antigravity?</b></summary>

Usually, as long as it avoids what only one tool has: `${CLAUDE_SKILL_DIR}`, `$ARGUMENTS`, commands that run before the skill loads, folders such as `~/.claude/`, and commands that exist on macOS only. `/skill check` finds each one and says what works everywhere. `/skill bench` then runs the skill's evals in every tool you have, so "it works in Codex too" is a number.

</details>

<details>
<summary><b>Is it safe to run the tests?</b></summary>

Each run gets its own throwaway folder and can write only there: Codex in its workspace-write sandbox, Claude Code with edits accepted, Antigravity in its accept-edits mode. Skill Builder never switches permission checks off. A run that stops because headless mode can't ask for a permission is marked blocked and left out of the numbers, so it can't pass for a failure of the skill.

The runs can see the rest of your computer. A run without the skill may find your other skills, which keeps the comparison true to what you would see.

</details>

<details>
<summary><b>How are the outputs graded, and can a grader get it wrong?</b></summary>

Code grades everything code can (a file is written, contains something, matches a pattern, is valid JSON), so those grades come out the same on every run. A model grades only what needs judgment, and its grade counts only if it quotes the output and the quote is really there. Assertions that pass as often without the skill as with it are named, because they prove nothing about the skill.

</details>

<details>
<summary><b>What does it cost?</b></summary>

Skill Builder is free and MIT licensed. The tests run in your own AI tool, on your own account, so they use its tokens. Every command that runs prompts says how many runs it will make before it starts, and a trigger test stops each run as soon as it knows which skill fired: 24 runs across three tools take about a minute.

</details>

<details>
<summary><b>Can it build a whole plugin and set up the repository?</b></summary>

Yes. `/skill plugin` plans and writes the skills, the agents and the entry skill that routes to them. `/skill repo` writes everything a published plugin needs: the README as its specification, a licence, a changelog, how to report a bug and a vulnerability, CI, search topics, and one `product.json` that builds every tool's manifest. A repository it writes passes Claude Code's, Gemini CLI's and Antigravity's own validators from the first commit.

</details>

<details>
<summary><b>How do I release an update so people actually get it?</b></summary>

Every tool decides that a copy is out of date from the version number, so a release that keeps the old number reaches no one. `/skill release` bumps the version, moves the changelog notes under it, rebuilds every manifest, then lists the tag, the push, the GitHub release and npm, each for your yes.

</details>

<details>
<summary><b>Someone sent me a skill. Can I check it before I install it?</b></summary>

Yes. `/skill check` reads it without running anything: fields that do nothing, files it points to that aren't there, commands for one system only, and secrets. Shared skill folders sometimes carry a `.env` file with live keys. Check fails that, and keys pasted into files, naming the file and the kind of key, never the key itself.

</details>

<details>
<summary><b>Does it work on Windows?</b></summary>

Its checks are plain Node and run wherever Node 22 does. Running prompts in each AI tool is tested on macOS so far, and is checked on Windows before the first release.

</details>

<details>
<summary><b>Does it send my skills anywhere?</b></summary>

No. Nothing is uploaded and there is no telemetry. Everything runs on your computer, in your own AI tool.

</details>

<details>
<summary><b>How do I remove it?</b></summary>

Uninstall the plugin in your AI tool (`claude plugin uninstall skill-builder@skill-builder` in Claude Code), and delete `.agents/skill/` if you want your setup and results gone too.

</details>

## Versions

See [CHANGELOG.md](CHANGELOG.md).

## Questions

Run into a problem or have a question? [Open an issue](https://github.com/thenavidm/skill-builder/issues) and I will help.

## About the author

Navid Moazzez is a leading AI business strategist, and the host of the AI Creator Summit, watched by 100,000+ creators. He helps creators and founders master AI and build their own AI Operating System (AI OS) to automate their business and life. He creates useful free tools, MCP servers and CLIs that creators and founders can use in their own workflows.

**Links**

- Personal website: [navid.me](https://navid.me)
- Link in bio: [navid.bio](https://navid.bio)
- Navid Media: [navid.media](https://navid.media)
- YouTube: [@thenavidm](https://youtube.com/@thenavidm?sub_confirmation=1) and [@thenavidai](https://youtube.com/@thenavidai?sub_confirmation=1)
- X: [@thenavidm](https://x.com/thenavidm)
- Instagram: [@thenavidm](https://instagram.com/thenavidm)
- LinkedIn: [thenavidm](https://linkedin.com/in/thenavidm)

## License

[MIT](./LICENSE). Free to use, modify, and share.

Not affiliated with, endorsed by, or connected to Anthropic, OpenAI, Google, Cursor, or any other company named here. Their names identify the services this works with.

---

© 2026 Skill Builder™ is a trademark of [Navid Media](https://navid.media). All rights reserved. Made with ❤️ by [Navid Moazzez](https://navid.me).
