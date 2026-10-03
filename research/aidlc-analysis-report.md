# Отчёт: устройство AI-DLC в проекте `aidlc-ui`

Дата исследования: 2026-10-03. Режим: только чтение (кроме этого файла ничего не создавалось и не менялось, workflow не запускался, `aidlc-state.md` не трогался, команды `aidlc ...` не выполнялись).

Условные обозначения: **[ФАКТ]** — видно в файлах (путь/строки указаны); **[ВЫВОД]** — моя интерпретация; **[НЕ НАЙДЕНО]** — искал и не обнаружил.
Все пути указаны относительно корня проекта. Абсолютные пути, e-mail и идентификаторы сессий из цитат убраны. Секретов в проверенных файлах не обнаружено (MCP-конфигов `.mcp.json` в проекте нет).

---

## Краткое резюме (15 строк)

1. Установлен **не** классический `aws-samples/aidlc-workflows` (rules / rule-details / `aidlc-docs`), а развитый фреймворк «AI-DLC» **v2.10.0** (`.claude/tools/data/aidlc-stamp.json`, `.claude/tools/data/aidlc-manifest.json`), поставляемый как «workspace shell» в `.claude/` + рабочая область `aidlc/`. Файлов `question-format-guide`, `content-validation`, `aidlc-rules` **нет**; их роль играют разделы `stage-protocol.md` §3 и §10.
2. Точка входа — skill `/aidlc` (`.claude/skills/aidlc/SKILL.md`, 66 КБ) + ~40 тонких skills-«раннеров» на отдельные стадии (`.claude/skills/aidlc-<stage>/`). Отдельных slash-command файлов (`.claude/commands/`) нет.
3. Процесс = **цикл-«трансляция директив»**: LLM-«дирижёр» вызывает движок (`aidlc engine orchestrate next`) → получает ровно одну JSON-директиву → выполняет ход → сообщает результат (`report`) → снова `next`. Маршрутизацию, переходы между стадиями, аудит и состояние ведёт **код** (TypeScript, ~5 МБ в `.claude/tools/`), а не промпт.
4. 33 стадии в 5 фазах (Initialization 3, Ideation 7, Inception 9, Construction 7, Operation 7). Какие из них исполняются, определяет **scope** (11 штатных + пользовательский `web-ui-lean`, 11 стадий исполняются). Глубина (Minimal/Standard/Comprehensive) задаёт ожидаемое число вопросов и объём артефактов; test strategy — объём тестов.
5. **Механизм вопросов** (главное): модель пишет файл `<stage>-questions.md` с вопросами A–E + `X. Other` и пустыми `[Answer]:`; человек отвечает в одном из трёх режимов (Guide me / I'll edit the file / Chat); ответы всегда оказываются в файле; затем обязательны: анализ неопределённости и противоречий → follow-up-вопросы (нумерация продолжается: Q9, Q10…) → «Consolidated Summary Confirmation» (`Looks correct` / `Request changes`) → только после этого генерируются артефакты.
6. Вопросы **не фиксированный чек-лист**: стадия даёт «темы и примеры», количество зависит от depth (Minimal ~2–4, Standard ~5–8, Comprehensive ~8–12+), убывает от Ideation к Construction; «никогда не переспрашивать уже отвеченное».
7. Ответы «заземляются»: в Intent Capture каждый абзац артефакта обязан нести тег источника `[Q3]`, `[desc]`, `[scope]`, `[memory:M1]` или `[assumption]`; **сенсор** `claim-sources` проверяет это скриптом; допущения (`[assumption]`) нельзя молча превращать в факты.
8. Каждая стадия завершается **approval gate** (Approve / Request Changes; после 3 отказов появляется «Accept as-is»), перед ним — независимый **reviewer-субагент** (READY / NOT-READY, у ideation/inception — advisory: одна проходка, результаты показываются человеку).
9. Состояние: `aidlc/spaces/default/intents/<YYMMDD>-<label>/aidlc-state.md` + append-only **audit-шарды** (`audit/<host>-<clone>.md`, ~2000 строк за 7 стадий) + служебная папка `.aidlc-engine/` (хэши, квитанции, review-записи). Сессия возобновляется из этих файлов.
10. Много вещей принуждается **кодом** (hooks в `.claude/settings.json`: Stop-hook не даёт «бросить» стадию, guard запрещает прямые смены состояния, human-turn запрещает «самоответы», review-freeze, plan-approval-guard, сенсоры), но формулировка/качество вопросов, поиск противоречий, расплывчатых ответов — **только промпт**.
11. Реальный прошлый запуск (intent `260929-aidlc-web-ui`): 4 stage с вопросами (13 + 6 + 10 + 8 вопросов, из них follow-up: 5 / 0 / 3 / 0), пятая стадия (requirements-analysis, 8 вопросов) ждёт ответов — это живой пример «ожидания человека».
12. Для переноса в OpenSpec легко переносится: шаблон questions-файла с `[Answer]:`, правила генерации вопросов, анализ ответов, summary-подтверждение, теги источников, ID требований (FR/NFR), reviewer-промпты. Требует скриптов/hooks: блокировка порядка, проверка «все ответы заполнены», проверка тегов, human-presence. Не переносится «как есть»: движок директив, audit-шарды, Bolt/swarm/worktree-машинерия.
13. Заметная избыточность для небольшой работы: 11 стадий ≈ 34 `HUMAN_TURN`, 26 субагентных запусков, пакет «ритуалов» (diary, learnings, summary-confirmation, review, gate); все 12 замечаний ревьюера в двух стадиях были вручную приняты как «Accepted risk».
14. Версия: **2.10.0** (`.claude/tools/data/aidlc-stamp.json`). Способ установки: готовая папка `.claude/` («shell ships in `.claude/`, no setup command», `.claude/CLAUDE.md`). Бинарь `aidlc` должен быть в PATH (`.claude/settings.json` вызывает `aidlc engine ...`); сам бинарь в репозитории **не найден**.
15. Ограничение: я не читал построчно крупные TS-инструменты (`aidlc-lib.ts` 1.2 МБ, `aidlc-orchestrate.ts` 436 КБ и др.) — только заголовки, `grep` по нужным механизмам и выборочные места; см. таблицу «изученные файлы».

---

## Оглавление

1. [Инвентаризация](#1-инвентаризация)
2. [Общая архитектура процесса](#2-общая-архитектура-процесса)
3. [Механизм уточняющих вопросов (главный раздел)](#3-механизм-уточняющих-вопросов)
4. [Approval gates](#4-approval-gates)
5. [Verification gates и трассируемость](#5-verification-gates-и-трассируемость)
6. [Состояние и непрерывность сессий](#6-состояние-и-непрерывность-сессий)
7. [Агенты и роли](#7-агенты-и-роли)
8. [Тестирование](#8-тестирование)
9. [Что принуждается кодом, а что только промптом](#9-что-принуждается-кодом-а-что-только-промптом)
10. [Ключевые промпт-паттерны](#10-ключевые-промпт-паттерны)
11. [Наблюдения для переноса в OpenSpec](#11-наблюдения-для-переноса-в-openspec)
12. [Что не удалось найти / ограничения](#12-что-не-удалось-найти--ограничения)

---

## Список изученных файлов

Отметки: **П** — прочитан полностью, **Ч** — частично (указано что), **Г** — только `grep`/заголовки/статистика.

| Файл | Отметка | Примечание |
|---|---|---|
| `.claude/CLAUDE.md` | П | через контекст сессии (включая импортируемые правила) |
| `.claude/rules/aidlc.md` | П | импорт 7 файлов памяти |
| `aidlc/spaces/default/memory/{org,team,project}.md`, `phases/*.md` | П | через контекст сессии |
| `.claude/settings.json` | П | hooks, permissions |
| `.claude/skills/aidlc/SKILL.md` | Ч | строки 1–340 из ~340 (кроме усечённых длинных строк) |
| `.claude/skills/aidlc/question-rendering.md` | П | |
| `.claude/aidlc-common/conductor.md` | П | |
| `.claude/aidlc-common/protocols/stage-protocol.md` | Ч | строки 1–640, 728–1200; пропущены 640–727 и ~1030–1064 (bookkeeping, ASCII-стандарты) |
| `.../protocols/stage-protocol-governance.md` | П | |
| `.../protocols/stage-protocol-reviewer.md` | Ч | строки 1–140 + grep по вердиктам/квитанциям (всего ~450 строк) |
| `.../protocols/stage-protocol-learnings.md` | Ч | строки 1–50 |
| `.../protocols/stage-protocol-recovery.md` | Ч | строки 44–75 + заголовки |
| `.../protocols/stage-protocol-ensemble.md` | Г | заголовки |
| `.../protocols/stage-protocol-construction.md`, `-swarm.md` | Г | не читал (83 КБ и 76 КБ); описание Bolt/swarm — по ссылкам в других файлах |
| `.../protocols/stage-definition.md` | Ч | строки 1–60 (схема frontmatter) |
| `.../stages/ideation/intent-capture.md` | П | |
| `.../stages/ideation/rough-mockups.md`, `approval-handoff.md` | Ч | первые 80–90 строк |
| `.../stages/inception/requirements-analysis.md` | П | |
| `.../stages/inception/practices-discovery.md` | Ч | строки 60–200 |
| `.../stages/construction/build-and-test.md` | П | строки 1–260 |
| `.../stages/construction/code-generation.md` | Ч | строки 64–260 + заголовки |
| остальные стадии (market-research, feasibility, user-stories, domain-design, units-generation, contract-design, delivery-planning, reverse-engineering, functional-design, nfr-*, infrastructure-design, ci-pipeline, все operation/*) | Г | только размер и состав в stage-graph |
| `.claude/agents/aidlc-product-agent.md`, `aidlc-product-lead-agent.md` | Ч | тело; остальные 12 агентов — только frontmatter + первые ~20 строк |
| `.claude/knowledge/aidlc-shared/{verification,state-template,ai-dlc-principles}.md` | П / Ч | state-template — первые 120 строк |
| `.claude/knowledge/aidlc-shared/audit-format.md` (59 КБ), `worktree-info-schema.md` | Г | не читал |
| `.claude/knowledge/aidlc-product-agent/requirements-elicitation.md` | П | |
| остальные `.claude/knowledge/*` (≈60 файлов) | Г | только имена и размеры |
| `.claude/sensors/*.md` (6) | П | часть строк усечена до 400 символов при выводе |
| `.claude/hooks/*.ts` (19) | Г | заголовочные комментарии; `aidlc-continue-workflow.ts` — ещё строки 475–620 |
| `.claude/tools/*.ts` (76) | Г | `aidlc-log.ts` 1060–1140; остальное — grep |
| `.claude/tools/data/{aidlc-stamp,scope-grid,agent-tiers}.json` | П / Ч | scope-grid — записи `web-ui-lean`, `express` |
| `.claude/tools/data/{stage-graph,aidlc-manifest,aidlc-projection}.json` | Г | |
| `.claude/scopes/aidlc-web-ui-lean.md`, `scopes/*` (12 файлов) | Ч | прочитан только `web-ui-lean`; описание штатных scope — из `settings.json`/SKILL.md |
| `aidlc/spaces/default/intents/260929-aidlc-web-ui/aidlc-state.md` | П | |
| `.../ideation/intent-capture/{questions,intent-statement,stakeholder-map*,reviews/review-01}.md` | П / Ч | stakeholder-map — только grep |
| `.../ideation/rough-mockups/rough-mockups-questions.md` | П | wireframes/user-flow/review не читал |
| `.../ideation/approval-handoff/{questions,decision-log}.md` | Ч | вопросы — почти полностью; initiative-brief не читал |
| `.../inception/practices-discovery/*` | Ч | questions — Q1–Q7; contribution quality-агента — первые 30 строк; остальные 2 contribution не читал |
| `.../inception/requirements-analysis/requirements-analysis-questions.md` | П | |
| `.../verification/phase-check-ideation.md` | П | |
| `.../audit/<shard>.md` (65 КБ, 2033 строк) | Ч | первые ~3.5 КБ + `grep` по событиям + выборочные блоки |
| `.../.aidlc-engine/*` (active-directive, guard-refusals, summary-authorization, sensors, runtime-graph) | Ч | выборочно |

---

## 1. Инвентаризация

### 1.1 Версия, способ установки, точка входа

- **Версия** [ФАКТ]: `frameworkVersion: "2.10.0"`, `distribution: "claude"`, `harnessDir: ".claude"` — `.claude/tools/data/aidlc-stamp.json:1-5`; то же в `.claude/tools/data/aidlc-manifest.json:3`. Файл `.claude/tools/aidlc-version.ts` (258 байт) читает эту версию.
- **Способ установки** [ФАКТ]: `.claude/CLAUDE.md`: «The workspace shell ships in `.claude/` (no setup command); describe what you want to build and it sets up the workflow for you.» Хуки нужно одобрить в Claude Code (`/hooks`) и перезапустить клиент. Манифест контрольных сумм файлов — `.claude/tools/data/aidlc-manifest.json` (38 КБ).
- **Среда выполнения** [ФАКТ]: `.claude/settings.json` вызывает `aidlc engine ...` (в `permissions.allow`: `Bash(aidlc engine *)`, и т.д.). `.claude/CLAUDE.md`: «Framework commands run through `aidlc`; keep that command and its runtime available.» **Самого исполняемого файла `aidlc` в репозитории нет** [НЕ НАЙДЕНО], только TS-исходники инструментов.
- **Точка входа** [ФАКТ]: команда `/aidlc [описание | --status | --stage <slug> | --phase <name> | --scope ... | --depth ... | --test-strategy ... | --review ... | --doctor | --version ...]` → skill `.claude/skills/aidlc/SKILL.md`. Есть упаковочные skills: `/aidlc-init`, `/aidlc-feature`, `/aidlc-mvp` и т.п. (scope «зашит»), `/aidlc-<stage>` (одна стадия в изоляции, `--single`), `/aidlc-compose` (адаптивный планировщик), `/aidlc-knowledge`, `/aidlc-session-cost`, `/aidlc-replay`, `/aidlc-outcomes-pack`.
- Значение `AWS_AIDLC_DEFAULT_SCOPE=classic` в `.claude/settings.json` (`env`) — scope по умолчанию.

### 1.2 Дерево файлов AI-DLC (с назначением)

```
.claude/
├─ CLAUDE.md                         # проектные инструкции + обзор структуры AI-DLC; импортирует rules/aidlc.md
├─ rules/aidlc.md                    # @-импорты 7 файлов памяти (org/team/project + 4 фазы) из aidlc/spaces/default/memory
├─ settings.json                     # permissions, statusLine, env, ВСЕ hooks (см. раздел 9)
├─ settings.local.json.example       # шаблон личных переопределений
├─ skills/
│  ├─ aidlc/SKILL.md                 # оркестратор: цикл «next → действие → report», таблица директив, граф стадий
│  ├─ aidlc/question-rendering.md    # как «спецификации вопросов» рендерятся через AskUserQuestion
│  └─ aidlc-<stage>/ (×33+)          # однострочные раннеры отдельных стадий; scope-раннеры (bugfix, express, feature, mvp, security-patch); init, compose, knowledge, replay, session-cost, outcomes-pack
├─ aidlc-common/
│  ├─ conductor.md                   # «ремесло дирижёра»: как хорошо задавать вопросы, вести diary, Keep/Modify/Redo
│  ├─ protocols/
│  │  ├─ stage-protocol.md           # ГЛАВНЫЙ протокол (1200 строк): voice, структурированные вопросы, approval gate, формат вопросов, state, аудит, глубина, тест-стратегия, валидация контента
│  │  ├─ stage-protocol-reviewer.md  # вызов reviewer-субагента, квитанции, NOT-READY-цикл
│  │  ├─ stage-protocol-ensemble.md  # multi-agent: subagent / pipeline / mob, формат contribution
│  │  ├─ stage-protocol-learnings.md # ритуал «чему научились» перед gate (запись в memory/*.md)
│  │  ├─ stage-protocol-governance.md# проверка трассируемости на границе фаз
│  │  ├─ stage-protocol-recovery.md  # resume, compaction, поврежденное состояние, смена требований
│  │  ├─ stage-protocol-construction.md  # Bolt, units, walking skeleton, autonomy, loop-back B&T (83 КБ, не читал)
│  │  ├─ stage-protocol-swarm.md     # параллельная сборка units в git worktree (76 КБ, не читал)
│  │  └─ stage-definition.md         # схема frontmatter стадий
│  └─ stages/<phase>/<slug>.md       # 33 определения стадий (YAML-frontmatter + Steps + Sensors + Learn)
├─ agents/aidlc-*-agent.md (14)      # персоны: 11 доменных + 2 ревьюера + composer
├─ knowledge/                        # методологическая база: aidlc-shared/ + по папке на каждого агента (~75 файлов)
├─ sensors/aidlc-*.md (6)            # манифесты автоматических проверок (claim-sources, required-sections, upstream-coverage, traceability, linter, type-check)
├─ scopes/aidlc-*.md (12)            # по файлу на scope (+ aidlc-web-ui-lean.md — пользовательский, ещё не закоммичен)
├─ hooks/*.ts (19)                   # скрипты, вызываемые Claude Code на событиях (см. раздел 9)
└─ tools/*.ts (76) + tools/data/*    # «точная механика»: движок директив, состояние, аудит, сенсоры, learnings, swarm, bolt, doctor и т.д.
   └─ data/{stage-graph,scope-grid,aidlc-manifest,aidlc-stamp,...}.json  # скомпилированные данные
aidlc/                               # рабочая область (коммитится в git, кроме курсоров/локальных файлов — см. .gitignore)
├─ active-space, .aidlc-clone-id, .aidlc-sessions/   # курсоры и локальные идентификаторы (не коммитятся)
└─ spaces/default/
   ├─ memory/{org,team,project}.md + phases/*.md + templates/   # слои правил (аддитивные), источник «Mandated/Forbidden»
   ├─ knowledge/ (documents/, documentkb/)    # пользовательские документы (в этом проекте пусто/не создано)
   ├─ codekb/                                 # reverse-engineering для brownfield (не создан)
   └─ intents/
      ├─ intents.json, active-intent
      └─ 260929-aidlc-web-ui/                 # «запись» (record) одной задачи
         ├─ aidlc-state.md, project-description.json, runtime-graph.json
         ├─ audit/<host>-<clone>.md           # append-only журнал событий
         ├─ ideation/<stage>/..., inception/<stage>/...   # артефакты + <stage>-questions.md + memory.md (diary)
         ├─ verification/phase-check-ideation.md
         └─ .aidlc-engine/                    # служебное: active-directive.json, reviews/, sensors/, summary-authorization/, guard-refusals/, stop-hook/
```

### 1.3 Не найдено в проекте [НЕ НАЙДЕНО]
`AGENTS.md`, `docs/` (на него ссылаются CLAUDE.md и протоколы), `.mcp.json`, `.claude/commands/`, `aidlc-docs/`, `aidlc-rules/`, `rule-details/`, `question-format-guide.md`, `content-validation.md`, `OUTCOMES.md`, исполняемый `aidlc`. Как приём вместо `aidlc-docs` используется `aidlc/spaces/<space>/intents/<record>/`.

---

## 2. Общая архитектура процесса

### 2.1 Фазы и стадии (из скомпилированного графа)

[ФАКТ] источник: таблица «compiled stage graph» в `.claude/skills/aidlc/SKILL.md` (раздел «Stage Graph») и frontmatter файлов `.claude/aidlc-common/stages/**`. Колонка `Mode` — топология выполнения (inline = дирижёр сам «надевает» роль; subagent/pipeline/mob = реальный запуск агентов).

| # | slug | Фаза | Execution | Ведущий агент | Mode |
|---|---|---|---|---|---|
| 0.1 | workspace-scaffold | Initialization | ALWAYS | orchestrator | inline |
| 0.2 | workspace-detection | Initialization | ALWAYS | orchestrator | inline |
| 0.3 | state-init | Initialization | ALWAYS | orchestrator | inline |
| 1.1 | intent-capture | Ideation | ALWAYS | product | inline |
| 1.2 | market-research | Ideation | CONDITIONAL | product | inline |
| 1.3 | feasibility | Ideation | CONDITIONAL | architect | inline |
| 1.4 | scope-definition | Ideation | ALWAYS | product | inline |
| 1.5 | team-formation | Ideation | CONDITIONAL | delivery | inline |
| 1.6 | rough-mockups | Ideation | CONDITIONAL | design | inline |
| 1.7 | approval-handoff | Ideation | ALWAYS | delivery | inline |
| 2.1 | reverse-engineering | Inception | CONDITIONAL (brownfield) | developer | pipeline |
| 2.2 | practices-discovery | Inception | CONDITIONAL | pipeline-deploy | subagent (hub-and-spoke) |
| 2.3 | requirements-analysis | Inception | ALWAYS | product | inline |
| 2.4 | user-stories | Inception | CONDITIONAL | product | mob |
| 2.5 | refined-mockups | Inception | CONDITIONAL | design | inline |
| 2.6 | domain-design | Inception | CONDITIONAL | architect | inline |
| 2.7 | units-generation | Inception | ALWAYS | architect | inline |
| 2.8 | contract-design | Inception | CONDITIONAL | architect | inline |
| 2.9 | delivery-planning | Inception | ALWAYS | delivery | inline |
| 3.1 | functional-design | Construction (per unit) | CONDITIONAL | architect | inline |
| 3.2 | nfr-requirements | Construction | CONDITIONAL | architect | inline |
| 3.3 | nfr-design | Construction | CONDITIONAL | architect | inline |
| 3.4 | infrastructure-design | Construction | CONDITIONAL | aws-platform | inline |
| 3.5 | code-generation | Construction | ALWAYS | developer | subagent |
| 3.6 | build-and-test | Construction | ALWAYS | quality | inline |
| 3.7 | ci-pipeline | Construction | CONDITIONAL | pipeline-deploy | inline |
| 4.1–4.7 | deployment-pipeline, environment-provisioning, deployment-execution, observability-setup, incident-response, performance-validation, feedback-optimization | Operation | CONDITIONAL | pipeline-deploy / aws-platform / operations / quality | inline |

Что значит ALWAYS/CONDITIONAL:
- [ФАКТ] В frontmatter поле `execution: ALWAYS|CONDITIONAL` + свободное поле `condition` (`.claude/aidlc-common/protocols/stage-definition.md`, таблица полей). Например, `rough-mockups`: «Execute when user-facing UI is part of the initiative … Skip for non-UI, API-only, or infrastructure-only initiatives».
- [ФАКТ] **Фактическое решение «исполнять/пропустить» принимает scope-grid, а не `execution`**: в `.claude/tools/data/scope-grid.json` для `web-ui-lean` стадия `scope-definition` (помечена ALWAYS) имеет `"SKIP"`. [ВЫВОД] «ALWAYS» — это «по умолчанию для штатных scope», а не гарантия; custom scope может отключить.
- Пропуск также возможен динамически: стадия может доложить `report --stage <slug> --result skipped --reason "<reason>"`, если её условие доказуемо не выполнено (`SKILL.md`, раздел «Branching a run-stage on its gate»; `conductor.md`).
- Порядок определяется графом (`requires_stage`, `consumes` в frontmatter), движок сам даёт `next_stage`; LLM запрещено «угадывать» следующую стадию (`stage-protocol.md:188-192`).
- `/aidlc --stage <slug>` / `--phase <name>` позволяют прыгать (помечаются `[S]`); при прыжке вперёд ритуал текущей стадии (learnings) всё равно отрабатывает (`stage-protocol.md:134`).

### 2.2 Scope: что выбирается и что меняет

- [ФАКТ] Scope = файл `.claude/scopes/aidlc-<name>.md` (frontmatter: `name`, `depth`, `keywords`, `guard_policy`, …) + запись `stages: {slug: EXECUTE|SKIP}` в `.claude/tools/data/scope-grid.json` (компилируется из `scopes:`-списков в frontmatter стадий командой `aidlc engine graph compile`; `SKILL.md` «Scope-to-Stage Mapping»).
- [ФАКТ] Штатные scope и число исполняемых стадий (таблица в `SKILL.md`): bugfix 9/33, classic 18, enterprise 33, express 10, feature 33, infra 13, mvp 23, poc 8, refactor 10, security-patch 10, workshop 26 (workshop по умолчанию ещё с TestStrategy=Minimal).
- [ФАКТ] **Выбор scope**: из флага `--scope`, из ключевых слов в описании (`keywords` в scope-файле) либо через адаптивного composer-агента (`/aidlc compose "<task>"`): он оценивает 5 «энтропий» (неоднозначность намерения, структурная неопределённость кодовой базы, неопределённость верификации, риск, неразрешённые допущения), предлагает сетку EXECUTE/SKIP с причинами, человек подтверждает (Approve / Edit / Reject), и затем сетка записывается как новый scope (`SKILL.md`, «Composing a workflow plan»).
- [ФАКТ] В этом проекте scope `web-ui-lean` создан composer'ом: `.claude/scopes/aidlc-web-ui-lean.md` (251 байт; `depth: Standard`, `guard_policy: relaxed`) и запись в `scope-grid.json` (git: `?? .claude/scopes/aidlc-web-ui-lean.md`, `M .claude/tools/data/scope-grid.json`). Исполняется 11 стадий: 0.1–0.3, 1.1, 1.6, 1.7, 2.2, 2.3, 3.5, 3.6, 3.7 (`aidlc/spaces/default/intents/260929-aidlc-web-ui/aidlc-state.md`, «Stages to Execute: 0.1, 0.2, 0.3, 1.1, 1.6, 1.7, 2.2, 2.3, 3.5, 3.6, 3.7»).
- **Depth** [ФАКТ] (`stage-protocol.md §8`, строки 875–931): Minimal / Standard / Comprehensive; по умолчанию из scope (enterprise → Comprehensive; feature, mvp, classic, workshop, infra → Standard; poc, bugfix, refactor, security-patch, express → Minimal). Переопределяется `--depth`, при подтверждении scope («Change depth») или на любом approval gate. Влияет на: число вопросов, детальность артефактов (примеры в §8 «Depth-Level Examples»: например Requirements: 5–10 / 15–30 / 30+ требований).
- **Test strategy** [ФАКТ] (`stage-protocol.md:933-968`): по умолчанию равна depth, может быть задана scope или `--test-strategy`. Minimal = «Nyquist»: 1 тест на требование + 1 happy-path на компонент (~5–15 тестов); Standard = 5–8 тестов на компонент, unit+integration, пирамида 75/20/5; Comprehensive = 10–15 на компонент, все типы. «Soft guideline».
- **Review class** [ФАКТ] (`--review <class>`, `stage-protocol-reviewer.md` §12a): `adversarial` (цикл refute-and-repair до `reviewer_max_iterations`, по умолчанию 2; для Construction) или `advisory` (одна проходка, замечания зачитываются человеку на gate; по умолчанию для ideation/inception); scope/флаг могут только понизить до `none`.
- **Guard Policy** (strict / relaxed / off), **Sensors**, **Learnings**, **Summary Confirmation** — четыре «рычага ритуала», записаны в `aidlc-state.md → Scope Configuration` (в этом проекте: relaxed / on / on / on, все «from scope web-ui-lean»). Их меняет только человек (`CLAUDE.md`, раздел Guards).
- [ВЫВОД] Механика scope/depth/test-strategy — ортогональные «ручки»: scope = какие стадии, depth = сколько вопросов/деталей, test strategy = сколько тестов, review class = насколько строг ревьюер, ceremony-флаги = сколько ритуалов.

### 2.3 Проход одной стадии (общий шаблон)

[ФАКТ] `SKILL.md` («Branching a run-stage on its gate», пункт `gate: true`) + `stage-protocol.md §2`:

1. Загрузить правила (`load-steering`/`rules_content`), прочитать персону и знания лидера (`inline_context_paths`) — блокирующая предпосылка.
2. Прочитать stage-файл и `consumes` (входные артефакты).
3. Вопросы → ответы → анализ → follow-up → **Consolidated Summary Confirmation** (если включено).
4. Сгенерировать артефакты (`produces`), сенсоры срабатывают на запись.
5. Reviewer-субагент (если задан), запись квитанций.
6. Ритуал learnings (если модуль включён) — отдельный ход человека.
7. `report --result awaiting-approval` → approval gate → `approved` / `rejected` → (`revised` → gate заново).
8. Строка прогресса: `Progress: [X]/[S] in-scope stages complete ([N]/33 overall) | ...`.

Инициализационные стадии 0.1–0.3 выполняются автоматически без вопросов и gate.

---

## 3. Механизм уточняющих вопросов

> Это главный раздел. Сначала — обзор (мои слова), затем — **дословные цитаты правил** (вставлены автоматически из исходных файлов, с указанием файла и диапазона строк), затем реальные примеры из прошлых запусков.

### 3.0 Где живут правила вопросов (аналоги «question-format-guide» и «content-validation»)

[ФАКТ] Отдельных файлов `question-format-guide`/`content-validation` нет. Правила вопросов распределены так:

| Что | Файл / раздел |
|---|---|
| Формат вопросов, режимы ответа, summary-подтверждение, анализ ответов, противоречия, антиуверенность | `.claude/aidlc-common/protocols/stage-protocol.md` §3 «Question Format» (строки 339–587) |
| Как «спецификация вопроса» превращается в нативный интерактивный вопрос Claude Code (`AskUserQuestion`), ограничения 4×4 | `.claude/skills/aidlc/question-rendering.md` (157 строк) |
| Какие темы спрашивать на конкретной стадии, источники/теги, допущения | `.claude/aidlc-common/stages/<phase>/<stage>.md`, шаг «Generate Clarifying Questions» |
| Нормативный стиль для дирижёра («Asking good questions») | `.claude/aidlc-common/conductor.md` |
| «Content validation» (Mermaid, pre-creation checklist, шаблоны, экранирование) — это про артефакты, не про ответы | `stage-protocol.md` §10 (строки 1001–1073) |
| Разговорный тон (не использовать внутренний жаргон) | `stage-protocol.md` «Talking to the user (the voice contract)», строки 5–86 |
| Регистр допустимых источников, теги `[Q<n>]`, `[assumption]` | `.claude/aidlc-common/stages/ideation/intent-capture.md` (Steps 2, 4, 5) + `.claude/sensors/aidlc-claim-sources.md` |

### 3.1 На каких стадиях задаются вопросы и сколько раундов

[ФАКТ] Вопросы — свойство **стадии**, а не отдельного этапа процесса. Файл вопросов — один из `produces` стадии (`intent-capture-questions`, `rough-mockups-questions`, `approval-handoff-questions`, `requirements-analysis-questions` …). Исключение — инициализационные стадии 0.1–0.3: вопросов нет, gate нет.

Принцип убывания (`stage-protocol.md`, «Depth-aware question generation», строки 356–366): Ideation — больше всего вопросов (бизнес/стратегия: «why? for whom?»), Inception — умеренно (требования/архитектура), Construction — «исключительно, а не рутинно», Operation — точечно.

Фактические раунды в прошлом запуске [ФАКТ, `aidlc/spaces/default/intents/260929-aidlc-web-ui/**/**-questions.md`]:

| Стадия | Всего вопросов | Раунд 1 | Follow-up (раунд 2) | Consolidated Summary | Состояние |
|---|---|---|---|---|---|
| intent-capture | 13 | Q1–Q8 | Q9–Q13 (5 шт., заголовок `## Follow-up questions`) | `Looks correct` | отвечены |
| rough-mockups | 6 | Q1–Q6 | нет | `Looks correct` | отвечены |
| approval-handoff | 10 | Q1–Q7 | Q8–Q10 (3 шт.) | `Looks correct` | отвечены |
| practices-discovery | 8 | Q1–Q8 | нет | `Looks correct` | отвечены |
| requirements-analysis | 8 | Q1–Q8 | — | нет | **7 из 8 `[Answer]:` пусты — ожидание человека** (Q1 содержит ответ `A, B (front ts, back in python)`) |

[ВЫВОД] Раундов не «N по расписанию»: раунд 1 = файл вопросов по темам стадии; раунд 2…k = follow-up по обнаруженным неясностям/противоречиям, **пока не останется неопределённостей** (в протоколе нет жёсткого лимита раундов; лимит есть только у ревью — `reviewer_max_iterations: 2` — и у циклов «Request Changes» — после 3-го добавляется «Accept as-is»). Дополнительно к обычным раундам существуют: (a) «Consolidated Summary Confirmation» (отдельный мини-вопрос), (b) «Assumption Confirmation» (только Intent Capture, если остались допущения), (c) вопросы gate, (d) вопрос learnings «Anything to add for next time?».

### 3.2 Как ИИ решает, что спрашивать

[ФАКТ] Четыре источника решения (все — инструкции модели; кода, который «придумывает» вопросы, нет):

1. **Темы стадии** — в stage-файле есть список тем/примеров, объявленный «руководством, а не сценарием» (`stage-protocol.md:358`: «Stage files list topic areas and example questions — they are guidance, not a script»). Пример Intent Capture (`intent-capture.md`, Step 2): проблема; клиент и боль; критерии успеха; триггер; стейкхолдеры; кто решает scope; требования к коммуникации; «соответствует ли выбранный scope границе продукта». Пример Requirements Analysis (`requirements-analysis.md`, Step 5): проверка полноты по шести измерениям (функциональные; нефункциональные; пользовательские сценарии; бизнес-контекст; технический контекст; атрибуты качества) и поиск пробелов в каждом.
2. **Depth** — целевой диапазон количества (Minimal ~2–4, Standard ~5–8, Comprehensive ~8–12+), но «не жёсткие ограничения» (см. цитату §3 ниже): расплывчатое описание багфикса заслуживает больше вопросов, чем 2; чрезвычайно ясные требования enterprise — меньше.
3. **Контекст и предыдущие ответы** — «Never re-ask an answered question»: перед добавлением вопроса модель обязана прочитать все `**/*-questions.md` и аудит (`QUESTION_ANSWERED`) записи, и если тема закрыта — вопрос не задаётся; если остаётся неоднозначность — задаётся **узкий follow-up с упоминанием предыдущего ответа**.
4. **Фаза** (см. 3.1) и **принцип проактивности**: Requirements Analysis, Step 6: «PROACTIVE: Always generate clarifying questions unless requirements are exceptionally clear and complete across all six dimensions».

Дополнительные критерии качества самих вопросов [ФАКТ, `stage-protocol.md:387-390`]: вопрос должен быть **самодостаточным** (раскрывать идентификаторы вроде FR3 словами; одна строка контекста «почему спрашиваю»; формулировки на языке пользователя, не фреймворка). В реальных файлах это реализовано строкой `Why this is asked: …` под каждым вопросом (ср. примеры 3.8) [ФАКТ, наблюдается во всех 5 файлах], хотя в stage-protocol строки «Why this is asked:» как обязательного поля **нет** [НЕ НАЙДЕНО — это конвенция, возникшая из правила «one line of context»].

Дополнительное правило явных опций «не определено» (`intent-capture.md` Step 2): «Every question MUST include an explicit `Not yet defined`, `None`, `Not identified`, or `Not applicable` option … so a narrow intent never forces the user to select invented detail.»

### 3.3 Формат вопросов (дословно: stage-protocol.md §3, строки 339–587)

Ниже — полный текст раздела «3. Question Format» без изменений (вставлен командой `sed -n 339,587p`). Он содержит: файл-источник истины; обязательные опции A–E + X; режимы Guide me / I'll edit the file / Chat; Consolidated Summary; проверку полноты; правила «не переспрашивать», «самодостаточные вопросы», анализ ответов, обработку ошибок, обнаружение противоречий, «антиуверенность».

````markdown
## 3. Question Format

When a stage needs to ask the user questions:

### Question flow (all question counts)

**The questions file is always the source of truth.** Regardless of how many questions a stage has, the flow is:

**Step 1: Create the questions file** in the appropriate `<record>/` directory with full [Answer]: tag format:
- Include options A-E as appropriate for each question
- EVERY ordinary question MUST end with `X. Other (please specify)` as the final
  option. The dedicated Consolidated Summary Confirmation added in Step 3a is
  the sole exception: its two semantic options are intentionally unlettered.
- Leave all `[Answer]:` tags blank

For multi-select questions (where user may choose more than one option), add "(select all that apply)" to the question text. The user writes multiple letters: `[Answer]: A, B, E`

### Depth-aware question generation

Stage files list **topic areas and example questions** — they are guidance, not a script. The agent determines what to actually ask based on three factors:

1. **Depth level** (from `aidlc-state.md` → `**Depth**`) — sets the expected question volume
2. **Project context** — what's already known from prior stages, codebase analysis, and the user's description
3. **Phase progression** — Questions naturally decrease as the lifecycle advances:
   - **Ideation**: Most questions. Business/strategic focus ("why?", "for whom?", "what market?")
   - **Inception**: Moderate questions. Design/architectural focus ("what requirements?", "which patterns?")
   - **Construction**: Minimal questions. By this point, decisions should be made. Questions are **exceptional, not routine** — only when the agent detects genuine gaps that prior stages didn't cover (e.g., a unit-specific edge case not addressed in Domain Design). Not a full Q&A session.
   - **Operation**: Occasional targeted questions only where operational parameters weren't established earlier

| Depth | Target Range | Guidance |
|-------|-------------|----------|
| Minimal | ~2-4 per stage | Ask only what's essential to proceed. Skip questions where the answer can be reasonably inferred from context, prior stages, or codebase analysis. Minimal follow-ups unless answers are contradictory or dangerously vague. |
| Standard | ~5-8 per stage | Cover the stage's topic areas. Follow up on ambiguities. Probe for missing details when answers are incomplete. |
| Comprehensive | ~8-12+ per stage | Cover all topic areas in depth. Generate additional context-aware questions beyond the reference set — edge cases, compliance, scale, failure modes, cross-cutting concerns. Actively seek unknowns the user hasn't considered. |

**These are guidelines, not hard caps.** The agent MUST use judgment:
- A Minimal bugfix with a vague one-line description warrants more questions — don't blindly cap at 2.
- A Comprehensive enterprise feature with crystal-clear requirements warrants fewer — don't pad with noise.
- Prior stage outputs reduce what needs asking. If requirements-analysis already captured NFR targets, construction stages shouldn't re-ask.
- **Never re-ask an answered question.** Before adding any question to the file, check whether the current record already answers it:
  - Recursively read every `<record>/**/*-questions.md` file. Interpret each filled `[Answer]:` with its question text and options; question files are co-located with stage artifacts rather than stored at the record root.
  - For audit-only interactions, read every `<record>/audit/*.md` shard. Pair a `DECISION_RECORDED` prompt only with a later `QUESTION_ANSWERED` row in the same interaction scope: `Stage`, `Unit`, `Attempt Generation`, and `Workflow` must match wherever those fields are present. Preserve append order within one shard. Across shards, equal timestamps are causally unordered; if multiple prompts could own an answer or their order is ambiguous, do not infer an answer. Ask a narrow follow-up that names the candidate prior answer instead. The answer row's free-form `Details` alone does not identify the question.
  If the latest applicable prior answer resolves the topic, do not re-emit the question — proceed on the recorded answer. If it leaves a real ambiguity or conflicts with newer evidence, ask a narrow follow-up that names the prior answer ("Earlier you set auth to mTLS — does that also cover the Kafka listener?") rather than re-opening the whole question. A user who has answered, especially one who stated an answer is final, must not see the same question again.
- Follow-up questions are always justified regardless of depth — ambiguity must be resolved.
- Contradiction detection and resolution remains MANDATORY at all depth levels.

**How to apply**: When creating the questions file in Step 1, use the stage file's topic areas and examples as a starting point. Generate context-appropriate questions within the depth range. For Minimal, focus on the fewest questions that unblock artifact generation. For Comprehensive, proactively explore areas the user may not have considered.

**Questions must be self-explanatory.** A question the user cannot answer without asking you to rephrase it is a defect, not a saved token. Every question MUST stand on its own:
- **Expand every identifier in each question that uses it.** Never present a bare reference like `FR3`, `url1`, `NFR-2`, or `unit-4` as if the user carries the mapping. Write the thing it names, then the tag once in parentheses — "the requirement that the export must finish within 5 minutes (FR3)" — not "Is FR3 still correct?".
- **Give each question one line of context** — why it is being asked or what depends on the answer — when the reason is not obvious from the prompt itself. "We found two conflicting retention values in the requirements (30 days vs 90 days); which governs?" beats "What is the retention period?".
- **Prefer a concrete phrasing over an abstract one.** Ask about the actual decision in the user's domain terms, not the framework's internal vocabulary. If you would need to explain the question when asked to rephrase it, phrase it that clear way the first time.

**Step 2: Offer the user a choice of interaction mode:**
```question
prompt: "I've created [N] questions at `[file path]`. How would you like to answer them?"
header: Questions
multiSelect: false
options:
  - label: Guide me
    description: Walk through each question interactively here
  - label: I'll edit the file
    description: I'll fill in the answers in the file directly
  - label: Chat
    description: Discuss freely — I'll extract decisions from our conversation
```

On a numbered-prose harness, this interaction-mode question has four visible
numbered lines: `1. Guide me`, `2. I'll edit the file`, `3. Chat`, and the final
`4. Other`. Mentioning Other in a nearby tip or sentence does not satisfy the
structured-question contract.

Log the user's mode choice to `<record>/audit/<host>-<clone>.md` using the Question interaction log format.

**Step 3a: If "Guide me" (interactive mode):**
- Present questions as structured questions in batches (batching limits are harness-specific — see the question-rendering annex)
- For questions with 5+ options (single-select or multi-select): present ALL answer options, splitting across multiple structured questions if the harness's per-question option limit requires it (e.g., options A-D first, then options E+ in a follow-up). The user must see every option to make an informed choice. The file retains the full option set as the authoritative record.
- Every structured question offers an "Other" escape (built into the harness UI or rendered as an explicit option per the annex). In interactive mode, if the user selects "Other" for any question, treat it as a request to discuss that question further — engage in conversation, then ask for their final answer before continuing the batch. Explicitly tell the user this before the first batch: "Select 'Other' on any question to discuss it before answering."
- After each batch of answers, IMMEDIATELY write the answers back to the questions file (update each `[Answer]:` tag)
- Log each batch to `<record>/audit/<host>-<clone>.md` using the Question interaction log format. Generate a fresh ISO timestamp for each batch entry.
  CRITICAL: Each batch entry requires its own `date -u` Bash call. Do NOT reuse the timestamp from the mode choice or prior batch.
- Continue until all questions are answered
- **Consolidated summary before generation**: The checkpoint below applies only when `directive.ceremony.summary_confirmation === "on"`. When it is `"off"`, generate directly from the answers with no confirmation prompt, confirmation entry, or receipt. With it on, after all questions have been
  answered, present a consolidated summary of all answers as unordered bullets (never a numbered list). Then run
  `aidlc engine review-brief summary --stage "<directive.stage>" --questions-file "<questions-path>"`;
  add `--unit "<directive.unit>"` on a per-unit stage. Print its compact
  decision brief verbatim before presenting this structured question. The brief
  names the stage, the questions file and artifacts being confirmed, why
  confirmation is required now, and the exact effect of both choices:
  ```question
  prompt: "Does this all look correct before I generate the artifact?"
  header: Confirm
  multiSelect: false
  options:
    - label: Looks correct
      description: Generate the artifact from these answers
    - label: Request changes
      description: Revise one or more answers before generation
  ```
  Before presenting it, append or update a dedicated **Consolidated Summary Confirmation**
  entry in `<slug>-questions.md` with this prompt, both options **without
  file-letter prefixes**, and a blank `[Answer]:` tag:
  ```markdown
  - Looks correct
  - Request changes

  [Answer]:
  ```
  This confirmation entry is the exception to ordinary file-backed A-E/X
  labels. Fill its tag only after the user responds, storing exactly
  `[Answer]: Looks correct` or `[Answer]: Request changes`. Strip any source
  letter, chat number, punctuation, or option description before writing;
  `[Answer]: A. Looks correct` and `[Answer]: 1. Looks correct` are invalid.
  Before presenting it, record the checkpoint prompt:
  `aidlc engine log decision --stage <slug>
  --checkpoint summary-confirmation --questions-file "<questions-path>"
  --decision "Does this all look correct before I generate the artifact?"
  --options "Looks correct,Request changes"`; add `--unit "<directive.unit>"`
  for a per-unit stage and `--single` for an isolated run. Never ask for this confirmation as bare prose: the harness must render an answerable structured
  question before the turn ends.

  After the human responds, first write the exact choice to the confirmation
  `[Answer]:` tag, then record the human-backed receipt with
  `aidlc engine log answer --stage <slug>
  --checkpoint summary-confirmation --questions-file "<questions-path>"
  --details "<exact choice>"` using the same `--unit` / `--single` identity.
  The tool refuses a self-selected answer, a response without a matching prompt
  record and later human turn, or a questions file whose stored choice differs.
  An explicit **Other** selection follows the §1 Other-escape rule: discuss it,
  re-present the confirmation, and leave the tag and receipt untouched. Any
  reply that matches neither **Looks correct**, **Request changes**, nor Other
  follows the non-matching checkpoint rule in §1.

  If the choice is **Request changes**, append a sibling
  `## Requested Changes Feedback` question with a blank `[Answer]:`, ask the
  direct free-text question
  **"What should change?"**, and END THE TURN. Do not revise anything until the
  human provides that feedback. Record the feedback through the ordinary
  `aidlc-log.ts decision` / `answer` pair, write it to the follow-up tag, update
  the relevant answer tags, reset the confirmation entry to a blank `[Answer]:`,
  and re-present the summary. Only proceed to artifact generation after the
  human explicitly chooses **Looks correct** and the receipt command succeeds.
  Each later Request Changes cycle appends another sibling feedback section;
  retain those sections in chronological order. If the stage has an
  `Assumption Confirmation` section, replace its post-summary body and answer
  when follow-up questions are converted; do not append a duplicate heading.
  Follow-up questions change the confirmed semantic content, so present the
  consolidated summary again and record a new confirmation receipt before
  re-saving artifacts or requesting review.

**Step 3b: If "I'll edit the file" (self-guided mode):**
- Tell the user: "Edit the file at `[file path]`. When you're done, send **done** or **ready** and I'll continue."
- WAIT for the user to send a completion signal (any message like "done", "ready", "finished", "continue", etc.)
- Do NOT read the file or proceed until the user sends a completion signal
- After the completion signal, read the answers, present their consolidated
  summary, and run the same persisted **Looks correct / Request changes**
  checkpoint from Step 3a only when `directive.ceremony.summary_confirmation === "on"`. Editing the source file does not waive an enabled checkpoint; when it is `"off"`, generate directly with no checkpoint or receipt.

**Step 3c: If "Chat" (freeform mode):**
- Engage in open-ended conversation about the stage's topic
- Ask questions naturally and let the user elaborate at their own pace
- Extract decisions and answers from the conversation as they emerge
- To end the conversation, tell the user: "When you're ready to proceed, say **done** and I'll summarize our decisions."
- After the conversation reaches natural resolution, write all extracted answers back to the questions file (update each `[Answer]:` tag with the decided value, timestamp, and `**Mode:** chat`)
- Present a summary of extracted decisions, then, only when `directive.ceremony.summary_confirmation === "on"`, persist and use the same **Looks correct / Request changes** structured confirmation from Step 3a before proceeding; when it is `"off"`, generate directly with no checkpoint or receipt
- Best for: exploratory stages, brainstorming, when questions need discussion before answering

Users can switch modes mid-stage. For example, start with "Guide Me" for the first few questions, then say "let me just chat about the rest."

**Step 4: Verify completeness** — Read the file and confirm ALL `[Answer]:` tags are filled in. If any are blank, present the unanswered questions as structured questions and write answers back. Do NOT proceed with partial answers.

The file is the authoritative record for all decision traceability and audit purposes.

### Consuming grounded artifacts

When an upstream artifact carries inline source tags or an
`Assumptions & Open Questions` section, preserve that epistemic status:

- A source tag records provenance; it does not grant permission to strengthen
  or broaden the claim.
- Content tagged `[assumption]` remains an assumption in every downstream
  artifact until the user confirms it through that downstream stage's
  questions file.
- Never silently promote an assumption, open question, unselected option, or
  workflow metadata into a confirmed requirement, scope boundary, stakeholder,
  metric, or constraint.
- When downstream work needs an unresolved item, ask a follow-up and record the
  answer in the current stage's questions file.

### Answer analysis (MANDATORY)
After collecting answers, analyze ALL responses for:
- Vague answers: "mix of", "not sure", "depends", "probably"
- Contradictions between answers
- Missing details needed for the next step

If ANY ambiguity found: create follow-up questions and resolve before proceeding.
**When in doubt, ask.** Incomplete answers lead to poor designs.

**Write every pending question into the questions file before you end the turn —
including follow-ups and chat-mode questions.** The questions file (with blank
`[Answer]:` tags for anything still open) is not just the audit record: the
forwarding-loop **Stop hook** reads it to tell a genuine human-wait (a question
you asked and are waiting on) apart from a stage you abandoned mid-work. If you
ask the user something but leave no blank `[Answer]:` tag in `<slug>-questions.md`,
the hook cannot see the question is pending and will nudge you to keep going
(and on a non-interactive run the loop is only bounded by the block cap). So:
add the open question to the file with a blank tag *before* you stop to wait,
in every mode (guided, self-guided, chat). This does not apply in autonomous
Construction, where the loop is meant to keep running without you.

### Error handling for invalid/missing answers
When processing user answers from question files:
- **Missing answers**: If any [Answer]: tag is still blank or contains only underscores, list the unanswered questions and ask the user to complete them before proceeding.
- **Invalid answers**: If an answer does not match any provided option (A-E, X) and is not a clear free-text response for "Other", ask the user to clarify which option they intended.
- **Ambiguous answers**: If an answer like "maybe B" or "either A or C" is given, ask the user to commit to a single choice and explain their reasoning.

### Contradiction detection (MANDATORY)
After all answers are collected, cross-check the full answer set for:
- **Scope mismatch**: e.g., user says "keep it simple" but also requests enterprise-grade features
- **Risk mismatch**: e.g., user says "security is not a concern" but describes handling sensitive data
- **Technology conflicts**: e.g., user requests offline-first but also requires real-time collaboration
- **Timeline vs. scope conflicts**: e.g., user wants MVP timeline but full-feature scope

When contradictions are detected:
1. Present the specific contradictory answers side by side
2. Explain why they conflict
3. Ask a targeted follow-up question to resolve the contradiction
4. Do NOT proceed until contradictions are resolved

### Overconfidence prevention
- Default to asking, not assuming. Never proceed with ambiguity.
- If an answer seems incomplete, probe deeper.
- Red flags that require follow-up:
  - Single-word answers to open-ended questions
  - "Whatever you think is best" or "up to you" — ask what outcome they care about most
  - Contradictory signals between different answers
  - Answers that dodge the question or change the subject
  - Relaxing, lowering, or disabling a previously defined quality target (e.g.
    a test coverage threshold) instead of meeting it
- When a user defers to AI judgment, reframe: "I want to make sure the design reflects YOUR priorities. Could you tell me [specific aspect]?"

### Plan and question file location
Plan files and question files are co-located with their stage artifacts, not in a centralized `plans/` directory. For example, user story plan questions live at `<record>/inception/user-stories/user-stories-questions.md` alongside the user story artifacts. This co-location improves discoverability — all inputs, questions, and outputs for a stage are found in the same directory.

### Conditional Construction question protocol

Within-Bolt questions, per-unit iteration, lifecycle receipts, waves, and iteration ordering live in
`.claude/aidlc-common/protocols/stage-protocol-construction.md`.
Load it on the first Construction-phase directive of the session and on every `invoke-swarm` (the engine lists it in `directive.protocol_modules`).
````

### 3.4 Рендеринг вопросов в Claude Code (дословно: question-rendering.md, весь файл)

Ключевые следствия [ВЫВОД]: (1) в файле `*-questions.md` форматом правят A–E/X; (2) в интерактивном режиме «Guide me» тот же вопрос показывается через `AskUserQuestion` (максимум 4 вопроса в вызове, максимум 4 опции, минимум 2) — поэтому вопросы с 5+ опциями дробятся; (3) в `AskUserQuestion` всегда есть встроенный пункт «Other», который здесь трактуется как «хочу обсудить» — модель не должна записывать его как ответ.

````markdown
# Question Rendering — Claude Code harness annex

This file defines how THIS harness renders the structured questions that
`aidlc-common/protocols/stage-protocol.md` § "Structured questions" requires.
The protocol and stage files are harness-neutral: they say *present a
structured question* and carry a fenced ` ```question ` spec block. This annex
is the one place that binds that contract to a concrete mechanism.

## Never echo the spec (non-negotiable)

A ` ```question ` fenced block is **INPUT to the `AskUserQuestion` tool, never
output to render**. The orchestrator MUST translate every ` ```question ` spec
into an actual `AskUserQuestion` tool call, and MUST NEVER echo, print, paste,
or "quote back" the fenced block, or any of its field lines (`prompt:`,
`header:`, `multiSelect:`, `options:`, `label:`, `description:`), into the chat
transcript. The user must never see the raw fence; they see only the native
`AskUserQuestion` prompt.

Echoing the fence as literal text is a **protocol violation**, not a stylistic
choice. It:

- produces a non-interactive wall of text the user cannot click or select;
- loses the built-in "Other" escape hatch that `AskUserQuestion` provides;
- is inconsistent with every correct rendering elsewhere in the same session.

If you find yourself about to write a triple-backtick `question` block into your
reply, STOP: that content belongs inside an `AskUserQuestion` tool call, not in
the message body.

This applies to **every** structured-question site, including but not limited to:

- approval gates (every stage completion);
- the questions interaction-mode choice (Guide me / I'll edit the file / Chat);
- the ladder prompt (autonomy mode after the walking skeleton);
- halt-and-ask on Bolt failure (Retry / Skip / Abort);
- consolidated-summary confirmation before artifact generation;
- the §13 learnings gate (keep / heading / promote-to-team).

(Literal ` ```question ` fences legitimately remain in framework documentation
like THIS file and the stage-protocol because they are authoring specs, not chat
output. In the stage-protocol those specs are normative prompt templates: when
the surrounding instruction requires a question, their content MUST be rendered
through this annex. This annex's mapping examples are illustrative. The
prohibition is about echoing raw fences in live orchestration turns.)

## Mechanism

On Claude Code, every structured question renders via the **`AskUserQuestion`
tool**: the fenced ` ```question ` spec is the input, the tool call is the
output, never the other way around. Map the spec fields 1:1:

| Spec field | AskUserQuestion field |
|------------|----------------------|
| `prompt` | `questions[0].question` |
| `header` | `questions[0].header` |
| `multiSelect` | `questions[0].multiSelect` |
| `options[].label` | `questions[0].options[].label` |
| `options[].description` | `questions[0].options[].description` |

Example — this spec:

```question
prompt: "[Stage Name] complete. How would you like to proceed?"
header: Approval
multiSelect: false
options:
  - label: Approve
    description: Continue to [next stage]
  - label: Request Changes
    description: Provide revision feedback
```

renders as:

```
AskUserQuestion({
  questions: [{
    question: "[Stage Name] complete. How would you like to proceed?",
    header: "Approval",
    multiSelect: false,
    options: [
      { label: "Approve", description: "Continue to [next stage]" },
      { label: "Request Changes", description: "Provide revision feedback" }
    ]
  }]
})
```

## Mandatory consolidated-summary checkpoint

This checkpoint applies only when `directive.ceremony.summary_confirmation === "on"`. When it is `"off"`, generate directly from the answers: no summary-confirmation prompt, confirmation entry, or receipt. Required stage questions and other human decisions, including Plan Approval and the stage approval gate, are unchanged.

After guided or chat file-backed Q&A (and whenever a stage definition requires
it explicitly, such as Requirements Analysis), the stage protocol requires a
separate confirmation before any stage artifact is generated. Append or update
`## Consolidated Summary Confirmation` in the questions file with the summary,
the prompt, both options without A/B file-letter prefixes, and a blank
`[Answer]:` tag, then render the two semantic options through
`AskUserQuestion`:

```
AskUserQuestion({
  questions: [{
    question: "Does this all look correct before I generate the artifact?",
    header: "Confirm",
    multiSelect: false,
    options: [
      {
        label: "Looks correct",
        description: "Generate the artifact from these answers"
      },
      {
        label: "Request changes",
        description: "Revise one or more answers before generation"
      }
    ]
  }]
})
```

This is a mandatory human checkpoint, not the stage approval gate. Before
rendering it, run the checkpoint-specific `aidlc-log.ts decision` command from
`SKILL.md`, including the exact `--questions-file` and any `--unit` / `--single`
identity. END THE TURN after presenting it and wait for the user's response.
Then persist `[Answer]: Looks correct` or `[Answer]: Request changes` exactly
and run the matching checkpoint-specific `aidlc-log.ts answer` command. Strip
any source letter, punctuation, and option description before writing:
`[Answer]: A. Looks correct`, `[Answer]: 1. Looks correct`, `[Answer]: A`, and
a self-selected answer are invalid. On Request changes, ask **"What should change?"**
and END THE TURN again; do not update any answer until that feedback
arrives. Then record the feedback, update the affected answers, reset this tag
to blank, and present the consolidated summary again. Do not generate the
artifact until the file contains the human's explicit `[Answer]: Looks correct`
and the receipt command succeeds. Never merge this checkpoint with the later
reviewer, learnings, or approval steps.

## Harness-specific behaviors

- **Approval gate `[next stage]`**: on an approval question, render the
  `Continue to [next stage]` placeholder from the run-stage directive's
  `next_stage` field verbatim (e.g. `Continue to NFR Requirements`); render
  `Complete workflow` when `next_stage` is null. Never guess the next stage.
- **Batching limits**: max 4 questions per `AskUserQuestion` call, max 4
  options per question, and **at least 2 options per question**. For 5+
  options, split across multiple calls (options A-D, then E+); the questions
  file retains the full option set as the authoritative record. Never send a
  one-option call: the tool rejects it before the user can answer.
- **"Other" escape**: `AskUserQuestion` has a built-in "Other" option, always
  available — do NOT add an explicit Other option to the spec's options list
  for interactive batches. (Questions *files* still end every question with
  `X. Other (please specify)` per protocol §3 — the file format is
  harness-neutral.)
- **Answer capture**: the user's selection returns as the exact option label;
  record it verbatim (protocol: never summarize User Input).
- **Long prompts**: the question body renders at full terminal width and wraps
  gracefully (multi-line wrap verified on macOS before each release) — see
  `knowledge/aidlc-shared/worktree-info-schema.md` for the long-path fallback.
````

### 3.5 Правила Intent Capture: реестр источников, теги, допущения (дословно: intent-capture.md, Steps 2–5)

Это самый «жёсткий» вариант работы с вопросами. Правило применяется к Intent Capture (остальные стадии используют обычный §3).

````markdown
### Step 2: Generate Clarifying Questions

Create `<record>/ideation/intent-capture/intent-capture-questions.md`.

Start the file with a `## Sources` register. Every source is a top-level
Markdown list item using exactly one of these forms:

```markdown
- [desc] Initial description: "<JSON-escaped authoritative user directions>"
- [scope] Workflow-selected scope: `<scope>`.
- [memory:M<n>] `aidlc/spaces/<active-space>/memory/{org,team,project}.md#<exact H2 heading>`: "<JSON-escaped exact single-line rule>"
```

For `[desc]`, authoritative user directions are the exact initial description
with its terminal `<document>...</document>` block removed and outer whitespace
trimmed. The sensor derives that value from
`<record>/project-description.json` (falling back to the legacy `Project` state
field) and verifies `[scope]` against `aidlc-state.md`. It resolves each memory
path against the active space's stage-loaded `org.md`, `team.md`, or
`project.md` and requires the quoted rule to exactly match a visible entry under
the named H2. Entries inside comments or code fences are not sources.

The register is the complete permitted-source universe for this stage. Do not
register background knowledge, common practice, or an inference as a source.

Then create consecutively numbered `## Q<n>.` questions covering:
- What business problem are we solving?
- Who is the customer (internal/external)? What pain are they experiencing?
- What does success look like? What metrics matter?
- What is the trigger for this initiative (market pressure, tech debt, regulation, opportunity)?
- Who are the key stakeholders and what does each care about?
- Who decides scope or priority, and who influences those decisions?
- Are there communication requirements or a reporting cadence?
- The workflow was started with the scope in `[scope]`; does that scope match
  the user's intended product boundary?

Every question MUST include an explicit `Not yet defined`, `None`,
`Not identified`, or `Not applicable` option as appropriate so a narrow intent
never forces the user to select invented detail.
The scope question MUST distinguish confirming the workflow-selected scope
from defining a different product boundary. Use the [Answer]: tag format from
stage-protocol.md. Include A-E options with X (Other) as final option. Leave
all [Answer]: tags blank. Follow-up questions continue the same `Q<n>`
numbering so their source ids remain stable.

Then follow the unified question flow from stage-protocol.md section 3: offer Guide Me / Edit File / Chat modes.

### Step 3: Collect and Analyze Answers

After all answers collected:
1. Confirm ALL [Answer]: tags are filled in
2. Run ambiguity detection and contradiction analysis
3. Create follow-up questions if needed

### Step 4: Generate Artifacts

Apply this grounding contract to both artifacts:

1. Permitted sources are only `[desc]`, confirmed `[Q<n>]` answers (including
   follow-ups), `[scope]`, and registered `[memory:M<n>]` entries.
2. If the initial description contains any `<document>` block, `[desc]` is
   questions-file provenance only and MUST NOT appear in either deliverable.
   Ground every request- or document-derived artifact claim through a confirmed
   `[Q<n>]`. Without a pasted document, `[desc]` may ground the user's request.
3. Every substantive claim block — a paragraph, list item, or table data row —
   MUST carry one or more inline source tags.
4. `[scope]` proves only workflow-selected scope. Label it
   `workflow-selected`; use the scope-confirmation question's `[Q<n>]` tag for
   any user-confirmed product boundary.
5. Never turn an unselected option into an exclusion or requirement.
6. Unsupported content is omitted or elicited with a follow-up. If it is
   useful to preserve but cannot be confirmed, put it only under
   `## Assumptions & Open Questions` and tag each entry `[assumption]`.
7. Each artifact MUST contain `## Assumptions & Open Questions`. Write `None.`
   when there are none.

Create `<record>/ideation/intent-capture/intent-statement.md` containing:
- **Problem Statement** — What business problem is being solved
- **Target Customer** — Who benefits and how
- **Success Metrics** — Measurable outcomes
- **Initiative Trigger** — Why now
- **Initial Scope Signal** — Show the workflow-selected scope separately from
  the user-confirmed product boundary

Create `<record>/ideation/intent-capture/stakeholder-map.md` containing:
- Key stakeholders and their interests
- Decision-makers vs. influencers
- Communication requirements

Every stakeholder and communication row carries its source tag in a `Source`
column. Never invent a stakeholder role, interest, authority, or communication
requirement. For required but unresolved fields, write
`Unknown (open question) [assumption]`; omit optional fields.

### Step 5: Resolve Assumptions

If both `## Assumptions & Open Questions` sections contain `None.`, continue.
Otherwise:

1. Create `## Assumption Confirmation` in `intent-capture-questions.md` if it
   is absent. Otherwise, reuse that single section, replacing its assumption
   list and options and resetting `[Answer]:` to blank. List every assumption
   and these options: `A. Accept assumptions` and
   `B. Convert to follow-up questions`.
2. Present those two options as a structured question, log it through the
   standard question decision/answer pair, END YOUR TURN, and wait.
3. On `Accept assumptions`, fill the confirmation answer exactly as
   `[Answer]: A. Accept assumptions` and retain the `[assumption]` labels.
   Acceptance does not turn an assumption into fact.
4. On `Convert to follow-up questions`, fill that answer, append consecutively
   numbered `Q<n>` follow-ups, collect and confirm their answers, and revise
   both artifacts. Only when `directive.ceremony.summary_confirmation === "on"`, re-present the consolidated summary, reset the single
   post-summary confirmation to a blank `[Answer]:`, and record a fresh standard
   summary decision/answer receipt before continuing. Only after that new receipt
   succeeds may you re-save the artifacts, rerun the reviewer, and continue to
   completion. When it is `"off"`, save the revised artifacts directly with no summary checkpoint or receipt. The separate Assumption Confirmation remains required. If assumptions remain, reuse and reset the single
   `## Assumption Confirmation` section and repeat this step.

Do not invoke the reviewer or proceed to completion while an assumption
confirmation `[Answer]:` is blank.

````

### 3.6 Requirements Analysis: шаги 5–9 (дословно)

````markdown
### Step 5: Completeness Analysis

Evaluate coverage across six dimensions:
1. **Functional requirements** — Core behaviors, features, use cases
2. **Non-functional requirements** - Performance, security, scalability, reliability, observability
3. **User scenarios** — User workflows, edge cases, error scenarios
4. **Business context** — Goals, success metrics, stakeholders, constraints
5. **Technical context** — Integration points, platform requirements, technology constraints
6. **Quality attributes** — Maintainability, testability, accessibility, usability

Identify gaps in each dimension.

### Step 6: Generate Clarifying Questions

PROACTIVE: Always generate clarifying questions unless requirements are exceptionally clear and complete across all six dimensions.

Create `<record>/inception/requirements-analysis/requirements-analysis-questions.md` using the [Answer]: tag format from stage-protocol.md. Include context-appropriate questions with A-E options. Every ordinary clarifying question MUST end with `X. Other (please specify)` as the final option; the later Consolidated Summary Confirmation is the unlettered exception. Leave all [Answer]: tags blank.

Then follow the unified question flow from stage-protocol.md section 3: offer the user a choice between guided (interactive) and self-guided (file edit) modes. In either case, ensure all answers are written to the file before proceeding.

### Step 7: Collect and Analyze Answers

After all answers are collected:
1. Read `<record>/inception/requirements-analysis/requirements-analysis-questions.md`
2. Confirm ALL `[Answer]:` tags are filled in. If any are blank, present the unanswered questions as structured questions and write answers back. Do NOT proceed with partial answers.
3. Then proceed with ambiguity detection and contradiction analysis on the full answer set.

- MANDATORY ambiguity detection: scan ALL responses for vague language ("mix of", "not sure", "depends", "probably", "maybe")
- Check for contradictions between answers
- Identify missing details needed for requirements generation

### Step 8: Follow-Up Questions

If ANY ambiguity, vagueness, or contradictions found in Step 7:
- Create follow-up questions targeting the specific ambiguities
- Resolve all ambiguities before proceeding
- When in doubt, ask. Incomplete answers lead to poor designs.

### Step 9: Confirm the Consolidated Summary

This step applies only when `directive.ceremony.summary_confirmation === "on"`. When it is `"off"`, proceed directly to Step 10 with no summary-confirmation prompt, entry, or receipt.

MANDATORY PRE-GENERATION STOP when enabled: After every original and follow-up answer is
filled, append or update a `## Consolidated Summary Confirmation` entry in
`<record>/inception/requirements-analysis/requirements-analysis-questions.md`.
The entry MUST contain:

- An unordered bullet list summarizing every answer (never number these summary
  items; the following structured question starts its own response keys at 1)
- `Does this all look correct before I generate the requirements artifact?`
- `Looks correct` and `Request changes` options
- A blank `[Answer]:` tag

Present that prompt as a structured question using the
`Looks correct` / `Request changes` options from `stage-protocol.md`, then end
the turn and wait for the user's response. Use the checkpoint-specific
`aidlc-log.ts decision` / `answer` commands from that protocol, including this
questions-file path; fill the confirmation `[Answer]:` before recording the
answer receipt. If the user requests changes, ask **"What should change?"** and
end the turn again. Do not update any answer until the user supplies that
feedback. Then record the feedback, update the affected answers, reset the
confirmation `[Answer]:` to blank, and repeat this step. Do NOT create
`requirements.md` until the confirmation entry contains the user's explicit
`Looks correct` answer and the receipt command succeeds.

### Step 10: Generate Requirements

Create `<record>/inception/requirements-analysis/requirements.md` containing:
- **Intent analysis** — What the user is trying to achieve (goals, not just features)
- **Functional requirements** — Organized by feature area or domain. Give every requirement a stable `FR{n}` ID (for example `FR1`) and every sub-requirement an `FR{n}.{m}` ID (for example `FR1.2`).
- **Non-functional requirements** — Performance, security, scalability, reliability, and observability targets. Give every requirement a stable `NFR{n}` ID (for example `NFR3`).
- **Constraints** — Technical, business, and organizational constraints
- **Assumptions** — Documented assumptions with rationale
- **Out of scope** — Explicitly excluded items
- **Open questions** — Any remaining uncertainties for later stages

These IDs are permanent traceability keys. Downstream stages must preserve
them exactly rather than renumbering or replacing them with prose references.

Keep review lifecycle content in the separate review file returned by the
review request. A newly generated `requirements.md` must not contain a
`## Review` section, a pending-review placeholder, or a reviewer verdict.
Finish the primary requirements content before requesting its review; do not
change it after a terminal review receipt to remove a placeholder.

````

### 3.7 Где сохраняются вопросы и ответы; теги и маркеры

[ФАКТ] (`stage-protocol.md:581` «Plan and question file location» и реальные файлы)

| Объект | Расположение | Формат |
|---|---|---|
| Вопросы + ответы стадии | `<record>/<phase>/<stage>/<stage>-questions.md`, где `<record>` = `aidlc/spaces/<space>/intents/<YYMMDD>-<label>` (рядом с артефактами стадии, а не в общей папке `plans/`) | `## Q<n>. <вопрос>` → строка `Why this is asked: …` (конвенция) → список `- A. … - X. Other (please specify)` → тег `[Answer]:` |
| Тег ответа | строка `[Answer]:` сразу после списка опций | пустой = не отвечено; допустимо несколько букв `A, B, E` для multi-select («(select all that apply)»); текст после буквы/через дефис = пояснение для `X. Other` и уточнения (в реальных файлах: `A, B, C, D (for teamlead…), X - …`); в режиме Chat — значение + timestamp + `**Mode:** chat` (`stage-protocol.md:502`) |
| Follow-up | в **том же файле** под заголовком `## Follow-up questions`, продолжение нумерации (`Q9…`), в заголовке вопроса: `(follow-up to Q1)` | то же |
| Подтверждение «всё верно» | в конце файла `## Consolidated Summary Confirmation` | две опции **без** букв: `- Looks correct` / `- Request changes` и `[Answer]:` со **строго** одним из двух значений. `[Answer]: A. Looks correct`, `1. Looks correct`, самоответ — недопустимы |
| Допущения (Intent Capture) | `## Assumption Confirmation` | опции `A. Accept assumptions` / `B. Convert to follow-up questions` |
| Реестр источников | `## Sources` в начале questions-файла Intent Capture | `- [desc] Initial description: "…"`, `- [scope] Workflow-selected scope: \`web-ui-lean\`.`, `- [memory:M<n>] …` |
| Тег источника в артефакте | в конце каждого абзаца/пункта/строки таблицы | `[Q1]`, `[Q9]`, `[desc]`, `[scope]`, `[memory:M1]`, `[assumption]` (только в разделе `## Assumptions & Open Questions`) |
| Аудит каждого вопроса | `<record>/audit/<host>-<clone>.md` | `DECISION_RECORDED` (до показа: что спросили, какие опции) → `HUMAN_TURN` (хук) → `QUESTION_ANSWERED` (после: точный выбор); для summary — `SUMMARY_CONFIRMATION_RECORDED` с SHA-256 файла |
| Квитанция summary | `<record>/.aidlc-engine/summary-authorization/<stage>/stage.json` | `{stage, questions_file, questions_sha256, choice: "Looks correct", recorded_at, id…}` (пример см. раздел 6) |

Единственная идентичность вопроса — его `Q<n>` внутри файла стадии; в downstream-документах ссылаются как `[Q3]` (в decision-log — с префиксом стадии: `[IC-Q9]`, `[RM-Q4]`, `[AH-Q8]`).

### 3.8 Как ИИ проверяет ответы (валидация)

Весь «интеллект» проверки — в инструкциях модели; код помогает на краях (см. 3.9). Содержание проверок — цитаты в 3.3 (разделы «Answer analysis», «Error handling for invalid/missing answers», «Contradiction detection», «Overconfidence prevention»); в сжатом виде:

1. **Полнота**: Step 4: «Read the file and confirm ALL `[Answer]:` tags are filled in … Do NOT proceed with partial answers.» Пустой тег или только подчёркивания = не отвечено.
2. **Валидность**: ответ не из A–E/X и не осмысленный текст для Other → просим уточнить, какую опцию имели в виду. Ответ «maybe B»/«either A or C» → просим выбрать один и объяснить.
3. **Расплывчатость**: сканирование ответов на «mix of», «not sure», «depends», «probably», «maybe» (`requirements-analysis.md` Step 7 — «MANDATORY ambiguity detection»). Красные флаги (`stage-protocol.md` «Overconfidence prevention»): односложные ответы на открытые вопросы, «whatever you think is best»/«up to you», противоречивые сигналы, уход от вопроса, **ослабление ранее заданной цели качества**. На делегирование ИИ — переформулировать вопрос в терминах приоритетов пользователя.
4. **Противоречия**: перекрёстная проверка всего набора ответов по четырём классам — scope mismatch, risk mismatch, technology conflicts, timeline-vs-scope. При обнаружении: показать противоречивые ответы рядом, объяснить конфликт, задать целевой follow-up, **не продолжать**, пока не разрешено.
5. **Заземление** (Intent Capture): каждое утверждение артефакта с тегом источника → скриптовый сенсор `claim-sources` (см. раздел 5/9) + ревьюер (judges semantics).
6. **Двойное подтверждение смысла**: Consolidated Summary Confirmation (человек видит итоговый список всех ответов и подтверждает).

### 3.9 Что происходит при неполных/противоречивых ответах

| Ситуация | Реакция | Чем обеспечена |
|---|---|---|
| Пустой `[Answer]:` | список неотвеченных, просьба заполнить; «Do NOT proceed» | промпт; плюс **Stop-hook** считает пустой тег признаком «ждём человека» и не заставляет модель «двигаться дальше» (`.claude/hooks/aidlc-continue-workflow.ts` ~строки 480–545, регулярка `/\[Answer\]:[ \t]*_*[ \t]*$/m`) |
| Расплывчатый/противоречивый ответ | follow-up-вопросы в тот же файл (`## Follow-up questions`), нумерация продолжается; затем **новое** summary-подтверждение (если follow-up менял подтверждённый смысл, «present the consolidated summary again and record a new confirmation receipt», `stage-protocol.md:485-487`) | промпт + квитанция привязана к SHA-256 файла (код) |
| «Other» в интерактивном режиме | это просьба обсудить; обсуждение → повторный вопрос; **не записывать** «Other» как ответ и не вызывать `report`/`log answer` (`stage-protocol.md` «Non-matching checkpoint replies», строки 212–233) | промпт + guard-ы report/log |
| Ответ человека не совпал ни с одним вариантом gate/summary | процитировать ответ, сказать «не совпало», повторно показать тот же вопрос со всеми вариантами | промпт; «deterministic report/state guards enforce the same boundary» (`stage-protocol.md:229`) |
| `Request changes` на summary | спросить «What should change?», **завершить ход**, дождаться текста, записать как отдельный `## Requested Changes Feedback`, обновить ответы, сбросить тег подтверждения, показать summary заново | промпт + аудит; без `Looks correct` + квитанции генерация запрещена кодом (`SUMMARY_ARTIFACT_UNAUTHORIZED`, см. раздел 6) |
| Остались допущения (`[assumption]`) | `Assumption Confirmation`: «Accept assumptions» (ярлыки сохраняются) или «Convert to follow-up questions» (допущения → новые Q, пересбор артефактов и новый summary); пока тег пуст — ни ревьюер, ни завершение | промпт + `claim-sources` сверяет, что оставленные допущения точно совпадают с подтверждёнными |
| Пользователь делегирует («выбери сам», «go with recommended») | трактуется как разовая инструкция на **эту** стадию; автономность никогда не выводится (`stage-protocol.md:135`) | промпт |
| Модель задала вопрос, но не записала его в файл | Stop-hook не видит ожидания и «подталкивает» продолжать — отсюда правило «Write every pending question into the questions file before you end the turn» (`stage-protocol.md:537-547`) | код (hook) — это пример того, как промпт-правило подкреплено кодом |

[ФАКТ] Явного числового лимита раундов follow-up нет. Остановка — через gate/ревью (см. раздел 4) и через пользователя («Accept as-is» после 3 отказов).

### 3.10 Как ответы используются дальше (трассировка)

[ФАКТ] Цепочка в реальном запуске:
1. `intent-capture-questions.md` (`[Answer]:`) → `intent-statement.md` и `stakeholder-map.md`, где каждое утверждение несёт `[Q1]`, `[Q9]`, `[Q11]` … (см. 3.11, пример B). Опции, которые человек НЕ выбрал, не становятся требованиями («Never turn an unselected option into an exclusion or requirement»).
2. `approval-handoff` собирает `initiative-brief.md` + `decision-log.md` со ссылками `[IC-Q9]`, `[RM-Q4]`, `[AH-Q8]` и разделом `## Superseded earlier statements` (какие более поздние ответы сузили более ранние).
3. `practices-discovery-questions.md` → `team-practices.md`, `discovered-rules.md`, а после Approve **детерминированный инструмент** `practices-promote` дописывает правила в `memory/team.md` и `memory/project.md` (`ALWAYS …`/`NEVER …`), видны в `aidlc/spaces/default/memory/project.md` (5 Mandated + 1 Forbidden, события `PRACTICES_AFFIRMED`: Mandated Rules Appended: 5, Forbidden Rules Appended: 1).
4. `requirements-analysis-questions.md` → `requirements.md` с постоянными ID `FR{n}`, `FR{n}.{m}`, `NFR{n}` — «permanent traceability keys. Downstream stages must preserve them exactly» (`requirements-analysis.md` Step 10).
5. Правила downstream: «Content tagged `[assumption]` remains an assumption in every downstream artifact until the user confirms it through that downstream stage's questions file» (`stage-protocol.md:519-521`).
6. Память: `memory/*.md` (org → team → project → phase) попадают в контекст каждой следующей стадии (`CLAUDE.md`, `rules/aidlc.md`), так что подтверждённые принципы действуют как «стоячие» ответы.

### 3.11 Реальные примеры из прошлых запусков

Пример A. Intent Capture, раунд 1 (вопросы с ответами — вопросы Q1, Q6, Q8). Источник: `aidlc/spaces/default/intents/260929-aidlc-web-ui/ideation/intent-capture/intent-capture-questions.md`, строки 1–20, 73–110.

````markdown
# Intent Capture Questions

## Sources

- [desc] Initial description: "build a web UI for aidlc"
- [scope] Workflow-selected scope: `web-ui-lean`.

## Q1. What problem should the web UI solve?

Why this is asked: "a web UI for aidlc" does not say what is painful today, and the answer decides what the UI must show or do.

- A. Workflows are hard to follow in the terminal, so I want to see progress, stages, and artifacts visually
- B. Answering stage questions and approving gates in the terminal is clumsy, so I want to do that in a browser
- C. Both A and B: see progress and also drive the workflow from the browser
- D. Making aidlc easier for people who are not comfortable with a terminal
- E. Not yet defined
- X. Other (please specify)

[Answer]:A, B, C, D (for teamlead, so they didnt install repo), X - Also dont use AWS services so need my own UI instead of AWS services

## Q6. Who decides scope and priority for this UI, and who only influences it?

Why this is asked: it tells us who must approve the plan and who is only consulted.

- A. I decide alone
- B. I decide, and teammates give input
- C. A team lead or product owner decides
- D. Maintainers of aidlc decide what is accepted
- E. Not yet defined
- X. Other (please specify)

[Answer]:B, X - in future teamleads and CEO can give his ideas, but in mvp only me

## Q7. Do you need any reporting or communication cadence for this work?

Why this is asked: it decides whether we plan status updates beyond the approval gates.

- A. No, the approval gates are enough
- B. Short status note after each stage
- C. Regular updates to a team or stakeholder group (please describe in Other)
- D. Not applicable
- E. Not yet defined
- X. Other (please specify)

[Answer]:X - Actualy i dont know. But better do work more specified

## Q8. Does the workflow-selected scope (`web-ui-lean`: a short run of design, requirements, build, test, and CI) match the product boundary you intend?

Why this is asked: the plan was sized before we knew what the UI covers, so we should confirm it fits.

- A. Yes, confirm this scope as the product boundary
- B. No, I want a smaller boundary (for example a read-only viewer)
- C. No, I want a larger boundary (for example driving workflows and managing several projects)
- D. Not yet defined
- X. Other (please specify)

[Answer]:A, X - But im not quaitly shure

````

Что видно [ВЫВОД]: человек отвечает «A, B, C, D … X - …» (мультивыбор + свободный текст), в Q8 говорит «не уверен»; в Q6 — «B, X — в MVP только я», что противоречит B. Эти сигналы ИИ превращает в follow-up-вопросы Q9–Q13 (пример B).

Пример B. Follow-up-раунд той же стадии (Q9, Q11, Q13 — ответы на неясности/противоречия) и итоговое подтверждение. Источник: тот же файл, строки 111–126, 139–151, 164–185.

````markdown
## Follow-up questions

These follow up on answers that were unclear or pulled in different directions.

## Q9. You wrote "don't use AWS services, so I need my own UI". What exactly should the UI avoid or replace? (follow-up to Q1)

Why this is asked: the phrase could mean several different things, and each changes what we build.

- A. The UI must not depend on any AWS-hosted service (no AWS hosting or AWS-provided UI)
- B. The UI replaces an AWS-provided interface for aidlc that you do not want to use
- C. Only the UI itself should be free of AWS; the aidlc tool underneath is still AWS's and that is fine
- D. Not yet defined
- X. Other (please specify)

[Answer]:A, B, X - I just want use aws aidlc without bounding to any AWS service

## Q11. For the first version (MVP), what should the UI do? (follow-up to Q1, Q3, Q8)

Why this is asked: you asked for both viewing and driving workflows, and said you are not quite sure the scope fits. The first version can be much smaller than the full idea.

- A. View only: see workflows, stages, progress, and produced documents
- B. View, plus approve or reject stage gates in the browser
- C. View, approve gates, and also answer stage questions in the browser
- D. Everything: full control of workflows from the browser, as in the terminal
- E. Not yet defined
- X. Other (please specify)

[Answer]: Option A for now, but for future will bu option D

## Q13. In Q6 you chose "I decide, and teammates give input" and also wrote "in the MVP only me". Which applies to the first version? (follow-up to Q6)

Why this is asked: the two answers differ on whether teammates are consulted.

- A. Only I decide and give input for the MVP; teammates, team leads, and the CEO come in later
- B. I decide, and teammates give input even in the MVP
- C. Not yet defined
- X. Other (please specify)

[Answer]:A

## Consolidated Summary Confirmation

Does this all look correct before I generate the artifact?

- Looks correct
- Request changes

[Answer]: Looks correct
````

Как эти ответы попали в артефакт (трассировка): `ideation/intent-capture/intent-statement.md`, раздел `## Initial Scope Signal` (фрагмент):

````markdown
## Initial Scope Signal

- Workflow-selected scope: `web-ui-lean`, a short run of design, requirements, build, test, and CI (workflow-selected). [scope]
- User-confirmed product boundary: the requester confirmed the workflow-selected scope but said they are not quite sure it fits. [Q8]
- First version: view only (see workflows, stages, progress, and produced documents). [Q11]
- Later versions: full control of workflows from the browser, including answering questions and approving gates. [Q11] [Q10]
- First version runs locally; shared access through one web address for the team is wanted later. [Q10]
- For the first version, the requester alone decides scope and priority; teammates, team leads, and the CEO give input later. [Q6] [Q13]

## Assumptions & Open Questions

None.
````

И реакция независимого ревьюера на этот артефакт (`ideation/intent-capture/reviews/review-01.md`, вердикт READY, 5 замечаний R-01…R-05; ниже — заголовок и первое замечание R-01):

````markdown
## Review

**Verdict:** READY
**Reviewer:** aidlc-product-lead-agent
**Date:** 2026-09-30T19:09:20Z
**Iteration:** 1

### Findings

| ID | Severity | Location | Finding | Required action | Status |
````

Пример C. Стадия `approval-handoff`: ИИ возвращает человеку его собственную неуверенность как вопрос с планом Б (Q3), а на «подумай и предложи» из rough-mockups возвращается явным подтверждением предложения (Q2). Источник: `ideation/approval-handoff/approval-handoff-questions.md`, строки 1–52; а затем follow-up Q9/Q10 (строки 106–129).

````markdown
# Approval & Handoff Questions

Context from earlier stages (not re-asked): only you decide for the first version; market research, feasibility, scope definition and team formation were skipped in this plan; the first version is view only and runs locally.

These questions close the points the earlier checks flagged, so the plan you approve to move on has no loose ends.

## Q1. Do the intent statement and the rough mockups reflect the vision you have for the first version?

Why this is asked: this is the go/no-go decision for moving from ideas into detailed requirements.

- A. Yes, go ahead to requirements
- B. Mostly, but I want a change first (please describe in Other)
- C. No, we should rethink the idea before continuing
- X. Other (please specify)

[Answer]:A

## Q2. The home screen in the mockups shows each workflow as a card with a short summary, most recently active first. This was my proposal. Do you accept it?

Why this is asked: you asked me to propose a home screen, and it has not been confirmed.

- A. Yes, cards with a summary, most recent first
- B. Yes, but with a change (please describe in Other)
- C. I want a different home screen (please describe in Other)
- D. Not yet defined, decide during requirements
- X. Other (please specify)

[Answer]:A

## Q3. You want each stage to show the full conversation (what the AI asked and what you answered). It is not yet known whether aidlc keeps that conversation in a form the browser can show. How should we handle this?

Why this is asked: the conversation is the centrepiece of the stage page, so a plan B should be agreed before we build on it.

- A. Check it first in requirements, and if it is not available, show the questions and answers files of each stage instead
- B. Check it first, and if it is not available, stop and discuss before building anything
- C. The conversation is required; find a way to capture it
- D. Not yet defined
- X. Other (please specify)

[Answer]:X - Is possible somehow write plugin for claude code for saving chat main message (not all of course, ony questions and answers). Pls think about it and find solution, maybe mcp or other. But easy way, so new developer easy can set up it all on his computer.

## Q4. You asked to see tasks and their states. The mockups show tasks as checklist items inside each stage, but the source of that data is not confirmed. What should the first version do?

Why this is asked: if the data is not there, we need to know whether the first version can go without it.

- A. Show tasks only if the data is available; otherwise leave them out of the first version
- B. Tasks are required in the first version
- C. Show stages and their statuses only; tasks come later
- D. Not yet defined
- X. Other (please specify)

[Answer]:X - Is aws aidlc generates tasts file? I thought it is so I said to show it in UI. Am I making misstakes?
## Q9. You asked me to look for a way to save the main questions and answers from Claude Code so the UI can show them, for example a plugin or an MCP server that is easy to set up. Is that part of the first version? (follow-up to Q3)

Why this is asked: that would be a second piece of software next to the UI, and we need to agree whether it belongs in the first version. I have not verified that this is possible yet; requirements is where I would check.

- A. Yes, the first version includes a simple way to capture questions and answers, and a new developer can set it up quickly
- B. No, the first version shows only what aidlc already records; capturing comes in the next version
- C. Check feasibility in requirements first and then decide whether it is in the first version
- D. Not yet defined
- X. Other (please specify)

[Answer]:B

## Q10. About your question on tasks: from this workflow's own record, aidlc does not write a separate tasks file. It records stage checkboxes (done, in progress, waiting, skipped) in its state file, question and answer files per stage, and a decision log. Detailed task checklists exist only for the building stage. What should the UI show as tasks? (follow-up to Q4)

Why this is asked: you were not wrong to expect tasks; aidlc just keeps them as stages and plan checklists instead of a task list. Choose what you want to see.

- A. Show stages and their statuses as the task list, plus the building stage's checklist when it exists
- B. Show stages and statuses only; no separate tasks
- C. I want a real task list; we should find out how to capture one (please describe in Other)
- D. Not yet defined
- X. Other (please specify)

[Answer]:X - Stages must stays as stages not tasks. Also i want to see list of features (idk name of that, i mean when we run commant to start doing new feature that going trought all stages) and its status. And if in some stage where AI writing code has some checklist that ai going through and understanding what he implement and what need to implement next so need to show it as tasks but only inside that stage where it generates and implements. 

````

Пример D (ожидание человека). Стадия `requirements-analysis`, вопросы **ещё не отвечены** (`inception/requirements-analysis/requirements-analysis-questions.md`; видно, как ИИ формулирует вопросы с опорой на реальные файлы aidlc, которые он обследовал; показаны вводная часть, Q1 и Q6; у Q2 виден только заголовок):

````markdown
# Requirements Analysis Questions

What I looked at: your earlier answers, the practices you affirmed, and the files aidlc actually writes for a workflow. For the last one, here is what I found, because it shapes several questions below:

- A list of workflows with their status (`intents.json`).
- A state file per workflow with every stage's status: done, in progress, waiting for approval, skipped (`aidlc-state.md`).
- A log of everything that happened, with times (`audit/`). It records events such as "stage started" and "approved", but not the content of your answers.
- Each stage's questions and your answers, in a questions file next to its documents.
- The documents each stage produced, and a review note for stages that were reviewed.

Already decided (not re-asked): the first version is view only and runs locally; the home screen shows workflow cards; no AWS dependency; search, filter, paging and "Copy text" are kept; a pretty Markdown viewer is included; the stack is chosen here.

## Q1. Which technology should the UI be built with?

Why this is asked: you asked for a setup that a new developer can do easily on their own machine. aidlc's own tools are written in TypeScript and run on the Bun runtime, so a TypeScript app would match what your developers already have installed for aidlc.

- A. A TypeScript web app: one language for both the part that reads the files and the screens, started with one command
- B. A Python server for reading the files, with web screens on top
- C. Recommend one for me and explain why in requirements; I will confirm
- D. I have a preference (please describe in Other)
- X. Other (please specify)

[Answer]:A, B (front ts, back in python)

## Q2. How many aidlc projects should the UI show?

Why this is asked: "workflows" today live inside one project folder. Showing several projects changes how the UI finds things.

## Q6. Where should each stage's plain-language summary come from?

Why this is asked: aidlc does not write a short summary for each stage. The UI can take it from the stage's documents, but you asked for a short summary on every card and stage page, so someone or something has to supply it.

- A. The UI shows the opening part of each stage's main document (for example the intent statement's problem section) as the summary; no changes to aidlc
- B. The UI shows the stage's main document title and its first paragraph, and the full document one click away
- C. aidlc should write a short summary file when each stage finishes; the UI reads it (this means changing how aidlc works, which is a later version)
- D. Not yet defined
- X. Other (please specify)

[Answer]:
````

[ВЫВОД] Что эти примеры говорят о механизме:
- Вопросы — многоуровневые: тема → опции A–D с «не определено» → `X. Other`. Человек свободно пишет текст рядом с буквой; модель использует этот текст для follow-up.
- Подтверждённые ответы ссылаются друг на друга (`follow-up to Q1, Q3, Q4`), поэтому трассировка вопросов — внутри файла.
- Если пользователь говорит «не знаю, предложи сам» (rough-mockups Q2, Q4, Q3 → «D, X …»), ИИ не принимает решение молча: следующая стадия возвращает предложение явным вопросом (`approval-handoff` Q2: «This was my proposal. Do you accept it?») — это реализация правила «Default to asking, not assuming».
- Вопросы часто содержат пояснение расхождения с реальностью («aidlc does not write a separate tasks file…», Q10): ИИ **проверяет предпосылку пользователя по фактам** и объясняет.

---

## 4. Approval gates

### 4.1 Где стоят

[ФАКТ]
- **Каждая** стадия, кроме трёх инициализационных (`workspace-scaffold`, `workspace-detection`, `state-init`), заканчивается approval gate (`stage-protocol.md:141`). В движке это поле `gate: true|false|"unresolved"` директивы `run-stage` (`SKILL.md` «Branching a run-stage on its gate»).
- Gate открывается **не в том же сообщении**, что и итоговое резюме/learnings: порядок «артефакты → reviewer → [learnings как отдельный ход человека] → `report --result awaiting-approval` → вопрос gate» (`stage-protocol.md` §2, Part 0).
- Дополнительные «человеческие остановки», отличные от gate стадии: (1) режим ответа на вопросы (Guide me/Edit file/Chat); (2) Consolidated Summary Confirmation; (3) Assumption Confirmation (Intent Capture); (4) **Plan Approval** в code-generation (`code-generation.md` Step 3: вопрос «Approve Plan / Request Changes» с `[Approval Fingerprint]: sha256:v3:<hex>` — отпечатком плана, инструкций и Testing Contract); (5) вопрос Build-and-Test «Retry with fix / …» при провале; (6) Walking-skeleton checkpoint и «ladder prompt» (Continue automatically / Review each checkpoint) в Construction; (7) learnings «Anything to add?»; (8) вопрос «Fix findings / Override blocking sensors» при блокирующем сенсоре.

### 4.2 Формат запроса и варианты ответа (дословно: stage-protocol.md §1 «Approval Gates» и §2 «Completion Messages», строки 139–335)

````markdown
## 1. Approval Gates

Every stage (except the 3 stages in the Initialization phase: workspace-scaffold, workspace-detection, state-init) requires explicit user approval before proceeding.

Code Generation's initial Plan Approval remains required. After it, plan, test
instruction, and Testing Contract edits for the same target and attempt follow
that stage's Step 3: a lowered `plan-approval` fence permits continuation without
reapproval; an effective fence-on setting reopens approval. Do not turn the
gate rules here into an extra content-change stop when that fence is lowered,
or record the edited content as human-approved. This includes refreshing the
contract and instructions after Testing Posture, scope, test strategy, or
project type changes within the same intent, target, and attempt. Other gates
are unchanged.

**Open-gate re-entry (`directive.gate_only === true`).** Present this gate now.
The stage body and its review are settled. Do not run the stage, dispatch its
agents or reviewer, repeat its questions, or edit its outputs. Read the stage
file only for its completion message and approval procedure. When present,
`reviewer` and `review_artifact` name whose existing review the Review brief
reads. Present the brief from the recorded review file and verdict. Dispatch
no reviewer and request no new review. The delivered rules
still apply. Run learnings only when `protocol_modules` lists `learnings`, then
present the gate and report the human's exact choice through the existing
approval procedure. A `unit_gate` follows the team-owned gate procedure with
the emitted Unit; `swarm_settled` retains the settled-swarm completion policy.
This branch takes precedence over ordinary stage execution and over generic
Construction completion-only bookkeeping. It grants no approval itself.

### HARD STOP RULE (non-negotiable)

When you present an approval gate question, you MUST end your turn immediately and wait for the user's explicit response. Do NOT call any tool until the user has typed their choice in a new message. An approval gate is a mandatory human checkpoint that cannot be inferred, auto-approved, or skipped.

### NO EMERGENT BEHAVIOR RULE
Construction and Operation stages MUST use standardized 2-option completion messages. DO NOT create 3-option menus or other emergent navigation patterns. Only IDEATION and INCEPTION stages may conditionally include a 3rd option (to add a previously skipped stage). Any deviation from these patterns is a protocol violation. Two sanctioned carve-outs exist: the revision loop escape hatch (below) and the Build-and-Test failure loop-back in the construction protocol module (`aidlc-common/protocols/stage-protocol-construction.md`).

### For simple decisions (3 or fewer options):
Present a structured question:

```question
prompt: "[Stage Name] complete. How would you like to proceed?"
header: Approval
multiSelect: false
options:
  - label: Approve
    description: Continue to [next stage]
  - label: Request Changes
    description: Provide revision feedback
```

**Naming the next stage:** render `[next stage]` verbatim from the run-stage
directive's `next_stage` field (e.g. `Continue to NFR Requirements`). When
`next_stage` is null, render `Complete workflow` instead. NEVER infer or guess
the next stage name from the phase or your own expectations - the engine
computes it from the active scope and state, and only that value is correct.

### For stages with conditional options:
IDEATION and INCEPTION stages may include a 3rd option to add a previously skipped stage:

```question
prompt: "[Stage Name] complete. How to proceed?"
header: Approval
multiSelect: false
options:
  - label: Approve
    description: Continue to [next stage]
  - label: Request Changes
    description: Provide revision feedback
  - label: Add [Skipped Stage]
    description: Include [stage] which was skipped
```

CONSTRUCTION and OPERATION stages: Strictly 2-option only (Approve / Request Changes).

### Non-matching checkpoint replies

For an approval gate or the consolidated-summary confirmation, compare the
human's reply only with the choices currently offered. A harness-supplied
**Other** escape is an offered UI choice but is not a persisted summary answer
or lifecycle decision. If the human selects Other, do not call
`aidlc-orchestrate.ts report` or `aidlc-log.ts answer`, do not write it to an
`[Answer]:` tag, and do not treat the checkpoint as resolved. Discuss what they
want instead, then re-present the same structured question with every offered
choice, end the turn, and wait for a final semantic choice.

If the reply matches neither a semantic choice nor the Other escape, keep the
same no-write/no-report boundary. In the same turn, acknowledge the received
reply (quote it briefly, truncating long text), state that it did not match an
offered choice, and re-present the same structured question with every valid
choice. Then end the turn and wait. Never silently repeat a checkpoint prompt
after an unmatched reply.
The deterministic report/state guards enforce the same boundary. Forward the
exact selected label in `--user-input`; never substitute a paraphrase or
feedback prose. A refusal instructs you to re-render the original held gate
with every option it offered because conditional choices are not reconstructible
from a fixed fallback list.

### Revision loop escape hatch
After 3 "Request Changes" cycles on the same stage, add a third option to all subsequent approval gates for that stage:

```question
prompt: "[Stage Name] — this is revision cycle [N]. How would you like to proceed?"
header: Approval
multiSelect: false
options:
  - label: Approve
    description: Continue to [next stage]
  - label: Request Changes
    description: Provide further revision feedback
  - label: Accept as-is
    description: Archive current version and move on
```

If "Accept as-is" selected: log the decision in `<record>/audit/<host>-<clone>.md` ("User accepted stage output as-is after [N] revision cycles"), mark stage complete, and proceed. This overrides the NO EMERGENT BEHAVIOR RULE for Construction stages only when the revision threshold is reached.

After the 2nd revision cycle (before the escape hatch activates), include a note in the approval question: "After one more revision, an 'Accept as-is' option will become available."

### Conditional construction protocol

Walking-skeleton, ladder, Bolt-gate, halt-and-ask, and Build-and-Test
failure-loop-back behavior lives in
`.claude/aidlc-common/protocols/stage-protocol-construction.md`.
Load it on the first Construction-phase directive of the session and on every `invoke-swarm` (the engine lists it in `directive.protocol_modules`).
---

## 2. Completion Messages

Every stage ends with this 5-part structure:

### Part 0: Enter the approval gate (mandatory: the held gate is recorded before the human answers it)
Entering the gate:
1. Render Parts 1-2 (announcement, summary), then, only when the directive lists the `learnings` protocol module, run the §13 learnings ritual as its own human turn — END YOUR TURN at its question. Its logged `QUESTION_ANSWERED` row must precede the gate's `STAGE_AWAITING_APPROVAL` (§13 step 3 is the contract; the gate is never opened in the same message as the learnings question).
2. After the learnings answer is logged, or directly after Parts 1-2 when the `learnings` module is absent: `aidlc engine orchestrate report --stage <slug> --result awaiting-approval` marks `[-]` -> `[?]` and emits `STAGE_AWAITING_APPROVAL`. `/aidlc --status` now truthfully shows the held gate. These are internal bookkeeping steps: run them, never narrate them. This step is bookkeeping the user has no stake in: **SAY:** nothing for it, not that a gate is being opened, not that anything is being recorded. Go from that answer (or the completion summary when the module is absent) straight into the question below.
   - When `directive.ceremony.sensors === "on"`, if the report instead refuses because a blocking gate sensor found issues or could not produce a verified pass, the approval gate is NOT open. In interactive mode, run `aidlc engine log decision --stage <slug> --decision "Blocking gate sensor failure" --options "Fix findings,Override blocking sensors"` and present those two options as a separate structured question. END YOUR TURN.
   - **Fix findings**: after the human selects it, record `aidlc-log.ts answer --stage <slug> --details "Fix findings"`, fix the named findings or evaluation failure, then retry the ordinary report with no override.
   - **Override blocking sensors**: after the human selects it, record `aidlc-log.ts answer --stage <slug> --details "Override blocking sensors"`, then retry the same report with `--override-blocking-sensors --user-input "Override blocking sensors"`. The state tool requires the exact offered option, a `HUMAN_TURN`, and the matching decision/answer receipt; a bare flag fails. Never offer or attempt this option under `Construction Autonomy Mode: autonomous` — unattended runs halt loudly.
3. Present Part 3 (the approval question). This is a lifecycle gate, not an interview question: do not call `aidlc-log.ts decision` or `aidlc-log.ts answer` for it. Word it per the voice contract at the top of this file: what you produced, what to look at, what happens next.
4. Based on the user response:
   - **Approve** → `aidlc engine orchestrate report --stage <slug> --result approved --user-input "<exact choice>"`. That call emits any missing `STAGE_AWAITING_APPROVAL`, then `GATE_APPROVED` + `STAGE_COMPLETED`, and auto-advances to the next in-scope stage (or completes the workflow on the final stage). No separate `advance` call required.
   - **Request Changes** → `aidlc engine orchestrate report --stage <slug> --result rejected --user-input "Request Changes" --reason "<feedback>"`. The selected decision and its feedback are separate fields; never put feedback in `--user-input`. On a reviewer-backed gate, add the reviewer module's `--reject-finding "<review-artifact>#R-NN=<exact human reason>"` once for each finding the human explicitly rejects as inapplicable; ordinary change requests carry no disposition flag. That call emits `GATE_REJECTED` + `STAGE_REVISING`, marks `[?]` → `[R]`, and increments Revision Count. When the feedback already names what to change, revise immediately; ask a clarifying question first ONLY when the feedback is genuinely ambiguous, and ask it as a structured question with concrete options drawn from the artifact (never an open-ended freeform prompt — a driver or scripted session that answers only structured questions must be able to progress the revision loop). When the revision changed a `produces[]` artifact and the directive carries a reviewer, re-run the `stage-protocol-reviewer.md` §12a reviewer step before reporting revised — fresh dispatch record, fresh `## Review` verdict replacing the stale one; the NOT-READY lead-alone loop and its iteration budget apply as at first entry. (When the directive lists the `learnings` module, its §13 ritual runs once at the initial gate and is not re-run for gate revisions.) Then call `aidlc engine orchestrate report --stage <slug> --result revised` to emit a fresh `STAGE_AWAITING_APPROVAL` and mark `[R]` → `[?]` — always re-present the gate after the revision; never leave the stage parked in `[R]` waiting on further conversation.
   - **Accept as-is** (after 3 rejection cycles) → same as Approve; include the exact offered label `--user-input "Accept as-is"`.

**Pipeline revisions keep the declared topology.** After a `mode: pipeline` rejection, run `aidlc engine orchestrate next` and follow its fresh `directive.pipeline` ledger. Re-dispatch each missing link in order with the exact feedback, even when the requested change affects only one final artifact. The developer must perform fresh analysis and rewrite its handoff for this attempt; the successor then applies the requested revision using that handoff. Record each link only after its agent returns, and retain the configured reviewer step before reporting `revised`. Keep/Modify/Redo describes the requested artifact changes, not permission for the conductor to replace a dispatched pipeline with an inline edit. A rejection intentionally invalidates earlier receipts: re-stamping old files, touching their timestamps, or setting guard opt-outs is not revision recovery.

### Part 1: Announcement (mandatory)
```markdown
# [emoji] [Stage Name] Complete
```

### Part 2: Summary (mandatory)
Structured bullet-point summary of what was produced:
- Keep factual and content-focused
- DO NOT include workflow instructions ("please review", "let me know", "before we proceed")
- Include a brief inline summary table (5-10 lines) showing key artifacts produced and their top-level contents. This lets users make a quick approval decision without navigating to the file. Example:
  ```
  | Artifact | Contents |
  |----------|----------|
  | requirements.md | 6 FR groups (18 sub-requirements), 4 NFRs |
  | requirements-analysis-questions.md | 5 questions, all answered |
  ```
- For the FIRST completion message of a session (typically Requirements Analysis or Workspace Detection), include:
  "**Project depth**: [Minimal/Standard/Comprehensive]: how much detail I write into each document.
  **Test strategy**: [Minimal/Standard/Comprehensive]: how many tests I write.
  Ask me to change either one at any approval gate."

### Part 3: Review + Approval (mandatory)
When the directive carried a reviewer, present the Review brief required by
`stage-protocol-reviewer.md` §12a before the artifact path and approval
question.

```markdown
**Review:** `<record>/[path to artifacts]`
```
Then present the structured approval question as defined above.

### Part 4: Progress update (mandatory — after user approves)
After the user selects "Approve", display a progress line before proceeding.

**When every compiled stage is in scope**:
```
Progress: [N]/33 overall | [phase-N]/[phase-total] [Phase] stages complete. Next: [Next Stage Name]
```

**When the active scope executes fewer stages than the compiled total**, show
in-scope progress with overall shown parenthetically:
```
Progress: [X]/[S] in-scope stages complete ([N]/33 overall) | [phase-N]/[phase-total] [Phase]. Next: [Next Stage Name]
```
Keep this format exactly as shown. `S` = the number of stages this workflow
actually runs, read from the current scope's compiled totals. Use
`aidlc engine gen scope-table` when you need those
totals; never carry a hand-maintained per-scope count table in this protocol,
and never narrate where the number came from.

Example (full-scope): "Progress: 13/33 overall | 3/7 IDEATION stages complete. Next: Approval & Handoff"
Example (reduced-scope): "Progress: 5/8 in-scope stages complete (7/33 overall) | 2/3 CONSTRUCTION. Next: Build & Test"

Count only stages in the current phase (INITIALIZATION, IDEATION, INCEPTION, CONSTRUCTION, or OPERATION). Include both completed and skipped stages in the numerator.
````

### 4.3 Что происходит при отказе / правке (сводка)

[ФАКТ] (`stage-protocol.md` §2 Part 0 п.4; `conductor.md` «Intra-stage control flow»)

1. `Request Changes` → `report --result rejected --user-input "Request Changes" --reason "<feedback>"` (решение и текст — **раздельные поля**) → в аудите `GATE_REJECTED` + `STAGE_REVISING`, чекбокс `[?]` → `[R]`, `Revision Count` +1.
2. Если фидбэк однозначен — правим сразу; если нет — один уточняющий **структурированный** вопрос с конкретными опциями из артефакта (не свободный текст).
3. Если менялся `produces[]`-артефакт и у стадии есть ревьюер — повторное ревью (новая диспетчеризация, свежий `## Review`).
4. `report --result revised` → `[R]` → `[?]` и **обязательно** снова показать gate.
5. После 2-го цикла в вопрос добавляется предупреждение; после 3-го — третий вариант `Accept as-is` («Archive current version and move on»).
6. Keep/Modify/Redo — при повторном заходе в стадию с существующими артефактами (`stage-protocol.md` «Artifact Re-use», `aidlc engine state reuse-artifact`).
7. Для ревьюер-gate человек может отклонить отдельные замечания `--reject-finding "<artifact>#R-NN=<причина>"`; принятые «как есть» фиксируются как `Accepted risk` (пример: в прошлом запуске все 5 замечаний по intent-statement и все 7 по wireframes получили статус `Accepted risk` в событии `GATE_APPROVED`, см. аудит).
8. Блокирующий сенсор не пускает на gate: два варианта «Fix findings» / «Override blocking sensors» (override — только при человеческом ответе; под автономным режимом недоступен).

### 4.4 Как gate выглядит в реальном аудите

[ФАКТ] Фрагмент `aidlc/spaces/default/intents/260929-aidlc-web-ui/audit/<shard>.md` (сокращено):

```markdown
## Gate Approved
**Timestamp**: 2026-10-01T18:38:14Z
**Event**: GATE_APPROVED
**Stage**: approval-handoff
**User Input**: Approve

## Stage Completion
**Event**: STAGE_COMPLETED
```

(`ideation/intent-capture`: `**User Input**: Approve`, плюс `**Review Finding Dispositions**` с JSON из 5 записей `"status":"Accepted risk"`.)

### 4.5 Дополнительные гарантии вокруг gate

- **HARD STOP RULE**: после показа gate модель обязана закончить ход и не вызывать инструменты до ответа человека; **human-presence**: хук `record-human-turn` пишет `HUMAN_TURN` на каждый реальный ввод; `report approved`/`log answer` отклоняются без `HUMAN_TURN` после последнего решения (`.claude/hooks/aidlc-record-human-turn.ts`, заголовок; `.claude/tools/aidlc-log.ts` ~строки 1107–1130: «no human reply has arrived after this question, or that turn was already used by another decision»).
- **Точное соответствие**: в `--user-input` передаётся точная метка опции; парафраз запрещён; «Other» и несоответствующие ответы не двигают состояние.
- **Autonomy is never inferred** (`stage-protocol.md:135`; `SKILL.md` Key Principles).
- **Гейты Construction** — строго 2 опции (Approve / Request Changes) («NO EMERGENT BEHAVIOR RULE», строка 171–172); Ideation/Inception могут добавить третью «Add [Skipped Stage]» (например, Requirements Analysis добавляет `Add User Stories`, если User Stories пропущена: `requirements-analysis.md` Step 12; выбор → `aidlc engine recompose --add user-stories`).

---

## 5. Verification gates и трассируемость

### 5.1 Что существует (три слоя)

1. **Сенсоры стадии** (скрипты, срабатывают на запись/вход в gate) — `.claude/sensors/*.md`, реализация `.claude/tools/aidlc-sensor*.ts`.
2. **Ревьюер-субагент** (независимая LLM-проверка артефакта; запись квитанций кодом).
3. **Phase-boundary verification** («phase check») — инструкция модели + события движка `PHASE_VERIFIED`/`PHASE_COMPLETED`.
4. (Construction) Element-level `traceability.json` и «Cross-Unit Final Coverage Gate» в Build and Test.

### 5.2 Сенсоры [ФАКТ]

Шесть манифестов (`default_severity: advisory` у всех). Стадия подключает их строкой `sensors:` во frontmatter.

| Сенсор | Когда | Что проверяет | Реализация |
|---|---|---|---|
| `claim-sources` | gate | в deliverables Intent Capture: раздел `## Assumptions & Open Questions`; у каждого абзаца/пункта/строки таблицы есть тег `[desc]|[scope]|[Q<n>]|[memory:…]|[assumption]`; теги разрешаются в отвеченные Q; `[desc]` точно совпадает с `project-description.json`; `[scope]` совпадает со state; допущения совпадают с подтверждёнными в `Assumption Confirmation`. «It validates citation shape and resolution only; the stage's adversarial reviewer judges whether the cited source actually supports the claim.» | `aidlc engine sensor-claim-sources` (`.claude/tools/aidlc-sensor-claim-sources.ts`, 48 КБ) |
| `required-sections` | gate | ≥2 заголовков H2 в markdown-выводе; для `unit-of-work-dependency.md` — корректный DAG-блок `units:` без циклов; если есть `memory/templates/<artifact>.md`, то его H2 — обязательный набор | `aidlc-sensor-required-sections.ts` |
| `upstream-coverage` | gate | каждый артефакт из `consumes:` упомянут в выходных документах стадии (слаг, `[[wikilink]]`, `` `name.md` `` или путь каталога стадии) | `aidlc-sensor-upstream-coverage.ts` |
| `traceability` | запись `traceability.json` | схема `{stage, unit, upstream_ids, coverage[{id,status,target}], reverse[]}`; статусы OK/GAP/ORPHAN/Deferred/N-A; падает на GAP/ORPHAN/необъявленные ID; проверяет существование целей (код, истории, business rules), сам выводит сирот | `aidlc-sensor-traceability.ts` |
| `linter` | запись `*.ts|js` | обёртка над eslint | `aidlc-sensor-linter.ts` |
| `type-check` | запись `*.ts|tsx` | обёртка над tsc | `aidlc-sensor-type-check.ts` |

Исполнение: хук `run-sensors` (PostToolUse на `Write|Edit`) и точка gate; события аудита `SENSOR_FIRED` → `SENSOR_PASSED|SENSOR_FAILED`, детали — `<record>/.aidlc-engine/sensors/<stage>/<sensor>-<fire-id>.md`. `fire_on: write` — только advisory; `fire_on: gate` + `blocking` отказывают во входе на gate (`stage-protocol.md` §14).

Из реального запуска: 29 `SENSOR_FIRED`, 25 `SENSOR_PASSED`, 4 `SENSOR_FAILED` (3× `upstream-coverage` в approval-handoff — `intent-statement` и `stakeholder-map` не упомянуты в initiative-brief/decision-log; 1× `required-sections` — файл `practices-discovery-timestamp.md` (однострочный маркер) без H2). [ВЫВОД] Часть срабатываний — «шум» от формальных правил на служебных файлах.

### 5.3 Ревьюер [ФАКТ]

См. раздел 7 и `stage-protocol-reviewer.md`. Кратко: перед каждым запуском — `aidlc engine log review --stage … --iteration n` (запрос открывает слот, выдаёт `requestId` и `reviewFile`); ревьюер **читает** stage-файл, questions-файл, все produces и upstream; **не получает** `memory.md`/план; пишет ровно один файл (`**Verdict:** READY|NOT-READY`, `**Reviewer:**`, `**Iteration:**`, таблица `### Findings`); дирижёр записывает терминальную квитанцию `log review --verdict …` → создаётся запись `<record>/.aidlc-engine/reviews/<stage>/stage/<attempt>/<iteration>.json` (+ человекочитаемая копия `<stage dir>/reviews/review-NN.md`) и событие `REVIEW_COMPLETED`. Незакрытый запрос блокирует завершение стадии. После терминальной квитанции артефакты «заморожены» хуком `review-freeze` (запись в `produces[]` отклоняется, `REVIEW_FREEZE_BLOCKED`), чтобы не обнулить квитанцию.

### 5.4 Phase boundary verification

[ФАКТ] Вся инструкция (`.claude/aidlc-common/protocols/stage-protocol-governance.md`, файл целиком):

````markdown
# Stage Protocol: Phase Boundary Verification

Load this file at phase transitions (end of Ideation, Inception, Construction). Note: The Initialization→Ideation transition has no governance boundary check.
This is a supplement to `stage-protocol.md` — the main protocol still applies.

> Capturing corrections as durable rules is handled by the conditional §13 Learnings Ritual in `stage-protocol-learnings.md`, loaded only when `directive.protocol_modules` lists `learnings` (the tool-as-actor loop via `aidlc-learnings.ts`), not here. This file covers only phase-boundary traceability verification.

---

## 13. Phase Boundary Verification

At each phase transition (Ideation→Inception (approval-handoff→reverse-engineering), Inception→Construction (delivery-planning→functional-design), Construction→Operation (ci-pipeline→deployment-pipeline)), run traceability verification.

### When to verify
- After the last stage of each phase is approved
- Before the first stage of the next phase begins
- On demand if the user requests verification via `/aidlc --status`

### Verification process
1. Read the verification methodology from `.claude/knowledge/aidlc-shared/verification.md`
2. Run the phase-specific traceability checks
3. Write results to `<record>/verification/[phase-boundary]-verification.md`
4. If verification fails, present issues to the user before proceeding:
   - Missing traceability links (e.g., requirement without a design)
   - Orphaned artifacts (design without a requirement)
   - Inconsistencies between phase outputs
5. Log a `PHASE_VERIFIED` event to `<record>/audit/<host>-<clone>.md`

### Phase boundary checks
**Ideation → Inception**: Intent captured, scope defined, feasibility confirmed, initiative approved
**Inception → Construction**: All requirements traced to designs, units defined, delivery plan approved
**Construction → Operation**: All units built and tested, CI pipeline configured, infrastructure designed
````

Методика проверки (`.claude/knowledge/aidlc-shared/verification.md`, ключевые части): стабильные ID (`FR{n}`, `NFR{n}`, `US{n}.{m}`, `AC{n}.{m}.{seq}`, `U{n}`, `BR{group}.{seq}`), статусы покрытия `OK|GAP|ORPHAN|Deferred|N/A`, отчёт `<record>/verification/phase-check-<phase>.md` с покрытием в процентах, предупреждениями, консистентностью и чекбоксом человеческого одобрения; событие `PHASE_VERIFIED` пишется движком, «do not append it manually».

Таблица «что проверяется на границах» (из `verification.md`, `stage-protocol-governance.md`):

| Граница | Что проверяется |
|---|---|
| Ideation → Inception | Intent → Scope → Intent Backlog согласованы; у всех scope-элементов есть feasibility |
| Inception → Construction | Requirements → Stories → Architecture согласованы; все истории прослеживаются к требованиям; архитектура покрывает все истории |
| Construction → Operation | Architecture → Code → Tests; весь код прослеживается к дизайну; покрытие тестами критериев приёмки |
| Внутри стадии Construction | `traceability.json` (сенсор) по каждой стадии; в Build and Test — Step 10 «Cross-Unit Final Coverage Gate» (каждый `FR`/`NFR` из requirements.md и каждый `AC` из stories.md должен иметь статус `OK` и существующий target-файл) → `cross-unit-traceability.md` |

[ФАКТ] **Реальный phase-check** (Ideation → Inception), `aidlc/spaces/default/intents/260929-aidlc-web-ui/verification/phase-check-ideation.md`:

````markdown
# Phase Check: Ideation to Inception

## Result

Passed with warnings. Nothing blocks moving on to requirements; the warnings below are carried forward.

## Coverage

| Check | Result |
|-------|--------|
| Intent captured (intent statement and stakeholder map) | Present |
| Concept visuals (wireframes and user flow) | Present |
| Initiative brief and decision log | Present |
| Scope definition and intent backlog | Not produced: the stage was skipped in this plan; the brief's "First Version Boundary" holds the scope instead |
| Feasibility backing for scope items | Not produced: the stage was skipped in this plan; risks are listed in the brief |
| Market research and team plan | Not produced: stages skipped in this plan |

## Warnings

- No separate scope document or backlog exists, so the first version boundary lives only in the initiative brief and the decision log.
- No feasibility assessment exists. The biggest open technical question (whether the UI can read what it needs from the files aidlc writes) goes to requirements.
- The Stage detail wireframe shows a full conversation and tasks for every stage, which is wider than the agreed first version.
- The intent statement's success measures include later-version goals.

## Consistency

- Intent, mockups and brief agree on: view only first, local first, cards on the home screen, stages shown as stages.
- Later decisions that narrow earlier ones are listed in the decision log under "Superseded earlier statements". No contradiction remains between the brief and the decision log.

## Human approval

- [ ] Approved by the requester at the Approval & Handoff gate
````

[ВЫВОД] Phase-check здесь — документ, написанный моделью по инструкции (skip-стадии честно отражены как «Not produced … stage was skipped»); «блокировку» обеспечивает не он, а то, что движок не выдаст следующую стадию без закрытия предыдущей. Кодом фаза-проверка гарантирует только факт записи события `PHASE_VERIFIED`; содержательный анализ (покрытие %) — LLM [ФАКТ в аудите: `PHASE_VERIFIED` ×2, `PHASE_COMPLETED` ×2]. Чекбокс «Approved by the requester» в phase-check остался пустым [ФАКТ, последняя строка файла].

---

## 6. Состояние и непрерывность сессий

### 6.1 Слои состояния [ФАКТ]

| Слой | Файл | Кто пишет | Назначение |
|---|---|---|---|
| Человекочитаемое состояние | `<record>/aidlc-state.md` | движок (`aidlc-state.ts`) + хук `sync-workflow-state` по TaskUpdate | фазы, чекбоксы стадий, настройки scope/depth, текущая позиция, «Session Resume Point» |
| Исходное описание | `<record>/project-description.json` | `workspace` утилита | точная исходная формулировка (JSON-строка), `Project` в state — лишь однострочное превью |
| Журнал событий | `<record>/audit/<host>-<clone>.md` | **только** инструменты/хуки (не руками) | append-only шарды на клон (избегает merge-конфликтов); ~40 типов событий |
| Реестр workflow | `aidlc/spaces/default/intents/intents.json`, `active-intent` | движок | список intent (`uuid, slug, dirName, scope, status`) и курсор активного |
| Runtime graph | `<record>/runtime-graph.json` | `aidlc-runtime.ts compile` (хук `rebuild-stage-graph`) | хронология стадий: `started_at/completed_at`, `agent`, `outcome`, `sensor_firings`, `learnings_captured` |
| Служебное | `<record>/.aidlc-engine/*` | движок | `active-directive.json` (текущая директива и счётчики), `summary-authorization/…`, `reviews/…`, `sensors/…`, `guard-refusals/…`, `stop-hook/block-count.json`, `human-turn`, `steering-token-key` |
| Diary стадии | `<record>/<phase>/<stage>/memory.md` | модель (единственный файл, который она ведёт вручную) | Interpretations / Deviations / Tradeoffs / Open questions → ритуал learnings |
| Методические правила | `aidlc/spaces/default/memory/*.md` | практики/learnings (инструментами) | стоячие правила (`ALWAYS`/`NEVER`) |

### 6.2 Формат state-файла (реальный, полностью)

`aidlc/spaces/default/intents/260929-aidlc-web-ui/aidlc-state.md`:

````markdown
# AI-DLC State Tracking

## Project Information
- **Project**: build a web UI for aidlc
- **Project Description Source**: project-description.json
- **Project Type**: Greenfield
- **Scope**: web-ui-lean
- **Start Date**: 2026-09-29T20:26:54Z
- **State Version**: 8
- **Active Agent**: aidlc-product-agent
- **Worktree Path**:
- **Bolt Refs**:
- **Practices Affirmed Timestamp**: 2026-10-01T19:11:08Z

## Scope Configuration
- **Stages to Execute**: 0.1, 0.2, 0.3, 1.1, 1.6, 1.7, 2.2, 2.3, 3.5, 3.6, 3.7
- **Stages to Skip**: 1.2 (market-research), 1.3 (feasibility), 1.4 (scope-definition), 1.5 (team-formation), 2.1 (reverse-engineering), 2.4 (user-stories), 2.5 (refined-mockups), 2.6 (domain-design), 2.7 (units-generation), 2.8 (contract-design), 2.9 (delivery-planning), 3.1 (functional-design), 3.2 (nfr-requirements), 3.3 (nfr-design), 3.4 (infrastructure-design), 4.1 (deployment-pipeline), 4.2 (environment-provisioning), 4.3 (deployment-execution), 4.4 (observability-setup), 4.5 (incident-response), 4.6 (performance-validation), 4.7 (feedback-optimization)
- **Depth**: Standard
- **Test Strategy**: Standard
- **Review Override**: 
- **Guard Policy**: relaxed (from scope web-ui-lean)
- **Sensors**: on (from scope web-ui-lean)
- **Learnings**: on (from scope web-ui-lean)
- **Summary Confirmation**: on (from scope web-ui-lean)

## Workspace State
- **Project Root**: .
- **Languages**: Unknown
- **Frameworks**: Unknown
- **Build System**: Unknown

## Execution Plan Summary
- **Total Stages**: 11
- **Completed**: 7
- **In Progress**: requirements-analysis

## Runtime State
- **Revision Count**: 0

## Phase Progress
<!-- Status values: Pending, Active, Verified, Skipped -->

- **Initialization**: Verified
- **Ideation**: Verified
- **Inception**: Active
- **Construction**: Pending
- **Operation**: Skipped

## Stage Progress
<!-- Checkbox states: [ ] not started, [-] in progress, [?] awaiting approval (gate open), [R] revising (user rejected gate), [x] completed, [S] skipped via --stage/--phase jump -->

### INITIALIZATION PHASE
- [x] workspace-scaffold — EXECUTE
- [x] workspace-detection — EXECUTE
- [x] state-init — EXECUTE

### IDEATION PHASE
- [x] intent-capture — EXECUTE
- [ ] market-research — SKIP
- [ ] feasibility — SKIP
- [ ] scope-definition — SKIP
- [ ] team-formation — SKIP
- [x] rough-mockups — EXECUTE
- [x] approval-handoff — EXECUTE

### INCEPTION PHASE
- [ ] reverse-engineering — SKIP
- [x] practices-discovery — EXECUTE
- [-] requirements-analysis — EXECUTE
- [ ] user-stories — SKIP
- [ ] refined-mockups — SKIP
- [ ] domain-design — SKIP
- [ ] units-generation — SKIP
- [ ] contract-design — SKIP
- [ ] delivery-planning — SKIP

### CONSTRUCTION PHASE
Per unit: [TBD]
- [ ] functional-design — SKIP
- [ ] nfr-requirements — SKIP
- [ ] nfr-design — SKIP
- [ ] infrastructure-design — SKIP
- [ ] code-generation — EXECUTE
- [ ] build-and-test — EXECUTE
- [ ] ci-pipeline — EXECUTE

### OPERATION PHASE
- [ ] deployment-pipeline — SKIP
- [ ] environment-provisioning — SKIP
- [ ] deployment-execution — SKIP
- [ ] observability-setup — SKIP
- [ ] incident-response — SKIP
- [ ] performance-validation — SKIP
- [ ] feedback-optimization — SKIP

## Current Status
- **Lifecycle Phase**: INCEPTION
- **Current Stage**: requirements-analysis
- **Next Stage**: code-generation
- **Status**: Running
- **Last Updated**: 2026-10-01T19:11:12Z

## Session Resume Point
- **Last Completed Stage**: practices-discovery
- **Next Action**: Execute Requirements Analysis
- **Pending Artifacts**: none
````

Контракт полей — `.claude/knowledge/aidlc-shared/state-template.md` (Project Information / Scope Configuration / Workspace State / Execution Plan Summary / Runtime State / Phase Progress / Stage Progress / Unit Progress (team) / Current Status / Session Resume Point). Нотация чекбоксов: `[ ]` не начата, `[-]` в работе, `[?]` ждёт одобрения (gate открыт), `[R]` ревизия после отказа, `[x]` завершена, `[S]` пропущена прыжком. Статусы фаз: Pending / Active / Verified / Skipped.

### 6.3 Audit-лог

[ФАКТ] Формат — Markdown-блоки; пример (начало реального шарда, абсолютные пути заменены на `<project>`):

````markdown
# AI-DLC Audit Log

## Workflow Start
**Timestamp**: 2026-09-29T20:26:54Z
**Event**: WORKFLOW_STARTED
**Scope**: web-ui-lean
**Request**: /aidlc build a web UI for aidlc
**Source Baseline**: sha256:f0c6bb5f5e0bbd4395d9862a29f274cfbc3f93e31def021022710674872c40de

---

## Phase Start
**Timestamp**: 2026-09-29T20:26:54Z
**Event**: PHASE_STARTED
**Phase**: initialization
**Stage count**: 3
**Scope**: web-ui-lean

---

## Phase Skip
**Timestamp**: 2026-09-29T20:26:54Z
**Event**: PHASE_SKIPPED
**Phase**: operation
**Scope**: web-ui-lean
**Reason**: scope web-ui-lean excludes operation

---

## Stage Start
**Timestamp**: 2026-09-29T20:26:54Z
**Event**: STAGE_STARTED
**Stage**: workspace-scaffold
**Agent**: orchestrator

---

## Workspace Scaffolded
**Timestamp**: 2026-09-29T20:26:54Z
**Event**: WORKSPACE_SCAFFOLDED
**Request**: /aidlc build a web UI for aidlc
**Details**: 4 in-scope phase dirs + verification/ + space-level knowledge/ ensured (shell shipped by SEED)

---

## Stage Completion
**Timestamp**: 2026-09-29T20:26:54Z
**Event**: STAGE_COMPLETED
**Stage**: workspace-scaffold
**Details**: 4 in-scope phase dirs + verification/ + space-level knowledge/ ensured

---

## Stage Start
**Timestamp**: 2026-09-29T20:26:54Z
**Event**: STAGE_STARTED
**Stage**: workspace-detection
**Agent**: orchestrator

---
````

Частота типов событий в реальном шарде (2033 строки), [ФАКТ, подсчёт `grep`]: HUMAN_TURN 34, SENSOR_FIRED 29, SUBAGENT_COMPLETED 26, SENSOR_PASSED 25, ARTIFACT_CREATED 19, DECISION_RECORDED 14, QUESTION_ANSWERED 9, STAGE_STARTED 8, STAGE_COMPLETED 7, ARTIFACT_UPDATED 7, SUMMARY_CONFIRMATION_RECORDED 5, STAGE_AWAITING_APPROVAL 4, SENSOR_FAILED 4, GATE_APPROVED 4, MEMORY_EMPTY 4, PHASE_STARTED 3, REVIEW_REQUESTED 2, REVIEW_COMPLETED 2, PHASE_VERIFIED 2, PHASE_COMPLETED 2, WORKSPACE_*, PHASE_SKIPPED, PRACTICES_DISCOVERED, PRACTICES_AFFIRMED, SESSION_STARTED, WORKFLOW_STARTED.

Фрагменты событий вокруг вопроса и подтверждения:

````markdown
## Decision Recorded
**Timestamp**: 2026-09-30T19:06:00Z
**Event**: DECISION_RECORDED
**Stage**: intent-capture
**Decision**: Does this all look correct before I generate the artifact?
**Options**: Looks correct,Request changes
**Checkpoint**: Consolidated Summary Confirmation
**Questions File**: aidlc/spaces/default/intents/260929-aidlc-web-ui/ideation/intent-capture/intent-capture-questions.md

---

## Human Turn
**Timestamp**: 2026-09-29T20:28:43Z
**Event**: HUMAN_TURN
**Session**: <session-id>

---

## Question Answered
**Timestamp**: 2026-09-29T20:28:44Z
**Event**: QUESTION_ANSWERED
**Stage**: intent-capture
**Details**: I'll edit the file

---

## Summary Confirmation Recorded
**Timestamp**: 2026-09-30T19:08:30Z
**Event**: SUMMARY_CONFIRMATION_RECORDED
**Stage**: intent-capture
**Details**: Looks correct
**Checkpoint**: Consolidated Summary Confirmation
**Questions File**: aidlc/spaces/default/intents/260929-aidlc-web-ui/ideation/intent-capture/intent-capture-questions.md
**Questions SHA-256**: be2722f7917a3a6a794782f5efaf4482c4637c6441ecef0766ac83da2cb0a76f
**Hash Scope**: confirmed-content-v1
**Summary Authorization Id**: 7e150c264fc6a470bdeb6ad8bf33dffabc949cda4fda2ee229b0e69e2dde6976

---

## Stage Awaiting Approval
**Timestamp**: 2026-09-30T19:16:11Z
**Event**: STAGE_AWAITING_APPROVAL
**Stage**: intent-capture

---

## Review Requested
**Timestamp**: 2026-09-30T19:08:55Z
**Event**: REVIEW_REQUESTED
**Stage**: intent-capture
**Reviewer**: aidlc-product-lead-agent
**Iteration**: 1
**Artifact Fingerprint**: sha256:dd39347ba86e60f055c51cfde38b0e39ffd726dc1d6e1065db3a27caa1afab06
**Request Id**: review:66d260b151fe2a52df65e43acf5ca3f1

---

## Review Completed
**Timestamp**: 2026-09-30T19:09:42Z
**Event**: REVIEW_COMPLETED
**Stage**: intent-capture
**Reviewer**: aidlc-product-lead-agent
**Iteration**: 1
**Verdict**: READY
**Request Fingerprint**: sha256:dd39347ba86e60f055c51cfde38b0e39ffd726dc1d6e1065db3a27caa1afab06
**Artifact Fingerprint**: sha256:dd39347ba86e60f055c51cfde38b0e39ffd726dc1d6e1065db3a27caa1afab06
**Request Id**: review:66d260b151fe2a52df65e43acf5ca3f1
**Review Record**: .aidlc-engine/reviews/intent-capture/stage/6ca81c1ce45ad85c/1.json
**Review Record Digest**: sha256:a7d1ff6a19f517f71b3b283265eb671271bfe3536de312f2928d2208ae89ff79

---

## Sensor Failed
**Timestamp**: 2026-10-01T18:32:56Z
**Event**: SENSOR_FAILED
**Fire id**: 3a3a172c
**Sensor ID**: upstream-coverage
**Stage slug**: approval-handoff
**Output path**: aidlc/spaces/default/intents/260929-aidlc-web-ui/ideation/approval-handoff/initiative-brief.md
**Detail path**: aidlc/spaces/default/intents/260929-aidlc-web-ui/.aidlc-engine/sensors/approval-handoff/upstream-coverage-3a3a172c.md
**Findings count**: 2

---

````

### 6.4 Квитанция summary-подтверждения и защитный отказ [ФАКТ]

`.aidlc-engine/summary-authorization/intent-capture/stage.json`:

````json
{
  "version": 1,
  "id": "7e150c264fc6a470bdeb6ad8bf33dffabc949cda4fda2ee229b0e69e2dde6976",
  "stage": "intent-capture",
  "unit": null,
  "workflow": null,
  "attempt": "STAGE_STARTED:2026-09-29T20:26:54Z:<project>/aidlc/spaces/default/intents/260929-aidlc-web-ui/audit/ea0a1520d714-d3afc829f69c.md:15",
  "questions_file": "aidlc/spaces/default/intents/260929-aidlc-web-ui/ideation/intent-capture/intent-capture-questions.md",
  "questions_sha256": "be2722f7917a3a6a794782f5efaf4482c4637c6441ecef0766ac83da2cb0a76f",
  "choice": "Looks correct",
  "recorded_at": "2026-09-30T19:08:30Z"
}

````

Пример срабатывания кодовой защиты («guard refusal») — `.aidlc-engine/guard-refusals/*.json` (сокращено; пути заменены):

````json
{
  "version": 1,
  "count": 2,
  "codes": [
    "SUMMARY_ARTIFACT_UNAUTHORIZED"
  ],
  "refusal": {
    "code": "SUMMARY_ARTIFACT_UNAUTHORIZED",
    "blockedAction": "summary-confirmation",
    "stage": "practices-discovery",
    "state": "in-progress",
    "invariant": "Generated outputs descend from a current human-backed summary confirmation.",
    "userMessage": "Refusing to continue \"practices-discovery\": this stage's output document <project>/aidlc/spaces/default/intents/260929-aidlc-web-ui/inception/practices-discovery/team-practices.md has no recorded write. Save the document again, so its write descends from the current confirmation, then continue.",
    "remedies": [
      {
        "op": "request-review",
        "action": "Request the next permitted review for the current attempt.",
        "requiresHuman": false,
        "executableNow": false,
        "interaction": "external-work"
      },
      {
        "op": "reconfirm-summary",
        "action": "Present the current consolidated summary, record the human's confirmation, then regenerate or re-save the produced artifacts.",
        "requiresHuman": true,
        "executableNow": true,
        "interaction": "human-input"
      },
      {
        "op": "request-changes",
        "action": "Ask \"What should change?\" for stage \"practices-discovery\" and end the turn. After the human answers, submit Request Changes with their exact text unchanged as the report reason; that unlocks revision and a fresh review.",
        "requiresHuman": true,
        "executableNow": true,
        "interaction": "human-input"
      }
    ]
  },
  "updatedAt": "2026-10-01T19:05:53Z"
}
````

[ВЫВОД] Это прямое свидетельство, что «артефакт стадии должен происходить от подтверждённого человеком summary» проверяется кодом: модель пыталась продолжать `practices-discovery`, не сохранив документ после подтверждения, и получила отказ с готовыми «лекарствами» (`remedies`), два раза подряд (`count: 2`).

### 6.5 Директива «что делать дальше»

`.aidlc-engine/active-directive.json` хранит последнюю выданную директиву (ключевые поля, значения сокращены): `kind: "run-stage"`, `stage: "requirements-analysis"`, `delivery: "issued"`, `active_attempt.status: "settled"`, `rules_bundle` (хэш пакета правил), `directive_sha256`, `steering_payload` (сжатая подсказка для Stop-hook: `s` stage, `c` scope, `n` next stage name «Code Generation», `g` gate=true …). Именно это позволяет Stop-hook'у и новой сессии знать «следующий ход» без чтения всей истории.

### 6.6 Как восстанавливается сессия

[ФАКТ]
1. Хук `SessionStart` (`.claude/hooks/aidlc-session-start.ts`): на `startup/resume/clear` пишет `SESSION_STARTED/SESSION_RESUMED`, на `resume`/`compact` **инжектирует контекст workflow для модели** (резюме: scope, phase, stage, status, agent, next action). Язык диалога не входит в этот контекст — его надо переопределить на первом ходу (`org.md` «Conversation language — stability»).
2. Хук `PreCompact` (`aidlc-validate-state.ts`): валидирует структуру state и пишет `SESSION_COMPACTED` + `<record>/.aidlc-engine/recovery.md`.
3. Инструкции: `CLAUDE.md` «Session Resumption»: на старте определить активный intent, найти `aidlc-state.md`, «load prior context and offer to resume from last checkpoint». Подробности — `stage-protocol-recovery.md` §6 (источники и порядок чтения, resume, re-run стадии, потеря контекста, повреждённый state, пропавшие артефакты, уровни ошибок, противоречивые входы) и §7 (изменения входов mid-stage: мелкие/в предыдущих стадиях/scope/архитектурные, «Archive before change»).
4. Команды: `aidlc engine orchestrate park` → директива `parked` (чистая пауза на границе между стадиями), `/aidlc --resume` (меню resume/redo/jump/start fresh). Правило: не парковаться «потому что контекст кажется длинным» — только при ≥80% usage, показанном харнессом (`SKILL.md`).
5. Возобновление не требует переспрашивать уже отвеченное: вопросы читаются из `*-questions.md`, аудит — из шардов.
6. Строка статуса (`aidlc engine statusline`, `.claude/hooks/aidlc-statusline.ts`) показывает позицию workflow в терминале.
7. Защита от потери: append-only шарды на клон (`audit/<host>-<clone>.md`), блокировка записи через mkdir-lock в системном tmp (`CLAUDE.md` Prerequisites), `runtime-integrity.ts` — защита служебных файлов от прямой правки агентом.

---

## 7. Агенты и роли

### 7.1 Состав и устройство

[ФАКТ] 14 файлов `.claude/agents/aidlc-*-agent.md`: 11 доменных персон, 2 «только-ревью» (`product-lead`, `architecture-reviewer`) и `composer`. Frontmatter: `name`, `display_name`, `description` (с перечнем стадий, которые агент ведёт/поддерживает), `disallowedTools: Task` (агент **не может** порождать других агентов), `model` (`inherit`, для ревьюеров `sonnet`, `effort: medium`, `maxTurns: 60`), `examples` (какие файлы команда может положить в `aidlc/spaces/<space>/knowledge/<agent>/`). Тело: «Core Responsibilities», «Collaboration» (receives from / works with / hands off to), «Memory Focus», «Key Principles». В начале каждого — блок «Delegated knowledge preflight (mandatory)»: агент должен прочитать `.claude/knowledge/aidlc-shared/`, `.claude/knowledge/<agent>/`, а затем командные `aidlc/spaces/<space>/knowledge/...` (если существуют).

`.claude/tools/data/agent-tiers.json`: «judgment» (product, architect, design, developer, devsecops, quality, aws-platform, compliance, composer), «balanced» (reviewers), «templated» (delivery, operations, pipeline-deploy) — подсказка для политики моделей (`aidlc-model-policy.ts`).

### 7.2 Таблица

| Агент | Роль | Ведущий на стадиях | Помощник / в ансамбле | Ключевые инструкции |
|---|---|---|---|---|
| `aidlc-product-agent` | PM / бизнес-аналитик | intent-capture, market-research, scope-definition, requirements-analysis, user-stories | approval-handoff (support), rough-mockups (support) | «No requirement without a source», «Testable or it does not exist», «Ask the uncomfortable questions», «Value over volume», вертикальные срезы, жёсткая приоритизация |
| `aidlc-product-lead-agent` | ревьюер продукта (не создаёт) | ревью intent-capture, rough-mockups, requirements, user stories | — | «REFUTE this artifact», 5 core review questions («Would a developer know exactly what to build?», «Could QA write tests?»…), заземление в Intent Capture, `maxTurns: 60`, первая строка вывода `**Reviewer:** aidlc-product-lead-agent` |
| `aidlc-architect-agent` | архитектор | feasibility, domain-design, units-generation, contract-design, functional-design, nfr-requirements, nfr-design; финал pipeline reverse-engineering | intent-capture (support) | ADR с альтернативами, DDD-паттерны, NFR-паттерны |
| `aidlc-architecture-reviewer-agent` | ревьюер дизайна | ревью технических стадий | — | поиск сломанных ссылок, скрытых зависимостей, недостижимых целей качества |
| `aidlc-design-agent` | UX/UI | rough-mockups, refined-mockups | domain-design (support), user-stories (mob) | wireframing, a11y, дизайн-система |
| `aidlc-delivery-agent` | engineering manager | team-formation, approval-handoff, delivery-planning | scope-definition, units-generation | Bolt-планирование, mob-композиции |
| `aidlc-developer-agent` | разработчик | code-generation, reverse-engineering (скан кода) | practices-discovery (spoke), user-stories (mob) | запись кода в корень workspace, `source-manifest.json`, `data-testid` |
| `aidlc-quality-agent` | QA | build-and-test, performance-validation | nfr-requirements, functional-design, practices-discovery (spoke), user-stories (mob) | пирамида тестов, «Every defect gets a test», «Coverage is a guide, not a goal» |
| `aidlc-devsecops-agent` | безопасность | — | nfr-requirements, infrastructure-design, build-and-test, environment-provisioning, practices-discovery (spoke) | STRIDE, пайплайн безопасности |
| `aidlc-aws-platform-agent` | AWS-архитектор | infrastructure-design, environment-provisioning | feasibility, domain/contract/nfr-design, feedback | Well-Architected, CDK; [ВЫВОД] для проектов без AWS (как этот) обычно неприменим |
| `aidlc-compliance-agent` | GRC | — | feasibility | регуляторика, классификация данных |
| `aidlc-pipeline-deploy-agent` | CI/CD | practices-discovery (lead draft + интеграция), ci-pipeline, deployment-pipeline, deployment-execution | — | ветвление, деплой-стратегии |
| `aidlc-operations-agent` | SRE | observability-setup, incident-response, feedback-optimization | performance-validation | SLO/SLI, runbooks |
| `aidlc-composer-agent` | планировщик workflow | `/aidlc compose` (не стадия) | — | оценка 5 энтропий; вывод `{mode, scopeName, ars, grid, rationale…}` + таблицы; только человеческий approve создаёт scope |

### 7.3 Делегирование и топологии

[ФАКТ] `stage-protocol-ensemble.md` §5 и `stage-protocol.md` §5.

- `mode: inline` — дирижёр сам «надевает» роли лидера и поддержки (читает их персоны и знания), **ничего не диспетчеризует** (так выполняются почти все ideation/inception стадии, в том числе Intent Capture и Requirements Analysis — **вопросы человеку задаёт сам дирижёр**).
- `mode: subagent` — hub-and-spoke: лидер пишет черновик → поддержки работают как реальные субагенты, **независимо друг от друга (mutually blind)**, каждый пишет `contributions/<agent>.md` (первая строка `**Collaborator:** <agent-slug>`, затем `## Contribution`, `## Positions` с префиксами `AGREE:`/`OBJECT:`) → лидер интегрирует. Пример — Practices Discovery: `contributions/aidlc-{quality,developer,devsecops}-agent.md` — **агент-«спицы» формулируют кандидаты вопросов для интервью** (например, контрибуция quality-агента содержит раздел «Suggested interview questions» с `Q-TEST-1..` и т.д.), а сам вопросник пишет затем лидер/дирижёр.
- `mode: pipeline` — цепочка (reverse-engineering): каждое звено видит предыдущее; после каждого звена — `aidlc engine log link`.
- `mode: mob` — mesh, раунды: поддержки параллельно пишут вклады; лидер интегрирует; нерешённые возражения **сортируются**: «judgment calls» (риск-аппетит, приоритеты) выносятся **человеку как структурированный вопрос** (записывается в questions-файл с пустым `[Answer]:`), технические — лидеру/ревьюеру (`stage-protocol-ensemble.md` §5).
- Правила для всех делегированных агентов (`stage-protocol.md:849-857`): они «artifact-scoped, never a workflow conductor»: не вызывают `orchestrate next/report/park`, не меняют состояние, не показывают gate; только возвращают артефакт/вклад/вердикт дирижёру; персона и знания грузятся нативно; пакет правил памяти вклеивается в каждый бриф дословно; контекстный бюджет — пути, а не вклейка содержимого; бриф должен нести строку `Conversation language: <язык>` (`org.md`, «Conversation language — resolution»).
- Ревьюеры: диспетчеризуются только после производства артефактов; не получают diary и план; один файл ревью.
- Детерминированное принуждение: `disallowedTools: Task`; хук `deliver-stage-rules` на `Task|Agent` встраивает правила активной стадии в бриф субагента; `SubagentStop` → событие `SUBAGENT_COMPLETED` (в аудите — 26 запусков); хук `reviewer-scope` ограничивает чтение ревьюера (по юнитам).

---

## 8. Тестирование

[ФАКТ] Фреймворк закладывает тесты в три места (не одна стадия):

1. **Code Generation (3.5)** — тесты создаются **вместе с кодом**. План (`code-generation-plan.md`) *обязан* содержать тестовые шаги и конфигурацию раннера; `unit-test-instructions.md` (команды запуска строго в пределах юнита, «bare project-wide command like `npm test` is not acceptable»); блок `## Testing Contract` вставляется из `aidlc engine testing-posture render` (JSON, определяет порядок TDD/BDD/ATDD/test-after/custom, читается из `## Testing Posture` в `memory/*.md`). Порядок: сначала Plan Approval (отпечаток sha256:v3 плана+инструкций+контракта), затем генерация (`developer-agent` как субагент), затем `code-summary.md`, `traceability.json`, `source-manifest.json`. Правило: «Tests are not deferred to Build and Test — that stage verifies and extends, not creates from scratch».
2. **Build and Test (3.6)** — собирает инструкции (build, integration, performance, security, при необходимости contract/E2E/accessibility — «additional types … create specifically named files»), запускает команды, формирует `build-and-test-summary.md` с таблицей `## Target Verification Matrix` (Target ID, Source, Expected, Actual, Evidence, Owning Stage, Verdict: `Met | Not Met | Unverified`, `Pending` — только промежуточно), `test-results.md`, `cross-unit-traceability.md`.
3. **Performance Validation (4.6)** (Operation) — нагрузка и NFR на production-подобной среде (в `web-ui-lean` пропущена).

Объём — по test strategy (раздел 2.2): Minimal (Nyquist) 1 тест на требование + happy path на компонент; Standard 5–8 тестов на компонент; Comprehensive 10–15 + все типы. «Soft guidelines». Полы scope складываются аддитивно: mvp/enterprise/feature/infra/classic — 80% покрытия строк + CI перед merge; bugfix/security-patch — целевой регрессионный тест; poc/refactor/workshop — только «существующие тесты зелёные»; express — Minimal (`org.md` «Testing Posture»).

**E2E**: [ФАКТ] явной стадии E2E нет. Тип «E2E» упомянут как часть Comprehensive-стратегии и как «additional types … E2E, accessibility»; в пирамиде Standard — 5% E2E. Playwright/Cypress/и т.п. фреймворком не предписаны. В проекте `aidlc-ui` решение по браузерным E2E оставлено открытым для Requirements (`team.md`, «Browser end-to-end tests and browser support are not decided»).

**Что считается прохождением гейта Build and Test** [ФАКТ, `build-and-test.md`]:
- «Failure predicate»: провал, если любая команда build/test упала **или** любой применимый target имеет вердикт `Not Met` или `Unverified`. Тест-цели нельзя ослаблять («Weakening, relaxing, lowering, or disabling a defined quality target is never an acceptable fix»).
- Успех: «every executed command passed AND every applicable target is `Met`» (или единственная пояснительная строка `N/A`).
- Лестница при провале: (1) до 2 исправлений внутри стадии; (2) классификация + **оценка влияния** фикса (усилия, стоимость, риск); (3) при `Construction Autonomy Mode: autonomous` и <3 записей в `## Loop-Back Log` — автоматический возврат в code-generation (Modify для затронутых юнитов, Keep для прочих; Redo запрещён, чтобы не стереть журнал); (4) иначе **halt-and-ask** с перечислением вариантов и их оценённых последствий («Giving up is the human's decision to make, never the agent's»).
- Step 10: Cross-Unit Final Coverage Gate по FR/NFR/AC (см. 5.4).
- Затем обычный approval gate (Approve / Request Changes), ревью — adversarial по умолчанию для Construction.

**Постура тестов в этом проекте** (из `team.md`, подтверждена через Practices Discovery): methodology test-after; ordering «Implement each applicable testable layer, then write and run that layer's tests»; ~80% покрытия, unit-тесты + тесты на фикстурах-образцах aidlc-workspace; обязательные «product safety» тесты (path confinement, script-free рендер, отсутствие write-endpoint'ов, localhost-binding).

---

## 9. Что принуждается кодом, а что только промптом

Принцип самого фреймворка [ФАКТ, `.claude/hooks/aidlc-plan-approval-guard.ts`, строки 10–14]: «Per the framework layering (determinism belongs in tools and hooks, knowledge in agents, judgement with humans)…».

Обозначения: **КОД** — выполняется скриптом/хуком/настройкой и может заблокировать или записать; **ПРОМПТ** — только текст инструкции модели; **КОД+ПРОМПТ** — требование в тексте плюс код, который проверяет или подкрепляет.

| № | Механизм | Чем обеспечивается | Путь |
|---|---|---|---|
| 1 | Порядок стадий, выбор «следующего хода», пропуск стадий, `next_stage` | **КОД**: `aidlc engine orchestrate next/report` читает state + скомпилированный граф, выдаёт ровно одну директиву; LLM запрещено «угадывать» следующую стадию (ПРОМПТ-усиление) | `.claude/tools/aidlc-orchestrate.ts`, `.claude/tools/data/stage-graph.json`, `.claude/tools/data/scope-grid.json`, `SKILL.md` («The orchestrate tool owns all between-stage routing») |
| 2 | Запрет прямых смен состояния (`aidlc-state.ts approve/advance…`, правка `aidlc-state.md`, служебных файлов) | **КОД**: PreToolUse-hook `state-transition-guard` + `runtime-integrity` (exit 2 = отказ); «Read-only state queries and specialized recovery/configuration verbs remain available» | `.claude/hooks/aidlc-state-transition-guard.ts`, `.claude/hooks/runtime-integrity.ts`, `.claude/settings.json` (matcher `Read|…|Bash`) |
| 3 | Блокировка перехода между фазами / стадиями без одобрения | **КОД+ПРОМПТ**: переход делает только `report --result approved`, который требует цепочку `STAGE_AWAITING_APPROVAL` → ответ человека (`HUMAN_TURN`) → точная метка `Approve`; плюс phase-check события (PHASE_VERIFIED) | `.claude/tools/aidlc-orchestrate.ts`, `.claude/tools/aidlc-state.ts`, `.claude/tools/aidlc-log.ts` |
| 4 | «Нельзя бросить стадию на полпути» (модель пытается закончить ход, пока директива ждёт) | **КОД**: Stop-hook блокирует остановку и возвращает директиву; исключения — открытый gate и вопрос с пустым `[Answer]:`; потолок числа блокировок (`stop-hook/block-count.json`) | `.claude/hooks/aidlc-continue-workflow.ts`, `.claude/settings.json` (`Stop`) |
| 5 | **Проверка заполненности ответов** («все `[Answer]:` заполнены») | **ПРОМПТ** (Step 4 протокола) + **частично КОД**: Stop-hook различает «ждём человека» (есть пустой тег) и «модель бросила». Прямой проверки «все теги заполнены → иначе ошибка» перед генерацией артефактов в коде я **не нашёл** [НЕ НАЙДЕНО / не верифицировано: `aidlc-log.ts` проверяет наличие *соответствующего неотвеченного summary-вопроса* и совпадение `[Answer]` с выбором, но не заполненность остальных тегов] | `stage-protocol.md:508`, `.claude/hooks/aidlc-continue-workflow.ts:480–545`, `.claude/tools/aidlc-log.ts:1100–1135` |
| 6 | «Человек действительно ответил» (запрет самоответов ИИ) | **КОД**: хук `UserPromptSubmit` и `PostToolUse(AskUserQuestion)` пишут `HUMAN_TURN`; `log answer`/`report approved` отказывают без нового `HUMAN_TURN`, «or that turn was already used by another decision» | `.claude/hooks/aidlc-record-human-turn.ts`, `.claude/tools/aidlc-log.ts`, `.claude/settings.json` |
| 7 | Summary-подтверждение (`Looks correct`) → генерация | **КОД+ПРОМПТ**: `log decision/answer --checkpoint summary-confirmation` создаёт квитанцию с SHA-256 файла вопросов; запись артефакта «descends from the current confirmation» иначе отказ `SUMMARY_ARTIFACT_UNAUTHORIZED`; значение тега должно точно совпасть (`A. Looks correct` — отказ) | `.claude/tools/aidlc-log.ts`, `.aidlc-engine/summary-authorization/*.json`, `.aidlc-engine/guard-refusals/*.json` |
| 8 | Формат вопросов: A–E + `X. Other`, `Why this is asked`, «не переспрашивать», тональность, количество по depth | **ПРОМПТ** | `stage-protocol.md` §3, `question-rendering.md`, `intent-capture.md` |
| 9 | Поиск расплывчатых ответов и противоречий; follow-up | **ПРОМПТ** (никаких скриптов-детекторов в проекте не найдено) | `stage-protocol.md` §3 («Answer analysis», «Contradiction detection»), `requirements-analysis.md` Step 7–8 |
| 10 | Рендер вопросов как нативного UI | **ПРОМПТ** (запрет «echo» fenced-блока) + возможности инструмента `AskUserQuestion` | `.claude/skills/aidlc/question-rendering.md` |
| 11 | Теги источников/заземление в Intent Capture | **КОД** (сенсор `claim-sources`, advisory по умолчанию, `fire_on: gate`) + **ПРОМПТ** (правила Step 4) | `.claude/sensors/aidlc-claim-sources.md`, `.claude/tools/aidlc-sensor-claim-sources.ts` |
| 12 | Наличие H2, ссылки на upstream-артефакты | **КОД** (сенсоры `required-sections`, `upstream-coverage`) | `.claude/sensors/*.md`, `.claude/tools/aidlc-sensor-*.ts`; запуск хуком `run-sensors` |
| 13 | Элемент-за-элементом трассируемость FR→AC→BR→код (`traceability.json`) | **КОД** (сенсор `traceability`) в Construction; в Ideation/Inception нет | `.claude/sensors/aidlc-traceability.md` |
| 14 | Ревьюер: обязательность, независимость контекста, запрет менять артефакт после READY | **КОД+ПРОМПТ**: `log review` (запрос/вердикт, отпечатки), незакрытый запрос блокирует завершение, `review-freeze` hook, `reviewer-scope` hook (чтение чужих юнитов) | `.claude/hooks/aidlc-review-freeze.ts`, `.claude/hooks/aidlc-reviewer-scope.ts`, `.claude/tools/aidlc-log.ts`, `stage-protocol-reviewer.md` |
| 15 | План до кода (Plan Approval) | **КОД**: PreToolUse `plan-approval-guard` блокирует dispatch developer-агента и запись кода в workspace, пока нет текущего одобрения (отпечаток) | `.claude/hooks/aidlc-plan-approval-guard.ts` |
| 16 | Аудит-журнал | **КОД**: хук `write-audit-log` (`ARTIFACT_CREATED/UPDATED`), инструменты `log`, `state`, `orchestrate` (остальные события); ручной `aidlc-audit.ts append` запрещён протоколом | `.claude/hooks/aidlc-write-audit-log.ts`, `.claude/tools/aidlc-audit.ts`, `.claude/tools/aidlc-log.ts` |
| 17 | Агентам запрещено порождать агентов / вести workflow | **КОД** (frontmatter `disallowedTools: Task`) + ПРОМПТ (текст «You are not the workflow conductor») | `.claude/agents/*.md` |
| 18 | Правила памяти попадают в контекст стадии / субагента | **КОД**: директива `load-steering` и хук `deliver-stage-rules` вклеивают правила в Task-бриф; `@`-импорт в CLAUDE.md для ambient-контекста | `.claude/hooks/aidlc-deliver-stage-rules.ts`, `.claude/rules/aidlc.md` |
| 19 | Практики → `memory/team.md`, `project.md` | **КОД**: `aidlc-state.ts practices-promote` (только он пишет `PRACTICES_AFFIRMED`); Approve практики не принимается без успешной промоции | `.claude/tools/aidlc-state.ts`, `practices-discovery.md` Step 6 |
| 20 | Learnings (запись «чему научились» в memory) | **КОД+ПРОМПТ**: `aidlc-learnings.ts surface/persist` детерминированно, LLM рендерит вопрос и делает conflict-check с `org.md`, решает человек | `.claude/tools/aidlc-learnings.ts`, `stage-protocol-learnings.md` |
| 21 | Guard Policy (strict/relaxed/off, отдельные fences) | **КОД**: настройки в state/settings; человек переключает командой; LLM «не снижает» сам | `aidlc-state.md → Scope Configuration`, `.claude/tools/aidlc-guard-switch.ts`, `.claude/tools/aidlc-guard-fences.ts`, `CLAUDE.md` раздел Guards |
| 22 | Состояние после сжатия контекста | **КОД**: PreCompact `validate-state`, SessionStart `session-start` инжектирует контекст | `.claude/hooks/aidlc-validate-state.ts`, `.claude/hooks/aidlc-session-start.ts` |
| 23 | Разрешения на инструменты (без запросов на каждый вызов) | **КОД** (настройки Claude Code): `permissions.allow` = `Read, Edit, Write, Glob, Grep, Task, WebSearch, Bash(date -u *), Bash(aidlc engine *)` | `.claude/settings.json` |
| 24 | Голос/тональность для пользователя, запрет внутреннего жаргона | **ПРОМПТ** (voice contract) | `stage-protocol.md:5–86` |
| 25 | Цели качества нельзя ослаблять | **ПРОМПТ** в 5 местах (Build and Test, Code Generation, §3 red flags); результаты фиксируются в Target Verification Matrix (код не проверяет честность) | `build-and-test.md`, `code-generation.md`, `stage-protocol.md:576` |
| 26 | Содержательная трассируемость на границе фаз и % покрытия | **ПРОМПТ** (модель пишет `phase-check-*.md`) + **КОД** (событие `PHASE_VERIFIED` и невозможность перейти без закрытия стадий) | `stage-protocol-governance.md`, `verification.md`, `verification/phase-check-ideation.md` |
| 27 | Mermaid/ASCII/экранирование, шаблоны артефактов | **ПРОМПТ** (§10), шаблонный override проверяется сенсором `required-sections` | `stage-protocol.md` §10 |
| 28 | Язык диалога и его стабильность | **ПРОМПТ** (org.md «Conversation language — …»); персистентность — только через learnings-ритуал | `aidlc/spaces/default/memory/org.md` |

---

## 10. Ключевые промпт-паттерны

Дословные формулировки (переносы строк внутри цитат убраны; обрыв цитаты многоточием не ставлю — продолжение предложения есть в исходнике). Каждая цитата автоматически сверена с текстом файла; номер строки — первая строка совпадения.

1. `.claude/aidlc-common/protocols/stage-protocol.md:345`
   > **The questions file is always the source of truth.**

   Зачем: Файл — единый источник истины для всех трёх режимов ответа; всё остальное (чат, UI) вторично и может быть потеряно.

2. `.claude/aidlc-common/protocols/stage-protocol.md:387`
   > A question the user cannot answer without asking you to rephrase it is a defect, not a saved token.

   Зачем: Переводит «краткость» в дефект; заставляет делать вопросы самодостаточными.

3. `.claude/aidlc-common/protocols/stage-protocol.md:378`
   > **Never re-ask an answered question.**

   Зачем: Убирает усталость от повторов; требует читать прошлые questions-файлы и аудит.

4. `.claude/aidlc-common/protocols/stage-protocol.md:381`
   > If it leaves a real ambiguity or conflicts with newer evidence, ask a narrow follow-up that names the prior answer

   Зачем: Вместо повторного открытия темы — узкий уточняющий вопрос со ссылкой на прошлый ответ.

5. `.claude/aidlc-common/protocols/stage-protocol.md:374`
   > **These are guidelines, not hard caps.** The agent MUST use judgment

   Зачем: Диапазоны вопросов — ориентир, решение принимает модель по контексту.

6. `.claude/aidlc-common/protocols/stage-protocol.md:535`
   > **When in doubt, ask.** Incomplete answers lead to poor designs.

   Зачем: Базовое смещение в сторону вопроса, а не допущения.

7. `.claude/aidlc-common/protocols/stage-protocol.md:508`
   > Do NOT proceed with partial answers.

   Зачем: Запрет идти дальше с неполным файлом ответов.

8. `.claude/aidlc-common/protocols/stage-protocol.md:569`
   > Default to asking, not assuming. Never proceed with ambiguity.

   Зачем: Антиуверенность: общая установка для анализа ответов.

9. `.claude/aidlc-common/protocols/stage-protocol.md:578`
   > When a user defers to AI judgment, reframe: "I want to make sure the design reflects YOUR priorities.

   Зачем: Не принимает «решай сам»: возвращает выбор человеку в терминах его приоритетов.

10. `.claude/aidlc-common/protocols/stage-protocol.md:576`
   > Relaxing, lowering, or disabling a previously defined quality target (e.g.

   Зачем: Ослабление цели качества — красный флаг для follow-up, а не способ «пройти шаг».

11. `.claude/aidlc-common/protocols/stage-protocol.md:522`
   > Never silently promote an assumption, open question, unselected option, or

   Зачем: Не даёт допущению превратиться в требование без подтверждения.

12. `.claude/aidlc-common/protocols/stage-protocol.md:132`
   > Never summarize User Input

   Зачем: Точные формулировки человека — для аудита и точной трассировки.

13. `.claude/aidlc-common/protocols/stage-protocol.md:169`
   > you MUST end your turn immediately and wait for the user's explicit response

   Зачем: HARD STOP на gate: человек не может быть «выведен» из цикла.

14. `.claude/aidlc-common/protocols/stage-protocol.md:135`
   > Autonomy is NEVER inferred

   Зачем: Разовое «выбери рекомендуемое» не создаёт постоянного права на самоответы.

15. `.claude/aidlc-common/protocols/stage-protocol.md:537`
   > Write every pending question into the questions file before you end the turn

   Зачем: Согласует промпт и Stop-hook: вопрос без пустого тега невидим для кода.

16. `.claude/aidlc-common/stages/ideation/intent-capture.md:107`
   > The register is the complete permitted-source universe for this stage. Do not register background knowledge, common practice, or an inference as a source.

   Зачем: Закрытый перечень источников — основа против выдумок.

17. `.claude/aidlc-common/stages/ideation/intent-capture.md:149`
   > Every substantive claim block

   Зачем: Каждый абзац/пункт/строка таблицы должна нести тег источника.

18. `.claude/aidlc-common/stages/ideation/intent-capture.md:155`
   > Unsupported content is omitted or elicited with a follow-up.

   Зачем: Недоказуемое либо убирается, либо превращается в вопрос — не в «правдоподобный» текст.

19. `.claude/aidlc-common/stages/ideation/intent-capture.md:154`
   > Never turn an unselected option into an exclusion or requirement.

   Зачем: Невыбранная опция — не решение.

20. `.claude/aidlc-common/stages/ideation/intent-capture.md`
   > so a narrow intent never forces the user to select invented detail

   Зачем: Опция «Not yet defined» в каждом вопросе — честный способ не знать.

21. `.claude/aidlc-common/stages/ideation/intent-capture.md:203`
   > Do not invoke the reviewer or proceed to completion while an assumption

   Зачем: Жёсткий порядок: сначала допущения, потом ревью.

22. `.claude/aidlc-common/stages/inception/requirements-analysis.md:138`
   > PROACTIVE: Always generate clarifying questions unless requirements are exceptionally clear and complete across all six dimensions.

   Зачем: Дефолт — спрашивать; пропуск вопросов нужно обосновать полнотой.

23. `.claude/aidlc-common/stages/inception/requirements-analysis.md:200`
   > These IDs are permanent traceability keys.

   Зачем: Стабильные FR/NFR-ID: основа сквозной трассировки.

24. `.claude/agents/aidlc-product-lead-agent.md:53`
   > Your job is to REFUTE this artifact, not to confirm it.

   Зачем: Состязательная роль ревьюера снижает «подтверждающую» предвзятость.

25. `.claude/agents/aidlc-product-lead-agent.md:54`
   > A finding backed only by your taste is a suggestion, not grounds for NOT-READY.

   Зачем: Замечания должны опираться на проверяемые факты.

26. `.claude/agents/aidlc-product-lead-agent.md:66`
   > READY means "engineering can start without coming back to ask questions."

   Зачем: Операциональное определение готовности требований.

27. `.claude/aidlc-common/stages/construction/build-and-test.md:171`
   > Weakening, relaxing, lowering, or disabling a defined

   Зачем: Запрет «лечить» провал тестов снижением планки.

28. `.claude/aidlc-common/stages/construction/code-generation.md:96`
   > Never invent the content of a missing artifact.

   Зачем: Запрет галлюцинировать недостающие входы.

29. `.claude/aidlc-common/stages/construction/code-generation.md:131`
   > **Test files are MANDATORY in the plan.**

   Зачем: Тесты — часть плана, а не «потом».

30. `.claude/aidlc-common/stages/inception/practices-discovery.md:144`
   > **Ask in their words, not the section's.**

   Зачем: Вопросы формулируются языком пользователя, с глоссарием термина в самом вопросе.

31. `.claude/skills/aidlc/SKILL.md:317`
   > **Domain experts**

   Зачем: Роли как «эксперты команды», без жаргона фреймворка.

32. `.claude/hooks/aidlc-plan-approval-guard.ts:12`
   > determinism belongs in tools and hooks, knowledge in agents,

   Зачем: Архитектурный принцип: что должно быть точным — в код, что знание — в агента, что суждение — человеку.

33. `.claude/aidlc-common/protocols/stage-protocol-reviewer.md:156`
   > **Refute, don't confirm.**

   Зачем: Дублирует принцип для всех ревьюеров.

34. `.claude/skills/aidlc/question-rendering.md:11`
   > fenced block is **INPUT to the `AskUserQuestion` tool, never output to render**

   Зачем: Спецификация вопроса ≠ вывод; пользователь видит нативную форму выбора.

35. `.claude/aidlc-common/conductor.md:49`
   > A freeform request is ambiguous by definition.

   Зачем: Подтверждать scope перед началом, а не молча стартовать.

---

## 11. Наблюдения для переноса в OpenSpec

> Весь раздел — **[ВЫВОД]**. Сведения об OpenSpec (кастомные схемы с артефактами/шаблонами/инструкциями, `config.yaml` с `context`/`rules`, зависимости артефактов) — из моих общих знаний, **в этом проекте OpenSpec не установлен и не проверялся**; сверьте с вашей версией OpenSpec.

### 11.1 Что переносится легко (артефакты, шаблоны, инструкции, правила `config.yaml`)

| Идея AI-DLC | Как выразить в OpenSpec [ВЫВОД] | Откуда берём |
|---|---|---|
| Отдельный артефакт «вопросы с ответами» **до** proposal | Первый артефакт схемы (`questions.md`), от которого `requires` зависит `proposal`. Шаблон: `## Q<n>` + строка контекста + варианты A–E + `X. Other` + `[Answer]:` + финальный блок `## Consolidated Summary Confirmation` | реальные файлы `*-questions.md`; `stage-protocol.md` §3 |
| Правила генерации вопросов | `instruction` для артефакта: темы-как-руководство, диапазоны по depth, «не переспрашивать ответы из `openspec/` и прошлых change», самодостаточность (расшифровывать ID), опция «Not yet defined» в каждом вопросе, формулировать языком пользователя с глоссарием термина | §3, `intent-capture.md`, `practices-discovery.md` |
| Анализ ответов | инструкция «после ответов: (1) список расплывчатых слов, (2) 4 класса противоречий, (3) красные флаги, (4) follow-up-вопросы **в тот же файл** с продолжением нумерации» | §3 «Answer analysis», «Contradiction detection», «Overconfidence prevention» |
| Режимы ответа (Guide me / Edit file / Chat) | в OpenSpec-скилле/команде — инструкция предложить три режима; все сходятся в файл | §3 Step 2–3c |
| Подтверждение перед генерацией | инструкция: «не создавай proposal/specs, пока в `questions.md` нет `[Answer]: Looks correct` под `Consolidated Summary Confirmation`» (мягкая версия, без квитанции) | `question-rendering.md`, §3 Step 3a |
| Заземление и теги источников | правила для `proposal.md`/`specs`: каждый абзац с `[Q<n>]`/`[assumption]`, раздел `## Assumptions & Open Questions` (`None.` если пусто), реестр `## Sources`; допущение нельзя «повышать» без вопроса | `intent-capture.md` Step 2/4/5, `claim-sources` |
| Стабильные ID требований | `FR1`, `FR1.2`, `NFR3`, затем в `specs/`/`tasks.md` ссылки на них; в `design.md` — таблица покрытия | `requirements-analysis.md` Step 10, `verification.md` |
| Decision log + «Superseded earlier statements» | артефакт `decisions.md` с ссылками `[Q<n>]` и разделом «что позже сузило ранее сказанное» | `approval-handoff/decision-log.md` |
| Ревью независимым субагентом (advisory) | шаг в скилле/инструкции: «запусти ревьюера с промптом REFUTE; не давай ему план и diary; результат — `review.md` с `READY/NOT-READY` и таблицей замечаний (ID, Severity, Location, Finding, Required action)»; замечания зачитываются человеку, решение за ним | `aidlc-product-lead-agent.md`, `stage-protocol-reviewer.md` |
| Depth и test strategy | поля в `config.yaml → context` или отдельные схемы (`lean`, `standard`, `deep`); таблицы «сколько вопросов/тестов» — в `rules` | §8 |
| Правила команды/проекта (`ALWAYS…/NEVER…`) | `config.yaml → rules` / `context`; фиксируются через обычный вопрос на практиках | `memory/*.md` |
| Тональность «без жаргона» | `context`-правило: «говори словами проекта, не терминами процесса» | `stage-protocol.md:5–86` |
| Gate (Approve / Request Changes) | в OpenSpec — естественный шаг `openspec archive`/просмотр; инструкция «не продолжай без явного выбора пользователя» | §1–2 |

### 11.2 Что требует hooks или скриптов (иначе сработает как пожелание)

| Свойство | Что нужно | Прототип в AI-DLC |
|---|---|---|
| «Все `[Answer]:` заполнены» до генерации proposal | PreToolUse-hook на запись в `proposal.md`/`specs/**`: отказ, если в `questions.md` есть пустой тег (или нет `Looks correct`) | регулярка `/\[Answer\]:[ \t]*_*[ \t]*$/m` в `aidlc-continue-workflow.ts` |
| Человек действительно ответил (нет самоответов) | `UserPromptSubmit`-hook, пишущий метку «human turn»; скрипт записи ответа проверяет метку | `aidlc-record-human-turn.ts`, `aidlc-log.ts` |
| «Нельзя уйти, пока ждёт вопрос / незавершённая стадия» | Stop-hook, различающий «жду ответа» (есть пустой тег) и «бросил» | `aidlc-continue-workflow.ts` |
| Привязка подтверждения к содержимому | хэш `questions.md` в квитанции; артефакт генерируется только после | `summary-authorization/*.json` |
| Проверка тегов источников | небольшой скрипт/линтер для markdown (regex по абзацам, разрешение `[Q<n>]` в отвеченные вопросы) | `aidlc-sensor-claim-sources.ts` |
| Строгий порядок артефактов | зависимости `requires` в схеме + hook, не дающий писать «вперёд» | `state-transition-guard`, `plan-approval-guard` |
| Заморозка после ревью | hook на Write: запрет менять ревьюированный артефакт до решения человека | `aidlc-review-freeze.ts` |
| Аудит | PostToolUse-hook, добавляющий строку в журнал; события только через инструмент | `aidlc-write-audit-log.ts` |
| Traceability-матрица | скрипт `openspec`-совместимой проверки покрытия FR→spec→task | `traceability.json` + сенсор |
| Возобновление | SessionStart-hook, который читает «позицию» (какой артефакт следующий) | `aidlc-session-start.ts` |

### 11.3 Что не переносится или не нужно

- Движок директив и «forwarding loop» (435 КБ оркестратора + 1.2 МБ библиотеки) — OpenSpec уже имеет собственный жизненный цикл change.
- Audit-шарды на клон, `runtime-graph`, `.aidlc-engine` (хэши, квитанции, steering-токены), Guard Policy/fences и защита рантайма — это инфраструктура многопользовательской гарантийности.
- Bolt/Unit DAG/worktree/swarm/autonomy ladder (`stage-protocol-construction.md`, `-swarm.md`, `aidlc-bolt.ts`, `aidlc-swarm.ts`, `aidlc-worktree.ts`) — решают параллельную сборку; для небольших change избыточны.
- Composer с «энтропией» и scope-grid; 33 стадии. В OpenSpec естественнее набор схем (`lean`/`standard`).
- Мульти-харнесс слой (Kiro/Codex/Cursor/Copilot/opencode адаптеры).
- Learnings-ритуал с conflict-check и записью в память.

### 11.4 Что в AI-DLC избыточно или мешает (по логам этого проекта) [ВЫВОД с опорой на ФАКТЫ]

1. **Тяжесть ритуала на малую работу.** За 7 завершённых стадий (3 из них инициализационные) — 2033 строки аудита, 34 `HUMAN_TURN`, 26 запусков субагентов, 5 summary-подтверждений, 2 ревью, 4 вопроса learnings «Anything to add for next time?» (в просмотренных ответах — «Nothing to add»). Для MVP-проекта (UI-читалка) полный Practices Discovery (3 «слепых» субагента + 8 вопросов) выглядит избыточным [ФАКТ: `contributions/*.md` 6–8 КБ ×3].
2. **Множественные остановки на одной стадии**: режим ответа → вопросы → follow-up → summary → [допущения] → ревью → learnings → gate; на Intent Capture получилось 13 вопросов в 2 раунда + 4 разных подтверждения.
3. **Advisory-ревью не меняло решений**: в обоих ревью (intent-capture и rough-mockups) замечания приняты как `Accepted risk` (5 + 7 = 12 записей в событиях `GATE_APPROVED`). Это знак, что либо замечания слишком «принципиальные» (ревьюер прямо назван «adversarial», даже в advisory), либо человек не хочет вникать [ВЫВОД].
4. **Формальные сенсоры дают шум**: 4 `SENSOR_FAILED` из 29 — на служебных файлах (`practices-discovery-timestamp.md` без H2) и на формальной «упомянуть upstream-артефакт по слагу»; полезного сигнала мало.
5. **Хрупкие инварианты**: дважды подряд код отказал модели (`SUMMARY_ARTIFACT_UNAUTHORIZED`: артефакт стадии не «происходит» от подтверждения) — модель должна была пересохранить документ или заново подтвердить; для пользователя это шум, для модели — риск зацикливания (в системе есть лимит повторов и тексты-подсказки, но они сложные).
6. **Жаргон vs ожидания пользователя**: человек спрашивал «Is aws aidlc generates tasks file? I thought it is so…» (`approval-handoff-questions.md`, Q4), что показывает расхождение ожиданий о «задачах/стадиях/Bolt»; ИИ потратил отдельный follow-up (Q10) на пояснение.
7. **Аудит не хранит содержимого ответов, только выбор** (Requirements Q-intro: «A log of everything that happened … records events … but not the content of your answers»; `QUESTION_ANSWERED` держит `Details` — выбор, а контент живёт в `*-questions.md`). Если нужна «хронология диалога» (как хотел автор проекта), её надо проектировать отдельно.
8. **Первые вопросы часто подтверждают то, что система решила сама** (например, вопрос «Does the workflow-selected scope match…?» при уже выбранном scope), а ответ «not quite sure» породил follow-up; для OpenSpec лучше один явный вопрос о границах change.
9. **Тяжёлая установка**: ~5 МБ TS-инструментов, 19 хуков, внешний бинарь `aidlc`, обязательный рестарт Claude Code после одобрения хуков; AWS-специфика (`aws-platform`, `aws-*` MCP-серверы в описании) не нужна для не-AWS проектов — в этом проекте правило `NEVER depend on any AWS service` соседствует с агентом `aws-platform`, который просто не используется (scope его пропускает).

### 11.5 Минимальная «выжимка» механизма вопросов для OpenSpec (черновик) [ВЫВОД]

Шаблон артефакта `questions.md` (основан на реальном формате, сокращён):

```markdown
# <Change> — Clarifying Questions

## Sources
- [desc] Initial request: "<exact user text>"

## Q1. <Вопрос на языке пользователя; ID расшифрованы>
Why this is asked: <одна строка: что зависит от ответа>
- A. …
- B. …
- C. Not yet defined
- X. Other (please specify)

[Answer]:

## Follow-up questions
<!-- добавлять сюда Q<n+1>…, ссылаясь на «(follow-up to Q1)» -->

## Consolidated Summary Confirmation
- Looks correct
- Request changes

[Answer]:
```

Ключевые правила для `instruction`/`rules` (суть, не дословно): (1) вопросы только по пробелам понимания; «Not yet defined» в каждом; (2) число вопросов по depth, не больше нужного; (3) не переспрашивать то, что уже есть в `openspec/specs/`, прошлых change и ответах; (4) после ответов — искать расплывчатое/противоречия, задавать follow-up в тот же файл; (5) без `Looks correct` не писать proposal/specs; (6) в proposal/specs каждое утверждение с `[Q<n>]` или `[assumption]` в разделе допущений; (7) независимое ревью на предмет «разработчик может начать без вопросов?».

---

## 12. Что не удалось найти / ограничения

**Не найдено [НЕ НАЙДЕНО]:**
- Файлы `aidlc-rules/`, `rule-details/`, `question-format-guide.md`, `content-validation.md` (структура иная; см. 3.0), `aidlc-docs/` (используется `aidlc/spaces/<space>/intents/<record>/`).
- `AGENTS.md`, `docs/` (на них ссылаются `CLAUDE.md`/протоколы), `.mcp.json`, `.claude/commands/`, `OUTCOMES.md`, `settings.local.json` (есть только `.example`).
- Исполняемый бинарь `aidlc` (только TS-исходники); поэтому ни одна команда `aidlc ...` не запускалась и поведение движка я описываю по исходникам/протоколам/логам.
- Прямая проверка кодом «все `[Answer]:` заполнены» — не обнаружена (см. таблицу 9, строка 5); возможно, она есть в неисследованных частях `aidlc-lib.ts`/`aidlc-state.ts`.
- Скрипты-детекторы расплывчатых ответов и противоречий — не обнаружены (по `grep` по `aidlc-log.ts`, `aidlc-state.ts`, `aidlc-lib.ts`, `aidlc-review-brief.ts`).
- Стадии Construction/Operation в реальном запуске ещё не проходили (нет `code-generation` артефактов, нет `traceability.json`, нет Build and Test результатов), поэтому раздел 8 основан на stage-файлах, а не на логах.
- Содержимое `stage-protocol-construction.md` (83 КБ), `stage-protocol-swarm.md` (76 КБ), `.claude/knowledge/aidlc-shared/audit-format.md` (59 КБ), `worktree-info-schema.md` (37 КБ) — не читал: влияют на Bolt/swarm/worktree и каталог аудит-событий.
- Сведения о стоимости/токенах одного workflow (хуки `fold-usage`, `aidlc-usage.ts`, skill `/aidlc-session-cost`) — не измерял.

**Ограничения достоверности:**
- Крупные TS-файлы (`aidlc-lib.ts` 1.2 МБ, `aidlc-orchestrate.ts` 436 КБ, `aidlc-utility.ts` 400 КБ, `aidlc-state.ts` 295 КБ, `aidlc-init.ts` 268 КБ) просмотрены выборочно; утверждения о «кодовом принуждении» опираются на заголовочные комментарии хуков, фрагменты `aidlc-log.ts`/`aidlc-continue-workflow.ts`, `settings.json` и события в аудите, а не на построчный разбор.
- Статус «КОД» для пунктов 3, 14, 16, 20 таблицы 9 частично основан на описании протоколов («the engine refuses…»), а не на чтении соответствующей реализации.
- Число 33 стадий и таблица стадий взяты из сгенерированных таблиц в `SKILL.md` (маркированы «do NOT hand-edit»), а состав `consumes/requires_stage` — из frontmatter прочитанных файлов; остальные стадии могут отличаться деталями.
- Реальные примеры вопросов — всего из одного workflow (`260929-aidlc-web-ui`); на других scope (особенно Construction) количество и тон вопросов могут отличаться.

**Санитизация цитат:** абсолютные пути заменены на `<project>`/относительные, e-mail подтвердившего пользователя и идентификатор сессии удалены. Тексты ответов пользователя в примерах оставлены как есть (в них нет секретов, ключей или внутренних URL).
