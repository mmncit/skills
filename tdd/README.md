# tdd

A skill for making the intended behaviour executable before production code changes. Write a focused test, watch it fail for the reason it claims to catch, make the smallest change that passes it, and when the test came after the code, revert the fix once to prove the test can fail at all.

Most weak tests pass from the day they are written, because they were written against the code rather than the requirement. Seeing the failure first is the cheapest way to know a test is real.

## The ladder

1. Name the intended behaviour, the current behaviour, and the smallest reproduction.
2. Pick the narrowest check the code path already has.
3. Write the test from the caller's side, with the expected value worked out from the requirement.
4. Run it before the fix and confirm it fails on the assertion.
5. Make the smallest change that passes, then run the neighbours.
6. When the test came after the code, or you doubt it: revert the fix, see the test fail, restore.
7. Refactor with the test holding still.

Rungs 4 and 6 are the ones that get skipped, and the only two that prove anything.

## Contents

| File | What it is |
|---|---|
| `SKILL.md` | The ladder, a real test beside one that proves nothing and a note on why spying on internals fails too, the two-edit test for judging any test, what to do when a failing test is impractical, the report, and when not to use it. |

No reference files. The skill is self-contained.

## When it fires

A bug with a cheap local test path · a feature whose caller-facing behaviour is settled · a test about to be committed that nobody has seen fail · an adversarial finding to turn into a regression test · "TDD" · "test first" · "red green refactor" · "write a failing test" · "add a regression test" · "prove the fix"

## When it does not

Prototype code headed for the bin should not be pinned by tests yet. A behaviour-preserving refactor that existing tests cover needs those tests run, not new ones. When the only reproduction needs production state, a slow end-to-end stack or broad fixture churn, use the closest executable check and say so. A bug the type system can rule out is better fixed with a type. And behaviour defined by how something looks or feels is verified in a running build.

## Siblings

| What you are looking at | Skill |
|---|---|
| Behaviour not settled yet, so nothing to test against | [architect](../architect/) |
| Findings from an adversarial review, each with a command | [interrogate](../interrogate/) |
| A test that cannot run without stubbing `fetch` or the clock | [effects-as-values](../effects-as-values/) |
| Test cases a type could make impossible instead | [strong-typescript](../strong-typescript/) |

## Credit

Adapted from the `tdd` skill and the test-behaviour-not-implementation principle in [pstack](https://github.com/cursor/plugins/tree/main/pstack) by Lauren Tan, MIT licensed. The sabotage rung is this repository's addition.
