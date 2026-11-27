---
title: Choosing a schema
description: When lean is enough and when a change needs clarify.
---

A schema is the workflow a change follows. Name it when you start the change, or let the agent ask.

| Schema | Use it for | Question rounds |
|---|---|---|
| `clarify` (default) | features, anything a client described | Main and Technical |
| `lean` | small, clear changes | none |
| `clarify-ai-qa`, `clarify-qa` (beta) | features that need Gherkin test cases before the design | as `clarify` |

## When in doubt, use `clarify`

The questions are what catches the gaps in a client's request. A `lean` change skips them, so it fits only when
nobody would have to guess behaviour: a rounding fix, a renamed field, a missing validation whose rule is known.
If the agent would have to guess on `lean`, it stops and suggests `clarify`.

```text
/openspec-new-change fix-rounding --schema lean
```

Tests, markers and the archive gate are the same on every schema.

## The depth level

On `clarify` the agent asks once how deep to dig. The level changes how far the agent investigates, not how
many questions it asks.

| Level | The agent settles itself | It asks you |
|---|---|---|
| `low` | everything a user does not see | every decision a user sees |
| `medium` (recommended) | also minor visible details: an order, a label, a default | everything about permissions, money and data |
| `high` | nothing that no source, spec or code settles | every open decision, and the consequences of each answer |
