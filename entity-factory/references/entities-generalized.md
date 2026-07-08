# Case study: xyz generic entity system (`__class__` union)

`xyz` (Svelte-store 3D/geoscience app, Ramda) is the **fully generalized** version of the eva chart pattern: not chart-specific, but one entity system where charts are just a few entries among many (blockmodels, surfaces, points, filters, mappings, textures, scenes, views). The "kind" is carried **in the data** as a `__class__` field, giving a real discriminated union. This is the template eva's chart registry is converging toward.

## `FACTORY_MAP` keyed by the `__class__` discriminant

`src/state/entities/factory.ts` — ~45 entries spanning `Array` / `Element` / `View` / `Filter` / `Mapping` / `Scene` / `Texture` classes:

```ts
// src/state/entities/factory.ts
export const FACTORY_MAP: { [key: string]: (uid: any, state: any) => AllEntities } = {
  [ArrayClass.Color]: createArrayColor,
  [ElementClass.Points]: createPointsElement,
  [ViewClass.LineGraph]: createLineGraphsView,
  [FilterClass.Numeric]: createNumericFilter,
  [MappingClass.Continuous]: createContinuousMapping
  // …
};

export function generateEntity<T extends EntityState>(uid: string, state: T): Maybe<AllEntities> {
  const factory = FACTORY_MAP[state.__class__]; // dispatch on the discriminant in the data
  if (!factory) return undefined;
  return factory(uid, state);
}
```

Unlike eva (kind passed as an argument), the kind travels with the entity — so persisted state rehydrates itself: read the blob, `generateEntity(uid, blob)`, done. Consumed by `src/controllers/state/index.ts` and `src/state/entities/index.ts`.

## The discriminated union

`src/types/entities/entity.ts`:

```ts
export type AllEntityClasses =
  | ArrayClass | ElementClass | FilterClass | GenericAttributeClass
  | MappingClass | MiscClass | SceneClass | TextureClass | ViewClass;

export interface EntityState {
  id: string;
  __class__: AllEntityClasses; // the discriminant
}
```

Each class is a string enum (`ViewClass.LineGraph = "LineGraphView"`, …). `AllEntities` is the union of concrete entity types. Builder contract: `(uid: string, state: SomeInternalState) => Entity<T>`.

## Two primitives: state factory + entity factory

State atom — `src/types/entities/factory.ts`, the direct analogue of eva's `createStateWithDefaults`, but strips unknown keys with Ramda `pick`/`keys`:

```ts
// src/types/entities/factory.ts
export function createStateFactory<T extends GenericObject>(defaultState: T) {
  return (overrides: Partial<T>): T => {
    const stateKeys = keys(defaultState as any) as any;
    return pick(stateKeys, { ...defaultState, ...(overrides ?? {}) }) as T;
  };
}
```

Entity atom — `src/state/entities/generate.prototype.ts` — `createEntityFactory({ defaultState, tweenedKeys, meta })` returns `(initialState) => createEntity(…)`. Shared behavior (subscription, tweening/animation, dirty-tracking, destroy) is factored once into `createEntity` and reused by every entity type — the same "shared behavior in one place" idea as eva's `options/*` helpers, but for lifecycle instead of chart sub-parts.

## Builders are explicit `pipe` compositions

`src/utils/fp.ts` re-exports Ramda `pipe`, `pick`, `keys`, `map`, `omit`, `curryN`, `prop`. Each builder is `pipe(translate → generateState → entityFactory)`:

```ts
// src/state/entities/points.ts
export const createPointsElement = pipe(
  translateToEntity,          // raw input → normalized
  generatePointsElementState, // → default-filled state (createStateFactory)
  createPointsElementEntity   // → live Entity<T> (createEntityFactory)
);

// src/state/entities/linegraphs.ts
export const createLineGraphsView = pipe(
  translateToView, generateLineGraphsViewState, createLineGraphsViewEntity
);
```

## Adding an entity type

1. Add a member to the relevant `*Class` enum in `types/entities/entity.ts` (it's automatically part of the `AllEntities` union).
2. Define `DEFAULT_*` + `generate*State` (via `createStateFactory`) in `types/entities/*.ts`.
3. Write `createX = pipe(translate…, generate…State, createEntityFactory({ defaultState, tweenedKeys }))` in `state/entities/*.ts`.
4. Register `[SomeClass.X]: createX` in `FACTORY_MAP`.

`generateEntity` and every consumer pick it up generically — no dispatch edits.

## Why this is the mature template

eva proves the pattern per-domain (charts) with kind-as-argument; xyz proves it works as a **whole-project entity layer** with a `__class__` union and `pipe` composition. If your project will grow many entity families that get persisted, start from xyz's shape (`references/starter.md` Variant B). If you just need extensible charts/widgets in one area, eva's kind-as-argument shape (Variant A) is lighter. Both share the identical spine: **enum of kinds → `Record<Kind, builder>` + one dispatcher → pure builders from a `withDefaults` factory → shared behavior in reusable helpers.**
