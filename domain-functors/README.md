# domain-functors

A coding-guideline skill for **TypeScript** domain types that wrap a value in a fixed set of slots — a label with a long and a short form, a string per locale, a metric per group — and where every operation on the inside re-derives the same unwrap/transform/re-wrap branch.

Give the wrapper one lawful `map` and the branch is written once. Every operation afterwards is an ordinary function on the value, written as if the wrapper weren't there.

## Contents

| File | What it is |
|---|---|
| `SKILL.md` | Why the obvious `A \| { long: A; short: A }` encoding is unsound, a three-rung ladder (tag the container → `map` → `map2`), the two functor laws and the collapsing bug that breaks them, and when *not* to reach for this. |
| `references/container-catalogue.md` | The same treatment for `Localized<A>` and `Grouped<K, A>`, a six-step recipe for deriving `map` for a wrapper of your own, and the containers you shouldn't build because a sibling skill owns them. |
| `references/laws-and-tests.md` | The functor laws as fast-check properties, the counterexample they shrink to, and the broadcasting properties for `map2` — including the obvious statement of broadcasting that is wrong. |

## Where it sits

`functional-architecture` is the front door. This skill is the *map over the inside of a container* axis; its neighbours cover the others:

| The code you're looking at | Skill |
|---|---|
| Many values of one type folded into one — totals, merged config, collected errors | `algebraic-composition` |
| The wrapper is failure or I/O (`Result`, `Task`) rather than a domain shape | `effects-as-values` |
| Cases carrying *different* fields — a state machine, not a container | `entity-factory` |

## When it fires

The same `if ("long" in x)` in a dozen functions · a helper that unwraps, transforms and re-wraps, copy-pasted once per operation · adding an operation means editing every variant branch · combining two wrapped values needs a four-way if-ladder · a generic union that narrows wrong because `A` carries the key being tested · "how do I add an operation without touching every branch?" · "can I map over my own type?"

## Credit

Derived from Adam Dueck's [*Practical uses for functional programming with NLP*](https://adueck.github.io/blog/practical-uses-for-functional-programming-with-nlp/), which works the pattern out for a Pashto inflection engine. The encoding here is tagged rather than a bare union — see rung 1 for why.
