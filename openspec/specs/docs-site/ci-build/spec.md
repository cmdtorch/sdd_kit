# docs-site/ci-build Specification

## Purpose

Builds the documentation site in `site/` in CI whenever the site, or the kit version it shows, changes, so a broken
site build is found in the pull request and not at deploy time.

## Requirements

### Requirement: CI builds the site
The repository SHALL have a GitHub Actions workflow, separate from the `test` and `release` workflows, with a job
that runs `npm ci` and then `npm run build` in the `site/` folder. The job SHALL fail when either command fails.

#### Scenario: The site workflow installs and builds in site/
- **WHEN** the workflow file `.github/workflows/site.yml` is read
- **THEN** it has a job whose steps run `npm ci` and, after it, `npm run build`, both with `site` as the working directory

#### Scenario: The test workflow does not build the site
- **WHEN** the workflow file `.github/workflows/test.yml` is read
- **THEN** it names neither `site` nor `astro`

### Requirement: The site build runs only for site changes
The site workflow SHALL run on pull requests and on pushes to `main`, and only when a file under `site/` or the root
`package.json` changed. It SHALL NOT run for other changes.

#### Scenario: Triggers of the site workflow
- **WHEN** the workflow file `.github/workflows/site.yml` is read
- **THEN** its `pull_request` trigger and its `push` trigger each list exactly the paths `site/**` and `package.json`, and the `push` trigger lists exactly the branch `main`

### Requirement: The release steps name the site's Install page
The Releasing section of `CONTRIBUTING.md` SHALL name `site/src/content/docs/start/install.md` among the files whose
install commands get the new version, together with `README.md`.

#### Scenario: Releasing step lists the Install page
- **WHEN** the Releasing section of `CONTRIBUTING.md` is read
- **THEN** the step that names `README.md` also names `site/src/content/docs/start/install.md`
