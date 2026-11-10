# Verification Plan

## Scenario coverage

| Capability | Requirement | Scenario | Level | Critical | Test data / setup | Manual reason |
|---|---|---|---|---|---|---|
| e2e/stage | Recorded runs name test files by their project path | Project path through a symlink | unit | yes | a temp project and a symlink to it; a Playwright JSON report whose file path is the real path | — |
| e2e/stage | Recorded runs name test files by their project path | File outside the project keeps its relative path | unit | no | a Playwright JSON report naming a file in a sibling folder of the project | — |

## Exclusions

| Capability | Scenario | Reason |
|---|---|---|
| None. | | |

## Requirement trace

| Capability | Requirement | Sources |
|---|---|---|
| e2e/stage | Recorded runs name test files by their project path | [desc] |

## Environment

- No services. The tests call `parsePlaywrightReport` directly. The existing `e2e-run.mjs` tests run on Linux and, in CI, on macOS, where the temp folder is a symlink.

- Running application: no
