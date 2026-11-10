## ADDED Requirements

### Requirement: Recorded runs name test files by their project path
Every test that `e2e-run.mjs` records SHALL name its file by its path relative to the project root, with forward slashes. This SHALL hold also when the project root and the file path Playwright reports reach the same folder through different paths, for example when one of them goes through a symlink.

#### Scenario: Project path through a symlink
- **GIVEN** a project opened through a symlinked folder and a Playwright report that names the test file `e2e/two-sales.spec.ts` by its real path
- **WHEN** the run is recorded
- **THEN** the recorded test names the file `e2e/two-sales.spec.ts`

#### Scenario: File outside the project keeps its relative path
- **GIVEN** a Playwright report that names a test file outside the project folder
- **WHEN** the run is recorded
- **THEN** the recorded file path starts with `../`
