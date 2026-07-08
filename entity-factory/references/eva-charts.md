# Case study: eva-web-ui charts (kind-as-argument)

`eva-web-ui` (React + TypeScript + ECharts) builds ~15 chart types with **two parallel registries** keyed by chart enums, plus a generic dispatcher. The "kind" is passed as an argument, not carried in the data.

## Two registries, one shape

**Request factory** — `src/entities/charts/factory.ts`. `GENERATORS` maps enum members (`EntityType.*`, `EvaChart.*`, `ChartOption.*`) to `generate*` functions; `createEntityState` dispatches:

```ts
// src/entities/charts/factory.ts
const GENERATORS = {
  [EntityType.Chart]: generateChartEntity,
  [EvaChart.RateCum]: generateRateCumRequestBody,
  [EvaChart.StackedBar]: generateStackedBarRequestBody,
  [ChartOption.LineSeries]: generateLineSeriesOptions
  // …30+ feature entities also live here
};
export type Generators = keyof typeof GENERATORS;

export function createEntityState<K extends Generators>(
  type: K,
  state: Partial<ReturnType<(typeof GENERATORS)[K]>>
): ReturnType<(typeof GENERATORS)[K]> {
  const generator = GENERATORS[type];
  if (!generator) throw new Error(`Unknown entity type: ${type} to create state`);
  return generator(state) as ReturnType<(typeof GENERATORS)[K]>;
}
```

**Response→ECharts-option translator factory** — `src/entities/charts/translators.ts`. `TRANSLATOR_MAP` maps `EvaChart` kinds to pure `translate*ResponseToOptions` functions; `translateToOptions` dispatches:

```ts
// src/entities/charts/translators.ts
export const TRANSLATOR_MAP = {
  [EvaChart.RateCum]: translateRateCumResponseToOptions,
  [EvaChart.StackedBar]: translateStackedBarResponseToOptions,
  [EvaChart.Mosaic]: translateMosaicResponseToOptions,
  [EvaChart.MosaicMidstream]: translateMosaicResponseToOptions // reuses its onshore twin
};
export function translateToOptions(
  { type, states }: { type: EvaChart; states: Partial<EvaChartStates> }
): EChartsOption {
  const translator = TRANSLATOR_MAP[type];
  if (!translator) throw new Error(`Unknown chart type: ${type} to translate`);
  return translator(states);
}
```

Consumers never branch on type — hooks like `src/hooks/charts/echart/useChartOptions.ts` just call `translateToOptions` / `createEntityState`.

## The primitive: `createStateWithDefaults`

`src/entities/utils.ts` — a factory-of-factories; the atom under every `generate*` in `GENERATORS`:

```ts
// src/entities/utils.ts
export function createStateWithDefaults<T extends GenericObject>(defaultState: T) {
  return (overrides: Partial<T> = {}): T => ({ ...defaultState, ...overrides });
}
```

Sub-part defaults live in `src/entities/charts/options/*` — `generateChartOptions` (shared toolbox/dataZoom/grid/tooltip), `generateBarSeriesOptions`, plus `xAxis.ts`, `yAxis.ts`, `title.ts`, `line.ts`, `scatter.ts`, `pie.ts`, `box.ts`, `mosaic.ts` (barrel: `options/index.ts`). Each is `generateX = createStateWithDefaults(DEFAULT_X)`.

## A translator is a pure `states → EChartsOption` that composes those pieces

```ts
// src/entities/charts/eva/translators/stackedBar.ts
let options = createEntityState(ChartOption.Chart, {
  chartType,
  title: { ...createEntityState(ChartOption.Title, { text: formatChartTitleWithSubscript(title) }) },
  yAxis: { ...createEntityState(ChartOption.YAxis, { name, min: lockedYMin, max: lockedYMax }) },
  xAxis: { ...createEntityState(ChartOption.XAxisCategory, { data: layout.xAxis.data }) },
  series: series.map((location, index) =>
    createEntityState(ChartOption.Bar, { id, name: label, data, itemStyle: { color: style?.hexColor }, stack: "stackedBar" })
  )
});
```

Cross-type domain helpers are imported, not duplicated: `getEffectiveSeriesColor.ts` (color resolution), `mpcTranslatorHelpers.ts` (`buildProductStyleMap`, `getLineStyleForSeries`, `getYAxisPosition`), `utils.ts` (`formatChartTitleWithSubscript`, `getTimeSeriesMinMax`, `createLogAxisLabelFormatter`), `../locks` (`createChartLocks`), `constants.ts`.

## The type contract

- Builder input: `Partial<EvaChartStates>` — a large intersection in `src/types/factory.ts` (`IChartResult & ChartDependencies & EvaChartFeatures & ChartEntities & { chartType: EvaChart; series; layout; entityKind; … }`). Output: `EChartsOption`.
- Discriminant: the `EvaChart` string enum (`constants/charts.enums.ts`) for translators/requests; `EntityType` / `ChartOption` for entity/option generators. The kind is **passed as the dispatch argument**, not stored on the object.
- The dispatcher stays type-safe via `keyof typeof GENERATORS` + `ReturnType`, so the returned state type is inferred from the enum key.

## Adding a chart type

1. Add a member to the `EvaChart` enum.
2. Write `translateXResponseToOptions(states)` in `eva/translators/`, composing `createEntityState`, the `options/*` builders, and shared helpers; export from `eva/translators/index.ts`.
3. Register it in `TRANSLATOR_MAP`. Write `generateXRequestBody` and register in `GENERATORS`.

No dispatcher or hook changes. Note the folder is `src/entities/` (with a sibling `src/entities/map/`) and `GENERATORS` already mixes charts with 30+ non-chart feature entities — eva has *started* generalizing the chart pattern into a project-wide entity registry. See `references/entities-generalized.md` for where that leads.
