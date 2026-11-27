---
title: Your first change
description: The commands you type and the moments the agent waits for you.
---

A feature takes four moments of your attention. Everything between them the agent does by itself.

## 1. Start

```text
/openspec-new-change add-sales-export
```

The agent asks one question first: how deep its questions should go, `low`, `medium` (recommended) or `high`.
Then give it the request: your description and the client's text or file.

## 2. Answer the questions

The agent writes the **Main round** into `clarifications.md`. Answer in the chat or in the file, or forward a
question to whoever decides and bring the answer back. `Not yet defined` is a valid answer: it becomes an open
question or an explicit assumption, never invented detail.

Later there is a second, **Technical round**: errors, edge cases, permissions and design forks.

## 3. Let it plan, then apply

Once the Main round is closed the agent writes the rest of planning without a command from you:

```text
proposal → Technical round → specs → spec review → digest → design → verification plan → tasks
```

Read the digest, at most 15 lines, and say "stop" if the scope is wrong. Then start the implementation in a
fresh chat:

```text
/clear
/openspec-apply-change
```

Apply writes the tests first, then the code, runs the test review and the full suite, and stops only for
decisions that belong to you.

## 4. Archive

```text
/openspec-archive-change add-sales-export
```

You archive, the agent does not. The archive gate lets it through only when every task is done, every check
passes, every automated scenario has a marked test and the test review is ready.

:::tip
Switch on Claude Code's built-in notifications, so you hear when the agent waits for you.
:::
