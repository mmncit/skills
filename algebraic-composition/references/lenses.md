# Lenses

A lens is a first-class, composable **getter/setter pair** for one position inside a structure. It exists to replace spread ladders and repeated path strings with one reusable definition that serves reads and immutable updates alike.

## The three operations

```ts
view(lens, subject);            // read
set(lens, value, subject);      // replace, returning a new subject
over(lens, fn, subject);        // transform in place, returning a new subject
```

All of them copy; none mutate. `set(l, v, s)` is just `over(l, () => v, s)`.

## Why lenses over spread ladders

```ts
// Spread ladder — three levels deep, and the path is repeated four times
const next = {
    ...state,
    layers: {
        ...state.layers,
        [id]: {
            ...state.layers[id],
            style: { ...state.layers[id].style, opacity: 0.5 },
        },
    },
};

// Lens — the path is defined once and also reads
const layerOpacity = (id: string) =>
    compose(lensProp('layers'), lensProp(id), lensProp('style'), lensProp('opacity'));

const next = set(layerOpacity(id), 0.5, state);
const current = view(layerOpacity(id), state);
const dimmed = over(layerOpacity(id), (o: number) => o * 0.5, state);
```

The ladder repeats `state.layers[id]` at every level — the classic site of copy-paste bugs where one level spreads the wrong object. The lens states the path once.

## Composition reads outside-in

```ts
const addrStreetName = compose(lensIndex(0), lensProp('address'), lensProp('street'), lensProp('name'));
over(addrStreetName, toUpper, users);
```

Left to right is **outermost to innermost**, matching the property-access order you'd write by hand (`users[0].address.street.name`). This is the opposite of `compose` for plain functions, and it catches everyone once.

Build a small module of single-step lenses and compose paths from them:

```ts
const L = {
    layers: lensProp<State, 'layers'>('layers'),
    style: lensProp<Layer, 'style'>('style'),
    opacity: lensProp<Style, 'opacity'>('opacity'),
    layer: (id: string) => lensProp<Layers, string>(id),
};

const layerStyle = (id: string) => compose(L.layers, L.layer(id), L.style);
const layerOpacity = (id: string) => compose(layerStyle(id), L.opacity);
```

Paths now compose from paths — `layerOpacity` reuses `layerStyle` — and a shape change means editing one atom.

## `lensPath` versus composed `lensProp`

```ts
const a = lensPath(['layers', id, 'style', 'opacity']);            // concise, weakly typed
const b = compose(L.layers, L.layer(id), L.style, L.opacity);      // verbose, checked
```

`lensPath` takes strings, so nothing verifies the path exists or that the focused value is a number. Prefer composed `lensProp` for anything load-bearing; keep `lensPath` for scripts and one-off inspection.

Ramda's lens typings are weak either way — `compose` over four lenses often degrades to `Lens<unknown, unknown>`. Two mitigations:

```ts
// 1. Annotate at the definition, so misuse is caught at call sites.
const layerOpacity = (id: string): Lens<State, number> =>
    compose(L.layers, L.layer(id), L.style, L.opacity) as Lens<State, number>;

// 2. Or hand-roll the lens — five lines, fully typed, no cast.
type Lens<S, A> = { get: (s: S) => A; set: (a: A, s: S) => S };

const lens = <S, A>(get: (s: S) => A, set: (a: A, s: S) => S): Lens<S, A> => ({ get, set });

const composeLens = <S, A, B>(outer: Lens<S, A>, inner: Lens<A, B>): Lens<S, B> =>
    lens(
        (s) => inner.get(outer.get(s)),
        (b, s) => outer.set(inner.set(b, outer.get(s)), s),
    );

const over = <S, A>(l: Lens<S, A>, f: (a: A) => A, s: S): S => l.set(f(l.get(s)), s);
```

The hand-rolled version is worth it when lenses are central to the codebase: full inference, no `as`, and `composeLens` is the only law-bearing code you have to trust.

## Lenses over collections

```ts
const secondItem = lensIndex(1);
const overAll = <T>(f: (t: T) => T) => (items: T[]) => items.map(f);

// Set opacity on every layer in one pass.
const allLayerOpacities = compose(L.layers, lens(Object.values, /* … */));
```

For "every element" the plain answer is better: `over(L.layers, mapValues(setOpacity), state)`. A lens focuses **one** position; focusing many positions is a *traversal*, which Ramda doesn't provide and which is rarely worth hand-rolling. Use `map` for the many case and keep lenses for the single-position case.

Focusing an element that might not exist (`lensIndex(5)` on a 2-element array) is where lens laws break down — `view` yields `undefined`, and `set` may extend the array with holes. Guard before focusing, or model the position as optional and handle it explicitly.

## Lens laws

A well-behaved lens satisfies three properties. Violate them and `over` starts producing surprises:

```ts
view(l, set(l, v, s)) === v;                   // set then get returns what you set
set(l, view(l, s), s) === s;                   // setting what's already there changes nothing
set(l, v2, set(l, v1, s)) === set(l, v2, s);   // the last set wins
```

`lensProp` and `lensIndex` satisfy these. A hand-written lens that normalises, clamps, or derives its value on the way in usually **doesn't** — for example a lens whose setter rounds. That's a legitimate thing to write, but it isn't a lens, so don't expect `over` to compose predictably with it. Put the rounding in the function you pass to `over` instead.

## When a spread is the better choice

- **One level deep.** `{ ...state, visible: false }` needs no machinery.
- **Several fields at once at the same level.** One spread beats three `set` calls.
- **The path is used exactly once.** The lens definition costs more lines than it saves.
- **Adding or removing keys.** Lenses focus an existing position; they don't insert or delete. Use spread plus `omit`.
- **Hot paths.** Each lens level allocates a copy of that level. In a per-frame update, hand-write the minimal copy.

The threshold worth applying: reach for a lens at **two or more levels deep**, or when the same path appears in **three or more places**.
