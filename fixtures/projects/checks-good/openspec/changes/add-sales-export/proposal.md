## Why

Accountants rebuild the sales report by hand every month; they need to download it from the system [D1][desc].

## What Changes

- Add an Excel export of paid sales for a chosen period [D1][Q2].
- Accountants and school administrators may download it [Q1].
- The monthly email to the director is not part of this change [Q3].

## Capabilities

### New Capabilities
- `inventory/sales-export`: download of paid sales as an Excel file [D1][Q2]

### Modified Capabilities
- `inventory/student-sales`: teachers are told why they cannot record a sale [desc]

## Impact

| Area | Change |
|---|---|
| `apps/inventory` | new export endpoint and service [D1] |

## Assumptions & Open Questions

- The export period is filtered by the sale date [assumption]
