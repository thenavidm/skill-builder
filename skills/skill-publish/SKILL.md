---
name: skill-publish
description: Puts a plugin repository on GitHub, private first, with a description and topics people search for. Runs only when asked by name.
disable-model-invocation: true
---

# Publish the repository

What people see first decides whether they install it: the description, the topics, the README's first screen. A public repository is indexed the moment it goes public, so it goes up private, gets checked, then opens.

The engine runs as `npx -y @thenavidm/skill-builder@latest`; in the Skill Builder repository, `node bin/skill-builder.mjs`.

## 1. Ready?

- `check` and `package --check` pass, and `install` passes each tool's validator.
- The README's first line and `product.json`'s description say the same thing in the same words, and lead with what people search for.
- No email address, key or private path anywhere in the repository (`check` catches keys).

## 2. The steps

```bash
npx -y @thenavidm/skill-builder@latest repo publish --profile profile.json
```

It lists the GitHub commands in order: create it private with the description and push; set the topics; turn on private vulnerability reporting (so the security policy's link works); make it public; tag the first release. Show each command, get a yes for that one, run it, confirm it worked, then the next.

## 3. After it's public

Open the repository page and check what a stranger sees: the description, the topics, the README's first screen, the licence. Then tell them how people install it in each tool, from the README.
