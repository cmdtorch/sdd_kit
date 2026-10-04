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

- `For: PO/PM` questions are written so you can forward them as they are. Bring the answers back into the file.
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
  Then the `spec-reviewer` subagent answers one question: can a developer and QA start without asking anything?
  You decide what to do with each finding: fix the spec, ask a follow-up, or accept it.
- **design** — the *Design round* asks only about choices that would change the approach.
- **verification-plan** — the *Verification round* asks which journeys need browser E2E, plus test data and
  manual checks. Every scenario gets a level: `unit`, `e2e` or `manual`.
- **tasks** — each group starts with its failing tests; the final group runs the reviews and verification.

Need more questions at any stage? `/sdd:clarify`.

### 3. Apply

```
/opsx:apply
```

TDD: the tests for a task group come first, with a marker per scenario:

```python
@pytest.mark.scenario("inventory/sales-export", "Successful export")
```
```ts
test('…', { annotation: { type: 'scenario', description: 'inventory/sales-export :: Successful export' } }, …)
```

Requirement gaps found while coding go into the *Apply round*; the agent asks instead of guessing. At the end:

1. The **test-reviewer** subagent checks that every THEN is asserted, that assertions are specific, and that error
   scenarios assert the error. The agent fixes blocker and major findings, in at most two rounds. What remains goes
   to you: write your decision under `## Human decision` in `reviews/test-review.md`.
2. `node openspec/tooling/bin/verify.mjs --change <c>` runs the full suite, the quality gate and E2E, and writes
   `verification.md` from the real results. A row is `Met` only when every test with its marker passed.
3. **Manual checks**: a human performs them and writes the result into their row of `verification.md`.
4. If the API changed: `api.mjs diff --change <c>`, then `frontend-handoff.md` per
   `openspec/protocols/handoff.md`, then `api.mjs snapshot`.

When the last task is checked, the **test gate** runs verification each time the agent tries to finish. With failing
tests it sends the agent back to work, up to 3 times. Then it hands over to you.

### 4. Archive

```
openspec archive add-sales-export
```

The archive gate allows this only when:

- all tasks are done;
- all kit checks pass;
- the last full verification is green, complete (manual checks included) and newer than the last change to any file;
- the test review exists;
- with API changes, the handoff is complete and the API baseline is updated.

## A small change (`lean`)

```
/opsx:new fix-rounding --schema lean
```

The flow is proposal → specs → verification-plan → tasks → apply, with no question rounds. If the agent would have to
guess behaviour, it stops and suggests `clarify`. Tests, verification and the gates are the same.

## Frontend work after a backend change

The backend change ends with `frontend-handoff.md`: every changed endpoint with permissions, request, response,
errors and an example, plus breaking changes.

- **Monorepo:** continue in the same repository.
- **Split repositories:** session start lists the backend handoffs that are not yet imported and warns when your
  backend checkout is stale. Then:

```
node openspec/tooling/bin/handoff.mjs list
node openspec/tooling/bin/handoff.mjs import --from-store backend --change add-sales-export
/opsx:continue add-sales-export-ui
```

The frontend change asks only UI and UX questions. Gaps in the API become `For: Dev` questions for the backend
team, so they are not guessed and not discussed in chat. Browser E2E exists only in monorepos (D23).

## What runs where

| When | What |
|---|---|
| session start | where each change stands, open questions, verification status, backend store freshness, handoffs ready |
| writing an artifact | answers-gate blocks it while its question round is open |
| after writing an artifact | the matching check runs, and its errors go back to the agent |
| last task checked, agent finishes | test gate: full verification, at most 3 blocks, then hands over to you |
| `openspec archive` | archive gate |
| every pull request | `ci.mjs checks` (planning, archived changes, `openspec validate --strict`) and `ci.mjs verify` (tests, markers, API baseline) |
