# architect

A skill for settling a change's shape before any code exists: the types, the exported signatures, and which module owns which piece of state. This is the front door for the design skills. Start here when a change crosses a boundary and you have not yet decided what it should look like.

The first shape an agent thinks of is the one it builds, and every later decision bends around it. The skill makes it trace everything the change touches, write the caller's code first, and sketch two designs under different constraints before picking one with four tests: one owner per piece of state, one way to do each task, callers needing to know the least, and decisions in pure functions with I/O in a thin shell around them. Sketches are data and functions rather than classes, so a design that passes leads straight into the code-shape skills.

## How much design a change deserves

1. A small local change: none.
2. A change that crosses a function boundary or moves ownership: one pass of this skill.
3. A standalone decision such as a name, format or algorithm: `arena` directly.
4. A question you could answer by running something: a probe.
5. A large, contested or hard-to-reverse design: this skill with `arena` and a fresh-context challenge of the pick, then `interrogate` before it ships.
6. Work across several PRs: a written plan and a decision log, after the design settles.

Of the changes that need any design, most stop at rung 2.

## Contents

| File | What it is |
|---|---|
| `SKILL.md` | The design ladder, the eight-step pass, rules for shapes that are expensive to reverse, a worked pair of sketches and the functional core with a thin shell that comes out of them, and when not to use it. |

No reference files. The skill is self-contained.

## The front door of seven

| What the design needs | Skill |
|---|---|
| Several independent attempts on different models, judged blind and merged | [arena](../arena/) |
| Adversaries trying to break the finished change, keeping only what a run proves | [interrogate](../interrogate/) |
| The build, test first, once the behaviour is settled | [tdd](../tdd/) |
| Types that make the sketch's invalid states uncompilable | [strong-typescript](../strong-typescript/) |
| The comments the build left behind, cleared before review | [no-comments](../no-comments/) |
| The PR description and reports checked against the code | [claims-check](../claims-check/) |

The code-shape skills are a separate family with their own front door, [functional-architecture](../functional-architecture/). A sketch that is really a class goes there, failure and I/O that belong in return types go to [effects-as-values](../effects-as-values/), results to combine to [algebraic-composition](../algebraic-composition/), and variants written as optional fields to [discriminated-unions](../discriminated-unions/).

## When it fires

A change that crosses a function or module boundary · moving ownership of state · a new public API, package, config format, persisted shape or cache key · the same workaround showing up a second time · a feature about to start with no named data shape · "architect this" · "design this first" · "sketch the types before coding" · "what should the API look like" · "how should these modules talk" · "before you write any code"

## When it does not

A change whose shape is already obvious, with one function, one caller and no new state, gets nothing from a sketch. A spike that exists to learn something should learn first. A change that copies an established pattern inherits that pattern's design. Under about an hour of work, two sketches and a probe can cost more than writing it twice. The pass only pays if the design stays open to revision once code starts.

## Credit

Adapted from the `architect` skill and the design chapter of the guide in [pstack](https://github.com/cursor/plugins/tree/main/pstack) by Lauren Tan, MIT licensed. Several ideas are restated in this repository's own words rather than copied. Counting everything a caller must know, the deletion test, a different constraint per sketch and testing at the core's entry point come from Matt Pocock's [skills](https://github.com/mattpocock/skills), building on John Ousterhout's deep modules and "design it twice". Challenging a sketch with the reasoning stripped and the three outcomes of a remote write come from Addy Osmani's [agent-skills](https://github.com/addyosmani/agent-skills). The decision log and the rule that a factual challenge must carry its proof come from [rdf](https://github.com/rfxn/rdf) by R-fx Networks.
