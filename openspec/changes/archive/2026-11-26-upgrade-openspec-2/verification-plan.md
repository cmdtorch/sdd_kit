# Verification Plan

## Scenario coverage

| Capability | Requirement | Scenario | Level | Critical | Test data / setup | Manual reason |
|---|---|---|---|---|---|---|
| kit/openspec-cli | The kit is pinned to OpenSpec 2.2.0 | Install with an older OpenSpec is refused | integration | no | temporary git project; OpenSpec 2.2.0 through OPENSPEC_BIN; HOME and XDG_CONFIG_HOME set to fresh temporary folders | — |
| kit/openspec-cli | The kit is pinned to OpenSpec 2.2.0 | Update with an older OpenSpec is refused | integration | no | temporary git project; OpenSpec 2.2.0 through OPENSPEC_BIN; HOME and XDG_CONFIG_HOME set to fresh temporary folders | — |
| kit/openspec-cli | The kit is pinned to OpenSpec 2.2.0 | Install with the pinned OpenSpec goes on | integration | no | temporary git project; OpenSpec 2.2.0 through OPENSPEC_BIN; HOME and XDG_CONFIG_HOME set to fresh temporary folders | — |
| kit/openspec-cli | OpenSpec skills are installed into the project | New project gets the kit profile skills in the project | integration | yes | temporary git project; OpenSpec 2.2.0 through OPENSPEC_BIN; HOME and XDG_CONFIG_HOME set to fresh temporary folders | — |
| kit/openspec-cli | OpenSpec skills are installed into the project | Nothing is written outside the project | integration | yes | temporary git project; OpenSpec 2.2.0 through OPENSPEC_BIN; HOME and XDG_CONFIG_HOME set to fresh temporary folders | — |
| kit/openspec-cli | OpenSpec skills are installed into the project | Update of a project installed with OpenSpec 1.15.0 moves the skills | integration | yes | temporary git project; OpenSpec 2.2.0 through OPENSPEC_BIN; HOME and XDG_CONFIG_HOME set to fresh temporary folders | — |
| kit/openspec-cli | The project's skills are versioned | Skill links are tracked when `.claude/` was ignored | integration | yes | temporary git project; OpenSpec 2.2.0 through OPENSPEC_BIN; HOME and XDG_CONFIG_HOME set to fresh temporary folders | — |
| kit/openspec-cli | The project's skills are versioned | Update of a 0.7.0 project tracks the links | integration | yes | temporary git project; OpenSpec 2.2.0 through OPENSPEC_BIN; HOME and XDG_CONFIG_HOME set to fresh temporary folders | — |
| kit/openspec-cli | The project's skills are versioned | Other forms of the whole-`.agents/` line are commented out | integration | no | temporary git project; OpenSpec 2.2.0 through OPENSPEC_BIN; HOME and XDG_CONFIG_HOME set to fresh temporary folders | — |
| kit/openspec-cli | The project's skills are versioned | A whole-`.agents/` ignore line is commented out | integration | no | temporary git project; OpenSpec 2.2.0 through OPENSPEC_BIN; HOME and XDG_CONFIG_HOME set to fresh temporary folders | — |
| kit/openspec-cli | The project's skills are versioned | Uninstall restores the `.agents/` line | integration | no | temporary git project; OpenSpec 2.2.0 through OPENSPEC_BIN; HOME and XDG_CONFIG_HOME set to fresh temporary folders | — |
| kit/openspec-cli | The router skill is kept as OpenSpec ships it | Router skill is not reported as drift | integration | no | temporary git project; OpenSpec 2.2.0 through OPENSPEC_BIN; HOME and XDG_CONFIG_HOME set to fresh temporary folders | — |
| kit/openspec-cli | The kit needs Node 22.12 or newer | Node 20 is an error | unit | no | temporary git project; OpenSpec 2.2.0 through OPENSPEC_BIN; HOME and XDG_CONFIG_HOME set to fresh temporary folders | — |
| kit/openspec-cli | The kit needs Node 22.12 or newer | Node 22.12.0 is accepted | unit | no | temporary git project; OpenSpec 2.2.0 through OPENSPEC_BIN; HOME and XDG_CONFIG_HOME set to fresh temporary folders | — |
| kit/openspec-cli | The kit needs Node 22.12 or newer | Node 22.11 is an error | unit | no | temporary git project; OpenSpec 2.2.0 through OPENSPEC_BIN; HOME and XDG_CONFIG_HOME set to fresh temporary folders | — |
| kit/openspec-cli | Update names the active changes | Active changes are listed and the update completes | integration | no | temporary git project; OpenSpec 2.2.0 through OPENSPEC_BIN; HOME and XDG_CONFIG_HOME set to fresh temporary folders | — |
| kit/openspec-cli | Update names the active changes | No active changes, no message | integration | no | temporary git project; OpenSpec 2.2.0 through OPENSPEC_BIN; HOME and XDG_CONFIG_HOME set to fresh temporary folders | — |
| kit/openspec-cli | Update names the active changes | A later update does not repeat the message | integration | no | temporary git project; OpenSpec 2.2.0 through OPENSPEC_BIN; HOME and XDG_CONFIG_HOME set to fresh temporary folders | — |
| kit/openspec-cli | Skill drift is found with OpenSpec's own dry run | A missing skill is reported by doctor | integration | no | temporary git project; OpenSpec 2.2.0 through OPENSPEC_BIN; HOME and XDG_CONFIG_HOME set to fresh temporary folders | — |
| kit/openspec-cli | Skill drift is found with OpenSpec's own dry run | A missing skill is reported at session start | integration | no | temporary git project; OpenSpec 2.2.0 through OPENSPEC_BIN; HOME and XDG_CONFIG_HOME set to fresh temporary folders | — |
| kit/openspec-cli | Skill drift is found with OpenSpec's own dry run | No drift, no warning | integration | no | temporary git project; OpenSpec 2.2.0 through OPENSPEC_BIN; HOME and XDG_CONFIG_HOME set to fresh temporary folders | — |
| kit/openspec-cli | Skill drift is found with OpenSpec's own dry run | Another CLI version falls back to the file check | integration | no | temporary git project; OpenSpec 2.2.0 through OPENSPEC_BIN; HOME and XDG_CONFIG_HOME set to fresh temporary folders | — |
| kit/openspec-cli | Skill drift is found with OpenSpec's own dry run | Session start falls back to the file check with another CLI version | integration | no | temporary git project; OpenSpec 2.2.0 through OPENSPEC_BIN; HOME and XDG_CONFIG_HOME set to fresh temporary folders | — |
| kit/openspec-cli | Skill drift is found with OpenSpec's own dry run | A missing CLI falls back to the file check | unit | no | temporary git project; OpenSpec 2.2.0 through OPENSPEC_BIN; HOME and XDG_CONFIG_HOME set to fresh temporary folders | — |
| kit/openspec-cli | Skill drift is found with OpenSpec's own dry run | A failed dry run in doctor is a warning | unit | no | temporary git project; OpenSpec 2.2.0 through OPENSPEC_BIN; HOME and XDG_CONFIG_HOME set to fresh temporary folders | — |
| kit/openspec-cli | Skill drift is found with OpenSpec's own dry run | A failed dry run is a warning | unit | no | temporary git project; OpenSpec 2.2.0 through OPENSPEC_BIN; HOME and XDG_CONFIG_HOME set to fresh temporary folders | — |
| kit/openspec-cli | Leftover `/opsx` command files are reported | An edited command file is left behind | integration | no | temporary git project; OpenSpec 2.2.0 through OPENSPEC_BIN; HOME and XDG_CONFIG_HOME set to fresh temporary folders | — |
| kit/openspec-cli | Leftover `/opsx` command files are reported | No command files, no warning | integration | no | temporary git project; OpenSpec 2.2.0 through OPENSPEC_BIN; HOME and XDG_CONFIG_HOME set to fresh temporary folders | — |
| kit/openspec-cli | Kit texts name the OpenSpec skills | No `/opsx:` in installed kit files | integration | yes | temporary git project; OpenSpec 2.2.0 through OPENSPEC_BIN; HOME and XDG_CONFIG_HOME set to fresh temporary folders | — |
| kit/openspec-cli | Kit texts name the OpenSpec skills | No `/opsx:` in the installer output | integration | no | temporary git project; OpenSpec 2.2.0 through OPENSPEC_BIN; HOME and XDG_CONFIG_HOME set to fresh temporary folders | — |
| kit/openspec-cli | Kit texts name the OpenSpec skills | The starter hook names the new-change skill | integration | no | temporary git project; OpenSpec 2.2.0 through OPENSPEC_BIN; HOME and XDG_CONFIG_HOME set to fresh temporary folders | — |
| checks/delta-specs | Every scenario has a trigger step and an outcome step | A scenario without WHEN or GIVEN is an error | unit | yes | fixture change folders with .openspec.yaml stamps 0.8.0 / 0.7.0 / none and main specs of given requirement lengths | — |
| checks/delta-specs | Every scenario has a trigger step and an outcome step | A scenario without THEN is an error | unit | no | fixture change folders with .openspec.yaml stamps 0.8.0 / 0.7.0 / none and main specs of given requirement lengths | — |
| checks/delta-specs | Every scenario has a trigger step and an outcome step | GIVEN counts as the trigger step | unit | no | fixture change folders with .openspec.yaml stamps 0.8.0 / 0.7.0 / none and main specs of given requirement lengths | — |
| checks/delta-specs | Every scenario has a trigger step and an outcome step | A keyword only in the name or in a fence does not count | unit | no | fixture change folders with .openspec.yaml stamps 0.8.0 / 0.7.0 / none and main specs of given requirement lengths | — |
| checks/delta-specs | Every scenario has a trigger step and an outcome step | A bare upper-case keyword inside a line counts | unit | no | fixture change folders with .openspec.yaml stamps 0.8.0 / 0.7.0 / none and main specs of given requirement lengths | — |
| checks/delta-specs | Every scenario has a trigger step and an outcome step | A lower-case bare keyword does not count | unit | no | fixture change folders with .openspec.yaml stamps 0.8.0 / 0.7.0 / none and main specs of given requirement lengths | — |
| checks/delta-specs | Every scenario has a trigger step and an outcome step | An earlier change only gets a warning | unit | no | fixture change folders with .openspec.yaml stamps 0.8.0 / 0.7.0 / none and main specs of given requirement lengths | — |
| checks/delta-specs | Every scenario has a trigger step and an outcome step | The error blocks the next artifact | unit | no | fixture change folders with .openspec.yaml stamps 0.8.0 / 0.7.0 / none and main specs of given requirement lengths | — |
| checks/delta-specs | Every scenario has a trigger step and an outcome step | An unstamped change only gets a warning | unit | no | fixture change folders with .openspec.yaml stamps 0.8.0 / 0.7.0 / none and main specs of given requirement lengths | — |
| checks/delta-specs | A MODIFIED requirement may not grow past 500 characters | Crossing the limit is an error | unit | no | fixture change folders with .openspec.yaml stamps 0.8.0 / 0.7.0 / none and main specs of given requirement lengths | — |
| checks/delta-specs | A MODIFIED requirement may not grow past 500 characters | An already long requirement that grows is an error | unit | yes | fixture change folders with .openspec.yaml stamps 0.8.0 / 0.7.0 / none and main specs of given requirement lengths | — |
| checks/delta-specs | A MODIFIED requirement may not grow past 500 characters | An already long requirement that does not grow only warns | unit | no | fixture change folders with .openspec.yaml stamps 0.8.0 / 0.7.0 / none and main specs of given requirement lengths | — |
| checks/delta-specs | A MODIFIED requirement may not grow past 500 characters | Exactly 500 characters passes | unit | no | fixture change folders with .openspec.yaml stamps 0.8.0 / 0.7.0 / none and main specs of given requirement lengths | — |
| checks/delta-specs | A MODIFIED requirement may not grow past 500 characters | An earlier change that grows past the limit only warns | unit | no | fixture change folders with .openspec.yaml stamps 0.8.0 / 0.7.0 / none and main specs of given requirement lengths | — |
| checks/delta-specs | A MODIFIED requirement may not grow past 500 characters | An already long requirement of the same length only warns | unit | no | fixture change folders with .openspec.yaml stamps 0.8.0 / 0.7.0 / none and main specs of given requirement lengths | — |
| checks/delta-specs | A MODIFIED requirement may not grow past 500 characters | One character over the limit is an error | unit | no | fixture change folders with .openspec.yaml stamps 0.8.0 / 0.7.0 / none and main specs of given requirement lengths | — |
| checks/delta-specs | A MODIFIED requirement may not grow past 500 characters | A requirement missing from the main spec only warns | unit | no | fixture change folders with .openspec.yaml stamps 0.8.0 / 0.7.0 / none and main specs of given requirement lengths | — |
| workflow/planning-flow | Planning starts and resumes without `/opsx:continue` | First artifact follows the creation | unit | no | protocol, schema and hook texts of the kit | — |
| workflow/planning-flow | Planning starts and resumes without `/opsx:continue` | Developer still runs the command | unit | no | protocol, schema and hook texts of the kit | — |
| workflow/planning-flow | The end of planning recommends a new chat for apply | Planning is complete | unit | no | protocol, schema and hook texts of the kit | — |
| workflow/autonomous-apply | Ready message | Change ready to archive | unit | no | apply protocol text of the kit | — |
| ui-sources/screenshots | The AI asks whether the change has mockups | Yes without screenshots stops until continue | unit | no | protocol and schema texts of the kit | — |
| ui-sources/screenshots | The AI asks whether the change has mockups | Empty folder on continue is asked again | unit | no | protocol and schema texts of the kit | — |
| ui-sources/screenshots | The AI asks whether the change has mockups | Lean asks about mockups before the proposal | unit | no | protocol and schema texts of the kit | — |
| ui-sources/screenshots | The AI asks whether the change has mockups | Yes on a new change waits for the developer's word | unit | no | protocol and schema texts of the kit | — |
| ui-sources/screenshots | The AI asks whether the change has mockups | Screenshots in place on a new change | unit | no | protocol and schema texts of the kit | — |
| ui-sources/screenshots | The AI asks whether the change has mockups | Done with an empty folder on a new change | unit | no | protocol and schema texts of the kit | — |

## Exclusions

None.

## Requirement trace

| Capability | Requirement | Sources |
|---|---|---|
| kit/openspec-cli | The kit is pinned to OpenSpec 2.2.0 | [desc] |
| kit/openspec-cli | OpenSpec skills are installed into the project | [Q3] |
| kit/openspec-cli | The project's skills are versioned | [Q4] [Q12] |
| kit/openspec-cli | The router skill is kept as OpenSpec ships it | [Q5] |
| kit/openspec-cli | The kit needs Node 22.12 or newer | [Q6] |
| kit/openspec-cli | Update names the active changes | [Q7] |
| kit/openspec-cli | Skill drift is found with OpenSpec's own dry run | [Q8] [Q11] |
| kit/openspec-cli | Leftover `/opsx` command files are reported | [Q13] |
| kit/openspec-cli | Kit texts name the OpenSpec skills | [Q2] |
| checks/delta-specs | Every scenario has a trigger step and an outcome step | [Q8] [Q9] |
| checks/delta-specs | A MODIFIED requirement may not grow past 500 characters | [Q8] [Q15] (narrows [Q10]) |
| workflow/planning-flow | Planning starts and resumes without `/opsx:continue` | [Q2] |
| workflow/planning-flow | The end of planning recommends a new chat for apply | [Q2] |
| workflow/autonomous-apply | Ready message | [Q2] |
| ui-sources/screenshots | The AI asks whether the change has mockups | [Q2] [Q1] |

## Environment

- OpenSpec 2.2.0 for the tests: installed into a scratch folder and passed through `OPENSPEC_BIN`; the installed copy of this repository keeps running 1.15.0 until the change is archived (design decision 11). After the archive and the refresh, `npm i -g @fission-ai/openspec@2.2.0`.
- Node 22.12 or newer for the full suite (the OpenSpec 2.2.0 npm package needs it); the Node scenarios of `doctor` inject the version instead of switching Node.
- Integration tests run the real CLI in temporary git projects with `HOME` and `XDG_CONFIG_HOME` pointed at fresh temporary folders, so nothing outside the test folder is read or written.
- The modified `workflow/planning-flow`, `workflow/autonomous-apply` and `ui-sources/screenshots` scenarios keep their existing tests (`tests/planning-protocol.test.mjs`, `tests/apply-protocol.test.mjs`) with the command names updated.
- Assumed without a question: the critical scenarios are the project-scope install, nothing written outside the project, the update of a 1.15.0 project, the versioned links, the two blocking `check-specs` rules and the absence of `/opsx:` in installed files; the CI run on Node 22 and 24 (Q14) is the environment check for the Node minimum; no scenario needs a manual check.
- Running application: no
