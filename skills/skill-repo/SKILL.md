---
name: skill-repo
description: Sets up a plugin repository with its README as the spec, licence, changelog, CI, topics and one product.json for every tool's manifest. Use when starting a plugin repo.
---

# Set up a plugin repository

A plugin repository that passes every tool's validator from the first commit saves a week of small failures later.

The engine runs as `npx -y @thenavidm/skill-builder@latest`. Where `skill-builder` is installed (`npm install -g @thenavidm/skill-builder`), run `skill-builder` instead: it's the same engine, without the download.

## 1. The profile

Ask what you can't read from the project or `.agents/skill/setup.md`, one question at a time, and write `profile.json`:

| Field | Ask for |
|---|---|
| `name`, `displayName` | The plugin's name, lowercase with hyphens, and how people write it |
| `description` | One line: what it is, for whom, then the words people search for. It becomes the README's first line and the repository's description, in the same words |
| `keywords` | What people type to find it; they become the search topics |
| `prefix` | One short word every skill's name starts with, so it can't clash with another plugin |
| `author` | Name and web address. Never an email address in a public repository: it gets scraped |
| `repository` | owner/name on GitHub |
| `licence` | MIT unless they say otherwise |
| `pullRequests` | Whether to accept them; by default issues are welcome and pull requests are not |

## 2. Write it

Show what it will write first with `--dry`, then:

```bash
npx -y @thenavidm/skill-builder@latest repo new <folder> --profile profile.json
```

It never overwrites a file that's already there and says which it kept. It builds every tool's manifest and runs `check`.

## 3. Prove it

```bash
npx -y @thenavidm/skill-builder@latest install <folder>
```

Each tool's own validator should pass. Two warnings are expected and right: the root `AGENTS.md` and `CLAUDE.md` guide people working on the repository and aren't plugin content.

## 4. What to fill in

The README is the specification: the parts left as comments (a real example, what you can ask it, the data it keeps) are theirs to write before the first release. Then `skill-plugin` or `skill-create` builds the skills, and `skill-publish` puts it on GitHub.
