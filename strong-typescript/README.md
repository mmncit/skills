# strong-typescript

A skill for making the TypeScript compiler reject impossible states, mixed-up primitives, unvalidated input and accidental mutation, so those bugs stop compiling instead of needing tests.

Every type is a claim, and `any`, `as`, `!` and a guard that does not look at the value are claims nobody checked. The skill moves checking to one place, where data enters, and lets everything inside that line trust its types. It is the type-level half of the functional style the code-shape skills teach: data in and data out, failure in the return type, values rebuilt rather than changed.

## The ladder

1. Stop lying to the compiler: `unknown` at the edges, `as` only after a check, `satisfies` over `as`.
2. Parse at the boundary into a `Result`, from a schema when the repository has one.
3. Brand primitives that mean different things, created only by a parse that checks.
4. Make data read-only by default, so changing a value means returning a new one.
5. Build types that cannot hold the illegal value, where the loose type is already forcing a cast.
6. Turn on `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`, which `strict` leaves off.

Most code needs only the first two. Tagged unions and exhaustive switches are left to `discriminated-unions`, and the `Result` type comes from `effects-as-values`.

## Contents

| File | What it is |
|---|---|
| `SKILL.md` | What it leaves to its siblings, the ladder, the rules that apply on every rung, and when not to use it. |
| `references/patterns.md` | A before and after for each rung, honest and dishonest guards, deriving types from signatures, and object arguments. Every block was type-checked. |

## When it fires

`as` casts · `any` · non-null assertions · silent `?? ""` or `|| []` defaults deep in the code · "should never happen" throws · a type guard that checks one field · IDs of the same primitive type passed in the wrong order · JSON, env vars or API responses used without parsing · a function that mutates the array it was given · an interface duplicating a schema · several positional arguments of the same type · "how do I make this type-safe" · "how do I get rid of this cast" · "unknown or any" · "satisfies or as" · "should this be readonly" · "which tsconfig flags should we turn on"

## When it does not

Prototype code headed for the bin does not need illegal states made unrepresentable. A brand on a value nobody confuses with another adds a parse step at every construction site for nothing. A constructive type that forces a cast at every call site is worse than parsing once. `readonly` across a library that mutates its arguments means a copy at every call. One boundary does not justify adding a schema library. Turning on `noUncheckedIndexedAccess` across a large codebase in one PR produces hundreds of mechanical `!` additions, so ratchet it. Copies, parse layers and object arguments cost something in per-frame loops.

## Siblings

| What you are looking at | Skill |
|---|---|
| Optional fields that only make sense together, or a `switch` that misses a case | [discriminated-unions](../discriminated-unions/) |
| Parse failures and I/O as values instead of throws | [effects-as-values](../effects-as-values/) |
| Logic and I/O tangled together, or a class mutating its own state | [functional-architecture](../functional-architecture/) |
| A validation rule duplicated across an API boundary | [policy-as-data](../policy-as-data/) |
| A family of objects built per `kind` | [entity-factory](../entity-factory/) |
| A change whose shape is not settled yet | [architect](../architect/) |
| A runtime rule a type cannot express, pinned by a test | [tdd](../tdd/) |

## Credit

The rules for casts, guards, brands, constructive types, derived types and object arguments are adapted from the `typescript-best-practices` skill and the type-system and boundary principles in [pstack](https://github.com/cursor/plugins/tree/main/pstack) by Lauren Tan, MIT licensed. Unions, exhaustiveness and failure as values follow this repository's own `discriminated-unions` and `effects-as-values`. Treating silent defaults like non-null assertions is restated from Addy Osmani's [agent-skills](https://github.com/addyosmani/agent-skills).
