---
name: claims-check
description: "Check every factual claim in the prose that ships with a change, such as a PR description, commit message, changelog, decision log or test report, against the code before anyone else reads it. A fresh-context subagent lists each checkable claim, works out the answer from the diff and the tree before rereading the wording, and returns a verdict with the smallest correction. Use this skill before opening or updating a PR, before sending a summary of work to someone else, at the end of a long session whose earlier conclusions may have gone stale, when a report says 'all tests pass' or 'fully covered', or when someone says 'check the claims', 'fact-check this PR', 'is this description accurate', 'double check your work', 'verify the summary'. Covers which sentences count as claims (counts, file and line references, 'added', 'fixed', 'removed', 'all', 'none', 'only', 'tests pass', 'covered by tests'), why summaries and agent reports are never evidence, why 'covered by tests' needs a test seen failing without the change, and the five verdicts. Not for reviewing the code itself, which is interrogate."
---

# Claims check

The prose around a change gets read more than the change. A reviewer trusts the description and skims the diff, so a description that says "fixes every caller" when it fixes four of five does more damage than the missed caller. Nothing checks that prose by default, and it is usually written last, from memory, after the code has moved on.

Two symptoms say a description needs this. A number in it was never recomputed after the last commit. Or it says "covered by tests" and nobody has seen that test fail.

## What counts as a claim

- Numbers: files, callers, rows, before and after figures, "three times faster".
- References: file paths, line numbers, function names, commit hashes, links.
- Change verbs: added, removed, fixed, renamed, moved, deprecated.
- Scope words: all, every, none, only, never, always.
- Verification: tests pass, lint is clean, covered by tests, verified, deployed, live.
- Behaviour: "callers no longer need to retry", "this is backwards compatible".

Opinions, plans and questions are not claims. Leave them alone.

## The pass

1. Pin what the text describes: the head commit, and the diff from its merge base with the default branch. For a PR that is already merged, that diff is empty, so pin the merge commit and diff it against its parent. Every answer comes from that pin, not from what you remember of an earlier state.
2. Give the text and the pin to a fresh-context subagent, not a fork of your own context, with this section and the two below. It lists every claim, then works out the facts from the code and from commands it runs before judging the wording: count the callers itself, then compare the count with the sentence. Judging the sentence first is how a reviewer ends up agreeing with it. A sentence that mixes a past run with something the code can do, such as "caught the sabotage at the right line", is two claims: the run is unverifiable, and the capability gets checked on its own. Without subagents, do the pass yourself and say so.
3. For each claim it returns a verdict and, for a claim that is wrong, overstated or stale, the smallest replacement text that is true.
4. Apply the corrections. Replace what is wrong, overstated or stale. For unverifiable claims, either remove them or keep them marked as not checked, for example by opening the paragraph with "From the author's runs, not re-checked:".

Report the number of claims, the count per verdict, each correction, and what stays unverified.

## Evidence

Evidence is the code at the pin, the diff, and the output of a command run now against that pin.

These are not evidence, however confident they sound: summaries, earlier reports including your own and other agents', commit messages, review comments, and the text being checked. They can say where to look. They cannot settle anything.

Two claims need more than a reading:

- "Covered by tests" holds only for a test that has been seen failing without the change, which is the sabotage rung in `tdd`. Otherwise the true claim is "a test exists".
- "Tests pass" holds only for a run on the pinned head. A run before the last commit is stale.

## The verdicts

- Confirmed: the code says the same thing.
- Wrong: the code says something else.
- Overstated: true for some of the cases, claimed for all of them. This includes a claim that holds only behind a flag or an option the sentence leaves out; the replacement names it.
- Stale: true at an earlier commit, no longer true at the pin.
- Unverifiable: nothing available here can settle it, such as production behaviour or a system you cannot reach.

## What a correction looks like

The sentence before the pass:

> Removes every `as` cast from the parser, and the new tests cover all four error paths.

The check found two casts left at `parser.ts:41` and `parser.ts:77`, so the first half is wrong. Three of the error paths have tests that failed when the fix was reverted, and the `timeout` test was never seen failing, so the second half is overstated. The sentence after:

> Removes four of the six `as` casts from the parser; two remain at `parser.ts:41` and `:77`. Three of the four error paths have tests seen failing without the change. The `timeout` test has not been sabotage-checked.

## Where to go next

| Situation | Skill |
|---|---|
| The code itself, rather than the words about it, needs attacking | `interrogate` |
| A "covered by tests" claim with no test seen failing | `tdd` |
| The decision log and design notes a design pass produced | `architect` |
| Comments in the code, which are claims too and go stale the same way | `no-comments` |

## When NOT to use it

- Text with no factual claims, such as a question or a proposal. There is nothing to check.
- Scratch notes nobody else will read.
- A claim only production can settle. Mark it unverifiable rather than reasoning your way to a verdict.
- A long document checked line by line. Check its numbers, scope words and verification claims first; those are where the damage is.
- As a substitute for reviewing the code. A perfectly accurate description of a broken change is still a broken change.
