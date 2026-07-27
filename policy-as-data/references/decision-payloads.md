# Decision payloads

Concrete shapes for rungs 1 and 2 — what the server puts in the response, how the client types and consumes it, and the consequences for API design and caching.

## The shape

Three fields, in increasing order of how much you need them.

```jsonc
{
    "id": "ord_123",
    "status": "SHIPPED",

    // Rung 1 — what the actor may do to this entity, right now.
    "allowedActions": ["REFUND"],

    // Rung 2 — why the others aren't available.
    "disabledReasons": {
        "CANCEL": "ALREADY_SHIPPED"
    }
}
```

`allowedActions` is the closed set of things the server will accept. `disabledReasons` explains the complement — the actions the client knows about that aren't in `allowedActions`. It does **not** need an entry for every possible action; a missing entry means "no explanation, just hide it."

## Typing it

The action union is the contract. Generate it from the server if you can; hand-write it if you can't.

```ts
export const ORDER_ACTIONS = ['CANCEL', 'REFUND', 'REORDER'] as const;
export type OrderAction = (typeof ORDER_ACTIONS)[number];

export type OrderDecisions = {
    readonly allowedActions: readonly OrderAction[];
    readonly disabledReasons?: Partial<Record<OrderAction, DisabledReason>>;
};

export type Order = {
    readonly id: string;
    readonly status: OrderStatus;
} & OrderDecisions;
```

Two things this buys you:

- A typo in `allowedActions.includes('CANCELL')` is a compile error.
- Adding a server action without updating the client union is visible — the new string won't be assignable, so the drift is caught at the type level rather than at runtime.

If the server can send an action the client doesn't know, widen deliberately rather than by accident:

```ts
readonly allowedActions: readonly (OrderAction | (string & {}))[];
```

`string & {}` keeps autocomplete for the known members while permitting unknown ones. Use it only when forward-compatibility with a newer server is a real requirement.

## Reason codes vs prose

| | Prose | Code |
|---|---|---|
| Payload | `"Orders can't be canceled once shipped"` | `"ALREADY_SHIPPED"` |
| Copy owned by | Server | Client |
| i18n | Server must know the locale | Client already has it |
| Per-surface wording | Impossible without a variant field | Free — map the code differently |
| Cost to start | Zero | A lookup table on every client |

Start with prose. Move to codes the first time you need a second language or a second surface (mobile, email, admin) that wants different wording. When you do, keep the field name and change the value space — clients that render the string unmodified degrade to showing the code, which is ugly but not broken.

```ts
const REASON_COPY: Record<DisabledReason, string> = {
    ALREADY_SHIPPED: t('orders.cancel.alreadyShipped'),
    OUTSIDE_WINDOW: t('orders.cancel.outsideWindow'),
    INSUFFICIENT_ROLE: t('orders.cancel.insufficientRole'),
};

const explain = (code: DisabledReason): string => REASON_COPY[code] ?? '';
```

## Consuming it

Keep the decision-reading in one place so components don't each re-implement the lookup.

```tsx
type ActionState =
    | { readonly available: true }
    | { readonly available: false; readonly reason: string | null };

export function actionState(order: OrderDecisions, action: OrderAction): ActionState {
    if (order.allowedActions.includes(action)) return { available: true };
    const code = order.disabledReasons?.[action];
    return { available: false, reason: code ? explain(code) : null };
}
```

```tsx
function CancelButton({ order }: { order: Order }) {
    const state = actionState(order, 'CANCEL');

    return (
        <Tooltip content={state.available ? null : state.reason}>
            <button disabled={!state.available}>Cancel order</button>
        </Tooltip>
    );
}
```

Note what the component does *not* contain: no `status`, no role check, no date arithmetic. Swap the whole state machine server-side and this file doesn't change.

**Disable, don't hide** — usually. A hidden button is unexplainable, and rung 2 exists precisely so you can explain. Hide only when the action is irrelevant to this actor (a viewer never sees admin controls) rather than merely unavailable right now.

## Where the fields live

**GraphQL** — put them on the type as scalar fields, prefixed to make the actor-relative nature obvious:

```graphql
type Order {
    id: ID!
    status: OrderStatus!
    viewerCanCancel: Boolean!
    viewerCannotCancelReason: String
}
```

This is GitHub's convention and it composes well with field selection: a list view that doesn't need the decision simply doesn't request it, so you don't pay for it.

**REST** — you don't get field selection for free, which changes the calculus:

- **Detail endpoints** (`GET /orders/:id`): include the decision fields unconditionally. The payload is one entity and the client almost certainly needs them.
- **List endpoints** (`GET /orders`): including per-row decisions can multiply the response size and force a per-user computation across the page. If only one screen needs them, gate behind a query parameter (`?include=actions`) or serve them from a separate endpoint.
- **A dedicated decisions endpoint** (`GET /orders/:id/actions`) is worth it when the entity is heavily cached and the decision is not — see below.

## Caching

This is the consequence people discover late.

`allowedActions` is a function of *the entity and the actor*. The moment you embed it, the response is per-user and can no longer sit in a shared cache — not in a CDN, not in a shared Redis entry keyed by entity id, not in an HTTP cache without `Vary` gymnastics.

Three ways out, in order of preference:

1. **Accept it.** Most authenticated API responses were already per-user. Mark the response `Cache-Control: private` and stop worrying.
2. **Split the resource.** Keep `GET /orders/:id` shared-cacheable and put the decision on `GET /orders/:id/actions`, cached per-user with a short TTL. Costs a second request; buys back the shared cache on the expensive payload.
3. **Cache the entity, compute the decision on the way out.** Read the entity from the shared cache, evaluate the policy per-request, merge. Cheapest for the client, and correct as long as evaluation is fast and depends only on data you already have in hand.

Whichever you pick, make sure the decision's TTL is **not longer** than the entity's. A stale `allowedActions` next to a fresh `status` is exactly the drift this pattern was meant to eliminate, reintroduced by the cache layer.

## Testing

The point of the pattern is that there's one implementation, so test it once — server-side, against the state machine:

```ts
test.each([
    ['PENDING', ['CANCEL', 'REORDER']],
    ['PAID', ['CANCEL', 'REORDER']],
    ['SHIPPED', ['REFUND', 'REORDER']],
    ['CANCELED', ['REORDER']],
])('%s allows %j', (status, expected) => {
    expect(allowedActionsFor(orderWith({ status }), viewer)).toEqual(expected);
});
```

Client-side, assert only that the component **renders what it was given** — pass `allowedActions: []` and check the button is disabled. A client test that asserts "a SHIPPED order can't be canceled" has recreated the duplication in the test suite.

Worth adding one contract test: that every action name the client's union knows about is one the server can emit, and vice versa. That's the seam where drift actually reappears.
