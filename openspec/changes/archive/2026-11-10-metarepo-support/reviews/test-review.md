# Test review — metarepo-support

Verdict: READY

Input: `node openspec/tooling/bin/review-input.mjs --change metarepo-support` (installed copy) listed all
94 planned scenarios, each with one marked test in `tests/metarepo.test.mjs`. No scenario was missing a test.
The marked tests were read in full, together with `tests/helpers/metarepo.mjs`, the delta specs and
`verification-plan.md`. `node --test tests/metarepo.test.mjs`: 112 tests, 112 pass, 0 skipped, 0 todo.

Summary: the assertions are strong. Most error scenarios compare the exact message with `deepEqual`, or with
a regex that holds the scenario, repository, file and line. Blocking scenarios assert exit code 2 together
with the message. Many pass scenarios have a control that turns the same setup into a failure: ignored file
vs tracked file, `markers-ignore` before and after, a marked vs unmarked change, a clone list present vs
removed, the e2e row removed for the dangerous scenario, and a nested repository at depth 3 that is offered.
The given data is built per test in a temporary meta-repository with real nested git repositories. The
hooks, checks, installer and health check run as processes against a copy of `kit/`. Nothing below is a
blocker or major.

| ID | Severity | Test | Scenario | Finding | Break it would miss | Suggested fix |
|---|---|---|---|---|---|---|
| T1 | minor | tests/metarepo.test.mjs:1265 | Single repository change archives as before | THEN is "decides exactly as kit 0.4 does". The blocked case only asserts that the error names `"Order is created"` and does not mention repositories or clones. The single-repository message itself is not pinned. | If the single-repository message changed wording, for example a meta-repository-style "no test in `root` …" phrased without the word "repository", the test still passes. | Also assert the 0.4 message, e.g. `/no test .*carries the marker for "Order is created"/`, and that `r.err` does not contain "in \`". |
| T2 | minor | tests/metarepo.test.mjs:360 | Row without a repository is reported | The spec says an *empty* Repository cell. The test writes `—`, not an empty cell. | A parser that treats `—` as empty but a truly blank cell as something else would pass this test. Mitigated: the tests at :374 and :304 use a blank cell and assert the same message. | Use `''` here, or test both `''` and `—`. |
| T3 | minor | tests/metarepo.test.mjs:981, :1005 | Editing a clone's proposal is blocked / Shell write to a clone's OpenSpec is blocked | The MultiEdit case and the five extra shell variants (`> ./…`, `tee -a`, `sed -i`, `cp`, `mv`, quoted path into `frontend`) assert only exit code 2, not the clone message. | A variant blocked by a different, unrelated rule (wrong message, or naming `backend` for the `frontend` path) would still pass. | Assert `CLONE_MSG` on the variants, and a `frontend` message for the quoted `repos/frontend/...` command. |
| T4 | minor | tests/metarepo.test.mjs:879 | One root command starts both clones | The spec names `mise run up` and `http://localhost:3000`. The test uses a stand-in shell command and a free port on 127.0.0.1. The substitution is reasonable: it proves cwd = root even when started from `repos/frontend`, that both clones are reached, and that the URL got status 200. Still, the literal command and URL of the scenario are not exercised. | Nothing material. A start-check that special-cased `localhost` hostnames would not be caught. | Acceptable as is. Optionally note the substitution in a comment or in the verification plan's test data. |
| T5 | minor | tests/metarepo.test.mjs:1403 | Doctor only prints without a terminal | The in-process `interactive: false` part only checks that nothing is asked. It does not check that the list is unchanged or that the line is printed. The process part above does check both. | If an in-process `runDoctor` with `interactive: false` wrote the line silently, this part would still pass. | Add `assert.equal(clonesText(root), before)` after the in-process call. |
| T6 | minor | tests/metarepo.test.mjs:195 | Large frontend clone with dependencies | The timing covers `collectMarkers` in process, not `check-traceability` or the archive-gate process that runs under the hook timeout. The scenario text ("the marked tests are collected") fits this. | A slowdown outside marker collection in the gate (per-clone git calls in check-e2e or check-tasks, for example) would not be measured. | Optional: also time `archive(root)` on the same tree against the same bound. |

## Human decision

<!-- Filled by the human when the verdict stays NOT-READY: which findings are accepted, why, by whom. -->
