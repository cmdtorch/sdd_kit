# How sdd-kit works — what it adds to OpenSpec

This page lists everything sdd-kit adds on top of a plain OpenSpec install, layer by layer, with the file that
implements each part. Read it to understand what this repository is; read [workflow.md](guide/workflow.md) to
learn how to use it.

Paths are given as they appear in a project after installation. In this repository the sources live under
`kit/`: `kit/openspec/…` is installed as `openspec/…`, `kit/claude/…` as `.claude/…`.

## At a glance

| Plain OpenSpec 1.15.0 | sdd-kit adds |
|---|---|
| `spec-driven` schema: proposal → specs → design → tasks → apply | `clarify` and `lean` schemas: question rounds before each artifact, a verification plan, TDD tasks |
| an artifact is "done" as soon as its file exists | checks that read the content: answers, sources, specs, traceability |
| rules are text the agent may or may not follow | Claude Code hooks that block an artifact or an archive until its rules hold |
| `propose` writes every artifact in one pass | a workflow profile without `propose`, so no question round is skipped |
| no link between spec scenarios and tests | scenario markers in tests, a verification level per scenario, a test reviewer |
| `openspec archive --yes` archives with open tasks | an archive gate: tasks, checks, marked tests and a test review |
| `openspec init` / `update` | an installer that merges into existing settings, keeps local edits and uninstalls cleanly |

The kit never runs the project's tests and knows no stack. The agent runs the project's own commands.

## 1. Schemas

OpenSpec lets a project define its own schemas. The kit ships two, both forked from `spec-driven`: the upstream
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

The templates are in `openspec/schemas/<schema>/templates/`.

## 2. Protocols

Rules the agent reads while it works, in `openspec/protocols/`:

| File | Defines |
|---|---|
| `openspec/protocols/questions.md` | the question format (options, `Why this is asked`, `Not yet defined`); the rounds Main, Specs, Design, Verification and Apply; answer modes; mandatory analysis of the answers for vagueness and contradictions; the summary confirmed with exactly `Looks correct` |
| `openspec/protocols/grounding.md` | source tags `[Q<n>]`, `[D<n>]`, `[desc]`, `[assumption]` and the register of source documents |
| `openspec/protocols/testing.md` | verification levels `unit`, `integration`, `manual`; the verification plan format; scenario markers; what a good test asserts; the end of apply |
| `openspec/protocols/review-specs.md` | what the spec reviewer checks and how it reports |
| `openspec/protocols/review-tests.md` | what the test reviewer checks and how it reports |

The installer also adds a marked block to `context` in `openspec/config.yaml` (from `kit/config-fragment.yaml`),
so every OpenSpec instruction points the agent at these protocols and states the questions language.

## 3. Claude Code hooks

Registered in `.claude/settings.json` (from `kit/claude-settings.fragment.json`), merged with the project's own
hooks:

| Hook | Event | What it does |
|---|---|---|
| `openspec/tooling/hooks/answers-gate.mjs` | before Write, Edit, MultiEdit, Bash | **blocks** writing proposal, specs, design or the verification plan while its question round is unanswered or unconfirmed; shell writes (redirects, `tee`, `sed -i`, …) are caught too |
| `openspec/tooling/hooks/archive-gate.mjs` | before `openspec archive` | **blocks** the archive unless every task is done, every check passes, every automated scenario has a marked test and the test review is READY or has a human decision |
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
| `openspec/tooling/checks/check-traceability.mjs` | every scenario is in the verification plan (with a level, or excluded with a reason); every requirement is traced to its sources; with `--markers`, every `unit` or `integration` scenario has a test carrying its marker |
| `openspec/tooling/checks/lint-kit.mjs` | misspelled fields in `schema.yaml`, `config.yaml` and `.openspec.yaml`, which OpenSpec ignores silently; a `context` over 50 KB, which OpenSpec drops whole |

## 5. Tests linked to scenarios

- **Markers.** A test that proves a scenario carries a comment on its own line, in any language:
  `@scenario <capability-path> :: <Scenario name>`. The kit finds markers by reading git-tracked and untracked
  files outside `openspec/`; paths listed in `openspec/markers-ignore` (the project's file) are skipped.
- **Verification plan.** Every scenario gets a level: `unit`, `integration` or `manual`, or an exclusion with a
  reason. check-traceability and the archive gate hold the plan and the markers together.
- **Review input.** `openspec/tooling/bin/review-input.mjs` prints every scenario with its THEN clauses, planned
  levels and marked tests: what the test reviewer reads.

## 6. Subagents and command

| File | What |
|---|---|
| `.claude/agents/spec-reviewer.md` | after the specs: can a developer and QA start without asking anything? Writes `reviews/spec-review.md` |
| `.claude/agents/test-reviewer.md` | before apply ends: would each test fail if the feature broke? Every THEN asserted, specific assertions, errors asserted. Writes `reviews/test-review.md` |
| `.claude/commands/sdd/clarify.md` | `/sdd:clarify`: run or continue the question round for the current stage of a change |

Both reviewers only report; the main agent fixes, and the developer decides what remains.

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
| `openspec/tooling/lib/plan.mjs` | parser for `verification-plan.md` |
| `openspec/tooling/lib/spec-parser.mjs` | parser for delta and main specs |
| `openspec/tooling/lib/markers.mjs` | finds scenario markers in project files |
| `openspec/tooling/lib/reviews.mjs` | review input and review status |
| `openspec/tooling/lib/markdown.mjs` | fences, tables, task counting |
| `openspec/tooling/lib/yaml.mjs` | minimal YAML reader (no dependencies) |
| `openspec/tooling/lib/project.mjs` | finds the project root, changes and their schema |
| `openspec/tooling/lib/report.mjs` | shared result format and command-line runner of the checks |
| `openspec/tooling/lib/hook-io.mjs` | Claude Code hook input and output |
| `openspec/tooling/lib/settings-merge.mjs` | `.claude/settings.json` merge (see §8) |

## What the kit does not do

- It does not run the project's tests; the agent does, with the project's commands.
- No browser E2E and no backend → frontend contract step yet ([decisions](decisions.md) R3, R7).
- Claude Code only.
