# Tasks

The change edits only its own delta specs; no kit, installer or test file changes. The main specs change at archive.

## 1. Prove the shortened requirements

Depends on: none
Area: openspec/changes/split-long-requirements/
Shared: none

- [x] 1.1 Run the existing marked tests of every scenario of the five delta specs (`tests/ui-hooks.test.mjs`, `tests/planning-protocol.test.mjs`, `tests/apply-protocol.test.mjs`, `tests/test-runs-protocol.test.mjs`, `tests/start-check-early.test.mjs`, `tests/autonomous-apply.test.mjs`, `tests/subagents-protocol.test.mjs`) with the one-file command and verify they pass, and verify `node openspec/tooling/checks/check-traceability.mjs --change split-long-requirements --markers` reports no error
- [x] 1.2 In a scratch copy of the repository (outside the project, with an empty temporary HOME), run `openspec archive split-long-requirements --yes` with OpenSpec 2.2.0 and verify `openspec validate --specs --strict` there reports every spec passed and every scenario of the five requirements is still in its main spec

## 2. Final checks

Depends on: 1
Area: unknown
Shared: none

- [x] 2.1 Run the `test-reviewer` subagent and fix its blocker and major findings
- [x] 2.2 Run the full suite (`npm test`) and `node openspec/tooling/bin/doctor.mjs`, and fix what fails
- [x] 2.3 Write `apply-report.md` (`openspec/protocols/apply.md` section 7) and run `node openspec/tooling/checks/check-traceability.mjs --change split-long-requirements --markers`; verify it reports no error

## Workflow follow-up

- Archive the change with `/openspec-archive-change`, then run `openspec validate --specs --strict` in the repository.
