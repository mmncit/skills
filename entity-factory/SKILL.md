---
name: entity-factory
description: "Create a family of type-varying objects — chart types, dashboard widgets, filters, map layers, any 'entity kind' — with a functional factory instead of a growing switch. The pattern: a string enum of kinds, a Record<Kind, builderFn> registry, one generic dispatcher, and pure builders produced by a `withDefaults` higher-order factory. Use this skill when adding a new chart/widget/entity type, when a switch or if/else over a `type`/`kind`/`__class__` field keeps growing, when per-type code is duplicated across variants, when designing a plugin/registry so new kinds register in exactly one place, when building echarts/plotly option builders, or when someone asks 'how do I add a new <type>?', 'how are these created?', or 'how do I make this extensible?'. Covers the registry-vs-discriminated-union choice (kind passed as an argument vs a `__class__` field carried in the data), factoring shared behavior (axes/colors/legends, or lifecycle/tweening) into reusable pure helpers, pipe composition, and keeping the dispatcher type-safe."
---

# Entity Factory Pattern

When a codebase needs many **variations of the same thing** — chart types, dashboard widgets, filters, map layers, mappings, any object that differs by a *kind* — the wrong instinct is a `switch`/`if-else` that every new kind must edit, with per-type code copied between branches. The right shape is a **functional factory**: one enum of kinds, one registry mapping each kind to a **pure builder function**, and one generic dispatcher. Adding a kind then costs *exactly one registry entry* — no dispatcher edits, no consumer edits.

## The three layers

1. **A string enum of kinds** — the discriminant. `enum ChartKind { RateCum = "rate-cum", StackedBar = "stacked-bar" }`.
2. **A registry + one dispatcher.** `const BUILDERS: Record<Kind, Builder> = { … }` plus a single `create(kind, input)` that looks up `BUILDERS[kind]`, throws on miss, and delegates.
3. **Pure builders made by a higher-order `withDefaults` factory.** Each builder is `(input) => output` with no side effects; shared sub-parts and cross-cutting concerns live in small pure helpers reused across every kind.

Minimal, framework-agnostic shape:

```ts
// 1. the load-bearing atom: a factory-of-factories that stamps defaults
export const withDefaults =
  <T extends object>(defaults: T) =>
  (overrides: Partial<T> = {}): T => ({ ...defaults, ...overrides });

// 2. a discriminant + one common builder contract
type Kind = "bar" | "line" | "pie";
type Build = (input: BuildInput) => ChartOption;

// 3. per-kind PURE builders, composed from shared helpers
const buildBar: Build = (i) => ({ ...baseAxes(i), ...barSeries(i) });
const buildLine: Build = (i) => ({ ...baseAxes(i), ...lineSeries(i) });

// 4. registry + dispatcher — the ONLY thing a new kind touches
const BUILDERS: Record<Kind, Build> = { bar: buildBar, line: buildLine, pie: buildPie };
export function createChart(kind: Kind, input: BuildInput): ChartOption {
  const build = BUILDERS[kind];
  if (!build) throw new Error(`Unknown chart kind: ${kind}`);
  return build(input);
}
```

`withDefaults` is the primitive everything rests on: `(defaults) => (overrides) => merged`. Use a shallow spread merge by default; use a stricter variant that drops keys not present in `defaults` when overrides come from untrusted or persisted input (see `references/starter.md`). Every builder assembles its output from these default-stamped pieces rather than hand-writing literals.

## Two ways to carry the "kind" — pick one deliberately

- **Kind as an argument** — `create(kind, overrides)`. Simplest; the caller already knows the kind. Type-safety comes from `keyof typeof REGISTRY` + `ReturnType`, so the return type is inferred from the key. Best for transient, caller-driven creation.
- **`__class__` discriminant carried in the data** — every entity object holds `{ __class__: Kind }`, and `generateEntity(state)` dispatches on `state.__class__`. This gives you a real TypeScript **discriminated union** (`type AllEntities = Bar | Line | …`) that narrows automatically, and the data is self-describing. Best when entities are serialized / persisted / rehydrated — the stored blob must say what it is.

Rule of thumb: **transient, caller-driven creation → argument. Persisted / round-tripped entities → `__class__` union.**

## Factor shared behavior into pure helpers — never into the dispatcher

The registry is half the win; the other half is that **cross-cutting behavior lives once** and every builder composes it:

- For chart/option builders: axis, title, legend, and series *defaults* become their own `withDefaults` builders; color resolution, title formatting, and min/max become shared pure helpers each builder imports.
- For stateful entities: subscription, tweening/animation, dirty-tracking, and lifecycle get factored into a single `createEntity`, and each builder is `pipe(translate, generateState, entityFactory(…))`.

If you're copying axis/legend/lifecycle code between builders, extract a helper. A builder should read as **composition of shared pieces + the few lines unique to this kind**, nothing more. Where a `pipe`/`compose` helper is available, make that composition explicit.

## Adding a new kind — the entire checklist

1. Add a member to the kind enum (and to the union type if you use `__class__`).
2. Define its defaults (`DEFAULT_X`) and a `withDefaults`-built state generator.
3. Write the pure builder, composing shared helpers; export it from the barrel.
4. Register one entry in the registry.

No dispatcher or consumer changes. Kinds may even **share a builder** — point two registry entries at the same function when a new kind is a variant of an existing one.

## Applying it to a project

`references/starter.md` is a copy-paste, framework-agnostic implementation: `withDefaults` (shallow + strict), both dispatch styles (kind-as-argument and `__class__` union), typed `create`/`generateEntity`, shared-helper composition with `pipe`, and an "add a new kind" walkthrough. Rename `Kind`/`Entity` to your domain and delete the variant you don't use.

## Where to go next

`functional-architecture` is the front door for this family of skills. The four that bear directly on this pattern:

- **`functional-architecture`** — the `pipe` and currying mechanics `withDefaults` and `pipe(translate, generateState, …)` are built on, and the wider refactor from procedures to composed functions.
- **`algebraic-composition`** — merging defaults with overrides *is* a combine operation, and layering several of them is a fold. Worth reading if the shallow spread in `withDefaults` has started losing nested keys, or if several builders each need the same options object assembled from layers.
- **`domain-functors`** — the neighbouring shape, easy to confuse. A registry dispatches on a *kind* to build **different** outputs; a functor applies **the same** function to every slot of one wrapper. If your variants all carry the same payload and differ only in how it's held, you want a `map`, not a registry.
- **`effects-as-values`** — builders must stay pure for any of this to hold. When one genuinely needs I/O, that skill covers where to put the boundary rather than letting a fetch leak into the registry.

## When NOT to use it

- **Only 1–2 variants that won't grow** → a plain `if` is fine; don't build a registry for two cases.
- **Variants don't share a common output contract** → they aren't one family; keep them as separate functions.
- **Behavior varies by runtime *data*, not a fixed set of *kinds*** → that's strategy/config, not a type factory.
- **A single kind with many options** → parameterize one builder; you don't need a registry.
