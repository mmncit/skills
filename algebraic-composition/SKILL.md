---
name: algebraic-composition
description: "Refactor accumulation and update code in TypeScript by giving values a lawful combine operation. Use this skill when a reduce has an awkward multi-field accumulator, when several loops each walk the same collection to compute a different total, when independent update functions must be merged into one, when a state updater is a growing chain of if-blocks each writing a different field, when combining two configuration or option objects, when collecting all validation failures rather than stopping at the first, or when a deep-nested update has become a three-level spread ladder. Covers semigroups and monoids in plain TypeScript with no library, why associativity and an identity element are the properties that make folding safe, a catalogue of reusable combiners (sum, all, any, min, max, first-success, merge, endomorphism), composing state updaters, and typed lenses for reading and updating nested structures."
---

# Algebraic Composition

A surprising share of application code is one shape: **take many things, produce one thing.** Totals, merged config, collected errors, a state object after ten updates, the union of selections across layers. Written by hand each time it becomes a bespoke loop with a bespoke accumulator, and none of it is reusable.

The alternative is to define **how two values combine** — one function, `(a, b) => a` — and get folding for free. When that combine operation obeys two laws, you can fold any number of values, in any grouping, safely.

## The two laws that make it work

**Associativity** — grouping doesn't matter:

```ts
concat(concat(a, b), c) === concat(a, concat(b, c));
```

This is the property that makes *folding* legitimate. Without it, `reduce` and `reduceRight` disagree, and you can't split the work or reorder it.

**Identity** — there's an empty value that changes nothing:

```ts
concat(a, empty) === a;
```

This is what makes the **empty collection** work. Without an identity you're stuck seeding the fold with the first element and special-casing `[]`.

Combine + associativity is a **semigroup**. Add an identity and it's a **monoid**. That's the whole vocabulary; you don't need category theory to use it.

Two properties worth being explicit about because they're often assumed and often false:

- **Commutativity** (`concat(a, b) === concat(b, a)`) is *not* required, and most useful combiners lack it — string concatenation, "last write wins" merge, function composition. Don't reorder a fold unless you know the operation commutes.
- **Distributivity** across two operations is a bonus you occasionally exploit for optimisation, not something to design for.

Check the laws with a property test over generated values. A combine operation that isn't associative will pass your unit tests and then break the day someone folds in a different order.

## The refactor: name the combiner, then fold

```ts
// BEFORE — three loops, three accumulators, nothing reusable
let total = 0;
for (const r of rows) total += r.qty * r.price;

let allShipped = true;
for (const r of rows) allShipped = allShipped && r.shipped;

let maxQty = -Infinity;
for (const r of rows) maxQty = Math.max(maxQty, r.qty);
```

```ts
// AFTER — one fold helper, three named combiners
type Monoid<T> = { concat: (a: T, b: T) => T; empty: T };

const foldMap = <A, T>(m: Monoid<T>, f: (a: A) => T, items: A[]): T =>
    items.reduce((acc, a) => m.concat(acc, f(a)), m.empty);

const Sum: Monoid<number> = { concat: (a, b) => a + b, empty: 0 };
const All: Monoid<boolean> = { concat: (a, b) => a && b, empty: true };
const Max: Monoid<number> = { concat: Math.max, empty: -Infinity };

const total = foldMap(Sum, (r: Row) => r.qty * r.price, rows);
const allShipped = foldMap(All, (r: Row) => r.shipped, rows);
const maxQty = foldMap(Max, (r: Row) => r.qty, rows);
```

`foldMap` is three lines and never changes. Every future aggregate is a `Monoid` plus a one-line extractor function — and the `empty` field means `rows === []` is correct by construction instead of by an early return.

The win compounds when you need several aggregates in **one pass**: a monoid over a record of monoids folds the whole collection once (see `references/catalogue.md`).

## Composing state updaters

The most valuable non-numeric case. A growing chain of `if` blocks in a state updater is a fold waiting to happen:

```ts
// BEFORE — every new concern edits this function
function reducer(state: State, payload: Payload): State {
    let next = state;
    if (payload.email) next = { ...next, loggedIn: checkCreds(payload) };
    if (payload.prefs) next = { ...next, prefs: payload.prefs };
    if (payload.theme) next = { ...next, theme: payload.theme };
    return next;
}
```

An **endomorphism** is any `T => T`. Endomorphisms form a monoid where `concat` is composition and `empty` is `identity` — so a list of independent updaters folds into a single updater:

```ts
// AFTER — each updater is independent, testable, and registered in one place
type Update<T> = (state: T) => T;

const composeUpdates = <T>(updates: Update<T>[]): Update<T> =>
    (state) => updates.reduce((s, update) => update(s), state);

const login = (p: Payload): Update<State> => (s) =>
    p.email ? { ...s, loggedIn: checkCreds(p) } : s;

const setPrefs = (p: Payload): Update<State> => (s) =>
    p.prefs ? { ...s, prefs: p.prefs } : s;

const reducer = (state: State, p: Payload): State =>
    composeUpdates([login(p), setPrefs(p), setTheme(p)])(state);
```

Each updater takes the payload and returns "what I would do to the state" — a value you can test in isolation, reorder deliberately, or filter by feature flag. Adding a concern appends to the array; it doesn't edit existing branches.

Note this is **order-dependent by design**: function composition doesn't commute, so two updaters writing the same field means last-one-wins. If that's a real risk, make it explicit — partition the updaters by the keys they own and fail loudly on overlap.

## Nested updates: use a lens

Once an update is two or more levels deep, spread ladders stop being readable and start hiding bugs:

```ts
// BEFORE — which brace closes what?
const next = {
    ...state,
    layers: {
        ...state.layers,
        [id]: { ...state.layers[id], style: { ...state.layers[id].style, opacity: 0.5 } },
    },
};
```

A **lens** is a first-class getter/setter pair for one position in a structure. Lenses compose, so a path is just a composition of single-step lenses, and `over` applies a function at that position while copying everything else:

```ts
// AFTER
const layerOpacity = (id: string) =>
    compose(lensProp('layers'), lensProp(id), lensProp('style'), lensProp('opacity'));

const next = over(layerOpacity(id), () => 0.5, state);
const current = view(layerOpacity(id), state);   // the same path reads, too
```

One path definition serves both read and update, and it's reusable across every call site that touches that position. `references/lenses.md` covers typed lenses, `lensPath` versus composed `lensProp`, lenses over arrays, and the cases where a spread is genuinely the better choice.

## Where to go next

- Combining values that might be **absent or failed** — collecting all validation errors instead of short-circuiting on the first — is a monoid over a result type. See the `effects-as-values` skill.
- The surrounding refactor (procedures to composed functions, `pipe`, currying) is in `functional-architecture`.
- Applying one function to the *inside* of a domain wrapper (a long/short form, a per-locale string) rather than folding many values into one is the other axis — see `domain-functors`.
- `references/catalogue.md` has typed TypeScript implementations of `foldMap`, the standard combiners, record-of-monoids for single-pass multi-aggregation, endomorphism composition, and a property-test template for the laws.

## When NOT to use it

- **A single aggregate over one collection.** `rows.reduce((a, r) => a + r.total, 0)` is already clear. Introduce a monoid at the second or third aggregate, not the first.
- **The operation isn't associative.** Subtraction, division, "average", and anything order-sensitive in a way that isn't composition. Forcing them into this shape produces results that quietly depend on fold direction.
- **Numeric hot paths.** `foldMap` allocates a closure per element and boxes intermediates. In a per-frame or millions-of-rows path, write the loop.
- **Shallow, one-off updates.** A lens for `{...state, visible: false}` is pure overhead. Lenses start paying at two levels deep, or when the same path is used in three or more places.
- **A reducer that's genuinely one decision.** If a state transition is a single `switch` over an action type with no shared field-writing, it's already the right shape — see `entity-factory` for dispatch tables.
