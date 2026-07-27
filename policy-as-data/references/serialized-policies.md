# Serialized policies

Rung 3: when the client must re-evaluate the rule itself, ship the rule as data and share only a stable evaluator.

Reach for this when a per-decision round trip is the wrong shape:

- **Live filtering** — "show only the orders I can cancel" across 500 rows the client already holds.
- **Optimistic UI** — deciding whether an action is permitted before the mutation resolves.
- **Progressive forms** — fields appearing and validation firing as the user types.
- **Offline** — the policy was fetched while online and must still be evaluable.

If none of those apply, stay on rung 1 or 2. Rung 3 adds a dependency and a refresh problem.

## What is actually shared

The distinction that makes this not-code-sharing:

| | Changes | Shipped as | Coordination cost |
|---|---|---|---|
| The **evaluator** | Rarely; semver'd like any library | Code, in both places | Real, but amortized |
| The **policy** | Whenever the business changes | Data, generated per request | None |

A rule change ships with the server. Only an evaluator upgrade needs a coordinated release — and evaluators are generic enough that you'll do that once a year, not once a sprint.

## CASL: a round trip

CASL models abilities as a list of rule objects, which is exactly the serializable form you need. `packRules` compresses them for transport; `unpackRules` restores them.

**Server** — one definition, used both to enforce and to publish:

```ts
import { AbilityBuilder, createMongoAbility, type MongoAbility } from '@casl/ability';
import { packRules } from '@casl/ability/extra';

type Actions = 'read' | 'cancel' | 'refund';
type Subjects = 'Order' | 'all';
export type AppAbility = MongoAbility<[Actions, Subjects]>;

export function defineRulesFor(user: User) {
    const { can, cannot, rules } = new AbilityBuilder<AppAbility>(createMongoAbility);

    can('read', 'Order', { orgId: user.orgId });
    can('cancel', 'Order', { orgId: user.orgId, status: { $in: ['PENDING', 'PAID'] } });
    cannot('cancel', 'Order', { total: { $gt: 100_000 } }).because('APPROVAL_REQUIRED');

    if (user.role === 'admin') can('refund', 'Order', { orgId: user.orgId });

    return rules;
}
```

```ts
app.get('/authz', requireAuth, (req, res) => {
    res.json({ rules: packRules(defineRulesFor(req.user)) });
});
```

The same `defineRulesFor` backs enforcement, so the published policy cannot disagree with the one being enforced:

```ts
const ability = createMongoAbility(defineRulesFor(req.user));
ForbiddenError.from(ability).throwUnlessCan('cancel', subject('Order', order));
```

**Client** — fetch once, evaluate locally:

```ts
import { createMongoAbility, subject } from '@casl/ability';
import { unpackRules } from '@casl/ability/extra';

const { rules } = await api.get<{ rules: PackedRule[] }>('/authz');
export const ability = createMongoAbility(unpackRules(rules));

const cancellable = orders.filter((o) => ability.can('cancel', subject('Order', o)));
```

Two details that matter in practice:

- **`subject()` is not optional.** A plain object literal has no type tag, so CASL can't match it against `'Order'` rules. Either tag at the boundary with `subject()` or configure `detectSubjectType`.
- **Conditions are evaluated against fields the client must actually have.** A rule keyed on `order.internalRiskScore` silently never matches if that field isn't in the client's payload. Keep rule conditions to fields the client is sent — or leave those rules to rung 1.

**Reasons** come through `ability.relevantRuleFor`, so rung 2's explanation survives:

```ts
const rule = ability.relevantRuleFor('cancel', subject('Order', order));
const reason = rule?.reason ?? null;   // 'APPROVAL_REQUIRED'
```

## JSON Schema: the cross-language substrate

CASL is JavaScript. If one side is Rust, Go, .NET, Python, or Swift, JSON Schema is the better rung-3 substrate — it's a specification with maintained validators in every language, so the "shared evaluator" is an off-the-shelf dependency on both sides rather than something you port.

**Server emits the schema** (per-context, not a static file — that's the point):

```jsonc
{
    "type": "object",
    "required": ["quantity", "shippingMethod"],
    "properties": {
        "quantity": { "type": "integer", "minimum": 1, "maximum": 40 },
        "shippingMethod": { "enum": ["STANDARD", "EXPRESS"] }
    }
}
```

The `maximum` of 40 came from *this* customer's contract, and the `EXPRESS` option from *this* region's availability. That contextual generation is what separates this from checking in a schema file.

**Client validates against it:**

```ts
import Ajv from 'ajv';

const validate = new Ajv({ allErrors: true }).compile(schema);
if (!validate(formValues)) {
    setErrors(fieldErrorsFrom(validate.errors ?? []));
}
```

The server validates with the same schema before writing. One rule, one representation, two off-the-shelf evaluators.

Limits worth knowing before you commit: JSON Schema expresses shape and range well, and cross-field rules poorly. `if`/`then`/`dependentRequired` cover simple cases; "delivery date must be at least three business days after the order date, excluding regional holidays" is not a schema. Put that class of rule on rung 1 and return the computed valid range instead.

## Choosing an evaluator

| Need | Use |
|---|---|
| Permissions, JS on both sides | CASL (`packRules`) |
| Input validation, any language pair | JSON Schema + a native validator |
| Feature/entitlement flags | Your flag provider already does this — don't rebuild it |
| Complex org-hierarchy authorization | A policy engine (OPA/Rego, Cedar, OpenFGA) exposing a decision API — which puts you back on rung 1 for the client |
| Anything you'd have to invent a DSL for | Stop. Go back to rung 1. |

That last row is the important one. A hand-rolled rule interpreter is a shared module with extra steps, and now you own a language. The value of rung 3 comes from the evaluator being *someone else's stable dependency*.

## Refreshing a shipped policy

A policy the client holds is a cache, and it goes stale — a role change, a plan upgrade, a contract renegotiation.

- **Fetch on session start**, and again on any event that could change the actor's standing (login, org switch, subscription change).
- **Version it.** Return an opaque `policyVersion` with the rules and echo it on mutations. When the server sees a stale version it can respond `409` with the new policy attached, so the client self-heals instead of failing repeatedly.
- **Keep the TTL short and the enforcement absolute.** A stale client policy must never be able to widen what's permitted. The server enforces with the *current* rules regardless of what the client believes — the shipped policy is a UI affordance, never a security boundary.
- **Don't ship policy you don't want read.** Rules sent to the browser are readable by the user. Fine for "admins can refund"; not fine for fraud thresholds or pricing tiers. Those stay on rung 1, where only the decision crosses the wire.

## Failure mode to watch

The client evaluates `can('cancel')` as `true`, the server rejects the mutation. That means the two evaluations diverged — almost always one of:

1. The client's copy of the entity lacks a field a rule condition reads (see `subject()` note above).
2. The policy is stale.
3. Server enforcement doesn't go through the same `defineRulesFor` — someone added a hand-written `if` in the handler.

(3) is the one that quietly undoes the whole pattern. Enforce a rule that says: **if it's in the policy, the handler evaluates it through the evaluator; if the handler needs a check the policy can't express, that check produces a rung-1 field.** No hand-written duplicates of published rules.
