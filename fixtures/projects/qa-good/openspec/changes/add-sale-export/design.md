## Context

Sales live in `apps/inventory`; there is no export or import today [desc].

## Decisions

- Build and read the workbooks with openpyxl inside an `ExportService` and an `ImportService`; openpyxl is already a dependency [desc].
- Only sales with status paid are exported [Q2]; totals are rounded half up [Q5].

## Risks / Trade-offs

- [Large periods] → a school year has a few thousand sales, fine for a synchronous response [Q2].

## Assumptions & Open Questions

None.
