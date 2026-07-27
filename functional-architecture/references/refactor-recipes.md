# Refactor recipes

Before/after TypeScript for each rung of the ladder. Each recipe is behaviour-preserving on its own, so they can land as separate commits.

## 1. Class of mixed concerns → module of functions

The class below is a metaphor that blurred: it formats, it validates, it geocodes, it persists. Nothing about it needs to be one object.

```ts
// BEFORE
class UserService {
    private user: User;
    private errors: string[] = [];

    constructor(user: User) {
        this.user = user;
    }

    fullName() {
        return `${this.user.first} ${this.user.last}`;
    }

    validate() {
        this.errors = [];
        if (!this.user.email) this.errors.push('email required');
        if (!this.user.email?.includes('@')) this.errors.push('email invalid');
        return this.errors.length === 0;
    }

    async save() {
        if (!this.validate()) throw new Error(this.errors.join(', '));
        this.user.slug = this.fullName().toLowerCase().replace(/\s+/g, '-');
        return db.users.insert(this.user);
    }
}
```

`save()` fails diagnostic questions 1 and 3: it mutates `this.errors` and `this.user`, so calling it twice does not do the same thing, and `validate()` has an output (`this.errors`) that isn't in its return type.

```ts
// AFTER
export const fullName = (user: User): string => `${user.first} ${user.last}`;

export const slugify = (name: string): string => name.toLowerCase().replace(/\s+/g, '-');

export const validateUser = (user: User): string[] => [
    ...(user.email ? [] : ['email required']),
    ...(user.email?.includes('@') ? [] : ['email invalid']),
];

// pure core: User -> User. No db, no throw, no this.
export const prepareUser = (user: User): User => ({
    ...user,
    slug: slugify(fullName(user)),
});

// thin shell: the only part that touches the world
export async function saveUser(user: User): Promise<User> {
    const errors = validateUser(user);
    if (errors.length > 0) throw new Error(errors.join(', '));
    return db.users.insert(prepareUser(user));
}
```

`fullName`, `slugify`, `validateUser` and `prepareUser` now test with plain object literals. Only `saveUser` needs a database.

Returning `string[]` rather than throwing is a deliberate half-step — see the `effects-as-values` skill for making the failure part of the return type all the way up.

## 2. Imperative accumulation → pipeline

```ts
// BEFORE
function buildReport(rows: Row[], opts: { region: string }): ReportRow[] {
    let result = rows;
    result = result.filter((r) => r.region === opts.region);
    result = result.filter((r) => r.status !== 'void');
    const mapped = result.map((r) => ({ id: r.id, total: r.qty * r.price }));
    mapped.sort((a, b) => b.total - a.total);   // mutates `mapped`
    return mapped.slice(0, 10);
}
```

Five reassignments to `result`, an in-place `sort`, and nothing reusable falls out.

```ts
// AFTER
const inRegion = (region: string) => (rows: Row[]): Row[] =>
    rows.filter((r) => r.region === region);

const dropVoid = (rows: Row[]): Row[] => rows.filter((r) => r.status !== 'void');

const toReportRow = (rows: Row[]): ReportRow[] =>
    rows.map((r) => ({ id: r.id, total: r.qty * r.price }));

// copy before sorting — `sort` mutates in place
const byTotalDesc = (rows: ReportRow[]): ReportRow[] =>
    [...rows].sort((a, b) => b.total - a.total);

const topN = (n: number) => (rows: ReportRow[]): ReportRow[] => rows.slice(0, n);

export const buildReport = (opts: { region: string }) =>
    pipe(inRegion(opts.region), dropVoid, toReportRow, byTotalDesc, topN(10));
```

`buildReport(opts)` returns `(rows: Row[]) => ReportRow[]`, so it drops into any larger pipe. Every stage is separately testable, and `topN` / `byTotalDesc` are now reusable by other reports.

If the row count is large enough that per-stage allocation matters, keep a single loop and make the per-row function pure instead — see *When NOT to use it* in `SKILL.md`.

## 3. Flag parameters → composition

```ts
// BEFORE
function getUsers(
    users: User[],
    { activeOnly = false, withScores = false, sorted = false } = {},
) {
    let out = users;
    if (activeOnly) out = out.filter((u) => u.active);
    if (withScores) out = out.map((u) => ({ ...u, score: computeScore(u) }));
    if (sorted) out = [...out].sort((a, b) => a.last.localeCompare(b.last));
    return out;
}
```

Three booleans mean eight behaviours behind one signature and one test matrix — and the return type can't describe whether `score` is present.

```ts
// AFTER
export const activeOnly = (users: User[]): User[] => users.filter((u) => u.active);

export const withScores = (users: User[]): Scored<User>[] =>
    users.map((u) => ({ ...u, score: computeScore(u) }));

export const byLastName = <T extends { last: string }>(items: T[]): T[] =>
    [...items].sort((a, b) => a.last.localeCompare(b.last));

// Callers compose exactly what they need — and the type is now precise.
const activeLeaderboard = pipe(activeOnly, withScores, byLastName);
const allNamesSorted = pipe(byLastName);
```

`withScores` returns `Scored<User>[]`, so downstream code knows `score` exists. The flag version could only ever return `User[]`.

Keep a named wrapper for the common case (`activeLeaderboard`) so callers aren't forced to assemble the pipeline every time.

## 4. Mutation → narrowed transformation

```ts
// BEFORE
function applyUpdate(state: PlotState, update: Partial<PlotState>) {
    Object.keys(update).forEach((key) => {
        state[key] = update[key];        // mutates the caller's object
    });
    state.dirty = true;
    return state;
}
```

The caller's object changes under it, anything holding a reference sees a half-applied state mid-loop, and an unexpected key in `update` is written straight through.

```ts
// AFTER
const OWNED_KEYS = Object.keys(DEFAULT_PLOT_STATE) as (keyof PlotState)[];

export const applyUpdate = (state: PlotState, update: Partial<PlotState>): PlotState => ({
    ...state,
    ...pick(OWNED_KEYS, update),
    dirty: true,
});
```

Deriving the key set from the defaults object means a new field is allowed in exactly one place. Narrowing to owned keys is what keeps stale or hostile keys out of persisted-state round-trips.

For updates two or more levels deep, a spread ladder gets unreadable fast — reach for a lens instead (`algebraic-composition`, `references/lenses.md`).

## 5. Order-dependent init → explicit dependencies

```ts
// BEFORE — must be called in exactly this order, and nothing says so
class Chart {
    init() { this.scale = makeScale(this.data); }
    layout() { this.boxes = layoutBoxes(this.scale); }   // silently wrong before init()
    render() { draw(this.boxes); }
}
```

```ts
// AFTER — the order is enforced by the types
const scale = makeScale(data);
const boxes = layoutBoxes(scale);
draw(boxes);
```

`layoutBoxes` can't be called before `makeScale` because it needs the value `makeScale` returns. Sequencing that used to live in a comment (or a bug report) is now a compile error. This is diagnostic question 2 answered structurally.
