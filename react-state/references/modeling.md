# Modeling before building

Separate **incidental complexity** (irreducible, from the problem domain) from **accidental complexity** (self-inflicted, from implementation). A few minutes of plain-text modeling maps the incidental complexity so it doesn't surprise you mid-build — and surfaces edge cases, impossible states, and the real set of states before they become bugs. Text beats fancy diagrams: it lives in version control, is easy to keep in sync, and forces clear thinking.

Sketch three things.

## Entity relationships (what data + how it relates)

```
User    { id (pk), email (unique), name, createdAt }
Flight  { id (pk), airline, departure, arrival, price, availableSeats }
Hotel   { id (pk), name, location, rating(1-5), pricePerNight }
Booking { id (pk), userId→User, flightId→Flight, hotelId?→Hotel,
          status(pending|confirmed|cancelled), totalPrice, createdAt }

User 1:n Booking · Flight 1:n Booking · Hotel 1:n Booking
```

## Sequence (what calls what, in what order)

```
UI -> flightSearch: searchFlights(criteria)
flightSearch -> UI: flight options
UI -> hotelSearch: searchHotels(location, dates)
hotelSearch -> UI: hotel options
UI -> api: createBooking(flight, hotel)
api -> db: save booking
api -> UI: confirmation
```

## States (what the user sees, what's stored, what's happening, and what events transition out)

For each state, write: what the user sees, what data is stored, what's happening behind the scenes, and which events move to which next state. Example flow for a booking app:

```
idle          → form shown, nothing stored. submit → searchingFlights
searchingFlights → spinner; criteria saved; calling flights API.
                   success → flightResults; failure → error
flightResults → flight list. selectFlight → hotelSearch; back → idle
hotelSearch   → hotel form prefilled from flight dates. results → hotelResults; skip → review
hotelResults  → hotel list + flight summary. selectHotel → review
review        → full summary + total. confirm → booking; back → hotelResults
booking       → processing payment. success → confirmation; failure → error
confirmation  → confirmation shown; sends email. new → idle
error         → message; prior data preserved. retry → last action; reset → idle
```

Writing this out is usually where you notice that "loading / error / data" is one `status` value, and that the back/skip transitions are the tricky cases worth testing. It maps directly onto a discriminated-union state or `useReducer` (see `finite-state.md`). Useful tools: tldraw, dbdiagram.io, swimlanes.io, state.new — but plain text in the repo is enough.
