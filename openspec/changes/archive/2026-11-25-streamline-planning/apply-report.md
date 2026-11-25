# Apply Report

## Manual checks

### workflow/planning-flow :: Next artifact is written without a command
Reason: cannot be automated: `npm test` cannot run a live Claude Code session, and only there the hook holds the agent's turn
Steps: install the kit at 0.6.0 into a scratch project, create a new change through the starter menu (pick `medium`), answer the Main round, and watch the session until the end of planning without typing `/opsx:continue`
Expected: after each answered round the agent writes the next artifacts by itself (proposal, then the Technical round, then specs, design, verification plan, tasks), stops only at unanswered questions, prints the digest after the specs, and ends with the message that apply can start in a new chat

## Not verified automatically

None.

## Weakened tests

None.

## Subagent runs

- 1. Verify the Stop hook in a live Claude Code — 1.1–1.2 — inherit — no tests (facts K12–K18 recorded); 702 tests pass
- 2. Version gate and the clarifications file of new changes — 2.1–2.4 — inherit — 728 tests pass
- 5. Starter menu and the spec reviewer run limit — 5.1–5.4 — inherit — 748 tests pass
- 3. Closed rounds and the answers lock in the gates — 3.1–3.5 — inherit — 757 of 758 pass (how-it-works mention, done in group 8)
- 4. The Stop hook and the session state — 4.1–4.5 — inherit — 789 of 790 pass (how-it-works mention, done in group 8)
- fix: doctor hook list, test temp-folder isolation — — inherit — 790 of 791 pass (how-it-works mention, done in group 8)
- 6. The planning protocol: flow and rounds — 6.1–6.4 — inherit — 825 of 826 pass (how-it-works mention, done in group 8)
- 7. The planning protocol: recommendations, depth, schema instructions — 7.1–7.4 — inherit — 854 of 855 pass (how-it-works mention, done in group 8)
- 8. Documentation — 8.1–8.4 — inherit — 856 tests pass
- full suite — — inherit — 856 tests pass, lint-kit OK
