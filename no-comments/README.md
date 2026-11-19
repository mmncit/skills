# no-comments

A skill for stripping a change down to the comments that say what the code cannot: a reason, a constraint, a workaround or a non-obvious invariant. A fresh-context reviewer deletes the rest, stale comments are checked against the code they describe, and rules that only a comment was guarding move into names, types, pure functions or tests.

A comment is a second copy of the truth that nothing verifies. When it agrees with the code it costs every reader, and an agent rereads it on every call. When it disagrees, nobody can tell which copy to trust.

## What stays

1. Why: the reason behind a choice that would otherwise look wrong.
2. A constraint from outside the function, with a link where one exists.
3. A workaround, naming what it works around.
4. A non-obvious invariant.
5. A ticket or RFC link.

Everything else goes: narration, restated names, change history, banners, commented-out code, filler, and docstrings on private helpers. Ticketless TODOs are listed for the user rather than deleted, a stale comment is rewritten only when the code proves the true reason, and a reason about our own code is replaced by a name, a type or a pure function when one would say it. Directives, license headers, migrations and generated code are never touched. Lint, type, coverage and scanner suppressions are judged on what they hide, and a deliberate negative type test stays.

## Contents

| File | What it is |
|---|---|
| `SKILL.md` | What stays and what goes, the never-touch list, the seven-step pass with its fresh-context reviewer, a before and after, and when not to use it. |

No reference files. The skill is self-contained.

## When it fires

A diff that narrates itself · comments restating a name or signature · change history in comments ("added", "now uses", "fixed", "per review") · banners, commented-out code, docstrings on private helpers · comments opening with "Note:" or "IMPORTANT" · "do not remove" with no reason anyone remembers · a comment that no longer matches its code · an `eslint-disable` or `@ts-expect-error` over a real error · before opening a PR · "remove the comments" · "reduce comments" · "stale comments" · "comment slop" · "deslop this diff"

## When it does not

Doc comments that a build or a published API reads, such as C# XML docs with warnings as errors, rustdoc on public items, or annotations that generate an OpenAPI spec, should shrink rather than disappear. Generated, vendored and snapshot files regenerate their comments. Flyway checksums applied versioned migrations, so editing one fails validation on the next deploy. Example repositories exist for their comments. Files outside the change in a shared repository turn a cleanup into merge conflicts for other people.

## Siblings

| What you are looking at | Skill |
|---|---|
| A comment covering for a confusing shape | [architect](../architect/) |
| A comment explaining tangled logic and I/O | [functional-architecture](../functional-architecture/) |
| A constraint a type could enforce | [strong-typescript](../strong-typescript/) |
| A constraint a test should enforce | [tdd](../tdd/) |
| A suppression that may be hiding a real failure | [interrogate](../interrogate/) |
| The PR description, which goes stale the same way | [claims-check](../claims-check/) |

## Credit

What stays, what goes, the handling of TODOs and stale comments, and the never-touch list are the repository owner's own comment rules. The fresh-context reviewer, the suppression check and turning constraints into types and tests are adapted from the `no-comments` skill and the Comment Sicko agent in [pstack](https://github.com/cursor/plugins/tree/main/pstack) by Lauren Tan, MIT licensed. Treating coverage and scanner ignores as suppressions is restated from Addy Osmani's [agent-skills](https://github.com/addyosmani/agent-skills).
