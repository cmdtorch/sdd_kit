# Frontend handoff — add-sales-list

## Summary

The frontend can show the list of recorded sales (newest first, with totals) and record new sales. Spec:
sales/sales-list — "Sales are listed newest first", "Empty list".

## Endpoints

### GET /api/sales/

- **Change:** added
- **Purpose:** all recorded sales, newest first (sales/sales-list)
- **Permissions:** open in this sample (no authentication)
- **Request:** no parameters; not paginated
- **Response:** 200 — array of `{id: int, student: string, quantity: int, unit_price: decimal string, total: decimal string, created_at: ISO date-time}`; `total` = quantity × unit_price
- **Errors:**
  | Status | When | Body |
  |---|---|---|
  | — | none specific to this operation | — |
- **Example:**
  ```http
  GET /api/sales/
  ```
  ```json
  [{"id": 2, "student": "Murad", "quantity": 1, "unit_price": "30.00", "total": "30.00", "created_at": "2026-10-03T12:00:00Z"}]
  ```

### POST /api/sales/

- **Change:** added
- **Purpose:** record a sale
- **Permissions:** open in this sample (no authentication)
- **Request:** JSON body `{student: string (required), quantity: int ≥ 0 (required), unit_price: decimal string (required)}`
- **Response:** 201 — the created sale (same shape as a list item, `total` computed)
- **Errors:**
  | Status | When | Body |
  |---|---|---|
  | 400 | a required field is missing or invalid | `{"student": ["This field is required."]}` (one key per bad field) |
- **Example:**
  ```http
  POST /api/sales/
  Content-Type: application/json

  {"student": "Aysel", "quantity": 2, "unit_price": "50.00"}
  ```
  ```json
  {"id": 1, "student": "Aysel", "quantity": 2, "unit_price": "50.00", "total": "100.00", "created_at": "2026-10-03T12:00:00Z"}
  ```

## Breaking changes

None.

## Not changed / known limitations

- No paging, filters or editing (out of scope).
