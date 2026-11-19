# arena

A skill for decisions where one attempt would lock in the first shape a model thought of. Several subagents on different Claude models attempt the same brief in parallel, a blind judge scores them against a rubric written before anyone started, and the coordinator picks the strongest as a base and grafts in the best ideas from the rest by hand.

Where the attempts converge, the answer was probably forced. Where they diverge is the real decision, and you see the options written out instead of imagined.

## The phases

1. Frame: the artifact, a rubric of three to six gradeable criteria, the runners, separate output locations.
2. Fan out: every candidate launched in one message, each with the same brief.
3. Judge: a fresh subagent, told to read and score and edit nothing, scores the candidates relabelled and shuffled, with model names removed.
4. Pick: read every candidate in full, score per criterion, compare with the judge.
5. Graft: one or two ideas from each loser, folded in by hand.
6. Verify: check the result like any other output.

## Multiple models, one vendor

The runners are `fable`, `opus` and `sonnet`. Because they all come from one vendor, they share more blind spots than models from different labs would, and the judge cannot be from another vendor. The skill compensates where it can. The judge is blind to which model wrote what and runs in a fresh context, but it is still one of the seat models and may favour its own work, so its agreement counts as useful but weaker evidence. If a harness cannot pick a model per subagent, every seat runs on the current model with the same brief, and the output says so.

## Contents

| File | What it is |
|---|---|
| `SKILL.md` | The six phases, the blinding rules, the output note, and when not to use it. |

No reference files. The skill is self-contained.

## When it fires

An API, schema or persisted format that will be expensive to change · a cache key · a naming scheme · an algorithm choice · a tricky refactor · a prompt · "arena this" · "throw it in the arena" · "get a few attempts and compare" · "run it on several models" · "multi-model" · "best of N" · "compare their proposals with yours" · "I want options before we commit"

## When it does not

A decision with one evidently right answer converges, and you paid several times to learn nothing. Coverage work, where each worker takes a different slice, is a plain parallel fan-out with nothing to pick or graft. Finding defects in a finished change is `interrogate`, because builders do not try hard to break their own work. Three seats cost roughly four single attempts once the judge is counted, so a cheap reversible change does not earn it. If nobody will read every candidate in full, the pick falls back to the single-attempt bias.

## Siblings

| What you are looking at | Skill |
|---|---|
| Deciding whether a change needs an arena at all | [architect](../architect/) |
| A finished change that needs attacking, not more candidates | [interrogate](../interrogate/) |
| Building the chosen design | [tdd](../tdd/) |
| Candidates disagreeing about casts, brands or where to parse | [strong-typescript](../strong-typescript/) |

## Credit

Adapted from the `arena` skill in [pstack](https://github.com/cursor/plugins/tree/main/pstack) by Lauren Tan, MIT licensed. The original runs and judges across vendors; this version stays on Claude models.
