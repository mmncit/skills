---
name: discriminated-unions
description: "Replace TypeScript objects whose optional fields only make sense in certain combinations with a union of arms tagged by a discriminant. Use this skill when an interface carries optional properties that correlate (a status string beside data? and error?), when two or more booleans encode a mode nobody has enumerated, when a Partial<T> or a row of nullable columns arrives from an API or a database, when code reads if (!x.data) throw new Error('impossible'), when a non-null assertion appears on a field the caller knows is present, when destructuring fails with 'Property does not exist on type', when a switch over a kind field compiles silently after a new variant is added, or when component props permit a variant together with fields only the other variant uses. Also fires on 'why is this possibly undefined', 'I keep having to assert this exists', 'how do I stop both flags being true at once', 'should this be one type or several'. Covers choosing and naming the discriminant, narrowing before destructuring, exhaustiveness with never, and where unions belong across an app."
---

# Discriminated Unions

Most `undefined` checks in a codebase aren't defending against real absence — they're paying for a **type that describes more shapes than the program can produce**. An object with a `status` field and two optional payload fields claims eight combinations when only three exist, so every reader has to re-derive which three, and the compiler can't help them. A discriminated union names the arms instead: one tag field whose literal value tells TypeScript exactly which other fields are present.

The payoff isn't elegance. It's that the impossible combinations stop compiling, and the fields you *do* have stop being optional.

## Diagnose first: is this a bag of optionals?

You rarely get to design these from scratch. You find them. Three signals, in order of how often they show up in code you didn't write:

1. **Optional fields that correlate.** Take the interface and write down which optionals are present together. If the answer is "`data` when `status` is `success`, `error` when it's `error`", the type has a discriminant already — it just isn't wired to anything.
2. **Assertions and guards that claim impossibility.** `x.data!`, `x.data?.id ?? throwIfMissing()`, `if (!x.data) throw new Error("unreachable")`. Each one is a developer who knew the invariant and had no way to say it. Count them; they map one-to-one onto the arms you're about to write.
3. **Booleans whose combinations nobody has enumerated.** Two booleans are four states, three are eight. If you can't name all of them out loud, some of them are bugs waiting for a user to find.

A type whose optionals are genuinely independent — a form where any field may be blank, a settings object with per-key overrides — is *not* this problem. Leave it alone.

### BEFORE

```ts
interface FetchState {
  status: "loading" | "error" | "success";
  error?: Error;
  data?: { id: string };
}
```

Nothing stops `{ status: "success" }` with no data, or `{ status: "loading", error: e }`. The type is documentation, and the documentation is wrong.

### AFTER

```ts
type FetchState =
  | { status: "loading" }
  | { status: "error"; error: Error }
  | { status: "success"; data: { id: string } };
```

Three arms, no optionals, and `data` is now non-optional exactly where it exists.

## The ladder

Work top to bottom. **Most code only needs rungs 1 to 3** — the rest are for unions that cross a boundary or grow new arms over time.

### 1. Enumerate the states before you touch the type

Write the real combinations down as a list — in the PR description, in a comment, anywhere. This is free and it is where the work actually happens. Usually one of three things falls out: there are fewer states than the type allows (the common case, and the rest of this ladder applies), there are *more* than anyone realised (a "loading with stale data while refetching" arm nobody named), or the fields are genuinely independent and you should stop here.

### 2. Add the discriminant and split the arms

Pick one field whose value identifies the arm, give it a **string literal type**, and move each correlated field into the arm that owns it.

Naming, in rough order of preference: `type` reads best in data you own (`{ type: "email" }`), `kind` avoids collisions with a domain concept already called "type", and `status` or `state` is right when the arms are phases of one lifecycle rather than different things. Pick one convention per codebase and don't mix them — a file with `type`, `kind` *and* `variant` unions costs a reader more than any of them saves.

Two mechanical rules:

- **Use string literals, not booleans or numbers.** `{ ok: true } | { ok: false; error: E }` narrows correctly but reads badly at the third arm, and there is no third arm available. Numeric tags survive serialisation but tell a debugger nothing.
- **Give every arm the same tag key.** TypeScript narrows on a shared key with literal types; `{ type: "a" } | { kind: "b" }` is just a union, and no `switch` will narrow it.

### 3. Narrow before you destructure

This is the rung people hit friction on, and the friction is the point. Destructuring the union directly fails:

```ts
// ✗ Property 'data' does not exist on type 'FetchState'.
const { status, data, error } = state;
```

That error is correct: at that line, the value might be any of the three arms, so neither `data` nor `error` is guaranteed. Check the tag first, and destructure inside the branch where the answer is known:

```ts
if (state.status === "success") {
  const { data } = state; // data: { id: string }
}
```

The strictness is the feature. The old shape let you pull `data` out anywhere and discover at runtime that it was `undefined`; this one moves that discovery to the keystroke. Resist the two workarounds that undo it: destructuring at the top with `?`, and widening the arm to make the compiler quiet.

One caveat worth knowing before it bites: narrowing is **per-reference, not per-value**. `state.status === "success"` narrows `state`; it does not narrow a copy you destructured earlier, and TypeScript drops the narrowing after an `await` or inside a callback that could run later. Narrow, then use it in the same synchronous block.

### 4. Make the switch exhaustive

A `switch` over the tag compiles fine when a fourth arm is added, and silently does nothing for it. Force the compiler to object:

```ts
function render(state: FetchState): string {
  switch (state.status) {
    case "loading":
      return "…";
    case "error":
      return state.error.message;
    case "success":
      return state.data.id;
    default: {
      const unreachable: never = state;
      return unreachable;
    }
  }
}
```

Add an arm to `FetchState` and this stops compiling, naming the file and the missing case. It costs four lines per switch, which is why it belongs on the switches that matter — rendering, persistence, anything where a missed arm is a visible bug — rather than on every one.

### 5. Decide the discriminant at the boundary, once

A union is only as trustworthy as the point where the data enters. An API returns JSON; nothing about `unknown` makes it a union. Parse once at the edge and hand the rest of the app the narrowed value:

```ts
// ✗ the shape the wire gives you, carried inward
type ApiUser = { role: string; adminScopes?: string[]; teamId?: string };

// ✓ decided once, at the boundary
type User =
  | { role: "admin"; scopes: string[] }
  | { role: "member"; teamId: string };

function toUser(raw: ApiUser): User | null {
  if (raw.role === "admin" && raw.adminScopes) {
    return { role: "admin", scopes: raw.adminScopes };
  }
  if (raw.role === "member" && raw.teamId) {
    return { role: "member", teamId: raw.teamId };
  }
  return null;
}
```

Two things follow. **Keep the tag in the serialised data** if the value round-trips through storage or a queue — a discriminant you reconstruct from other fields on the way back in is a decode step you will get wrong eventually. And **decode at one place**, not at each consumer: the value of the union is that everything downstream of the boundary is already narrowed.

### 6. Apply it to props and actions

The same move works on the two other places a TypeScript app accumulates correlated optionals.

**Component props.** A modal that sometimes has a description and a button, and sometimes doesn't:

```ts
// ✗ every field optional, every caller guessing
type ModalProps = {
  variant: "base" | "with-description-and-button";
  title: string;
  description?: string;
  buttonText?: string;
};

// ✓ the variant decides what the caller must pass
type ModalProps =
  | { variant: "base"; title: string }
  | {
      variant: "with-description-and-button";
      title: string;
      description: string;
      buttonText: string;
    };
```

Callers now get an error at the call site for the missing `buttonText` instead of a blank button at runtime. Note that the shared field stays duplicated across arms rather than being extracted to a base type — an intersection with a base object narrows less predictably, and two repeated lines are cheaper than the confusion.

**Reducer actions.** `{ type: "added"; text: string } | { type: "deleted"; id: string }` is the same pattern, and it is what makes a reducer's `switch` exhaustive. This one has a fuller treatment under React state — see below.

## Where to go next

- **`react-state`** — where a piece of state should live, and the React-specific version of this: collapsing `isLoading`/`isError` booleans into a `status` union, `useReducer` action types, and type-states. Its `references/finite-state.md` is the React-side companion to this skill's rungs 3 and 4.
- **`entity-factory`** — the next question after you have a union with several arms: how to *build* values of it. When the arms share an output contract and keep multiplying, a keyed registry beats a growing `switch`; that skill covers the trade-off in both directions.
- **`algebraic-composition`** — when the arms need to be *combined* rather than dispatched on (folding a list of events into a state, merging two partial results).
- **`functional-architecture`** — the front door for this family of skills, and the source of the `pipe` mechanics the decode functions above fit into.

## When NOT to use it

- **The optionals are genuinely independent.** A user profile where any field may be blank has no discriminant to find. Forcing one produces 2ⁿ arms and a worse type than you started with.
- **One arm, or two that won't grow.** A nullable value is already a union (`T | null`) and narrows the same way. Don't tag it.
- **The variation is runtime data, not a fixed set of kinds.** If the arms come from a config file or a database table that operators edit, the set isn't known at compile time; model it as data with a validated shape.
- **The tag would be computed rather than carried.** If you have to derive the discriminant from the other fields every time you read the value, the union isn't buying you anything the derivation wasn't already doing.
- **A hot path over many values.** The union itself is free — it's erased at runtime — but a decode step that allocates a new object per row in a large loop is not. Validate the batch, not each element.
- **Mid-refactor, with no test holding the shape still.** Splitting a type rewrites every construction site of it. Get the current behaviour under test first.
