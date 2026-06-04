# URL query state

Put state that should be **shareable, bookmarkable, or survive a refresh** in URL query params instead of `useState`. Otherwise users lose it on reload, can't share a link to a specific view, and the back/forward buttons don't work as expected.

Belongs in the URL: search filters, sort order, pagination, active tab/view, selected item or category, modal open/closed, form search criteria. Rule: if the value affects what the user sees *and* should be shareable or persistent, it's URL state.

## Use `nuqs` for type-safe query state

Manual `URLSearchParams` parsing is stringly-typed and error-prone. `nuqs` synchronizes a value with the URL with parsing/serialization, SSR support, and validation built in. The API mirrors `useState`:

```tsx
import { useQueryState, parseAsInteger } from 'nuqs';

function FlightSearch() {
  const [destination, setDestination] = useQueryState('destination');           // string | null
  const [passengers, setPassengers] = useQueryState('passengers', parseAsInteger.withDefault(1));

  return (
    <input value={destination ?? ''} onChange={(e) => setDestination(e.target.value)} />
  );
}
```

Now the search is in the URL: refresh-safe, shareable, and back/forward navigate between searches. Watch for hydration mismatches in SSR — `nuqs` is built to avoid them, so use its parsers/defaults rather than reading `window.location` yourself.
