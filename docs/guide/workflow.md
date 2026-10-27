# Daily workflow

Four schemas. **`clarify`** (the default) is for features: every planning artifact starts with a question round.
**`clarify-ai-qa`** and **`clarify-qa`** are `clarify` plus a *test-cases stage*: Gherkin test cases written after
the specs and before the design, reviewed by an AI QA reviewer (and, on `clarify-qa`, then by a human QA).
**`lean`** is for small, clear changes, with no question rounds but the same tests and gates. When in doubt, use
`clarify`: the questions are what catches gaps in a client's requirements.

## Picking a schema

When the agent creates a change without naming a schema (as `/opsx:new <name>` does), the **schema starter** hook
stops it and the agent asks you one question with three choices:

| Choice | Schema |
|---|---|
| No test cases | `clarify` |
| Test cases reviewed by the AI QA reviewer only | `clarify-ai-qa` |
| Test cases reviewed by the AI QA reviewer, then a human QA | `clarify-qa` |

The project's default schema does not count as a choice. If you dismiss the menu, no change is created; start
again with `/opsx:new <name>`. To skip the menu, name the schema: `/opsx:new <name> --schema clarify-qa`.
`lean` is never offered; name it when you want it. A change you create yourself in a terminal gets the default
schema without a menu.

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
  test, test data, environments and whether the checks need the application running. It does not ask whether a
  check should be automated or stay manual. Every scenario gets a level: `unit`, `integration` or `manual`; a
  `manual` row needs a reason that starts with `cannot be automated:` or `dangerous:` (money, many users or
  records at once, irreversible changes). A dangerous scenario is tested automatically and checked by hand in
  addition.
- **tasks** — each group starts with its failing tests; the final group runs the test review and the full suite.

Need more questions at any stage? `/sdd:clarify`.

### 2a. Test cases (`clarify-ai-qa`, `clarify-qa`)

On the test-case schemas a `test-cases` artifact comes right after the specs; the design waits for it.
The rules are in `openspec/protocols/test-cases.md`.

**For the developer:**

1. The agent writes `test-cases.md`: for every spec scenario one or more cases with Given / When / Then and
   concrete data, each labelled `automated`, `e2e` or `manual` (several labels are fine).
2. The **test-cases-reviewer** subagent (the AI QA reviewer) checks for missing positive, error and boundary cases,
   unusual conditions (empty input, duplicates, repeated submission, an unavailable service), vague data and
   outcomes. The agent fixes the findings, at most three reviewer runs; then you fix or accept each remaining
   blocker or major finding. Accepted findings are listed under **Stage result** in `test-cases.md`.
3. A finding may add a scenario to the specs (error case, empty state, boundary, unusual condition) without
   asking you; anything else — a new rule, a changed outcome, a conflict with your answers — comes to you as a
   follow-up question in the Specs round. Every spec change is recorded under **Spec changes during test-case
   review**, and the spec reviewer runs again.
4. `clarify-ai-qa`: you confirm the result with `Looks correct` (or `Request changes: …`) in the `[Answer]:` line
   of **Stage result**. Only then can the design be written.

**With a human QA (`clarify-qa`)**, after step 2 the agent writes `Handed over to QA` and tells you the cases are
ready for QA. QA reads `test-cases.md` in the repository, or you forward it:

- QA writes remarks, in any language, under a case or under **General remarks**:
  `> **Remark** [open]: the file must also show the shop name`.
- Whoever works in Claude Code says `done`; the agent answers every open or reopened remark and revises the cases,
  or the specs when the remark shows behaviour that is missing, wrong or not wanted. QA is asked no questions.
- Only QA closes (`[closed]`) or reopens (`[reopened]`) a remark; you may enter QA's decisions. Closed remarks are
  removed, except those that changed a spec.
- When no remark is open, QA confirms with `Looks correct` (you may enter it on QA's behalf). Then the design can be
  written.

A scenario added later, for example during apply, gets its own test cases and a new AI review loop; QA is not
asked again.

**Switching** between `clarify-ai-qa` and `clarify-qa`: edit `schema:` in `openspec/changes/<change>/.openspec.yaml`.
The gates of the new schema apply at once. Switching to or from `clarify` or `lean` is not supported.

**Coverage.** The verification plan lists every test case and picks `unit` or `integration` for each `automated`
one. A test that proves a case carries a reference next to its scenario marker:

```ts
// @case inventory/sales-export :: Export of a month with two sales
```

### 2b. Screenshots of the UI (all schemas)

The agent's first question in a change is whether it has UI mockups (on `lean`: asked in chat before the
proposal). Answer "yes" and it creates `openspec/changes/<change>/sources/ui/` and waits: export the mockups from
your design tool as PNG (JPG and WebP work too), put them there and run `/opsx:continue`. Screenshots already in
the folder skip the question. One file per screen and variant, named in
screen order: `01-orders-list.png`, `02-orders-list-mobile.png`. An optional `sources/ui/screens.md` may say
what each one shows. Any other file there (SVG, PDF, a Figma file) blocks the next artifact until it is exported
as PNG. The rules are in `openspec/protocols/ui-inventory.md`.

- A screenshot switches the change into **UI mode**; without screenshots nothing changes.
- Before its first questions the agent writes `ui-inventory.md`: every screen with its interactive elements
  (buttons, links, fields, toggles, menus) and states (empty, error, loading). It then asks about every element
  your description does not mention, every requirement with nothing on the screens, and every missing state.
- Every element gets a decision: `in scope`, `mock` (a stub now), `out of scope`, `decoration` or `existing`.
  Out of scope, decoration and mock come only from your answers. You review them all in the round summary.
- Every `in scope` and `mock` element needs a spec scenario before the design; on the test-case schemas its test
  cases are labelled `e2e`. The design maps each screen to its pages and components, and UI tasks link their
  screenshots; the agent opens them before it builds a screen.
- Adding, replacing or deleting a screenshot later is fine: the next artifact (or the archive) waits until the
  agent has updated the inventory and asked about the new elements in the current round. Delete every screenshot
  and UI mode is off again.
- On `lean` the agent records the decisions itself and lists them in the proposal; no questions are asked.

Screenshots stay in git with the change and are archived with it.

### 3. Apply

```
/opsx:apply
```

After planning, apply runs on its own (`openspec/protocols/apply.md`): every task, the test review, the full
suite and the E2E stage, without asking you anything. The agent stops only on a decision that belongs to you: a
requirement gap, a test that still fails after two fix attempts, an environment that does not start the
application the way the project describes, an action outside the project or a weaker test (both need your
consent), a situation the plan does not cover, and the consent list at the end. In a stop it may suggest
options, but carries out none until you choose. When a stop concerns one test, it first finishes the tasks that
do not depend on it.

**Start check.** When the verification plan says `Running application: yes`, the agent first starts the
application with the project's own commands and requests one address
(`node openspec/tooling/bin/start-check.mjs`; up to 2 minutes, any status below 500 passes), then stops it.
When the start fails — for example the published ports are refused — it stops before the first task and you
choose: for E2E switch it off, fix the cause or skip it deliberately; for integration checks through the stack fix
the cause or skip them. On the first start check it also proposes the project's tool list
(`openspec/project-tools`, e.g. `docker — stack, E2E`); doctor then warns when a listed tool is missing.

**Outside the project.** The agent changes nothing outside the project folder without your consent: no system
installs, no stopping other programs, no Docker containers it did not create. The `boundary-guard` hook asks you
before such commands (`sudo`, `brew install`, `npm i -g`, `kill`, `docker stop`, `docker rm`, …). Workarounds
inside the application are fine: a stub instead of a mail server in a test, a user created in advance.

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
3. **The report**: the agent writes `apply-report.md` in the change. "Manual checks" lists every `manual` row and
   `manual` test case with steps, expected outcome and reason, dangerous ones first and marked "required before
   release"; QA performs them after the archive, they are never tasks. "Not verified automatically" lists the
   checks that should have run but did not (a case that needs a real phone, skipped E2E, accepted cases), and
   "Weakened tests" what you allowed to weaken.
4. **The consent list**: entries of "Not verified automatically" without your consent are asked once, in one
   question. Each agreement is recorded as `Consent: "<your words>"`. If you refuse one, the change is not ready
   and the agent waits.
5. The agent tells you the change is ready to archive and names `apply-report.md`. It does not archive by
   itself.

### 3a. E2E stage (web applications in a monorepo)

When the change touches a web application whose backend is in the same repository, the Main round asks whether
it needs E2E tests and against which backend: the real one, started locally on an empty test database, or stubbed
responses. On `lean` the agent asks before the first task. A mobile app, a backend-only change or a frontend whose
backend lives in another repository gets no E2E.

After the last task the agent runs the stage (`openspec/protocols/e2e.md`) and records it in `e2e.md`:

1. It asks once whether you start the application (and give its address) or it starts it with the project's
   command; when the project has none, it offers to write one.
2. When the project has no Playwright, it asks your permission to install it in its own folder (for example
   `e2e/`, with its own `package.json`, Chromium only, no retries). If you refuse, E2E is skipped.
3. It writes one Playwright test per `e2e` test case (on `clarify` and `lean`: per scenario it lists and shows
   you), each tagged `@case` or `@scenario`. Tests create their own users and data; passwords stay out of git.
4. It runs them only with `node openspec/tooling/bin/e2e-run.mjs --change <name>`, which records every run in
   `e2e-runs.json`. A failing test gets at most three fix attempts, then it is yours to decide: fix, or accept the
   case with a reason (its test stays as a skipped test, and the case goes under "Not verified automatically" in
   `apply-report.md` with your acceptance).
5. With screenshots in `sources/ui/`, it opens every screen at the screenshot's size and state and compares the two
   by looking: missing or extra elements, texts, layout, colours, clearly different sizes. Differences get the same
   three attempts, or you accept them with a reason.

The stage is complete when every required test has a passed result that is still valid. Changing the application
afterwards needs a new run: the agent reruns by itself after a business-logic change and asks you after a minor
one; if you decide no run is needed, it records that under `## No new run needed`. To skip E2E for a change, say
so: the agent sets `Mode: skipped` and puts the `e2e` cases under "Not verified automatically" in
`apply-report.md`.

### 4. Archive

```
/opsx:archive add-sales-export
```

You archive the change; the agent does not. The archive gate allows this only when:

- all tasks are done;
- all kit checks pass (answers, grounding, specs, traceability);
- every scenario planned as `unit` or `integration` has a test that carries its marker;
- the test review is `READY`, or a human decision is recorded;
- on the test-case schemas: `test-cases.md` passes its check (every scenario has a case) and every `automated`
  case has a test with its `@case` reference. `manual` cases do not block the archive. Test cases stay
  in the archived change;
- the E2E stage is complete: every `e2e` case (or listed scenario) has a passed, still valid result recorded by
  `e2e-run.mjs`, or is accepted, and no screenshot has an open difference. On `clarify-ai-qa` and `clarify-qa`
  the change needs `e2e.md` (`Mode: skipped` when it has no E2E); on `clarify` and `lean` a change without it has
  no E2E;
- `apply-report.md` passes its check, every entry of "Not verified automatically" carries your `Consent:` (such
  an entry is the only way a missing test is accepted), and every manual check is in the report; when the plan
  says `Running application: yes`, the start check was run.

Changes created before the kit version that brought `apply-report.md` (no `x-sdd-kit` line in their
`.openspec.yaml`) keep the old rules: their manual checks stay tasks, and they need no report.

## A small change (`lean`)

```
/opsx:new fix-rounding --schema lean
```

The flow is proposal → specs → verification-plan → tasks → apply, with no question rounds. If the agent would have to
guess behaviour, it stops and suggests `clarify`. Tests, markers and the gates are the same. Before the first task
the agent asks whether the change needs E2E (section 3a).

## What runs where

| When | What |
|---|---|
| session start | where each change stands, open questions, OpenSpec version and skills drift |
| `openspec new change` without `--schema` | the schema starter asks which schema to use |
| writing an artifact | answers-gate blocks it while its question round is open; on the test-case schemas the design also waits for the test-cases stage; in UI mode it also waits for an up-to-date UI inventory (`check-ui`) |
| running the AI QA reviewer | the run-limit hook blocks a fourth run in a loop |
| after writing an artifact | the matching check runs, and its errors go back to the agent (`check-e2e` after `e2e.md`, `check-apply-report` after `apply-report.md`); the first artifact of a change records the kit version |
| start of apply | `start-check.mjs` starts the application, requests one address and stops it again, when the plan needs it |
| a Bash command outside the project | the command guard asks you first |
| E2E stage | `e2e-run.mjs` runs Playwright and records the run in `e2e-runs.json` |
| last task checked | a reminder of the end-of-apply steps |
| `openspec archive` | archive gate |
