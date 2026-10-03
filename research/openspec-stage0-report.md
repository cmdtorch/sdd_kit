# Отчёт этапа 0: разведка проекта (OpenSpec + E2E)

Дата сбора: 2026-10-03. Режим: только чтение. Секреты/токены/URL вырезаны или не копировались (из env-файлов — только имена переменных).

## Резюме (10 строк)

1. Проект: **Django 5.2 + DRF бэкенд** (Python 3.13, uv, PostgreSQL 17, Redis, django-q2). **Фронтенда в репозитории нет**, Node-проекта нет (`package.json` отсутствует). Монорепо — нет, это один Django-проект с приложениями в `apps/`.
2. OpenSpec **1.13.0**, установлен глобально через npm (`~/.local/lib/node_modules/@fission-ai/openspec`), профиль `core`, delivery `both`, схема `spec-driven` (встроенная, форков нет).
3. `openspec/` уже используется активно: 4 основных спеки, 8 активных changes (7 in-progress, 1 complete), 6 заархивированных.
4. `openspec/config.yaml` содержит только `schema` и `context` (стек, домены, TDD); блоков `rules` и `operations` нет (только закомментированные примеры).
5. OpenSpec-артефакты в `.claude/` есть (7 skills + 7 команд `opsx/*`); дублируются в `.agents/` (skills + workflows).
6. **`.claude/`, `openspec/`, `graphify-out/` перечислены в `.gitignore`** — т.е. не в git, команде не расшарены (требует проверки; см. раздел 6/«Не найдено»).
7. Claude Code: `settings.json` содержит только hooks (graphify-подсказки на Bash/Read/Glob); есть `settings.local.json` (permissions, enabledPlugins: tdd-guard, python-lsp); `CLAUDE.md` с жёстким TDD (Red→Green→Refactor) и ссылкой на OpenSpec-цикл.
8. Тесты: только **pytest + pytest-django + factory-boy** (~333 файлов с `test_`), `make test` (xdist, reuse-db, no-migrations). **Playwright/Cypress/E2E: НЕ НАЙДЕНО.**
9. CI: GitHub Actions `ci.yaml` (lint, typecheck, migrations, tests; на каждый PR) и `main.yaml` (gate → build ECR → deploy ECS при push в `main`). Node/Playwright в CI нет.
10. Среда: Linux (Debian 13, в контейнере), Windows-признаков в репозитории **не найдено** (ни `.ps1/.cmd/.bat`, ни упоминаний в README/docs/scripts).

---

## 1. OpenSpec

### 1.1 Версия и установка

```
$ which openspec
/home/coder/.local/bin/openspec
$ openspec --version
1.13.0
$ openspec version --json
error: unknown command 'version'      # команды `version` в 1.13.0 нет
$ npm ls -g --depth=0
/home/coder/.local/lib
├── @beads/bd@1.2.2
└── @fission-ai/openspec@1.13.0
```
Установка: глобально через npm, префикс `~/.local` (бинарь в `~/.local/bin`). Node v20.20.2, npm 10.8.2.

### 1.2 `openspec config list --json`

```json
{
  "featureFlags": {},
  "profile": "core",
  "delivery": "both",
  "telemetry": { "noticeSeen": true, "anonymousId": "<redacted>" },
  "completionTipSeen": true
}
```
Поле `workflows` в выводе отсутствует (при профиле `core` не задано кастомно).

### 1.3 Папка `openspec/`

Дерево (содержимое `changes/archive/*` не раскрыто):

```
openspec/
├── config.yaml
├── specs/
│   ├── .gitkeep
│   ├── application/candidate-short-link-form/spec.md
│   └── inventory/
│       ├── additional-services-sales/spec.md
│       ├── sale-payment-collection/spec.md
│       └── student-sale-invoices/spec.md
└── changes/
    ├── archive/                      # 6 папок:
    │   ├── 2026-09-06-validate-duplicate-form-order
    │   ├── 2026-09-10-additional-services-sales
    │   ├── 2026-09-17-add-sale-persistence-and-history
    │   ├── 2026-09-29-add-sale-payment-collection
    │   ├── 2026-10-03-add-sales-history-export
    │   └── 2026-10-03-allow-negative-balance-for-free-categories
    ├── add-sale-act-pdf/             (.openspec.yaml, proposal.md, design.md, tasks.md, specs/inventory/student-sale-invoices/spec.md)
    ├── add-student-initial-balance/  (… specs/students/student-sales-figures, specs/inventory/student-sale-invoices)
    ├── add-student-sales-category/   (… specs/inventory/additional-services-sales, specs/inventory/student-sales-category)
    ├── add-student-sales-overview/   (… specs/inventory/student-sales-overview)
    ├── add-uniform-package/          (… specs/inventory/uniform-package)
    ├── legacy-data-migration/        (+ migration-guide.md, migration-guide.az.md; specs/legacy-import/{users-and-catalog,corpus-and-termination-events,contracts-and-finance,products,candidates,reference-data,students})
    ├── scale-academic-year-transition/ (… specs/onec/outbound-push-queue, specs/students/academic-year-transition-execution)
    └── use-student-special-price-in-sales/ (… specs/inventory/additional-services-sales)
```
Спеки организованы по доменам (`<domain>/<capability>/spec.md`), не плоско.

#### `openspec/config.yaml` (дословно)

```yaml
schema: spec-driven

# Project context (optional)
# This is shown to AI when creating artifacts.
# Add your tech stack, conventions, style guides, domain knowledge, etc.
# Example:
#   context: |
#     Tech stack: TypeScript, React, Node.js
#     We use conventional commits
#     Domain: e-commerce platform
context: |
  Backend: Python 3.13+, Django 5.2+ (Django REST Framework for the API layer, not FastAPI).
  Validation: DRF serializers (apps/*/serializers.py, config/serializers.py) — the codebase
  does not use Pydantic; validation logic belongs in serializer field/validate_* methods
  and model clean()/services, not in views.
  Tests: pytest (pytest-django), via `make test`. See django-tdd skill for conventions
  (factory_boy factories, APIClient for DRF endpoints, no hand-built ORM fixtures).

  Domains are Django apps under apps/, one app per business domain:
    - accounts       — users, auth (SimpleJWT), roles/permissions, departments, positions
    - application     — candidate/admissions pipeline: candidates, application forms,
                        interviews, exams, registration links
    - students        — core student lifecycle: Student, StudentContract, addenda,
                        termination, annual fees/discounts, corpus changes
    - school_config   — reference/config data: academic years, corpus, discounts,
                        kanban stages
    - products        — product/pricing catalog
    - onec            — outbound/inbound integration with the 1C accounting system
                        (payment ledger, integration logs)
    - inventory       — inventory management
  Each app follows Django conventions: models.py, serializers.py (or serializers/ package),
  views.py, services/ for business logic, factories.py for test fixtures, tests/.

  TDD is mandatory during the apply phase: tests are written first from the delta spec's
  scenarios and must fail (RED) before any implementation is written (GREEN), per the
  project's django-tdd skill and CLAUDE.md TDD rules.

# Per-artifact rules (optional)
# Add custom rules for specific artifacts.
# Example:
#   rules:
#     proposal:
#       - Keep proposals under 500 words
#       - Always include a "Non-goals" section
#     tasks:
#       - Break tasks into chunks of max 2 hours

# Per-operation guidance (optional)
# Add advisory guidance for how apply and archive work should be conducted.
# This is separate from artifact rules above.
# Example:
#   operations:
#     apply:
#       guidance:
#         - Keep test summaries concise
#     archive:
#       guidance:
#         - Summarize the archive outcome before finishing
```
Примечание: блоки `rules:` / `operations:` в config.yaml — только закомментированные примеры. Перечень доменов в `context` не упоминает `legacy_import` (приложение есть в `apps/`).

### 1.4 `openspec list --json` / `openspec list --specs --json`

```json
{
  "changes": [
    {"name": "use-student-special-price-in-sales",  "completedTasks": 9,  "totalTasks": 11, "lastModified": "2026-10-03T13:15:37Z", "status": "in-progress"},
    {"name": "add-student-sales-overview",          "completedTasks": 18, "totalTasks": 19, "lastModified": "2026-09-29T17:17:24Z", "status": "in-progress"},
    {"name": "add-student-initial-balance",         "completedTasks": 30, "totalTasks": 31, "lastModified": "2026-09-29T13:41:38Z", "status": "in-progress"},
    {"name": "add-student-sales-category",          "completedTasks": 30, "totalTasks": 31, "lastModified": "2026-09-29T12:12:28Z", "status": "in-progress"},
    {"name": "add-sale-act-pdf",                    "completedTasks": 25, "totalTasks": 26, "lastModified": "2026-09-28T16:35:31Z", "status": "in-progress"},
    {"name": "scale-academic-year-transition",      "completedTasks": 0,  "totalTasks": 25, "lastModified": "2026-09-23T11:57:35Z", "status": "in-progress"},
    {"name": "legacy-data-migration",               "completedTasks": 60, "totalTasks": 64, "lastModified": "2026-09-22T19:16:17Z", "status": "in-progress"},
    {"name": "add-uniform-package",                 "completedTasks": 19, "totalTasks": 19, "lastModified": "2026-09-10T22:13:19Z", "status": "complete"}
  ],
  "root": {"path": "<project root>", "source": "nearest"}
}
```
```json
{
  "specs": [
    {"id": "application/candidate-short-link-form", "requirementCount": 2},
    {"id": "inventory/additional-services-sales",   "requirementCount": 5},
    {"id": "inventory/sale-payment-collection",     "requirementCount": 10},
    {"id": "inventory/student-sale-invoices",       "requirementCount": 13}
  ]
}
```

### 1.5 Схемы

`openspec schemas --json`:
```json
[
  {
    "name": "spec-driven",
    "description": "Default OpenSpec workflow - proposal → specs → design → tasks",
    "artifacts": ["proposal", "specs", "design", "tasks"],
    "source": "package"
  }
]
```
`openspec schema which spec-driven --json`:
```json
{
  "name": "spec-driven",
  "source": "package",
  "path": "~/.local/lib/node_modules/@fission-ai/openspec/schemas/spec-driven",
  "shadows": []
}
```
Локальных/форкнутых схем нет (`openspec/schemas/` отсутствует).

#### `schemas/spec-driven/schema.yaml` (дословно)

```yaml
name: spec-driven
version: 1
description: Default OpenSpec workflow - proposal → specs → design → tasks
artifacts:
  - id: proposal
    generates: proposal.md
    description: Initial proposal document outlining the change
    template: proposal.md
    instruction: |
      Create the proposal document that establishes WHY this change is needed.

      Sections:
      - **Why**: 1-2 sentences on the problem or opportunity. What problem does this solve? Why now?
      - **What Changes**: Bullet list of changes. Be specific about new capabilities, modifications, or removals. Mark breaking changes with **BREAKING**.
      - **Capabilities**: Identify which specs will be created or modified:
        - **New Capabilities**: List capabilities being introduced. Each becomes a new `specs/<capability-path>/spec.md`. Use kebab-case for path segments you introduce (e.g., `user-auth` or `identity/user-auth`) and follow the project's existing spec organization.
        - **Modified Capabilities**: List existing capabilities whose REQUIREMENTS are changing. Only include if spec-level behavior changes (not just implementation details). Each needs a delta spec file. Use the exact existing path under `openspec/specs/`. Leave empty if no requirement changes.
      - **Impact**: Affected code, APIs, dependencies, or systems.

      IMPORTANT: The Capabilities section is critical. It creates the contract between
      proposal and specs phases. Research existing specs before filling this in:
      run `openspec list --specs` for the project's capability inventory, then
      `openspec show "<spec-id>" --type spec --json --no-scenarios` for any that
      look related - that returns a capability's purpose and requirement texts
      without pulling whole spec files into context. Append `--store "<id>"` to
      both commands only for a registered standalone store, and keep `--type
      spec`: a change and a spec sharing a name is otherwise an ambiguous-item
      error. `openspec list` without `--specs` lists in-flight changes, not
      specs - it never shows what the project already covers. Reuse an existing
      capability's exact path instead of introducing a near-duplicate name.
      The filtered read is only an overview. Before deciding what is already
      covered or what should change, read each relevant spec in full, including
      scenarios, with `openspec show "<spec-id>" --type spec` (same `--store` rule).
      Each capability listed here will need a corresponding spec file.

      Every change must either declare at least one capability (new or
      modified) or explicitly opt out of specs: `openspec validate` rejects a
      change with zero deltas unless the change's `.openspec.yaml` sets
      `skip_specs: true`. Use `skip_specs: true` only when no spec-level
      behavior changes (pure refactor, tooling, docs) - specs describe
      behavior, so if behavior does not change, no spec should change either.
      Do not invent a requirement just to satisfy validation.

      Keep it concise (1-2 pages). Focus on the "why" not the "how" -
      implementation details belong in design.md.

      This is the foundation - specs, design, and tasks all build on this.
    requires: []

  - id: specs
    generates: "specs/**/*.md"
    description: Detailed specifications for the change
    template: spec.md
    instruction: |
      Create specification files that define WHAT the system should do.

      A spec is a behavior contract, not an implementation plan.

      Good spec content:
      - Observable behavior users or downstream systems rely on
      - Inputs, outputs, and error conditions
      - External constraints (security, privacy, reliability, compatibility)
      - Scenarios that can be tested or explicitly validated

      Avoid in specs:
      - Internal class/function names
      - Library or framework choices
      - Step-by-step implementation details
      - Detailed execution plans (those belong in design.md or tasks.md)

      Quick test: if the implementation can change without changing externally
      visible behavior, it likely does not belong in the spec.

      Create one spec file per capability listed in the proposal's Capabilities section.
      `<capability-path>` is the spec directory relative to `specs/` (for example,
      `user-auth` or `identity/user-auth`). Preserve the full path:
      - New capabilities: use the exact path from the proposal at `specs/<capability-path>/spec.md`. Any path segment newly introduced in the proposal must be kebab-case. Follow the project's existing organization; do not add a new domain level when the project uses a flat layout.
      - Modified capabilities: use the exact existing path from `openspec/specs/<capability-path>/` when creating the delta at `specs/<capability-path>/spec.md`. Run `openspec list --specs` to confirm that path before writing the delta, appending `--store "<id>"` only for a registered standalone store - a mistyped or invented path targets a capability that does not exist rather than the one you meant. Do not move or rename the capability.

      There must be at least one spec file unless the change's `.openspec.yaml`
      sets `skip_specs: true` (no spec-level behavior change) - `openspec validate`
      rejects a zero-delta change without that marker. If the proposal lists no
      capabilities and `skip_specs` is not set, revisit the proposal first.

      Delta operations (use ## headers):
      - **ADDED Requirements**: New capabilities
      - **MODIFIED Requirements**: Changed behavior - MUST include full updated content
      - **REMOVED Requirements**: Deprecated features - MUST include **Reason** and **Migration**
      - **RENAMED Requirements**: Name changes only - use FROM:/TO: format

      Format requirements:
      - Each requirement: `### Requirement: <name>` followed by description
      - Use SHALL/MUST for normative requirements (avoid should/may)
      - Each scenario: `#### Scenario: <name>` with WHEN/THEN format
      - **CRITICAL**: Scenarios MUST use exactly 4 hashtags (`####`). Using 3 hashtags or bullets will fail silently.
      - Every requirement MUST have at least one scenario.

      New capabilities only: start the delta spec with a `## Purpose` section -
      one or two sentences (50+ characters, or `openspec validate --strict`
      reports it as too brief) describing what the capability is for. Archive
      copies it into the main spec it creates; without it the new main spec is
      left with a `TBD ... Update Purpose after archive` placeholder to fill in
      by hand. Do NOT add `## Purpose` to a delta for an existing capability -
      that spec already has one and the delta's is ignored. To change an
      existing capability's Purpose - including a leftover `TBD` placeholder -
      edit `<planningHome.root>/openspec/specs/<capability-path>/spec.md`
      directly. `planningHome.root` comes from the `openspec instructions ...
      --json` response. Always use it rather than a repo-relative path: it
      resolves to the store whenever the change lives in one - whether that
      came from `--store`, a project `store:` pointer, or a global default
      store - and to the current repository otherwise. Do not try to work out
      which case applies; the field already has.

      MODIFIED requirements workflow:
      1. Locate the existing requirement in `<planningHome.root>/openspec/specs/<capability-path>/spec.md` (the same store-aware root as above)
      2. Copy the ENTIRE requirement block (from `### Requirement:` through all scenarios)
      3. Paste under `## MODIFIED Requirements` and edit to reflect new behavior
      4. Ensure header text matches exactly (whitespace-insensitive)

      Common pitfall: Using MODIFIED with partial content loses detail at archive time.
      If adding new concerns without changing existing behavior, use ADDED instead.

      Example (a new capability, so it opens with `## Purpose`):
      ```
      ## Purpose

      Lets users take their data out of the product in a portable format.

      ## ADDED Requirements

      ### Requirement: User can export data
      The system SHALL allow users to export their data in CSV format.

      #### Scenario: Successful export
      - **WHEN** user clicks "Export" button
      - **THEN** system downloads a CSV file with all user data

      ## REMOVED Requirements

      ### Requirement: Legacy export
      **Reason**: Replaced by new export system
      **Migration**: Use new export endpoint at /api/v2/export
      ```

      Specs should be testable - each scenario is a potential test case.
    requires:
      - proposal

  - id: design
    generates: design.md
    description: Technical design document with implementation details
    template: design.md
    instruction: |
      Create the design document that explains HOW to implement the change.

      When to include design.md (create only if any apply):
      - Cross-cutting change (multiple services/modules) or new architectural pattern
      - New external dependency or significant data model changes
      - Security, performance, or migration complexity
      - Ambiguity that benefits from technical decisions before coding

      Sections:
      - **Context**: Only the current state and constraints needed to explain the approach. Reference the proposal for motivation instead of restating it (e.g., "See proposal.md - Why").
      - **Goals / Non-Goals**: What this design achieves and explicitly excludes. Don't restate the proposal's scope - add only design-level boundaries.
      - **Decisions**: Key technical choices with rationale (why X over Y?). Include alternatives considered for each decision.
      - **Risks / Trade-offs**: Known limitations, things that could go wrong. Format: [Risk] → Mitigation
      - **Migration Plan**: Steps to deploy, rollback strategy (if applicable)
      - **Open Questions**: Unknowns that can safely be answered later without
        changing the specs, the approach, or the task breakdown. Omit if none.

      Open questions are for genuinely deferrable unknowns, not decisions you
      skipped. If a question would change the specs, the chosen approach, or
      the task breakdown, resolve it now - ask the user instead of guessing.

      Focus on architecture and approach, not line-by-line implementation.
      The proposal covers why and what; design covers how. Reference the
      proposal for motivation and, once written, the specs for requirements -
      if a section would only restate them, point to them instead.

      Good design docs explain the "why" behind technical decisions.
    requires:
      - proposal

  - id: tasks
    generates: tasks.md
    description: Implementation checklist with trackable tasks
    template: tasks.md
    instruction: |
      Create the task list that breaks down the implementation work.

      Before writing tasks, check design.md for Open Questions. If any of them
      would change what gets built, resolve them with the user first - do not
      bake an unstated assumption into the task list.

      **IMPORTANT: Follow the template below exactly.** The apply phase parses
      checkbox format to track progress. Tasks not using `- [ ]` won't be tracked.

      Guidelines:
      - Group related tasks under ## numbered headings
      - Each task MUST be a checkbox: `- [ ] X.Y Task description`
      - Tasks should be small enough to complete in one session
      - Order tasks by dependency (what must be done first?)
      - Each task MUST state how to verify completion (a test, command,
        observable behavior, or delivered artifact). Put the verification in
        that task's checkbox description. Use a separate verification task only
        when it checks broader integration or system behavior that spans
        multiple implementation tasks.

      Example:
      ```
      ## 1. Setup

      - [ ] 1.1 Create new module structure and verify expected files are present
      - [ ] 1.2 Add dependencies to package.json and verify package installation succeeds

      ## 2. Core Implementation

      - [ ] 2.1 Implement data export function and verify the export test passes
      - [ ] 2.2 Add CSV formatting utilities and verify unit tests cover quoting and delimiters
      ```

      Reference specs for what needs to be built, design for how to build it.
    requires:
      - specs
      - design

apply:
  requires: [tasks]
  tracks: tasks.md
  instruction: |
    Read context files, work through pending tasks, mark complete as you go.
    Pause if you hit blockers or need clarification.
```

#### `schemas/spec-driven/templates/proposal.md`

```markdown
## Why

<!-- Explain the motivation for this change. What problem does this solve? Why now? -->

## What Changes

<!-- Describe what will change. Be specific about new capabilities, modifications, or removals. -->

## Capabilities

### New Capabilities
<!-- Capabilities being introduced. Use kebab-case for path segments you introduce
     (e.g., user-auth or identity/user-auth) that follow the project's existing
     spec organization. Each creates specs/<capability-path>/spec.md. -->
- `<capability-path>`: <brief description of what this capability covers>

### Modified Capabilities
<!-- Existing capabilities whose REQUIREMENTS are changing (not just implementation).
     Only list here if spec-level behavior changes. Each needs a delta spec file.
     Use the exact existing path under openspec/specs/. Leave empty if no requirement
     changes. A change with no capabilities at all (pure refactor, tooling, docs)
     must set `skip_specs: true` in its .openspec.yaml - openspec validate rejects
     a zero-delta change without that marker. Do not invent a requirement just to
     satisfy validation. -->
- `<existing-capability-path>`: <what requirement is changing>

## Impact

<!-- Affected code, APIs, dependencies, systems -->
```

#### `schemas/spec-driven/templates/spec.md`

```markdown
## Purpose
<!-- New capabilities only: one or two sentences (50+ characters) on what this capability is for. Delete this section for an existing capability. -->

## ADDED Requirements

### Requirement: <!-- requirement name -->
<!-- requirement text -->

#### Scenario: <!-- scenario name -->
- **WHEN** <!-- condition -->
- **THEN** <!-- expected outcome -->
```

#### `schemas/spec-driven/templates/design.md`

```markdown
## Context

<!-- Current state and constraints that shape the approach. See proposal.md for motivation - don't restate it -->

## Goals / Non-Goals

**Goals:**
<!-- What this design aims to achieve -->

**Non-Goals:**
<!-- What is explicitly out of scope -->

## Decisions

<!-- Key design decisions with rationale and alternatives considered -->

## Risks / Trade-offs

<!-- Known risks and trade-offs -->
```

#### `schemas/spec-driven/templates/tasks.md`

```markdown
## 1. <!-- Task Group Name -->

- [ ] 1.1 <!-- Task description -->
- [ ] 1.2 <!-- Task description -->

## 2. <!-- Task Group Name -->

- [ ] 2.1 <!-- Task description -->
- [ ] 2.2 <!-- Task description -->
```

### 1.6 OpenSpec-файлы в `.claude/` (и дубли)

`.claude/skills/` (OpenSpec): `openspec-apply-change`, `openspec-archive-change`, `openspec-explore`, `openspec-onboard`, `openspec-propose`, `openspec-sync-specs`, `openspec-update-change` (в каждом `SKILL.md`).

`.claude/commands/opsx/`: `apply.md`, `archive.md`, `explore.md`, `onboard.md`, `propose.md`, `sync.md`, `update.md`.

Дубли для других агентов: `.agents/skills/openspec-*` (те же 7) и `.agents/workflows/opsx-{apply,archive,explore,onboard,propose,sync,update}.md`. `.agent/skills/` содержит только `django-rest-framework`.

---

## 2. Claude Code

### 2.1 `.claude/settings.json` (дословно)

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "CMD=$(python3 -c \"import json,sys; d=json.load(sys.stdin); print(d.get('tool_input',d).get('command',''))\" 2>/dev/null || true); case \"$CMD\" in *grep*|*rg\\ *|*ripgrep*|*find\\ *|*fd\\ *|*ack\\ *|*ag\\ *)   [ -f graphify-out/graph.json ] &&   echo '{\"hookSpecificOutput\":{\"hookEventName\":\"PreToolUse\",\"additionalContext\":\"MANDATORY: graphify-out/graph.json exists. You MUST run `graphify query \\\"<question>\\\"` before grepping raw files. Only grep after graphify has oriented you, or to modify/debug specific lines.\"}}'   || true ;; esac"
          }
        ]
      },
      {
        "matcher": "Read|Glob",
        "hooks": [
          {
            "type": "command",
            "command": "HIT=$(python3 -c \"import json,sys;d=json.load(sys.stdin);t=d.get('tool_input',d);exts=('.py','.js','.ts','.tsx','.jsx','.astro','.vue','.svelte','.go','.rs','.java','.rb','.c','.h','.cpp','.hpp','.cc','.cs','.kt','.swift','.php','.scala','.lua','.sh','.md','.rst','.txt','.mdx');vals=[str(t.get('file_path') or ''),str(t.get('pattern') or ''),str(t.get('path') or '')];j=' '.join(vals).lower().replace(chr(92),'/');tails=[('.'+x.rsplit('.',1)[-1]) for v in vals if v for x in [v.lower().replace(chr(92),'/').rsplit('/',1)[-1]] if '.' in x];sys.stdout.write('1' if 'graphify-out/' not in j and any(tl in exts for tl in tails) else '')\" 2>/dev/null || true); if [ \"$HIT\" = 1 ] && [ -f graphify-out/graph.json ]; then echo '{\"hookSpecificOutput\":{\"hookEventName\":\"PreToolUse\",\"additionalContext\":\"MANDATORY: graphify-out/graph.json exists. You MUST run graphify before reading source files. Use: `graphify query \\\"<question>\\\"` (scoped subgraph), `graphify explain \\\"<concept>\\\"`, or `graphify path \\\"<A>\\\" \\\"<B>\\\"`. Only read raw files after graphify has oriented you, or to modify/debug specific lines. This rule applies to subagents too \\u2014 include it in every subagent prompt involving code exploration.\"}}'; fi || true"
          }
        ]
      }
    ]
  }
}
```

### 2.2 `settings.local.json` (без содержимого)

Существует (`.claude/settings.local.json`, права 600). Верхнеуровневые ключи: `permissions` (1 элемент), `enabledPlugins` (2 плагина: `tdd-guard@tdd-guard`, `python-lsp@zircote-lsp`).

### 2.3 Hooks / agents / commands / skills (не от OpenSpec)

- **Hooks**: только 2 PreToolUse-hook в `settings.json` (graphify-подсказки, см. выше). Hook'и плагина tdd-guard — через `enabledPlugins` (содержимое не проверялось); данные в `.claude/tdd-guard/data/` (`instructions.md`, `modifications.json`, `test.json`). TDD-guard pytest-плагин в dev-зависимостях (`tdd-guard-pytest`).
- **Agents** (`.claude/agents/`): НЕ НАЙДЕНО. (Внутри некоторых skills есть подпапки `agents/`.)
- **Commands**: только `opsx/*` (OpenSpec). Других нет.
- **Skills не от OpenSpec** (`.claude/skills/`): `codebase-design`, `code-review`, `diagnosing-bugs`, `django-patterns`, `django-rest-framework`, `django-tdd`, `domain-modeling`, `graphify`, `grill-me`, `improve-codebase-architecture`, `prototype`, `research`, `tdd`, `teach`, `to-questionnaire`, `wait-what`, `writing-for-agents`. Большинство — из `mattpocock/skills`, `django-patterns` — из `affaan-m/ecc` (по `skills-lock.json`).
- Прочее: `.claude/worktrees/` (пусто), `.claude/test.txt`, `.claude/scheduled_tasks.lock`.

### 2.4 CLAUDE.md

Два файла: `/CLAUDE.md` и `/.claude/CLAUDE.md`.

`/CLAUDE.md` (кратко):
- Секция **graphify**: перед вопросами по коду — `graphify query/path/explain`; после правок — `graphify update .`.
- Секция **TDD — strict, non-negotiable**: Red → Green → Refactor; тесты — спецификация. Запуск только в скоупе: `make test FILE=path::Class::test`; полный `make test` (1500+ тестов, ~75 с, xdist) только в финале. Тесты идут на `config.settings_test`; после миграций — `make test-create-db`. Правила: не править тест, чтобы он прошёл; не писать код без падающего теста; factory-boy; DRF через `APIClient`, проверять status_code и payload, покрывать auth (SimpleJWT) и ошибки валидации; багфикс = сначала регрессионный тест. Quality gate: `make check FILE=...` (scoped tests + полный lint + полный typecheck) должен быть зелёным.
- Для новых фич TDD выполняется внутри `/opsx:apply`.

`/.claude/CLAUDE.md` (кратко, часть на русском): триггер `/graphify`; **OpenSpec Workflow**: новая фича/модуль — цикл `/opsx:explore → propose → apply → archive`; мелкие правки и багфиксы — без полного цикла; перед explore на большом участке — свериться с графом Graphify; на apply — обязательно TDD; перед apply proposal.md и delta specs должны быть показаны и подтверждены человеком.

---

## 3. Проект и стек

- **Языки/фреймворки**: Python 3.13, Django ≥5.2.8, DRF, SimpleJWT, drf-spectacular, django-q2, django-filter, django-jazzmin (админка), weasyprint/docxtpl/openpyxl (документы/экспорт), boto3/django-storages/minio (S3), resend, sentry-sdk (GlitchTip), OpenTelemetry. JS/TS-кода и фронтенда в репозитории **нет**; в `docs/frontend/` лежат только markdown-описания API для фронтенд-команды (`01-…06-known-issues.md`, `README.md`).
- **Монорепо**: нет. Один сервис «landau-erp-web-backend».
- **Верхний уровень**: `apps/` (accounts, application, inventory, legacy_import, onec, products, school_config, students), `config/` (settings.py, settings_test.py, urls.py, s3.py и др.), `scripts/` (entrypoint.sh, create_super_user.sh, test.sh), `templates/` (documents, emails), `docs/`, `observability/`, `openspec/`, `.claude/`, `.agents/`, `.agent/`, `.github/`, `.envs/`, `graphify-out/`, `Makefile`, `Dockerfile`, `docker-compose.yml`, `pyproject.toml`, `uv.lock`, `requirements.txt` (устаревший), `conftest.py`, `manage.py`, `diagnose_webhook.py`, `skills-lock.json`.
- **Node/JS**: корневого `package.json` **НЕ НАЙДЕНО**; lock-файлов npm/pnpm/yarn **НЕТ**; `.nvmrc` **НЕТ**; поля `engines` нет. `node --version` = v20.20.2, `npm` 10.8.2 (установлены только ради глобальных CLI: openspec, beads/bd, chorus-aidlc). Менеджер Python-пакетов: **uv** (`uv.lock`, uv 0.12.13); Python 3.13.5.
- **Локальный запуск**:
  - Нативно: `uv sync` → `cp .envs/.env.dev.example .envs/.env.dev` → `make migrate` → `make run` (`manage.py runserver`, порт 8000) → в другом терминале `make qcluster` (django-q2 воркер).
  - Docker: `docker-compose up --build`. Сервисы: `web` (8000), `qcluster`, `redis` (redis:7-alpine, порт 6380). **Сервиса PostgreSQL в `docker-compose.yml` нет** (README упоминает `db`, но в файле его нет) — БД внешняя через `POSTGRES_*`. `entrypoint.sh`: ждёт Postgres, `migrate`, `sync_erp_permissions`, создаёт суперпользователя из env, затем runserver (при DEBUG) или collectstatic + gunicorn.
  - Выбор env-файла: `ENVIRONMENT` (по умолчанию `dev`) → `.envs/.env.<ENVIRONMENT>`.
  - БД: если `POSTGRES_HOST` задан — PostgreSQL, иначе fallback на SQLite (`db.sqlite3`).
  - Swagger: `/api/schema/swagger-ui/`.
- **Переменные окружения (только имена, из `.envs/.env.dev.example`)**: `DJANGO_SECRET_KEY, DJANGO_DEBUG, DJANGO_ALLOWED_HOSTS, DJANGO_TIME_ZONE, CSRF_TRUSTED_ORIGINS, CORS_ALLOW_ALL_ORIGINS, CORS_ALLOWED_ORIGINS, RELEASE_VERSION, ENVIRONMENT, DJANGO_SUPERUSER_EMAIL, DJANGO_SUPERUSER_PASSWORD, ACCESS_TOKEN_LIFETIME, REFRESH_TOKEN_LIFETIME, SLIDING_TOKEN_LIFETIME, SLIDING_TOKEN_REFRESH_LIFETIME, FRONTEND_HOST, FRONTEND_RESET_PASSWORD_URI, FRONTEND_SET_PASSWORD_URI, POSTGRES_HOST, POSTGRES_PORT, POSTGRES_DB, POSTGRES_USER, POSTGRES_PASSWORD, REDIS_HOST, REDIS_PORT, REDIS_DB, GLITCHTIP_DSN, GLITCHTIP_SAMPLE_RATE, GLITCHTIP_SEND_PII, OTEL_SERVICE_NAME, OTEL_EXPORTER_ENDPOINT, OTEL_EXPORTER_TOKEN, OTEL_LOG_LEVEL, OTEL_ENABLED, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_SES_REGION, AWS_SES_FROM_EMAIL, AWS_SES_FROM_NAME, AWS_SES_CONFIGURATION_SET, AWS_S3_BUCKET_NAME, AWS_S3_REGION, KANBAN_DEFAULT_PAGE_SIZE, IMPORT_MAX_FILE_SIZE_MB, ONEC_WEBHOOK_SECRET, ONEC_DATA_API_URL, ONEC_DATA_API_TIMEOUT, PUBLIC_FORM_BASE_URL`.
  `.envs/.env.ci` (закоммичен, несекретный) задаёт: `DJANGO_DEBUG, DJANGO_SECRET_KEY, DJANGO_TIME_ZONE, AWS_S3_BUCKET_NAME, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY` (фиктивные). Часовой пояс тестов — `Asia/Baku`.
- **Внешние сервисы**: PostgreSQL 17 (в README указано 15 — расхождение), Redis (кеш/очередь; в тестах не нужен — ORM-брокер), S3 (MinIO/AWS), Amazon SES / Resend (почта), 1C (вебхук + outbound «Data Web Service»), GlitchTip (Sentry-совместимый), OpenTelemetry collector. LibreOffice-writer в Docker-образе (конвертация документов), weasyprint (PDF).

---

## 4. Тесты

- **Playwright**: НЕ НАЙДЕНО (ни зависимости, ни `playwright.config.*`, ни каталога e2e, ни `webServer`; бинарь `playwright` в PATH отсутствует). Cypress/Selenium/E2E-каталогов — тоже НЕ НАЙДЕНО. Поскольку фронтенда в репозитории нет, E2E потребует отдельного места (отдельный репозиторий/каталог с нуля) — решение за заказчиком.
- **Фреймворк**: pytest + pytest-django (`DJANGO_SETTINGS_MODULE = config.settings_test`, `python_files = test_*.py, *_test.py`), factory-boy, pytest-xdist, pytest-cov, pytest-rich, tdd-guard-pytest. Линт: ruff; типы: mypy (django-stubs).
- **Расположение**: `apps/<app>/tests/` (application ~56 файлов, inventory ~88, legacy_import ~55, onec ~14, products ~3, school_config ~9, students ~118), плюс `config/tests/`. В `apps/accounts` каталога `tests/` нет (возможно `tests.py` в корне приложения — не проверялось). Всего ~333 файлов с `test_` в имени (git ls-files). Заявлено 1500+ тестов.
- **Команды**:
  ```
  make test                               # весь набор: --reuse-db --no-migrations -n auto
  make test FILE=apps/x/tests/test_y.py::Class::test_name
  make test-create-db                     # пересоздать тестовую БД после миграций
  make test-plain                         # настоящие миграции, без reuse-db
  make coverage
  make check FILE=...                     # lint + typecheck + test
  ```
  `scripts/test.sh`: `pytest --reuse-db --no-migrations -v --tb=short [-n auto, если без аргументов]`.
- **Фикстуры/данные**: `conftest.py` в корне (отключает throttling DRF; autouse-моки S3: `block_real_s3_calls`, `block_real_file_storage`); `factories.py` в accounts/application/inventory/onec/school_config/students (у products и legacy_import factories.py нет). Каталогов `fixtures/` в приложениях — НЕ НАЙДЕНО. Сиды: management-команды (`sync_erp_permissions`, `load_countries` — файл `countries.json` опционален, в Docker читается из `/app/countries.json`; в репозитории корневого `countries.json` нет). `settings_test.py`: MD5-хэшер, locmem cache/email, Q_CLUSTER на ORM-брокере.
- Покрытие: `.coverage` и `htmlcov/` присутствуют локально.

---

## 5. CI (`.github/workflows/`)

| Файл | Триггеры | Что делает | Node/Playwright/кеш |
|---|---|---|---|
| `ci.yaml` | `pull_request`, `workflow_call` | 4 параллельных job: lint (lock-check, ruff check, ruff format --check), typecheck (mypy), migrations (postgres:17 service, `makemigrations --check`, `migrate`), test (postgres:17 service, `make test`) | Node нет, Playwright нет; кеш uv через `astral-sh/setup-uv@v6` (ключ `uv.lock`) |
| `main.yaml` | `push` в `main` | quality-gate (вызывает `ci.yaml`) → build+push в ECR → deploy в ECS (reusable workflows из внешнего репозитория `niziaskerov/ci-cd`) | OIDC AWS role (секрет `AWS_ROLE_TO_ASSUME`) |

Composite-action `.github/actions/setup-backend/action.yml` — общий setup (uv + `uv sync --frozen`).

### `.github/workflows/ci.yaml` (дословно — workflow с тестами)

```yaml
name: CI

# Every pull request, and called by the deploy workflow as its gate.
on:
  pull_request:
  workflow_call:

concurrency:
  group: ci-${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

permissions:
  contents: read

# Describes the throwaway PostgreSQL container the jobs start; everything else
# the app reads lives in .envs/.env.ci. POSTGRES_HOST must stay localhost --
# the migrations job runs a real `manage.py migrate`.
env:
  ENVIRONMENT: ci
  POSTGRES_HOST: localhost
  POSTGRES_PORT: "5432"
  POSTGRES_DB: landau_erp
  POSTGRES_USER: landau_erp
  POSTGRES_PASSWORD: landau_erp

jobs:
  lint:
    name: Lint
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4
      - uses: ./.github/actions/setup-backend

      - name: uv.lock is in sync with pyproject.toml
        run: make lock-check

      - name: Ruff check
        run: make lint

      - name: Ruff format
        run: make format-check

  typecheck:
    name: Typecheck
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4
      - uses: ./.github/actions/setup-backend

      - name: Mypy
        run: make typecheck

  migrations:
    name: Migrations
    runs-on: ubuntu-latest
    timeout-minutes: 10

    # The only place migrations run: the test job uses --no-migrations.
    services:
      postgres:
        # Not -alpine: the app sorts with the az-x-icu collation, which exists
        # only in a build that has ICU.
        image: postgres:17
        # Repeated from the workflow env: the env context is unavailable here.
        env:
          POSTGRES_DB: landau_erp
          POSTGRES_USER: landau_erp
          POSTGRES_PASSWORD: landau_erp
        ports:
          - 5432:5432
        options: >-
          --health-cmd "pg_isready -U landau_erp -d landau_erp"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v4
      - uses: ./.github/actions/setup-backend

      - name: No model changes are missing a migration
        run: make migrations-check

      - name: Migrations apply to a clean database
        run: uv run python manage.py migrate --noinput

  test:
    name: Tests
    runs-on: ubuntu-latest
    timeout-minutes: 20

    services:
      postgres:
        image: postgres:17
        env:
          POSTGRES_DB: landau_erp
          POSTGRES_USER: landau_erp
          POSTGRES_PASSWORD: landau_erp
        ports:
          - 5432:5432
        options: >-
          --health-cmd "pg_isready -U landau_erp -d landau_erp"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v4
      - uses: ./.github/actions/setup-backend

      - name: Pytest
        # `-n auto` (from scripts/test.sh) is one worker per core: 2-4 here. On
        # a many-core machine the workers exhaust PostgreSQL's lock table --
        # cap them with PYTEST_XDIST_AUTO_NUM_WORKERS: "4" in this step's env.
        run: make test
```

### `.github/workflows/main.yaml` (дословно)

```yaml
name: Build and Deploy

on:
  push:
    branches: ["main"]

permissions:
  id-token: write
  contents: read

jobs:
  quality-gate:
    name: Quality gate
    uses: ./.github/workflows/ci.yaml

  build:
    needs: quality-gate
    uses: niziaskerov/ci-cd/.github/workflows/build-push-to-ecr.yaml@main
    with:
      service_name: legerp-backend
    secrets:
      role_to_assume: ${{ secrets.AWS_ROLE_TO_ASSUME }}

  deploy:
    needs: build
    uses: niziaskerov/ci-cd/.github/workflows/deploy-ecs.yaml@main
    with:
      service_name: legerp-backend
      cluster: legerp
      image_uri: ${{ needs.build.outputs.image_ref_sha }}
    secrets:
      role_to_assume: ${{ secrets.AWS_ROLE_TO_ASSUME }}

concurrency:
  group: deploy-${{ github.ref }}
  cancel-in-progress: false
```

### `.github/actions/setup-backend/action.yml` (дословно)

```yaml
name: Set up backend toolchain
description: Installs uv with a lockfile-keyed cache and syncs the venv from uv.lock.

runs:
  using: composite
  steps:
    - name: Install uv
      uses: astral-sh/setup-uv@v6
      with:
        python-version: "3.13"
        enable-cache: true
        cache-dependency-glob: uv.lock

    - name: Sync dependencies
      shell: bash
      # --frozen: install exactly what uv.lock pins; the dev group comes by default.
      run: uv sync --frozen
```

### Защита веток / обязательные проверки

По файлам: `CODEOWNERS`, `.github/rulesets` — НЕ НАЙДЕНО. Настройки branch protection хранятся на стороне GitHub и из репозитория не видны. README декларирует: «Merge via pull request only — no direct pushes to `main`». Ветки: `main` (основная), `dev`, множество `feature/*`; текущая — `feature/student`.

---

## 6. Окружение команды

- **ОС этой сессии**: Linux 6.12 (Debian GNU/Linux 13 trixie, x86_64), работа внутри контейнера (hostname — container id). Docker доступен (`/usr/bin/docker`).
- **Windows**: признаков НЕ НАЙДЕНО — нет `.ps1/.cmd/.bat`, нет упоминаний Windows в README/docs/scripts/Makefile. Скрипты — bash; `Makefile` использует `find`/`grep`/`awk` (на «голом» Windows не заработает; в WSL/Git Bash — да). Фактически используемую ОС команды отчёт определить не может — **уточнить у людей**.
- **Git**: remote — GitHub (организация заказчика), единственный remote называется `legerp`; автор коммитов — один (Emil Humbatov); commit-стиль — conventional commits (`feat:`, `ci:`).
- **Важно для OpenSpec/Claude-настройки**: в `.gitignore` указаны `.claude/`, `openspec/`, `graphify-out/` (строки 11, 14, 10) — `git ls-files` для `.claude` и `openspec` ничего не показал. То есть OpenSpec-спеки и Claude-настройки сейчас **не версионируются** и не доходят до остальной команды/CI; при этом в `git log` есть упоминания OpenSpec-фич. Нужно подтвердить, намеренно ли (стоит решить до этапа настройки).
- Прочее: `.pre-commit-config.yaml` (ruff check + format, через `.venv/bin/ruff`, `language: system`); `.vscode/settings.json` (только `remote.autoForwardPortsFallback: 0`); `.coverage`, `htmlcov/`, `.mypy_cache/` присутствуют в рабочей папке; `graphify-out/` — граф знаний проекта.

---

## Не найдено / не удалось

- **НЕ НАЙДЕНО**: Playwright (зависимость, конфиг, тесты, `webServer`), любые E2E-тесты; корневой `package.json`, npm/pnpm/yarn lock-файлы, `.nvmrc`, `engines`; фронтенд-код в репозитории; `.claude/agents/`; не-OpenSpec команды в `.claude/commands/`; `fixtures/` в приложениях; PostgreSQL-сервис в `docker-compose.yml`; `CODEOWNERS`/rulesets; признаки Windows в команде; `openspec/schemas/` (форков схемы нет); блоки `rules:` и `operations:` в `openspec/config.yaml` (только закомментированные примеры); поле `workflows` в `openspec config list --json`.
- **Не удалось**: `openspec version --json` — команды `version` в 1.13.0 нет (использован `openspec --version`). Фактические настройки branch protection на GitHub — не видны из репозитория. Содержимое `settings.local.json` и hooks плагина tdd-guard намеренно не раскрывалось/не проверялось. Не проверялось, есть ли `tests.py` в `apps/accounts` (каталога `tests/` там нет). Точное число тестов (заявлено 1500+) не запускалось.
