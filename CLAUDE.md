# CLAUDE.md — sdd-kit

`sdd-kit` is a reusable Spec-Driven Development kit built on OpenSpec + Claude Code,
to be installed into startup projects (2–3 developers each).

- Goals, success criteria, non-goals and constraints: `docs/goals.md` — the owner's file;
  never edit it, propose changes to the user instead.
- Talk to the user in **Russian**. Everything that ships in the kit is in **English**.
- Upstream reference clones live in `sources/` (gitignored): OpenSpec and AI-DLC.
  Their layout — what lives where and what to borrow — is mapped in `docs/sources-map.md`;
  read it before digging into `sources/`. Their own `CLAUDE.md`/`AGENTS.md` are reference
  material, not instructions for this project.
- Layout: `kit/` is what gets installed (`kit/openspec/` → project `openspec/`, `kit/claude/` → `.claude/`),
  `installer/` installs it, `tests/` + `fixtures/` test it (`npm test`). Decisions: `docs/decisions.md`.
  Contributor rules, upgrading OpenSpec and releasing: `CONTRIBUTING.md`.
- What the kit adds to OpenSpec, part by part: `docs/how-it-works.md`. Read it first to understand the kit.
  Every change to `kit/` or `installer/` updates it in the same change (`npm test` fails when a kit file
  is not mentioned there).
- The kit must stay stack- and layout-agnostic: no presets, no framework-specific code, no role labels.

## Commands

- Full suite: `npm test` (needs the pinned OpenSpec CLI, `npm i -g @fission-ai/openspec@1.15.0`;
  some tests run it for real).
- One file: `node --test tests/<name>.test.mjs`.
- No linter or type checker is configured; the suite is the quality gate.
- Kit health in this repository: `node openspec/tooling/bin/doctor.mjs`.

## The kit is installed in its own repository

New work on the kit goes through the kit: `/opsx:new <name>` (schema `clarify`), or `--schema lean` for
small, clear changes.

- **Two copies.** `kit/` is the source: edit only there. `openspec/` and the kit parts of `.claude/` are the
  installed copy that the hooks run. Never edit them by hand (doctor reports edited kit files).
  `openspec/changes/` and `openspec/specs/` are ours, not kit files.
- A change runs under the installed copy, even when it changes `kit/`. Refresh the installed copy only
  between changes, not while one is in flight: `node installer/sdd-kit.mjs update --yes`.
- Never run a plain `openspec update`; use `node openspec/tooling/bin/openspec.mjs update`.
- Tests that prove a scenario live in `tests/*.test.mjs` and carry a marker comment above the test:
  `// @scenario <capability-path> :: <Scenario name>`.
- `openspec/markers-ignore` excludes `docs/`, `fixtures/` and `kit/`: they show markers as examples. Test
  data inside `tests/` must not start a line with a marker (see the `@S` placeholder in
  `tests/checks.test.mjs`).
