## Why

Accountants rebuild the sales report by hand every month and type in sales from paper lists; they need to export and import them [D1][desc].

## What Changes

- Add an Excel export of paid sales for a chosen period [D1][Q2].
- Add an import of sales from an Excel file [D1].
- Only accountants may export and import [Q1].
- The monthly email to the director is not part of this change [Q3].

## Capabilities

### New Capabilities
- `inventory/sale-export`: download of paid sales as an Excel file [D1][Q2]
- `inventory/sale-import`: upload of sales from an Excel file [D1]

### Modified Capabilities

None.

## Impact

| Area | Change |
|---|---|
| `apps/inventory` | new export and import endpoints and services [D1] |

## Assumptions & Open Questions

- The export period is filtered by the sale date [assumption]
