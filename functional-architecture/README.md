# functional-architecture

A coding-guideline skill for refactoring procedural or class-based **TypeScript** into an architecture of small pure functions composed with pipes.

It starts from a diagnostic — *can I run this twice? does call order matter? does it change other parts of the program? what does it need in order to run?* — and answers each defect with one rung of a six-step ladder: separate calculation from effect, promote hidden inputs to parameters, make data flow one-directional with `pipe`, push config to the edges with partial application, replace flags with composition, replace mutation with narrowed transformation.

## Contents

| File | What it is |
|---|---|
| `SKILL.md` | The diagnostic, the refactor ladder, the generalise-vs-specialise trade-off, TypeScript mechanics, and when *not* to use it. |
| `references/refactor-recipes.md` | Before/after TypeScript for each rung — class to module, loop to pipeline, flags to composition, mutation to transformation, order-dependent init to explicit dependencies. |
| `references/composition-in-typescript.md` | Typing `pipe` past its overload ceiling, curried factories vs `curry` helpers, generic stages, type guards, the readability limits of point-free style. |

## It's the front door of four

This skill covers turning procedures into composed functions, and routes to a sibling when the code is a more specific shape:

| The code you're looking at | Skill |
|---|---|
| A family of objects varying by a `type` / `kind` / `__class__` field | `entity-factory` |
| An accumulation loop, an awkward `reduce`, reducers to merge, a deep-nested update | `algebraic-composition` |
| Throwing, `try/catch`, async I/O, logic you can't test without stubbing the world | `effects-as-values` |

## When it fires

A `Manager` / `Service` / `Processor` / `Helper` that has become a grab-bag · a method mutating instance fields so results depend on call order · boolean or mode flags branching inside a function · three-level spread ladders · logic that can't be unit-tested without constructing objects or stubbing the network · "why is this so hard to change?" · "can we make this more functional?"
