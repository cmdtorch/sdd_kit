# docs-site/kit-sync Specification

## Purpose

Keeps the pages of the documentation site in `site/` that repeat kit facts (the release tag, the OpenSpec version,
command names) in agreement with the kit, checked by the repository's test suite without installing the site.

## Requirements

### Requirement: The Install page names the current release
`npm test` SHALL fail when an install command (`github:cmdtorch/sdd_kit`) on the site's Install page
(`site/src/content/docs/start/install.md`) carries a tag other than `#v<version>`, where `<version>` is `version` of
the root `package.json`, or carries no tag. The failure message SHALL name the page and the tag found. A page without
any install command SHALL fail too.

#### Scenario: Install page with the current release tag
- **GIVEN** the root `package.json` at version `0.8.1` and an Install page whose install commands all read `npx github:cmdtorch/sdd_kit#v0.8.1 install`
- **WHEN** the release tag check runs on the page
- **THEN** it reports no problem

#### Scenario: Install page with an old release tag
- **GIVEN** the root `package.json` at version `0.8.1` and an Install page with the command `npx github:cmdtorch/sdd_kit#v0.8.0 install`
- **WHEN** the release tag check runs on the page
- **THEN** it reports a problem that names `site/src/content/docs/start/install.md` and `#v0.8.0`

#### Scenario: Install command without a tag
- **GIVEN** an Install page with the command `npx github:cmdtorch/sdd_kit install`
- **WHEN** the release tag check runs on the page
- **THEN** it reports a problem that names the page and says the tag is missing

#### Scenario: Install page without an install command
- **GIVEN** an Install page that holds no `github:cmdtorch/sdd_kit` command
- **WHEN** the release tag check runs on the page
- **THEN** it reports that the page has no install command

#### Scenario: The site's Install page agrees with the kit
- **WHEN** `npm test` runs in the repository
- **THEN** the release tag check and the OpenSpec version check report no problem for `site/src/content/docs/start/install.md`

### Requirement: The Install page names the pinned OpenSpec version
`npm test` SHALL fail when an OpenSpec version on the site's Install page differs from `openspecVersion` of
`kit/openspec/tooling/kit.json`. The OpenSpec versions of the page are every `@fission-ai/openspec@<version>` and the
version in the `OpenSpec CLI` row of its requirements table. The failure message SHALL name the page and the version
found. A page that names no OpenSpec version SHALL fail too.

#### Scenario: Install page with the pinned OpenSpec version
- **GIVEN** a kit pinned to OpenSpec `2.2.0` and an Install page with `npm i -g @fission-ai/openspec@2.2.0` and the table row `| OpenSpec CLI | 2.2.0 exactly |`
- **WHEN** the OpenSpec version check runs on the page
- **THEN** it reports no problem

#### Scenario: Install command with another OpenSpec version
- **GIVEN** a kit pinned to OpenSpec `2.2.0` and an Install page with `npm i -g @fission-ai/openspec@2.1.0`
- **WHEN** the OpenSpec version check runs on the page
- **THEN** it reports a problem that names the page and `2.1.0`

#### Scenario: Requirements table with another OpenSpec version
- **GIVEN** a kit pinned to OpenSpec `2.2.0` and an Install page with the table row `| OpenSpec CLI | 2.1.0 exactly |`
- **WHEN** the OpenSpec version check runs on the page
- **THEN** it reports a problem that names the page and `2.1.0`

#### Scenario: Install page without an OpenSpec version
- **GIVEN** an Install page with neither an `@fission-ai/openspec@<version>` command nor an `OpenSpec CLI` table row
- **WHEN** the OpenSpec version check runs on the page
- **THEN** it reports that the page names no OpenSpec version

### Requirement: Every command of the Commands page exists
`npm test` SHALL fail when the first column of a table on the site's Commands page
(`site/src/content/docs/reference/commands.md`) names a command that does not exist, and the failure message SHALL
name the command. A slash command exists when it is an OpenSpec skill of the kit profile or a command file under
`kit/claude/commands/`. A `node openspec/tooling/...` command exists when its script is a file under
`kit/openspec/tooling/`. Arguments are ignored. Any other cell SHALL fail as unknown.

#### Scenario: Commands of the kit
- **GIVEN** a Commands page whose tables list `/openspec-new-change <name> --schema lean`, `/sdd:clarify` and `node openspec/tooling/bin/doctor.mjs`
- **WHEN** the command check runs on the page
- **THEN** it reports no problem

#### Scenario: A slash command the kit does not have
- **GIVEN** a Commands page whose table lists `/openspec-propose`
- **WHEN** the command check runs on the page
- **THEN** it reports a problem that names `/openspec-propose`

#### Scenario: A kit command file that does not exist
- **GIVEN** a Commands page whose table lists `/sdd:review`
- **WHEN** the command check runs on the page
- **THEN** it reports a problem that names `/sdd:review`

#### Scenario: A tooling script that does not exist
- **GIVEN** a Commands page whose table lists `node openspec/tooling/bin/missing.mjs --change <name>`
- **WHEN** the command check runs on the page
- **THEN** it reports a problem that names `openspec/tooling/bin/missing.mjs`

#### Scenario: A table cell that is not a known kind of command
- **GIVEN** a Commands page whose table lists `openspec update`
- **WHEN** the command check runs on the page
- **THEN** it reports a problem that names `openspec update` as an unknown command

#### Scenario: Commands page without a command
- **GIVEN** a Commands page whose tables hold no command
- **WHEN** the command check runs on the page
- **THEN** it reports that the page lists no command

#### Scenario: The site's Commands page lists only existing commands
- **WHEN** `npm test` runs in the repository
- **THEN** the command check reports no problem for `site/src/content/docs/reference/commands.md`

### Requirement: The site checks need no site install
The checks of the site pages SHALL read the site's files as text. `npm test` SHALL pass in a checkout where
`site/node_modules` does not exist, and SHALL NOT install or build the site. The root `package.json` SHALL declare no
dependency.

#### Scenario: Root package without dependencies
- **WHEN** the root `package.json` is read
- **THEN** it has no `dependencies` and no `devDependencies`, and its `test` script names neither `site` nor `astro`
