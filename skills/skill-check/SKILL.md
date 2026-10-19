---
name: skill-check
description: Checks a skill or plugin against every AI tool's rules, in code, and explains each fix. Use when a tool won't load a skill, or before installing one someone sent.
---

# Check a skill or plugin

Run the check, then explain what it found in plain words and fix what they want fixed. The check reads files only; it never runs anything in the skill, so it's safe on a skill someone sent them.

```bash
npx -y @thenavidm/skill-builder@latest check <skill-folder-or-plugin>
```

(In the Skill Builder repository itself: `node bin/skill-builder.mjs check <path>`.)

Every finding names the fact it rests on and when that fact was last checked against the tool's own documentation or a real test.

## Reading the result

| Level | Means | Do |
|---|---|---|
| error | A tool will refuse or misread the skill | Fix it |
| warning | It loads, but part of it does nothing, or works in one tool only | Fix it, or note why it stays |
| note | Worth knowing, nothing broken | Mention it if it matters to them |

## The findings people meet most

| Finding | What happened | The fix |
|---|---|---|
| `field-unread` | A field no tool reads, so it silently does nothing (`auto-activate`, a misspelled `user-invokable`) | Use the field the message names, or move the value under `metadata` |
| `name-folder` | The name and its folder differ; some tools look a skill up by one, some by the other | Rename one to match |
| `listing-cut` | The description and `when_to_use` are so long that Claude Code cuts the end | Put the most important words first and shorten |
| `yaml-unquoted` | A value holds ": " without quotes; the tools tested load it, a strict YAML reader doesn't | Wrap the value in double quotes |
| `missing-reference`, `missing-path` | The skill points at a file that isn't there | Add the file or remove the pointer |
| `plugin-root-reference`, `outside-skill` | A file outside the skill's folder; it works when the whole plugin installs, not where skills install one by one | Move the file into the skill's folder |
| `claude-skill-dir`, `claude-arguments`, `claude-injection`, `tool-path` | A feature or folder only Claude Code has | Use the plain fallback in the message, so other tools follow it too |
| `mac-only` | A command that exists on macOS only | Offer the Linux and Windows equivalent |
| `secret`, `secret-file` | A key, or a `.env` file, in what ships | Remove it, rotate the key now, and have the skill read keys from the user's environment |
| `risky-surface` | A script can reach the network, delete, run programs or read keys | Tell the user what it does and get their yes, or remove it |
| `long`, `heavy` | Over 500 lines or about 5,000 tokens of instructions | Move detail into `references/` |

## Fixing

Show each fix before you make it, grouped by file, and make them once they agree. Then run the check again and report the new result. For a skill they didn't write, suggest the fixes and leave the files alone unless they ask.
