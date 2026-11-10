# Tasks

## 1. Clone list library and the test meta-repository

- [ ] 1.1 Add `tests/helpers/metarepo.mjs`: builds a temporary meta-repository (root git with `repos/*` in `.gitignore`, clones `repos/backend` and `repos/frontend` with their own git and `.gitignore`), installs the kit with `--metarepo`, and writes a change with plan, tasks and report variants
- [ ] 1.2 Write failing tests for "Clone named after its folder", "Clone with its own name" (unit) (metarepo/clones); every test carries its `@scenario` marker; verify they fail
- [ ] 1.3 Add `kit/openspec/tooling/lib/clones.mjs` (design §2): parse `openspec/clones` (path or `name=path`, `#` comments, allowed name characters, `root` reserved, folder name as default), list errors, `exists` per clone, `isMetarepo`, `followsMetarepo`, `repositoryOf`; run the group 1 tests and verify they pass

## 2. Project files include the clones

- [ ] 2.1 Write failing tests for "Edit in a clone invalidates the run", "Edit in an untouched clone also invalidates the run", "File ignored by a clone does not invalidate the run" (integration) (metarepo/e2e); "Committed test in a clone closes a scenario", "Uncommitted test in a clone closes a scenario", "File ignored by the clone is not read", "Clone's own OpenSpec folder is not read", "Root ignore pattern excludes a clone path", "Review input shows the clone", "Large frontend clone with dependencies" (integration) (metarepo/test-discovery); every test carries its `@scenario` marker; verify they fail
- [ ] 2.2 Extend `listProjectFiles` in `kit/openspec/tooling/lib/markers.mjs` (design §3): one `git -C <clone> ls-files` per existing clone, paths prefixed with the clone folder, each clone's `openspec/` and `.claude/` skipped, `openspec/markers-ignore` applied to prefixed paths, a walk for a clone without git; run the group 2 tests and verify they pass
- [ ] 2.3 Check that `kit/openspec/tooling/lib/reviews.mjs` and `kit/openspec/tooling/lib/e2e-runs.mjs` read the clones through `listProjectFiles` (paths from the root, fingerprints over the clones); run the full suite and verify the single-repository tests still pass

## 3. Repository binding in the plan

- [ ] 3.1 Write failing tests for "Invalid clone list blocks the archive", "Invalid clone list is reported by the checks", "Empty clone list is a meta-repository", "Checks name the missing clone instead of the test", "Change started before the switch archives under the old rules", "Clone list removed during a meta-repository change" (integration) (metarepo/clones); "Backend row leaves the frontend to E2E", "e2e level in a single repository is reported", "Root E2E test does not close a backend integration row" (integration) (metarepo/e2e); "Missing column is reported", "Row without a repository is reported", "Unknown repository is reported", "Manual row without a repository is reported", "Backend test does not close a frontend row", "Playwright test in the frontend clone closes a frontend row", "Row for two repositories needs a test in each", "Root test closes a root row", "Case reference in the wrong repository does not count", "Archive blocked by a named missing clone", "Archive not blocked by a clone the change does not name" (integration) (metarepo/test-discovery); every test carries its `@scenario` marker; verify they fail
- [ ] 3.2 Read the *Repository* column of *Scenario coverage* and *Test case coverage* and the `e2e` level in `kit/openspec/tooling/lib/plan.mjs` (design §4)
- [ ] 3.3 Extend `kit/openspec/tooling/checks/check-traceability.mjs` for changes that follow the meta-repository rules: column, cell and name errors, `e2e` outside a meta-repository, a marked test per named repository via `repositoryOf`, an E2E-folder test never closing a `unit` / `integration` row, missing clones reported as missing, clone list errors, the missing list on a marked change; pass the same to the archive gate; run the group 3 tests and verify they pass

## 4. Meta-repository mark of a change

- [ ] 4.1 Write failing tests for "Change started after the switch is marked", "Change created before the switch but written after it" (integration) (metarepo/clones); every test carries its `@scenario` marker; verify they fail
- [ ] 4.2 Write `x-sdd-kit-metarepo: true` in `kit/openspec/tooling/hooks/artifact-feedback.mjs` together with the `x-sdd-kit` stamp when `isMetarepo` holds (design §8); run the group 4 tests and verify they pass

## 5. Repository of task groups

- [ ] 5.1 Write failing tests for "Group without a repository blocks the tasks", "Group with an unknown repository blocks the tasks", "Group with two repositories blocks the tasks", "Final checks group needs no repository", "Single group needs a repository" (integration) (metarepo/apply); "Empty clone list needs root in task groups" (integration) (metarepo/clones); "Archive blocked by a task group on a missing clone" (integration) (metarepo/test-discovery); every test carries its `@scenario` marker; verify they fail
- [ ] 5.2 Parse `## <n>. [<name>] <title>` headings in `kit/openspec/tooling/lib/markdown.mjs` and add `kit/openspec/tooling/checks/check-tasks.mjs` (design §5): one known repository per group except the last of two or more, missing clones named by a group
- [ ] 5.3 Run `check-tasks` in `kit/openspec/tooling/hooks/answers-gate.mjs` on the content about to be written (Write content; Edit / MultiEdit applied to the current file), in `artifact-feedback.mjs` after `tasks.md`, and in `archive-gate.mjs`; run the group 5 tests and verify they pass

## 6. Report sections per repository

- [ ] 6.1 Write failing tests for "Report with a section per repository", "Missing section blocks the archive", "Empty section is reported", "Root without tests reports no tests", "Section without a result is reported", "Repeated section is reported", "Failed result does not block by itself", "Repository named only in the plan needs no section" (integration) (metarepo/apply); every test carries its `@scenario` marker; verify they fail
- [ ] 6.2 Read `## Repository: <name>` sections with `Command:` / `Result:` lines in `kit/openspec/tooling/lib/apply-report.mjs` and check them in `kit/openspec/tooling/checks/check-apply-report.mjs` against the repositories of the task groups (design §6); run the group 6 tests and verify they pass

## 7. E2E in a meta-repository

- [ ] 7.1 Write failing tests for "Skipped stage without interface passes", "Frontend-only scenario proven by E2E", "e2e row without an E2E test blocks the archive", "e2e row with E2E skipped needs consent", "e2e row with E2E skipped passes with consent", "Root E2E test proves a frontend scenario", "Clone Playwright test does not count", "Test folder inside a clone is reported", "One root command starts both clones" (integration) (metarepo/e2e); every test carries its `@scenario` marker; verify they fail
- [ ] 7.2 Extend `kit/openspec/tooling/checks/check-e2e.mjs` (design §7): test folder in the root outside every clone, `e2e` plan rows counted like listed scenarios, `e2e` rows of a skipped stage only as agreed entries with `Consent:` in the archive gate; check that `start-check.mjs` runs its command from the root; run the group 7 tests and verify they pass

## 8. Guard of a clone's OpenSpec and the root gates

- [ ] 8.1 Write failing tests for "Unanswered Main round blocks the proposal in a meta-repository", "Open task blocks the archive in a meta-repository", "Editing a clone's proposal is blocked", "Shell write to a clone's OpenSpec is blocked", "Write through an absolute path is blocked", "Removing a clone's OpenSpec file is blocked", "Reading a clone's OpenSpec is allowed" (integration) (metarepo/clones); every test carries its `@scenario` marker; verify they fail
- [ ] 8.2 Add the guard to `kit/openspec/tooling/hooks/answers-gate.mjs` (design §8): file-tool and detected shell writes, relative or absolute, into a declared clone's `openspec/` are blocked with a message naming the clone; run the group 8 tests and verify they pass

## 9. Installer

- [ ] 9.1 Write failing tests for "Installer in a terminal asks for the repository kind", "Single repository answer creates no list", "Invalid path in a terminal is asked again", "Installer in a terminal asks the clone paths" (unit) and "Single repository change archives as before", "Path not yet on disk is accepted", "Update asks no repository question", "Install with clones in the flag", "Flag with a bare path", "Install with the flag alone", "Install without the flag stays a single repository", "Invalid flag entry writes nothing", "Update switches a single repository to a meta-repository", "Update adds clones to an existing list", "Known path under another name writes nothing", "Update keeps the clone list", "Install leaves the clones untouched", "Uninstall leaves the clones and the list" (integration) (metarepo/clones); every test carries its `@scenario` marker; verify they fail
- [ ] 9.2 Add the repository-kind question, the clone-path questions and `--metarepo [<entries>]` to `installer/sdd-kit.mjs` (design §9): merge into `openspec/clones`, validate before writing, keep the file outside the manifest, never write inside a clone; `update` asks no new question; run the group 9 tests and verify they pass

## 10. Doctor

- [ ] 10.1 Write failing tests for "Doctor adds a clone in a terminal", "Developer answers no" (unit) and "Repeated clone name is reported", "Repeated clone path is reported", "Reserved name is reported", "Path outside the root is reported", "Name with a space is reported", "Health check says nothing about clones", "Health check reports a missing clone", "Doctor only prints without a terminal", "Offered line avoids a known name", "Install never asks about nested repositories", "Repository inside dependencies is not offered" (integration) (metarepo/clones); every test carries its `@scenario` marker; verify they fail
- [ ] 10.2 Extend `kit/openspec/tooling/bin/doctor.mjs` (design §9): clone list errors, missing clones as warnings, undeclared nested repositories up to three levels (skipped folders, `<parent>-<folder>` for a taken name), asking only in a terminal without `--yes`; run the group 10 tests and verify they pass

## 11. Protocol, kit block and docs

- [ ] 11.1 Write failing tests for "Protocol names the group's repository", "Protocol suggests AGENTS.md in a meta-repository", "Kit block points to the protocol" (unit) (metarepo/apply); "Protocol asks only for interface changes" (unit) (metarepo/e2e); every test carries its `@scenario` marker; verify they fail
- [ ] 11.2 Write `kit/openspec/protocols/metarepo.md` (design §1): *Repository* column and `e2e` level, task-group tags, working in the group's repository with its own commands from the meta-repository's instructions and mise tasks, report sections, the E2E question only for web-interface changes, E2E tests in a root folder, `AGENTS.md` for missing commands; add the pointer line to `kit/config-fragment.yaml`; run the group 11 tests and verify they pass
- [ ] 11.3 Update `docs/how-it-works.md` (protocol, `clones.mjs`, `check-tasks.mjs`, installer flag, doctor), add the decisions to `docs/decisions.md`, add the `CHANGELOG.md` entry under `## Unreleased`, and the meta-repository part of `docs/guide/`

## 12. Final verification

- [ ] 12.1 Run the `test-reviewer` subagent on `metarepo-support` and fix every blocker and major finding
- [ ] 12.2 Run `npm test` and fix what fails
- [ ] 12.3 Run `node openspec/tooling/checks/check-traceability.mjs --change metarepo-support --markers` and `openspec validate metarepo-support --strict`
- [ ] 12.4 Write `apply-report.md` per `openspec/protocols/apply.md` and run `check-apply-report` on it
