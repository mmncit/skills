---
name: architect
description: "Settle the shape of a change before writing it: trace every system it touches, sketch two different designs as TypeScript types, signatures and module boundaries, and pick the one where each piece of state has one owner, each task has one way to do it, callers need to know least, and the logic is pure functions with I/O at the edge. Use this skill when a change crosses a function or module boundary, moves ownership of state, adds a public API, package, persisted format or cache key, or reshapes data other code reads; when the same workaround has shown up twice; when an agent is about to start a feature with no named data shape; or when someone says 'architect this', 'design this first', 'sketch the types before coding', 'what should the API look like', 'how should these modules talk', 'before you write any code'. Also the front door for the design skills: it says how much design a task deserves and routes contested designs to arena, finished changes to interrogate, the build to tdd, type questions to strong-typescript, comment cleanup to no-comments, and the PR's claims to claims-check."
---

# Architect

The first shape an agent thinks of is the one it builds, and once code exists every later decision bends around it. Settling types, signatures and module boundaries first is cheap. A sketch costs minutes. The wrong shape costs every caller, and keeps costing after the PR merges.

Two symptoms say the design step was skipped. The implementation grows a second boolean that has to stay in sync with the first. Or a fix lands as a guard at the call site instead of in the thing being called.

## How much design a change deserves

Many changes need none of this. Climb only as far as the change asks.

1. A small local change. No design step. Write it, and run `interrogate` on it if you are unsure.
2. A change that crosses a function boundary or moves ownership of state. One pass of this skill.
3. A standalone decision where independent attempts help, such as a name, a format or an algorithm. `arena` directly.
4. An open question you could answer by running something: a layout, a timing, whether a library allows it. A probe, not a debate.
5. A large or contested design, or one that is expensive to reverse: a persisted format, a cache key, a public API. This skill with `arena` producing the sketches and the challenge in step 5, then `interrogate` before it ships.
6. Work that spans several PRs. A written plan and a decision log, after the design settles, with one verifiable unit per PR.

Of the changes that need any design, most stop at rung 2.

## The pass

1. Trace every system the change touches. Read the callers, where the data comes from, where it is stored and who reads it afterwards, and list them. A design that missed a consumer is the commonest way this goes wrong. End with a short list of what the design assumes. Finding facts is your job. Decisions are the user's: put each open one to them with the answer you recommend.
2. Write the caller first. Sketch the code that will use the new thing, the way a caller would want to write it. For a package or API other code will use, write the README or a short tutorial first and work back from it.
3. Sketch two different shapes. Two designs that put state or responsibility in different places, not one shape and a variation of it. Giving each sketch a different constraint is the reliable way to get there: the smallest interface you can manage, the most common caller's case made trivial, or a pure core with every effect passed in. Each sketch is TypeScript with no bodies: types for the data, pure functions that compute over it, failures as values in their return types, and the I/O named separately at the edge.
4. Pick with four tests.
   - Each piece of state has exactly one owner.
   - Each task has one way to do it.
   - Callers need to know the least. Count everything a caller must know, not just the signature: invariants, ordering, error modes, required configuration, performance. Then imagine deleting the module. If the complexity would reappear in every caller, the module earns its place. If it would simply vanish, the module is a pass-through.
   - The decisions live in pure functions, and the I/O sits in a thin shell that calls them. Imports point one way, from shell to core, and two modules that need each other are one module.

   When two sketches tie, take the smaller interface. The core's entry point is where its tests belong: test the composed core through it, and treat tests on individual pipeline stages as optional, because the bugs that matter live in how the stages are combined.
5. On rung 5, challenge the pick before any code. Give a fresh-context subagent, not a fork of your own context, the chosen sketch, the consumers from step 1 and the caller code from step 2, but not your reasoning or your conclusion. Ask only how the sketch breaks that contract: a consumer it misses, a state or sequence it cannot represent, a simpler shape, how to roll it back. A claim of fact ("this API takes a list", "callers cannot express X") has to come with the check that proves it, and for a TypeScript sketch the cheapest check is type-checking the step 2 caller code against it. Each surviving doubt becomes a change or a probe. Stop after three rounds and take what is left to the user.
6. Answer open questions by running something. If the choice depends on a fact, such as how slow, how it looks or whether the dependency allows it, build the smallest probe that settles it. When the question is whether a state model holds up, write the probe as a pure reducer or a set of pure functions. That part can be lifted into the change after a `tdd` pass at its interface. Everything else in a probe is thrown away.
7. Record the decision. Two lines in the PR description: the shape chosen, the one rejected, and why. A rung 5 or 6 decision that is hard to reverse, would surprise a reader without context, and came from a real trade-off also gets a decision log in the repository: an entry per decision with the choice, the rejected alternative and the reason, plus the decisions deliberately left open, each with the default taken. It stops a later session from proposing the rejected design again, and it lets a fresh session resume from the first open question.
8. Stay in the loop while the code fills in. When the same workaround appears a second time, stop patching. Redesign as if the new requirement had been known from the start, and carry the change through every type, caller and doc it touches. Once a core and a shell exist, a dependency rule in the build, such as one written for dependency-cruiser, keeps the core from importing the shell after the PR merges.

## Shapes that are expensive to reverse

A persisted format, a cache key, a public API and anything another service calls get four extra rules.

- Every behaviour a caller can observe is part of the contract, documented or not, because someone will come to depend on it.
- Evolve by addition: new optional inputs and new output fields. A new arm in an exported union is not an addition. It breaks every consumer whose `switch` is exhaustive, so treat it as a breaking change.
- Put a version in persisted formats and cache keys, so old and new can coexist while you migrate.
- A call that writes to another system has three outcomes: done, failed and unknown, because a timeout says nothing about whether the write landed. Model that as a three-arm union in the return type rather than folding unknown into failed, and make retries safe with an idempotency key derived from the intent, such as the order ID, never from the attempt.

## What two sketches look like

A CSV import that a settings page starts and shows progress for. Both sketches use the `Result` type from `effects-as-values`. In the first, the importer owns the job and its progress, and callers poll it.

```ts
type ImportError =
  | { kind: "unreachable"; source: SourceUrl }
  | { kind: "malformed"; row: number; detail: string };

type ImportStatus =
  | { kind: "running"; rowsDone: number }
  | { kind: "done"; report: RowReport }
  | { kind: "failed"; error: ImportError };

declare function startImport(source: SourceUrl): Promise<Result<JobId, ImportError>>;
declare function importStatus(id: JobId): Promise<Result<ImportStatus, { kind: "unknownJob"; id: JobId }>>;
```

In the second, the importer is a set of pure steps behind one I/O function, and the caller owns the loop.

```ts
type Batch = { readonly rows: readonly Row[]; readonly next: Cursor | null };

declare function readBatch(source: SourceUrl, cursor: Cursor | null): Promise<Result<Batch, ImportError>>;
declare function validateRows(rows: readonly Row[]): RowReport;
declare function mergeReports(a: RowReport, b: RowReport): RowReport;
declare const emptyReport: RowReport;
```

The second is a functional core: every pure step is testable with plain values, but every caller re-implements the loop, retries and progress. The first keeps all three in one owner at the price of polling, and hides its logic behind I/O. Seeing both makes a better third shape visible: the second sketch's pure steps as the core, and the first sketch's single owner as a thin shell that runs the loop and reports progress. `mergeReports` is associative and `emptyReport` is its identity, so the shell can fold batches in any grouping, and an import with no rows still has a report. Without two sketches on the page, that combination rarely gets seen.

## Where to go next

| What the design needs | Skill |
|---|---|
| Several independent attempts at a contested or expensive design, compared and merged | `arena` |
| Someone to try to break the finished change, keeping only what a run proves | `interrogate` |
| The build, test first, once the caller-facing behaviour is settled | `tdd` |
| Types that make the sketch's invalid states uncompilable: brands, boundary parsing, read-only data | `strong-typescript` |
| The comments the build left behind, cleared before review | `no-comments` |
| The PR description, decision log and reports checked against the code before anyone reads them | `claims-check` |

The code-shape skills take over once the sketch turns into code. A sketch that is really a class or a procedure goes to `functional-architecture`, failure and I/O that belong in return types to `effects-as-values`, results to combine to `algebraic-composition`, and variants written as optional fields to `discriminated-unions`.

## When NOT to use it

- The shape is already obvious: one function, one caller, no new state. A sketch would restate the code you are about to write.
- A spike whose only job is to learn something. Learn first, then design with what the spike taught you.
- A change that follows an existing pattern exactly, such as another endpoint shaped like the last ten. That design was settled when the pattern was.
- Under about an hour of work. Two sketches and a probe can cost more than writing it twice.
- A design you will not revisit once code starts. The pass only pays if step 8 happens, so a sketch that becomes a contract nobody may question is worse than no sketch.
