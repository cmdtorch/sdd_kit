# Test review — streamline-planning

Verdict: READY

Input: `node openspec/tooling/bin/review-input.mjs --change streamline-planning` (113 scenarios, every one with at
least one marked test), `verification-plan.md`, and the marked tests in `tests/planning-protocol.test.mjs`,
`tests/planning-continue.test.mjs`, `tests/answers-lock.test.mjs`, `tests/hooks.test.mjs`, `tests/checks.test.mjs`,
`tests/qa-hooks.test.mjs`, `tests/ui-sources.test.mjs`, `tests/ui-hooks.test.mjs`, `tests/installer.test.mjs`.
These nine files ran with the pinned OpenSpec CLI 1.15.0: 383 pass, 0 fail, 0 skipped. Probes run from a scratch
copy (the tests were not edited) confirmed that the integration tests tell the cases apart. Example: in "Changed
answer ends the turn", the same `stop(active: true)` call without the changed answer gives `decision: block`, so
the test fails if the lock is ignored.

The scenarios about agent behaviour are planned as `unit` tests on the text of `planning.md`, the schema
instructions and `ui-inventory.md`. The tests match these rules closely: whole sentences with the scenario's
example values, each inside the right numbered section. They would fail if a rule were removed, reworded into
something else or moved out of its section. Every hook and check scenario is run against prepared files, and its
tests assert the exact block or report message (question id, round, artifact list), not just the exit code.

| ID | Severity | Test | Scenario | Finding | Break it would miss | Suggested fix |
|---|---|---|---|---|---|---|
| T1 | minor | tests/planning-continue.test.mjs:328 | Check still fails after two attempts | Only "the turn ends" is asserted. The THEN "the agent's message lists the remaining errors" is asserted in tests/planning-protocol.test.mjs:68, but that test carries the marker of "Check passes after a fix", not this one. | If the `planning.md` sentence "show the developer the remaining errors of the check" moved out of its test, this scenario would lose that THEN without any marked test noticing. | Add this scenario's marker above a text test that asserts the "show the developer the remaining errors" sentence, or split it out of the "Check passes after a fix" test. |
| T2 | minor | tests/planning-continue.test.mjs:270 | Write blocked by an open question is a wait | The gate message is checked only with `/Q2/`. The "not a failed check" half is not asserted on the message. | A gate message such as "check failed: Q2 …" would still pass. | Assert `/Q2 is not answered/` and `doesNotMatch(/check .*fail/i)` on `gate.stderr`. |
| T3 | minor | tests/planning-continue.test.mjs:129 | Technical round is prepared next | The reason is checked for `Technical round` and `clarifications.md`, but not for the change name ("of that change"). The sibling test at :114 does check it. | A reason that names the wrong change, or no change, would pass. | Add `assert.match(r.reason, new RegExp(\`"${CHANGE}"\`))`. |
| T4 | minor | tests/hooks.test.mjs:266, :275 | Older change still needs the confirmation; Test-case schema still needs the confirmation | Only the block is asserted. The "until the summary answer is `Looks correct`" half (the write goes through once confirmed) is not shown for a 0.5.0-stamped or `clarify-qa` change in the gate. | A gate that blocks a 0.5.0 or `clarify-qa` change even after `Looks correct` would pass these tests. Only the check-level test (checks.test.mjs:426) and the unstamped fixture cover the confirmed path. | Append the confirmed summary (`[Answer]: Looks correct`) and assert `writeProposal(root).code === 0`. |
| T5 | minor | tests/checks.test.mjs:454 | Recommendation in the file | The test proves only that check-answers accepts a `Recommended:` line. It does not check that the instruction places the line under the question's options, before `[Answer]:`. | If the `planning.md` §12 sentence "on its own line under the options of the question, before `[Answer]:`" were removed, no marked test would fail. :281 checks only the `Recommended: <letters> — <reason>` form. | Assert the "on its own line under the options of the question, before `[Answer]:`" sentence of §12 in this test, or in the text test of "Recommendation from the code". |
| T6 | minor | tests/qa-hooks.test.mjs:306, :365 | Unnamed schema is blocked; Unnamed schema through the wrapper is blocked | Planned as `integration`, but tested by calling the exported `gate` in-process, not by running the hook as a process with Claude Code stdin. | A broken stdin/exit-code wrapper in `schema-starter.mjs` (for example, exit 0 instead of 2 on a block) would pass. | Run `schema-starter.mjs` once with `spawnSync` and assert exit code 2 and the menu text on stderr, as the spec-reviewer run-limit tests do. |
| T7 | minor | tests/planning-protocol.test.mjs:230 | Yes without screenshots stops until continue | The THEN "`sources/ui/` exists" is matched only implicitly ("export … into it"). The instruction to create the folder is not asserted. | If the earlier-rules instruction dropped "create `sources/ui/`", the test would still pass. | Assert the earlier-rules sentence in `ui-inventory.md` that creates `sources/ui/`. |

## Human decision

<!-- Filled by the human when the verdict stays NOT-READY: which findings are accepted, why, by whom. -->
