# skills

Eight agent skills for writing and refactoring TypeScript. Seven of them are about functional architecture: turning procedures into composed functions, modelling data so impossible states stop compiling, and keeping effects at the edges. The eighth covers state management in React.

Each skill is a document, not a script. An agent loads one when the problem in front of it matches the skill's description, follows the guidance, and pulls in a reference file only if it needs the detail. Nothing here executes.

## Install

Install all eight into Claude Code, globally:

```bash
npx skills add mmncit/skills -g -a claude-code -s '*' -y
```

That copies each skill, reference files included, into `~/.claude/skills/<name>/`. A newly installed skill is usually picked up straight away; start a new session if one does not appear.

One skill instead of all eight:

```bash
npx skills add mmncit/skills -g -a claude-code -s functional-architecture -y
```

Drop `-g` to install into the current project at `./.claude/skills/` instead of your home directory. Use that when the guidance should travel with the repo rather than follow you between projects.

For an agent other than Claude Code, swap the `-a` value. The identifiers are not product names, which is worth knowing before you lose ten minutes to it: `-a claude` is rejected outright, and the one that works is `claude-code`. Passing an unknown value makes the CLI print every target it accepts, among them `cursor`, `codex`, `gemini-cli`, `github-copilot`, `zed` and `windsurf`.

## The catalogue

| Skill | Reach for it when |
|---|---|
| [functional-architecture](functional-architecture/) | A `Manager`/`Service`/`Helper` has become a grab bag, a method mutates instance fields so results depend on call order, or a function branches on boolean mode flags |
| [discriminated-unions](discriminated-unions/) | An object carries optional fields that only make sense in certain combinations, two booleans encode a mode nobody enumerated, or you keep asserting that something exists |
| [algebraic-composition](algebraic-composition/) | A `reduce` has an awkward multi-field accumulator, several loops walk the same collection, or independent update functions need merging |
| [domain-functors](domain-functors/) | A wrapper with fixed slots (long and short forms, one value per locale) gets unwrapped, transformed and rewrapped in every operation |
| [effects-as-values](effects-as-values/) | A signature hides four ways of throwing, `try/catch` blocks nest, or a calculation cannot be tested without stubbing `fetch` |
| [entity-factory](entity-factory/) | A `switch` over a `type`/`kind` field keeps growing and per-variant code is copied between branches |
| [policy-as-data](policy-as-data/) | The same status or permission check exists in a backend handler and a frontend `disabled` prop |
| [react-state](react-state/) | Two pieces of state drift apart, five `useEffect`s call each other, or filters vanish on refresh |

Every skill ends with a section on when not to use it. Those sections are the load-bearing part. A guideline that only argues for itself gets applied where it does not belong, so read the limits before adopting a pattern wholesale.

## Telling the close ones apart

Four of these skills deal with types that vary, and the boundaries between them are the thing people get wrong.

`discriminated-unions` is about the *type*: a bag of correlated optional fields becomes a union of arms tagged by a discriminant.

`entity-factory` is about *building* values of such a union. Many kinds, one shared output contract, a registry instead of a growing `switch`. These two are ordered: a registry is worth building once the type is a proper tagged union, so if the variants are still an object with optional fields, fix the type first. The other two have no such dependency. A sum or a config merge needs no union at all, and a wrapper with one shape, such as a value per locale, needs no discriminant.

`domain-functors` is about *mapping over* one wrapper whose slots all hold the same kind of payload. The arms are not different things, they are the same thing held two or three ways, so one `map` serves every operation.

`algebraic-composition` is about *combining* many values into one. Folding a list of events into a state, merging two config objects, collecting every validation error rather than stopping at the first.

Two more pairs worth separating. `effects-as-values` owns failure and I/O as values (`Result`, `Task`), so anything about where to put a `try/catch` or how to test without mocks goes there, not to `functional-architecture`. And `policy-as-data` is the only one of the eight that is a boundary problem rather than a code-shape problem: a rule can be perfectly pure, perfectly composed, and still exist twice in two separately deployable units.

## How loading works

Worth knowing, because it is not obvious and it changes how you use these.

A skill's `description` in its frontmatter is the only text an agent sees when deciding whether to load it. That is why the descriptions here read as lists of symptoms and phrasings rather than summaries. You rarely need to name a skill: describing the problem is usually enough to trigger the right one.

Reference files under `references/` are not loaded with the skill. The `SKILL.md` points at them and the agent reads one when it needs that level of detail. This keeps the initial load small when all you wanted was the ladder.

`functional-architecture` is the front door and carries a routing table naming the others, but it does not pull them in. Loading it gives you its own guidance plus a table saying which sibling fits which problem. The agent then loads that sibling separately. There is no mechanism for one skill to invoke another, and in practice you would not want five of these documents in context at once.

## Layout

```
<skill-name>/
├── SKILL.md          the guidance, loaded first
├── README.md         what you are reading now, one per skill
└── references/       detail, loaded on demand
```

`SKILL.md` frontmatter is exactly two keys, `name` and `description`, and `name` must equal the folder name. A push to `main` that touches any `SKILL.md` runs [publish.yml](.github/workflows/publish.yml), which parses the frontmatter with a real YAML parser before registering anything. Malformed frontmatter makes the skills CLI skip a skill silently at publish time rather than failing loudly, which is the reason for the check.

## Contributing

[AGENTS.md](AGENTS.md) has the conventions: the frontmatter contract, the body structure these skills follow, the cross-linking rule, and how to validate locally before pushing.

One command checks the repository:

```bash
node scripts/check-skills.mjs
```

It has no dependencies and checks frontmatter against the contract, that every skill has a README and a "When NOT to use it" section, that reference files and sibling links resolve both ways, that the front door routes to every skill in the family, and that the catalogue above lists all of them.

That last group is not hypothetical. A new skill missing from the routing table, and a skill with no outbound links leaving the reader nowhere to go, have both happened here. CI runs the frontmatter half separately in [publish.yml](.github/workflows/publish.yml).

## Credit

`domain-functors` is derived from Adam Dueck's [Practical uses for functional programming with NLP](https://adueck.github.io/blog/practical-uses-for-functional-programming-with-nlp/), with a tagged encoding in place of the post's bare union.

`policy-as-data` is based on Jay Freestone's [Ship the policy, not the code](https://www.jayfreestone.com/writing/share-the-policy-not-the-code).
