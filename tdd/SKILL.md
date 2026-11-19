---
name: tdd
description: "Make the intended behaviour executable before changing production code: a focused test that fails for the right reason, the smallest change that makes it pass, and deliberate breaks that prove the test can fail at all. Use this skill when fixing a bug that has a cheap local test path, when building a feature whose caller-facing behaviour is already designed, when someone asks for 'TDD', 'test first', 'red green refactor', 'write a failing test', 'add a regression test' or 'prove the fix', and whenever a new test is about to be committed without anyone having seen it fail. It applies even when the code is pasted inline and the fix looks obvious from reading it: the failing test still comes before the change. Covers choosing a check that reproduces the real call pattern, testing behaviour through the public interface, naming the behaviour that must not change, breaking the fix on purpose, and when a test is the wrong tool."
---

# TDD

A test proves something only if someone has seen it fail for the reason it claims to catch. Most weak tests pass from the day they are written, because they were written against the code rather than against the requirement. Writing the test first, and watching it fail, is the cheapest way to know the test is real.

Two symptoms say a test proves nothing. Its expected value was produced by running the code under test. Or it still passes after you revert the fix it was written for.

## The ladder

Work top to bottom. Each rung is cheap.

1. Name the behaviour. Write down the intended behaviour, the current behaviour, the smallest observable reproduction, and the behaviour that must not change, with the one existing test that pins it. "The rest of the suite stays green" does not count. If no test pins it, write one now; it will pass before the change, so it proves itself at rung 6 instead of rung 4.
2. Pick the narrowest check that still reproduces the bug's real call pattern. Use the closest test the code path already has. A check that is too shallow, such as one caller when the bug needs two, or a fake that returns what the test author expected when the bug lives in the query, passes while the bug survives. When the bug lives in a query or a file layout, a real local stand-in such as an in-memory database or a temporary directory beats a fake. If no check can reproduce the bug at all, stop and report that: the design is preventing the bug from being pinned down.
3. Write the test from the caller's side. Drive the public interface with a concrete input, and derive the expected value from the requirement, not from running the code. For a functional core, the interface is the core's entry point: test the composed function, not each stage of its pipeline, because the bugs that matter live in how the stages combine. If the test cannot run without stubbing the network, the clock or a module, that is a design signal rather than a testing problem. Pull the decision out into a pure function first, as rung 1 of `functional-architecture` shows, or inject the boundary as `effects-as-values` does, and test with plain values.
4. Run it before changing anything. It must fail, and fail on the assertion. An import error, a typo or a missing fixture is not the failure you wanted, so fix the test until the failure is the bug.
5. Make the smallest production change that passes it. Then run the pinning test from rung 1 and the neighbouring tests.
6. Break the fix on purpose. When the test was written after the code, or you are not sure it can fail, break the behaviour three ways in turn: a wrong value, a skipped effect, a doubled call. After each break, confirm with a diff that the break really landed, run only the new test and see it fail, then restore. Run the whole suite once at the end.
7. Refactor with the test holding still.

Rungs 4 and 6 are the ones that get skipped, and they are where a test proves it can fail.

For a bug that is not trivial, when you already have a fix in mind, consider having a fresh-context subagent write the reproduction test from the bug report alone. A test written by the agent that already believes in the fix tends to agree with the fix.

## What a real test looks like

`totalMinutes("1h30m")` returns `30`, because the parser drops the hours. The test states the requirement through the public function, with the expected value worked out by hand.

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { totalMinutes } from "./duration";

test("adds the hours to the minutes", () => {
  assert.equal(totalMinutes("1h30m"), 90);
});
```

The version below passes before and after the fix, because the expected value came from the code being tested.

```ts
test("adds the hours to the minutes", () => {
  const expected = totalMinutes("1h30m");
  assert.equal(totalMinutes("1h30m"), expected);
});
```

Spying on an internal helper fails differently: it breaks when someone renames the helper and stays green when the arithmetic is wrong.

## Judging any test

Imagine two edits. Break the behaviour: a wrong value, a skipped effect, a doubled call. If the test still passes, it proves nothing. Change the internals and keep every observable result. If the test fails, it is pinned to the implementation. Keep tests that catch the first and survive the second.

What callers can observe is behaviour: return values, thrown errors, state they can read back, and what an outside system receives. Call order between private helpers is not. Assert the error type callers branch on, not its message.

## When a failing test is impractical

Fall back to whatever executable check is closest: a script, a command, a browser run, an assertion on the logs. A test that will not keep its value is worse than none: one that mostly checks its own mocks, freezes today's implementation, depends on timing or on state other tests share, needs heavy infrastructure for a one-line fix, or would be thrown away once the fix is proven.

Never change a test to match a wrong implementation, and never weaken an assertion unless the expected behaviour changed and you can say why. Before reporting, read the diff for a lowered bar: a `.skip` or `.only`, a deleted test file, an assertion removed from a test that stayed, a coverage or mutation threshold turned down. A flaky bug gets a deterministic test where possible. When the bug points at a wider class of failures, land the focused test first and widen afterwards.

## Report

Name the failing-before run and what it printed, the passing-after run, each deliberate break and whether the test caught it, the test that pins the unchanged behaviour, and the neighbouring checks you ran. If you could not show a failure before the fix, say why and name the check you used instead.

## Where to go next

| Situation | Skill |
|---|---|
| The behaviour is not settled yet, so there is nothing to test against | `architect` |
| A finding from an adversarial review to turn into a regression test | `interrogate` |
| A test that needs a stub for `fetch` or the clock before it can run | `effects-as-values` |
| A whole class of test cases that types could make impossible instead | `strong-typescript` |
| A "covered by tests" line in the PR to check against what was actually seen failing | `claims-check` |

## When NOT to use it

- Exploratory or prototype code headed for the bin. Tests pin a shape you have not chosen yet.
- A behaviour-preserving refactor that existing tests already cover. Run them; adding more duplicates their claim.
- No cheap test path: the reproduction needs production-only state, a slow end-to-end stack, or broad fixture churn. Use the closest executable check and say so.
- A bug the type system can rule out. A type that makes the bad value unconstructible is stronger than a test that checks one instance of it.
- Test-first as ceremony on code whose behaviour is defined by how it looks or feels. Verify that in a running build.
