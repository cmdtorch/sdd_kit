# Daily workflow

Four schemas. **`clarify`** (the default) is for features: question rounds before the proposal and the specs.
**`clarify-ai-qa`** and **`clarify-qa`** are `clarify` plus a *test-cases stage*: Gherkin test cases written after
the specs and before the design, reviewed by an AI QA reviewer (and, on `clarify-qa`, then by a human QA).
**`lean`** is for small, clear changes, with no question rounds but the same tests and gates. When in doubt, use
`clarify`: the questions are what catches gaps in a client's requirements.

> **Beta.** `clarify-ai-qa` and `clarify-qa` (the test-cases stage) are in beta: they pass the kit's test suite
> but have had only a partial pilot on a real project, so their formats and gates may still change. The same holds
> for UI screenshots (2b), autonomous apply, the E2E stage (3a) and meta-repositories. `clarify` and `lean` are
> stable.

**Planning rules since 0.6.0.** A change on `clarify` or `lean` created with kit 0.6.0 or later (stamped
`x-sdd-kit: 0.6.0` in its `.openspec.yaml`) plans without `/openspec-continue-change`, with two question rounds and no
`Looks correct` (`openspec/protocols/planning.md`). Changes started before 0.6.0, and every change on
`clarify-ai-qa` or `clarify-qa`, keep the earlier rules: see
[Earlier changes and the test-case schemas](#earlier-changes-and-the-test-case-schemas).

## Starting a change: the depth level

When the agent creates a change without naming a schema (as `/openspec-new-change <name>` does), the **schema starter** hook
stops it and the agent asks you one question: how deep the questions about this change should go.

| Level | The agent investigates | It settles itself | It asks you |
|---|---|---|---|
| `low` | the sources and your description | everything a user does not see | every decision a user sees |
| `medium` (recommended) | also the existing specs and the code of the area the change touches | also minor visible details (an order, a label, a default) | everything about permissions, money and data, visible or not |
| `high` | also the code affected outside that area, every requirement by roles, states, errors, boundaries, concurrent use and existing data, the bugs QA would file | nothing that no source, spec or code settles | every decision nothing settles, and the consequences of each answer for existing behaviour and data |

The change is created on `clarify` and the level is written as `Depth: <level>` in `clarifications.md`;
without the menu it is `medium`. The level changes how deep the agent looks, not how many questions it asks: a
question is asked only when the agent can say what in the specs depends on the answer (its `Why this is asked:`
line; on `high` it also names the finding that raised it). Decisions the agent settles itself are listed as
assumptions in the proposal (later ones in the design or the verification plan) and shown in the digest. Change
the level at any time by telling the agent or editing the `Depth:` line; it applies to the questions not asked
yet.

The project's default schema does not count as a choice. If you dismiss the menu, no change is created; start
again with `/openspec-new-change <name>`. The menu offers no schema: name one to skip it, `/openspec-new-change <name> --schema lean`
or `--schema clarify-qa` (the test-case schemas are no longer in the menu; such a change gets no depth level). A
change you create yourself in a terminal gets the default schema without a menu.

## A feature (`clarify`)

### 1. Start and answer the Main round

```
/openspec-new-change add-sales-export
```

Give the agent the request: your description, and the client's text or file. The file goes to the change's
`sources/` as `.md`, `.pdf` or `.txt`; export `.docx` first. In the same turn the agent writes `clarifications.md`
with the **Main round** questions:

- The agent asks once per change how you want to answer: questions in the chat, editing the file, or a free
  discussion. The choice is recorded as `Answer mode:` in the file and used for every later round, in a new chat
  too. Say "ask me here instead" to switch.
- Every question makes sense on its own, so you can forward any of them to whoever knows the answer. Bring the
  answers back into the file; the round waits for them.
- A question may carry `Recommended: B — <reason>` when a source, an existing spec or the code supports an option
  (on `low`: a source only). It is a suggestion, never an answer: the `[Answer]:` stays blank until you answer, and
  "accept all your recommendations" is not an answer; each question needs its own.
- `Not yet defined` is a valid answer: it becomes an open question or an explicit assumption, never invented detail.

The agent analyses the answers: vague words, contradictions, answers like "up to you", and on `high` the
consequences of each answer. It asks follow-ups in the same round. A round is **closed** when none of its answers
is blank; there is no summary and no `Looks correct`. While an answer is blank the proposal cannot be written: the
answers-gate hook blocks it.

### 2. Planning goes on by itself

Once the Main round is closed the agent writes the rest of planning without a command from you:

```
proposal → Technical round → specs → spec review → digest → design → verification plan → tasks
```

**Right after the Main round** (changes started on kit 0.7.0 or later), before the proposal:

- **Project files.** When the project has no `openspec/test-commands.md` (how to run one test file, only the
  failed tests and the full suite, each with an optional duration) or no `openspec/project-tools`, the agent shows
  drafts of the missing ones from your README, CLAUDE.md, Makefile, package scripts and CI configuration, in one
  message, and waits. Confirm, correct (for example "the full suite needs `--reuse-db` and takes about 12
  minutes") or decline; a declined file gets the single line `none` and is never proposed again. The agent runs
  no tests to measure a duration. You can edit both files by hand at any time; the kit never overwrites them.

  ```markdown
  # Test commands

  - One file: `make test FILE=<file>` — 1 min
  - Failed only: `make test-failed`
  - Full suite: `make test` — 12 min
  ```

  Only test commands go there: lint, type checks and build stay in your instructions. In a meta-repository the
  root's file has a section `## Repository: <name>` per clone.
- **Early start check.** When your instructions name the command that starts the application and its address,
  the agent starts it once and stops it again, even when the change may not need it, so a broken environment
  shows up before the proposal. Without those instructions it skips the check and asks nothing. When the check
  fails, it writes nothing further and you choose: fix the cause and run it again, or go on with planning (apply
  then runs the check again before the first task). A passed check is not repeated at the start of apply.

`lean` changes, the test-case schemas and changes started on an earlier kit version have no such step.

- **proposal** — every statement cites `[Q3]`, `[D1]` or `[desc]`; the agent's own decisions are listed as
  assumptions.
- **Technical round** — the second and last round before the code: errors, edge cases, permissions, rules,
  limits, and the design forks (a new table, sync or async processing, a migration, a new dependency). With
  nothing to ask, the round holds `No questions.` and planning goes on.
- **specs** — then the `spec-reviewer` subagent checks whether work can start from them without asking anything.
  The agent fixes the findings itself; one that needs a decision about the requirements becomes a Technical round
  question for you. The reviewer runs at most twice (the run-limit hook), and not again after a first run without
  findings.
- **digest** — at most 15 lines in the questions language: what will be built, what is left out, the decisions
  the agent made itself (those you would see first; with too many, the number of the others and a pointer to
  `proposal.md`), and the review findings it could not fix. The agent goes on without waiting; read it and say
  "stop" if the scope is wrong.
- **design** — always written; its forks were asked in the Technical round.
- **verification-plan** — no round: the agent decides which scenarios are critical, the test data and the
  environment, and records them as assumptions. Every scenario gets a level: `unit`, `integration` or `manual`; a
  `manual` row needs a reason that starts with `cannot be automated:` or `dangerous:` (money, many users or
  records at once, irreversible changes). A dangerous scenario is tested automatically and checked by hand in
  addition.
- **tasks** — each group starts with its failing tests; the final group runs the test review and the full suite.

At the end the agent says that apply can start and recommends `/clear` or a new chat before `/openspec-apply-change`: apply
works from the artifacts, not from the planning conversation. It does not start apply itself.

**How it keeps going.** After an artifact is written, a `Stop` hook (`planning-continue`) keeps the agent's turn
going and names the next artifact or round. You never need `/openspec-continue-change`; running it anyway does no harm. The
agent stops only where you are needed:

- a question with a blank answer, in the file or in the chat;
- the drafts of the project files, or your choice after a failed early start check;
- screenshots you said you will add (2b);
- an answer you changed after artifacts were written from it (below);
- an artifact check that still fails, or a write that stays blocked, after two fix attempts: the agent shows the
  remaining errors or the cause (for example an `.svg` in `sources/ui/` to export as PNG);
- a pause you asked for.

**Pause.** Say "stop" or "pause" in plain words: the agent ends its turn and writes nothing more for the change,
but still answers your questions. Say "go on" to resume. A wait or a pause is marked with
`node openspec/tooling/bin/planning.mjs wait|pause|resume --change <name>`; the agent runs it, you do not need to.

**A changed answer.** Change an answer before anything was written from it and it is simply the answer. Change it
after the proposal (or the specs) was written from it, and the kit (`answers-lock.json` in the change) blocks every
later artifact and every task check-off; the agent names the question and the artifacts that no longer match, and
waits. Restore the earlier answer, or tell it to update: it rewrites the artifacts in order, reruns the spec
reviewer once on rewritten specs and prints the digest again. During apply it runs `check-answers` before the first
task and each task group, and starts no task while an answer differs.

**Notifications.** The agent works on its own for a while and then waits for you. Switch on Claude Code's
built-in notifications (`/config`, *Notifications*) to be told when the agent waits for you. The kit adds no
notification of its own.

Need more questions at any stage? `/sdd:clarify`.

### 2a. Test cases (`clarify-ai-qa`, `clarify-qa`)

On the test-case schemas a `test-cases` artifact comes right after the specs; the design waits for it.
The rules are in `openspec/protocols/test-cases.md`. These schemas keep the earlier planning rules (four rounds,
`Looks correct`, `/openspec-continue-change`; see [Earlier changes and the test-case schemas](#earlier-changes-and-the-test-case-schemas)).

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
your design tool as PNG (JPG and WebP work too), put them there and say "done" (on changes started before 0.6.0
and on the test-case schemas: run `/openspec-continue-change`). With the folder still empty the agent asks once more: wait,
or go on without mockups. Screenshots already in the folder skip the question. One file per screen and variant, named in
screen order: `01-orders-list.png`, `02-orders-list-mobile.png`. An optional `sources/ui/screens.md` may say
what each one shows. Any other file there (SVG, PDF, a Figma file) blocks the next artifact until it is exported
as PNG. The rules are in `openspec/protocols/ui-inventory.md`.

- A screenshot switches the change into **UI mode**; without screenshots nothing changes.
- Before its first questions the agent writes `ui-inventory.md`: every screen with its interactive elements
  (buttons, links, fields, toggles, menus) and states (empty, error, loading). It then asks about every element
  your description does not mention, every requirement with nothing on the screens, and every missing state.
- Every element gets a decision: `in scope`, `mock` (a stub now), `out of scope`, `decoration` or `existing`.
  Out of scope, decoration and mock come only from your answers. You see them all in a short message the agent
  writes before the proposal, without waiting for a reply (earlier rules: in the round summary).
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
/clear
/openspec-apply-change
```

Start apply after `/clear` or in a new chat: it works from the artifacts, and a planning conversation only fills
its context. After planning, apply runs on its own (`openspec/protocols/apply.md`): every task, the test review, the full
suite and the E2E stage, without asking you anything. The agent stops only on a decision that belongs to you: a
requirement gap, a test that still fails after two fix attempts, an environment that does not start the
application the way the project describes, an action outside the project or a weaker test (both need your
consent), a situation the plan does not cover, and the consent list at the end. In a stop it may suggest
options, but carries out none until you choose. When a stop concerns one test, it first finishes the tasks that
do not depend on it.

**Start check.** When the verification plan says `Running application: yes` and the check did not already pass
right after the Main round, the agent first starts the application with the project's own commands and requests
one address
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

### 3a. E2E stage (web applications in one repository or a meta-repository)

When the change touches a web application whose backend is in the same repository (or in another clone of the
same [meta-repository](#meta-repositories)), the Main round asks whether
it needs E2E tests and against which backend: the real one, started locally on an empty test database, or stubbed
responses. On `lean` the agent asks before the first task. A mobile app, a backend-only change or a frontend whose
backend lives in a repository outside the project gets no E2E.

After the last task the agent runs the stage (`openspec/protocols/e2e.md`) and records it in `e2e.md`:

1. It asks once whether you start the application (and give its address) or it starts it with the project's
   command; when the project has none, it offers to write one.
2. When the project has no Playwright, it asks your permission to install it in its own folder (for example
   `e2e/`, with its own `package.json`, Chromium only, no retries). If you refuse, E2E is skipped.
3. It writes one Playwright test per `e2e` test case (on `clarify` and `lean`: per scenario it lists and shows
   you), each tagged `@case` or `@scenario`. Tests create their own users and data; passwords stay out of git.
4. It runs them only with `node openspec/tooling/bin/e2e-run.mjs --change <name>`, which records every run in
   `e2e-runs.json`, with two Playwright workers so the machine does not lag (set `E2E_WORKERS`, for example `4`
   or `50%`, for another number), and never beside another test suite. While tests are fixed only the failing
   ones run again, then one full run. A failing test gets at most three fix attempts, then it is yours to decide: fix, or accept the
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
/openspec-archive-change add-sales-export
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
/openspec-new-change fix-rounding --schema lean
```

The flow is proposal → specs → verification-plan → tasks → apply, with no question rounds. If the agent would have to
guess behaviour, it stops and suggests `clarify`. Tests, markers and the gates are the same. Before the first task
the agent asks whether the change needs E2E (section 3a).

Since 0.6.0 a `lean` change also plans by itself: the agent asks about mockups in the chat, writes the proposal
and goes on to the tasks without `/openspec-continue-change`, with the same stops, pause and end message as `clarify`
(section 2). It has no depth level, no answer mode, no spec review and no digest.

## Earlier changes and the test-case schemas

A change created before 0.6.0 (no `x-sdd-kit` stamp, or one below 0.6.0), and every change on `clarify-ai-qa` or
`clarify-qa`, keeps the planning rules of `openspec/protocols/questions.md`:

- **Depth** `Minimal`, `Standard` or `Comprehensive` (default `Comprehensive`); no recommendations.
- **Four rounds before the code:** Main (before the proposal), Specs (errors, edge cases, permissions, rules,
  limits), Design (only choices that would change the approach) and Verification (which scenarios are critical,
  which need an integration test, test data, environments, whether the checks need the application running).
- **A summary per round.** After the answers the agent writes a summary with the assumptions it will make;
  reply **Looks correct** or **Request changes**. Until it says exactly `Looks correct`, the next artifact is
  blocked.
- **`/openspec-continue-change`** after each artifact; nothing goes on by itself, and there is no digest.
- **Spec review:** you decide what to do with each finding of the `spec-reviewer`: fix the spec, ask a
  follow-up, or accept it.

## Meta-repositories

When `openspec/clones` exists ([install](install.md#meta-repositories)), the project is a meta-repository. Start
Claude Code in the root. Changes started there follow `openspec/protocols/metarepo.md` in addition to the
steps above; changes started before the list existed finish under the old rules.

- **Verification plan.** Each row names its repositories in a last *Repository* column (`backend`,
  `backend, frontend`, `root`). A `unit` / `integration` row needs a marked test in each named repository. A
  scenario seen only in the browser can use the level `e2e`, proven by an E2E test of the stage.
- **Tasks.** Each task group names one repository: `## 2. [backend] Order API`. Only the last group (the final
  checks) names none. The agent does a group's tasks in that repository with its own commands, from `AGENTS.md`
  and the mise tasks; when it cannot find them, it asks you once and suggests adding them to `AGENTS.md`.
- **Report.** `apply-report.md` gets a section per repository of the task groups:

  ```markdown
  ## Repository: backend

  Command: mise run test:backend
  Result: 214 passed
  ```

- **E2E.** The clones count as one web application. The E2E question comes only for a change that touches the
  web interface; the E2E tests live in a root folder (e.g. `e2e/`), and one command from the root starts the
  application.
- **Archive.** On top of the usual gate: the clone list has no error, every task group names a known
  repository, every named repository has its tests and its report section, and no clone the change names is
  missing.
- A clone's own `openspec/` is read only from the root; work on it from a session started in the clone.

## What runs where

| When | What |
|---|---|
| session start | where each change stands, open questions, changed answers, OpenSpec version and skills drift |
| `openspec new change` without `--schema` | the schema starter asks the depth level and creates the change on `clarify` |
| writing an artifact | answers-gate blocks it while its question round is open, and (0.6.0) while an answer changed after earlier artifacts were written from it; on the test-case schemas the design also waits for the test-cases stage; in UI mode it also waits for an up-to-date UI inventory (`check-ui`) |
| running the AI QA reviewer | the run-limit hook blocks a fourth run in a loop |
| running the spec reviewer (0.6.0, `clarify`) | the run-limit hook blocks a third run on the same specs, and a second one after a run without findings |
| after writing an artifact | the matching check runs, and its errors go back to the agent (`check-e2e` after `e2e.md`, `check-apply-report` after `apply-report.md`); the first artifact of a change records the kit version; on 0.6.0 changes the answers it was written from are recorded in `answers-lock.json` |
| the agent ends its turn during planning (0.6.0) | `planning-continue` keeps it going with the next artifact unless the change waits for you |
| your next message | ends a wait the agent marked; a pause stays until you say "go on" |
| start of apply | `start-check.mjs` starts the application, requests one address and stops it again, when the plan needs it |
| a Bash command outside the project | the command guard asks you first |
| E2E stage | `e2e-run.mjs` runs Playwright and records the run in `e2e-runs.json` |
| last task checked | a reminder of the end-of-apply steps |
| `openspec archive` | archive gate |
