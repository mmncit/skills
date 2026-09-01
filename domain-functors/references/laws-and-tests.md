# Laws and tests

Two laws for `map`, one property for `map2`. Five minutes to write, once per container, and they catch the exact class of bug that unit tests miss — a `map` that quietly changes the container's *shape* rather than its contents.

## Why the laws are the test

A unit test for `mapV(s => s.trim())` asserts a trimmed string comes out. It cannot tell you that `mapV` sometimes returns a `single` where it was handed a `variants`, because that's not what it was looking at. The laws are stated over *all* functions and *all* inputs, which is where that bug lives.

- **Identity** — `map(x => x)(v)` equals `v`. Mapping nothing changes nothing, shape included.
- **Composition** — `map(f)(map(g)(v))` equals `map(x => f(g(x)))(v)`. Two passes fuse into one.

Composition is what makes pipeline refactors safe: splitting a stage in two, or merging two stages, is guaranteed not to change the result. Identity is what stops `map` from normalising behind your back.

## A reusable assertion

Mirrors `assertMonoid` in `algebraic-composition/references/catalogue.md`, so the two read the same way.

```ts
import fc from "fast-check";

export function assertFunctor<F>(
    name: string,
    map: <A, B>(f: (a: A) => B) => (fa: any) => any,
    arb: fc.Arbitrary<F>,
    eq: (a: unknown, b: unknown) => boolean = (a, b) => JSON.stringify(a) === JSON.stringify(b),
) {
    describe(name, () => {
        it("satisfies identity", () => {
            fc.assert(fc.property(arb, (v) => eq(map((x: unknown) => x)(v), v)));
        });

        it("satisfies composition", () => {
            fc.assert(
                fc.property(arb, fc.func(fc.integer()), fc.func(fc.string()), (v, g, f) =>
                    eq(map(f)(map(g)(v)), map((x: unknown) => f(g(x)))(v)),
                ),
            );
        });
    });
}
```

`eq` defaults to structural comparison because these containers are plain objects. Pass a custom one if a slot holds a function or a `Date`.

The `any` in the `map` parameter is unavoidable: TypeScript has no higher-kinded types, so there is no way to write "some container `F` of `A`" as a type variable. It is contained to this one test helper and the call sites below stay fully typed.

## Wiring it to a container

```ts
const arbVariants = <A>(a: fc.Arbitrary<A>): fc.Arbitrary<Variants<A>> =>
    fc.oneof(
        a.map(single),
        fc.tuple(a, a).map(([l, s]) => variants(l, s)),
    );

assertFunctor("Variants", mapV, arbVariants(fc.string()));
assertFunctor("Localized", mapLocalized, fc.record({ en: fc.string(), fr: fc.string() }));
```

`fc.oneof` is what makes this worth running: it generates both cases, so the identity law is checked against a `variants` whose two slots happen to be equal — the input that catches the collapsing bug.

## The failure it catches

```ts
const smartMap = <A, B>(f: (a: A) => B) => (x: Variants<A>): Variants<B> => {
    if (x.tag === "single") return single(f(x.value));
    const long = f(x.long), short = f(x.short);
    return long === short ? single(long) : variants(long, short);   // ✗
};

assertFunctor("smartMap", smartMap, arbVariants(fc.string()));
// identity fails, shrunk to: variants("", "") → { tag: "single", value: "" }
```

Note that `smartMap` **passes** the composition law — collapsing is stable under composing two functions — so a test that only checked composition would let it through. Both laws, every time.

## The broadcasting property for `map2`

`map2`'s rule is that a `single` acts as though it had been duplicated into every slot. The obvious way to state that is **wrong**, and fast-check finds it on the first case:

```ts
// ✗ fails immediately at v = single(a)
eq(join(v, single(s)), join(v, variants(s, s)));
// single("as")  vs  { tag: "variants", long: "as", short: "as" }
```

Broadcasting only describes what happens when *something* is already a `variants`. Two singles must stay a single — that's the other half of the contract, and it's what stops every join from inflating the container. So it's two properties, one per side, plus the shape-preservation pair:

```ts
const arbV = fc.tuple(fc.string(), fc.string()).map(([l, s]) => variants(l, s));

it("broadcasts a single on the right", () => {
    fc.assert(fc.property(arbV, fc.string(), (v, s) =>
        eq(join(v, single(s)), join(v, variants(s, s))),
    ));
});

it("broadcasts a single on the left", () => {
    fc.assert(fc.property(arbV, fc.string(), (v, s) =>
        eq(join(single(s), v), join(variants(s, s), v)),
    ));
});

it("keeps two singles single, and two variants variants", () => {
    fc.assert(fc.property(fc.string(), fc.string(), (a, b) =>
        join(single(a), single(b)).tag === "single",
    ));
    fc.assert(fc.property(arbV, arbV, (a, b) => join(a, b).tag === "variants"));
});
```

Both sides are worth pinning separately: the four-branch hand-written version this replaces almost always gets one of the two mixed cases subtly wrong, and a mixed case is what users hit least often and notice most.

## Applicative laws

If you derived `ap`, the identity law (`ap(single(x => x), v)` equals `v`) is the one that pays; the rest (homomorphism, interchange, composition) hold automatically for any `ap` defined as `map2((f, x) => f(x))`, and testing them is checking `map2` twice. Test them only if `ap` is hand-written rather than derived.
