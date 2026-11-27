---
title: What sdd-kit adds
description: The four things the kit puts on top of OpenSpec and Claude Code.
---

OpenSpec gives a change its artifacts: a proposal, specs, a design and tasks. sdd-kit adds the rules that make
those artifacts trustworthy, and Claude Code hooks that hold the rules while you work.

## 1. Questions before code

Before the proposal the agent writes structured clarifying questions into `clarifications.md`. Every question
makes sense on its own, so you can forward it as it is to whoever knows the answer. The agent analyses the
answers for vague words and contradictions and asks follow-ups. While an answer is blank, a hook blocks the
proposal.

## 2. Grounded artifacts

Every statement in the proposal and the design cites where it comes from: an answer (`[Q3]`), your description
(`[desc]`) or a source document. What the agent decided itself is listed as an assumption, never mixed in.

## 3. Tests that prove scenarios

Every spec scenario is planned at a verification level: `unit`, `integration`, `e2e` or `manual`. The test that
proves a scenario carries its marker, a plain comment in any language:

```ts
// @scenario checkout/promo-code :: Code expired yesterday
```

Apply uses TDD: the failing test comes first. A test reviewer then asks of every test: would this fail if the
feature broke?

## 4. Hard guarantees

Claude Code hooks enforce the rules: no artifact before its answers are in, and no archive before the tasks,
the markers and the test review are done.

## What it does not do

- It supports Claude Code only, not other agents.
- It knows nothing about your stack: it has no presets and never runs your tests. The agent uses the commands
  your project documents.
- Each kit version supports exactly one OpenSpec version.
