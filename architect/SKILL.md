---
name: architect
description: "Settle the shape of a change before writing it: trace every system it touches, sketch two different designs as TypeScript types, signatures and module boundaries, and pick the one where each piece of state has one owner, each task has one way to do it, callers need to know least, and the logic is pure functions with I/O at the edge. Use this skill when a change crosses a function or module boundary, moves ownership of state, adds a public API, package or config format, or reshapes data other code reads; when the same workaround has shown up twice; when an agent is about to start a feature with no named data shape; or when someone says 'architect this', 'design this first', 'sketch the types before coding', 'what should the API look like', 'how should these modules talk', 'before you write any code'. Also the front door for the design skills: it says how much design a task deserves and routes contested designs to arena, finished changes to interrogate, the build to tdd, type questions to strong-typescript, and comment cleanup to no-comments."
---

# Architect

The first shape an agent thinks of is the one it builds, and once code exists every later decision bends around it. Settling types, signatures and module boundaries first is cheap. A sketch costs minutes. The wrong shape costs every caller, and keeps costing after the PR merges.

Two symptoms say the design step was skipped. The implementation grows a second boolean that has to stay in sync with the first. Or a fix lands as a guard at the call site instead of in the thing being called.

## How much design a change deserves

Most changes need none of this. Climb only as far as the change asks.

1. A small local change. No design step. Write it, and run `interrogate` on it if you are unsure.
2. A change that crosses a function boundary or moves ownership of state. One pass of this skill.
3. A standalone decision where independent attempts help, such as a name, a format or an algorithm. `arena` directly.
4. An open question you could answer by running something: a layout, a timing, whether a library allows it. A throwaway probe, not a debate.
5. A large or contested design, or one that is expensive to reverse: a persisted format, a cache key, a public API. This skill with `arena` producing the sketches, then `interrogate` before it ships.
6. Work that spans several PRs. A written plan, after the design settles, with one verifiable unit per PR.

Most work stops at rung 2.

## The pass

1. Trace every system the change touches. Read the callers, where the data comes from, where it is stored and who reads it afterwards, and list them. A design that missed a consumer is the commonest way this goes wrong.
2. Write the caller first. Sketch the code that will use the new thing, the way a caller would want to write it. For a package or API other code will use, write the README or a short tutorial first and work back from it.
3. Sketch two different shapes. Not one shape and a variation of it, but two designs that put state or responsibility in different places. Each sketch is TypeScript: the types, the exported signatures, and which module owns what. No bodies. Sketch data and functions rather than classes: types for the data, pure functions that compute over it, failures as values in their return types, and the I/O named separately at the edge.
4. Pick with four tests. Each piece of state has exactly one owner. Each task has one way to do it. Callers need to know the least. The decisions live in pure functions, and the I/O sits in a thin shell that calls them. When two sketches tie, take the smaller API.
5. Answer open questions by running something. If the choice depends on a fact, such as how slow, how it looks or whether the dependency allows it, build the smallest probe that settles it and keep the probe out of the change.
6. Record the decision in two lines: the shape chosen, the one rejected, and why. That goes in the PR description, not in a code comment.
7. Stay in the loop while the code fills in. When the same workaround appears a second time, stop patching. Redesign as if the new requirement had been known from the start, and carry the change through every type, caller and doc it touches.

## What two sketches look like

A CSV import that a settings page starts and shows progress for. In the first sketch the importer owns the job and its progress, and callers poll it.

```ts
type ImportStatus =
  | { kind: "running"; rowsDone: number }
  | { kind: "done"; report: RowReport }
  | { kind: "failed"; reason: string };

declare function startImport(source: SourceUrl): Promise<JobId>;
declare function importStatus(id: JobId): Promise<ImportStatus>;
```

In the second the importer is a set of pure steps and the caller owns the loop.

```ts
type Batch = { rows: readonly Row[]; next: Cursor | null };

declare function readBatch(source: SourceUrl, cursor: Cursor | null): Promise<Batch>;
declare function validateRows(rows: readonly Row[]): RowReport;
declare function mergeReports(a: RowReport, b: RowReport): RowReport;
```

The second is a functional core: every step is testable with plain values, but every caller re-implements the loop, retries and progress. The first keeps all three in one owner at the price of polling, and hides its logic behind I/O. Seeing both makes the better third shape visible: the second sketch's pure steps as the core, and the first sketch's single owner as a thin shell that runs the loop and reports progress. `mergeReports` is a combine with an empty report as its identity, which is what lets the shell fold batches in any grouping. Without two sketches on the page, that combination rarely gets seen.

## Where to go next

| What the design needs | Skill |
|---|---|
| Several independent attempts at a contested or expensive design, compared and merged | `arena` |
| Someone to try to break the finished change, keeping only what a run proves | `interrogate` |
| The build, test first, once the caller-facing behaviour is settled | `tdd` |
| Types that make the sketch's invalid states uncompilable: brands, boundary parsing, exhaustiveness | `strong-typescript` |
| The comments the build left behind, cleared before review | `no-comments` |
| A sketch that is really a class or procedure needing to become composed functions | `functional-architecture` |
| Failure and I/O in the sketch that should be values in return types | `effects-as-values` |
| Results to combine, such as reports, totals or merged configs | `algebraic-composition` |
| Variants in the sketch modelled as optional fields that only make sense together | `discriminated-unions` |

## When NOT to use it

- The shape is already obvious: one function, one caller, no new state. A sketch would restate the code you are about to write.
- A spike whose only job is to learn something. Learn first, then design with what the spike taught you.
- A change that follows an existing pattern exactly, such as another endpoint shaped like the last ten. That design was settled when the pattern was.
- Under about an hour of work. Two sketches and a probe can cost more than writing it twice.
- A design you will not revisit once code starts. The pass only pays if step 7 happens, so a sketch that becomes a contract nobody may question is worse than no sketch.
