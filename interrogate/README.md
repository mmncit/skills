# interrogate

A skill for attacking a finished change before it merges. Several adversaries, each on a different Claude model and each with its own line of attack, try to break the change with runs against the real code. A finding survives only when rerunning its command shows a failure that contradicts the change's stated intent.

A reviewer who reads a diff finds what the diff makes easy to see. An adversary who has to run something to make a claim finds what breaks, and the rule that every finding needs a reproduction removes style opinions and speculative risks before they reach you.

## The shape

1. Frame: fix the scope, new files included, and restate the intent in one sentence every finding is judged against. The intent always includes keeping unrelated behaviour working.
2. Fan out: three fresh adversaries on `fable`, `opus` and `sonnet`, each in a worktree you create at the scope's commit, with any uncommitted work applied as a patch, attacking inputs and boundaries, state and time, or the contract with every caller.
3. Verify: rerun every reported command, keep failures that break the intent, set aside failures that also happen on the merge base, merge shared root causes.
4. Report: intent, verified findings with the adversaries that found them, pre-existing failures, and what each adversary dropped.

It applies no fixes. A finding's command is the natural first failing test for `tdd`, and afterwards every verified finding is answered with a fix, a rebuttal or a deferral, so none disappears without a trace.

## Contents

| File | What it is |
|---|---|
| `SKILL.md` | Framing, the three lines of attack, the adversary brief, verification, the report format, and when not to use it. |

No reference files. The skill is self-contained.

## When it fires

A risky or contested change about to merge · a large refactor · a design that is expensive to reverse · green tests and lingering doubt · ordering, retries, caching, concurrency or parsing touched · "interrogate this" · "adversarial review" · "multi-model review" · "try to break it" · "stress test this" · "tear this apart" · "find the blind spots" · "is this actually correct"

## When it does not

A plan with no code behind it gives adversaries nothing to run, so prototype the open questions first. Style and readability findings are dropped by design. A small change you are sure of, or one a single targeted test settles, does not need three agents. A known bug already has its reproduction and goes straight to `tdd`. The Dropped list matters too, because an adversary sometimes drops a real problem it could not reproduce in time.

## Siblings

| What you are looking at | Skill |
|---|---|
| A verified finding to fix test first | [tdd](../tdd/) |
| Findings that trace back to the design rather than a line | [architect](../architect/) |
| Two designs and no code yet | [arena](../arena/) |
| Findings about unparsed input, casts or a silent missing case | [strong-typescript](../strong-typescript/) |
| The PR text and finding answers, checked against the code | [claims-check](../claims-check/) |

## Credit

Adapted from the `interrogate` skill in [pstack](https://github.com/cursor/plugins/tree/main/pstack) by Lauren Tan, MIT licensed. The original draws adversaries from several vendors; this version stays on Claude models and gives each adversary a different line of attack instead. Restated in this repository's own words: the fix, rebut or defer answer for each finding comes from [rdf](https://github.com/rfxn/rdf) by R-fx Networks, and the timed-out write and the misread-intent rule from Addy Osmani's [agent-skills](https://github.com/addyosmani/agent-skills).
