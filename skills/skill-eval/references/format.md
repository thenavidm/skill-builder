# The eval format

`evals/evals.json` in the skill's folder:

```json
{
  "evals": [
    {
      "name": "note-meeting-moved",
      "prompt": "Write NOTE.md telling the team the review moved from 2026-11-03 to 2026-11-10.",
      "files": ["files/agenda.md"],
      "assertions": [
        { "name": "NOTE.md is written", "file": "NOTE.md" },
        { "name": "dates as day month year", "file": "NOTE.md", "matches": "\\b10 November 2026\\b" },
        { "name": "reads as one clear sentence", "judge": "The note is a single clear sentence." }
      ]
    }
  ]
}
```

| Assertion field | Passes when |
|---|---|
| `"file"` alone | that file was written |
| `"contains"`, `"notContains"` | the file (or the answer, with `"answer": true`) has, or lacks, the text |
| `"matches"`, `"flags"` | the regular expression matches |
| `"json": true` | the file is valid JSON |
| `"maxWords"` | within that many words |
| `"judge"` | a model agrees and quotes the part of the output that shows it; the quote is checked |

Code checks come out the same every run; use them wherever they can say what matters. A judge is for what needs judgment, written as one clear statement.

What makes a test prove something:

- Every promise the skill makes has a task.
- At least one assertion per task fails without the skill.
- Assertions check outcomes, not wording.
- Inputs are real (with private details changed), because real inputs carry the mess a skill must handle.

`"allow": ["Bash(node:*)"]` lets a run use a tool without asking, when the skill runs a script.
