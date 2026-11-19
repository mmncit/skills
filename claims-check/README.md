# claims-check

A skill for checking the prose that ships with a change, such as a PR description, commit message, changelog, decision log or test report, against the code before anyone else reads it.

Reviewers trust the description and skim the diff, and the description is usually written last, from memory, after the code has moved on. A fresh-context subagent lists every checkable claim, answers each one from the code before rereading the wording, and returns a verdict with the smallest true replacement.

## The shape

1. Pin the head commit and the diff the text describes.
2. A fresh subagent lists every claim: numbers, references, change verbs, scope words, verification and behaviour.
3. It answers each from the code first, then gives a verdict: confirmed, wrong, overstated, stale or unverifiable.
4. Corrections replace what is untrue, and unverifiable claims are removed or marked as not checked.

Summaries and agent reports are never evidence, and "covered by tests" needs a test seen failing without the change.

## Contents

| File | What it is |
|---|---|
| `SKILL.md` | What counts as a claim, the pass, the evidence rules, the five verdicts, a worked correction, and when not to use it. |

No reference files. The skill is self-contained.

## When it fires

Before opening or updating a PR · before sending a summary of work to someone else · the end of a long session whose earlier conclusions may be stale · a report saying "all tests pass" or "fully covered" · "check the claims" · "fact-check this PR" · "is this description accurate" · "double check your work" · "verify the summary"

## When it does not

Questions and proposals make no factual claims. Scratch notes nobody reads are not worth the pass. A claim only production can settle is marked unverifiable, not reasoned into a verdict. A long document gets its numbers, scope words and verification claims checked first. An accurate description of a broken change is still a broken change, so this never replaces reviewing the code.

## Siblings

| What you are looking at | Skill |
|---|---|
| The design family's front door, and where this check sits in it | [architect](../architect/) |
| The code itself, rather than the words about it | [interrogate](../interrogate/) |
| A coverage claim with no test seen failing | [tdd](../tdd/) |
| Comments in the code, which go stale the same way | [no-comments](../no-comments/) |

## Credit

The method is restated from the claims-checking agent in [rdf](https://github.com/rfxn/rdf) by R-fx Networks. rdf is GPL v2 licensed, and none of its text is copied here.
