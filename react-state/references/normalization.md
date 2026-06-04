# Data normalization

Deeply nested data makes every update a traversal and recreates large object trees, causing complexity and unnecessary re-renders. Store entities in flat collections keyed by ID and reference them by ID.

```ts
// Avoid: nested — updating one todo means mapping destinations AND their todos
interface NestedState {
  destinations: Array<{
    id: string;
    name: string;
    todos: Array<{ id: string; text: string }>;
  }>;
}

// Prefer: normalized — each entity type in its own keyed collection
interface NormalizedState {
  destinations: { [id: string]: { id: string; name: string } };
  todos: { [id: string]: { id: string; text: string; destinationId: string } };
}
```

The payoff shows up in updates. Nested deletion requires nested immutable rebuilding:

```ts
// Nested: O(n×m), error-prone
destinations: state.destinations.map((dest) =>
  dest.id === action.destinationId
    ? { ...dest, todos: dest.todos.filter((t) => t.id !== action.todoId) }
    : dest
);
```

Normalized deletion is direct:

```ts
// Normalized: O(1)-ish, obvious
case 'DELETE_TODO': {
  const { [action.todoId]: _removed, ...todos } = state.todos;
  return { ...state, todos };
}
```

Why it helps: O(1) lookups by ID instead of nested scans; only the components reading the changed entity re-render; reducer logic stays flat and predictable; and cross-entity features (global search, bulk select/delete, undo/redo) become straightforward. Reach for normalization when you find yourself writing `map` inside `map` inside `filter` to touch a single item. Some libraries (Redux Toolkit's `createEntityAdapter`) provide normalization helpers.
