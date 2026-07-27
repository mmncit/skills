# Result, Task, Validated

Dependency-free TypeScript implementations. Copy what you need; delete the rest.

## Result

```ts
export type Result<T, E = Error> =
    | { readonly ok: true; readonly value: T }
    | { readonly ok: false; readonly error: E };

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
export const err = <E>(error: E): Result<never, E> => ({ ok: false, error });

export const isOk = <T, E>(r: Result<T, E>): r is { ok: true; value: T } => r.ok;
```

The `readonly` fields and the `never` in the constructor return types matter: `ok(1)` is assignable to `Result<number, AnyError>`, so constructors compose into any error union without annotation.

### Combinators

```ts
/** Transform the success value. */
export const map = <T, U, E>(f: (t: T) => U) => (r: Result<T, E>): Result<U, E> =>
    r.ok ? ok(f(r.value)) : r;

/** Sequence a dependent step — short-circuits on the first error. */
export const chain = <T, U, E, F>(f: (t: T) => Result<U, F>) =>
    (r: Result<T, E>): Result<U, E | F> => (r.ok ? f(r.value) : r);

/** Transform the error — use at layer boundaries to translate error vocabularies. */
export const mapErr = <T, E, F>(f: (e: E) => F) => (r: Result<T, E>): Result<T, F> =>
    r.ok ? r : err(f(r.error));

/** Collapse both branches into one type. The only correct way to consume a Result. */
export const fold = <T, E, U>(onErr: (e: E) => U, onOk: (t: T) => U) =>
    (r: Result<T, E>): U => (r.ok ? onOk(r.value) : onErr(r.error));

/** Escape hatch for the UI edge. */
export const unwrapOr = <T, E>(fallback: T) => (r: Result<T, E>): T =>
    r.ok ? r.value : fallback;

/** First error wins. For all errors, use Validated below. */
export const all = <T, E>(rs: readonly Result<T, E>[]): Result<T[], E> => {
    const out: T[] = [];
    for (const r of rs) {
        if (!r.ok) return r;
        out.push(r.value);
    }
    return ok(out);
};

/** First success wins — fallback chains. */
export const orElse = <T, E, F>(f: (e: E) => Result<T, F>) =>
    (r: Result<T, E>): Result<T, F> => (r.ok ? r : f(r.error));
```

`chain` widening the error to `E | F` is the point: the union accumulates down a pipeline, so the compiler tells you at the end exactly which failures a caller must handle.

These are curried so they drop into a `pipe`:

```ts
const version = pipe(
    parseConfig(raw),
    map((c: Config) => c.version),
    mapErr((e: ConfigError) => `config: ${e.kind}`),
    unwrapOr('unknown'),
);
```

### Interop with throwing code

```ts
/** Wrap a throwing call at the boundary. */
export const tryCatch = <T, E = Error>(f: () => T, onError: (e: unknown) => E): Result<T, E> => {
    try {
        return ok(f());
    } catch (e) {
        return err(onError(e));
    }
};

/** Where a caller genuinely needs an exception (framework boundaries). */
export const unwrap = <T, E>(r: Result<T, E>): T => {
    if (r.ok) return r.value;
    throw r.error instanceof Error ? r.error : new Error(String(r.error));
};

export const fromNullable = <T, E>(e: E) => (v: T | null | undefined): Result<T, E> =>
    v == null ? err(e) : ok(v);
```

Always pass an explicit `onError`. A default of `e => e as Error` reintroduces `unknown` errors, which is the problem you were solving.

## Task — deferred async

```ts
export type Task<T> = () => Promise<T>;

export const taskOf = <T>(value: T): Task<T> => () => Promise.resolve(value);

export const mapTask = <T, U>(f: (t: T) => U) => (task: Task<T>): Task<U> =>
    () => task().then(f);

export const chainTask = <T, U>(f: (t: T) => Task<U>) => (task: Task<T>): Task<U> =>
    () => task().then((t) => f(t)());

/** Wrap a rejecting promise-returning function once, at the boundary. */
export const fromPromise = <A extends unknown[], T, E>(
    fn: (...args: A) => Promise<T>,
    onError: (e: unknown) => E,
) => (...args: A): Task<Result<T, E>> =>
    async () => {
        try {
            return ok(await fn(...args));
        } catch (e) {
            return err(onError(e));
        }
    };
```

`Task<Result<T, E>>` — a deferred computation that can fail — covers essentially every real async case. It's two type parameters and no cleverness.

### What deferral buys you

```ts
export const retry = <T, E>(attempts: number, task: Task<Result<T, E>>): Task<Result<T, E>> =>
    async () => {
        let last = await task();
        for (let i = 1; i < attempts && !last.ok; i++) last = await task();
        return last;
    };

export const timeout = <T, E>(ms: number, onTimeout: E, task: Task<Result<T, E>>): Task<Result<T, E>> =>
    () => Promise.race([task(), new Promise<Result<T, E>>((r) => setTimeout(() => r(err(onTimeout)), ms))]);

/** Concurrent — all tasks start together. */
export const allTasks = <T, E>(tasks: readonly Task<Result<T, E>>[]): Task<Result<T[], E>> =>
    async () => all(await Promise.all(tasks.map((t) => t())));

/** Sequential — each waits for the last, stops at the first error. */
export const seqTasks = <T, E>(tasks: readonly Task<Result<T, E>>[]): Task<Result<T[], E>> =>
    async () => {
        const out: T[] = [];
        for (const t of tasks) {
            const r = await t();
            if (!r.ok) return r;
            out.push(r.value);
        }
        return ok(out);
    };
```

`retry` is the argument for `Task` in one line: you cannot retry a `Promise`, because it's already running. You can only retry the function that produces it.

Note `timeout` doesn't cancel the underlying work — it stops waiting. For real cancellation, pass an `AbortSignal` into the task.

## Validated — accumulate every failure

```ts
export type Validated<T, E = string> =
    | { readonly ok: true; readonly value: T }
    | { readonly ok: false; readonly errors: readonly E[] };

export const valid = <T>(value: T): Validated<T, never> => ({ ok: true, value });
export const invalid = <E>(...errors: E[]): Validated<never, E> => ({ ok: false, errors });

/** Combine two independent checks — both run, both errors survive. */
export const both = <T, E>(a: Validated<T, E>, b: Validated<T, E>): Validated<T, E> =>
    a.ok ? b : b.ok ? a : { ok: false, errors: [...a.errors, ...b.errors] };

export const combineAll = <T, E>(vs: readonly Validated<T, E>[]): Validated<T[], E> => {
    const errors = vs.flatMap((v) => (v.ok ? [] : v.errors));
    return errors.length > 0
        ? { ok: false, errors }
        : valid(vs.map((v) => (v as { ok: true; value: T }).value));
};
```

`both` is the monoid `concat` from `algebraic-composition` — associative, with `valid` acting as the identity on the success side.

### A field validator

```ts
export type Check<T, E = string> = (key: string, value: T) => Validated<T, E>;

export const isPresent: Check<unknown> = (key, v) =>
    v !== undefined && v !== null && v !== '' ? valid(v) : invalid(`${key} is required`);

export const isEmail: Check<string> = (key, v) =>
    /.+@.+\..+/.test(v) ? valid(v) : invalid(`${key} must be an email`);

/** Run several checks against one field — every check runs. */
export const allOf = <T, E>(...checks: Check<T, E>[]): Check<T, E> =>
    (key, value) => checks.map((c) => c(key, value)).reduce(both, valid(value) as Validated<T, E>);

/** Validate an object against a spec, collecting every message. */
export const validate = <T extends object, E>(
    spec: { [K in keyof T]?: Check<T[K], E> },
    obj: T,
): Validated<T, E> => {
    const errors = (Object.keys(spec) as (keyof T)[]).flatMap((key) => {
        const result = spec[key]!(String(key), obj[key]);
        return result.ok ? [] : [...result.errors];
    });
    return errors.length > 0 ? { ok: false, errors } : valid(obj);
};

// Every failing field reports, not just the first.
const result = validate({ email: allOf(isPresent, isEmail), name: isPresent }, form);
```

## Choosing between them

| Situation | Type |
|---|---|
| One synchronous step that can fail | `Result<T, E>` |
| Dependent steps, stop at the first failure | `Result` + `chain` |
| Independent checks, report all failures | `Validated<T, E>` |
| Deferred async that can fail | `Task<Result<T, E>>` |
| Needs retry, timeout, or ordering | `Task` (never a bare `Promise`) |
| Absence with no reason worth reporting | `T \| undefined` + a type guard |

The last row matters. If the only error message is "not found" and no caller distinguishes causes, `Result` is ceremony — return `undefined` and narrow with a guard.
