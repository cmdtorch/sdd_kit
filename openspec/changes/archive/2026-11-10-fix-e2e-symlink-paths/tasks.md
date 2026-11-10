## 1. Project-relative test file paths

- [x] 1.1 Write failing unit tests for "Project path through a symlink" and "File outside the project keeps its relative path" (`parsePlaywrightReport` with a symlinked project root) and verify they fail
- [x] 1.2 In `parsePlaywrightReport` (`kit/openspec/tooling/lib/e2e-runs.mjs`), when the relative path leaves the project, compare the real paths of the root and the file; verified by the tests of 1.1
- [x] 1.3 In the `e2e-run.mjs` test, compare the Playwright working folder by its real path (macOS reports `/private/var/...`)

## 2. Verification

- [x] 2.1 Run the `test-reviewer` subagent and fix blocker/major findings
- [x] 2.2 Run `npm test` and `node openspec/tooling/bin/doctor.mjs`; fix what fails
- [x] 2.3 Write `apply-report.md`, run `node openspec/tooling/checks/check-traceability.mjs --change fix-e2e-symlink-paths --markers` and `openspec validate fix-e2e-symlink-paths --strict`
