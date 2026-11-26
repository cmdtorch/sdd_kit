# Apply Report

## Manual checks

None.

## Not verified automatically

None.

## Weakened tests

None.

## Subagent runs

- 1. Pin OpenSpec 2.2.0 and re-base the kit schemas — 1.1–1.4 — opus — tests pass
- 6. check-specs follows OpenSpec 2.2.0 — 6.1–6.4 — opus — 1 test fails: The error blocks the next artifact
- 7. Command names in the kit — 7.1–7.3 — opus — tests pass
- 6. check-specs follows OpenSpec 2.2.0 (replacement: check-specs on a design.md write) — 6.1–6.4 — opus — tests pass
- 2. Install the OpenSpec skills into the project — 2.1–2.4 — opus — 1 test fails: Nothing is written outside the project (stop: outside the plan, answered as Q16)
- 2. Install the OpenSpec skills into the project (replacement: empty temporary HOME) — 2.1–2.4 — opus — tests pass
- 3. Version the skills in git — 3.1–3.3 — opus — tests pass
- 4. Skill drift check and doctor — 4.1–4.5 — opus — tests pass
- 8. Node minimum, CI and project documents — 8.1–8.3 — opus — tests pass
- 5. The update message about active changes — 5.1–5.3 — opus — tests pass
- test review — 10.1 — opus — READY, 3 minor findings
- fix: test review minors T1–T3 — 10.1 — opus — tests pass
- 9. OpenSpec facts, decisions and changelog — 9.1–9.3 — opus — tests pass
- full suite — 10.2 — opus — every test passes (1033 of 1033, OpenSpec 2.2.0 first on PATH); doctor: Ready
