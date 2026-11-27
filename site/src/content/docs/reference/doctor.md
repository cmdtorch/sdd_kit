---
title: Doctor
description: Check that a machine and a repository are ready for the kit.
---

```bash
node openspec/tooling/bin/doctor.mjs
```

Doctor answers one question: is this machine and this repository ready to work with the kit? For every problem
it names the fix.

Run it

- after cloning a repository that has the kit,
- after updating the kit or OpenSpec,
- when a hook or a command behaves unexpectedly.

It reports, among other things, a wrong OpenSpec version, a Node.js older than 22.12, kit files edited by hand
and OpenSpec skills that differ from the kit's profile.
