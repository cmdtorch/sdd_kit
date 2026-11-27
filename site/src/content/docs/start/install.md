---
title: Install
description: Install sdd-kit into a repository and onboard a developer.
---

## Requirements

| | |
|---|---|
| Node.js | 22.12 or newer |
| OpenSpec CLI | 2.2.0 exactly |
| Claude Code | any current version |
| git | the kit finds test markers through git |
| OS | Linux, macOS or WSL |

## Once per repository

The team lead installs the kit and commits it:

```bash
npm i -g @fission-ai/openspec@2.2.0
npx github:cmdtorch/sdd_kit#v0.8.1 install --dry-run   # show the plan, write nothing
npx github:cmdtorch/sdd_kit#v0.8.1 install             # asks for the questions language
git add -A && git commit -m "chore: install sdd-kit"
```

Make sure `CLAUDE.md` or the README of your project says how to run the tests and quality checks: the agent
uses those commands.

## Every developer

The kit is already committed, so there is nothing to install into the repository.

1. Install Node 22.12 or newer, Claude Code and `npm i -g @fission-ai/openspec@2.2.0`.
2. Clone the repository and run `node openspec/tooling/bin/doctor.mjs`. It says what to fix.
3. Open Claude Code in the repository and accept the workspace trust dialog.

## What lands in the repository

| Path | What |
|---|---|
| `openspec/protocols/` | the rules the agent follows |
| `openspec/schemas/` | the kit workflows: `clarify`, `lean`, `clarify-ai-qa`, `clarify-qa` |
| `openspec/tooling/` | checks, hooks and tools: Node.js scripts with no dependencies |
| `.claude/settings.json` | the kit hooks and read-only permissions, merged with yours |
| `.claude/agents/`, `.claude/commands/sdd/` | the reviewers and `/sdd:clarify` |

The installer keeps a hash manifest: an update never overwrites a file you edited, and `uninstall` restores
your configuration.
