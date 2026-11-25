# Tasks

All kit edits go into `kit/` (never the installed copy `openspec/` or `.claude/`); tests into `tests/`.

## 1. Verify the Stop hook in a live Claude Code

Depends on: none
Area: docs/openspec-facts.md
Shared: none

- [x] 1.1 In a scratch project outside the repository, register `Stop` and `UserPromptSubmit` command hooks that log their stdin, drive them with `claude -p`, and establish: the `Stop` input fields (`session_id`, `stop_hook_active`, `transcript_path`); that `{"decision":"block","reason":…}` on stdout keeps the agent working and the reason reaches it; what happens on a second block in a row; that `session_id` is the same in `PostToolUse`, `Stop` and `UserPromptSubmit` of one session
- [x] 1.2 Record each fact with its evidence in `docs/openspec-facts.md` §9 (rows K12 onwards). When a `Stop` hook cannot keep the agent working, end with a stop report (outside the plan) instead of 1.2's record of success

## 2. Version gate and the clarifications file of new changes

Depends on: 1
Area: kit/openspec/tooling/lib/project.mjs, kit/openspec/tooling/lib/clarifications.mjs, kit/openspec/tooling/checks/check-answers.mjs, kit/openspec/tooling/kit.json, package.json, tests/lib.test.mjs, tests/checks.test.mjs, tests/release.test.mjs
Shared: settings

- [x] 2.1 Write failing tests for `usesNewPlanning` (stamped 0.6.0 or `0.6.0-beta.1` on `clarify` or `lean`: yes; 0.5.0, no stamp, `clarify-qa`: no) and for the scenarios "Unknown level", "Missing level line", "Older change keeps its depth names", "Test-case schema keeps its depth names", "Recommendation in the file", "Recommendation names an unknown option", "Answer of a closed round is a valid source", "Answer of an open round is not a source", "Mock citing a closed round is accepted", "Mock citing an open round is reported", and verify they fail
- [x] 2.2 Add `usesNewPlanning` to `lib/project.mjs` and set the kit version to 0.6.0 in `kit.json` and `package.json` (keep `tests/release.test.mjs` passing)
- [x] 2.3 Teach `lib/clarifications.mjs` the new-rules file: rounds Main, Technical and Apply without a summary, `Depth: low|medium|high`, `Answer mode:`, `Recommended: <letters> — <reason>` under a question, `No questions.` in a round; `roundStatus()` reports a closed round as confirmed for a new-rules change
- [x] 2.4 Make `check-answers` validate these lines for new-rules changes and keep every present rule for earlier changes and the test-case schemas; run the tests of 2.1 until they pass

## 3. Closed rounds and the answers lock in the gates

Depends on: 2
Area: kit/openspec/tooling/hooks/answers-gate.mjs, kit/openspec/tooling/hooks/artifact-feedback.mjs, kit/openspec/tooling/hooks/session-start.mjs, kit/openspec/tooling/lib/answers-lock.mjs, tests/hooks.test.mjs, tests/answers-lock.test.mjs
Shared: none

- [x] 3.1 Write failing tests for "Proposal after the last answer", "Blank answer still blocks", "Round not started blocks", "Follow-up reopens the round", "Technical round without questions", "Recommended question stays unanswered", "Older change still needs the confirmation", "Test-case schema still needs the confirmation", and verify they fail
- [x] 3.2 In `answers-gate.mjs` map the proposal to the Main round and the specs, the design and the verification plan to the Technical round for new-rules changes; a missing round section blocks; no summary is asked
- [x] 3.3 Write failing tests for "Answer changed after the proposal", "Technical round answer changed after the tasks", "Earlier answer restored", "Added spaces are not a change", "Answer changed before any artifact", "Answer changed before apply", and verify they fail
- [x] 3.4 Add `lib/answers-lock.mjs` (`answers-lock.json`: a SHA-256 of the round's answers per written artifact); `artifact-feedback.mjs` writes the entry when an artifact of a new-rules change is written; `answers-gate.mjs` blocks later artifacts and check-offs in `tasks.md` while a lock entry differs, naming the questions and the artifacts; `check-answers` reports the same
- [x] 3.5 Update `session-start.mjs` so a new-rules change is reported with its open questions and a changed answer, without the "waiting for Looks correct" line; run the tests of 3.1 and 3.3 until they pass

## 4. The Stop hook and the session state

Depends on: 3
Area: kit/openspec/tooling/hooks/planning-continue.mjs, kit/openspec/tooling/hooks/planning-prompt.mjs, kit/openspec/tooling/hooks/artifact-feedback.mjs, kit/openspec/tooling/lib/session-state.mjs, kit/openspec/tooling/lib/hook-io.mjs, kit/openspec/tooling/bin/planning.mjs, kit/claude-settings.fragment.json, tests/planning-continue.test.mjs, tests/installer.test.mjs
Shared: settings

- [x] 4.1 Write failing tests, the hook run as a process with prepared input, for "Next artifact is written without a command", "Technical round is prepared next", "Lean change goes on", "Change not touched in this session is left alone", "Change on a test-case schema is not continued", "Older change is not continued", "Unstamped change is not continued", "Unanswered question ends the turn", "Question asked in the chat ends the turn", "Waiting for screenshots ends the turn", "Lean change waits for screenshots", "Changed answer ends the turn", "Developer pauses", "Developer resumes", "Check still fails after two attempts", "Write blocked by an open question is a wait", "No notification hook is installed", and verify they fail
- [x] 4.2 Add `lib/session-state.mjs` (a JSON file per session id in the system temporary folder: change, continuations since the last written artifact, wait, pause) and record the change in `artifact-feedback.mjs` when an artifact is written
- [x] 4.3 Add `bin/planning.mjs` with `wait`, `pause` and `resume`, and the `UserPromptSubmit` hook `planning-prompt.mjs` that clears a wait
- [x] 4.4 Add the `Stop` hook `planning-continue.mjs` (block with the next artifact from `openspec status`; let the turn end on a blank answer, an empty `sources/ui/` after "yes", a differing answers lock, complete planning, a wait, a pause, or two continuations without a new artifact) and the block helper in `lib/hook-io.mjs`
- [x] 4.5 Register both hooks in `kit/claude-settings.fragment.json`, keep install, update and uninstall tests passing, and run the tests of 4.1 until they pass

## 5. Starter menu and the spec reviewer run limit

Depends on: 2
Area: kit/openspec/tooling/hooks/schema-starter.mjs, kit/openspec/tooling/hooks/test-cases-run-limit.mjs, tests/qa-hooks.test.mjs, tests/starter.test.mjs
Shared: none

- [x] 5.1 Write failing tests for "Unnamed schema is blocked" (the message lists the three depth levels), "Medium is marked as recommended", "Only depth levels are offered", "Choosing the high level" (the message tells to rerun with `--schema clarify` and to write `Depth: high`), "Test-case schema named explicitly", and keep the present tests of "Unnamed schema through the wrapper is blocked", "Schema named with a space is not blocked", "Schema named with an equals sign is not blocked" and "Unknown schema is passed through" with their markers; verify the new ones fail
- [x] 5.2 Change the starter message in `schema-starter.mjs` to the depth question and remove the tests of the removed requirement "The menu offers three choices"
- [x] 5.3 Write failing tests for "Second run after fixes", "No third run", "First review without findings" and "Specs rewritten after a changed answer", and verify they fail
- [x] 5.4 Extend `test-cases-run-limit.mjs` to count `spec-reviewer` runs of a new-rules change in `reviews/spec-review-runs.json` and block the third, allowing one more run after the specs were rewritten for a changed answer; run the tests of 5.1 and 5.3 until they pass

## 6. The planning protocol: flow and rounds

Depends on: 4, 5
Area: kit/openspec/protocols/planning.md, kit/openspec/protocols/questions.md, kit/openspec/protocols/ui-inventory.md, tests/planning-protocol.test.mjs
Shared: none

- [x] 6.1 Write failing tests that find each rule in `planning.md` for "Question during a pause", "Check passes after a fix", "Write blocked by a cause only the developer can remove", "Finding the agent cannot fix", "First artifact follows the creation", "Developer still runs the command", "Finding fixed without the developer", "Finding that needs a requirements decision", "Older change waits for the developer", "Second run finds a requirements gap", "Digest is printed and planning goes on", "Digest without own decisions", "Twenty own decisions", "Planning is complete", and verify they fail
- [x] 6.2 Write `kit/openspec/protocols/planning.md`: who it applies to, the automatic continuation and its stops, `planning.mjs wait|pause|resume`, the two fix attempts on an artifact check, the spec review findings and the two runs, the digest and its overflow rule, the message at the end of planning
- [x] 6.3 Write failing tests for "Design is written without a round of its own", "Design fork is asked in the Technical round", "Requirement gap during the implementation", "Verification plan without questions", "Second round does not ask again", "New chat does not ask again", "Developer switches the mode", "Developer asks to update", "Answer changed during apply", "Yes without screenshots stops until continue", "Empty folder on continue is asked again", "Lean asks about mockups before the proposal", "Yes on a new change waits for the developer's word", "Screenshots in place on a new change", "Done with an empty folder on a new change", "Decisions are shown before the proposal on a new change", and verify they fail; keep the present tests of "Element without a decision blocks the proposal", "Not yet defined blocks the proposal", "Late element without a decision blocks the design" and "Element without a decision blocks the archive" with their markers
- [x] 6.4 Add to `planning.md` the two rounds, the closing of a round, the round without questions, the answer mode and its record, the changed answer in planning and in apply, the review and the digest after an update, the message with the UI decisions before the proposal; point `questions.md` and `ui-inventory.md` §1 to it for new-rules changes; run the tests of 6.1 and 6.3 until they pass

## 7. The planning protocol: recommendations, depth, schema instructions

Depends on: 6
Area: kit/openspec/protocols/planning.md, kit/openspec/schemas/, kit/config-fragment.yaml, tests/planning-protocol.test.mjs, tests/schemas.test.mjs
Shared: none

- [x] 7.1 Write failing tests for "Recommendation from the code", "No basis, no recommendation", "Several recommended options", "Older change has no recommendations", "Test-case schema has no recommendations", "Batch of questions in the chat", "Developer asks to accept everything", "Level not chosen", "High level finds an affected module", "Low level asks from the sources only", "Medium level reads the touched area", "Low level settles what the user does not see", "Low level asks about visible behaviour", "Medium level settles a visible detail", "Medium level asks about permissions", "Medium level asks about data the user does not see", "Decision made while writing the specs", "High level asks about the storage period", "Reason names the dependent rule", "High level names the finding", "Consequence of a narrowed permission", "Consequence already decided", "Level raised after the Main round", "Level lowered during a round", and verify they fail
- [x] 7.2 Add to `planning.md` the recommendations (basis, the `Recommended:` line, never an answer, no accept-all) and the depth levels (what each investigates and settles, the `Why this is asked:` rule, the consequences check on `high`, a changed level, where the agent records its own decisions)
- [x] 7.3 Point the `clarify` and `lean` schema instructions, the clarifications template and the kit block of `kit/config-fragment.yaml` to `planning.md` for changes stamped 0.6.0 or later, keeping the present text for earlier changes; keep the instructions that `clarify` shares with `clarify-ai-qa` and `clarify-qa` identical (`tests/schemas.test.mjs`)
- [x] 7.4 Run the tests of 7.1 and `node --test tests/schemas.test.mjs` until they pass

## 8. Documentation

Depends on: 7
Area: docs/, CHANGELOG.md, openspec/specs/workflow/schema-starter/spec.md, tests/planning-protocol.test.mjs
Shared: none

- [x] 8.1 Write a failing test for "Guide recommends the built-in notifications" (the workflow guide names Claude Code's built-in notifications) and verify it fails
- [x] 8.2 Update `docs/guide/workflow.md`: planning without `/opsx:continue`, the pause, two rounds without `Looks correct`, recommendations, depth levels, the digest, apply in a new chat, the built-in notifications
- [x] 8.3 Update `docs/how-it-works.md` (every new kit file: `planning.md`, `planning-continue.mjs`, `planning-prompt.mjs`, `planning.mjs`, `session-state.mjs`, `answers-lock.mjs`; the changed hooks and checks), `docs/decisions.md` (the decisions D-1 to D-9 of the design), `docs/roadmap.md` and `CHANGELOG.md` under `## Unreleased`
- [x] 8.4 Rewrite the Purpose of `openspec/specs/workflow/schema-starter/spec.md`: the menu asks the depth level; run the test of 8.1 until it passes

## 9. Review and full suite

Depends on: 1, 2, 3, 4, 5, 6, 7, 8

- [x] 9.1 Run the `test-reviewer` subagent and fix its blocker and major findings (`openspec/protocols/review-tests.md`)
- [x] 9.2 Run `npm test` and `node openspec/tooling/checks/lint-kit.mjs`, and fix what fails
- [x] 9.3 Write `apply-report.md` (`openspec/protocols/apply.md` section 7) from the `manual` row of the verification plan
- [x] 9.4 Run `node openspec/tooling/checks/check-traceability.mjs --change streamline-planning --markers`
