# Changelog

Newest first.

## Unreleased

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
