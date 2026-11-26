# Proposal

## Why

Five main specs fail `openspec validate --specs --strict` on OpenSpec 2.2.0, because one requirement in each has more
than 500 characters of text. The kit is now pinned to 2.2.0, and its own specs should pass the strict validation the
kit asks of every project.

## What Changes

- Rewrite the text of the five long requirements in fewer words, so each has at most 500 characters. Behaviour does
  not change: every rule they state is kept, and their names and scenarios stay exactly as they are, so the existing
  test markers keep matching.
- The requirements are shortened, not split: OpenSpec 2.2.0 refuses a MODIFIED requirement that drops a scenario the
  main spec still has, so scenarios cannot move to a new requirement.
- `ui-sources/inventory` "Every element has a decision"
- `ui-sources/screenshots` "The AI asks whether the change has mockups"
- `workflow/autonomous-apply` "Stops that remain"
- `workflow/environment-check` "Start check at the beginning of apply"
- `workflow/subagent-apply` "Every code edit goes through a subagent"

Not in this change: any change to kit files, protocols or tests; other requirements of these specs.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `ui-sources/inventory`: "Every element has a decision" is shortened.
- `ui-sources/screenshots`: "The AI asks whether the change has mockups" is shortened.
- `workflow/autonomous-apply`: "Stops that remain" is shortened.
- `workflow/environment-check`: "Start check at the beginning of apply" is shortened.
- `workflow/subagent-apply`: "Every code edit goes through a subagent" is shortened.

## Impact

- `openspec/specs/` of this repository only (through the archive of this change). No kit, installer or test file
  changes; the existing tests of their scenarios keep their markers.

## Clarifications

- Q: Есть ли у этого change UI-макеты? — A: нет
