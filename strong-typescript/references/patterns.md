# Strong TypeScript patterns

A before and after for each rung of the ladder in `SKILL.md`, and for the rules that apply on every rung. Every block here type-checks under `strict` with `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`, given declarations for the few names it only mentions.

The examples return the `Result` type from `effects-as-values`:

```ts
type Result<T, E = Error> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
const err = <E>(error: E): Result<never, E> => ({ ok: false, error });
```

Exhaustive `switch` statements are not repeated here. They are rung 4 of `discriminated-unions`.

## Rung 1: stop lying to the compiler

Before: the response is `any`, so a misspelt field compiles and arrives as `undefined` at runtime.

```ts
async function yearlyPrice(id: string) {
  const res = await fetch(`/api/plans/${id}`);
  const body: any = await res.json();
  return body.monthlyPrice * 12;
}
```

After: the body is `unknown` until something checks it, and the failure the check can find is in the return type. `parsePlan` is rung 2.

```ts
async function yearlyPrice(id: string): Promise<Result<number, PlanError>> {
  const res = await fetch(`/api/plans/${id}`);
  const plan = parsePlan(await res.json());
  return plan.ok ? ok(plan.value.monthlyPrice * 12) : plan;
}
```

`satisfies` checks a value against a type and keeps the value's own, narrower type. Here that means the object keeps its real keys. Annotated as `Record<string, Route>` instead, `routes.billing` would be `Route | undefined` under `noUncheckedIndexedAccess`, and a misspelt `routes.biling` would compile.

```ts
type Route = { readonly path: string; readonly auth: boolean };

const routes = {
  home: { path: "/", auth: false },
  billing: { path: "/billing", auth: true },
} satisfies Record<string, Route>;

const billing: Route = routes.billing;
```

## Rung 2: parse at the boundary into a Result

One function where the data enters, returning a named type or a named error. Everything after it trusts `Plan`, and every caller has to decide what a bad plan means.

```ts
type Plan = { readonly id: string; readonly name: string; readonly monthlyPrice: number };

type PlanError =
  | { kind: "notAnObject" }
  | { kind: "badField"; field: keyof Plan; expected: "string" | "number" };

function parsePlan(input: unknown): Result<Plan, PlanError> {
  if (typeof input !== "object" || input === null) return err({ kind: "notAnObject" });
  if (!("id" in input) || typeof input.id !== "string")
    return err({ kind: "badField", field: "id", expected: "string" });
  if (!("name" in input) || typeof input.name !== "string")
    return err({ kind: "badField", field: "name", expected: "string" });
  if (!("monthlyPrice" in input) || typeof input.monthlyPrice !== "number")
    return err({ kind: "badField", field: "monthlyPrice", expected: "number" });
  return ok({ id: input.id, name: input.name, monthlyPrice: input.monthlyPrice });
}
```

There is no cast. Each `in` check narrows `input` to an object that has that key, and the `typeof` check narrows the key's value.

With a schema library in the repository, define the schema once and infer the type, so the two cannot drift. Use the non-throwing parse and convert its result at the boundary. With Zod:

```ts
import { z } from "zod";

const PlanSchema = z.object({ id: z.string(), name: z.string(), monthlyPrice: z.number() });
type Plan = z.infer<typeof PlanSchema>;

function parsePlan(input: unknown): Result<Plan, z.ZodError> {
  const parsed = PlanSchema.safeParse(input);
  return parsed.success ? ok(parsed.data) : err(parsed.error);
}
```

Environment variables cross a boundary too. Parse them once at startup into a config object, and stop the process there if the result is an error, rather than reading `process.env.X` wherever it is needed.

## Rung 3: branded primitives

Before: both parameters are `string`, so swapping them compiles.

```ts
declare function addMember(orgId: string, userId: string): Promise<void>;
```

After: each ID is its own type, and the only way to get one is a parse that checks it.

```ts
type UserId = string & { readonly __brand: "UserId" };
type OrgId = string & { readonly __brand: "OrgId" };

const isUserId = (s: string): s is UserId => /^usr_[a-z0-9]{12}$/.test(s);

const parseUserId = (s: string): Result<UserId, { kind: "badUserId"; value: string }> =>
  isUserId(s) ? ok(s) : err({ kind: "badUserId", value: s });

declare function addMember(args: { orgId: OrgId; userId: UserId }): Promise<void>;
```

Passing a `UserId` where an `OrgId` is expected is now a compile error, and so is passing a raw `string`.

## Rung 4: read-only data

Before: the function changes the invoice it was given, so every other holder of that object sees the change, and the signature does not say so.

```ts
type Line = { sku: string; qty: number };
type Invoice = { id: string; lines: Line[] };

function addLine(invoice: Invoice, line: Line): void {
  invoice.lines.push(line);
}
```

After: the types forbid the mutation, so adding a line means building the next invoice. `invoice.lines.push(line)` no longer compiles.

```ts
type Line = { readonly sku: string; readonly qty: number };
type Invoice = { readonly id: string; readonly lines: readonly Line[] };

const addLine = (invoice: Invoice, line: Line): Invoice => ({
  ...invoice,
  lines: [...invoice.lines, line],
});
```

`readonly` is shallow and compile-time only. It stops code that respects the types, not code that casts it away or has no types, and nested objects need their own `readonly` fields, as `Line` has here. A `readonly` array also cannot be passed to a parameter typed as a mutable array, which is the cost the When NOT section mentions.

## Rung 5: constructive types

Before: every caller has to remember the empty case, and the function throws when one forgets.

```ts
function pickWinner(entries: readonly string[]): string {
  const winner = entries[Math.floor(Math.random() * entries.length)];
  if (winner === undefined) throw new Error("no entries");
  return winner;
}
```

After: an empty value of the type cannot exist, so there is no case to forget. The guard narrows a plain array once, where it arrives.

```ts
type NonEmpty<T> = readonly [T, ...T[]];

const isNonEmpty = <T>(xs: readonly T[]): xs is NonEmpty<T> => xs.length > 0;

function pickWinner(entries: NonEmpty<string>): string {
  return entries[Math.floor(Math.random() * entries.length)] ?? entries[0];
}
```

`noUncheckedIndexedAccess` still types a computed index as possibly `undefined`, even on a non-empty tuple, so the `?? entries[0]` fallback stays. The first element is typed as present.

The same move for a time range: a start and a duration cannot be reversed the way two dates can.

```ts
type Range = { readonly start: Date; readonly durationMs: number };
```

## A guard that checks

A guard's name is a promise. The first guard below checks one field and lets anything with an `id` through as a `User`.

```ts
type User = { readonly id: string; readonly email: string };

const isUserLoose = (x: unknown): x is User =>
  typeof x === "object" && x !== null && "id" in x;

const isUser = (x: unknown): x is User =>
  typeof x === "object" &&
  x !== null &&
  "id" in x &&
  typeof x.id === "string" &&
  "email" in x &&
  typeof x.email === "string";
```

## Derive before declaring

Rather than a second set of interfaces kept in step with the function by hand, derive them from its signature. Changing the signature then changes all three, and every place that disagrees fails to compile.

```ts
declare function createInvoice(args: {
  customerId: string;
  lines: readonly { sku: string; qty: number }[];
}): Promise<{ id: string; total: number }>;

type CreateInvoiceArgs = Parameters<typeof createInvoice>[0];
type Invoice = Awaited<ReturnType<typeof createInvoice>>;
type InvoiceLine = CreateInvoiceArgs["lines"][number];
```

## Object arguments

Before: three positional values, two of them booleans, and the call site says nothing.

```ts
declare function exportReport(id: string, includeDrafts: boolean, compress: boolean): Promise<void>;

exportReport("r_1", true, false);
```

After: the call site names what each value means, and adding an option does not reorder anything.

```ts
declare function exportReport(args: { id: string; includeDrafts: boolean; compress: boolean }): Promise<void>;

exportReport({ id: "r_1", includeDrafts: true, compress: false });
```
