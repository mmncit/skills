---
name: policy-as-data
description: "Stop a domain rule from living on both sides of an API boundary by shipping the rule's decision — or the rule itself — as data instead of duplicating or code-sharing the logic. Use this skill when the same status check, permission check, or validation exists in both a backend handler and a frontend `disabled` prop, when a button's enabled state is re-derived client-side from raw fields like `status` or `role`, when a shared validation package is versioned or deployed separately from its consumers, when a Rust/Go/.NET service and a TypeScript client each encode one business rule, when the frontend shows an action that the API then rejects, when a tooltip needs to explain *why* something is disabled and the API only returns a boolean, or when someone asks 'where should this permission check live', 'how do I keep frontend and backend validation in sync', 'should I extract this validator into a shared package', 'why did the UI let them click that'. Provides a three-rung ladder from shipping the decision, to shipping the decision with reasons, to serializing the policy and sharing only a stable evaluator."
---

# Policy as Data

A domain rule that both the server and the client need does not become safe by being written once and imported twice. It becomes safe by being **decided once and transmitted**.

```ts
// This function will exist twice. Guaranteed.
function canCancelOrder(order: Order) {
    return ['PENDING', 'PAID'].includes(order.status);
}
```

The server needs it to reject a bad request. The client needs it to disable a button. Two copies of one constraint, in two separately deployable units, drifting from the moment either is edited.

Based on Jay Freestone's [*Ship the policy, not the code*](https://www.jayfreestone.com/writing/share-the-policy-not-the-code).

## Two symptoms

- **The client re-derives a decision from raw fields.** `order.status === 'PENDING' || order.status === 'PAID'` in a component means the frontend is a second implementation of the backend's state machine. Adding a `PARTIALLY_REFUNDED` status now requires a coordinated two-repo change.
- **The UI offers an action the API rejects.** The user clicks, waits, and gets a 422. That gap *is* the drift, surfacing as a bug report.

## First: is it actually a domain rule?

Not everything crossing the boundary needs this. **Context-free helpers are fine to share as code** — `normalizePostcode()`, `formatCurrency()`, `slugify()`. They have no dependency on your data, your permissions model, or today's business policy. Publish them, version them, move on.

The ladder below is for **contextual** rules: ones whose answer depends on the entity, the actor, or a policy someone in the business can change.

## The ladder

Climb only as far as the problem requires — **most boundaries should stop at rung 1 or 2.**

### 1. Ship the decision

Compute the rule where it is authoritative and put the *answer* in the response.

```jsonc
{
    "id": "123",
    "status": "PENDING",
    "allowedActions": ["CANCEL"]
}
```

```tsx
function CancelButton({ allowedActions }: { allowedActions: Action[] }) {
    const disabled = !allowedActions.includes('CANCEL');
    return <button disabled={disabled}>Cancel order</button>;
}
```

The client no longer knows what `PENDING` implies, and doesn't need to. This is what GitHub's GraphQL API does with fields like `viewerCanUpdate`, and it's the same instinct as HATEOAS: the server advertises the transitions rather than letting clients infer them.

The important property is not that it's less code — it's that **there is no longer a second place to update.** A new status ships with the server.

### 2. Ship the decision *with reasons*

Rung 1 has a failure mode people hit about a week later: a bare boolean can't render a tooltip. The designer asks why the button is greyed out, and the only honest answer the client has is "the server said so."

```jsonc
{
    "status": "SHIPPED",
    "allowedActions": [],
    "disabledReasons": {
        "CANCEL": "Orders can't be canceled once shipped"
    }
}
```

Now the client renders an explanation without reconstructing the rule that produced it. Treat this as a rung, not a footnote — teams that skip it end up re-adding `if (status === 'SHIPPED')` to the frontend purely to write the tooltip copy, which reintroduces the duplication rung 1 removed.

Decide deliberately whether `disabledReasons` carries **prose** (simplest; server owns copy) or a **machine code** the client maps to localized strings (`{ "CANCEL": "ALREADY_SHIPPED" }`). Prose is right until you need i18n or per-surface wording; codes are right after.

### 3. Ship the policy, share only the evaluator

When the rule must be re-evaluated client-side — live filtering over a list, optimistic UI, form fields appearing as the user types — a per-decision round trip is wrong. Serialize the **policy** and keep a small, stable evaluator on both sides.

```ts
import { packRules } from '@casl/ability/extra';
import { defineRulesFor } from '../services/appAbility';

app.post('/authz', (req, res) => {
    res.send({ rules: packRules(defineRulesFor(req.user)) });
});
```

The client unpacks those rules and asks `ability.can('cancel', order)` locally. The same shape works with JSON Schema for validation: the server emits the schema, the client validates against it with an off-the-shelf validator.

What makes this different from sharing code is **what is shared and how often it changes.** The evaluator is generic, stable, and versioned like a library. The business logic is data, generated server-side, refreshed per request. A policy change ships with the server; only an evaluator upgrade needs coordination.

## The polyglot case

If the API is Rust, Go, or .NET and the client is TypeScript, "share the code" was never on the table. You cannot import a Rust `fn` into a React component, and any workaround — codegen, a WASM build, a duplicated port — is already a serialization step with extra ceremony.

So in a polyglot stack the ladder isn't an improvement over code sharing, it's **the only set of options**, and the question collapses to which rung. Rungs 1 and 2 are language-agnostic by construction: JSON in, JSON out. Rung 3 needs an evaluator that exists in both languages, which is why JSON Schema (validators in every language) is a safer rung-3 substrate here than a JS-first library like CASL.

## Adoption in an existing codebase

- **Start with the rule that already caused a bug.** The action the UI offers and the API rejects. That one has a known failure and an obvious test.
- **Add the field before deleting the client logic.** Ship `allowedActions` alongside the existing client-side check, verify they agree in production, then delete the client copy. A big-bang swap makes any disagreement look like a regression.
- **Name actions, not permissions.** `allowedActions: ["CANCEL"]` maps onto a button. `permissions: ["orders:write"]` makes the client re-derive which buttons that implies — the same duplication in new clothes.
- **Return the field even when empty.** An absent `allowedActions` is indistinguishable from an old server, and clients will invent a fallback that becomes the second implementation again.
- **Watch what it does to caching.** A response containing `viewerCan…` fields is per-user, so it can't sit in a shared cache. Decide that consciously; sometimes the decision belongs on a separate, non-cached endpoint.

## Where to go next

- `references/decision-payloads.md` — response shapes for rungs 1–2, typing actions and reasons in TypeScript, consuming them in React, REST vs GraphQL placement, versioning and caching consequences.
- `references/serialized-policies.md` — a CASL `packRules`/`unpackRules` round trip, JSON Schema as a cross-language substrate, choosing an evaluator, and refresh/invalidation of a shipped policy.
- Modelling the rejected case as a value rather than a thrown error is `effects-as-values`.
- Keeping the rule itself a pure function of its inputs, server-side, is `functional-architecture`.

## When NOT to use it

- **The rule is presentational.** Field ordering, truncation, which columns are visible by default. It was never a domain rule and the server has no authority over it.
- **One deployable, atomic ship.** A server-rendered app where the template and the handler are the same build genuinely cannot drift. The premise doesn't hold; the indirection is cost with no benefit.
- **The decision needs to be instant and the answer is cheap.** Disabling a submit button while a required field is empty should not wait for a round trip. Ship the *constraint* (rung 3, or just `required: true` in a schema) rather than the decision.
- **The policy isn't expressible as data.** A `zod` schema is code — closures, refinements, custom messages. Serializing it means rewriting it in something else. If that translation is lossy, a shared module is the honest answer; take the versioning cost knowingly.
- **You'd be inflating every response for a rare screen.** Twelve `allowedActions` arrays on a list endpoint used by one admin view is a real payload cost. Put the decision on the detail endpoint, or a dedicated one.
- **The client is untrusted and that's the whole point.** Shipping the policy tells the client what the rules are. That's usually fine — the server still enforces them — but if the rule set itself is sensitive (fraud thresholds, pricing logic), ship only the decision, never the policy.
