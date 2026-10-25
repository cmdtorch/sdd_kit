# How sdd-kit works — what it adds to OpenSpec

This page lists everything sdd-kit adds on top of a plain OpenSpec install, layer by layer, with the file that
implements each part. Read it to understand what this repository is; read [workflow.md](guide/workflow.md) to
learn how to use it.

Paths are given as they appear in a project after installation. In this repository the sources live under
`kit/`: `kit/openspec/…` is installed as `openspec/…`, `kit/claude/…` as `.claude/…`.

## At a glance

| Plain OpenSpec 1.15.0 | sdd-kit adds |
|---|---|
| `spec-driven` schema: proposal → specs → design → tasks → apply | `clarify` and `lean` schemas: question rounds before each artifact, a verification plan, TDD tasks; `clarify-ai-qa` and `clarify-qa` add a stage of Gherkin test cases reviewed by an AI QA reviewer (and a human QA) |
| `openspec new change` takes the project's default schema | a starter hook that makes the agent ask which schema a new change needs |
| an artifact is "done" as soon as its file exists | checks that read the content: answers, sources, specs, traceability |
| rules are text the agent may or may not follow | Claude Code hooks that block an artifact or an archive until its rules hold |
| `propose` writes every artifact in one pass | a workflow profile without `propose`, so no question round is skipped |
| no link between spec scenarios and tests | scenario markers in tests, a verification level per scenario, a test reviewer; `@case` references from tests to test cases |
| `openspec archive --yes` archives with open tasks | an archive gate: tasks, checks, marked tests and a test review |
| `openspec init` / `update` | an installer that merges into existing settings, keeps local edits and uninstalls cleanly |

The kit never runs the project's tests and knows no stack. The agent runs the project's own commands.

## 1. Schemas

OpenSpec lets a project define its own schemas. The kit ships four, all forked from `spec-driven`: the upstream
instruction and template text is kept verbatim at the start, and a `KIT RULES` block is appended after it.

**`openspec/schemas/clarify/schema.yaml`**, the default for new changes:

```
clarifications → proposal → specs → design → verification-plan → tasks → apply
```

- New artifacts: `clarifications.md` (questions and answers) and `verification-plan.md` (how each scenario is
  proven). Apply requires `tasks` and `verification-plan`.
- KIT RULES per artifact:
  - proposal: written only after the Main round is confirmed; every statement cites a source; scope comes only
    from confirmed answers.
  - specs: Specs round first; no source tags in spec text; stable scenario names (they are test keys); then the
    `spec-reviewer` subagent.
  - design: Design round first; always written; grounded like the proposal.
  - tasks: every task group starts with its failing tests (TDD) and every test carries a scenario marker; the
    final group runs the test review, the full test suite and the manual checks.
  - apply: tests first and seen failing; requirement gaps go to an Apply round instead of guesses; the test
    review and the full suite at the end.

**`openspec/schemas/lean/schema.yaml`**, for small and clear changes: proposal → specs → verification-plan →
tasks → apply. No question rounds; tests, markers and gates are the same. If the agent would have to guess
behaviour, it stops and suggests `clarify`.

**`openspec/schemas/clarify-ai-qa/schema.yaml`** and **`openspec/schemas/clarify-qa/schema.yaml`**, the
*test-case schemas*: `clarify` with one more artifact between the specs and the design:

```
clarifications → proposal → specs → test-cases → design → verification-plan → tasks → apply
```

- `test-cases.md`: Gherkin cases (Given / When / Then with concrete data, in English) for every spec scenario,
  each with verification labels `automated`, `e2e`, `manual` (`openspec/protocols/test-cases.md`). The design
  requires it.
- The `test-cases-reviewer` subagent reviews the cases, at most three runs per loop; the developer fixes or
  accepts what remains in the "Stage result" section of `test-cases.md`.
- `clarify-ai-qa`: the developer confirms the result. `clarify-qa`: the cases are then handed over to a human
  QA, who writes remarks in `test-cases.md` until none is open, and confirms. QA remarks may change the specs;
  every spec change of the stage is recorded in the file.
- The verification plan gets a *Test case coverage* table (a level `unit` / `integration` for each `automated`
  case) and the archive needs a test with an `@case` reference for each `automated` case. Test cases stay in
  the archived change; they are not merged into the main specs.
- Every artifact the two schemas share with `clarify` has the same instruction and template (a test holds them
  equal), and the two differ only in the hand-over to QA. Switching between them is an edit of `schema:` in
  the change's `.openspec.yaml`.
- `clarify`, `clarify-ai-qa` and `clarify-qa` form the *clarify family*: every hook and check that applies to
  `clarify` applies to all three (`openspec/tooling/lib/project.mjs`).

The templates are in `openspec/schemas/<schema>/templates/` (`openspec/schemas/clarify-ai-qa/templates/` and
`openspec/schemas/clarify-qa/templates/` also hold `test-cases.md`).

## 2. Protocols

Rules the agent reads while it works, in `openspec/protocols/`:

| File | Defines |
|---|---|
| `openspec/protocols/questions.md` | the question format (options, `Why this is asked`, `Not yet defined`); the rounds Main, Specs, Design, Verification and Apply; answer modes; mandatory analysis of the answers for vagueness and contradictions; the summary confirmed with exactly `Looks correct` |
| `openspec/protocols/grounding.md` | source tags `[Q<n>]`, `[D<n>]`, `[desc]`, `[assumption]` and the register of source documents |
| `openspec/protocols/testing.md` | verification levels `unit`, `integration`, `manual`; the verification plan format, incl. *Test case coverage*; scenario markers and `@case` references; what a good test asserts; the end of apply, incl. the lists of `manual` and `e2e` test cases |
| `openspec/protocols/test-cases.md` | the test-case document: format, labels, unique case names; the AI review loop; when the stage may change a spec; QA remarks and their statuses `open` / `closed` / `reopened`; "Stage result" (accepted findings, `Handed over to QA`, the `Looks correct` confirmation); late scenarios; switching between the two test-case schemas |
| `openspec/protocols/review-specs.md` | what the spec reviewer checks and how it reports |
| `openspec/protocols/review-tests.md` | what the test reviewer checks and how it reports |
| `openspec/protocols/review-test-cases.md` | what the AI QA reviewer checks (positive, error and boundary cases; a closed checklist of unusual conditions; concrete data; observable outcomes), severities, the READY rule and accepted findings |

The installer also adds a marked block to `context` in `openspec/config.yaml` (from `kit/config-fragment.yaml`),
so every OpenSpec instruction points the agent at these protocols and states the questions language.

## 3. Claude Code hooks

Registered in `.claude/settings.json` (from `kit/claude-settings.fragment.json`), merged with the project's own
hooks:

| Hook | Event | What it does |
|---|---|---|
| `openspec/tooling/hooks/answers-gate.mjs` | before Write, Edit, MultiEdit, Bash | **blocks** writing proposal, specs, design or the verification plan while its question round is unanswered or unconfirmed; on the test-case schemas also `design.md` until `check-test-cases --stage` passes; shell writes (redirects, `tee`, `sed -i`, …) are caught too |
| `openspec/tooling/hooks/archive-gate.mjs` | before `openspec archive` | **blocks** the archive unless every task is done, every check passes, every automated scenario has a marked test and the test review is READY or has a human decision; on the test-case schemas also unless `test-cases.md` passes its check and every `automated` case has a test with its `@case` reference |
| `openspec/tooling/hooks/schema-starter.mjs` | before Bash | **blocks** `openspec new change` (also through the kit wrapper) without `--schema`, and tells the agent to ask the developer a three-choice menu: no test cases (`clarify`), AI QA reviewer only (`clarify-ai-qa`), AI QA reviewer then a human QA (`clarify-qa`). The project default schema does not count; commands run in a terminal are not affected |
| `openspec/tooling/hooks/test-cases-run-limit.mjs` | before Agent / Task | counts runs of the `test-cases-reviewer` subagent per change in `reviews/test-cases-runs.json` and **blocks** a fourth run in a loop; a new loop starts for scenarios added after the stage is confirmed |
| `openspec/tooling/hooks/artifact-feedback.mjs` | after Write, Edit, MultiEdit | runs the check that matches the written artifact and hands its errors back to the agent; when the last task is checked, reminds it of the end-of-apply steps |
| `openspec/tooling/hooks/session-start.mjs` | session start | where each change stands, open questions, unconfirmed rounds, task progress; warns about a wrong OpenSpec version or drifted skills |

## 4. Checks

Content checks that `openspec validate` does not do, in `openspec/tooling/checks/`. Each one runs from the
command line (`--change <name>`, `--json`) and is called by the hooks.

| Check | Verifies |
|---|---|
| `openspec/tooling/checks/check-answers.mjs` | every question is answered, every round whose artifact exists is confirmed, the file format is valid |
| `openspec/tooling/checks/check-grounding.mjs` | every substantive block of proposal and design carries a source tag; `[Q<n>]` only from confirmed rounds; assumptions only in their section |
| `openspec/tooling/checks/check-specs.mjs` | Purpose of a new capability ≥ 50 characters; ADDED requirement ≤ 500 characters; `#### Scenario:` format and unique names; a THEN in every scenario; no source tags in specs; no `###` headers OpenSpec skips |
| `openspec/tooling/checks/check-traceability.mjs` | every scenario is in the verification plan (with a level, or excluded with a reason); every requirement is traced to its sources; with `--markers`, every `unit` or `integration` scenario has a test carrying its marker; on the test-case schemas also the *Test case coverage* table and, with `--markers`, an `@case` reference for every `automated` case (a reference to an archived case is silent, an unknown one is a warning) |
| `openspec/tooling/checks/check-test-cases.mjs` | test-case schemas: every scenario has a test case and every case sits under a scenario of the delta specs; unique case names per capability; Given / When / Then; labels; remark statuses. With `--stage`: the stage is complete (latest AI review READY or its blocker / major findings accepted, `Looks correct`; on `clarify-qa` also `Handed over to QA` and no open remark) |
| `openspec/tooling/checks/lint-kit.mjs` | misspelled fields in `schema.yaml`, `config.yaml` and `.openspec.yaml`, which OpenSpec ignores silently; a `context` over 50 KB, which OpenSpec drops whole |

## 5. Tests linked to scenarios

- **Markers.** A test that proves a scenario carries a comment on its own line, in any language:
  `@scenario <capability-path> :: <Scenario name>`. The kit finds markers by reading git-tracked and untracked
  files outside `openspec/`; paths listed in `openspec/markers-ignore` (the project's file) are skipped.
- **Verification plan.** Every scenario gets a level: `unit`, `integration` or `manual`, or an exclusion with a
  reason. check-traceability and the archive gate hold the plan and the markers together.
- **Case references.** On the test-case schemas a test that proves a test case also carries
  `@case <capability-path> :: <case name>`, with the same placement rules as a marker.
- **Review input.** `openspec/tooling/bin/review-input.mjs` prints every scenario with its THEN clauses, planned
  levels and marked tests: what the test reviewer reads.

## 6. Subagents and command

| File | What |
|---|---|
| `.claude/agents/spec-reviewer.md` | after the specs: can a developer and QA start without asking anything? Writes `reviews/spec-review.md` |
| `.claude/agents/test-cases-reviewer.md` | the AI QA reviewer, on the test-case schemas after the test cases are written: would a QA engineer accept them? Writes `reviews/test-cases-review.md` (`openspec/protocols/review-test-cases.md`) |
| `.claude/agents/test-reviewer.md` | before apply ends: would each test fail if the feature broke? Every THEN asserted, specific assertions, errors asserted. Writes `reviews/test-review.md` |
| `.claude/commands/sdd/clarify.md` | `/sdd:clarify`: run or continue the question round for the current stage of a change |

The reviewers only report; the main agent fixes, and the developer decides what remains.

## 7. Working around OpenSpec

- **Workflow profile without `propose`.** `openspec/tooling/xdg/openspec/config.json` lists the kit workflows
  (new, continue, verify, explore, apply, update, sync, archive). `openspec/tooling/bin/openspec.mjs` runs
  `openspec init` / `update` with it, without reading or rewriting the developer's global OpenSpec config, and
  with telemetry off.
- **Own spec parser.** `openspec/tooling/lib/spec-parser.mjs` reads requirements and scenarios with OpenSpec's
  header rules, so the checks do not depend on `openspec show --json`.
- **Same task counting.** Tasks are counted with OpenSpec 1.15.0's checkbox rules (`openspec/tooling/lib/markdown.mjs`):
  only `[x]` is done, `[~]` or `[]` is open.
- **Pinned version.** `openspec/tooling/kit.json` holds the kit version and the one OpenSpec version it supports;
  doctor and session start warn on a mismatch.

## 8. Installer and doctor

- **`installer/sdd-kit.mjs`**: `install`, `update`, `status`, `uninstall`.
  - `installer/lib/manifest.mjs`: a sha256 manifest (`openspec/tooling/kit-manifest.json`) of every kit file,
    so an update never overwrites a file edited locally and uninstall removes only unedited kit files.
  - `installer/lib/config-edit.mjs`: inserts or replaces the kit block in `openspec/config.yaml` as text,
    keeping the user's comments.
  - `installer/lib/gitignore.mjs`: versions `openspec/` and the shared parts of `.claude/`.
  - `openspec/tooling/lib/settings-merge.mjs`: merges the kit hooks into `.claude/settings.json` and removes
    them again, leaving other hooks, plugins and permissions untouched.
- **`openspec/tooling/bin/doctor.mjs`**: checks Node, the OpenSpec version, Claude Code, git, edited kit files,
  hooks and skills, and prints the fix for each problem.

## Internals

Shared libraries in `openspec/tooling/lib/`, used by the checks and hooks:

| File | What |
|---|---|
| `openspec/tooling/lib/clarifications.mjs` | parser for `clarifications.md` |
| `openspec/tooling/lib/plan.mjs` | parser for `verification-plan.md`, incl. *Test case coverage* |
| `openspec/tooling/lib/spec-parser.mjs` | parser for delta and main specs |
| `openspec/tooling/lib/markers.mjs` | finds scenario markers and `@case` references in project files |
| `openspec/tooling/lib/test-cases.mjs` | parser for `test-cases.md` and `reviews/test-cases-review.md` |
| `openspec/tooling/lib/reviews.mjs` | review input and review status |
| `openspec/tooling/lib/markdown.mjs` | fences, tables, task counting |
| `openspec/tooling/lib/yaml.mjs` | minimal YAML reader (no dependencies) |
| `openspec/tooling/lib/project.mjs` | finds the project root, changes and their schema; the kit schemas, the clarify family and the test-case schemas |
| `openspec/tooling/lib/report.mjs` | shared result format and command-line runner of the checks |
| `openspec/tooling/lib/hook-io.mjs` | Claude Code hook input and output |
| `openspec/tooling/lib/settings-merge.mjs` | `.claude/settings.json` merge (see §8) |

## What the kit does not do

- It does not run the project's tests; the agent does, with the project's commands.
- No browser E2E and no backend → frontend contract step yet ([decisions](decisions.md) R3, R7). Test cases
  labelled `e2e` are only listed, waiting for that stage.
- Claude Code only.
