---
name: react-state
description: "Architect, refactor, and review state management in React + TypeScript (and Next.js) apps. Use this skill whenever the user is deciding where a piece of state should live, refactoring useState/useEffect, fixing impossible states or stale/derived state, untangling cascading effects, handling forms, syncing state to the URL, fetching server data, normalizing nested data, choosing a state library (Zustand, Jotai, Redux, XState Store), subscribing to external/browser stores, or testing state logic. Trigger it even when the user just describes the symptom — 'my component re-renders too much', 'these two states get out of sync', 'I have five useEffects calling each other', 'I lose my filters on refresh', 'loading flag and error flag are both true' — not only when they say the words 'state management'."
---

# React State Management

State bugs almost always trace back to one root cause: **a piece of state is in the wrong place, or it shouldn't be state at all.** Most of the work is deciding *where each value lives*, then expressing changes as **events** rather than scattered mutations. Get the placement right and whole categories of bugs (stale data, impossible states, race conditions, re-render storms) disappear.

Apply the decision framework below first. Reach for libraries last.

## The core question: where should this value live?

For every value a component touches, walk this ladder top to bottom and stop at the first match. Each rung is cheaper and less bug-prone than the one below it.

1. **Can I compute it from existing state/props?** → **Derive it inline during render.** Don't store it. (totals, filtered/sorted lists, the selected object from a list of IDs, "is the form valid"). Only wrap in `useMemo` if the calc is genuinely expensive *and* its inputs change rarely.
2. **Does changing it need to re-render the UI?** If no → **`useRef`.** (timer IDs, scroll position, previous values, analytics counters, the latest event without a redraw.)
3. **Should it survive a refresh or be shareable/bookmarkable?** → **URL query params** (via `nuqs`). (search filters, sort, pagination, active tab, selected category.) See `references/url-state.md`.
4. **Does it come from a server?** → **a server-state library** (TanStack Query), not `useEffect` + `useState`. (fetched lists, the booking record, anything cached.) See `references/server-state.md`.
5. **Does it live outside React?** → **`useSyncExternalStore`.** (network status, media queries, a vanilla store, websocket data.) See `references/external-stores.md`.
6. **Is it genuinely local component state that drives rendering?** → **`useState`**, or **`useReducer`** once multiple values change together or transitions get interesting (see below).
7. **Is it shared across a deep tree, with the above already applied?** → Context for low-frequency values; a **store with selectors** (Zustand/Redux/XState Store) or **atoms** (Jotai) for frequently-changing shared state. See `references/external-stores.md`.

> The single most common mistake is stopping too low on this ladder — using `useState` (rung 6) for something that is derived (rung 1), server data (rung 4), or URL state (rung 3).

## Model before you build

For anything beyond a trivial component, spend a few minutes modeling in plain text *before* coding — it surfaces edge cases and impossible states early. Sketch the entities (what data + relationships), the sequence (what calls what, in what order), and the states (what the user sees, what's stored, what's happening behind the scenes, and which events move between them). This is where you discover that "loading", "error", and "data" are really one `status` value, not three booleans. See `references/modeling.md`.

## Events are the source of truth

When several values change together or in response to a user action, don't fire off setters one by one. Name the **event** that happened (`flightSelected`, `searchSubmitted`, `searchFailed`) and let one reducer compute the next state. State is a *snapshot derived from events* — this gives you an audit trail, predictable transitions, testable pure logic, and no race conditions. This mindset is what kills the "cascading `useEffect`" anti-pattern (effects that trigger other effects). See `references/antipatterns.md` and `references/finite-state.md`.

## Make impossible states impossible

Multiple booleans multiply into invalid combinations (`isLoading && isError` both true — now what?). Replace them with a single discriminated union where each state carries exactly the data it needs:

```tsx
// Avoid: booleans that allow impossible combinations
const [isLoading, setIsLoading] = useState(false);
const [isError, setIsError] = useState(false);
const [data, setData] = useState<Data | null>(null);

// Prefer: one value, impossible states unrepresentable
type State =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; error: string }
  | { status: 'success'; data: Data };

const [state, setState] = useState<State>({ status: 'idle' });
if (state.status === 'success') state.data; // ✓ TypeScript narrows; data only exists here
```

See `references/finite-state.md` for discriminated unions, `useReducer`, Context + custom hooks, and type-states.

## Refactor procedure

When asked to refactor or review state in a component, work through these in order:

1. **Inventory every `useState`/`useEffect`** and note what triggers each update and why.
2. **Delete derived state.** Anything computable from other state/props → compute inline. Remove the `useEffect` that was syncing it (rung 1).
3. **Move non-rendering values to `useRef`** — timer IDs, scroll positions, previous values (rung 2).
4. **Relocate misplaced state** — server data → query library (rung 4); shareable/persistent → URL (rung 3); external source → `useSyncExternalStore` (rung 5).
5. **Group related fields** that always change together into one object; update with the callback form `setState(prev => ...)` to avoid stale closures.
6. **Collapse boolean flags** into a `status` discriminated union (impossible states).
7. **Convert cascading effects to events** — replace chains of effects with a `useReducer` whose actions are business events, plus at most one effect that runs side effects off the current status. See `references/antipatterns.md`.
8. **Normalize nested data** if updates require deep `map`/`filter` gymnastics — store entities by ID, reference by ID. See `references/normalization.md`.
9. **Only now consider a library**, if prop drilling, Context overuse, or sync issues persist. See `references/external-stores.md`.
10. **Extract pure logic so it's testable** without rendering. See `references/testing.md`.

## Quick anti-pattern reference

| Symptom | Root cause | Fix |
| --- | --- | --- |
| Two states drift out of sync | One is derived from the other but stored separately | Derive inline; delete the duplicate (rung 1) |
| `useEffect` copies state A → state B | Syncing derived state via effect | Compute B during render |
| Re-renders on every change, no visual update | `useState` for a non-render value | `useRef` (rung 2) |
| `isLoading`/`isError`/`isSuccess` booleans | Impossible state combinations | One `status` union |
| 3–5 effects triggering each other | Reactive thinking ("when X changes…") | Event-driven `useReducer` + 1 effect |
| Filters lost on refresh / not shareable | UI state kept local | URL query params (`nuqs`) |
| Manual `isLoading`/`error` around `fetch` in `useEffect` | Server state treated as local state | TanStack Query (rung 4) |
| Storing a whole object when you only pick by ID | Redundant state, stale references | Store the ID, derive the object via `.find()` |
| Deep `map(...map(...filter))` to update one item | Nested data structure | Normalize: entities keyed by ID |
| `useEffect` + `useState` to track `navigator.onLine` etc. | External store synced manually | `useSyncExternalStore` (rung 5) |
| Whole Context re-renders all consumers | High-frequency value in Context | Store with selectors, or split contexts |

## Reference files

Read the relevant file before doing deep work in that area:

- `references/antipatterns.md` — derived state, refs vs state, redundant state, and cascading effects → event-driven reducer (with before/after code).
- `references/finite-state.md` — discriminated unions, `useReducer`, Context + custom hooks, type-states, grouping state.
- `references/forms.md` — FormData + server actions + `useActionState` + Zod; when to prefer controlled `useState` instead.
- `references/url-state.md` — `nuqs` for type-safe, shareable URL query state.
- `references/server-state.md` — TanStack Query: query keys, caching, mutations, why not `useEffect`.
- `references/normalization.md` — flat vs nested data, entities-by-ID, why it speeds updates and re-renders.
- `references/external-stores.md` — stores vs atoms, choosing a library, selectors, `useSyncExternalStore`.
- `references/modeling.md` — entity/sequence/state diagrams to do before building.
- `references/testing.md` — testing reducers and pure logic instead of UI.
