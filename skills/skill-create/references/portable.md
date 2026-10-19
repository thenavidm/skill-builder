# Working in every tool

Read this when a skill needs something only one AI tool has. `skill check` finds each of these; this is what to write instead.

| Only in Claude Code | Elsewhere it | Write instead |
|---|---|---|
| `${CLAUDE_SKILL_DIR}/references/x.md` | stays as text, so the file isn't found | `references/x.md`, a path relative to the skill folder |
| `$ARGUMENTS`, `$0`, `$1` | stays as text | Keep it for Claude Code if useful, and also say in words: "use what the user asked for" |
| `!`command`` before the skill loads | is shown, not run | A first step: "Run `command` and use its output" |
| `context: fork`, `agent:` | is ignored | Steps the main conversation can follow too; an agent only speeds it up |
| `~/.claude/...` paths | don't exist | The project's own files, or ask where the thing lives |

Other things that work in one place only:

- **macOS-only commands** (`open`, `pbcopy`, `osascript`, `sed -i ''`): name the Linux and Windows equivalent, or use a small script that works on all three.
- **One tool's question box** (such as Claude Code's): "ask the user, giving the options" works in every tool.
- **Agents**: Codex runs none from a plugin. Write every agent's job so the skill can do it itself in order, and the result is the same, only slower.

Fields some tools read and others skip are safe to include: tested on 19 October 2026 in Claude Code, Codex and Antigravity, a skill with extra fields still loads in all three. A field no tool reads (`auto-activate`, `triggers`, a misspelled `user-invokable`) does nothing at all, silently. `skill check` names them.
