# Spec review — metarepo-support

Verdict: READY

Re-review after the fixes for S1–S14 of the previous review and the Specs-round answers Q42 and Q43 (round
re-confirmed). All previous findings are resolved: the root E2E test closes only `e2e` rows and stage
scenarios/cases (Q42; e2e/spec.md:56, :63-66, test-discovery/spec.md:69), the terminal install asks the clone
paths and `update` asks nothing (Q43; clones/spec.md:135-149), the nested-repository offer never asks under
`--yes` or the installer and never changes "Ready." (:105, :124-127), the exception for marked changes (:64),
the first artifact that sets the key (:211), name characters, case and known-path conflicts (:10, :47-50,
:184-188), the list error in every check (:52-55), the shell write forms and the `cd` limit (:234), clone
folders excluded from `root` (test-discovery/spec.md:69), the answers-gate in a meta-repository (:76-87),
report section result/repeat/extra (apply/spec.md:54, :71-79), the E2E question as protocol content with
`lean` (e2e/spec.md:10-15), the observable empty-list scenario (:57-61), and the uninstall and "Ready."
checks (:195-208). No blocker or major is left; the findings below are minor.

| ID | Severity | Where | Finding | Evidence | Suggested action |
|---|---|---|---|---|---|
| S1 | minor | metarepo/clones › "Install and update set up a meta-repository without questions" | The terminal path flow (Q43) has only the happy scenario. Not stated: what happens when an entered path is invalid (outside the root, repeated, bad name) — the installer re-asks or stops; whether a path that does not exist on disk yet is accepted (it is not a list error, and mise may clone later); and that the answer "single repository" in a terminal creates no `openspec/clones` (only the `--yes` case has a scenario). The requirement title "without questions" no longer matches its body. | clones/spec.md:134-135, :141-144, :165-167; clarifications.md Q43 | Add "Invalid path in the terminal is asked again" (or "stops the installer"), "Path not yet on disk is accepted" (with the missing-clone warning), and "Terminal answer single repository creates no clone list"; rename the requirement to "Install and update set up a meta-repository". |
| S2 | minor | metarepo/clones › "Undeclared nested repositories are offered" | Doctor appends the bare path on "yes". If the folder name equals an existing clone name (`libs/backend` found while `repos/backend` is declared), the appended line makes the list invalid (repeated name). Not stated whether doctor offers `name=path`, asks for a name, or skips. | clones/spec.md:105, :10, :22-25 | Add a scenario "Offered folder whose name is taken" stating the printed/appended line (for example it is not offered as a bare path) and that the list stays valid. |
| S3 | minor | metarepo/apply › "Every task group names its repository" / "The full suite runs per touched repository" | The empty clone list makes every group name `root` (Q40), and a group that writes the root's `e2e/` tests names `root`; then the report needs `## Repository: root` with a `Command:` line, although D1 says the root has no tests of its own. Not said what the agent writes as the command when the root has no suite. Also the empty-list scenario covers plan rows only, not task groups. | apply/spec.md:10, :54; clones/spec.md:57-61; D1.md R6; clarifications.md Q40 | State what a `root` section holds when the root has no test command (for example `Command: none` with the reason), and add "Empty clone list: group without `[root]` is blocked". |
| S4 | minor | metarepo/test-discovery › "Search stays within the hook timeouts" | "less than 30 seconds" does not name the machine or whether the file system cache is warm, so the scenario can pass on one runner and fail on another. | test-discovery/spec.md:118-123 | Say it is measured on the CI runner of the kit's test suite, with a cold first run, or give a margin (for example under 15 seconds) that leaves room for slower machines. |
| S5 | minor | metarepo/clones › "Changes started before the switch keep their rules" | "with the kit version stamp" can be read as "write the stamp too" or "next to the existing stamp". | clones/spec.md:211 | Write "next to the kit version stamp the kit already writes". |
| S6 | minor | metarepo/clones › "Root changes keep their gates" | THEN "the write is blocked as in a single repository" refers to another behaviour instead of stating it. | clones/spec.md:82 | State the result: the write is blocked with the message that names the unanswered Main round question. |

## Developer decision

The developer chose to fix the six minor findings (S1–S6) in the specs without another review run. Fixed: terminal install answers and path rules (S1), a taken name offered as `<parent>-<folder>` (S2), the `root` report section and task groups with an empty clone list (S3), the machine for the time limit (S4), the stamp wording (S5), the gate message (S6).
