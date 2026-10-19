---
name: skill-package
description: Rebuilds every AI tool's plugin manifest (plugin.json and the rest) from one product.json and checks none has drifted. Use after adding or changing skills. Not for building a plugin (skill-plugin).
---

# Package for every tool

Each tool reads its own manifest file. Written by hand they drift: a new skill shows in one tool and not another, a version bumps in one place only. Built from `product.json` and `package.json`, one change reaches all of them.

The engine runs as `npx -y @thenavidm/skill-builder@latest`. Where `skill-builder` is installed (`npm install -g @thenavidm/skill-builder`), run `skill-builder` instead: it's the same engine, without the download.

```bash
npx -y @thenavidm/skill-builder@latest package <plugin>
npx -y @thenavidm/skill-builder@latest package <plugin> --check
```

- Without `--check` it writes every manifest, and `skills/<name>/agents/openai.yaml` for each skill marked `disable-model-invocation: true`, so "only when asked" holds in Codex too. It only ever replaces or removes files it wrote.
- With `--check` it writes nothing and says what's out of date; CI runs it so a hand edit fails before it ships.
- A repository that carries its own manifest builder (scripts/manifests/build.mjs in that repository) is packaged with that builder.
- A repository without `product.json` has hand-written manifests: offer `skill-repo` to put it on one source.

Never edit a generated manifest by hand: change `product.json` or the skill, and package again. Commit the result.
