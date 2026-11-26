## ADDED Requirements

### Requirement: E2E runs use a limited number of workers
`e2e-run.mjs` SHALL run Playwright with two workers. The environment variable `E2E_WORKERS` SHALL replace that number, and a `--workers` or `-j` argument after `--` SHALL take precedence over both. An `E2E_WORKERS` value that is not a positive whole number or a percentage SHALL end the script with an error before Playwright starts.

#### Scenario: Two workers by default
- **GIVEN** a change in the E2E stage and no `E2E_WORKERS` variable
- **WHEN** `e2e-run.mjs --change <change>` runs
- **THEN** Playwright is started with the argument `--workers=2`

#### Scenario: Worker number from the environment
- **GIVEN** `E2E_WORKERS=4`
- **WHEN** `e2e-run.mjs --change <change>` runs
- **THEN** Playwright is started with `--workers=4` and without `--workers=2`

#### Scenario: Worker argument of the developer wins
- **GIVEN** `E2E_WORKERS=4`
- **WHEN** `e2e-run.mjs --change <change> -- --workers=1` runs
- **THEN** Playwright is started with `--workers=1` and with no other `--workers` argument

#### Scenario: Short worker argument wins
- **GIVEN** no `E2E_WORKERS` variable
- **WHEN** `e2e-run.mjs --change <change> -- -j 1` runs
- **THEN** Playwright is started with `-j 1` and with no `--workers` argument

#### Scenario: Invalid worker number is refused
- **GIVEN** `E2E_WORKERS=many`
- **WHEN** `e2e-run.mjs --change <change>` runs
- **THEN** it exits with a non-zero code and an error that names `E2E_WORKERS` and the value `many`, Playwright is not started and no run is recorded

### Requirement: A running application is reused
The Playwright configuration the AI writes SHALL reuse an application that already answers at the start address instead of starting a second one, and the AI SHALL NOT run the E2E tests at the same time as another test suite.

#### Scenario: Protocol config reuses the running application
- **GIVEN** the installed kit
- **WHEN** the Playwright configuration example of `openspec/protocols/e2e.md` is read
- **THEN** its `webServer` entry has `reuseExistingServer: true`

#### Scenario: Protocol forbids E2E beside another suite
- **GIVEN** the installed kit
- **WHEN** the section "Running the tests" of `openspec/protocols/e2e.md` is read
- **THEN** it says that the E2E tests never run at the same time as another test suite

### Requirement: Only the failing tests run while they are fixed
After the first full E2E run of a change, the AI SHALL rerun only the failing tests while they are fixed, and SHALL make one full run after they pass.

#### Scenario: Protocol limits reruns to the failing tests
- **GIVEN** the installed kit
- **WHEN** the section "Failing tests" of `openspec/protocols/e2e.md` is read
- **THEN** it says that while tests are fixed only the failing tests are run again, by file or by title, and that one full run follows when they pass
