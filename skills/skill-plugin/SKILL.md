---
name: skill-plugin
description: Builds a whole plugin, its skills, agents and an entry skill, and proves each request reaches the right skill in every tool. Use for "build me a plugin for X".
---

# Build a plugin

A plugin is several skills that have to work together: each must fire on its own requests and not steal its siblings', the whole set must fit in every tool's skill list, and it must install everywhere from one source.

The engine runs as `npx -y @thenavidm/skill-builder@latest`. Where `skill-builder` is installed (`npm install -g @thenavidm/skill-builder`), run `skill-builder` instead: it's the same engine, without the download.

## 1. Plan

Use `skill-plan`, which starts the `skill-architect` agent: the jobs, what exists, which jobs are skills, agents or scripts, the routing prompts. Get their yes on the plan first.

## 2. The repository

Use `skill-repo` to set it up (or work in theirs if it exists). Every skill name starts with the plugin's prefix, and the entry skill is named after it.

## 3. The skills

Build each with `skill-create`, starting with the entry skill and the most-used job. The plan is the brief, so most interviews are short. Agents go in `agents/<name>.md` as flat files, with no model pinned, each started by a skill at a fixed step, and each job written so the skill can do it itself in tools without agents.

Write the entry skill last of all, once the others exist: a table from what people say to the skill that does it, plus setup and a health check.

## 4. Prove it works as a plugin

```bash
npx -y @thenavidm/skill-builder@latest check <plugin>
npx -y @thenavidm/skill-builder@latest tokens <plugin>
npx -y @thenavidm/skill-builder@latest trigger <plugin> --set evals/triggers.json --runs 3
npx -y @thenavidm/skill-builder@latest install <plugin>
```

- `check` finds nothing blocking across every skill and agent.
- `tokens` shows the plugin's share of each tool's skill list; over 100% on the models their users run means some skills will go quiet. Shorten descriptions, or let the entry skill route to skills that only run when asked.
- `trigger` with an `expect` for each prompt is the routing test: every prompt must reach the right sibling in each tool. A prompt that lands on a sibling means two descriptions overlap; add a boundary to each.
- `install` runs each tool's own validator and loads the plugin to run its entry skill.

Then `eval` (or `bench`) each skill.

## 5. Ship

`skill-package` builds every tool's manifest from `product.json`, `skill-release` makes the version, `skill-publish` puts it on GitHub, each with their yes for anything that reaches a live system.
