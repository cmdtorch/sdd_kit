# checks/delta-specs Specification

## Purpose
The kit's own checks of a change's delta specs (`check-specs`), so a spec that `openspec validate --strict` would
fail is caught while the spec is written, not after the merge.

## Requirements

### Requirement: Every scenario has a trigger step and an outcome step
`check-specs` SHALL report a scenario whose body lines, outside fenced code, have no WHEN or GIVEN step or no THEN step, as `openspec validate` 2.2.0 reads them: the keyword in bold in any case, with or without a colon (`**When**`, `**GIVEN:**`), or a bare upper-case word anywhere in a line (`WHEN`). The scenario's name does not count. On a change stamped 0.8.0 or later the finding is an error; on an earlier or unstamped change it is a warning.

#### Scenario: A scenario without WHEN or GIVEN is an error
- **GIVEN** a `clarify` change stamped 0.8.0 whose delta has a scenario with only `- **THEN** the export file is created`
- **WHEN** `node openspec/tooling/checks/check-specs.mjs --change <name>` runs
- **THEN** it reports an error naming that scenario and the missing WHEN/GIVEN step, and exits non-zero

#### Scenario: A scenario without THEN is an error
- **GIVEN** a `clarify` change stamped 0.8.0 whose delta has a scenario with only `- **WHEN** the user exports`
- **WHEN** `check-specs` runs on it
- **THEN** it reports an error naming that scenario and the missing THEN step, and exits non-zero

#### Scenario: GIVEN counts as the trigger step
- **GIVEN** a `clarify` change stamped 0.8.0 whose scenario has `- **GIVEN** an empty cart` and `- **THEN** the total is 0`
- **WHEN** `check-specs` runs on it
- **THEN** it reports nothing about that scenario's steps

#### Scenario: A keyword only in the name or in a fence does not count
- **GIVEN** a `clarify` change stamped 0.8.0 with the scenario `#### Scenario: What happens WHEN it fails`, whose body has `- **THEN** an error is shown` and a fenced block holding `WHEN x`
- **WHEN** `check-specs` runs on it
- **THEN** it reports an error for the missing WHEN/GIVEN step, and exits non-zero

#### Scenario: A bare upper-case keyword inside a line counts
- **GIVEN** a `clarify` change stamped 0.8.0 whose scenario has the single line `- **THEN** the import fails WHEN the file is empty`
- **WHEN** `check-specs` runs on it
- **THEN** it reports nothing about that scenario's steps

#### Scenario: A lower-case bare keyword does not count
- **GIVEN** a `clarify` change stamped 0.8.0 whose scenario has `- when the user exports` and `- **THEN** a file is created`
- **WHEN** `check-specs` runs on it
- **THEN** it reports an error for the missing WHEN/GIVEN step, and exits non-zero

#### Scenario: An earlier change only gets a warning
- **GIVEN** a `clarify` change stamped 0.7.0 whose delta has a scenario with only `- **THEN** the export file is created`
- **WHEN** `check-specs` runs on it
- **THEN** it reports a warning, not an error, for the missing WHEN/GIVEN step

#### Scenario: The error blocks the next artifact
- **GIVEN** a `clarify` change stamped 0.8.0 whose delta has a scenario with only `- **THEN** the export file is created`
- **WHEN** the agent writes `design.md`
- **THEN** the artifact feedback reports the error, and planning does not go on to the next artifact until the scenario is fixed

#### Scenario: An unstamped change only gets a warning
- **GIVEN** a `clarify` change without `x-sdd-kit` whose delta has a scenario with only `- **WHEN** the user exports`
- **WHEN** `check-specs` runs on it
- **THEN** it reports a warning, not an error, for the missing THEN step

### Requirement: A MODIFIED requirement may not grow past 500 characters
`check-specs` SHALL measure a MODIFIED requirement's text (its description between the header and the first scenario, as `openspec validate` measures it) against the same requirement in the main spec. Text over 500 characters and longer than the main spec's is an error on a change stamped 0.8.0 or later and a warning on an earlier or unstamped one. Text over 500 characters but not longer than the main spec's, or with no such requirement in the main spec, is a warning.

#### Scenario: Crossing the limit is an error
- **GIVEN** a main-spec requirement of 480 characters and a change stamped 0.8.0 that modifies it to 520 characters
- **WHEN** `check-specs` runs on the change
- **THEN** it reports an error naming the requirement and 520 characters, and exits non-zero

#### Scenario: An already long requirement that grows is an error
- **GIVEN** a main-spec requirement of 600 characters and a change stamped 0.8.0 that modifies it to 610 characters
- **WHEN** `check-specs` runs on the change
- **THEN** it reports an error naming the requirement and 610 characters, and exits non-zero

#### Scenario: An already long requirement that does not grow only warns
- **GIVEN** a main-spec requirement of 600 characters and a change stamped 0.8.0 that modifies it to 590 characters
- **WHEN** `check-specs` runs on the change
- **THEN** it reports a warning, not an error, naming the requirement

#### Scenario: Exactly 500 characters passes
- **GIVEN** a main-spec requirement of 480 characters and a change stamped 0.8.0 that modifies it to exactly 500 characters
- **WHEN** `check-specs` runs on the change
- **THEN** it reports nothing about that requirement's length

#### Scenario: An earlier change that grows past the limit only warns
- **GIVEN** a main-spec requirement of 480 characters and a change stamped 0.7.0 that modifies it to 520 characters
- **WHEN** `check-specs` runs on the change
- **THEN** it reports a warning, not an error, naming the requirement

#### Scenario: An already long requirement of the same length only warns
- **GIVEN** a main-spec requirement of 600 characters and a change stamped 0.8.0 that modifies its wording to another 600 characters
- **WHEN** `check-specs` runs on the change
- **THEN** it reports a warning, not an error, naming the requirement

#### Scenario: One character over the limit is an error
- **GIVEN** a main-spec requirement of 480 characters and a change stamped 0.8.0 that modifies it to 501 characters
- **WHEN** `check-specs` runs on the change
- **THEN** it reports an error naming the requirement and 501 characters, and exits non-zero

#### Scenario: A requirement missing from the main spec only warns
- **GIVEN** a change stamped 0.8.0 whose MODIFIED requirement of 520 characters has no requirement of that name in the main spec
- **WHEN** `check-specs` runs on the change
- **THEN** it reports a warning, not an error, about that requirement's length
