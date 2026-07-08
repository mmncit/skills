# entity-factory

A coding-guideline skill for building a family of **type-varying objects** — chart types, dashboard widgets, filters, map layers, any "entity kind" — with a functional factory instead of a growing `switch`.

The pattern, in three layers:

1. a string **enum of kinds**,
2. a **`Record<Kind, builderFn>` registry** + one generic dispatcher,
3. **pure builders** produced by a `withDefaults` higher-order factory, composed from shared helpers.

Adding a kind then costs **one registry entry** — no dispatcher or consumer edits.

## Contents

| File | What it is |
|---|---|
| `SKILL.md` | The pattern, the registry-vs-`__class__`-union choice, an add-a-kind checklist, and when *not* to use it. |
| `references/starter.md` | Framework-agnostic, copy-paste implementation (both dispatch styles + typing). |

## When it fires

Adding a new chart/widget/entity type · a `switch` over a `type`/`kind`/`__class__` field that keeps growing · duplicated per-variant code · designing a plugin/registry · "how do I add a new `<type>`?"
