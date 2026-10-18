# Daily workflow

Two schemas. **`clarify`** (the default) is for features: every planning artifact starts with a question round.
**`lean`** is for small, clear changes, with no question rounds but the same tests and gates. When in doubt, use
`clarify`: the questions are what catches gaps in a client's requirements.

## A feature (`clarify`)

### 1. Start and answer the Main round

```
/opsx:new add-sales-export
```

Give the agent the request: your description, and the client's text or file. The file goes to the change's
`sources/` as `.md`, `.pdf` or `.txt`; export `.docx` first. The agent writes `clarifications.md` with the
**Main round** questions:

- Every question makes sense on its own, so you can forward any of them to whoever knows the answer. Bring the
  answers back into the file; the round waits for them.
- You choose how to answer: interactively (*Guide me*), by editing the file, or by chatting.
- `Not yet defined` is a valid answer: it becomes an open question or an explicit assumption, never invented detail.

The agent analyses the answers: vague words, contradictions, answers like "up to you". It asks follow-ups, then
writes a **summary** with the assumptions it will make. Reply **Looks correct** or **Request changes**. Until the
summary says exactly `Looks correct`, the proposal cannot be written: the answers-gate hook blocks it.

### 2. Proposal, specs, design, verification plan, tasks

```
/opsx:continue        (repeat for each artifact)
```

- **proposal** — every statement cites `[Q3]`, `[D1]` or `[desc]`; assumptions are listed separately.
- **specs** — first the *Specs round* (errors, edge cases, permissions, rules, limits). Then the delta specs.
  Then the `spec-reviewer` subagent answers one question: can work start from these specs without asking anything?
  You decide what to do with each finding: fix the spec, ask a follow-up, or accept it.
- **design** — the *Design round* asks only about choices that would change the approach.
- **verification-plan** — the *Verification round* asks which scenarios are critical, which need an integration
  test, test data and manual checks. Every scenario gets a level: `unit`, `integration` or `manual`.
- **tasks** — each group starts with its failing tests; the final group runs the test review and the full suite.

Need more questions at any stage? `/sdd:clarify`.

### 3. Apply

```
/opsx:apply
```

TDD: the tests for a task group come first. Each test that proves a scenario carries a marker comment, in any
language:

```python
# @scenario inventory/sales-export :: Successful export
```
```ts
// @scenario inventory/sales-export :: Successful export
```

Requirement gaps found while coding go into the *Apply round*; the agent asks instead of guessing. At the end:

1. The **test-reviewer** subagent checks that every THEN is asserted, that assertions are specific, and that error
   scenarios assert the error. The agent fixes blocker and major findings, in at most two rounds. What remains goes
   to you: write your decision under `## Human decision` in `reviews/test-review.md`.
2. The agent runs the project's **full test suite and quality checks** and fixes what fails. It never weakens a
   test to get green; after two failed attempts it stops and asks you.
3. **Manual checks**: the agent lists them; a human performs them.

### 4. Archive

```
openspec archive add-sales-export
```

The archive gate allows this only when:

- all tasks are done;
- all kit checks pass (answers, grounding, specs, traceability);
- every scenario planned as `unit` or `integration` has a test that carries its marker;
- the test review is `READY`, or a human decision is recorded.

## A small change (`lean`)

```
/opsx:new fix-rounding --schema lean
```

The flow is proposal → specs → verification-plan → tasks → apply, with no question rounds. If the agent would have to
guess behaviour, it stops and suggests `clarify`. Tests, markers and the gates are the same.

## What runs where

| When | What |
|---|---|
| session start | where each change stands, open questions, OpenSpec version and skills drift |
| writing an artifact | answers-gate blocks it while its question round is open |
| after writing an artifact | the matching check runs, and its errors go back to the agent |
| last task checked | a reminder of the end-of-apply steps |
| `openspec archive` | archive gate |
