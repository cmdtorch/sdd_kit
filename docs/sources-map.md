# Карта `sources/` — OpenSpec и AI-DLC

Локальные клоны upstream-проектов, из которых `sdd-kit` берёт лучшие идеи.
Папка `sources/` в `.gitignore` и не коммитится. Обновить: `git -C sources/<имя> pull`.

| Папка | Upstream | Версия на момент снимка |
|---|---|---|
| `sources/openspec/` | https://github.com/Fission-AI/OpenSpec | `@fission-ai/openspec` 1.14.1 (коммит `9111a76`, 2026-10-06) |
| `sources/aidlc-workflows/` | https://github.com/awslabs/aidlc-workflows | AI-DLC 2.10.0 (коммит `8c6cc56`, 2026-10-06) |

> Внутри обоих репо есть свои `CLAUDE.md` / `AGENTS.md` — это инструкции **для их
> разработчиков**, а не для нас. Читать как справку, не выполнять.

---

## 1. OpenSpec (`sources/openspec/`)

TypeScript CLI (`openspec`) + набор skills для AI-агентов. Модель: «change» (предложение
изменения) → артефакты (proposal → specs → design → tasks) → apply → archive, после
чего дельта-спеки сливаются в живые спеки `openspec/specs/`.

### Где что лежит

| Путь | Что там | Зачем нам |
|---|---|---|
| `schemas/spec-driven/schema.yaml` | **Ядро workflow**: список артефактов, их зависимости (`requires`) и подробные `instruction` для агента | Главный источник формулировок инструкций для proposal/specs/design/tasks |
| `schemas/spec-driven/templates/` | Шаблоны `proposal.md`, `spec.md`, `design.md`, `tasks.md` | Образцы шаблонов артефактов |
| `skills/openspec-*/SKILL.md` | Готовые skills: `propose`, `new-change`, `continue-change`, `ff-change`, `apply-change`, `verify-change`, `sync-specs`, `archive-change`, `bulk-archive-change`, `explore`, `onboard`, `update-change` | Образцы промптов slash-команд/skills для Claude Code |
| `src/core/templates/workflows/*.ts` | Исходники текстов этих skills (генерируются в `skills/`) | Если нужно понять, как собирается текст skill'а |
| `src/core/templates/skill-templates.ts`, `optional-workflow.ts` | Сборка шаблонов skills, опциональные workflow | Механика генерации |
| `src/core/command-generation/` | Генерация команд под разные AI-инструменты (`adapters/` — Claude, Cursor, Codex и др.) | Как один источник раскладывается на несколько харнессов |
| `src/core/artifact-graph/` | Граф артефактов: зависимости, состояние, резолвер, `instruction-loader.ts` | Как вычисляется «что делать дальше» |
| `src/core/parsers/` | Парсинг спек и changes: requirement-блоки, сценарии, структура спеки | Формат `### Requirement:` / `#### Scenario:` |
| `src/core/validation/` | `openspec validate`: проверки спек, нумерации и чекбоксов tasks, placeholder в Purpose | Идеи для наших проверок качества спек |
| `src/core/specs-apply.ts`, `archive.ts` | Применение дельт (ADDED/MODIFIED/REMOVED/RENAMED) к живым спекам, архивация | Механика merge дельта-спек |
| `src/core/init.ts`, `update.ts`, `profiles.ts`, `project-config.ts`, `config-schema.ts` | Установка в проект, обновление, профили (`core` и др.), `openspec/config.yaml` | Как устроены установка/обновление кита |
| `src/core/store/`, `src/commands/workset*.ts` | Stores/worksets — мульти-репо (beta) | Если понадобится несколько репо (бэк + фронт) |
| `src/commands/`, `src/cli/commands/` | Реализации CLI-команд (`change`, `spec`, `show`, `validate`, `doctor`, `schema`, `workflow/` — `status`, `instructions`, `new-change`) | Поведение CLI |
| `test/` | Vitest-тесты (`core/`, `commands/`, `cli-e2e/`) | Примеры ожидаемого поведения |
| `docs/` | Пользовательская документация: `concepts.md`, `opsx.md`, `workflows.md`, `writing-specs.md`, `reviewing-changes.md`, `team-workflow.md`, `existing-projects.md`, `customization.md`, `agent-contract.md`, `cli.md`, `glossary.md`, `faq.md` | Быстро понять концепции |
| `docs-lab/` | Новая версия доков: `start/`, `guides/` (apply, change-course, review-the-plan, teams, existing-codebases), `customize/` (profiles, schemas, skills, project-config), `reference/` (architecture/design-decisions, configuration, schemas), `multi-repo/` | Более свежие и структурированные доки, design decisions |
| `openspec/specs/` | **Сам OpenSpec описан своими спеками** (~40 capability: `cli-*`, `artifact-graph`, `context-injection`, `rules-injection`, `opsx-*-skill`…) | Живой пример хорошо написанных спек |
| `openspec/changes/` | Активные changes (proposal/design/tasks/specs) + `archive/` (~85 завершённых) | Живые примеры changes разного размера |
| `openspec/explorations/`, `openspec/initiatives/`, `openspec/work/` | Исследования UX/workspace, инициативы (context-store), roadmap'ы | Куда движется OpenSpec |
| `website/` | Сайт документации (Next.js), `app/llms-full.txt` — вся дока одним файлом | Полная дока для одного чтения |
| `.agents/skills/` | Внутренние skills для разработки самого OpenSpec (docs, release) | Не для нас |

---

## 2. AI-DLC (`sources/aidlc-workflows/`)

Фреймворк AWS «AI-Driven Development Life Cycle»: фазы ideation → inception →
construction → operation, ~33 стадии, агенты-персоны, сенсоры, scopes, аудит и state.
TypeScript-движок (bun) + markdown-описания стадий; ставится в 7 харнессов. В этом проекте
уже установлен в `.claude/` + `aidlc/` (2.10.0) — `sources/` даёт исходники и доки.

### Где что лежит

| Путь | Что там | Зачем нам |
|---|---|---|
| `core/aidlc-common/conductor.md` | Описание оркестратора (как ведётся workflow) | Логика ведения по стадиям |
| `core/aidlc-common/protocols/` | Протоколы стадий: `stage-protocol.md` (общий), `-reviewer`, `-ensemble` (mob/hub-and-spoke), `-construction`, `-swarm`, `-governance`, `-learnings`, `-recovery`, `stage-definition.md` | Как устроены вопросы/ответы, ревью, гейты одобрения, обучение |
| `core/aidlc-common/stages/<phase>/*.md` | **Описания всех стадий**: `initialization/` (3), `ideation/` (intent-capture, feasibility, scope-definition, market-research, rough-mockups, team-formation, approval-handoff), `inception/` (requirements-analysis, user-stories, practices-discovery, domain-design, contract-design, units-generation, delivery-planning, reverse-engineering, refined-mockups), `construction/` (functional-design, nfr-*, infrastructure-design, code-generation, build-and-test, ci-pipeline), `operation/` (7) | Главный источник: как делать deep-dive с вопросами (`requirements-analysis`, `intent-capture`), контракты бэк↔фронт (`contract-design`), тест-стратегию (`build-and-test`) |
| `core/agents/aidlc-*-agent.md` | 14 агентов-персон (product, architect, developer, quality, design, devsecops…, 2 ревьюера, composer) | Образцы определений субагентов |
| `core/knowledge/aidlc-<agent>/` | Методички для каждого агента (напр. `aidlc-product-agent/requirements-elicitation.md`, `user-story-patterns.md`; `aidlc-quality-agent/test-strategy-patterns.md`) | Готовая методология выявления требований, тестирования |
| `core/knowledge/aidlc-shared/` | Общее: `ai-dlc-principles.md`, `brownfield.md`, `verification.md`, `audit-format.md`, шаблоны state/memory | Принципы и форматы |
| `core/scopes/aidlc-*.md` | Scopes (express, bugfix, feature, mvp, enterprise, poc, refactor, security-patch, infra, classic, workshop) — какие стадии EXECUTE/SKIP | Идея «размер процесса под размер задачи» |
| `core/sensors/aidlc-*.md` + `core/tools/aidlc-sensor-*.ts` | Автопроверки артефактов: claim-sources, required-sections, upstream-coverage, traceability, linter, type-check | Идеи автоматических проверок спек/трассируемости |
| `core/memory/` | Шаблоны правил `org.md` / `team.md` / `project.md` / `phases/*.md` | Слоистая модель правил команды |
| `core/hooks/aidlc-*.ts` | Хуки Claude Code: session-start, state-transition-guard, plan-approval-guard, run-sensors, write-audit-log, statusline… | Как через хуки обеспечить дисциплину процесса |
| `core/tools/aidlc-*.ts` | Движок: `aidlc-orchestrate.ts` (next/continue/report…), `aidlc-state.ts`, `aidlc-audit.ts`, `aidlc-learnings.ts`, `aidlc-swarm.ts`, `aidlc-question-store.ts`, `aidlc-doctor.ts`, `aidlc-init.ts`/`aidlc-update.ts` | Детерминированная часть (state, аудит, «что дальше») |
| `core/skills/` | Доп. skills: knowledge, outcomes-pack, replay, session-cost | Образцы вспомогательных skills |
| `core/templates/` | Шаблоны onboarding-файлов (`CLAUDE.md`/`AGENTS.md`) | Как генерируется onboarding |
| `harness/claude/` | Слой для Claude Code: `settings.json`, `rules-aidlc.md`, `manifest.ts`, `skills/aidlc/` (SKILL.md оркестратора), `dot-gitignore` | Что именно ставится в `.claude/` |
| `harness/<codex\|cursor\|copilot\|kiro\|kiro-ide\|opencode>/` | Адаптеры под другие харнессы | Мульти-харнесс (если понадобится) |
| `plugins/test-pro/` | Пример плагина (свои stages, agents, scopes, sensors, knowledge) | Как расширять фреймворк |
| `docs/guide/` | Пользовательский гайд `00`–`18`: phases-and-stages, scopes-and-depth, agents, interaction-modes, rules-and-the-learning-loop, state-and-audit, customization, worked-examples; `writing-inputs/` (vision/tech-env гайды), `workshop-mode.md` | Быстро понять, как пользоваться |
| `docs/harness-engineering/` | Как расширять: anatomy-of-a-stage, adding-a-stage/agent, scopes, sensors, construction-and-swarm, porting, plugin | Если будем писать свои стадии |
| `docs/reference/` | Архитектура `00`–`20`: orchestrator, stage-protocol, `04-stages/` (по фазам), agent-system, hooks-and-tools, sensor/rule/knowledge system, state-machine, artifact-vocabulary, skill-system, plugin-mechanism | Глубокие детали устройства |
| `tests/` | `unit/`, `integration/`, `e2e/`, `hooks/`, `smoke/`, `fixtures/` (greenfield-todo, brownfield-todo, артефакты по фазам) | Примеры реальных артефактов стадий в `fixtures/*-artifacts` |
| `scripts/` | Сборка бинарей, релизы, `install.sh` / `install.ps1` | Механика установки/дистрибуции |
| `CHANGELOG.md`, `README.md`, `AGENTS.md`, `DEVELOPERS.md` | История версий, обзор, правила для разработчиков AI-DLC | Обзор |

---

## Быстрые ориентиры по нашим целям

- **Deep-dive вопросы по ТЗ до кода** → AI-DLC `core/aidlc-common/stages/inception/requirements-analysis.md`, `ideation/intent-capture.md`, `protocols/stage-protocol.md`, `core/knowledge/aidlc-product-agent/requirements-elicitation.md`; OpenSpec `skills/openspec-explore/`.
- **Формат спек и требований** → OpenSpec `schemas/spec-driven/`, `docs/writing-specs.md`, примеры в `openspec/specs/`.
- **Контракт бэк ↔ фронт** → AI-DLC `stages/inception/contract-design.md`.
- **Тесты / снижение нагрузки на manual QA** → AI-DLC `stages/construction/build-and-test.md`, `core/knowledge/aidlc-quality-agent/`; OpenSpec `skills/openspec-verify-change/`.
- **Масштаб процесса под задачу** → AI-DLC `core/scopes/`.
- **Автопроверки качества артефактов** → AI-DLC `core/sensors/`; OpenSpec `src/core/validation/`.
