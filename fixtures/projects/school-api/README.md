# school-api (fixture)

Django 5.2 + DRF backend of a private school ERP. Fixture for sdd-kit dry runs — not a runnable app.

- `apps/inventory` — sales of additional services (uniforms, books, trips) to students.
- Auth: JWT (SimpleJWT). Roles: `accountant`, `school_admin`, `teacher`.
- Tests: pytest + pytest-django + factory-boy, `make test FILE=...`, full suite `make test`, gate `make check`.
- Frontend lives in a separate repo (React SPA) and talks to `/api/v1/`.
