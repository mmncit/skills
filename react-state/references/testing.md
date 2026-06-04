# Testing state logic

Test business logic, not UI implementation. When state logic lives inside components, tests must render, simulate DOM events, and assert on the DOM — slow and brittle. When logic lives in pure functions (reducers, calculators, validators), you test inputs → outputs directly: fast, deterministic, no mocking React or the DOM. This is the practical payoff of the event-driven, pure-reducer approach.

```tsx
// Pure reducer — trivially testable
test('selecting a flight moves to the hotel step', () => {
  const initial = { currentStep: 'search', selectedFlight: null };
  const next = bookingReducer(initial, { type: 'flightSelected', flight: mockFlight });
  expect(next.currentStep).toBe('hotel');
  expect(next.selectedFlight).toBe(mockFlight);
});
```

## What to cover

**Happy paths:** state transitions (select flight → hotel step), data updates (selection stored), derived values (totals computed correctly), validation (required fields).

**Edge cases:** invalid/empty/malformed input, can you reach an impossible state, null/undefined handling, business-rule enforcement.

**State-machine transitions:** valid transitions succeed (search → results → selection), invalid ones are rejected (can't confirm a booking with no flight selected), conditional transitions behave, and contextual data updates correctly during transitions.

```tsx
test('syncs hotel dates from flight dates on submit', () => {
  const state = {
    flightSearch: { departure: '2024-06-01', arrival: '2024-06-10' },
    hotelSearch: { checkIn: '', checkOut: '' },
  };
  const result = bookingReducer(state, { type: 'flightSearchSubmitted' });
  expect(result.hotelSearch.checkIn).toBe('2024-06-01');
  expect(result.hotelSearch.checkOut).toBe('2024-06-10');
});

test('calculates total cost; handles missing selections', () => {
  expect(calculateTotalCost({ price: 500 }, { price: 200 })).toBe(700);
  expect(calculateTotalCost(null, null)).toBe(0);
});

test('blocks invalid transition', () => {
  const result = bookingReducer({ currentStep: 'search' }, { type: 'bookingConfirmed' });
  expect(result.currentStep).toBe('search'); // stays put without required selections
});
```

Tooling: a fast runner like Vitest, consistent mock fixtures, and TypeScript to catch shape errors at compile time. Steps for an existing component: extract the reducer into its own file, write happy-path tests per action, add edge cases, then test transitions and business rules. Tests run in milliseconds because there's no rendering involved.
