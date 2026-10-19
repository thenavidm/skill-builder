---
name: skill-plan
description: Plans a skill or plugin before building, deciding which jobs need a skill, an agent or a script, from a goal or example repos. Use for "plan a plugin for X".
---

# Plan before building

The most expensive mistake is building the wrong set of skills. This decides what to build and why, from the job and from what already exists.

The engine runs as `npx -y @thenavidm/skill-builder@latest`; in the Skill Builder repository, `node bin/skill-builder.mjs`.

## 1. The jobs

List what people will ask it to do, in their words, ten to twenty requests. Group them into jobs. A job that one request names and another never touches is probably its own skill.

## 2. What exists

For each example repository or skill they point at: what it does, its strengths, where it stops, its licence. Run `check` and `tokens` on each. Put them side by side in a table: job by job, who covers it, how well. Strengths of theirs that ours would lack are gaps in the plan.

## 3. Skill, agent or script

| Use | When |
|---|---|
| A skill | A job a person asks for, needing judgment |
| A step inside a skill | Part of a bigger job, never asked for alone |
| An agent | Work that runs in parallel or needs a fresh context: grading, reviewing, research |
| A script | Counting, checking, converting, calling an API the same way every time |
| Nothing | The model does it well already |

## 4. Cost and routing

Every skill that starts on its own costs context on every message, and similar skills steal each other's prompts. Count the planned skills' descriptions against the budget with `tokens` once drafted. Plan one entry skill that routes, keep the rest specific, and plan the routing test (`evals/triggers.json` with an `expect` for each prompt) before writing any skill.

## 5. The plan

Write `.agents/skill/plan-<date>.md`: the jobs, the comparison table, each planned skill with its name, one-line description and why it exists, the agents and scripts, what's deliberately left out, the routing prompts, and the order to build them (the entry skill and the most-used job first). Show it and get their yes before `skill-plugin` or `skill-create` builds anything.
