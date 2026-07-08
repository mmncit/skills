---
name: entity-factory
description: "Create a family of type-varying objects — chart types, dashboard widgets, filters, map layers, any 'entity kind' — with a functional factory instead of a growing switch. The pattern: a string enum of kinds, a Record<Kind, builderFn> registry, one generic dispatcher, and pure builders produced by a `createStateWithDefaults` higher-order factory. Use this skill when adding a new chart/widget/entity type, when a switch or if/else over a `type`/`kind`/`__class__` field keeps growing, when per-type code is duplicated across variants, when designing a plugin/registry so new kinds register in exactly one place, when building echarts/plotly option builders, or when someone asks 'how do I add a new <type>?', 'how are the charts created?', or 'how do I make this extensible?'. Covers the registry-vs-discriminated-union choice (kind-as-argument, as in eva-web-ui charts, vs a `__class__` field carried in the data, as in the xyz entity system), factoring shared behavior (axes/colors/legends, or lifecycle/tweening) into reusable pure helpers, pipe composition, and keeping the dispatcher type-safe."
---

# Entity Factory Pattern

When a project needs many **variations of the same thing** — chart types, dashboard widgets, filters, map layers, mappings, any object that differs by a *kind* — the wrong instinct is a `switch`/`if-else` that every new kind must edit, with per-type code copied between branches. The right shape is a **functional factory**: one enum of kinds, one registry mapping each kind to a **pure builder function**, and one generic dispatcher. Adding a kind then costs *exactly one registry entry* — no dispatcher edits, no consumer edits.

This is the pattern `eva-web-ui` uses to build ECharts options for ~15 chart types, and the one `xyz` uses as its whole entity system (charts, surfaces, points, filters, mappings, textures — all "entities"). Two independent codebases arrive at the same three layers, so teach it as three layers.

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

`withDefaults` is the primitive everything rests on: eva calls it `createStateWithDefaults` (shallow spread merge, `src/entities/utils.ts`); xyz calls it `createStateFactory` (Ramda `pick`/`keys` merge that also strips unknown keys, `src/types/entities/factory.ts`). Every builder assembles its output from these default-stamped pieces rather than hand-writing literals.

## Two ways to carry the "kind" — pick one deliberately

- **Kind as an argument** — `create(kind, overrides)`. Simplest; the caller already knows the kind. Type-safety comes from `keyof typeof REGISTRY` + `ReturnType`, so the return type is inferred from the key. This is eva-web-ui's `createEntityState(type, state)` / `translateToOptions({ type, states })`.
- **`__class__` discriminant carried in the data** — every entity object holds `{ __class__: Kind }`, and `generateEntity(state)` dispatches on `state.__class__`. This gives you a real TypeScript **discriminated union** (`type AllEntities = Bar | Line | …`) that narrows automatically, and the data is self-describing. This is xyz's `FACTORY_MAP` / `generateEntity`.

Rule of thumb: **transient, caller-driven creation → argument. Persisted / serialized / rehydrated entities → `__class__` union** (the stored blob must say what it is).

## Factor shared behavior into pure helpers — never into the dispatcher

The registry is half the win; the other half is that **cross-cutting behavior lives once** and every builder composes it:

- eva: axis/title/series *defaults* are themselves `withDefaults` builders (`entities/charts/options/*`); color resolution, title formatting, min/max, and axis locks are shared pure helpers each translator imports.
- xyz: subscription, tweening/animation, dirty-tracking, and lifecycle are factored into a single `createEntity`, and every builder is `pipe(translate, generateState, createEntityFactory(…))` — Ramda `pipe` makes the composition explicit.

If you're copying axis/legend/lifecycle code between builders, extract a helper. A builder should read as **composition of shared pieces + the few lines unique to this kind**, nothing more.

## Adding a new kind — the entire checklist

1. Add a member to the kind enum (and to the union type if you use `__class__`).
2. Define its defaults (`DEFAULT_X`) and a `withDefaults`-built state generator.
3. Write the pure builder, composing shared helpers; export it from the barrel.
4. Register one entry in the registry.

No dispatcher or consumer changes. Kinds may even **share a builder** — eva points `MosaicMidstream` at the same translator as `Mosaic`.

## Applying it to a fresh project

- `references/starter.md` — a copy-paste, framework-agnostic implementation: `withDefaults`, both dispatch styles, the discriminated union, typed `create`, shared-helper composition, and an "add a kind" walkthrough.
- `references/eva-charts.md` — the eva-web-ui chart case study (kind-as-argument, ECharts, `GENERATORS` + `TRANSLATOR_MAP`), with real file paths.
- `references/entities-generalized.md` — the xyz generic entity system (`__class__` union, `FACTORY_MAP`, `pipe`, lifecycle in `createEntity`) — the mature template the chart registry generalizes to.

## When NOT to use it

- **Only 1–2 variants that won't grow** → a plain `if` is fine; don't build a registry for two cases.
- **Variants don't share a common output contract** → they aren't one family; keep them as separate functions.
- **Behavior varies by runtime *data*, not a fixed set of *kinds*** → that's strategy/config, not a type factory.
- **A single kind with many options** → parameterize one builder; you don't need a registry.
