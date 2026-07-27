# Combiner catalogue

Copy-paste TypeScript. No dependencies. Rename to suit the codebase.

## The core types

```ts
export type Semigroup<T> = { concat: (a: T, b: T) => T };
export type Monoid<T> = Semigroup<T> & { empty: T };

/** Fold a collection by mapping each element into a monoid and combining. */
export const foldMap = <A, T>(m: Monoid<T>, f: (a: A) => T, items: readonly A[]): T =>
    items.reduce((acc, a) => m.concat(acc, f(a)), m.empty);

/** Fold a collection that is already monoid values. */
export const fold = <T>(m: Monoid<T>, items: readonly T[]): T =>
    items.reduce(m.concat, m.empty);
```

`empty` is a value, not a function — safe as long as it's immutable. Use `empty: () => T` if yours is a mutable structure (an array or `Map` you intend to build into), otherwise every fold shares one accumulator.

## Numeric and boolean

```ts
export const Sum: Monoid<number> = { concat: (a, b) => a + b, empty: 0 };
export const Product: Monoid<number> = { concat: (a, b) => a * b, empty: 1 };
export const Max: Monoid<number> = { concat: Math.max, empty: -Infinity };
export const Min: Monoid<number> = { concat: Math.min, empty: Infinity };
export const All: Monoid<boolean> = { concat: (a, b) => a && b, empty: true };
export const Any: Monoid<boolean> = { concat: (a, b) => a || b, empty: false };
```

`Max`/`Min` are the reason an identity element matters: `-Infinity` makes `foldMap(Max, f, [])` return a defined value instead of throwing or returning `undefined`.

## Collections

```ts
export const Concat = <T>(): Monoid<T[]> => ({ concat: (a, b) => [...a, ...b], empty: [] });

export const Union = <T>(): Monoid<readonly T[]> => ({
    concat: (a, b) => [...new Set([...a, ...b])],
    empty: [],
});

/** Not a monoid on its own — there is no finite "set of everything" to act as empty. */
export const Intersection = <T>(): Semigroup<readonly T[]> => ({
    concat: (a, b) => a.filter((x) => b.includes(x)),
});
```

`Intersection` is a **semigroup, not a monoid** — fold it with `reduce` seeded by the first element, and handle the empty case explicitly. Pretending otherwise is the most common way people get this wrong.

For large collections, swap the array bodies for `Set` operations; the interface doesn't change.

## Objects

```ts
/** Shallow merge, right wins. Associative but NOT commutative. */
export const Merge = <T extends object>(): Monoid<T> => ({
    concat: (a, b) => ({ ...a, ...b }),
    empty: {} as T,
});

/** Deep merge where both sides hold a plain object at the same key. */
export const DeepMerge = <T extends object>(): Monoid<T> => ({
    concat: (a, b) => {
        const out = { ...a } as Record<string, unknown>;
        for (const [k, v] of Object.entries(b)) {
            const prev = out[k];
            out[k] = isPlainObject(prev) && isPlainObject(v)
                ? (DeepMerge<object>().concat(prev, v) as unknown)
                : v;
        }
        return out as T;
    },
    empty: {} as T,
});

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
    typeof v === 'object' && v !== null && !Array.isArray(v);
```

`Merge` is the honest description of what layered config resolution actually is: `fold(Merge<Config>(), [defaults, orgConfig, userConfig, urlOverrides])`. Order is the precedence order, and it's the one thing you must not shuffle.

## First / last present

```ts
export const First = <T>(): Monoid<T | undefined> => ({
    concat: (a, b) => (a !== undefined ? a : b),
    empty: undefined,
});

export const Last = <T>(): Monoid<T | undefined> => ({
    concat: (a, b) => (b !== undefined ? b : a),
    empty: undefined,
});
```

`First` is "the first source that has an opinion" — resolving a value across a fallback chain, folded in priority order. It short-circuits semantically but not operationally; use a `find` if the extractor is expensive.

## Endomorphism — composing updaters

```ts
export type Endo<T> = (value: T) => T;

export const EndoM = <T>(): Monoid<Endo<T>> => ({
    concat: (f, g) => (x) => g(f(x)),   // left-to-right: f then g
    empty: (x) => x,
});

export const composeUpdates = <T>(updates: readonly Endo<T>[]): Endo<T> =>
    fold(EndoM<T>(), updates);
```

Order matters — `concat(f, g)` runs `f` then `g`. Fix the direction once and document it; silently changing it changes behaviour everywhere.

This is what turns a chain of `if` blocks in a state updater into a list of independent updaters. Each `Endo<State>` is testable on its own with a plain state object.

## Reducer — combining reducers over a shared state

When several reducers need to see the *same* action and each contributes part of the next state, combine the reducers themselves:

```ts
export type Reducer<S, A> = (state: S, action: A) => S;

export const ReducerM = <S, A>(): Monoid<Reducer<S, A>> => ({
    concat: (f, g) => (state, action) => g(f(state, action), action),
    empty: (state) => state,
});

/** Adapt a reducer to a different action type — contravariant in the action. */
export const contramapAction = <S, A, B>(f: (b: B) => A) =>
    (reducer: Reducer<S, A>): Reducer<S, B> =>
        (state, action) => reducer(state, f(action));

export const combineReducers = <S, A>(rs: readonly Reducer<S, A>[]): Reducer<S, A> =>
    fold(ReducerM<S, A>(), rs);
```

Unlike the usual `combineReducers`, this composes reducers over the **whole** state rather than slicing it by key — the right tool when several concerns each touch overlapping fields. `contramapAction` lets a reducer written against a narrow action type participate in a wider one.

## Multiple aggregates in one pass

A record whose values are monoids is itself a monoid. This is how you compute six totals over a million rows with a single traversal:

```ts
type MonoidRecord<T> = { [K in keyof T]: Monoid<T[K]> };

export const struct = <T extends object>(ms: MonoidRecord<T>): Monoid<T> => ({
    concat: (a, b) => {
        const out = {} as T;
        for (const k of Object.keys(ms) as (keyof T)[]) {
            out[k] = ms[k].concat(a[k], b[k]);
        }
        return out;
    },
    empty: Object.fromEntries(
        (Object.keys(ms) as (keyof T)[]).map((k) => [k, ms[k].empty]),
    ) as T,
});

// One traversal, four aggregates.
type Stats = { count: number; revenue: number; maxQty: number; allShipped: boolean };

const StatsM = struct<Stats>({
    count: Sum,
    revenue: Sum,
    maxQty: Max,
    allShipped: All,
});

const stats = foldMap(
    StatsM,
    (r: Row): Stats => ({
        count: 1,
        revenue: r.qty * r.price,
        maxQty: r.qty,
        allShipped: r.shipped,
    }),
    rows,
);
```

Adding a fifth statistic means one entry in `StatsM` and one field in the extractor. No new loop, no second pass.

## Property-testing the laws

Unit tests won't catch a non-associative combiner. Test the law directly:

```ts
import fc from 'fast-check';

export function assertMonoid<T>(
    name: string,
    m: Monoid<T>,
    arb: fc.Arbitrary<T>,
    eq: (a: T, b: T) => boolean = (a, b) => Object.is(a, b),
) {
    describe(name, () => {
        it('is associative', () => {
            fc.assert(
                fc.property(arb, arb, arb, (a, b, c) =>
                    eq(m.concat(m.concat(a, b), c), m.concat(a, m.concat(b, c))),
                ),
            );
        });

        it('has a right and left identity', () => {
            fc.assert(
                fc.property(arb, (a) =>
                    eq(m.concat(a, m.empty), a) && eq(m.concat(m.empty, a), a),
                ),
            );
        });
    });
}

assertMonoid('Sum', Sum, fc.integer());
assertMonoid('Merge', Merge<Record<string, number>>(), fc.dictionary(fc.string(), fc.integer()),
    (a, b) => JSON.stringify(a) === JSON.stringify(b));
```

Pass a structural `eq` for object and function monoids. For an `Endo<T>` monoid, compare by applying both sides to generated inputs rather than comparing the functions themselves.

Run these once per combiner when you write it. They're cheap, and they catch the exact class of bug that only appears after someone parallelises or reorders a fold.
