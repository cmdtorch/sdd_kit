## Context

Sales live in `apps/inventory`; there is no export today [desc].

## Decisions

- Build the workbook with openpyxl inside an `ExportService`; openpyxl is already a dependency [desc].
- Only sales with status paid are selected [Q2].

## Risks / Trade-offs

- [Large periods] → a school year has a few thousand sales, fine for a synchronous response [Q2].

## Assumptions & Open Questions

None.
