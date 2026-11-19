---
name: arena
description: "Run several independent attempts at the same design or code brief on different Claude models, have a blind judge score them against a rubric fixed before anyone started, take the strongest as a base, and graft the best ideas from the others into it by hand. Use this skill when one attempt would lock in the first shape a model thought of: an API or schema design, a persisted format or cache key, a naming scheme, an algorithm, a tricky refactor, a prompt, or any artifact that is expensive to change later. Also when someone says 'arena this', 'throw it in the arena', 'get a few attempts and compare', 'run it on several models', 'multi-model', 'best of N', 'compare their proposals with yours', or 'I want options before we commit'. Uses Claude models only, Fable, Opus and Sonnet as runners, and blinds the judge to which model wrote what. Not for covering different slices of work in parallel, and not for finding bugs in a finished change, which is interrogate."
---

# Arena

One attempt at a hard design returns the first shape one model thought of, and the reviewer then polishes that shape instead of questioning it. Several independent attempts at the same brief show the design space: where they converge the answer is probably forced, and where they diverge is the real decision.

Two symptoms say a decision needs an arena. You can name a second reasonable design but have only seen one written out. Or the thing is persisted, published or depended on, so the first shape will outlive the conversation that produced it.

Open a task list with one entry per phase before launching anything.

## Phase A: frame

Every candidate gets the same brief, so the brief is the contract.

1. State the artifact each candidate produces: a set of type signatures, a module, a document, a prompt.
2. Write a rubric of three to six criteria that can be graded on this task, such as "each piece of state has one owner", "a new variant touches one file", "the decisions are pure functions and I/O sits at the edge", or "every failure is in a return type". The rubric is for the judge and for you. Candidates see only the brief, so they solve the problem rather than the grading sheet.
3. Pick the runners. The default is three seats, one each on `fable`, `opus` and `sonnet`. Add seats when the decision is expensive, and repeat a model when the work is mostly generation rather than judgment. If a model is unavailable, drop its seat and keep at least two. If your harness cannot set a model per subagent, run every seat on the current model with the same brief, expect less variety, and say so in the output. Without subagents at all this skill does not apply; write the two sketches from `architect` yourself.
4. Give each candidate its own output location: a git worktree for code, otherwise a directory such as `/tmp/arena-<slug>/candidate-<n>/`. Shared output means candidates read each other and stop being independent. Name locations by number, not by model, so nothing downstream gives the model away. If the candidates build on uncommitted work, save it as a patch the way `interrogate` describes and make applying it the first step of every brief.

## Phase B: fan out

An arena costs roughly one full attempt per seat plus a judge. Unless the user asked for one by name, say how many seats you are about to launch and wait for a yes. If nobody is there to answer, launch only when whoever started the run asked for an arena.

Launch every candidate in one message so they run in parallel. In Claude Code each one is a fresh Agent call with `model` set to its seat, and with `isolation: "worktree"` when it writes code. Do not fork your own context for a seat: a fork ignores `model` and starts from your reasoning, so its attempt is not independent. Each brief carries the task, the grounding to read, its own output path, and an instruction to finish with a short rationale naming the alternatives it considered and why it rejected them.

If a candidate produces nothing usable, continue with the rest and note the dropout.

## Phase C: judge

When every candidate is done, give a fresh subagent, not a fork, told to read and score and to edit nothing, the rubric and the candidates relabelled `A`, `B`, `C` in shuffled order, with any model names removed. It scores each candidate on each criterion and recommends a base. Use a model other than your own where you can.

All the seats are Claude, so the judge brings a fresh context and blindness, not a different set of training biases. It is also one of the seat models, and a model can recognise and favour its own candidate even under a neutral label. Treat its agreement as useful but weaker evidence than your own criterion-by-criterion read. With fewer than two candidates left, skip the judge and say so.

## Phase D: pick a base

Read every candidate end to end before picking, and score each against the rubric criterion by criterion rather than on overall feel. Then compare with the judge. Agreement confirms the pick. Disagreement means one of you is biased or the rubric was ambiguous, so reread both rationales before deciding.

Take the base a future maintainer can extend most easily without breaking its invariants. When two are close, take the cleaner boundary or the smaller API.

## Phase E: graft

Walk each losing candidate once more for what is worth porting, usually one or two things each, not most of it. Fold each graft in by hand so the result still reads as one design under one mental model. Pasting pieces from three designs produces a fourth design nobody chose.

If the candidates converged on one shape, ship the consensus and skip the graft. Seats from one vendor can converge on a shared blind spot, so treat convergence as good evidence rather than proof, and let verification in Phase F have the last word. If they diverged wildly, the brief was under-specified. Reframe and rerun rather than averaging the divergence, and after two reruns that still diverge, take the divergence to the user as the decision it is.

## Phase F: verify

Verify the synthesized artifact like any other output: type-check it, run it, or test it against the rubric's own criteria. If verification finds a problem, either the frame was wrong, so rerun, or a candidate had the fix and the graft missed it, so go back to Phase E.

## Output

One artifact, plus a short note alongside it: the base and why, the judge's verdict or why it was skipped, each graft with its source candidate, what was rejected and why, any convergence or dropouts, and the verification result.

## Where to go next

| Situation | Skill |
|---|---|
| Settling a change's shape alone first, and deciding whether it needs an arena at all | `architect` |
| A finished change that needs someone to try to break it | `interrogate` |
| Building the chosen design test first | `tdd` |
| The candidates disagree about types: casts, brands, where to parse | `strong-typescript` |

## When NOT to use it

- A decision with one evidently right answer. The candidates converge and you paid for three attempts to learn nothing.
- Coverage work, where each worker needs a different slice (check every package, review every file). That is a plain parallel fan-out with one brief per slice, and there is nothing to pick or graft.
- Finding defects in a finished change. Candidates are builders and will not try hard to break their own work. Use `interrogate`.
- A cheap, easily reversed change. The cost is roughly one attempt per seat plus a judge, so three seats cost about four times one attempt.
- When you cannot read every candidate in full. Picking a base from summaries brings back the single-attempt bias.
