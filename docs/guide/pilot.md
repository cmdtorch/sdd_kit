# Pilot migration: an existing OpenSpec project

For a repository that already uses OpenSpec with `spec-driven`. The example is the first pilot: a Django backend with
graphify hooks, the tdd-guard plugin, 8 in-flight changes, and `openspec/` and `.claude/` in `.gitignore`.

## Before you start

- Agree with the team that `openspec/` and the shared parts of `.claude/` will be **committed**. The installer changes
  `.gitignore` accordingly (decision D6), so the in-flight changes and specs become part of the repository.
- Decide whether `.claude/CLAUDE.md` and the project's own skills should be shared too. The kit leaves them ignored
  (D6); add `!.claude/CLAUDE.md` / `!.claude/skills/<name>/` to `.gitignore` if you want them versioned.
- Make sure everyone has OpenSpec 1.13.0.

## Steps

```bash
git checkout -b chore/sdd-kit
npx github:<org>/sdd-kit install --preset django --questions-language Russian --ci --dry-run
npx github:<org>/sdd-kit install --preset django --questions-language Russian --ci
```

Then, by hand:

1. **pytest marker** — add it to `pyproject.toml` (`[tool.pytest.ini_options] markers = [...]`, see
   `kit/presets/django/PRESET.md`).
2. **`openspec/tooling/verify.yaml`** — check the commands against the Makefile:
   - unit level: `make test` / `make test FILE=…`;
   - collect: `uv run pytest --collect-only` (without xdist);
   - gate: `make lint && make typecheck`.
3. **CI** — `.github/workflows/sdd-kit.yml` has a generic PostgreSQL service. Copy the database settings from the
   existing `ci.yaml`: `.envs/.env.ci`, `ENVIRONMENT: ci`, the database name and user. Make the sdd-kit jobs
   required checks on `main`.
4. **API baseline** — `node openspec/tooling/bin/api.mjs snapshot` (drf-spectacular), then commit
   `openspec/api/openapi.json`.
5. `node openspec/tooling/bin/doctor.mjs` until it says *Ready*.
6. Commit, open the PR, and check that both sdd-kit jobs run.

## What changes for the team

- The existing changes keep `spec-driven` and their old workflow. Kit gates do not apply to them (D11).
- New changes default to `clarify`. Small, clear fixes use `lean`.
- graphify hooks and tdd-guard keep working. tdd-guard still enforces red → green; the kit adds traceability,
  verification and the archive gate (D17).
- `/opsx:propose` is gone (it skips the question rounds). Use `/opsx:new` and `/opsx:continue`.
- Update OpenSpec skills only with `node openspec/tooling/bin/openspec.mjs update`.

## First feature in the pilot: what to watch

Collect this feedback to tune the kit:

- How many questions, how many follow-ups, and whether PO/PM could answer the forwarded questions without help.
- Whether the spec reviewer's findings were useful or noise.
- How long the test gate takes. Is the full suite (~75 s) acceptable at the end of apply?
- Whether QA found bugs that a planned scenario should have caught (a missing question, scenario or test).
