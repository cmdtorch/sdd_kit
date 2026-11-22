# Design

## Context

Today apply on a kit schema is one agent working through `tasks.md` in one chat, following `openspec/protocols/apply.md` and `openspec/protocols/testing.md`; only the reviewers (`spec-reviewer`, `test-cases-reviewer`, `test-reviewer`) run as subagents. Motivation: see proposal.md — Why. Requirements: the specs of `workflow/task-groups`, `workflow/subagent-apply`, `workflow/subagent-delegation` and the delta of `workflow/manual-checks`. [desc][Q3]

Constraints that shape the approach: [desc]

- The kit stays stack- and layout-agnostic; it runs no project tests itself except Playwright through `e2e-run.mjs` (decision R1, R27). [Q35]
- Kit rules reach OpenSpec only through the kit schemas' instructions and the kit block of `config.yaml` `context`; `rules` and `operations` are not used because they would reach `spec-driven` changes. [Q12]
- The OpenSpec verify skill reads `openspec instructions apply --change <name> --json`, so the kit's apply instruction is also what verify sees. [Q3]
- A change carries the kit version that started it (`x-sdd-kit` in `.openspec.yaml`, `lib/project.mjs`); older changes keep the rules they started with. [Q26]
- In Claude Code a subagent cannot ask the user and cannot start another subagent; the main agent sets a subagent's model per call. [Q9][Q13]

## Goals / Non-Goals

**Goals:**

- Put every orchestration rule in one protocol the main agent reads once at the start of apply or verify, so the schemas and other protocols only point to it. [Q12]
- Keep every new behaviour inside instructions, one agent definition per role and small scripts; no new hook and no new blocking check. [Q12][Q25][Q31]

**Non-Goals:**

- No git worktrees, branches, commits or merges by the kit. [Q19][Q20]
- No change to the project's test setup to isolate databases per run. [Q35]
- No parallel planning stages, no external orchestrators, no parallel work across meta-repository clones. [Q15]

## Decisions

### D1. A new protocol `openspec/protocols/subagents.md`

It holds: when subagent apply applies (version gate, D6); the group plan lines and how to read them; the scheduling rules (dependencies, areas, the changed-file shared resources `dependencies` / `migrations` / `settings` / `assembly`, `Area: unknown` runs alone, unreadable plan lines treated as dependent on every earlier group); test runs on `database` / `ports` / `docker`; the changed-files check (D3); replacement of an unfinished subagent; how stops are relayed; the final group; the progress line and the "Subagent runs" report section; delegation outside apply (verify, code reading) and its limits. [Q4][Q17][Q22][Q27][Q28][Q29][Q35][Q38]

`apply.md`, `testing.md` and `e2e.md` get one short pointer each where they describe work the main agent now delegates (tasks, the full suite, E2E fixes); `apply.md` §2 notes that stops reach the developer through the main agent. The kit block of `config-fragment.yaml` gets one line pointing to the protocol. [Q3][Q9][Q36]

*Alternative:* extend `apply.md`. Rejected: `apply.md` already covers stops, boundaries and the report; orchestration is a separate concern that verify and the planning stages also read. [Q16]

### D2. Schema instructions

- `tasks` instruction (all four schemas): the three plan lines `Depends on:` / `Area:` / `Shared:` under every group heading with an example, the list of shared resources with what each covers, the group size limit (at most 5 tasks, about 10 files; split larger work), and the final group depending on every other group. [Q4][Q5][Q24][Q27]
- `apply` instruction (all four schemas): on a change stamped 0.5.0 or later follow `openspec/protocols/subagents.md`: every group before the final one goes to `task-implementer`, the main agent edits no project code, and verify runs through `change-verifier`. [Q3][Q10][Q21]

Example of a group in `tasks.md`: [Q4][Q27]

```
## 2. Order API

Depends on: 1
Area: api/src/orders/, api/tests/orders/
Shared: database

- [ ] 2.1 Write failing tests for "Create order" and verify they fail
```

The plan lines are plain text that OpenSpec ignores (it tracks only checkboxes) and `check-tasks` does not read. [Q12][Q25]

### D3. Changed-files check by self-report and git

Each subagent ends its report with a `Changed files:` list of every file it created, changed or deleted, including those changed by commands (formatters, generators). The main agent takes a `git status --porcelain` snapshot before starting subagents and after each one ends, and reconciles: a file listed by a subagent belongs to it; a file in the git delta that no subagent listed is treated as changed outside every area, and the main agent runs the tests of the groups whose areas it touches. Collisions with another group's area then follow the spec (both groups' tests, fix by a new subagent, at most two attempts). [Q38][Q22][Q23]

*Alternatives:* a hook that logs edits per subagent — rejected, it misses edits made by commands and adds a hook [Q12][Q38]; checking parallel groups only once after all of them — rejected, a collision would surface late and with no owner [Q38].

### D4. Agent definitions

- `kit/claude/agents/task-implementer.md`: the one implementation subagent for task groups, replacements, collision fixes, the full suite and E2E fixes. `model: inherit`; the main agent passes the model per call (D5). Its prompt states the limits: no subagents, no questions to the developer, no planning artifacts and no `tasks.md`; follow `testing.md` (TDD, scenario markers, two fix attempts); end with a stop report or a `Changed files:` list, the tasks done and the test result. [Q13][Q21][Q29][Q36]
- `kit/claude/agents/change-verifier.md`: verify only. Tools without Edit and Write, `model: inherit`; it reports findings to the main agent and changes no file. [Q3]
- Code reading at other stages uses Claude Code's built-in `Explore` subagent; no kit definition. [Q16]

*Alternative:* separate definitions per role (group, fix, suite). Rejected: same rules and tools, more files to keep in sync. [Q21]

### D5. Model setting: `x-sdd-kit-subagent-model`

The project sets `x-sdd-kit-subagent-model: <value>` at the top level of `openspec/config.yaml`, outside the kit block, so the installer's merge of the kit block never touches it. A new library function in `lib/project.mjs` reads and validates it: `opus`, `sonnet`, `haiku`, `fable`, `inherit`, or a value starting with `claude-`. A new script `node openspec/tooling/bin/subagent-model.mjs` prints the model to pass (`inherit` → the main model, i.e. no override) or, for an unknown value, a warning line and the fallback. `doctor.mjs` uses the same function to warn. `lint-kit.mjs` accepts the key (`CONFIG_KEYS`). Only `task-implementer` runs for groups and collision fixes get the setting; the full-suite, E2E-fix and verify runs use the main model. [Q32][Q33][Q34][Q37]

*Alternative:* the main agent parses `config.yaml` itself. Rejected: validation in one place, shared with doctor, is testable. [Q34]

### D6. Version gate

A helper in `lib/project.mjs` compares the change's stamp with 0.5.0 by major, minor and patch; a pre-release suffix counts as its base version, so `0.5.0-beta.1` gets the new rules for a pilot. A missing stamp or a lower version keeps the old single-agent apply and verify. `kitVersion` is raised by the release (`CONTRIBUTING.md`), not by this change; this change itself is stamped 0.4.0 and is implemented by the single agent. [Q26]

### D7. Implementation report

`apply-report.md` may have a `## Subagent runs` section, one line per run: `- <group or "fix: <what>" or "full suite"> — <tasks> — <model> — <test result>`. `check-apply-report.mjs` and `lib/apply-report.mjs` accept the section and never report on it, present or not. [Q14][Q31]

### D8. Documentation and tests

`docs/how-it-works.md` (protocol table, subagents section, config line), `docs/decisions.md` (new R-entries for D1–D7), `CHANGELOG.md` under Unreleased, and tests for: the instructions and protocol text, the two agent definitions, the model function and script, doctor's warning, lint-kit's key, the version helper, and the report check's handling of the section. [desc]

## Risks / Trade-offs

- [The main agent edits code itself despite the rule, since nothing enforces it] → The rule sits in the apply instruction, the protocol and the progress line format; the developer sees the per-subagent lines and the "Subagent runs" record. Accepted by the decision for protocol-only enforcement. [Q12]
- [A subagent's `Changed files:` list is incomplete] → The git reconciliation catches unlisted files and runs the tests of the groups they touch. [Q38]
- [A group under the size limit still overflows a subagent's context] → The subagent breaks off; one replacement continues from a note, then the developer is asked. [Q29][Q24]
- [More subagent starts cost tokens and time on small changes: each re-reads specs and design] → Accepted: subagents always, for any change size. [Q10][Q2]
- [Parallel test runs on one database interfere] → Test runs on shared `database`, `ports` or `docker` do not overlap unless the project isolates databases per run. [Q35]
- [The model setting names a model the account cannot use] → Doctor warns about unknown values; a known but unavailable model fails the subagent start, which is reported like any other failed subagent. [Q34]

## Migration Plan

Additive. After `sdd-kit update`, new changes are stamped with the installed kit version; only changes stamped 0.5.0 or later use subagents, so in-flight changes keep their single-agent apply. Rollback: reinstall the previous kit version; changes stamped 0.5.0 then fall back to whatever that kit's protocol says. [Q26]

## Assumptions & Open Questions

None.
