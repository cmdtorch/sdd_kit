# Security

## Reporting a vulnerability

Please do not open a public issue. Report it privately through
[GitHub private vulnerability reporting](https://github.com/cmdtorch/sdd_kit/security/advisories/new).
Include the kit version (`npx github:cmdtorch/sdd_kit#v<version> --version`), what you ran and what happened.
You will get an answer within a week.

Only the latest release is supported with fixes.

## What the kit runs on your machine

The kit is plain Node.js with no dependencies. Knowing what it does helps you review it:

- **Installer** (`npx github:cmdtorch/sdd_kit#v<version> install`): copies files into `openspec/` and `.claude/`,
  edits `openspec/config.yaml`, `.claude/settings.json` and `.gitignore`, and runs the OpenSpec CLI
  (`openspec init`, `openspec update`). Use `--dry-run` to see the plan first.
- **Claude Code hooks** (registered in `.claude/settings.json`): local `node` scripts under
  `openspec/tooling/hooks/`. They read project files, run `git ls-files` and `openspec --version`, may block
  a tool call, and add text to the agent's context. They never write project files, never run your tests and make no network requests.
- **Permissions**: the kit adds `permissions.allow` entries only for its own read-only scripts
  (`openspec/tooling/checks/*`, `openspec/tooling/bin/review-input.mjs`, …). Claude Code ignores them until you
  accept the workspace trust dialog.
- **OpenSpec telemetry**: the kit runs `openspec update` through `openspec/tooling/bin/openspec.mjs` with its own
  config, where telemetry is off. Your own `openspec` commands follow your global OpenSpec config.

The kit files are committed to your repository, so changes to them go through your normal code review.
