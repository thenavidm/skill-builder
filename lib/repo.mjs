/**
 * A new plugin repository with everything a release needs, from one profile.
 *
 * The files are the ones a published plugin can't do without: the README
 * written as the specification, a licence, a changelog, how to report a bug
 * and a vulnerability, one document for agents working on the repo, CI that
 * checks the skills and the manifests, the search topics, product.json (the one
 * source for every tool's manifest) with its own copy of the builder, and an
 * entry skill that routes to the rest. An existing file is never overwritten:
 * the result says which were written and which were kept.
 */
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const NAME = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * Checks and completes a profile.
 * @param {object} p name, displayName, description, keywords, author { name, url }, repository
 *   (owner/name on GitHub), prefix (one short word every skill name starts with), licence (default
 *   MIT), entry (the entry skill's name, default: the prefix), pullRequests (default false: issues
 *   welcome, pull requests not)
 */
export function profile(p) {
  const problems = [];
  if (!p.name || !NAME.test(p.name)) problems.push("name: lowercase letters, digits and single hyphens, such as release-kit");
  if (!p.displayName) problems.push("displayName: the name people read, such as Release Kit");
  if (!p.description || p.description.length < 40) problems.push("description: one line, what it is and for whom, then the words people search for (40 characters or more)");
  if (!p.author?.name) problems.push("author.name");
  if (!p.repository || !/^[\w.-]+\/[\w.-]+$/.test(p.repository)) problems.push("repository: owner/name on GitHub");
  // every skill and agent name starts with the prefix, so two plugins installed together can't clash
  if (!p.prefix || !/^[a-z0-9]+$/.test(p.prefix)) problems.push("prefix: one short word every skill's name starts with, lowercase letters and digits, such as seo or video");
  if (problems.length) throw new Error(`The profile needs: ${problems.join("; ")}`);
  const prefix = p.prefix;
  return {
    licence: "MIT",
    keywords: [],
    pullRequests: false,
    ...p,
    prefix,
    entry: p.entry ?? prefix,
    year: p.year ?? new Date().getUTCFullYear(),
  };
}

const gh = (p) => `https://github.com/${p.repository}`;

export function readme(p) {
  const owner = p.repository.split("/")[0];
  return `# ${p.displayName}

${p.description}

> **Not published yet.** This README is the specification for the first release: every skill and agent below is built to it, and each one ships only after it passes its evals. What is built so far is in the [changelog](CHANGELOG.md).

<!-- A short, concrete example of it working goes here: a prompt and what came back. It tells a reader more than a feature list. -->

Built by [${p.author.name}](${p.author.url ?? gh(p)}).

## Contents

| # | Section | What it covers |
|---|---|---|
| 1 | [What you can ask it](#1-what-you-can-ask-it) | Real prompts, not features |
| 2 | [Install](#2-install) | Every AI tool, copy and paste |
| 3 | [Skills](#3-skills) | Every skill, and when it runs |
| 4 | [Your data](#4-your-data) | What is stored, and where |
| 5 | [Troubleshooting](#5-troubleshooting) | Symptom and cause |

## 1. What you can ask it

<!-- Five to ten things a real person would type, in their words. -->

## 2. Install

**Claude Code**

\`\`\`bash
claude plugin marketplace add ${p.repository}
claude plugin install ${p.name}@${p.name}
\`\`\`

Turn on auto-update in \`/plugin\` so new releases reach you.

**Codex**

\`\`\`bash
codex plugin marketplace add ${p.repository}
codex plugin add ${p.name}@${p.name}
\`\`\`

**Gemini CLI**

\`\`\`bash
gemini extensions install ${gh(p)} --auto-update
\`\`\`

**Antigravity**

\`\`\`bash
agy plugin install ${gh(p)}
\`\`\`

**Cursor**

Copy the repository folder to \`~/.cursor/plugins/local/${p.name}\` and run **Developer: Reload Window**.

**Any tool the \`skills\` CLI supports**, the skills only:

\`\`\`bash
npx skills add ${p.repository}
\`\`\`

## 3. Skills

| Skill | What it does |
|---|---|
| \`${p.entry}\` | The entry point: routes any request to the right skill |

## 4. Your data

<!-- What the plugin stores, where, and what (if anything) leaves the user's computer. -->

## 5. Troubleshooting

| Symptom | Cause |
|---|---|
| The skills do not appear | Restart your AI tool after installing |

## Questions

Run into a problem or have a question? [Open an issue](${gh(p)}/issues) and I will help.

## License

${p.licence === "MIT" ? "[MIT](./LICENSE). Free to use, modify, and share." : `See [LICENSE](./LICENSE).`}

<!-- ${owner}: keep the README's first line and the GitHub description in the same words. -->
`;
}

export function licence(p) {
  if (p.licence !== "MIT") return null;
  return `MIT License

Copyright (c) ${p.year} ${p.author.name}

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
`;
}

const changelog = () => `# Changelog

Newest first. Every version has a git tag and a GitHub release.

## Unreleased

- The README, which is the specification for the first release.
`;

const contributing = (p) =>
  p.pullRequests
    ? `# Contributing

Issues and pull requests are both welcome. For anything larger than a small fix, open an issue first so we can agree on the approach before you spend time on it.

[Open an issue](${gh(p)}/issues).
`
    : `# Contributing

Issues are welcome: a bug report with the steps to reproduce it is the most useful thing you can send. [Open an issue](${gh(p)}/issues).

Pull requests are not accepted. Every skill here ships only after its evals pass in each AI tool it supports, and a change from outside has to go through the same runs, which takes longer to review than to write. A clear issue gets the fix in faster.
`;

const security = (p) => `# Security

## Reporting a vulnerability

[Report it privately](${gh(p)}/security/advisories/new). Please do not open a public issue for a security problem: an issue is visible to everyone the moment you file it, including whoever would use the bug.

Research in good faith is welcome. Test only against your own installation and your own data.
`;

const agents = (p) => `# Working on ${p.displayName}

For agents editing this repository. Users read the README.

The README is the specification for the first release. The repo is the whole product: a plugin for every AI tool it lists, built from one source.

## Layout

\`\`\`
skills/<name>/SKILL.md   one folder per skill, Agent Skills fields only
agents/<name>.md         flat files, no pinned model
product.json             the one source for every tool's manifest; never edit a generated one
scripts/manifests/       builds every manifest from product.json
\`\`\`

## Rules

- Branch per change. Never commit to \`main\` directly, never force-push.
- Never invent a number, a test result or a capability. "Not measured" is a valid answer.
- After changing a skill or product.json, run \`node scripts/manifests/build.mjs\` and commit the result.

## Before claiming it works

\`\`\`bash
node scripts/manifests/build.mjs --check
\`\`\`

A green check is not a working product. Run each skill's evals, and its task on a real example, before it ships.
`;

const claudeMd = () => `# CLAUDE.md

See [AGENTS.md](./AGENTS.md). One document, so the two cannot drift.
`;

const gitignore = () => `node_modules/
.DS_Store
.env
.env.*
*.log
coverage/
# skill-builder's eval and benchmark runs
.agents/skill/runs/
`;

const ci = () => `name: CI

on:
  push:
    branches: [main]
  pull_request:
  workflow_dispatch:

jobs:
  check:
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      # Every tool's manifest is built from product.json, so a hand edit to one,
      # or a skill another tool would reject, fails here instead of in an install.
      - run: node scripts/manifests/build.mjs --check
`;

const product = (p) => ({
  $comment: "The one source for every AI tool's manifest. Edit it here, then run `node scripts/manifests/build.mjs`. The version always comes from package.json.",
  name: p.name,
  displayName: p.displayName,
  description: p.description,
  shortDescription: p.shortDescription ?? p.displayName,
  author: { name: p.author.name, ...(p.author.url ? { url: p.author.url } : {}) },
  homepage: gh(p),
  repository: gh(p),
  license: p.licence,
  keywords: p.keywords,
  category: p.category ?? "Developer Tools",
  prefix: p.prefix,
  marketplace: { name: p.name, displayName: p.displayName, description: `The ${p.displayName} plugin.` },
});

const pkg = (p) => ({
  name: p.npmName ?? p.name,
  version: "0.0.1",
  private: true,
  description: p.description,
  type: "module",
  license: p.licence,
  author: p.author.url ? `${p.author.name} (${p.author.url})` : p.author.name,
  homepage: gh(p),
  repository: { type: "git", url: `git+${gh(p)}.git` },
  bugs: { url: `${gh(p)}/issues` },
  engines: { node: ">=22" },
  scripts: { "build:manifests": "node scripts/manifests/build.mjs", "check:manifests": "node scripts/manifests/build.mjs --check" },
  keywords: p.keywords,
});

const entrySkill = (p) => `---
name: ${p.entry}
description: The entry point to ${p.displayName}. Use when the user asks for anything ${p.displayName} does and it isn't clear which of its skills fits, or asks what it can do.
---

# ${p.displayName}

Find out what the user wants done, then hand it to the skill that does it. If none fits, say what ${p.displayName} can do instead of guessing.

## Skills

| Ask | Skill |
|---|---|
<!-- One row per skill as each one is added: what the user says, and the skill that does it. -->
`;

/** Every file a new plugin repository starts with, as [path, contents]. */
export function files(p) {
  const json = (v) => `${JSON.stringify(v, null, 2)}\n`;
  return [
    ["README.md", readme(p)],
    ["LICENSE", licence(p)],
    ["CHANGELOG.md", changelog(p)],
    ["CONTRIBUTING.md", contributing(p)],
    ["SECURITY.md", security(p)],
    ["AGENTS.md", agents(p)],
    ["CLAUDE.md", claudeMd(p)],
    [".gitignore", gitignore(p)],
    [".github/topics", p.keywords.length ? `${p.keywords.join("\n")}\n` : null],
    [".github/workflows/ci.yml", ci(p)],
    ["product.json", json(product(p))],
    ["package.json", json(pkg(p))],
    [`skills/${p.entry}/SKILL.md`, entrySkill(p)],
  ].filter(([, text]) => text !== null);
}

/**
 * Writes the repository. Never overwrites: an existing file is kept and named.
 * @returns {{ root: string, written: string[], kept: string[] }}
 */
export function scaffold(target, input, { dry = false } = {}) {
  const p = profile(input);
  const root = resolve(target);
  const out = { root, written: [], kept: [] };
  const write = (rel, text) => {
    const file = join(root, rel);
    if (existsSync(file)) return out.kept.push(rel);
    out.written.push(rel);
    if (dry) return;
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, text);
  };
  for (const [rel, text] of files(p)) write(rel, text);
  // the repo carries its own builder, so its checks run offline and in CI with nothing installed
  for (const f of ["build.mjs", "frontmatter.mjs"]) {
    const rel = `scripts/manifests/${f}`;
    const file = join(root, rel);
    if (existsSync(file)) {
      out.kept.push(rel);
      continue;
    }
    out.written.push(rel);
    if (!dry) {
      mkdirSync(dirname(file), { recursive: true });
      copyFileSync(join(HERE, "..", "scripts", "manifests", f), file);
    }
  }
  return out;
}

/**
 * The commands that put the repository on GitHub, in order. Each one reaches a
 * live system, so the skill shows them and runs each only after a yes. Private
 * first: a public push is indexed at once.
 */
export function publishSteps(input) {
  const p = profile(input);
  return [
    { what: "Create the repository, private, with the description", run: `gh repo create ${p.repository} --private --description ${JSON.stringify(p.description)} --source . --push` },
    ...(p.keywords.length ? [{ what: "Set the search topics", run: `gh repo edit ${p.repository} ${p.keywords.map((k) => `--add-topic ${k}`).join(" ")}` }] : []),
    { what: "Turn on private vulnerability reporting, so SECURITY.md's link works", run: `gh api -X PUT repos/${p.repository}/private-vulnerability-reporting` },
    { what: "Make it public, once you have checked it", run: `gh repo edit ${p.repository} --visibility public --accept-visibility-change-consequences` },
    { what: "Tag and publish the first release", run: `gh release create v0.1.0 --repo ${p.repository} --title v0.1.0 --notes-file CHANGELOG.md` },
  ];
}
