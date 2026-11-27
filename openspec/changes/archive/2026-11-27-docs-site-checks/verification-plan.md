# Verification Plan

## Scenario coverage

| Capability | Requirement | Scenario | Level | Critical | Test data / setup | Manual reason |
|---|---|---|---|---|---|---|
| docs-site/kit-sync | The Install page names the current release | Install page with the current release tag | unit | no | page text with two `npx github:cmdtorch/sdd_kit#v0.8.1 install` commands; version `0.8.1` | — |
| docs-site/kit-sync | The Install page names the current release | Install page with an old release tag | unit | yes | page text with `npx github:cmdtorch/sdd_kit#v0.8.0 install`; version `0.8.1` | — |
| docs-site/kit-sync | The Install page names the current release | Install command without a tag | unit | no | page text with `npx github:cmdtorch/sdd_kit install` | — |
| docs-site/kit-sync | The Install page names the current release | Install page without an install command | unit | no | page text without `github:cmdtorch/sdd_kit` | — |
| docs-site/kit-sync | The Install page names the current release | The site's Install page agrees with the kit | unit | yes | the real `site/src/content/docs/start/install.md`, root `package.json` and `kit/openspec/tooling/kit.json` | — |
| docs-site/kit-sync | The Install page names the pinned OpenSpec version | Install page with the pinned OpenSpec version | unit | no | page text with `npm i -g @fission-ai/openspec@2.2.0` and `\| OpenSpec CLI \| 2.2.0 exactly \|`; pinned `2.2.0` | — |
| docs-site/kit-sync | The Install page names the pinned OpenSpec version | Install command with another OpenSpec version | unit | yes | page text with `npm i -g @fission-ai/openspec@2.1.0`; pinned `2.2.0` | — |
| docs-site/kit-sync | The Install page names the pinned OpenSpec version | Requirements table with another OpenSpec version | unit | no | page text with `\| OpenSpec CLI \| 2.1.0 exactly \|`; pinned `2.2.0` | — |
| docs-site/kit-sync | The Install page names the pinned OpenSpec version | Install page without an OpenSpec version | unit | no | page text with no OpenSpec command and no `OpenSpec CLI` row | — |
| docs-site/kit-sync | Every command of the Commands page exists | Commands of the kit | unit | no | page text with a table of `/openspec-new-change <name> --schema lean`, `/sdd:clarify`, `node openspec/tooling/bin/doctor.mjs`; the real kit files | — |
| docs-site/kit-sync | Every command of the Commands page exists | A slash command the kit does not have | unit | yes | table row `/openspec-propose` | — |
| docs-site/kit-sync | Every command of the Commands page exists | A kit command file that does not exist | unit | no | table row `/sdd:review` | — |
| docs-site/kit-sync | Every command of the Commands page exists | A tooling script that does not exist | unit | yes | table row `node openspec/tooling/bin/missing.mjs --change <name>` | — |
| docs-site/kit-sync | Every command of the Commands page exists | A table cell that is not a known kind of command | unit | no | table row `openspec update` | — |
| docs-site/kit-sync | Every command of the Commands page exists | Commands page without a command | unit | no | page text with a table header and no command row | — |
| docs-site/kit-sync | Every command of the Commands page exists | The site's Commands page lists only existing commands | unit | yes | the real `site/src/content/docs/reference/commands.md` and kit files | — |
| docs-site/kit-sync | The site checks need no site install | Root package without dependencies | unit | no | the real root `package.json` | — |
| docs-site/ci-build | CI builds the site | The site workflow installs and builds in site/ | unit | yes | the real `.github/workflows/site.yml`, read as text | — |
| docs-site/ci-build | CI builds the site | The test workflow does not build the site | unit | no | the real `.github/workflows/test.yml`, read as text | — |
| docs-site/ci-build | The site build runs only for site changes | Triggers of the site workflow | unit | yes | the real `.github/workflows/site.yml`, read as text | — |
| docs-site/ci-build | The release steps name the site's Install page | Releasing step lists the Install page | unit | no | the real `CONTRIBUTING.md` | — |

## Exclusions

| Capability | Scenario | Reason |
|---|---|---|
| None. | | |

## Requirement trace

| Capability | Requirement | Sources |
|---|---|---|
| docs-site/kit-sync | The Install page names the current release | [desc] |
| docs-site/kit-sync | The Install page names the pinned OpenSpec version | [desc] |
| docs-site/kit-sync | Every command of the Commands page exists | [desc] |
| docs-site/kit-sync | The site checks need no site install | [desc] |
| docs-site/ci-build | CI builds the site | [desc] |
| docs-site/ci-build | The site build runs only for site changes | [desc] |
| docs-site/ci-build | The release steps name the site's Install page | [desc] |

## Environment

- No services. The tests read repository files as text; the root has no YAML parser, so the workflow files are checked
  by their text. `site/node_modules` is not needed.
- Outside the suite, once after the push: the `site` workflow run on PR #11 is green (the real `npm ci` and
  `npm run build`).

- Running application: no
