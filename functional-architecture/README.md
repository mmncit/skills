# functional-architecture

A coding-guideline skill for refactoring procedural or class-based TypeScript into small pure functions composed with pipes. This is the front door for the family: start here when you know something is wrong with a file but not yet what shape the problem is.

Most hard-to-change TypeScript is not badly written. It is organised around nouns instead of contracts. A class starts as a coherent metaphor, then absorbs whatever needed a home: formatting, validation, geocoding, persistence. Functional architecture organises around functions with defined contracts instead, and modularity follows from that one property rather than from the folder layout.

## Diagnose first

Four questions about the unit in front of you. Each "no" is a specific defect with a specific fix.

1. Can I run this twice in a row and get the same result?
2. Does the order I call these in matter?
3. Does it change other parts of the program?
4. What does it need in order to run?

A unit that answers yes, no, no, and "just its parameters" is already a function. Leave it alone. Everything else is a procedure, and the six-rung ladder in `SKILL.md` turns it into one.

## Contents

| File | What it is |
|---|---|
| `SKILL.md` | The diagnostic, the six-rung ladder, the generalise-versus-specialise trade-off, TypeScript mechanics, and when not to use it. |
| `references/refactor-recipes.md` | Before and after TypeScript for each rung: class to module, loop to pipeline, flags to composition, mutation to transformation, order-dependent init to explicit dependencies. |
| `references/composition-in-typescript.md` | Typing `pipe` past its overload ceiling, curried factories versus `curry` helpers, generic stages, type guards, and the readability limits of point-free style. |

## The front door of seven

This skill covers turning procedures into composed functions, and routes to a sibling when the code is a more specific shape.

| What you are looking at | Skill |
|---|---|
| An object whose optional fields only make sense together, or booleans encoding a mode | [discriminated-unions](../discriminated-unions/) |
| A family of objects varying by a `type`, `kind` or `__class__` field | [entity-factory](../entity-factory/) |
| An accumulation loop, an awkward `reduce`, reducers to merge, a deep-nested update | [algebraic-composition](../algebraic-composition/) |
| A wrapper with fixed slots that re-branches in every operation | [domain-functors](../domain-functors/) |
| Throwing, `try/catch`, async I/O, logic you cannot test without stubbing the world | [effects-as-values](../effects-as-values/) |
| A pure rule duplicated on the other side of an API boundary | [policy-as-data](../policy-as-data/) |

The first five are code-shape problems within one codebase. The last is a boundary problem: a rule can be perfectly pure and still exist twice.

[react-state](../react-state/) is the eighth skill in this repository and sits outside the family. It is reached from `discriminated-unions`, which is the modelling move the two share.

## When it fires

A `Manager`, `Service`, `Processor` or `Helper` that has become a grab bag · a method mutating instance fields so results depend on call order · boolean or mode flags branching inside a function · three-level spread ladders · logic that cannot be unit-tested without constructing objects or stubbing the network · "why is this so hard to change?" · "can we make this more functional?"

## When it does not

A class with real identity and a lifecycle, such as a connection or a subscription hub, is the right tool; make the logic it calls pure instead. Hot loops over typed arrays pay for an intermediate array per stage, so keep the loop. Framework-shaped code with its own idioms costs more to fight than it returns. Code that already answers the four diagnostic questions cleanly does not need a pipeline. And every rung is behaviour-preserving only if something checks, so get the current behaviour under test before starting.
