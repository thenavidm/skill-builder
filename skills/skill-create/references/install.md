# Installing

Read this at step 11.

## Where

| Choice | Folder | Works |
|---|---|---|
| Their user folder | Claude Code `~/.claude/skills/<name>/`; Codex, Antigravity and Cursor `~/.agents/skills/<name>/`; Gemini CLI `~/.gemini/skills/<name>/` | Across all their projects on this machine, in that tool |
| This project | `.claude/skills/<name>/` for Claude Code, `.agents/skills/<name>/` for the others | In this project, for everyone who works in it |
| A plugin | `skills/<name>/` in the plugin repository, then `skill package` | Wherever the plugin is installed |

Recommend their user folder when the skill captures their personal way of working (their voice, their routines), the project for a skill about the project (its conventions), a plugin for a skill other people will install. Install into each tool they named in setup.

## Replacing a skill that's already there

1. Show what's in the existing skill and ask: replace it, or give the new one another name?
2. Before replacing, copy the whole old folder to `.agents/skill/history/<name>/<date-and-time>/`, and confirm the copy matches.
3. Remove the old folder, then copy the new one into its place. Copying over the old folder would leave its stale files behind.

## Confirm it landed

List the files in the draft and in the installed folder: the two lists must be the same. Then compare each file's content. A copy command saying it worked isn't proof. Write the installed list and the result in the log.

## Putting the old one back

If the new skill turns out worse, copy the saved version from `.agents/skill/history/<name>/<date-and-time>/` back the same way: remove, copy whole, confirm.
