<!-- Imported by sdd-kit handoff.mjs from /tmp/claude-1000/-home-coder-project-openspec-c/970cc55f-a427-4b53-8ac8-5ea125737428/scratchpad/be — change "add-sales-export" (active). Read-only copy: the backend repository is the source of truth. -->

# Frontend handoff — add-sales-export

## Summary

Accountants can export paid sales; sales now carry a total and a currency.

## Endpoints

### GET /api/v1/sales/

- **Change:** modified
- **Purpose:** list sales; each sale now has `total` and `currency`, no `note`
- **Permissions:** accountant, school_admin
- **Request:** query `page` (int, optional)
- **Response:** 200 — paginated `{count, next, previous, results[Sale]}`
- **Errors:**
  | Status | When | Body |
  |---|---|---|
  | 403 | not staff | `{"detail": "..."}` |
- **Example:**
  ```http
  GET /api/v1/sales/?page=2
  ```

### POST /api/v1/sales/

- **Change:** modified
- **Purpose:** record a sale; `currency` is now required
- **Permissions:** accountant, school_admin
- **Request:** body `{student, quantity, unit_price, status, currency}`
- **Response:** 201 — the created Sale
- **Errors:**
  | Status | When | Body |
  |---|---|---|
  | 400 | currency missing | `{"currency": ["This field is required."]}` |
- **Example:**
  ```http
  POST /api/v1/sales/
  ```

### GET /api/v1/sales/{id}/

- **Change:** modified
- **Purpose:** one sale
- **Permissions:** accountant, school_admin
- **Request:** path `id` (int)
- **Response:** 200 — Sale
- **Errors:**
  | Status | When | Body |
  |---|---|---|
  | 404 | unknown id | `{"detail": "Not found."}` |
- **Example:**
  ```http
  GET /api/v1/sales/7/
  ```

### PATCH /api/v1/sales/{id}/

- **Change:** modified
- **Purpose:** partial update
- **Permissions:** accountant, school_admin
- **Request:** body: any Sale fields
- **Response:** 200 — Sale
- **Errors:**
  | Status | When | Body |
  |---|---|---|
  | 400 | invalid value | field errors |
- **Example:**
  ```http
  PATCH /api/v1/sales/7/
  ```

### PUT /api/v1/sales/{id}/

- **Change:** modified
- **Purpose:** full update; `currency` required
- **Permissions:** accountant, school_admin
- **Request:** body: all Sale fields
- **Response:** 200 — Sale
- **Errors:**
  | Status | When | Body |
  |---|---|---|
  | 400 | currency missing | `{"currency": ["This field is required."]}` |
- **Example:**
  ```http
  PUT /api/v1/sales/7/
  ```

### GET /api/v1/sales/export/

- **Change:** added
- **Purpose:** download the paid sales of a period
- **Permissions:** accountant, school_admin; others 403
- **Request:** query `date_from`, `date_to` (required), `page`
- **Response:** 200 — paginated `results[{student, total}]`
- **Errors:**
  | Status | When | Body |
  |---|---|---|
  | 403 | not an accountant or admin | `{"detail": "..."}` |
- **Example:**
  ```http
  GET /api/v1/sales/export/?date_from=2026-09-01&date_to=2026-09-30
  ```

## Breaking changes

- `/api/v1/sales/` — `note` removed from responses; POST needs `currency`.
- `/api/v1/sales/{id}/` — `note` removed; PUT needs `currency`.

## Not changed / known limitations

- None.
