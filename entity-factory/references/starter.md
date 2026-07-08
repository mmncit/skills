# Starter: drop-in entity factory

A complete, framework-agnostic implementation. Copy it into a new project and rename `Kind`/`Entity` to your domain. Two variants — pick one dispatch style (see SKILL.md "Two ways to carry the kind").

## The primitive: `withDefaults`

Every builder is assembled from default-stamped pieces, so start here.

```ts
// src/entities/withDefaults.ts
export type GenericObject = Record<string, unknown>;

/** (defaults) => (overrides) => merged. Shallow — good default. */
export const withDefaults =
  <T extends GenericObject>(defaults: T) =>
  (overrides: Partial<T> = {}): T => ({ ...defaults, ...overrides });

/** Stricter variant: drops keys not present in defaults (safe for untrusted/persisted overrides). */
export const withDefaultsStrict =
  <T extends GenericObject>(defaults: T) =>
  (overrides: Partial<T> = {}): T => {
    const merged = { ...defaults, ...overrides };
    const allowed = Object.keys(defaults) as (keyof T)[];
    return allowed.reduce((acc, k) => ((acc[k] = merged[k]), acc), {} as T);
  };
```

## Variant A — kind as an argument (transient, caller-driven)

Best when the caller knows the kind and you don't persist the objects. Type-safety flows from the registry via `keyof typeof` + `ReturnType`, so the output type is inferred from the key you pass.

```ts
// src/entities/registry.ts
import { withDefaults } from "./withDefaults";

// per-kind default state, each its own builder
const barDefaults = { kind: "bar" as const, stack: undefined as string | undefined, data: [] as number[] };
const lineDefaults = { kind: "line" as const, smooth: false, data: [] as number[] };

export const buildBar = withDefaults(barDefaults);
export const buildLine = withDefaults(lineDefaults);

// the registry — new kinds register HERE and nowhere else
const BUILDERS = {
  bar: buildBar,
  line: buildLine
} as const;

export type Kind = keyof typeof BUILDERS;                       // "bar" | "line"
type Builder<K extends Kind> = (typeof BUILDERS)[K];
type Overrides<K extends Kind> = Partial<Parameters<Builder<K>>[0]>;
type Result<K extends Kind> = ReturnType<Builder<K>>;

// one generic dispatcher; the return type is inferred from `kind`
export function createEntity<K extends Kind>(kind: K, overrides: Overrides<K> = {}): Result<K> {
  const build = BUILDERS[kind] as Builder<K>;
  if (!build) throw new Error(`Unknown kind: ${kind}`);
  return build(overrides as never) as Result<K>;
}

// usage — `bar` is typed { kind:"bar"; stack?; data:number[] }
const bar = createEntity("bar", { stack: "total", data: [1, 2, 3] });
```

## Variant B — `__class__` discriminant carried in the data (persisted / serialized)

Best when entities are saved and rehydrated: the stored blob describes itself, and you get a real discriminated union that narrows automatically.

```ts
// src/entities/types.ts
export enum EntityClass {
  Bar = "BarEntity",
  Line = "LineEntity",
  Pie = "PieEntity"
}

interface Base { id: string; __class__: EntityClass; }        // the discriminant
export interface BarEntity  extends Base { __class__: EntityClass.Bar;  stack?: string; data: number[]; }
export interface LineEntity extends Base { __class__: EntityClass.Line; smooth: boolean; data: number[]; }
export interface PieEntity  extends Base { __class__: EntityClass.Pie;  donut: boolean; data: number[]; }

export type AnyEntity = BarEntity | LineEntity | PieEntity;    // the union
export type EntityState = Base & Record<string, unknown>;       // raw, pre-build

// src/entities/factory.ts
import { EntityClass, type AnyEntity, type EntityState } from "./types";
import { createBar } from "./bar";
import { createLine } from "./line";
import { createPie } from "./pie";

const FACTORY: Record<EntityClass, (uid: string, s: EntityState) => AnyEntity> = {
  [EntityClass.Bar]: createBar,
  [EntityClass.Line]: createLine,
  [EntityClass.Pie]: createPie
};

/** Dispatch on the discriminant carried in the data. */
export function generateEntity(uid: string, state: EntityState): AnyEntity | undefined {
  const build = FACTORY[state.__class__];
  if (!build) return undefined;          // (or throw — your call for unknown persisted kinds)
  return build(uid, state);
}

// downstream code narrows for free:
function render(e: AnyEntity) {
  switch (e.__class__) {
    case EntityClass.Bar:  return e.stack;   // e is BarEntity here
    case EntityClass.Line: return e.smooth;  // e is LineEntity here
    case EntityClass.Pie:  return e.donut;   // e is PieEntity here
  }
}
```

## Composing builders from shared helpers (both variants)

Keep cross-cutting concerns in one place; a builder is *shared pieces + the unique bit*. If your stack has Ramda (or any `pipe`), make the composition explicit:

```ts
import { pipe } from "ramda";

// shared, reused by every kind
const withBaseAxes = (s: EntityState) => ({ ...s, xAxis: defaultXAxis(), yAxis: defaultYAxis() });
const withPalette  = (s: EntityState) => ({ ...s, color: resolveSeriesColors(s) });

// per-kind builder = translate → default-fill → decorate with shared stages
export const createBar = (uid: string, state: EntityState): BarEntity =>
  pipe(
    () => barState(state),   // withDefaults(barDefaults)
    withBaseAxes,
    withPalette,
    (s) => ({ id: uid, ...s }) as BarEntity
  )(undefined);
```

Without a `pipe` helper, plain function nesting or object spread of helper outputs works the same way — the point is that `withBaseAxes`/`withPalette` are written once and reused across `createBar`, `createLine`, `createPie`.

## Adding a new kind (walkthrough) — e.g. a "scatter"

1. **Enum:** add `Scatter = "ScatterEntity"` to `EntityClass` (Variant B) or `scatter` to the registry keys (Variant A). For Variant B also add `ScatterEntity` to the `AnyEntity` union.
2. **Defaults + state builder:** `const scatterDefaults = {…}; export const scatterState = withDefaults(scatterDefaults);`
3. **Builder:** `export const createScatter = (uid, s) => pipe(() => scatterState(s), withBaseAxes, …)(undefined);`
4. **Register one entry:** `[EntityClass.Scatter]: createScatter` (or `scatter: buildScatter`).

Nothing else changes — `generateEntity` / `createEntity` and every consumer pick it up. If a new kind is identical to an existing one, just point the registry entry at the existing builder.
