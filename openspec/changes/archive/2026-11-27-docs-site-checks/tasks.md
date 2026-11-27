# Tasks

## 1. Site pages agree with the kit

Depends on: none
Area: tests/release.test.mjs, tests/helpers/site-checks.mjs
Shared: none

- [x] 1.1 Write failing unit tests in `tests/release.test.mjs` (a `documentation site` group next to `versioning`) for "Install page with the current release tag", "Install page with an old release tag", "Install command without a tag", "Install page without an install command", "Install page with the pinned OpenSpec version", "Install command with another OpenSpec version", "Requirements table with another OpenSpec version", "Install page without an OpenSpec version" and "The site's Install page agrees with the kit", each with its scenario marker, against check functions imported from `tests/helpers/site-checks.mjs` that take the page text and return a list of problems; verify they fail
- [x] 1.2 Implement the release tag check and the OpenSpec version check in `tests/helpers/site-checks.mjs` (text only: every `github:cmdtorch/sdd_kit[#tag]`, every `@fission-ai/openspec@<version>` and the `OpenSpec CLI` table row; each problem names `site/src/content/docs/start/install.md` and the value found); verify the 1.1 tests pass
- [x] 1.3 Write failing unit tests for "Commands of the kit", "A slash command the kit does not have", "A kit command file that does not exist", "A tooling script that does not exist", "A table cell that is not a known kind of command", "Commands page without a command" and "The site's Commands page lists only existing commands", each with its scenario marker; verify they fail
- [x] 1.4 Implement the command check in `tests/helpers/site-checks.mjs`: the first cell of every table row (header and separator rows skipped, backticks stripped, arguments ignored); `/<name>` exists as `.agents/skills/<name>/SKILL.md`, `/<ns>:<name>` as `kit/claude/commands/<ns>/<name>.md`, `node openspec/tooling/<path>` as `kit/openspec/tooling/<path>`; anything else is unknown; verify the 1.3 tests pass
- [x] 1.5 Write the unit test for "Root package without dependencies" with its scenario marker (no `dependencies`, no `devDependencies`, a `test` script that names neither `site` nor `astro`) and verify it passes with `site/node_modules` moved away or absent

## 2. Site build in CI and the release steps

Depends on: 1
Area: .github/workflows/site.yml, CONTRIBUTING.md, CHANGELOG.md, tests/release.test.mjs
Shared: settings

- [x] 2.1 Write failing unit tests in `tests/release.test.mjs` for "The site workflow installs and builds in site/", "The test workflow does not build the site", "Triggers of the site workflow" and "Releasing step lists the Install page", each with its scenario marker, reading the workflow files and `CONTRIBUTING.md` as text; verify the ones that need the new files fail
- [x] 2.2 Add `.github/workflows/site.yml`: `pull_request` and `push` to `main`, each with `paths: ['site/**', 'package.json']`; `permissions: contents: read`; one job on `ubuntu-latest` with `actions/checkout@v7`, `actions/setup-node@v7` (Node 22, npm cache keyed on `site/package-lock.json`), then `npm ci` and `npm run build` with `working-directory: site`; verify the 2.1 workflow tests pass
- [x] 2.3 Extend step 2 of Releasing in `CONTRIBUTING.md` with `site/src/content/docs/start/install.md` (updated together with `README.md`; `npm test` checks it) and add an `## Unreleased` entry to `CHANGELOG.md`; verify "Releasing step lists the Install page" passes
- [x] 2.4 Run `npm ci && npm run build` in `site/` locally and verify the build ends with exit code 0, without changing any file under `site/src/`

## 3. Verification

Depends on: 1, 2

- [x] 3.1 Run the `test-reviewer` subagent and fix blocker/major findings
- [x] 3.2 Run `npm test` and `node openspec/tooling/bin/doctor.mjs`; fix what fails
- [x] 3.3 Write `apply-report.md`, run `node openspec/tooling/checks/check-traceability.mjs --change docs-site-checks --markers` and `openspec validate docs-site-checks --strict`

## Workflow follow-up

- After the push, check that the `site` workflow run on PR #11 is green.
