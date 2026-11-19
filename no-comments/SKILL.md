---
name: no-comments
description: "Strip a change down to the comments that say what the code cannot: a reason, a constraint, a workaround or a non-obvious invariant. A fresh-context reviewer deletes the rest, stale comments are checked against the code, and rules that only a comment was guarding move into names, types, pure functions or tests. Use this skill before opening a PR or asking for review, when a diff narrates itself line by line, when comments restate a name or record change history ('added', 'now uses', 'fixed', 'per review'), when there are banners, commented-out code or docstrings on private helpers, when a comment opens with 'Note:' or 'IMPORTANT' or says 'do not remove' and nobody remembers why, when a comment no longer matches the code under it, when an eslint-disable or @ts-expect-error hides a real error, or when someone says 'remove the comments', 'reduce comments', 'clean up comment noise', 'stale comments', 'comment slop', 'deslop this diff'. Never touches license headers, tool directives, migrations or generated code, and lists ticketless TODOs instead of deleting them."
---

# No comments

A comment is a second copy of the truth that nothing checks. When it agrees with the code it is noise the next reader pays for, and an agent rereads it on every call. When it disagrees, nobody can tell which copy to trust. The aim is fewer comments, each one true, and code that says the rest through names, types and small pure functions.

Two symptoms say a change needs this pass. A comment explains what the next line does. Or a comment apologises for the code below it, which means the code is the thing to fix.

## What stays and what goes

A comment stays only when the code cannot say it:

- why: the reason behind a choice that would otherwise look wrong or arbitrary
- a constraint from outside the function, such as a vendor bug, a protocol rule or an ordering another system depends on, with a link where one exists
- a workaround, naming what it works around
- a non-obvious invariant
- a link to a ticket or RFC

Delete:

- narration of the next line, and comments that restate a name or signature
- change history ("now uses", "added", "fixed", "per review"), which belongs in git
- banners, section dividers and commented-out code
- filler: "Note:", "Important:", "This function…", "Ensure that…", "robust", "comprehensive"
- docstrings on private or self-explanatory functions. Public ones shrink to one line unless the contract is not obvious from the signature.

Three cases need judgment rather than deletion:

- A TODO, FIXME or HACK with no ticket. List it for the user. Deleting it loses the one record that the problem exists.
- A stale comment. Read it against the code it describes. If the code shows it is wrong, delete it, or rewrite it when the reason still matters and the code makes the true reason clear. If you cannot establish the real reason, leave it and list it. Never invent a rationale.
- A reason about our own code. Before keeping it, ask whether a better name, a type, or an extracted pure function would say the same thing. If one would and it fits inside the scope, make that change and drop the comment. Otherwise keep it.

## Never touch

- License and copyright headers, shebangs and encoding lines.
- Directives a tool reads: `prettier-ignore`, `/// <reference …>`, `/* @__PURE__ */`, bundler magic comments, `// #region`, `//go:build` and its relatives, `// SAFETY:` on Rust `unsafe` blocks, and JSDoc type tags in `.js` files, which TypeScript reads as types. Lint and type suppressions are judged in step 5, not left alone.
- Doc comments that a build or a published API reads: C# XML docs where missing ones fail the build, rustdoc on a library's public items, annotations that generate an OpenAPI spec. Shrink these, never delete them.
- Migrations, generated code, vendored code and test snapshots.

## The pass

1. Fix the scope: the files or diff the user names, otherwise everything the branch changes since its merge base with the default branch, including uncommitted edits and new untracked files. Lines outside the scope are not touched, because rewriting a teammate's file in a shared repo turns a cleanup into merge conflicts. Unless the user asked for this pass by name, confirm the scope before the reviewer starts.
2. Hand the scope to a fresh-context reviewer subagent, not a fork of your own context, with the two sections above verbatim and these instructions. Delete every comment the rules say goes. Delete or keep, never reword. Edit nothing that is not a comment. Report each keep with the reason it stays, each ticketless TODO and stale comment, and each comment about our own code that a name, type or function could replace, naming the symbol. The agent that wrote the code wrote the comments and finds all of them necessary, which is why the reviewer has to be someone else. Without subagents, do the pass yourself and say so.
3. Check the reviewer's diff. Revert any edit that is not a comment deletion, anything outside the scope, and any deletion of a comment that carried a real reason. A keep that only says "important" or "do not remove" gets traced: read what it guards, and read the commit that added it. If no reason holds up, the comment goes. If the report itself is wrong in ways that matter, rerun the reviewer once with the problem named. A second bad report ends the pass, reported as unfinished.
4. Make the code say it. For each named symbol, rename it, give the value a type, or extract the logic into a pure function whose name states what the comment said. Do the ones that stay inside the scope. A rename that would reach callers outside it is reported, not done. Rewrite stale comments only where the code proves the true reason. For anything that needs a new shape, run `architect` on that piece and stop at the sketch.
5. Judge every suppression. For an `eslint-disable`, look up the rule it silences. Where the rule protects correctness, such as a floating promise or a missing hook dependency, the suppression is hiding a bug: fix the code and drop the suppression. Where the rule is style only, keep the suppression or change the config. An `@ts-expect-error` or `@ts-ignore` names no rule, so remove it and run the type checker to see what it was hiding.
6. Encode the constraints. A comment such as "order matters" or "talk to the payments team first" is a rule written where nothing checks it. Offer the cheapest enforcement in scope: a type that makes the wrong order unrepresentable, a test that fails if the line goes, a lint rule. Wait for a yes. If the answer is no, or nobody is there to answer, keep the comment and list the constraint as unenforced in the PR.
7. Verify. The diff shows comment deletions, the rewrites and reshapes you accepted, and nothing else. The type check, lint and tests pass. Do not run a formatter over whole files, because it changes lines outside the scope. As a rough measure, comment lines should end up under about 15% of the code the change adds.

Report the number of deletions, each keep with its reason, the reshapes, rewrites and suppression fixes, the encodings, the ticketless TODOs and unresolved stale comments, and the constraints left unenforced.

## What goes

The first block is commented in three of the ways the pass removes.

```ts
// Helper to get the user's display name
// Updated to fall back to email (per review)
function displayName(user: User): string {
  // IMPORTANT: do not change the order here
  return user.nickname ?? user.fullName ?? user.email;
}
```

None of the three survives. The first restates the name, the second is change history, and the third guards a real rule without saying why, so nothing checks it. After the pass the order lives in a test, where changing it fails the build.

```ts
function displayName(user: User): string {
  return user.nickname ?? user.fullName ?? user.email;
}

test("prefers the nickname, then the full name, then the email", () => {
  assert.equal(displayName({ nickname: "Nick", fullName: "Test User", email: "test@example.com" }), "Nick");
  assert.equal(displayName({ fullName: "Test User", email: "test@example.com" }), "Test User");
  assert.equal(displayName({ email: "test@example.com" }), "test@example.com");
});
```

## Where to go next

| Situation | Skill |
|---|---|
| A comment covering for a confusing shape, where the fix is a redesign | `architect` |
| A comment explaining a tangle of logic and I/O that a pure function would make obvious | `functional-architecture` |
| A constraint that a type could enforce instead of a comment | `strong-typescript` |
| A constraint that a test should enforce, written test first | `tdd` |
| A suppression hiding a real failure, worth a hostile second look | `interrogate` |

## When NOT to use it

- Doc comments that a build or a published API reads. Removing one breaks the build or blanks the docs, so shrink it instead.
- Generated, vendored or snapshot files. The next regeneration puts the comments back.
- Database migrations. Flyway checksums applied versioned migrations, so editing one fails validation on the next deploy, and an edited repeatable migration runs again.
- Teaching code and example repositories, where the comments are the product.
- Files outside the change in a repository other people work in. The cleanup lands as conflicts in their branches; do it as its own agreed PR.
