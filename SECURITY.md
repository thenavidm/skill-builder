# Security

## Reporting a vulnerability

[Report it privately](https://github.com/thenavidm/skill-builder/security/advisories/new).
Please do not open a public issue for a security problem: an issue is visible to
everyone the moment you file it, including whoever would use the bug.

Include what you did, what happened, and what you expected. A proof of concept
helps. Reporters are credited in the fix notes unless they would rather not be.

## What the plugin holds

**Nothing but your own code, on your own machine.** Skill Builder reads the repository you point it at and writes its results under `.agents/skill/` in that repository. It connects to no service of ours, and nothing leaves your machine except what your AI tool sends to its own model.

No telemetry, no backend of ours, no account to create.

## What it can change

**Your code, only through a pull request.** Fixes go on a branch and arrive as a pull request that lists each change with the finding it closes. Nothing is merged or pushed to a live system for you.

## Untrusted content

Code, comments, READMEs and agent instruction files in the repository you scan were written by someone else, and some carry text aimed at AI agents. The skills treat all of it as data to report on, never as instructions.

## Good-faith research

Read, run and pull apart anything here. Nobody but the maintainer can change
this repository, so nothing you do while investigating puts it at risk.

The care is owed to the people and services the plugin talks to, not to the
code. When testing, use your own accounts and your own content. If a test could
affect anyone but you, stop and send a private report first.

Research done in that spirit is welcome, and nothing here is a trap.

## Supported versions

The latest released version gets fixes. Given the size of this project, older
versions do not.
