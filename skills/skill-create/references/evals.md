# Writing the tests

Read this at step 5. The tests are written before the skill, so the skill is written to pass them rather than the tests to fit the skill.

## evals/evals.json

```json
{
  "evals": [
    {
      "name": "notes-from-three-prs",
      "prompt": "Write the release notes for 2.4.0 from prs.json, as RELEASE_NOTES.md.",
      "files": ["files/prs.json"],
      "assertions": [
        { "name": "the notes are written", "file": "RELEASE_NOTES.md" },
        { "name": "grouped as New, Fixed, Changed", "file": "RELEASE_NOTES.md", "matches": "^## (New|Fixed|Changed)", "flags": "m" },
        { "name": "no pull request numbers", "file": "RELEASE_NOTES.md", "notContains": "#1" },
        { "name": "reads like news for users, not a commit log", "judge": "The notes tell a user what changed for them, not what the code did." }
      ]
    }
  ]
}
```

- `name`: in lowercase, with hyphens between words, saying what the task tests.
- `prompt`: what a real person would type, with the context they'd give.
- `files`: real inputs, kept in `evals/files/`. They are copied into each run's folder. Never put private data in them: use a real input with names and numbers changed.
- `allow`: tools a run may use without asking, such as `"Bash(node:*)"`, when the skill runs a script.

## Assertions

| Field | Passes when |
|---|---|
| `"file": "x"` alone | the run wrote `x` |
| `"contains"` / `"notContains"` | the file (or the answer, with `"answer": true`) has, or doesn't have, this text |
| `"matches"`, `"flags"` | a regular expression matches |
| `"json": true` | the file is valid JSON |
| `"maxWords"` | it stays within that many words |
| `"judge"` | a model, reading the output, agrees with the statement and quotes the part that shows it |

Prefer code checks: they come out the same every time. Use a judge only for what needs judgment (tone, whether it answers the question), and phrase it as one clear statement.

## Tests that prove something

- **Each core promise gets a task.** A promise no task exercises is a promise nobody checked.
- **At least one assertion per task should fail without the skill.** The eval reports assertions that pass as often without it: those prove nothing and need sharpening.
- **Assert outcomes, not wording.** "Grouped as New, Fixed, Changed" survives a rewrite of the skill; "starts with the words 'Here are'" doesn't.
- **Use the real input.** One real case beats three invented ones, because real inputs have the mess the skill must handle.

## evals/triggers.json

```json
[
  { "prompt": "we're tagging v2.4 tomorrow, can you put together release notes from the merged PRs?", "should": true },
  { "prompt": "summarise the discussion on this pull request so I can review it", "should": false }
]
```

8 to 10 that should fire, said the different ways people say things: casual, formal, with typos, without naming the skill. 8 to 10 near misses that share its words but need something else. An obviously unrelated prompt tests nothing. For a plugin, use `"expect": "<skill-name>"` instead of `should`, to test which sibling each prompt reaches.
