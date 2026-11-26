# Test review — upgrade-openspec-2

Verdict: READY

Run: the nine marked test files passed with OpenSpec 2.2.0 first on PATH and `OPENSPEC_BIN` unset (153 tests, 0 fail,
0 skipped), so every CLI-backed suite (`cliSkipReason()`) really ran.

| ID | Severity | Test | Scenario | Finding | Break it would miss | Suggested fix |
|---|---|---|---|---|---|---|
| T1 | minor | tests/opsx-names.test.mjs:32 | No `/opsx:` in installed kit files | The test installs with `skipOpenspec: true` into the pilot-like fixture, which already has `openspec/`. The plan asks for the real CLI and a fresh HOME/XDG_CONFIG_HOME. The THEN is still asserted on the set the scenario names: every manifest file (with a check that protocols, schemas, tooling and `.claude/` are present), `openspec/config.yaml` and `.claude/settings.json`, by exact match on `/\/opsx:/`. I ran both installs by hand with 2.2.0. The kit files, `config.yaml` and `settings.json` came out byte-identical. The only difference is the skills OpenSpec writes, and the scenario does not count those as kit files. A fresh-project install with the real CLI (`openspec init`, then `update`) also gave no match. So no THEN goes unasserted, but the code path that runs only with the CLI is never checked: `openspec init` writes the base of `config.yaml` (`willInitOpenspec`, a deferred config plan), and `openspec update` runs after the kit files are written. | Suppose a later pin ships an `openspec init` config template that names `/opsx:` in a comment, or the kit's post-init config merge adds such a line. The test still passes, because it never runs `init` or `update`. | Run this test under `cliSkipReason()` against a fresh git project without `openspec/`, with HOME and XDG_CONFIG_HOME isolated as in `tests/openspec-cli-install.test.mjs`. Or keep the fast variant and add one CLI-backed case. Or record the deviation in `verification-plan.md`. |
| T2 | minor | tests/openspec-cli-install.test.mjs:151 | Update with an older OpenSpec is refused | The GIVEN is "a project with kit 0.7.0". The setup is a current-kit install, so the project's `kit.json` already pins 2.2.0. The refusal does not depend on the old `kit.json`, so the THEN (non-zero exit, unchanged snapshot, install hint) is asserted correctly. | Suppose the version check were skipped only when the old `kit.json` names 1.x, for example by sharing a branch with the active-changes message. This test would not notice. | Build the project with `project070()` from `tests/openspec-cli-update.test.mjs` (old `kit.json` pinned to 1.15.0). |
| T3 | minor | tests/delta-specs.test.mjs:74–224 | Error scenarios of checks/delta-specs ("... and exits non-zero") | The tests call `checkSpecs()` and assert `ok === false` plus the exact error message. The non-zero exit comes from the shared `runCli` wrapper and is not asserted here. | If `runCli` stopped mapping `ok: false` to exit code 1, these tests would still pass. Other check tests probably cover the shared wrapper. | Add one CLI run (`node check-specs.mjs --change add-export`) for the missing-WHEN case and assert status 1 and the message. |

All other marked tests assert every THEN / AND on observable outcomes with specific values:

- the refusal snapshot excludes only `.git`;
- `kit.json` is checked for `openspecVersion: '2.2.0'`;
- every kit-profile skill is checked for its `SKILL.md`, its link realpath and the absence of `openspec-propose`;
- the home folders are snapshotted with `XDG_CONFIG_HOME` unset;
- the index modes are checked as `120000` for the links;
- the fake CLI's call log proves that the dry run ran or did not run;
- the doctor's `level`, `message` and `fix` fields are asserted;
- the session-start context is checked against exact warning text.

The doctor Node scenarios inject the version, as the plan says. The protocol-text tests (`planning-protocol`, `apply-protocol`) match the full rule sentences with the new skill names. Nothing is skipped or marked as an expected failure.

## Human decision

<!-- Filled by the human when the verdict stays NOT-READY: which findings are accepted, why, by whom. -->
