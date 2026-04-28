---
name: state-management
description: "Refine and review state management in React and TypeScript applications. Use when: designing component state, reviewing useState usage, choosing between local and global state, preventing unnecessary re-renders, selecting state management libraries, applying discriminated unions, deriving state, or managing refs vs state."
---

# State Management

Guidelines for clean, performant, and type-safe state management in React and TypeScript applications.

## When to Use

- Designing or reviewing component state structure
- Deciding between `useState`, `useRef`, or derived values
- Choosing a third-party state management library
- Applying TypeScript patterns for type-safe state
- Fixing unnecessary re-renders caused by state design

## Structuring State

### Group Related State

Group related data into a single object instead of maintaining multiple independent `useState` calls. This keeps updates consistent and reduces the chance of state getting out of sync.

```tsx
// Avoid: separate variables for related data
const [firstName, setFirstName] = useState("");
const [lastName, setLastName] = useState("");
const [email, setEmail] = useState("");

// Prefer: single object for related data
const [formData, setFormData] = useState({
  firstName: "",
  lastName: "",
  email: "",
});
```

### Use Previous State When Updating Objects

Always use the callback form of the setter when the new state depends on the previous state. This avoids closure issues that lead to stale or lost updates.

```tsx
// Avoid: spreading directly (risks stale closures)
setFormData({ ...formData, email: newEmail });

// Prefer: callback with previous state
setFormData((prev) => ({ ...prev, email: newEmail }));
```

## Derive State — Don't Duplicate It

Compute values directly during rendering instead of maintaining separate state variables for derived information.

```tsx
// Avoid: duplicated state
const [hotels, setHotels] = useState<Hotel[]>([]);
const [selectedHotel, setSelectedHotel] = useState<Hotel | null>(null);

// Prefer: store only the ID, derive the object
const [hotels, setHotels] = useState<Hotel[]>([]);
const [selectedHotelId, setSelectedHotelId] = useState<string | null>(null);
const selectedHotel = hotels.find((h) => h.id === selectedHotelId) ?? null;
```

**Principle:** If a value can be computed from existing state or props, derive it during rendering rather than storing it separately.

## When NOT to Use `useState`

Avoid `useState` for:

| Scenario                                     | Use Instead                      |
| -------------------------------------------- | -------------------------------- |
| Static values that never change              | `const` or module-level variable |
| Values computable from existing state/props  | Derive inline during render      |
| Values that don't need to trigger re-renders | `useRef`                         |

### Use `useRef` for Non-Rendering Values

For values that update frequently but should not cause re-renders, use `useRef`.

**Scroll position tracking:**

```tsx
const scrollPosition = useRef(0);

useEffect(() => {
  const handleScroll = () => {
    scrollPosition.current = window.scrollY;
  };
  window.addEventListener("scroll", handleScroll);
  return () => window.removeEventListener("scroll", handleScroll);
}, []);
```

**Timer IDs:**

```tsx
const timerId = useRef<ReturnType<typeof setTimeout> | null>(null);

const startTimer = () => {
  timerId.current = setTimeout(() => {
    // ...
  }, 1000);
};

const stopTimer = () => {
  if (timerId.current) clearTimeout(timerId.current);
};
```

## TypeScript Patterns for Type-Safe State

### Finite States

Represent a limited, predefined set of possible states to simplify state tracking and prevent impossible combinations.

```tsx
type RequestStatus = "idle" | "loading" | "success" | "error";

const [status, setStatus] = useState<RequestStatus>("idle");
```

### Discriminated Unions

Use a shared `status` property to differentiate state shapes, ensuring type safety and consistent state representation.

```tsx
type RequestState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: Data }
  | { status: "error"; error: Error };

const [state, setState] = useState<RequestState>({ status: "idle" });

// TypeScript narrows the type automatically
if (state.status === "success") {
  console.log(state.data); // ✓ data is available
}
```

### Type States

Enforce data consistency by ensuring certain properties only exist in specific state conditions. This prevents runtime errors and provides compile-time type checking.

```tsx
type FormState =
  | { submitted: false; values: FormValues }
  | { submitted: true; values: FormValues; response: ServerResponse };
```

## Choosing a Third-Party State Management Library

### When You Need One

Look for these signs:

- Over-relying on React Context for frequently changing values
- Prop drilling across many component layers
- Scattered state logic that's hard to follow
- State synchronization issues between components
- Frequent unnecessary re-renders

### Two Main Approaches

| Approach                                                | Characteristics                                                                 | Best For                                                                |
| ------------------------------------------------------- | ------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| **Store-based** (e.g. Zustand, Redux)                   | Centralized state, controlled transitions via actions/events, indirect mutation | Complex logic, strict state control                                     |
| **Atomic / Signal-based** (e.g. Jotai, Recoil, Signals) | Decentralized atoms, reactive subscriptions, updatable from anywhere            | Data that changes freely from external sources, fine-grained reactivity |

### Decision Guide

- **Complex logic with controlled transitions** → Store-based. Prevents arbitrary changes; state flows through defined actions.
- **Data that changes freely from external sources** (e.g. real-time updates, flash sales) → Atomic/signal-based. Allows updating from anywhere and combining/deriving state from multiple sources.

### Performance: Fine-Grained Subscriptions

Use selectors (e.g. `useSelector`, Zustand selectors) so components only re-render when the specific slice of state they consume changes, rather than on every store update.

```tsx
// Only re-renders when `count` changes, not the entire store
const count = useStore((state) => state.count);
```

## Procedure

When reviewing or designing state in a component:

1. **Inventory all state variables.** List every `useState` call.
2. **Group related state.** Merge variables that always update together into a single object.
3. **Eliminate derived state.** Remove any state that can be computed from other state or props; compute it inline.
4. **Swap non-rendering values to refs.** Timer IDs, scroll positions, previous values — move them to `useRef`.
5. **Apply finite states.** Replace boolean flags with a status union type when possible.
6. **Use discriminated unions.** For multi-shape state, add a `status` discriminator and let TypeScript narrow types.
7. **Evaluate library need.** If prop drilling, context overuse, or sync issues persist, consider a store-based or atomic library based on the decision guide above.
