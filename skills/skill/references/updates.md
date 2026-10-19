# Keeping Skill Builder up to date in each tool

A release only reaches someone whose tool updates the plugin. Each tool does it differently, so check the one they use.

| Tool | How updates arrive | What to do |
|---|---|---|
| Claude Code | In the background, for a marketplace with auto-update on | `/plugin`, choose the marketplace, turn auto-update on. Off is the default for marketplaces Anthropic doesn't run |
| Codex | Only when someone runs the upgrade | `codex plugin marketplace upgrade`, or schedule it daily |
| Gemini CLI | Automatically, when installed with `--auto-update` | Reinstall with `gemini extensions install <repository> --auto-update` if it wasn't |
| Antigravity | By reinstalling | `agy plugin install <repository>` again |
| Cursor | A copied folder doesn't update | Copy the newer release over it, or schedule that |
| The engine | Always the newest | `npx -y @thenavidm/skill-builder@latest` fetches the latest release on every run |

The engine is the part that changes most, and it is always current. The skills change with each plugin release.
