# policy-as-data

A coding-guideline skill for the rule that lives on **both sides of an API boundary** — the status check in the handler that's also the `disabled` prop in the component.

The premise: a domain rule doesn't become safe by being written once and imported twice. Two separately deployable units drift — different package versions, a failed deploy, or two languages that can't share a function at all. It becomes safe by being **decided once and transmitted as data**.

Based on Jay Freestone's [*Ship the policy, not the code*](https://www.jayfreestone.com/writing/share-the-policy-not-the-code).

## The ladder

| Rung | Ship | Looks like |
|---|---|---|
| 1 | The decision | `"allowedActions": ["CANCEL"]` |
| 2 | The decision + reasons | `"disabledReasons": { "CANCEL": "ALREADY_SHIPPED" }` |
| 3 | The policy; share only a stable evaluator | CASL `packRules`, or a server-generated JSON Schema |

Most boundaries stop at 1 or 2. Rung 3 is for when the client must re-evaluate locally — live filtering, optimistic UI, progressive forms, offline.

Context-free helpers (`normalizePostcode`) are exempt: share those as code and move on.

## Contents

| File | What it is |
|---|---|
| `SKILL.md` | The two symptoms, the three-rung ladder, the polyglot case, an adoption order, and when *not* to use it. |
| `references/decision-payloads.md` | Rung 1–2 response shapes, typing actions and reasons, React consumption, REST vs GraphQL placement, and the caching consequences. |
| `references/serialized-policies.md` | Rung 3 in full — a CASL `packRules`/`unpackRules` round trip, JSON Schema as the cross-language substrate, choosing an evaluator, and policy refresh/staleness. |

## When it fires

The same status or permission check in a backend handler *and* a frontend `disabled` prop · a component re-deriving state from raw `status`/`role` fields · the UI offering an action the API then rejects with a 422 · a shared validation package versioned separately from its consumers · a Rust/Go/.NET service and a TypeScript client each encoding one rule · a tooltip that needs to explain *why* something is disabled when the API only returns a boolean · "where should this permission check live?" · "how do I keep frontend and backend validation in sync?" · "should I extract this validator into a shared package?"

## Siblings

| The code you're looking at | Skill |
|---|---|
| The rejected case is a thrown exception rather than a value | `effects-as-values` |
| The rule itself is tangled with I/O and hard to evaluate purely | `functional-architecture` |
