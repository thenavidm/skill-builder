# The review

Read this at step 9. The reviewer gets the draft, the confirmed plan, the `check` result and the eval numbers, and reads the skill the way a model will: from the description down, with no memory of the interview.

## What the reviewer checks

1. **The moat.** Does the skill say something the model wouldn't do on its own? Generic advice ("be clear and concise") is weight without value.
2. **Every rule from the plan is there.** Go through the plan's never-dos, voice rules and finish line one by one and point to where each lives.
3. **Each rule has its reason.** A rule without a why gets followed literally and breaks on the first case it didn't foresee.
4. **The steps can be followed cold.** Would a model that has never seen this conversation know what to do at each step, and when it's done?
5. **The description.** Does it say what the skill does in the words people use, and when, in about 300 characters? Is the boundary against the nearest skill clear?
6. **Every tool.** Does anything rely on one tool without a fallback? (`check` lists them.)
7. **Risky actions.** Every script that reaches the network, deletes, runs programs or reads keys was shown to the user and approved.
8. **Nothing private.** No keys, no personal paths, no real customer data in the skill or its test files.

## Sorting what it finds

| Kind | Means | Then |
|---|---|---|
| Blocker | The skill would do the wrong thing, leak something, or not fire | Fix before installing |
| Fix | Wrong in a way the tests didn't catch | Fix, and add a test that would have caught it |
| Later | Could be better, works now | Note it in the log |

## Two rounds, then decide

After the first review, fix the blockers and review again, checking only the blockers and what changed. If something still blocks after the second round, don't start a third: narrow what the skill promises, take out the part that fails, or stop and tell the person why.
