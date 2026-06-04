# Anti-patterns and their fixes

The four highest-value refactors. Each shows the symptom, why it bites, and the fix.

## 1. Derived state stored separately

If you can calculate it, don't store it. Storing derived values and syncing them with an effect creates a second source of truth that drifts.

```tsx
// Avoid: state + effect to keep a total in sync
const [tripItems] = useState([{ name: 'Flight', cost: 500 }, { name: 'Hotel', cost: 300 }]);
const [totalCost, setTotalCost] = useState(0);
useEffect(() => {
  setTotalCost(tripItems.reduce((sum, i) => sum + i.cost, 0));
}, [tripItems]);

// Prefer: derive during render — always correct, no effect, no extra state
const totalCost = tripItems.reduce((sum, i) => sum + i.cost, 0);
```

Other things that are almost always derived, not stored: filtered/sorted lists, computed totals, "is valid" flags, available-items from excluded-items. Reach for `useMemo` only when the computation is expensive *and* its dependencies change infrequently — it's an optimization, not the default.

## 2. `useState` for values that don't drive rendering

`useState` triggers a re-render on every change; `useRef` does not. Use a ref for anything the UI doesn't read during render.

```tsx
// Avoid: timer ID in state — every set re-renders, and the cleanup effect re-runs each time
const [timerId, setTimerId] = useState<NodeJS.Timeout | null>(null);
const start = () => setTimerId(setInterval(tick, 1000));
useEffect(() => () => timerId && clearInterval(timerId), [timerId]);

// Prefer: ref — no re-render, effect runs once
const timerIdRef = useRef<NodeJS.Timeout | null>(null);
const start = () => { timerIdRef.current = setInterval(tick, 1000); };
useEffect(() => () => { if (timerIdRef.current) clearInterval(timerIdRef.current); }, []);
```

Good ref use cases: timer/interval IDs, scroll position, previous prop/state values, analytics counters, caching a value read only in event handlers.

## 3. Redundant state — storing an object when an ID suffices

Storing a full object copies data that already lives in the source array. When the array updates, the copy goes stale. Store the **ID**, derive the object.

```tsx
// Avoid: stores the whole selected object
const [selectedHotel, setSelectedHotel] = useState<Hotel | null>(null);

// Prefer: store the ID, look up the current object during render
const [selectedHotelId, setSelectedHotelId] = useState<string | null>(null);
const selectedHotel = hotels.find((h) => h.id === selectedHotelId) ?? null;
```

Single source of truth: store the minimal thing, derive everything else. This also avoids formatting data into state — format during render instead.

## 4. Cascading effects → event-driven reducer

The worst offender at scale: effects that set state that triggers other effects. The logic flow hops between effect blocks, runs in surprising orders, creates race conditions, and is miserable to debug.

```tsx
// Avoid: four effects chained through boolean flags
useEffect(() => { if (destination && startDate && endDate) setIsSearchingFlights(true); }, [destination, startDate, endDate]);
useEffect(() => { if (!isSearchingFlights) return; /* search */ }, [isSearchingFlights]);
useEffect(() => { if (selectedFlight) setIsSearchingHotels(true); }, [selectedFlight]);
useEffect(() => { if (!isSearchingHotels) return; /* search */ }, [isSearchingHotels]);
```

Reframe each transition as an **event** — ask "what user action or business event caused this?", not "when does this value change?". Put all transitions in one reducer (pure, synchronous, no races) and let a single effect run side effects based on the current `status`.

```tsx
type Action =
  | { type: 'inputChanged'; inputs: Partial<SearchInputs> }
  | { type: 'flightSelected'; flight: Flight }
  | { type: 'hotelSelected'; hotel: Hotel }
  | { type: 'searchFailed'; error: string };

function reducer(state: BookingState, action: Action): BookingState {
  switch (action.type) {
    case 'inputChanged': {
      const inputs = { ...state.inputs, ...action.inputs };
      return { ...state, inputs, status: allValid(inputs) ? 'searchingFlights' : state.status };
    }
    case 'flightSelected':
      return { ...state, status: 'searchingHotels', selectedFlight: action.flight };
    // ...
  }
}

// One effect, driven by status — easy to follow, no cascade
useEffect(() => {
  if (state.status === 'searchingFlights')
    searchFlights(state.inputs).then((flight) => dispatch({ type: 'flightSelected', flight }));
  if (state.status === 'searchingHotels')
    searchHotels(state.selectedFlight).then((hotel) => dispatch({ type: 'hotelSelected', hotel }));
}, [state]);
```

Rule of thumb: effects are only for synchronizing with external systems. Business logic belongs in the reducer (pure, testable). Think in events, not reactions.
