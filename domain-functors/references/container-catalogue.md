# Container catalogue

`SKILL.md` works one container end to end (`Variants<A>`, the long/short form). This file covers the other two shapes that come up, the recipe for deriving `map` for a wrapper of your own, and the containers you should *not* build.

## `Localized<A>` — a fixed set of named slots

Same idea, no tag needed: there is only one shape, so nothing has to be discriminated.

```ts
export type Localized<A> = { readonly en: A; readonly fr: A };

export const mapLocalized =
    <A, B>(f: (a: A) => B) =>
    (x: Localized<A>): Localized<B> => ({ en: f(x.en), fr: f(x.fr) });

export const map2Localized =
    <A, B, C>(f: (a: A, b: B) => C) =>
    (xa: Localized<A>, xb: Localized<B>): Localized<C> => ({
        en: f(xa.en, xb.en),
        fr: f(xa.fr, xb.fr),
    });
```

The payoff is that `Localized<string>` → `Localized<number>` → `Localized<ReactNode>` is now three `map` calls rather than three functions that each name `en` and `fr`. **Adding `es` is one edit here** instead of one edit per operation — that is the reason to bother.

Note there is no `single`/broadcast case: every locale must have a value, so a "one value for all locales" concept would be a *different* type. Don't smuggle it in as `A | Localized<A>` — that's the unsound bare union from rung 1 again.

## `Grouped<K, A>` — slots known only at runtime

```ts
export type Grouped<K extends string, A> = Readonly<Record<K, A>>;

export const mapGrouped =
    <K extends string, A, B>(f: (a: A) => B) =>
    (x: Grouped<K, A>): Grouped<K, B> =>
        Object.fromEntries(
            Object.entries(x as Record<K, A>).map(([k, v]) => [k, f(v as A)]),
        ) as Grouped<K, B>;
```

Two casts, because `Object.entries` widens the key type and `Object.fromEntries` returns `{ [k: string]: B }`. They are contained to this one function, which is the argument for having the function: the alternative is that cast pair appearing at every call site.

`map2Grouped` is where this shape stops being free — two groupings may have different key sets, and you have to decide between intersection, union-with-a-default, and "throw on mismatch". That decision is domain-specific, so write it explicitly rather than reaching for a generic `map2`.

## Deriving `map` for your own wrapper

1. **Name the shape and count the slots.** If the slot set is fixed and known (`long`/`short`, `en`/`fr`), you have a container. If the cases carry *different* fields, you have a state machine — stop, and use exhaustive matching instead.
2. **Tag it if more than one case exists.** A discriminant `A` cannot collide with. Never `A | { …something about A… }`.
3. **Write constructors.** `single`, `variants` — the only places the literal shape appears.
4. **Write `map`, curried**, one line per case. This is the whole payoff; ship it and stop.
5. **Add `map2` only when a real second-argument operation exists**, and decide the broadcasting rule deliberately.
6. **Write the two law tests** (`references/laws-and-tests.md`). They are five lines and they catch the collapsing bug.

Steps 1–4 are usually one short module. If a wrapper is taking more than that, re-read step 1.

## Containers not to build

| Shape | Why not | Where it lives |
|---|---|---|
| `Result<T, E>` / `Task<T>` | Failure and I/O are their own problem, with their own ladder and a real argument about how far to climb | `effects-as-values` |
| "Collect all the validation errors" | This is a fold with an error-accumulating combiner, not a functor | `algebraic-composition` |
| A value plus an accumulated log | Same — the log is the monoid, and the plumbing rarely earns its keep in TypeScript | `algebraic-composition` |
| `Array`, `Promise`, `Map`, `Set` | Already have `map`, or a one-line equivalent | the standard library |
| `Draft` \| `Published` \| `Archived` | Different fields per case — a state machine wanting exhaustive `switch`, not one function applied to every slot | `entity-factory` for the builder side |

A container earns its own module when **the same slot-walking branch is being rewritten for each new operation**. If that isn't happening, you have a type, not a functor.
