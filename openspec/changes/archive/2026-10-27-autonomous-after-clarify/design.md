# Design

## Context

Today the apply instruction of the four kit schemas ends with "list the manual checks for the developer", `testing.md` lets a hard-to-test scenario become `manual`, and the archive gate requires every task to be checked, so a "verify by hand" task blocks the archive [D1]. The kit never runs the project, except the E2E tests through `e2e-run.mjs` [D1]. Nothing tells the agent where the project ends, and nothing checks the environment before the first task [D1][Q9]. See proposal.md for the motivation and the specs for the required behaviour [Q1].

## Goals / Non-Goals

**Goals:**
- After planning, the only ways to reach the developer are the stops of `workflow/autonomous-apply`; everything else is recorded in one file [Q1][Q25].
- Rules that a check can verify are checked by the kit, not left to the agent's memory: manual reasons, the report, consent lines, the start check, commands outside the project [Q27][Q43][Q44].
- Changes started before this kit version finish under the old rules [Q32][Q40].

**Non-Goals:**
- Changing the number or order of question rounds, the company's QA process, commits, CI [Q13].
- Verifying that a `Consent:` line really comes from the developer; the protocol requires the developer's own words [Q35].
- Knowing which Docker containers the agent created; the command guard asks for every container command outside the project's own compose commands [Q44].

## Decisions

### D1. A protocol for autonomous apply

New `openspec/protocols/apply.md` holds the stops, the allowed workarounds, the project boundary, weakening with consent, the report, the consent list and the ready message [Q1][Q2][Q3][Q6][Q16][Q17][Q42]. The apply instruction of all four schemas points to it and starts with the start check (D6) [Q12][Q21]. Rejected: spreading the rules over `testing.md` and `e2e.md`, which describe tests, not the agent's conduct [Q44].

### D2. `apply-report.md` and its check

Written in the change root at the end of the tasks, updated after the E2E stage and after the consent list [Q25][Q35]:

```markdown
# Apply Report

## Manual checks
### payments/payout :: Hourly payout to cards — required before release
Reason: dangerous: money, many users
Steps: …
Expected: …

## Not verified automatically
### dev-environment :: Frontend change is picked up
Reason: tests were not run — Docker does not see the project folders
Consent: "skip live reload, QA will check it" (developer, 2026-10-28)

## Weakened tests
None.
```

New `check-apply-report.mjs` checks the three sections, a reason on every entry, dangerous checks first, and reports entries without `Consent:` [Q20][Q31][Q26]. The archive gate and the post-write hook run it [Q26]. Rejected: separate files for QA and for the report [Q25].

### D3. Manual reasons in the plan and the test cases

The verification plan's *Scenario coverage* table gets a `Manual reason` column, filled only on `manual` rows; a test case labelled `manual` gets a `Manual reason:` line under `Labels:` [Q27]. The reason starts with `cannot be automated:` or `dangerous:` [Q4][Q18]. `check-traceability` (plan) and `check-test-cases` report a missing or malformed reason as an error, so `answers-gate` blocks `tasks.md` (and `design.md` on the test-case schemas) [Q27]. The test-case reviewer reports effort given as a reason as a major finding [D1]. The Verification round no longer asks automate-or-manual [Q11].

### D4. The archive gate under the new rules

For a change stamped with this kit version or later (D5) the gate also requires: `apply-report.md` passes its check; a scenario or `automated` case without a test counts as covered only when it is under *Not verified automatically* with a `Consent:` line; and, when the plan's Environment section says `Running application: yes`, a start-check record (D6) [Q26][Q43]. Unchecked tasks still block, but tasks no longer contain manual checks [Q5]. Unstamped changes keep today's gate [Q32].

### D5. The kit version stamp

The post-write hook (`artifact-feedback`) adds `x-sdd-kit: <kitVersion>` to the change's `.openspec.yaml` when the first kit artifact of a change is written and the key is missing [Q40]. OpenSpec ignores `x-` keys without a warning; a plain unknown key produces one (checked with OpenSpec 1.15.0) [Q40]. Rejected: the creation date, which breaks when a kit update and a change happen on the same day [Q40].

### D6. The start-check script

New `node openspec/tooling/bin/start-check.mjs --change <name> --start "<cmd>" --url <url> [--stop "<cmd>"]` starts the application with the project's command, requests the URL every 2 seconds for up to 2 minutes, treats a status below 500 as success, stops the application (the stop command, or the process group it started), and writes `start-check.json` in the change root [Q43][Q37]. It is the second place where the kit runs the project, next to `e2e-run.mjs` [Q43]. The agent picks the URL from the project's instructions [Q37]; on failure it follows `workflow/environment-check` [Q33][Q39].

### D7. The command guard

New PreToolUse hook `boundary-guard.mjs` (Bash) answers "ask" — the developer approves or refuses in Claude Code — for: `sudo`, system package managers installing (`apt`, `apt-get`, `dnf`, `yum`, `brew`, …), global installs (`npm i -g`, `pnpm add -g`, `pip install --user`, …), `kill` / `pkill` / `killall`, and Docker commands that stop or remove containers, volumes or networks (`docker stop|kill|rm|rmi|prune`, `docker volume rm`, `docker network rm`); `docker compose …` of the project is not matched [Q44][Q7]. The protocol rule stays [Q44]. When the guard applies: see Assumptions.

### D8. Project tools, doctor and install

`openspec/project-tools` is a project file, like `openspec/markers-ignore`: the kit never overwrites it [Q36]. Doctor reads it and warns for each command not on the path; the installer runs doctor at the end and prints its result [Q28][Q9].

### D9. Tasks, questions and E2E texts

The tasks instruction forbids tasks that ask a human to check by hand, and the tasks check warns on task text such as "verify by hand" / "manually" [Q5]. `questions.md` drops "checks that can only be done manually" from the Verification round topics [Q11]. `e2e.md` §11–12 send skipped and accepted cases to `apply-report.md` instead of a chat list [Q38][Q20]. `testing.md` §1, §2 and §6 follow D3 and D2 [Q4][Q5].

### D10. Docs

`docs/how-it-works.md` (protocol, script, hook, check, gate rules), the workflow guide and `docs/decisions.md` [D1].

## Risks / Trade-offs

- [The guard asks for harmless commands, e.g. `kill` of a process the agent started] → it asks, not blocks; the developer approves in one keystroke [Q44].
- [The guard misses an unusual command outside the project] → the protocol rule stays as the second line [Q44].
- [An application needs more than 2 minutes to start] → the start check fails and the developer decides; the project can document a faster start command [Q37].
- [The agent writes a `Consent:` line the developer never gave] → the protocol requires quoting the developer; the report is in the archived change for review [Q35].
- [The new table column breaks plans of in-flight changes] → only stamped changes are checked for it [Q40].

## Migration Plan

Release the kit, `update` the projects; changes without the stamp finish under the old rules, new changes get the stamp with their first artifact [Q32][Q40]. Rollback: reinstall the previous kit version; the stamp is an `x-` key that older kits ignore [Q40].

## Assumptions & Open Questions

- The command guard applies at every stage, not only during apply [assumption]
- The agent starts the application at the start of apply only when the verification plan needs a running application [assumption]
- When a stop concerns one test or the environment, independent tasks are finished first [assumption]
