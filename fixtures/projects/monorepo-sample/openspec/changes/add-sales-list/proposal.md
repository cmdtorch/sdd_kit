## Why

Staff need to see recorded sales at a glance: who bought what, for how much, newest first [D1].

## What Changes

- A sales list API with student, quantity, unit price and total, newest first [Q1][Q2].
- A sales page that shows the list, or "No sales yet" when there is nothing [Q4].
- No filters, paging or editing in this change [Q3].

## Capabilities

### New Capabilities
- `sales/sales-list`: the sales list API [Q1][Q2]
- `sales/sales-page`: the sales page in the frontend [Q4]

### Modified Capabilities

## Impact

| Area | Change |
|---|---|
| `backend/shop` | Sale model, list/create endpoint [desc] |
| `frontend` | sales page [desc] |

## Assumptions & Open Questions

None.
