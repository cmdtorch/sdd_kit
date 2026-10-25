# Contributing

Thanks for helping. sdd-kit is small on purpose; read [docs/decisions.md](docs/decisions.md) before proposing a
bigger change, and open an issue first for anything that changes the workflow.

## Rules

- **Stack- and layout-agnostic.** No presets, no framework-specific code, no role labels on questions.
- **Zero dependencies.** Plain Node.js ≥ 20, ES modules (`.mjs`), `node:test`.
- **English** for everything that ships in the kit.
- **Kit schemas are forks** of OpenSpec's `spec-driven`: the upstream instruction and template text stays
  verbatim at the start, kit rules are appended after it. `tests/schemas.test.mjs` checks this.
- Each change to behaviour comes with a test, a `CHANGELOG.md` entry under `## Unreleased` and, for a design
  decision, a row in `docs/decisions.md` (append-only).

## Setup

```bash
git clone https://github.com/cmdtorch/sdd_kit.git && cd sdd_kit
npm i -g @fission-ai/openspec@1.15.0     # the pinned version: some tests run the real CLI
npm test
```

There is nothing to install: the repository has no dependencies.

## Repository layout

```
installer/        sdd-kit installer (install / update / status / uninstall)
kit/openspec/     copied into the project's openspec/: protocols, schemas, tooling (checks, hooks, bin, lib)
kit/claude/       copied into the project's .claude/: subagents and the /sdd:clarify command
kit/*.json|yaml   fragments merged into .claude/settings.json and openspec/config.yaml
fixtures/         sample projects used by the tests; fixtures/upstream/ is a pristine copy of spec-driven
tests/            node:test suites
docs/             guides, decisions, verified OpenSpec facts
```

Try a change in a scratch project:

```bash
node installer/sdd-kit.mjs install --target /path/to/scratch-repo --dry-run
node installer/sdd-kit.mjs install --target /path/to/scratch-repo
```

## Upgrading the pinned OpenSpec version

1. `npm i -g @fission-ai/openspec@<new>` and read the upstream changelog since the pinned version.
2. Replace `fixtures/upstream/spec-driven-<old>/` with a byte-for-byte copy of the new built-in schema.
3. Re-base `kit/openspec/schemas/clarify` and `lean`: swap the upstream prefix of each instruction and template;
   keep the kit rules unchanged unless the new upstream text contradicts them.
4. Raise `openspecVersion` in `kit/openspec/tooling/kit.json` and `PINNED_VERSION` in `tests/helpers/openspec.mjs`.
5. Re-verify the facts the tooling relies on in `docs/openspec-facts.md`, then `npm test`.

## Releasing

1. Move `## Unreleased` in `CHANGELOG.md` to `## <version> — <date>`.
2. Set the same version in `package.json` and `kit/openspec/tooling/kit.json`, and in the install commands of
   `README.md` and `docs/guide/install.md` (`npm test` checks that they agree).
3. Commit, then tag and push: `git tag -a v<version> -m "sdd-kit <version>" && git push origin main v<version>`.
   The release workflow runs the tests and publishes a GitHub release with the changelog section as notes.

Versions follow [Semantic Versioning](https://semver.org/) as described at the top of the changelog.
