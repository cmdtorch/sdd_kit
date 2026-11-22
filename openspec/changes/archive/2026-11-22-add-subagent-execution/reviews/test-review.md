# Test review — add-subagent-execution

Verdict: READY

Round 2. Scope: the marked tests in `tests/subagents.test.mjs`, `tests/subagents-protocol.test.mjs`,
`tests/schemas.test.mjs` and `tests/apply-protocol.test.mjs` (136 tests in these four files, all pass, none skipped
or todo). The scenarios planned as `manual` (agent behaviour in a real session) are checked in the pilot. Their
`unit` part is a text test of the kit: the rule must be stated where the agent reads it. The text tests match the
exact sentence of the rule, with the scenario's concrete values, in the right section. `section(n)` fails when the
section is missing. The process tests (model setting, doctor, kit update, check-tasks, check-apply-report) assert
exact stdout, stderr, exit codes and findings.

What happened to the round 1 findings:

- **T1 (major), fixed.** The markers for "Change stamped by an older kit", "Change without a stamp" and "Older change
  verified by the main agent" (tests/subagents.test.mjs:87, :94, :104) now sit on tests of the text the agent acts
  on. Each asserts the intro sentence "A change without the stamp, or stamped below 0.5.0, is implemented and
  verified as before: by the main agent alone, without implementation, full-suite or verify subagents", plus
  "On older or unstamped changes you implement and verify yourself, as before" in all four schemas. The older-kit
  test also asserts the pre-release rule. The verify test also asserts the §10 sentence. The `usesSubagents()`
  helper tests are no longer marked.
- **T2, fixed.** The "Groups sharing ports" test (subagents-protocol.test.mjs:137) now asserts "must not overlap in
  time". It also asserts the fixed-port example in the same sentence as "run such groups one after another".
- **T3, fixed.** The "Reading subagent proposes a decision" test (:348) now asserts the ban on writing or editing a
  planning artifact.
- **T4, fixed.** The "Missing subagent record does not block" test (apply-protocol.test.mjs:269) now runs with stamps
  `0.5.0` and the current kit version, and asserts exit code 0 for the odd-section case.
- **T5, fixed.** The "Verify subagent changes nothing" test (subagents-protocol.test.mjs:402) now asserts "Run only
  commands that read or test".

| ID | Severity | Test | Scenario | Finding | Break it would miss | Suggested fix |
|---|---|---|---|---|---|---|
| T6 | minor | verification-plan.md rows 17, 18, 96 | Change stamped by an older kit; Change without a stamp; Older change verified by the main agent | The plan rows still name "version helper" as what the test is given, and the level is still `integration`. The tests are now text tests of the protocol and the schemas. `usesSubagents()` in `lib/project.mjs:190` is still called by nothing in the kit. It is tested without a marker. | Nothing breaks in the tests. A reader of the plan gets a wrong idea of what proves these scenarios. The dead helper can drift from the text rule, and no test would notice. | Update the three plan rows: level `unit`, and given data like "protocol intro, §10 and four schema apply instructions read by the test". Either remove `usesSubagents()` or use it in a tool the agent runs. |

## Human decision

<!-- Filled by the human when the verdict stays NOT-READY: which findings are accepted, why, by whom. -->
