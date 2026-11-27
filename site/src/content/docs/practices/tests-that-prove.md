---
title: Tests that prove
description: How the kit ties tests to scenarios and what the test reviewer checks.
---

A test suite can be green and still prove nothing. The kit ties every test to the scenario it proves and has
a reviewer check that tie.

## One scenario, one level

The verification plan gives every scenario a level: `unit`, `integration`, `e2e` or `manual`. A `manual` row
needs a reason; it is never a way to skip a test.

## The marker

A test that proves a scenario carries a comment on its own line, in any language:

```python
# @scenario inventory/sales-export :: Successful export
```

```ts
// @scenario inventory/sales-export :: Successful export
```

The archive is blocked until every automated scenario has a marked test.

## Test first

During apply the tests of a task group come before its code. A test that has never failed has not shown it can.

## The reviewer's question

Before apply finishes, a test reviewer reads every scenario next to its tests and asks: **would this test fail
if the feature broke?** It checks that

- every THEN is really asserted,
- assertions are specific: `total == 80`, not `total < 100`,
- an error scenario asserts the error.

The agent fixes the findings. It never weakens a test to get green; after two failed attempts it stops and asks
you.
