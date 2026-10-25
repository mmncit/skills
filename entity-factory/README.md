# entity-factory

A coding-guideline skill for building a family of type-varying objects, such as chart types, dashboard widgets, filters or map layers, with a functional factory instead of a growing `switch`.

The wrong instinct is a `switch` that every new kind must edit, with per-type code copied between branches. The right shape is one enum of kinds, one registry mapping each kind to a pure builder, and one generic dispatcher. Adding a kind then costs exactly one registry entry, with no dispatcher edits and no consumer edits.

## The three layers

1. A string enum of kinds, which is the discriminant.
2. A `Record<Kind, Builder>` registry plus a single `create(kind, input)` that looks the builder up and delegates.
3. Pure builders made by a higher-order `withDefaults` factory, with shared sub-parts and cross-cutting concerns in small helpers every builder reuses.

There is one deliberate choice inside this. The kind can be passed as an argument, which suits transient caller-driven creation, or carried in the data as a `__class__` field, which gives a real discriminated union and suits entities that are serialized and rehydrated.

## Contents

| File | What it is |
|---|---|
| `SKILL.md` | The three layers, the registry versus `__class__` choice, factoring shared behaviour into pure helpers, an add-a-kind checklist, and when not to use it. |
| `references/starter.md` | A framework-agnostic, copy-paste implementation: `withDefaults` in shallow and strict forms, both dispatch styles, typed `create` and `generateEntity`, shared-helper composition with `pipe`, and an add-a-kind walkthrough. |

## When it fires

Adding a new chart, widget or entity type · a `switch` or if-else over a `type`, `kind` or `__class__` field that keeps growing · per-type code duplicated across variants · designing a plugin or registry so new kinds register in exactly one place · building echarts or plotly option builders · "how do I add a new type?" · "how do I make this extensible?"

## When it does not

One or two variants that will not grow are fine as a plain `if`. Variants that do not share a common output contract are not one family, so keep them as separate functions. Behaviour that varies by runtime data rather than a fixed set of kinds is strategy or config, not a type factory. And a single kind with many options wants one parameterized builder, not a registry.

## Siblings

| What you are looking at | Skill |
|---|---|
| The step before this one: variants that are still an object with correlated optional fields | [discriminated-unions](../discriminated-unions/) |
| Merging defaults with overrides, once the shallow spread starts losing nested keys | [algebraic-composition](../algebraic-composition/) |
| Variants that all carry the same payload and differ only in how it is held | [domain-functors](../domain-functors/) |
| A builder that genuinely needs I/O, and where to put that boundary | [effects-as-values](../effects-as-values/) |
| The front door, and the `pipe` and currying mechanics `withDefaults` rests on | [functional-architecture](../functional-architecture/) |
