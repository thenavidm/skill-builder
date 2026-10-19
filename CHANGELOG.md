# Changelog

Newest first.

## Unreleased

## 0.1.1, 2026-10-19

- **Install covers every tool, and updating too.** The README's install section adds ChatGPT and the Codex app, a terminal install of the engine from npm, Antigravity in the table of what each tool runs, and a table of how to update and remove Skill Builder in each tool.
- **`--help` never runs a command.** `skill-builder release --help` used to start a release. Help and `--version` now print and stop, whatever command comes before them.

## 0.1.0, 2026-10-19

- **The engine works.** Nine commands, each tested on real AI tools: `check` (every tool's rules, secrets included, each backed by a dated source), `tokens` (what your skills cost on every message, against each tool's budget), `trigger` (does the right skill fire, in Claude Code, Codex and Antigravity), `package` (one source into every tool's manifest, and Codex's "only when asked" file), `repo` (a new plugin repository that passes every tool's validator), `eval` and `bench` (with and without the skill, graded, with a review page), `install` (each tool's own validator, then the plugin loaded and run), `overlap` (proof nothing was copied), and `release` with `changelog`.
- **Plugins, not only skills.** Three more skills in the specification: `/skill plugin` for a whole plugin, `/skill repo` for the repository around it, `/skill release` for an update that reaches every user. 23 skills in all.
- **A FAQ that answers what goes wrong,** with what we measured: why skills stop triggering, how many fit, fields that silently do nothing, running only when asked, every tool, and safety and cost.

### Added

- `skill-learn`: a correction or lesson applied to every skill it touches, sorted by how sure it is, rule-or-memory asked for each, a diff per file for your yes, versions bumped, and the affected evals run again.
- `skill-compete`: a skill you point at taken apart, ours built from scratch, both run on the same evals, its licence read, and a check that none of its text came across.
- `skill-create` from this chat, a screen recording or a pasted brief, citing where each rule came from and tested with and without before you see it. `skill-check` gains portability: one tool's names or memory paths, and macOS-only commands with no Linux fallback. `skill-update` watches every skill you competed with.
- How Skill Builder proves itself: the same tasks against a plain AI and other skill-creation tools, measured. 20 skills, 7 agents.

### Changed

- The title, the README's first line, the GitHub description and every manifest now say the same thing in the same words: a plugin and skills for Claude Code, Codex and AI agents.

### Added

- Antigravity: install steps for the Antigravity CLI and app, and Antigravity named wherever the README lists the AI tools it works in.
- The README, which is the specification for the first release: every skill and agent, how each one starts, the evidence rules, and install steps for Claude Code, Codex, Gemini CLI, Cursor and the `skills` CLI.
- Every AI tool's manifest, built from `product.json` by `scripts/manifests/build.mjs` and checked in CI, with no MCP server, since there is nothing to connect.
- The house files: licence, security policy, contributing notes, `AGENTS.md` and the GitHub topics.

