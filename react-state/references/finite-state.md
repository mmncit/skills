# Finite states, reducers, context

## Group related state

Multiple `useState` calls for fields that always change together let them fall out of sync and multiply boilerplate. Combine into one object; update with the callback form to avoid stale closures.

```tsx
// Avoid
const [destination, setDestination] = useState('');
const [departure, setDeparture] = useState('');
const [passengers, setPassengers] = useState(1);

// Prefer
const [searchForm, setSearchForm] = useState({ destination: '', departure: '', passengers: 1 });
setSearchForm((prev) => ({ ...prev, destination: 'Paris' })); // callback form, never stale
```

## Discriminated unions (type-states)

Use a shared `status` discriminator so each state shape carries exactly the data valid in that state, and TypeScript narrows automatically. This makes impossible states unrepresentable.

```tsx
type RequestState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; error: Error }
  | { status: 'success'; data: Data };

const [state, setState] = useState<RequestState>({ status: 'idle' });
if (state.status === 'success') state.data; // ✓ data only exists in success
// state.data when status is 'idle' → compile error
```

Type-states can also encode constraints across a flow — e.g. a `response` field that only exists once `submitted` is true:

```tsx
type FormState =
  | { submitted: false; values: FormValues }
  | { submitted: true; values: FormValues; response: ServerResponse };
```

## `useReducer` for non-trivial state

Once you have several values changing together or transitions with rules, move from scattered `useState` to a reducer whose actions name **user intent / business events**. Benefits: centralized pure logic, predictable transitions, a clear action history in DevTools, and logic you can unit-test without rendering.

```tsx
type State =
  | { status: 'idle'; formData: FormData }
  | { status: 'searching'; formData: FormData }
  | { status: 'error'; formData: FormData; error: string }
  | { status: 'results'; formData: FormData; flightOptions: FlightOption[] };
```

## Context + custom hook to kill prop drilling

When shared state is threaded through many layers as props, lift it into Context with a reducer, and wrap access in a custom hook that validates the provider is present.

```tsx
const BookingContext = createContext<BookingContextValue | null>(null);

function BookingProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(bookingReducer, initialState);
  return <BookingContext value={{ state, dispatch }}>{children}</BookingContext>;
}

function useBooking() {
  const ctx = use(BookingContext);
  if (!ctx) throw new Error('useBooking must be used within BookingProvider');
  return ctx;
}
```

Caveat: Context re-renders *all* consumers on any change. For high-frequency shared values, prefer a store with selectors or split into multiple contexts — see `external-stores.md`.

## Principles underlying all of the above

- **Events are the source of truth** — capture *why* state changed, not just the new value.
- **Pure functions for app logic** — keep side effects out of state transitions so logic is deterministic and testable.
- **Framework-agnostic** — write business logic as if you might swap frameworks; keep it out of React-specific glue.
- **Declarative side effects** — declare what should happen based on state; let one effect execute it.
