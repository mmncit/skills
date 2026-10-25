# algebraic-composition

A coding-guideline skill for the shape a surprising amount of application code turns out to be: take many things, produce one thing. Totals, merged config, collected errors, a state object after ten updates.

Written by hand each time, that becomes a bespoke loop with a bespoke accumulator and no reuse. The alternative is to define how two values combine, once, and get folding over any number of them for free.

## The two laws

A combine operation is safe to fold with when it satisfies both:

| Law | Means | Why it matters |
|---|---|---|
| Associativity | `concat(concat(a, b), c)` equals `concat(a, concat(b, c))` | Grouping does not change the result, so `reduce` and `reduceRight` agree and the work can be split or reordered |
| Identity | there is an empty value that changes nothing | An empty collection has an answer, and every fold has a starting point |

Subtraction and "average" fail the first one. Folding them produces results that quietly depend on direction.

## Contents

| File | What it is |
|---|---|
| `SKILL.md` | The laws, the refactor from loop to named combiner, composing state updaters, nested updates with lenses, and when not to use it. |
| `references/catalogue.md` | Typed implementations of `foldMap`, the standard combiners (sum, all, any, min, max, first-success, merge), record-of-monoids for single-pass multi-aggregation, endomorphism composition, and a property-test template for the laws. |
| `references/lenses.md` | Lenses as a composable getter and setter pair: `view`, `set` and `over`, all copying rather than mutating, replacing spread ladders and repeated path strings with one reusable definition. |

## When it fires

A `reduce` with an awkward multi-field accumulator · several loops each walking the same collection for a different total · independent update functions that must be merged into one · a state updater that has become a growing chain of if-blocks each writing a different field · combining two configuration objects · collecting every validation failure rather than stopping at the first · a deep update that has become a three-level spread ladder

## When it does not

One aggregate over one collection is already clear as a `reduce`; introduce a combiner at the second or third, not the first. Operations that are not associative do not belong here at all. Numeric hot paths pay a closure allocation per element, so keep the loop and leave the per-element function pure. Lenses start earning at two levels deep, or when the same path appears in three or more places; below that they are overhead.

## Siblings

| What you are looking at | Skill |
|---|---|
| Applying one function to the inside of a wrapper rather than folding many values into one | [domain-functors](../domain-functors/) |
| The values being combined are failures or I/O | [effects-as-values](../effects-as-values/) |
| A single `switch` over an action type with no shared field writing | [entity-factory](../entity-factory/) |
| The surrounding refactor from procedures to composed functions | [functional-architecture](../functional-architecture/) |
