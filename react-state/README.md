# react-state

A coding-guideline skill for state management in React and Next.js with TypeScript. State bugs almost always trace back to one root cause: a value is in the wrong place, or it should not be state at all.

Get the placement right and whole categories of bug disappear, including stale data, impossible states, race conditions and re-render storms. Libraries come last, not first.

## Where should this value live?

Walk the ladder top to bottom and stop at the first match. Each rung is cheaper than the one below it.

1. Computable from existing state or props, so derive it during render.
2. Does not need to re-render anything, so `useRef`.
3. Should survive a refresh or be shareable, so URL query params.
4. Comes from a server, so a server-state library rather than `useEffect` plus `useState`.
5. Lives outside React, so `useSyncExternalStore`.
6. Genuinely local and drives rendering, so `useState`, or `useReducer` once several values change together.
7. Shared across a deep tree with all of the above applied, so Context for low-frequency values, or a store with selectors.

The most common mistake is stopping too low: reaching for `useState` on something that is derived, server data, or URL state.

## Contents

| File | What it is |
|---|---|
| `SKILL.md` | The placement ladder, modelling before building, events as the source of truth, making impossible states impossible, a refactor procedure, and a symptom-to-fix table. |
| `references/antipatterns.md` | Derived state, refs versus state, redundant state, and cascading effects rewritten as an event-driven reducer, with before and after code. |
| `references/finite-state.md` | Discriminated unions, `useReducer`, Context with custom hooks, type-states, grouping state. |
| `references/forms.md` | FormData with server actions, `useActionState` and Zod, and when controlled `useState` is still the better choice. |
| `references/url-state.md` | `nuqs` for type-safe, shareable URL query state. |
| `references/server-state.md` | TanStack Query: query keys, caching, mutations, and why not `useEffect`. |
| `references/normalization.md` | Flat versus nested data, entities keyed by ID, and the effect on updates and re-renders. |
| `references/external-stores.md` | Stores versus atoms, choosing a library, selectors, `useSyncExternalStore`. |
| `references/modeling.md` | Entity, sequence and state diagrams to draw before building. |
| `references/testing.md` | Testing reducers and pure logic instead of UI. |

## When it fires

Deciding where a piece of state should live · refactoring `useState` and `useEffect` · impossible states, or state that goes stale · untangling effects that cascade into each other · forms · syncing state to the URL · fetching server data · normalizing nested data · choosing between Zustand, Jotai, Redux and XState Store · subscribing to an external or browser store · testing state logic

It fires on symptoms too, not just on the words "state management": "my component re-renders too much", "these two states get out of sync", "I have five `useEffect`s calling each other", "I lose my filters on refresh", "loading and error are both true".

## When it does not

A component with two or three `useState` calls that nobody is confused by does not need a review. Server Components holding no client state are outside the ladder entirely. The library guidance at rung 7 assumes you have already applied rungs 1 to 6, so reaching for a store to fix re-renders caused by derived state will not help. And this skill is React-specific: the same modelling problem outside React belongs with [discriminated-unions](../discriminated-unions/).

## Siblings

| What you are looking at | Skill |
|---|---|
| The non-React version: correlated optional fields, choosing the discriminant, exhaustiveness | [discriminated-unions](../discriminated-unions/) |
