<!-- sdd-kit: managed file. Do not edit; local changes are overwritten on kit update. -->
# Meta-repository protocol

Applies while `openspec/clones` exists: the project is a **meta-repository**, a root folder with its own git
that holds the shared instructions and the kit, and application **clones** in sub-folders, each with its own git
(the root's `.gitignore` usually ignores them, e.g. `repos/*`). Changes are planned, implemented and archived from
a session started in the root; the clones' tests and code are read from there.

The rules below hold for a change whose `.openspec.yaml` has `x-sdd-kit-metarepo: true`. The kit writes that
mark together with the version stamp `x-sdd-kit` when the change's first kit artifact (`clarifications.md`, or
`proposal.md` on `lean`) is written in a meta-repository. A change without the mark was started before the
project became a meta-repository: finish it under the single-repository rules. Everything else in the other
protocols stays as it is; this file only adds to them.

## 1. The clone list `openspec/clones`

```text
# One clone per line: <path> or <name>=<path>
repos/backend
web=repos/frontend
```

- One clone per line: a path relative to the root, or `name=path`. A clone without a name is named after its
  folder (`repos/backend` → `backend`). Names use letters, digits, `-`, `_`, `.` and are case-sensitive; `root`
  is reserved for the root itself. `#` starts a comment. A list with no clone line still makes the project a
  meta-repository.
- It is a project file: the kit never overwrites it. The installer writes it (`--metarepo [<entries>]`, or the
  questions of an install in a terminal), and the health check (`node openspec/tooling/bin/doctor.mjs`) reports
  its errors, warns about a declared clone whose folder is missing, and offers folders with their own `.git`
  that the list does not declare.
- A repository name in the rules below is a clone name from this list, or `root` for the root itself (its own
  files, outside every clone).
- Do not clone, pull, switch or create branches: the developer manages the clones.

## 2. The verification plan: *Repository* column and the `e2e` level

On top of `openspec/protocols/testing.md` §2, the *Scenario coverage* table (and on the test-case schemas the
*Test case coverage* table) has a last column *Repository*: the repositories where the row's tests live,
comma-separated (`backend`, `backend, frontend`, `root`). Every row names at least one, `manual` rows too.

```markdown
| Capability | Requirement | Scenario | Level | Critical | Test data / setup | Manual reason | Repository |
|---|---|---|---|---|---|---|---|
| orders/order-flow | Orders are managed | Order is created | integration | no | — | — | backend |
| orders/order-flow | Orders are managed | Empty phone shows a hint | e2e | no | — | — | frontend |
```

- A `unit` or `integration` row needs a test carrying the scenario's marker in **each** named repository. A
  test in another repository, or in the E2E test folder, does not close it.
- Plan a scenario where its behaviour is decided. A scenario that touches both clones but whose rule lives in
  the backend gets one `integration` row for `backend`; the frontend part is left to E2E.
- The level `e2e` exists only in a meta-repository: the row is proven by an E2E test of the stage (§6) that
  references its scenario, with a passed run recorded by `e2e-run.mjs`; no marked test in a repository is
  needed. Such a row needs the stage record `e2e.md`. With the stage skipped (`Mode: skipped`), the row goes
  under "Not verified automatically" in `apply-report.md` with the developer's `Consent:`.
- A row that names a clone missing on disk blocks the archive with a message that the clone is missing.

## 3. Task groups name their repository

Every task group of `tasks.md` starts its heading with exactly one repository in brackets:

```markdown
## 1. [root] Shared rules
## 2. [backend] Order API
## 3. [frontend] Order screen
## 4. Final checks
```

- One repository per group: a group that touches two repositories is split into two groups, e.g.
  `## 2. [backend] Order API`, then `## 3. [frontend] Order screen`.
- Only the last group of a `tasks.md` with two or more groups (the final checks) names none; a single group
  always names one.
- The kit blocks writing `tasks.md` while a group names no repository, two repositories or an unknown one.

## 4. Working in the group's repository

Do the tasks of a group in the folder of the repository the group names, and run that repository's tests with
its own commands, found in the meta-repository's instructions and mise tasks (`AGENTS.md`, `CLAUDE.md`,
`mise.toml` / `.mise.toml` tasks, the clone's README). The kit stores no commands and does not switch or create
branches. TDD per group stays as in `openspec/protocols/testing.md` §5: the tests of the group's scenarios first,
in its repository.

**Missing commands.** When you cannot find how to run the tests, the quality checks or the application of a
repository, ask the developer once and suggest writing the commands into `AGENTS.md`, never into `CLAUDE.md`.
This replaces the suggestion of `openspec/protocols/apply.md` §4 in a meta-repository.

## 5. The full suite per repository and the report

At the end of apply (`openspec/protocols/testing.md` §6) run the full suite and the quality checks in every
repository a task group names, each with its own commands. `apply-report.md` gets one section
`## Repository: <name>` per such repository, after the sections of `openspec/protocols/apply.md` §7:

```markdown
## Repository: backend

Command: mise run test:backend
Result: 214 passed

## Repository: root

Command: none
Result: no tests
```

- At least one `Command:` line and one `Result:` line per section. A repository without tests or checks says
  `Command: none` and `Result: no tests`.
- A missing, repeated or incomplete section blocks the archive. A section for another repository is allowed,
  and a repository named only in the plan needs none. The result is not judged: report what happened.

## 6. E2E in a meta-repository

The clones together count as one web application for the E2E stage (`openspec/protocols/e2e.md`), even when the
frontend and the backend are different clones.

- **The question.** Ask the E2E question only when the change touches the web interface: in the Main round on
  the clarify family and before the first task on `lean`. A change that does not touch the web interface gets no
  question; on the test-case schemas record `Mode: skipped` with the note that the change does not touch the web
  interface.
- **The test folder.** The `Tests:` folder of `e2e.md` is a folder of the root, outside every clone (e.g.
  `e2e/`). Playwright tests inside a clone are tests of that clone only: they are not E2E tests of the stage.
- **What an E2E test proves.** An E2E test of the stage proves the `e2e` plan rows, the scenarios listed in
  `e2e.md` and the `e2e` cases, whatever repository the plan names; it never closes a `unit` or `integration`
  row.
- **Start check.** One command run from the root starts every clone the application needs (e.g. `mise run up`),
  and one address is requested, as in a single repository (`openspec/protocols/apply.md` §4).
- **Recorded runs.** An edit to any file of any clone or of the root (outside `openspec/` and the E2E test
  folder) invalidates a recorded run; files a clone's git ignores do not count.

## 7. A clone's own OpenSpec

A clone may have its own `openspec/` folder from work inside it. From a session started in the root it is read
only: the kit blocks writing, moving or removing files in a declared clone's `openspec/`. To work on it, the
developer opens a session started in the clone.
