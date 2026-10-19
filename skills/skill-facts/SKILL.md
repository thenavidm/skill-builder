---
name: skill-facts
description: Gives every claim in a skill a source and a checked date, and removes advice nobody can source. Use before publishing a skill that gives advice or numbers.
---

# Facts with sources

A skill that tells the model "posts with links get less reach" or "the limit is 2,200 characters" is only as good as the day that was true. This finds each claim, sources it, dates it, and moves it into a registry the skill points at, so one refresh updates every skill that uses it.

## 1. Find the claims

Read the skill and its references. A claim is anything that could be checked and could change: a number, a limit, a format, a platform's behaviour, a "best practice". List each with where it sits.

The `skill-fact-checker` agent can do steps 1 and 2 in a fresh context and write the list.

## 2. Source each one

For each, find the best source and record how strong it is:

| Level | When |
|---|---|
| official-confirmed | The platform states it in its own documentation |
| official-guidance | The platform recommends it |
| strong-study | Two or more independent, large measurements agree |
| single-study | One measurement, named with its sample |
| anecdote | A secondary source, or practitioner reports |

Open each source and confirm it says what the claim says before you record it. A link you didn't read isn't a source. Record the address and today's date as `checked`.

## 3. The registry

Write the facts to `facts/<topic>.json` in the skill or plugin: one entry per claim with `id`, the `claim` in plain words, a machine-readable `value` when there is one, the `evidenceLevel`, and `sources` with `url`, `title` and `checked`. In the skill, say the claim and name the fact's id, so the next refresh knows where it's used.

## 4. What has no source

A claim you couldn't source either comes out of the skill or is reworded as what it is ("some practitioners report..."). Never raise a claim's level because it's useful. Report the list: sourced, reworded, removed.

## Refreshing

When a skill is about to be released, open every source again. A source that changed means the claim, and every skill that names it, changes too.
