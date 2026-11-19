---
name: strong-typescript
description: "Make the TypeScript compiler reject impossible states, mixed-up primitives, unvalidated input and accidental mutation, so whole classes of bugs stop compiling instead of needing tests. Use this skill when reading or writing .ts or .tsx files that have 'as' casts, 'any', non-null assertions, 'should never happen' throws, type guards that do not actually check, string or number IDs that can be passed in the wrong order, JSON or env vars or API responses used without parsing, functions that mutate the arrays and objects they are given, hand-written interfaces duplicating a schema, or functions with several positional arguments of the same type. Also when someone asks 'how do I make this type-safe', 'how do I get rid of this cast', 'why is this possibly undefined', 'unknown or any', 'how do I brand a type', 'satisfies or as', 'should this be readonly', 'which tsconfig flags should we turn on'. Gives a ladder from honest casts through parsing into a Result, branded primitives, readonly data and constructive types to stricter compiler flags, and leaves unions to discriminated-unions and failure handling to effects-as-values."
---

# Strong TypeScript

Every type in a program is a claim, and the compiler checks the claims you let it check. `any`, `as`, `!` and a type guard that does not look at the value are claims nobody verified. Strong TypeScript means the compiler believes only what something checked, once, at the place the data came in, and everything inside that line is trusted without being checked again.

This is the type-level half of the functional style the code-shape skills teach: data in and data out, failure in the return type, effects at the edges, values that are rebuilt rather than changed.

Two symptoms say the types are not doing the work. A `!` or an `as` appears so the compiler stops complaining. Or the same validation runs in three functions because none of them trusts what the others received.

## What this skill leaves to its siblings

Two moves that belong here are already covered in depth elsewhere, and this ladder assumes them. Variants as a tagged union with an exhaustive `switch` is `discriminated-unions`, rungs 2 to 5. Failure as a `Result` value instead of a throw is `effects-as-values`, rung 1. The examples here use that skill's `Result`, `ok` and `err`.

## The ladder

Work top to bottom. Each rung is shippable on its own, and most code needs only the first two.

1. Stop lying to the compiler. Data from outside is `unknown`, never `any`. Use `as` only straight after a check that proves it, and use `satisfies` to check a value against a type while keeping the value's own, narrower type. Narrow in this order of preference: a discriminant `switch`, the `in` operator, `typeof` or `instanceof`, a user-defined type guard, and `as` last.
2. Parse at the boundary into a `Result`. JSON, request bodies, environment variables, CLI arguments, database rows and queue messages go through one parse function where they enter. It returns `Result<DomainType, ParseError>`, so the caller decides what bad input means and the signature admits that input can be bad. If the repository has a schema library, define the schema, infer the type from it, and use its non-throwing parse. When the data is a tagged union, decide the tag here too, which is rung 5 of `discriminated-unions`. Inside the boundary, trust the types and do not validate again.
3. Brand primitives that mean different things. When a `UserId` and an `OrgId` are both `string`, they get passed in the wrong order and nothing complains. A brand makes them different types, and the only way to get one is a parse function that checks the value.
4. Make data read-only by default. `readonly` properties and `readonly T[]` in signatures mean a function cannot change what it was given. It has to return a new value, which is what makes it safe to share data, cache results and reason about a function from its signature. Use `as const` for tables of literals.
5. Build types that cannot hold the illegal value. `[T, ...T[]]` for a list that is never empty, a start plus a duration instead of two dates that might be reversed. Do this only where the loose type is already forcing a `!`, a cast or a "should never happen" throw. While every operation on a plain array is total, keep the plain array.
6. Tighten the compiler. Turn on `strict`, then `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`, which `strict` does not include. The first types a read by index as `T | undefined` unless the position is known, as in a tuple, and the second stops `undefined` being passed for an optional property. Both surface many errors in an existing codebase, so turn them on per package or behind a ratchet.

Stop at the rung where the casts and the "impossible" throws are gone.

## Rules that apply on every rung

- A type guard must check what its name claims. `isUser(x)` that returns `true` after looking at one field is worse than `as`, because the bug hides behind a name that says the value is safe. Name guards `isX` or `hasX`.
- Derive before you declare. Reach for `Pick`, `Omit`, `ReturnType`, `Parameters`, `Awaited`, `typeof` and a schema's inferred type before writing a new interface that has to be kept in sync by hand.
- Pass an object when a function takes three or more arguments, or two of the same type, so the call site names each one. Hot paths such as per-frame rendering and tokenizers are the exception.
- `Record<string, unknown>` and its relatives end at the parse function. Past it, the data has a name.

`references/patterns.md` has a before and after for each rung, plus the guard, derivation and object-argument rules.

## Where to go next

| What you are looking at | Skill |
|---|---|
| Optional fields that only make sense together, booleans encoding a mode, a `switch` that misses a case | `discriminated-unions` |
| Parse failures and I/O as values, and testing without stubbing the world | `effects-as-values` |
| Logic and I/O tangled in one function, or a class holding state its methods mutate | `functional-architecture` |
| A validation rule that exists on both sides of an API boundary | `policy-as-data` |
| A family of objects built per `kind`, once the union is in place | `entity-factory` |
| The types are the design: a change whose shape is not settled yet | `architect` |
| A runtime rule a type cannot express, pinned by a test | `tdd` |

## When NOT to use it

- Prototype and spike code headed for the bin. Types that make illegal states unrepresentable are an investment in code that will live.
- Branding a value that is never confused with another. Each brand adds a parse step at every construction site, so brand where a mix-up is plausible: IDs, units, validated strings.
- Constructive types where the data arrives loose everywhere. If every caller has to cast to build a `NonEmpty<T>`, parse once at the boundary or keep the plain array.
- `readonly` across an API a library mutates. Some libraries take mutable arrays and change them, and wrapping each call in a copy costs more than it protects.
- Adding a schema library for one boundary. A hand-written parse function that returns a `Result` does the same job until there are several.
- Turning on `noUncheckedIndexedAccess` across a large codebase in one PR. Hundreds of mechanical `!` additions teach nothing and hide the real cases. Ratchet it.
- Hot paths. Copying instead of mutating, object arguments and parse layers all cost something in a per-frame or per-row loop.
