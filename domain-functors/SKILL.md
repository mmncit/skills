---
name: domain-functors
description: "Give a domain wrapper type one `map`, so every operation stops re-branching on its variants. Use this skill when the same `if (\"long\" in x)` or `x.tag === …` branch appears in a dozen functions, when a helper unwraps a wrapper, transforms the inside and re-wraps it — copy-pasted once per operation, when adding an operation means editing every variant branch, when combining two wrapped values needs a four-way if-ladder, when a union like `A | { long: A; short: A }` narrows wrong because `A` itself carries that key, when a per-locale or per-group record has its transform written out field by field, or when someone asks 'how do I add an operation without touching every branch', 'why does my generic wrapper narrow wrong', 'how do I apply a function to the inside of this type', 'can I map over my own type'. Covers tagging the container soundly, writing `map` and `map2` once, the two functor laws and the collapsing bug that breaks them, and where the pattern stops paying — functor and applicative in plain TypeScript, no library, no higher-kinded types."
---

# Domain Functors

Some domain values arrive in a **wrapper with a fixed set of slots**: a label that has a long form and a short form, a string that exists per locale, a metric that exists per group. Every operation on the inside of that wrapper then re-derives the same branching — unwrap, transform, re-wrap — and adding an operation means writing the branch again.

The fix is one function. Give the wrapper a `map` that knows how to reach every slot, and every operation afterwards is written **as if the wrapper weren't there**. That is all a functor is: a container plus a lawful `map`.

## Two symptoms

- **The same shape check in many functions.** `if ("long" in x)`, `if (x.tag === "variants")`, `Object.keys(x).map(…)` — repeated in `trim`, `format`, `truncate`, `render`. Each is 90% identical and each is a place the next variant has to be added.
- **Combining two wrapped values is an if-ladder.** Joining a wrapped prefix to a wrapped suffix needs four branches (both wrapped, first only, second only, neither) and the "first only" case is where the copy-paste bug lives.

Based on Adam Dueck's [*Practical uses for functional programming with NLP*](https://adueck.github.io/blog/practical-uses-for-functional-programming-with-nlp/), which derives this for a Pashto inflection engine. The encoding recommended below differs from the post's — see rung 1.

## Rung 1 — tag the container

Do this first; the rest is unsound without it. The tempting encoding is a bare union of "the value, or the variants":

```ts
// ✗ unsound
type Variants<A> = A | { long: A; short: A };

function mapV<A, B>(f: (a: A) => B, x: Variants<A>): Variants<B> {
    if (x && typeof x === "object" && "long" in x) {
        return { long: f(x.long), short: f(x.short) };
    }
    return f(x as A); // the cast is the tell: the compiler can't confirm the narrowing
}
```

`"long" in x` is being asked to answer "is this the wrapper?", but it actually answers "does this object have a `long` key?" — and when `A` itself has one, the two differ:

```ts
type Range = { long: number; short: number };
const describe = (r: Range) => `${r.long}-${r.short}`;

mapV(describe, { long: 3, short: 1 });
// tsc accepts it. At runtime: { long: "undefined-undefined", short: "undefined-undefined" }
```

`{ long: 3, short: 1 }` is a perfectly good `Range`, so it type-checks as `Variants<Range>`, and then `map` reads it as the wrapper and hands `3` to a function expecting an object. There is no `A` you can constrain your way out of. **Tag it:**

```ts
export type Variants<A> =
    | { readonly tag: "single"; readonly value: A }
    | { readonly tag: "variants"; readonly long: A; readonly short: A };

export const single = <A>(value: A): Variants<A> => ({ tag: "single", value });
export const variants = <A>(long: A, short: A): Variants<A> => ({ tag: "variants", long, short });
```

The tag is a key `A` cannot collide with, narrowing is now a discriminated union, and the constructors are the only place the shape is written down.

## Rung 2 — write `map` once

Curried, so it drops straight into a `pipe`:

```ts
export const mapV =
    <A, B>(f: (a: A) => B) =>
    (x: Variants<A>): Variants<B> =>
        x.tag === "single" ? single(f(x.value)) : variants(f(x.long), f(x.short));
```

That is the last time the branch is written. **BEFORE** — one branch per operation:

```ts
function trimLabel(x: Variants<string>): Variants<string> {
    if (x.tag === "variants") {
        return { tag: "variants", long: x.long.trim(), short: x.short.trim() };
    }
    return { tag: "single", value: x.value.trim() };
}
function upperLabel(x: Variants<string>): Variants<string> { /* …the same eight lines… */ }
```

**AFTER** — the operations are ordinary string functions:

```ts
const trimLabel = mapV((s: string) => s.trim());
const upperLabel = mapV((s: string) => s.toUpperCase());
const labelLength = mapV((s: string) => s.length); // Variants<number>
```

Most containers should stop here. Rung 2 is where nearly all of the value is.

## Rung 3 — `map2`, only once you combine two

Climb here when you have an actual four-branch join, not in anticipation of one. The interesting part isn't the both-wrapped case, it's **broadcasting**: a `single` combined with a `variants` behaves as if it had been duplicated into both slots — while two singles stay a single, so the container never inflates.

```ts
const longOf = <A>(x: Variants<A>): A => (x.tag === "single" ? x.value : x.long);
const shortOf = <A>(x: Variants<A>): A => (x.tag === "single" ? x.value : x.short);

export const map2 =
    <A, B, C>(f: (a: A, b: B) => C) =>
    (xa: Variants<A>, xb: Variants<B>): Variants<C> =>
        xa.tag === "single" && xb.tag === "single"
            ? single(f(xa.value, xb.value))
            : variants(f(longOf(xa), longOf(xb)), f(shortOf(xa), shortOf(xb)));

const joinLabels = map2((a: string, b: string) => a + b);

joinLabels(variants("Bachelor of Science", "BSc"), single(" (Hons)"));
// { tag: "variants", long: "Bachelor of Science (Hons)", short: "BSc (Hons)" }
```

Two accessors replace the four-branch ladder, and every future two-argument operation is one line. `ap` — the applicative primitive, where the *function* is the wrapped thing — is worth deriving only if you genuinely have wrapped functions; `map2` covers the ordinary case and reads better:

```ts
export const ap = <A, B>(fs: Variants<(a: A) => B>, xs: Variants<A>): Variants<B> =>
    map2((f: (a: A) => B, x: A) => f(x))(fs, xs);
```

**If the function you're mapping itself returns a container**, `map` gives you a nested `Variants<Variants<A>>` and what you want is `chain`. For `Result`- and `Task`-shaped containers that's `effects-as-values`' territory; for a wrapper like this one, flattening usually means the two nesting levels are really one decision and the type is wrong.

## The two laws, and the bug that breaks them

A `map` is worth trusting only if it satisfies both:

- **Identity** — `mapV(x => x)(v)` equals `v`. Mapping nothing changes nothing, *including the shape*.
- **Composition** — `mapV(f)(mapV(g)(v))` equals `mapV(x => f(g(x)))(v)`. Two passes may be fused into one.

Composition is what lets you split and merge pipeline stages freely. Identity is the one that gets broken in practice, by a `map` that tries to be clever:

```ts
// ✗ collapses equal variants back to a single
const smartMap = <A, B>(f: (a: A) => B) => (x: Variants<A>): Variants<B> => {
    if (x.tag === "single") return single(f(x.value));
    const long = f(x.long), short = f(x.short);
    return long === short ? single(long) : variants(long, short);
};

smartMap(x => x)(variants("aa", "aa")); // { tag: "single", value: "aa" }  ← shape changed
```

It passes the composition law — which is exactly why a suite that checks only composition lets it through. It looks like a tidy-up and is a live bug: whether a value still reports as having variants now depends on whether the data happened to be equal, so a downstream `x.tag === "variants"` check becomes data-dependent. Normalising is a legitimate operation — just make it a separate, named `normalize`, never something `map` does silently. `references/laws-and-tests.md` has both laws as runnable property tests.

## Where to go next

- `references/container-catalogue.md` — the same treatment for `Localized<A>` and `Grouped<K, A>`, plus a six-step recipe for deriving `map` for a wrapper of your own, and the containers you should *not* build because something already owns them.
- `references/laws-and-tests.md` — the functor and applicative laws as fast-check properties, and the broadcasting property for `map2`.
- `functional-architecture` — the front door: turning procedures into composed pure functions. `mapV` is curried precisely so it composes there.
- `algebraic-composition` — for combining *many* values of one type into one (totals, merged config, collected errors). Different axis: this skill maps over the inside of a container, that one folds a collection down.
- `effects-as-values` — when the wrapper is failure or I/O (`Result`, `Task`) rather than a domain shape. It owns `map`/`flatMap` for those, and explains why hand-rolling a monad transformer stack in TypeScript is a bad trade.

## When NOT to use it

- **One or two call sites.** Two `if (x.tag === …)` branches are not a pattern. Write the branch, and extract `map` at the third.
- **TypeScript has no higher-kinded types.** You cannot write one generic `map` that works across your containers — each costs its own `map`, `map2`, and law tests. That's cheap for one or two wrappers, and a bad trade for eight. Eight wrappers usually means several of them aren't real.
- **The slots need genuinely different operations.** If the long form is truncated and the short form is expanded, `map` is the wrong tool — it exists to apply *the same* function to every slot, and forcing it hides the asymmetry.
- **Arrays, promises and `Map` already have this.** Don't wrap something to give it a `map` it already has.
- **Don't rename `map` to `fmap`.** Call it `map` (or `mapVariants` where a bare `map` would be ambiguous at the call site), keep it in the container's own module, and skip the vocabulary lesson in the code — the laws matter, the jargon doesn't.
- **The wrapper is really a discriminated union of different things.** `Draft | Published | Archived` carrying different fields is a state machine, not a container. It wants exhaustive matching, not `map`.
