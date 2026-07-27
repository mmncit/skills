# Injected effects

Rung 4 of the ladder, end to end. This is the pattern that makes a whole workflow testable without a mocking framework — and the practical realisation of "one program, several interpreters".

## The shape

Three pieces: a capability record type, a workflow that takes it, and one wiring site per environment.

```ts
// 1. The capabilities — every effect the workflow needs, as plain function types.
export type Effects = {
    findUser: (id: string) => Promise<Result<User, DbError>>;
    saveUser: (user: User) => Promise<Result<User, DbError>>;
    sendMail: (mail: Mail) => Promise<Result<void, MailError>>;
    now: () => Date;
    newId: () => string;
    log: (event: string, data?: unknown) => void;
};

// 2. The workflow — a function of its capabilities, returning a function of its input.
export const registerUser =
    (fx: Effects) =>
    async (input: Input): Promise<Result<User, DbError | MailError | Conflict>> => {
        const existing = await fx.findUser(input.email);
        if (!existing.ok) return existing;
        if (existing.value) return err({ kind: 'conflict', email: input.email });

        const user: User = { id: fx.newId(), createdAt: fx.now(), ...prepareUser(input) };
        const saved = await fx.saveUser(user);
        if (!saved.ok) return saved;

        const sent = await fx.sendMail(welcome(saved.value));
        if (!sent.ok) {
            fx.log('welcome_mail_failed', { id: saved.value.id });
            return sent;
        }
        return saved;
    };

// 3. Wiring — once, at the entry point.
export const liveEffects: Effects = {
    findUser: (id) => tryCatchAsync(() => db.users.findOne({ id }), toDbError),
    saveUser: (u) => tryCatchAsync(() => db.users.insert(u), toDbError),
    sendMail: (m) => tryCatchAsync(() => mailer.send(m), toMailError),
    now: () => new Date(),
    newId: () => crypto.randomUUID(),
    log: (event, data) => logger.info(event, data),
};

export const handler = registerUser(liveEffects);
```

`now` and `newId` belong in the record. They're the two effects people forget, and they're the reason otherwise-pure tests need frozen clocks and snapshot churn.

## The test double

A plain object. No framework, no module interception.

```ts
const testEffects = (overrides: Partial<Effects> = {}): Effects => ({
    findUser: async () => ok(undefined as unknown as User),
    saveUser: async (u) => ok(u),
    sendMail: async () => ok(undefined),
    now: () => new Date('2026-01-01T00:00:00Z'),
    newId: () => 'test-id-1',
    log: () => {},
    ...overrides,
});

it('rejects a duplicate email', async () => {
    const result = await registerUser(
        testEffects({ findUser: async () => ok(existingUser) }),
    )({ email: 'a@b.c', name: 'A' });

    expect(result.ok).toBe(false);
});

it('surfaces a database failure without sending mail', async () => {
    let mailed = false;
    const result = await registerUser(
        testEffects({
            saveUser: async () => err({ kind: 'timeout' } as DbError),
            sendMail: async () => { mailed = true; return ok(undefined); },
        }),
    )({ email: 'a@b.c', name: 'A' });

    expect(result.ok).toBe(false);
    expect(mailed).toBe(false);
});
```

A `defaults + overrides` factory is what keeps these readable: each test states only the capability it cares about, so a new field in `Effects` doesn't touch every test.

## Recording interpreter — asserting the effect sequence

Because effects are requested through one record, you can capture the whole trace and assert on **order**, which module mocks make awkward:

```ts
type Call = { effect: keyof Effects; args: unknown[] };

const recordingEffects = (base: Effects) => {
    const calls: Call[] = [];
    const wrapped = Object.fromEntries(
        (Object.keys(base) as (keyof Effects)[]).map((key) => [
            key,
            (...args: unknown[]) => {
                calls.push({ effect: key, args });
                return (base[key] as (...a: unknown[]) => unknown)(...args);
            },
        ]),
    ) as Effects;
    return { effects: wrapped, calls };
};

it('saves before it mails', async () => {
    const { effects, calls } = recordingEffects(testEffects());
    await registerUser(effects)({ email: 'a@b.c', name: 'A' });

    expect(calls.map((c) => c.effect)).toEqual(['findUser', 'newId', 'now', 'saveUser', 'sendMail']);
});
```

This is the useful half of the interpreter idea: the workflow described *what* it needed, and a different interpreter observed it. No free monad required.

## Versus module mocking

```ts
// Module mocking — the alternative
jest.mock('./db');
jest.mock('./mailer');
(db.users.insert as jest.Mock).mockResolvedValue(user);
```

| | Injected effects | Module mocks |
|---|---|---|
| Coupling | To a type you own | To the import graph |
| Refactoring a module path | No test changes | Every mock path breaks |
| Type safety | Full — `Effects` is checked | Casts to `jest.Mock` |
| Missing a capability | Compile error | Runtime `undefined is not a function` |
| Asserting call order | Trivial | Awkward across modules |
| Runner support needed | None | Framework-specific hoisting |
| Parallel tests | Independent records | Shared module registry |

The last row bites in practice: module mocks are global state, so tests interfere in watch mode and under parallel workers.

## Composing capabilities

Split the record by domain and let each workflow ask for exactly what it needs:

```ts
export type Clock = { now: () => Date };
export type UserStore = { findUser: (id: string) => Promise<Result<User, DbError>>; /* … */ };
export type Mailer = { sendMail: (m: Mail) => Promise<Result<void, MailError>> };

// The signature documents the blast radius: this one can't touch the mailer.
export const registerUser = (fx: UserStore & Mailer & Clock) => async (input: Input) => { /* … */ };
export const renameUser = (fx: UserStore & Clock) => async (id: string, name: string) => { /* … */ };
```

An intersection type at each call site is self-documenting and keeps test doubles minimal. Build the live record once and pass it everywhere — structural typing means it satisfies every narrower requirement automatically.

## Common mistakes

- **Injecting a class instance instead of functions.** `fx: Database` re-couples you to a real implementation and its constructor. Inject the two or three *operations* you actually call.
- **One giant `Effects` for the whole app.** Split by domain; intersect at the call site.
- **Forgetting `now` / `newId` / `random`.** These are effects. Leaving them ambient is why a test needs fake timers.
- **Letting effects throw.** A capability should return `Result`, converted at the wiring site. Half the value is lost if the workflow still needs `try/catch`.
- **Reaching for a DI container.** A record of functions is enough, and a container reintroduces the runtime indirection this pattern removes.
- **Threading `fx` through pure helpers.** `prepareUser` doesn't need it. Only the effectful workflow does; keep the pure core pure.

## When a plain parameter is enough

If a function needs exactly one effect, take that function as a parameter and skip the record:

```ts
export const expire = (now: () => Date) => (session: Session): boolean =>
    session.expiresAt < now();
```

The `Effects` record starts paying at roughly three capabilities, or when several workflows share the same set.
