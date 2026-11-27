# Proposal

## Why

The documentation site in `site/` (Astro Starlight, its own `package.json`, not part of the installed kit) was added
in the `docs-site` branch (PR #11). Nothing keeps it in step with the kit: the release tag and the OpenSpec version on
its Install page are typed by hand, the Commands page can name a command the kit no longer has, and nothing builds the
site, so a broken build is found only at deploy time.

## What Changes

- A test in `tests/release.test.mjs`, next to the existing version checks of `README.md` and
  `docs/guide/install.md`, that reads the site pages as text:
  - `site/src/content/docs/start/install.md`: every `github:cmdtorch/sdd_kit` install command carries the tag
    `#v<version>` of the root `package.json`, and every OpenSpec version on the page (the
    `@fission-ai/openspec@<version>` commands and the `OpenSpec CLI` row of the requirements table) equals
    `openspecVersion` of `kit/openspec/tooling/kit.json`;
  - `site/src/content/docs/reference/commands.md`: every command in the first column of its tables exists. A slash
    command is an OpenSpec skill of the kit profile (`.agents/skills/<name>/SKILL.md`, the versioned copy in this
    repository) or a kit command (`/sdd:clarify` → `kit/claude/commands/sdd/clarify.md`); a
    `node openspec/tooling/...` script is a file under `kit/openspec/tooling/`.
- A CI workflow `.github/workflows/site.yml` with one job that runs `npm ci` and `npm run build` in `site/`. It runs
  on pull requests and on pushes to `main`, only when `site/**` or the root `package.json` changed (the site header
  shows the kit version from it).
- `CONTRIBUTING.md`, Releasing: the version on the site's Install page is updated together with `README.md`.

Not in this change: the content and the design of the site pages; the kit (`kit/`, `installer/`); the existing `test`
and `release` workflows. `npm test` stays dependency-free: it neither installs nor builds the site.

## Capabilities

### New Capabilities
- `docs-site/kit-sync`: the pages of the documentation site that repeat kit facts (the release tag, the OpenSpec
  version, command names) agree with the kit, and the repository's test suite proves it without installing the site.
- `docs-site/ci-build`: the documentation site is built in CI when it, or the kit version it shows, changes.

### Modified Capabilities

None.

## Impact

- `tests/release.test.mjs`: new tests (text reads only, no new dependency).
- `.github/workflows/site.yml`: new workflow; `test.yml` and `release.yml` unchanged.
- `CONTRIBUTING.md`: one release step extended.
- `CHANGELOG.md`: an `## Unreleased` entry.
- `kit/` and `installer/` are untouched, so `docs/how-it-works.md` needs no update and the installed copy is not
  refreshed.

## Clarifications

- **UI mockups?** Not asked: the request states "содержание страниц и дизайн сайта не трогаем", so the change has no
  UI and no mockups.
