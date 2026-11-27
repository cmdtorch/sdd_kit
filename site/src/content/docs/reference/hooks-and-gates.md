---
title: Hooks and gates
description: What blocks the next artifact and the archive, and why.
---

The kit's rules are held by Claude Code hooks, registered in `.claude/settings.json`. These are the ones you
will meet.

| Hook | When | What it does |
|---|---|---|
| schema starter | a change is created without a schema | stops the agent, which then asks you the depth level |
| answers gate | before an artifact is written | **blocks** the proposal, specs, design and verification plan while their question round has a blank answer |
| planning continue | the agent tries to end its turn during planning | sends it on to the next artifact |
| boundary guard | before a shell command | **asks you** before commands that act outside the project: `sudo`, global installs, `kill`, stopping containers |
| test-run guard | before a shell command | keeps a long full test suite in the background and out of implementation subagents |
| archive gate | before the archive | **blocks** the archive until the change is complete |

## What the archive gate needs

- every task is done;
- every kit check passes: answers, grounding, specs, traceability;
- every scenario planned as `unit` or `integration` has a test that carries its marker;
- the test review is `READY`, or a human decision is recorded;
- the implementation report `apply-report.md` passes its check.
