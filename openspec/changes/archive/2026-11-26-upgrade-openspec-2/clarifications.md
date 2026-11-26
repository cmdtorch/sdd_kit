# Clarifications — upgrade-openspec-2

Depth: high
Answer mode: chat

## Sources

- [desc] Developer description: "надо обновить openspec в нашем ките на последнюю"

## Main round

### Q1. Есть ли UI-макеты для этого change? (UI mockups)
Why this is asked: макеты включают UI mode и инвентаризацию экранов перед proposal.
- A. Да
- B. Нет
Recommended: B — [desc] просит только поднять версию OpenSpec CLI; у кита нет экранов

[Answer]: B

### Q2. Что делать с командами `/opsx:*`, которые OpenSpec 2.0 больше не создаёт?
Why this is asked: `openspec update` на 2.2.0 удаляет `.claude/commands/opsx/*.md` (проверено на копии репо), а кит называет `/opsx:new`, `/opsx:continue`, `/opsx:apply`, `/opsx:archive` в 18 местах (протоколы, схемы, хуки `schema-starter`/`planning-continue`, README); это решает, какие имена команд стоят в протоколах, сообщениях хуков и в спеках кита.
- A. Перейти на имена скиллов (`/openspec-new-change`, `/openspec-continue-change`, `/openspec-apply-change`, `/openspec-archive-change` …) везде в ките и документации
- B. Кит сам ставит тонкие команды `.claude/commands/opsx/*.md`, которые вызывают скиллы, — привычные `/opsx:*` остаются, тексты кита не меняются
- C. И то и другое: в текстах кита имена скиллов, плюс команды-обёртки `/opsx:*` для привычки
- X. Other (please specify)

[Answer]: A

### Q3. Где ставить скиллы OpenSpec: в проект или глобально на машину?
Why this is asked: в 2.1+ `openspec init --tools claude` по умолчанию ставит скиллы глобально, и установщик кита на 2.2.0 падает с `claude-code did not install openspec-explore` (`installer/sdd-kit.mjs:287`); с `--scope project` всё ставится. Это решает флаги `init`, проверки дрейфа скиллов в `doctor`/`session-start` (они смотрят в `.claude/skills/`) и что коммитится.
- A. В проект (`--scope project`): скиллы в репо, с профилем кита, у всей команды одинаковые
- B. Глобально: скиллы на машине разработчика, в репо их нет
- X. Other (please specify)
Recommended: A — D6 (`docs/decisions.md`) версионирует скиллы OpenSpec в репо, а профиль кита (без `propose`) задаётся для проекта через `openspec/tooling/xdg`

[Answer]: A

### Q4. Как коммитить новую раскладку скиллов: `.agents/skills/` (сами файлы) + симлинки в `.claude/skills/`?
Why this is asked: найдено — правило `.gitignore` кита `!.claude/skills/openspec-*/` (`installer/lib/gitignore.mjs:17`) не пускает в git симлинки (git видит их как файлы, не каталоги), а роутер `openspec` не подходит под `openspec-*`. В проекте, где `.claude/` был в игноре, коллеги после pull не получат скиллы в `.claude/skills/`. Это решает правила `.gitignore` и проверку в `doctor`.
- A. Коммитить и `.agents/skills/`, и симлинки `.claude/skills/openspec*` (исправить правила `.gitignore`)
- B. Коммитить только `.agents/skills/`; симлинки не коммитить, а создавать заново (`session-start` / `openspec.mjs update`)
- X. Other (please specify)
Recommended: A — D6: коллега получает скиллы из git без лишних шагов; нативный Windows — non-goal (`docs/goals.md`), так что симлинки допустимы

[Answer]: A 

### Q5. Что делать с новым скиллом-роутером `openspec` (`/openspec`), который 2.2.0 ставит при любом профиле?
Why this is asked: роутер ставится всегда, профиль его не отключает. Его таблица называет `openspec-propose` и `openspec-ff-change`, которых в профиле кита нет; для отсутствующего скилла он сам ведёт change через CLI (`references/without-skills.md`: `openspec new change` → `instructions`). Это решает, остаётся ли он в проекте и как его видят `doctor`/`session-start`.
- A. Оставить как есть: `schema-starter` и `answers-gate` и так ловят его путь (`openspec new change` без схемы, пропущенные раунды)
- B. Оставить и добавить в `context` кита строку, что в проекте с китом `/openspec` ведёт change через схемы кита (`clarify`/`lean`), без `propose`/`ff`
- C. Удалять его после каждого `openspec update` через обёртку кита, а `doctor` предупреждает, если он появился
- X. Other (please specify)

[Answer]: A

### Q6. Минимальная версия Node для кита
Why this is asked: npm-пакет OpenSpec с 1.16.0 требует Node ≥ 22.12.0, а кит заявляет Node 20+ (`README.md:75`, `package.json` engines `>=20`, проверка в `doctor.mjs:133`). Это решает проверку версии Node в `doctor` и требования в документации.
- A. Поднять минимум кита до Node 22.12: README, `engines`, `doctor` (ошибка ниже 22.12)
- B. Оставить Node 20 для кита, в README написать, что для npm-установки OpenSpec нужен Node 22.12 (или standalone-бинарь OpenSpec)
- X. Other (please specify)
Recommended: A — README ставит OpenSpec именно через `npm i -g`, а эта установка на Node 20 не работает

[Answer]: A

### Q7. Что делает `sdd-kit update` в проекте, где сейчас идёт change, начатый на OpenSpec 1.15.0?
Why this is asked: после апгрейда `/opsx:*` исчезают, а у такого change в протоколах и в чате звучат старые имена команд; в этом репо правило «обновлять только между change» есть только в `CLAUDE.md`. Это решает поведение установщика при обновлении и сценарий для change в работе.
- A. Только предупредить: перечислить активные change и сказать, как их продолжить (новые имена команд)
- B. Отказать, пока есть активные change, если не передан `--force`
- C. Ничего особого: обновить молча
- X. Other (please specify)

[Answer]: A

### Q8. Граница этого change: что входит?
Why this is asked: определяет объём proposal и задач; шаги апгрейда в `CONTRIBUTING.md` («Upgrading the pinned OpenSpec version») покрывают только пин, схемы и факты.
- A. Только апгрейд и то, без чего кит на 2.2.0 не работает: пин, схемы, установщик (scope, `.gitignore`), команды, Node, `docs/openspec-facts.md`, документация
- B. A + новые возможности 2.x: заменить свою проверку дрейфа скиллов на `openspec update --dry-run --json` (факт W12), учесть новые предупреждения валидации (WHEN/THEN, MODIFIED > 500) в своих проверках
- X. Other (please specify)
Recommended: A — `CONTRIBUTING.md` описывает апгрейд как перебазирование на новую версию без новых возможностей; B можно сделать отдельным change

[Answer]: B

### Q9. Сценарий без шага WHEN/GIVEN или без THEN — что делает `check-specs` кита? (follow-up to Q8)
Why this is asked: в Q8 ты выбрал «учесть новые предупреждения валидации». Сейчас `check-specs` только предупреждает о сценарии без THEN, а отсутствие WHEN/GIVEN не проверяет (`openspec/tooling/checks/check-specs.mjs:74`); OpenSpec с 1.16.0 на `validate --strict` падает в обоих случаях. Это решает правило в спеке проверок и уровень находки.
- A. Ошибка в обоих случаях (как `validate --strict`): спека не проходит проверку артефакта, план не идёт дальше, пока не исправлено
- B. Предупреждение в обоих случаях: проверить и WHEN/GIVEN, но не блокировать
- X. Other (please specify)

[Answer]: A

### Q10. MODIFIED-требование длиннее 500 символов — что делает `check-specs` кита? (follow-up to Q8)
Why this is asked: в Q8 ты выбрал «учесть новые предупреждения валидации». Сейчас кит только предупреждает о любом MODIFIED > 500 (`check-specs.mjs:67`, по факту V5 «MODIFIED: not reported»); OpenSpec 2.1.1 предупреждает, когда MODIFIED-требование становится длиннее 500 относительно основной спеки (было ≤ 500), и под `--strict` это падение. Это решает правило длины в спеке проверок.
- A. Ошибка, когда требование было ≤ 500 в основной спеке и стало > 500; предупреждение, когда оно и раньше было > 500
- B. Как сейчас: любое MODIFIED > 500 — только предупреждение
- C. Ошибка для любого MODIFIED > 500
- X. Other (please specify)

[Answer]: A

### Q11. Где проверять дрейф скиллов через `openspec update --dry-run --json`? (follow-up to Q8)
Why this is asked: в Q8 ты выбрал замену своей проверки дрейфа на `update --dry-run`. Замер на копии репо: ~0.7 с на вызов (запуск CLI), а `session-start` работает в начале каждой сессии; сейчас и он, и `doctor` проверяют только два признака (`propose` есть, `continue` нет). Это решает, какой хук/команда вызывает CLI и что видит разработчик при старте сессии.
- A. И в `doctor`, и в `session-start`
- B. Только в `doctor`; `session-start` оставляет свою быструю проверку по файлам
- X. Other (please specify)
Recommended: B — замер 0.7 с на каждый старт сессии; `doctor` запускают руками, там задержка не мешает

[Answer]: A

## Technical round

### Q12. Что делать, если `.gitignore` проекта игнорирует `.agents/` целиком?
Why this is asked: установщик уже обрабатывает такой случай для `.claude/`: комментирует строку `.claude/` и пускает в git только части кита (`installer/lib/gitignore.mjs:41`); для `.agents/` такого правила нет, и после Q4 (коммитить `.agents/skills/`) скиллы в таком проекте молча не попадут в git. Это решает требование к правкам `.gitignore` в спеке `kit/openspec-cli`.
- A. Как с `.claude/`: закомментировать строку, игнорирующую `.agents/` целиком, и пустить в git только `.agents/skills/openspec*`; `uninstall` возвращает строку
- B. Не трогать `.gitignore`, а предупредить в выводе установщика и в `doctor`, что скиллы не попадут в git
- X. Other (please specify)
Recommended: A — так установщик уже поступает с `.claude/` (`installer/lib/gitignore.mjs:41`, D6)

[Answer]: A

### Q13. Старые файлы `/opsx:*`, которые разработчик правил руками: OpenSpec 2.x их не удаляет, а только перечисляет при `update`. Что делает кит?
Why this is asked: при Q2 = A в ките больше нет `/opsx:*`, но такие файлы останутся в `.claude/commands/opsx/` и будут вызывать старые инструкции поверх новых скиллов (changelog 2.0.0: «keeps and lists any you edited»). Это решает, есть ли проверка `doctor` на оставшиеся файлы.
- A. `doctor` предупреждает о каждом оставшемся файле в `.claude/commands/opsx/` и советует удалить его
- B. Ничего: вывода `openspec update` достаточно
- X. Other (please specify)

[Answer]: A

### Q14. На каких версиях Node гонять CI репозитория кита?
Why this is asked: матрица CI сейчас `node: [20, 22]` (`.github/workflows/test.yml:22`); после Q6 (минимум 22.12) Node 20 там больше не установит OpenSpec. Это решает матрицу CI и то, какую нижнюю границу проверяют тесты.
- A. `[22, 24]`: минимум и текущая LTS
- B. Только `[22]`
- X. Other (please specify)

[Answer]: A

### Q15. MODIFIED-требование, которое и раньше было длиннее 500 символов и стало ещё длиннее (follow-up to Q10)
Why this is asked: в Q10 ты выбрал «ошибка, когда было ≤ 500 и стало > 500; предупреждение, когда и раньше было > 500». В коде OpenSpec 2.2.0 правило другое (`dist/core/validation/validator.js:681`): предупреждение (падение под `--strict`) — когда MODIFIED-требование длиннее 500 **и** длиннее, чем в основной спеке; моё описание в Q10 было неточным. Это решает, какие MODIFIED-требования `check-specs` блокирует.
- A. Как OpenSpec: ошибка, когда текст > 500 и длиннее, чем в основной спеке (в т.ч. если раньше уже был > 500); предупреждение, когда > 500, но не длиннее прежнего
- B. Как в ответе на Q10: ошибка только при переходе через 500 (было ≤ 500); если раньше уже было > 500 — предупреждение, даже если текст вырос (такая спека пройдёт проверку кита, но упадёт на `validate --strict`)
- X. Other (please specify)
Recommended: A — так `check-specs` не пропустит спеку, на которой потом упадёт `openspec validate --strict` (правило в `validator.js:681`)

[Answer]: A

## Apply round

### Q16. OpenSpec 2.2.0 `update` переписывает глобальные скиллы в домашней папке. Что делает кит?
Why this is asked: при наличии `~/.agents/skills/openspec-*` команда `openspec update` 2.2.0 всегда обновляет их под текущий профиль (`refreshGlobalSkills`, `dist/core/update.js`), даже при `--scope project` и `skillsScope: project`, и пишет `~/.local/share/openspec/projects.json`; флага, чтобы это выключить, нет. Это решает, проходит ли сценарий «Nothing is written outside the project» и как кит запускает CLI.
- A. Запускать каждый процесс OpenSpec, который стартует кит (установщик, `openspec.mjs`, проверка дрейфа), с `HOME` на пустой временной папке
- B. Сузить сценарий до домашней папки без скиллов OpenSpec и описать в документации, что `update` обновляет и глобальные скиллы
- X. Other (please specify)
Recommended: A — требование «ничего вне проекта» остаётся как есть, `projects.json` тоже не попадает в настоящий HOME

[Answer]: A
