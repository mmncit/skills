# External stores, libraries, and useSyncExternalStore

Reach for an external library only after the decision ladder in SKILL.md — i.e. after deriving, refs, URL, and server-state libraries have already removed everything they should. Signs you genuinely need one: prop-drilling hell, multiple components keeping separate copies of the same data, a single big Context re-rendering all consumers, or business logic scattered across components and hard to test.

## Stores vs atoms

**Store-based** (Zustand, Redux Toolkit, XState Store): centralized state, updates flow through defined actions/events, indirect mutation. Best when state pieces depend on each other, you need predictable/traceable updates, or several developers share state logic. Benefits: single source of truth, great devtools, clear separation of business logic, strong TypeScript support.

**Atomic** (Jotai, Recoil, XState Store): state split into independent atoms, reactive subscriptions, updatable from anywhere. Best when state is updated from external sources, pieces are mostly independent, state is component-specific, or you need fine-grained subscriptions. Benefits: automatic optimization, selective re-rendering, highly composable, natural code splitting.

You can combine them — store for core business workflows, atoms for UI-specific bits:

```tsx
const useBookingStore = create<BookingStore>(/* ... */); // core logic
const themeAtom = atom<'light' | 'dark'>('light');       // UI state
const sidebarOpenAtom = atom(false);
```

## Always subscribe with selectors

Whatever the library, read the *slice* you need so a component only re-renders when that slice changes, not on every store update.

```tsx
// Only re-renders when count changes
const count = useStore((state) => state.count);
```

This is also the fix for "Context re-renders everything": move high-frequency shared values into a store with selectors, or split the Context.

## useSyncExternalStore for data that lives outside React

For state that exists outside React's tree — browser APIs (online/offline, media queries, window size), a vanilla store, websocket/SSE data — don't sync it by hand with `useEffect` + `useState` (race conditions on initial value, hydration mismatches, extra renders). Use `useSyncExternalStore`: it subscribes, snapshots atomically, and takes a separate server snapshot to avoid hydration mismatches.

```tsx
// Avoid: manual subscribe + initial-value dance
const [isOnline, setIsOnline] = useState(true);
useEffect(() => {
  const on = () => setIsOnline(true);
  const off = () => setIsOnline(false);
  window.addEventListener('online', on);
  window.addEventListener('offline', off);
  setIsOnline(navigator.onLine);
  return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
}, []);

// Prefer: useSyncExternalStore
const isOnline = useSyncExternalStore(
  (cb) => {
    window.addEventListener('online', cb);
    window.addEventListener('offline', cb);
    return () => { window.removeEventListener('online', cb); window.removeEventListener('offline', cb); };
  },
  () => navigator.onLine, // client snapshot
  () => true              // server snapshot (avoids hydration mismatch)
);
```

Use it for: third-party stores, custom reusable hooks over external data, browser APIs, real-time connections. Not needed for plain React state, Context values, props, or derived data.

Libraries to know: XState Store, Zustand, Jotai, Redux Toolkit.
