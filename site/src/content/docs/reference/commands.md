---
title: Commands
description: The commands of daily work and the kit's tools.
---

## In Claude Code

| Command | What it does |
|---|---|
| `/openspec-new-change <name>` | start a change on `clarify` and its first question round |
| `/openspec-new-change <name> --schema lean` | start a small, clear change |
| `/sdd:clarify` | continue or add questions for the current stage |
| `/openspec-apply-change` | implement with TDD, then the test review and the full suite |
| `/openspec-archive-change <name>` | archive when everything is done |

## In a terminal

| Command | What it does |
|---|---|
| `node openspec/tooling/bin/doctor.mjs` | is this machine and repository ready, and what to fix |
| `node openspec/tooling/checks/check-traceability.mjs --change <name> --markers` | every planned scenario has a marked test |
| `node openspec/tooling/bin/review-input.mjs --change <name>` | scenarios, THEN clauses and marked tests: what the test reviewer reads |
| `node openspec/tooling/bin/openspec.mjs update` | `openspec update` with the kit's workflow profile |

:::caution
Never run a plain `openspec update`. Use the kit's wrapper above.
:::
