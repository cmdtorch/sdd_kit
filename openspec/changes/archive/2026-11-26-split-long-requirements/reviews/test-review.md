# Test review — split-long-requirements

Verdict: READY

Scope: the change rewrites only the text of five MODIFIED requirements; all 28 scenarios are unchanged and each
still has exactly one marked test (from `review-input.mjs`). The marked tests assert behaviour of the kit (hook
exits and messages, `start-check.mjs` results and records, protocol and agent-definition text). They never assert
the requirement wording, so shortening it cannot weaken them. The question is whether every rule the shortened
text still states is backed by the scenarios' tests. It is: each kept rule maps to a scenario whose THEN is
asserted. The 7 test files with the markers pass on OpenSpec 2.2.0 (258 tests, 0 failed, 0 skipped).

Rule-by-rule check of the shortened text against the tests:

- `ui-sources/inventory` "Every element has a decision": an element with no decision or an unknown one blocks the
  next artifact and the archive, with a message naming the element and the allowed decisions. The hook tests
  check exit 2 and the stderr text: element name, `unknown decision "not yet defined"`, the list of five decisions,
  and the proposal, design and archive gates. The message before the proposal on 0.6.0 is checked against
  `planning.md` §8 and `ui-inventory.md`.
- `ui-sources/screenshots` "The AI asks whether the change has mockups": the Main round question and the `lean`
  chat question, "yes" creating `sources/ui/` with the formats named, the continue skill on older changes and the
  developer's word on 0.6.0+, and the second question on an empty folder are each asserted on the protocol text.
  The shorter wording ("asking once more") drops the content of the second question. The scenarios still state
  it, and the tests assert "wait … or continue without mockups".
- `workflow/autonomous-apply` "Stops that remain": every stop listed in the scenarios (requirement gap, two fix
  attempts, environment, outside the plan, test command) is asserted on `apply.md` §2. The stops for consent and
  the final consent list have no scenario in this requirement, before or after this change.
- `workflow/environment-check` "Start check at the beginning of apply": `start-check.mjs` runs as a real process
  against a real HTTP server. The tests check status 200 passes and the app is stopped again; 503 or no answer
  fails, with the record read back. The early-check skip (`--status` → `passed`) and the lean and skipped paths
  are asserted on `apply.md` §4 and the schema apply instructions.
- `workflow/subagent-apply` "Every code edit goes through a subagent": one subagent per review and per E2E run,
  `e2e-run.mjs` reruns, at most three attempts and the main agent's own files are each asserted on
  `subagents.md` §8, `e2e.md` §8 and the installed `task-implementer` definition.

| ID | Severity | Test | Scenario | Finding | Break it would miss | Suggested fix |
|---|---|---|---|---|---|---|
| T1 | minor | tests/autonomous-apply.test.mjs:467 | Application does not answer in time | The test passes `--timeout 2` / `1.5`, so the 2-minute default the requirement names (`args.timeout ?? 120` in `start-check.mjs`) is never exercised. This gap was already there before this change. | If the default timeout changed to 10 s, this test still passes. | Optional: a unit check of the default (for example a `--help` / usage text or a parsed-args helper) asserting 120 s. |
| T2 | minor | tests/planning-protocol.test.mjs:237 | Empty folder on continue is asked again | For the earlier-change path (`ui-inventory.md`), only "ask once more — wait … or continue without mockups" is asserted. "Before writing anything else" is asserted only for the 0.6.0+ path in `planning.md` §8. This gap was already there before this change. | If `ui-inventory.md` let the AI write the proposal before asking again, this test still passes. | Optional: also assert that the `ui-inventory.md` sentence forbids writing anything before the reply, if the text says so. |

No blocker or major findings. Both minor findings were there before this change and are not caused by the
shortened wording.

## Human decision

<!-- Filled by the human when the verdict stays NOT-READY: which findings are accepted, why, by whom. -->
