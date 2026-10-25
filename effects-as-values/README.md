# effects-as-values

A coding-guideline skill for code where failure and I/O are invisible in the types. A function that performs an effect cannot be composed, deferred, retried, reordered or tested without the world it touches. A function that returns a description of the effect can be all of those.

Two symptoms say the boundary is in the wrong place. A signature that lies: `save(u: User): Promise<User>` does not mention that it throws four different ways, so no caller handles them and none of them are typed. And a test that needs a world: if verifying a calculation means stubbing `fetch`, the calculation and the effect are in the same function.

## The ladder

| Rung | Move | Verdict |
|---|---|---|
| 1 | Put the failure in the return type (`Result<T, E>`) | Zero dependencies, plain TypeScript, most of the value |
| 2 | Defer the effect, so it is a value until something runs it | Worth it once you need retry, cancellation or sequencing |
| 3 | Accumulate failures instead of short-circuiting | Worth it when a form needs every message, not the first |
| 4 | Inject the effectful boundary | Worth it when tests are fighting module mocks |
| 5 | The program as data, run by an interpreter | Learn it, do not build it |

Most codebases should stop at 2 or 3. TypeScript has no higher-kinded types, so a hand-rolled free monad or a `ReaderT(EitherT(Task))` stack needs pervasive casts and pays for itself nowhere.

## Contents

| File | What it is |
|---|---|
| `SKILL.md` | The two symptoms, the five rungs with the stopping point marked, adoption order in an existing codebase, and when not to use it. |
| `references/result-and-task.md` | `Result` and `Task` in full: constructors, `map`/`flatMap`, combinators, typed error unions, and the interop seams with promises. |
| `references/injected-effects.md` | Rung 4 in practice: passing the boundary as a parameter, testing without module mocks, and the useful half of the interpreter idea. |

## When it fires

A function throws and callers cannot tell from the signature · nested `try/catch` blocks, or ones that swallow errors · an error typed `any` or `unknown` by the time it reaches the UI · validation that stops at the first failure when the form needs every message · a unit test that cannot run without stubbing `fetch` or mocking a module · async work needing retry, cancellation or sequencing that promises make awkward · "how do I test this without mocking" · "where should errors be handled" · "how do I return an error instead of throwing"

## When it does not

Out of memory, a failed invariant and ordinary bugs should crash; `Result` is for failures a caller is expected to handle. One `try/catch` at the edge of a route handler is fine, and threading `Result` through four layers to reach it is not an improvement. Frameworks that already own an error channel, such as error boundaries and validation pipelines, should be adapted to at the seam rather than fought. Every `Result` is an allocation, so per-frame and per-row loops want a sentinel. And if the codebase already uses a library with an `Either` or `Effect` type, use that one: two competing result types is worse than either alone.

## Siblings

| What you are looking at | Skill |
|---|---|
| Combining many results into one, including collecting every error | [algebraic-composition](../algebraic-composition/) |
| The rejected case needs to reach a client that is re-deriving the same rule | [policy-as-data](../policy-as-data/) |
| A wrapper with fixed slots rather than a failure or an effect | [domain-functors](../domain-functors/) |
| The surrounding refactor, and separating the calculation from the effect | [functional-architecture](../functional-architecture/) |
