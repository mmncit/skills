---
name: interrogate
description: "Have adversaries on different Claude models, each with a different line of attack, try to break a finished change or a prototyped design, and keep only the findings a command actually proves against the real code. Use this skill before merging a risky or contested change, after a large refactor, when a design is expensive to reverse, when the tests are green but you are not convinced, or when someone says 'interrogate this', 'adversarial review', 'multi-model review', 'try to break it', 'stress test this', 'tear this apart', 'find the blind spots', 'challenge this', 'is this actually correct'. The report lists every verified finding with the command that proves it and the adversaries that found it, then what each adversary had dropped and why. It applies no fixes. Not a style review: naming, structure and hypothetical future risks are dropped by design. For choosing between designs before code exists use arena, and for settling the shape use architect."
---

# Interrogate

A reviewer who reads a diff finds what the diff makes easy to see. An adversary who must run something to make a claim finds what breaks. This skill gives the change and its intent to several adversaries, each told to break it with a run against the real code, and keeps a finding only when rerunning its command shows a failure that contradicts the intent.

Two symptoms say a change needs this. It passed review and tests, and you still cannot say what input would break it. Or the fix touched ordering, retries, caching, concurrency or input parsing, where the bugs live in cases nobody wrote down.

## Frame

1. Fix the scope. It is whatever the user names. Otherwise it is everything the branch changes since its merge base with the default branch: commits, uncommitted edits, and new files git does not track yet. `git diff` alone misses the new files, so list them with `git ls-files --others --exclude-standard`.
2. State the intent in your own words, from the user's message, the commit messages and the PR description. Ask the user if the intent is unclear. Every finding is judged against this sentence, so a vague intent produces vague verdicts. The intent always has a second half nobody writes down: behaviour the change does not mean to alter keeps working.

## Fan out

The default is three adversaries, one each on `fable`, `opus` and `sonnet`. All three are Claude, and models from one vendor share blind spots, so each also gets a different line of attack:

- Inputs and boundaries: empty, huge, malformed, duplicated, non-ASCII, out of range, and `null` where the type says it cannot be.
- State and time: ordering, retries, partial failure, caching, concurrent calls, cleanup after an error, running it twice.
- The contract: every caller and consumer of what changed, including the ones the change never mentions, and whether each still gets what it relied on.

Three adversaries cost roughly three full reviews. Unless the user asked for this skill by name, say what you are about to launch and wait for a yes.

Give each adversary its own worktree. A worktree starts from a commit, so uncommitted work does not come with it. Save the scope as a patch first, new files included:

```bash
git diff HEAD --binary > /tmp/interrogate.patch
git ls-files --others --exclude-standard -z | xargs -0 -n1 git diff --no-index --binary /dev/null >> /tmp/interrogate.patch || true
```

Make applying that patch with `git apply`, then checking `git status`, the first step of every brief. In Claude Code each adversary is a fresh Agent call with `model` set and `isolation: "worktree"`. Do not fork your own context for this: a fork ignores `model` and starts out agreeing with you. Launch them all in one message.

If your harness cannot set a model per subagent, run all three lines of attack on the current model and say so in the report. Without subagents at all, run the three lines of attack yourself one after another, and say that the review was not independent.

Each adversary gets the scope, the intent, its line of attack, and this brief verbatim:

> Break this change. Prove each finding with a run against the real code: a failing test, a reproduction script, or command output that shows the wrong behaviour. For a design, run a prototype or probe the current tree. Keep reproductions in your own worktree. Report each finding with a title, the exact command, the output it printed, and the output the intent requires. Leave out anything you did not run, which covers style, naming, structure, and risks that need some future change to matter. No findings is a valid result.

## Verify

Rerun every reported command yourself, in that adversary's worktree. Keep a finding when the output shows the failure and the failure breaks the intent, including its unwritten half. Drop findings whose command does not reproduce. Run the survivors on the merge base too: a failure that was already there before the change is pre-existing, so list it separately rather than as a finding. Merge findings that share a root cause, and keep a list of which adversaries found each one.

Unlike an arena, there is no base to pick and no graft. Adversaries find different failures, so the verdict keeps every verified finding rather than choosing one adversary's list.

## Output

- Intent: the restated sentence.
- Findings: for each verified finding, the command, its output, how it breaks the intent, and which adversaries found it. Say "no verified findings" when none survive.
- Pre-existing: failures that reproduce on the merge base as well, for whoever owns that code.
- Dropped: for each adversary, how many findings were dropped and why.

Apply nothing. The fix is a separate decision, and often a `tdd` loop that turns a finding's command into a regression test.

## Where to go next

| Situation | Skill |
|---|---|
| A finding to fix: make its command a failing test, then fix | `tdd` |
| Findings that trace back to the shape rather than a line | `architect` |
| Two designs on the table and no code yet | `arena` |
| Findings about unparsed input, unchecked casts or a silent missing case | `strong-typescript` |

## When NOT to use it

- A plan with no code behind it. Adversaries need something to run, and every unproven finding is dropped, so an abstract plan returns nothing. Prototype the open questions first.
- A style or readability review. Those findings are dropped by design.
- A small change you are confident in, or one whose risk a single targeted test settles. Write that test instead.
- A known bug. You already have the reproduction, so go straight to `tdd`.
- When nobody will read the Dropped list. Adversaries sometimes drop a real problem they could not reproduce in time, and the list is where you catch that and override the verdict.
