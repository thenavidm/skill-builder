# Contributing

Thanks for looking. Here is what helps and what does not.

## Issues, yes

Bug reports are genuinely useful, and the more concrete the better: the prompt
or command you ran, what you expected, and what happened instead.

A wrong finding is the most useful report of all. If an audit flags something that is fine, or misses something that is broken, describe the code (a minimal example is best) and the finding's ID.

Feature requests are welcome too, with one caveat. A skill ships only when it
passes its evals, and advice with no source behind it is kept out on purpose.
Most requests that get declined fail one of those two checks, not because the
idea is bad.

## Pull requests, no

These plugins are deliberately built alike, so a change has to land the same
way in several of them, and each skill has to pass its evals again. Reviewing a
patch takes longer than writing it.

That is a property of how this is maintained, not a judgement on the patch. If
something is broken, an issue gets it fixed faster than a pull request will.

## Security

Please do not open a public issue for a vulnerability. Use the private
reporting path in [SECURITY.md](SECURITY.md), which also sets out what the
plugin holds and what it can change.
