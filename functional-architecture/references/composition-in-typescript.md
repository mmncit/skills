# Composition in TypeScript

The mechanics that decide whether a functional refactor stays readable and well-typed, or collapses into `any`.

## Typing `pipe`

Library `pipe` implementations are a stack of hand-written overloads — one per arity. Past the last overload, the signature falls back to `(...fns: Function[]) => any` and **inference silently dies**. In Ramda that boundary is around ten functions; other libraries differ, but they all have one.

Two rules:

```ts
// Bad: one 14-stage pipe. Return type is `any`, and a type error anywhere
// reports at the `pipe` call with a wall of unreadable candidates.
export const process = pipe(a, b, c, d, e, f, g, h, i, j, k, l, m, n);

// Good: named sub-pipelines. Types survive, and the names document the phases.
const normalize = pipe(a, b, c, d);
const enrich = pipe(e, f, g, h);
const summarize = pipe(i, j, k, l);
export const process = pipe(normalize, enrich, summarize);
```

**Annotate each stage explicitly.** A stage whose parameter type is inferred from usage will happily accept whatever the previous stage emits, and the mismatch surfaces somewhere else entirely:

```ts
// The annotation is the contract. Break the chain and TS points at the stage.
const toReportRow = (rows: Row[]): ReportRow[] => rows.map(/* … */);
```

Prefer `pipe` (left-to-right) over `compose` (right-to-left) for pipelines with more than two stages — reading order matching execution order is worth more than mathematical convention.

## Curried factories over `curry` helpers

Hand-written curried arrows type perfectly and need no casts:

```ts
export const clampTo = (min: number, max: number) => (value: number): number =>
    Math.min(Math.max(value, min), max);

const clamp01 = clampTo(0, 1);   // (value: number) => number
```

A variadic `curry`/`curryN` helper can't express "returns a partially applied function of the remaining parameters" in TypeScript's type system, so codebases end up with `@ts-ignore` or a hand-written cast at every use. Reserve it for utilities that genuinely must support both `f(a, b)` and `f(a)(b)`, and type those by hand:

```ts
// If you must support both call shapes, declare the overloads yourself.
export function isNotEqual(a: unknown): (b: unknown) => boolean;
export function isNotEqual(a: unknown, b: unknown): boolean;
export function isNotEqual(a: unknown, b?: unknown) {
    const check = (x: unknown) => !equals(a, x);
    return arguments.length > 1 ? check(b) : check;
}
```

**Argument order is a design decision.** Put the data last. `clampTo(min, max)(value)` composes; `clamp(value, min, max)` doesn't. This is the whole reason the combinator libraries take the collection as their final argument.

## Partial application for configuration

When a pipeline stage needs configuration the pipeline itself shouldn't know about, bind it once at construction:

```ts
type ComputeHandlers = Record<string, (value: unknown, state: State) => Partial<State>>;

// General: takes handlers, defaults, and state.
function computeStateUpdate(
    handlers: ComputeHandlers,
    defaults: State,
    state: Partial<State>,
): Partial<State> { /* … */ }

// Specialised once, at module load, where the handlers are known.
export const computePlotUpdate = partial(computeStateUpdate, [PLOT_HANDLERS, DEFAULT_PLOT_STATE]);
// => (state: Partial<State>) => Partial<State>
```

A hand-rolled closure gives the same result with better inference:

```ts
export const createStateUpdate =
    (handlers: ComputeHandlers, defaults: State) =>
    (state: Partial<State>): Partial<State> =>
        computeStateUpdate(handlers, defaults, state);
```

Prefer the closure when the types matter, `partial` when you're matching surrounding style.

## Generic stages

A stage that doesn't inspect its elements should be generic, so it composes into any pipeline rather than just the one it was written for:

```ts
// Reusable across every collection in the codebase.
export const byKey = <T, K extends keyof T>(key: K) => (items: T[]): T[] =>
    [...items].sort((a, b) => String(a[key]).localeCompare(String(b[key])));

// Constrain to only what the stage actually reads.
export const byLastName = <T extends { last: string }>(items: T[]): T[] =>
    [...items].sort((a, b) => a.last.localeCompare(b.last));
```

Constrain to the **narrowest shape the stage uses** (`T extends { last: string }`), never to a concrete domain type. The stage then works on anything with a last name, and the return type keeps the caller's element type intact instead of widening it.

## Type guards keep pipelines honest

`filter` doesn't narrow unless the predicate is a type guard, so a pipeline that removes `undefined` still carries `Maybe<T>` downstream and every later stage pays for it:

```ts
export function isDefined<T>(item: Maybe<T>): item is T {
    return typeof item !== 'undefined';
}

const ids = pipe(
    map(prop('id')),
    (xs: Maybe<string>[]) => xs.filter(isDefined),   // now string[]
);
```

Write the guard once, export it from the `fp` barrel, and use it everywhere a nullable is dropped.

## Deriving key sets from defaults

A defaults object is the single source of truth for what a domain object owns. Derive from it rather than repeating the key list:

```ts
export const DEFAULT_GRIDLINES_STATE = { spacing: 10, color: '#888', visible: true };

export const sanitizeGridlinesState = pick(keys(DEFAULT_GRIDLINES_STATE));

export const createGridlines = pipe(translateToEntity, sanitizeGridlinesState, createGridlinesEntity);
```

Adding a field means editing one object. Sanitising at the boundary is what makes it safe to hydrate state from storage or an API without unknown keys leaking through.

## Readability limits of point-free style

Point-free is a tool, not a goal. It reads well while each combinator names a recognisable operation:

```ts
// Clear.
const activeIds = pipe(filter(propEq('active', true)), map(prop('id')));

// Not clear. What is being combined with what?
const f = pipe(chain(pipe(prop('items'), map(prop('id')))), reduce(max, -Infinity));

// Clear again — the intermediate has a name.
const allItemIds = (groups: Group[]) => flatten(groups.map((g) => g.items.map((i) => i.id)));
const highestId = pipe(allItemIds, (ids: number[]) => Math.max(...ids));
```

The test: if you have to trace the types by hand to work out what a stage receives, name it. A named arrow function inside a pipe is still functional composition.

## Barrel module, deep imports

Keep one `utils/fp.ts` that re-exports the combinators the codebase actually uses, plus your own:

```ts
// utils/fp.ts — deep imports stay tree-shakeable
import pipe from 'ramda/es/pipe';
import pick from 'ramda/es/pick';
import equals from 'ramda/es/equals';

export function isDefined<T>(item: Maybe<T>): item is T { /* … */ }
export function identity<T>(v: T): T { return v; }
export const isEqual = equals;

export { pipe, pick };
```

Call sites import from `utils/fp`, so swapping the underlying library — or replacing a combinator with a hand-written one — is a single-file change. Deep per-function imports inside the barrel keep the bundler from pulling the whole library in.
