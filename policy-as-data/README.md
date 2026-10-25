# policy-as-data

A coding-guideline skill for the rule that lives on both sides of an API boundary: the status check in the handler that is also the `disabled` prop in the component.

A domain rule does not become safe by being written once and imported twice. Two separately deployable units drift, through different package versions, a failed deploy, or two languages that cannot share a function at all. It becomes safe by being decided once and transmitted as data.

This is the only skill in the repository that is a boundary problem rather than a code-shape problem. A rule can be perfectly pure, perfectly composed, and still exist twice.

## The ladder

| Rung | Ship | Looks like |
|---|---|---|
| 1 | The decision | `"allowedActions": ["CANCEL"]` |
| 2 | The decision and the reasons | `"disabledReasons": { "CANCEL": "ALREADY_SHIPPED" }` |
| 3 | The policy itself, sharing only a stable evaluator | CASL `packRules`, or a server-generated JSON Schema |

Most boundaries stop at 1 or 2. Rung 3 is for when the client must re-evaluate locally: live filtering, optimistic UI, progressive forms, offline. Context-free helpers such as `normalizePostcode` are exempt, so share those as code and move on.

## Contents

| File | What it is |
|---|---|
| `SKILL.md` | The two symptoms, the three rungs, the polyglot case, an adoption order, and when not to use it. |
| `references/decision-payloads.md` | Rung 1 and 2 response shapes, typing actions and reasons, consuming them in React, REST versus GraphQL placement, and the caching consequences. |
| `references/serialized-policies.md` | Rung 3 in full: a CASL `packRules` and `unpackRules` round trip, JSON Schema as the cross-language substrate, choosing an evaluator, and policy refresh and staleness. |

## When it fires

The same status or permission check in a backend handler and a frontend `disabled` prop · a component re-deriving state from raw `status` or `role` fields · the UI offering an action the API then rejects with a 422 · a shared validation package versioned separately from its consumers · a Rust, Go or .NET service and a TypeScript client each encoding one rule · a tooltip that needs to explain why something is disabled when the API returns only a boolean · "where should this permission check live?" · "how do I keep frontend and backend validation in sync?"

## When it does not

A presentational rule, such as field ordering or which columns show by default, was never a domain rule and the server has no authority over it. A server-rendered app that ships the template and the handler in one build genuinely cannot drift, so the premise does not hold. When the decision must be instant and the answer is cheap, such as disabling submit while a required field is empty, ship the constraint rather than waiting on a round trip for the decision. A policy that is not expressible as data, such as a `zod` schema full of closures and refinements, makes a shared module the honest answer; take the versioning cost knowingly. Putting twelve `allowedActions` arrays on a list endpoint for the sake of one admin view is a real payload cost. And shipping the policy tells the client what the rules are, which is usually fine because the server still enforces them, but not when the rule set itself is sensitive.

## Siblings

| What you are looking at | Skill |
|---|---|
| The rejected case is a thrown exception rather than a value | [effects-as-values](../effects-as-values/) |
| The rule itself is tangled with I/O and hard to evaluate purely | [functional-architecture](../functional-architecture/) |

## Credit

Based on Jay Freestone's [Ship the policy, not the code](https://www.jayfreestone.com/writing/share-the-policy-not-the-code).
