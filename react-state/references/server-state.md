# Server state with TanStack Query

Server data is not local state. Managing it with `useEffect` + `useState` forces you to hand-roll loading/error flags and invites real bugs: race conditions when inputs change rapidly, no caching (refetch on every mount), memory leaks when a component unmounts mid-fetch, duplicate requests across components, and manual stale-data handling.

Use a server-state library (TanStack Query) that owns caching, dedup, retries, and loading/error states.

```tsx
// Avoid: manual fetch lifecycle
const [flights, setFlights] = useState([]);
const [isLoading, setIsLoading] = useState(false);
const [error, setError] = useState<string | null>(null);
useEffect(() => {
  setIsLoading(true); setError(null);
  fetchFlights(search)
    .then(setFlights)                                   // may set state after unmount
    .catch((e) => setError(e.message))
    .finally(() => setIsLoading(false));                // race if `search` changes fast
}, [search]);

// Prefer: useQuery handles caching, dedup, retries, lifecycle
const { data: flights, isLoading, error } = useQuery({
  queryKey: ['flights', search],          // cache identity
  queryFn: () => fetchFlights(search),
  staleTime: 5 * 60 * 1000,               // cache 5 min
  retry: 2,
});
```

## Query keys

Keys are arrays that uniquely identify the data. Use serializable, value-based keys — not object references (a new reference each render fragments the cache).

```tsx
// Good
['flights', { destination: 'NYC', departure: '2024-01-01' }]
['user', userId]
['posts', { page: 1, limit: 10 }]

// Bad
'flights'                       // too coarse
['flights', flightSearchObject] // reference changes → cache misses; spread the relevant fields instead
```

## Mutations

Use `useMutation` for create/update/delete, and invalidate affected queries on success so the UI refreshes.

```tsx
const bookingMutation = useMutation({
  mutationFn: (booking: BookingData) => submitBooking(booking),
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ['bookings'] }),
  onError: (error) => toast.error('Booking failed: ' + error.message),
});
```

Further wins to reach for: skeleton loading states, retry buttons on error, prefetching the next resource (e.g. prefetch hotels when a flight is picked), optimistic updates, and infinite queries for pagination. The DevTools let you inspect cache and query status.
