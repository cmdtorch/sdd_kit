# Releasing the kit (maintainers)

Versions follow semver (see the [changelog](../../CHANGELOG.md)):

- **MAJOR** — projects must act: an artifact format changes, a gate blocks more, a command or option is removed, or the
  pinned OpenSpec version changes.
- **MINOR** — new capability, backwards compatible.
- **PATCH** — fixes.

## Steps

1. `npm test` with the full environment:
   - the OpenSpec CLI at the pinned version;
   - `SDD_KIT_PYTHON` pointing to a Python with pytest and pytest-xdist;
   - `SDD_KIT_E2E=1` with uv, npm and a Playwright Chromium.
2. Bump the version in **both** `package.json` and `kit/core/openspec/tooling/kit.json` (`kitVersion`). Add the
   `CHANGELOG.md` section. `tests/release.test.mjs` fails if the three disagree.
3. If a kit file changed, refresh `fixtures/projects/monorepo-sample`:
   `node installer/sdd-kit.mjs update --target fixtures/projects/monorepo-sample --skip-openspec --yes`.
4. Commit, tag `v<version>`, push the tag.
5. Projects update with `npx github:<org>/sdd-kit#v<version> update`.

## Changing the pinned OpenSpec version

This is always a MAJOR release.

- Re-verify the facts the kit depends on (`docs/openspec-facts.md`): run the phase 0 experiments again with the
  new CLI.
- Re-fork the built-in schema into `fixtures/upstream/`, then re-apply the kit's appended rules to `clarify` and
  `lean`. `tests/schemas.test.mjs` checks that the upstream text is still a verbatim prefix.
- Update `openspecVersion` in `kit.json`. Hooks, the installer, doctor and CI all read it from there.
