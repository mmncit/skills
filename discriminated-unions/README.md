# discriminated-unions

A coding-guideline skill for types that describe more shapes than the program can produce. An object with a `status` field and two optional payload fields claims eight combinations when only three exist, so every reader re-derives which three and the compiler cannot help.

A discriminated union names the arms instead. One tag field whose literal value tells TypeScript exactly which other fields are present. The impossible combinations stop compiling, and the fields you do have stop being optional.

## The ladder

1. Enumerate the states before touching the type.
2. Add the discriminant and split the arms.
3. Narrow before destructuring.
4. Make the switch exhaustive with `never`.
5. Decide the discriminant at the boundary, once.
6. Apply it to component props and reducer actions.

Rung 5 is the one that gets skipped. A union built inside the UI from fields that arrived untagged just moves the guessing; the tag belongs at the decode step where the data enters.

## Contents

| File | What it is |
|---|---|
| `SKILL.md` | The before and after, the six rungs, choosing and naming the discriminant, exhaustiveness with `never`, and when not to use it. |

No reference files. The skill is self-contained.

## When it fires

An interface with optional properties that correlate, such as a status string beside `data?` and `error?` · two or more booleans encoding a mode nobody has enumerated · a `Partial<T>` or a row of nullable columns arriving from an API or a database · `if (!x.data) throw new Error("impossible")` · a non-null assertion on a field the caller knows is present · destructuring that fails with "Property does not exist on type" · a `switch` over a `kind` field that compiles silently after a new variant is added · component props that permit a variant together with fields only the other variant uses · "why is this possibly undefined" · "should this be one type or several"

## When it does not

Optionals that are genuinely independent have no discriminant to find, and forcing one produces 2ⁿ arms and a worse type. A nullable value is already a union and narrows the same way, so do not tag it. When the arms come from a config file or a table that operators edit, the set is not known at compile time and belongs in data with a validated shape. And splitting a type rewrites every construction site of it, so get the current behaviour under test first.

## Siblings

| What you are looking at | Skill |
|---|---|
| The React version: `isLoading`/`isError` booleans, reducer actions, type-states | [react-state](../react-state/) |
| Building values of the union once it has several arms | [entity-factory](../entity-factory/) |
| Combining the arms rather than dispatching on them | [algebraic-composition](../algebraic-composition/) |
| The front door, and the `pipe` mechanics the decode functions fit into | [functional-architecture](../functional-architecture/) |
