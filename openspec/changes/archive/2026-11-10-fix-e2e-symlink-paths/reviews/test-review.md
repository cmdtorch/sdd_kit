# Test review — fix-e2e-symlink-paths

Verdict: READY

Both marked tests call `parsePlaywrightReport` directly (planned level: unit) and assert the exact recorded file
path. I checked them against the code: with the `kit/openspec/tooling/lib/e2e-runs.mjs` change stashed, the
symlink test fails and the outside-file test still passes. That is expected, because the second scenario
guards against a regression in the fallback branch.

| ID | Severity | Test | Scenario | Finding | Break it would miss | Suggested fix |
|---|---|---|---|---|---|---|
| T1 | minor | tests/e2e-stage.test.mjs:368 | File outside the project keeps its relative path | `base` is resolved with `realpathSync`, so the root and the file have no symlink between them. The plain relative path and the real-path relative path are the same here, so the test never shows which one `projectRelative` returns for a file outside the project. | If `projectRelative` returned `relative(real(root), real(abs))` for outside files instead of `plain`, a project opened through a symlink (macOS `/var` → `/private/var`) could record a different `../` path, and this test would still pass. | Optional. Add a case where the root goes through a symlink and the file lies outside the project, and assert the exact `../` path you expect. |
| T2 | minor | tests/e2e-stage.test.mjs:354, :368 | both | The WHEN is "the run is recorded", but the tests stop at `parsePlaywrightReport` and never check what `e2e-run.mjs` writes. | If `e2e-run.mjs` changed the file paths after parsing, these tests would not notice. Existing `e2e-run.mjs` tests cover the hand-off. | None needed. This matches the planned unit level. |

## Human decision

<!-- Filled by the human when the verdict stays NOT-READY: which findings are accepted, why, by whom. -->
