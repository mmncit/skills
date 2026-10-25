# domain-functors

A coding-guideline skill for domain types that wrap a value in a fixed set of slots: a label with a long and a short form, a string per locale, a metric per group. Every operation on the inside of that wrapper re-derives the same branching, unwrap, transform, rewrap, and adding an operation means writing the branch again.

Give the wrapper one lawful `map` and the branch is written once. Every operation afterwards is an ordinary function on the value, written as if the wrapper were not there. That is all a functor is: a container plus a lawful `map`.

## The ladder

1. Tag the container. A bare `A | { long: A; short: A }` narrows on `"long" in x`, which answers the wrong question when `A` itself carries a `long` key. The rest is unsound without a discriminant.
2. Write `map` once, curried, so it drops into a `pipe`. Nearly all of the value is here.
3. Add `map2` only once you genuinely combine two wrapped values, and decide the broadcasting rule deliberately.

Two laws keep `map` trustworthy. Identity says mapping nothing changes nothing, shape included. Composition says two passes may be fused into one. Identity is the one that breaks in practice, through a `map` that collapses equal variants as a tidy-up.

## Contents

| File | What it is |
|---|---|
| `SKILL.md` | Why the obvious union encoding is unsound, the three rungs, the two laws and the collapsing bug, and when not to use it. |
| `references/container-catalogue.md` | The same treatment for `Localized<A>` and `Grouped<K, A>`, a six-step recipe for deriving `map` for a wrapper of your own, and the containers not to build because a sibling owns them. |
| `references/laws-and-tests.md` | The laws as fast-check properties, the counterexample they shrink to, and the broadcasting properties for `map2`, including the obvious statement of broadcasting that is wrong. |

## When it fires

The same `if ("long" in x)` branch in a dozen functions · a helper that unwraps a wrapper, transforms the inside and rewraps it, copy-pasted once per operation · adding an operation means editing every variant branch · combining two wrapped values needs a four-way if-ladder · a union that narrows wrong because `A` itself carries the key being tested · a per-locale or per-group record whose transform is written out field by field · "how do I add an operation without touching every branch" · "can I map over my own type"

## When it does not

Two branches are not a pattern; write the branch and extract `map` at the third. TypeScript has no higher-kinded types, so each container costs its own `map`, `map2` and law tests with no reuse between them: cheap for one or two wrappers, a bad trade for eight. If the slots need genuinely different operations, `map` hides the asymmetry rather than removing it. Arrays, promises and `Map` already have this. And a union whose cases carry different fields is a state machine wanting exhaustive matching, not a container.

## Siblings

| What you are looking at | Skill |
|---|---|
| Cases carrying different fields, which is the type problem underneath | [discriminated-unions](../discriminated-unions/) |
| Folding many values of one type into one, rather than mapping inside a container | [algebraic-composition](../algebraic-composition/) |
| The wrapper is failure or I/O rather than a domain shape | [effects-as-values](../effects-as-values/) |
| The front door, and the `pipe` mechanics `map` is curried for | [functional-architecture](../functional-architecture/) |

## Credit

Derived from Adam Dueck's [Practical uses for functional programming with NLP](https://adueck.github.io/blog/practical-uses-for-functional-programming-with-nlp/), which works the pattern out for a Pashto inflection engine. The encoding here is tagged rather than a bare union. Rung 1 covers why.
