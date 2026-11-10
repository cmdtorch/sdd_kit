# Proposal

## Why

On macOS the CI of the 0.4.0 release fails four E2E tests. Playwright reports test files by their real path (`/private/var/...`) while the kit computes paths from the project root as given (`/var/...`, a symlink). `e2e-run.mjs` then records a test file as `../../../../private/var/.../e2e/x.spec.ts` instead of `e2e/x.spec.ts`. The archive gate cannot match a recorded result to its test file. Every project whose path goes through a symlink is affected: a symlinked home or work folder, or the macOS temp folder.

## What Changes

- `parsePlaywrightReport` (`kit/openspec/tooling/lib/e2e-runs.mjs`) makes a test file path project-relative even when the project root and the reported file reach the same folder through different paths (one through a symlink). When the plain relative path leaves the project, both sides are resolved to their real paths and compared again.
- The test of `e2e-run.mjs` compares the folder Playwright ran in by its real path. A child process reports its working folder resolved, so on macOS the expected `/var/...` never equals the reported `/private/var/...`.
- Regression test: a project reached through a symlinked folder, with Playwright reporting the real path.

## Capabilities

### New Capabilities

### Modified Capabilities
- `e2e/stage`: a new requirement that recorded runs name each test file by its project-relative path, also when the project path goes through a symlink.

## Impact

- `kit/openspec/tooling/lib/e2e-runs.mjs`: path handling in `parsePlaywrightReport`.
- `tests/e2e-stage.test.mjs`: one assertion fixed, one regression test added.
- No change to file formats, gates or commands. Runs already recorded with a `../` path stay unmatched until the next run.

## Clarifications

- UI mockups: not asked. The change fixes a path computation in a command-line tool and has no UI.
