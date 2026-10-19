---
name: skill-release
description: Releases a new version that reaches every user, moving version, changelog and manifests together, then tag, GitHub and npm, each after a yes. Runs only when asked by name.
disable-model-invocation: true
---

# Release a version

Every AI tool decides that someone's copy is out of date from the version number, so a release that keeps the old number reaches nobody. This moves the version, the notes and every manifest together, then takes each step that reaches a live system only after a yes.

The engine runs as `npx -y @thenavidm/skill-builder@latest`; in the Skill Builder repository, `node bin/skill-builder.mjs`.

## 1. The notes

```bash
npx -y @thenavidm/skill-builder@latest changelog <plugin>
```

It lists the commits since the last release next to what the changelog's Unreleased section says. Write anything missing into Unreleased, as what users can do now and whether they need to do anything, not what the code did. Get their yes on the wording.

## 2. Before releasing

`check`, `package --check` and the tests must pass. A release with a failing check ships the failure to everyone.

## 3. The version

Ask which kind: a fix (patch), something new that changes nothing they rely on (minor), or something that changes how they use it (major). Show the result first:

```bash
npx -y @thenavidm/skill-builder@latest release <plugin> --bump minor --dry
```

Then without `--dry`. It bumps `package.json`, moves the notes under the new version with the date, and rebuilds every manifest.

## 4. The live steps, one yes each

It lists them in order: commit, tag, push, the GitHub release with this version's notes, and npm if the package is public. Show each, get a yes, run it, confirm it worked, then the next. Never run them as one batch.

## 5. Make sure it arrives

Remind them how updates reach each tool: Claude Code needs auto-update on for the marketplace; Codex needs `codex plugin marketplace upgrade`; Gemini CLI updates on its own when installed with `--auto-update`. The engine through `npx @latest` is always current.
