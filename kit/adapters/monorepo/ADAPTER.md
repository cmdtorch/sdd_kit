# Adapter: monorepo

Layout (D7): `backend/`, `frontend/`, `e2e/`, `openspec/` and `docker-compose.yml` at the root.

- `openspec/tooling/verify.yaml` gets `cwd: backend` for the unit level and `cwd: e2e` for the e2e level; the API
  export runs in `backend/`. Test paths stay relative to the repository root in reports and matrices.
- The CI job installs backend (uv) and E2E (npm, Playwright) dependencies, starts the stack with
  `docker compose up -d --build --wait` and runs `ci.mjs verify` with `E2E_BASE_URL=http://localhost:8080`.
- Expected from the project: compose services with healthchecks (`--wait`), the frontend on port 8080, the
  database on 5432 for unit tests; `e2e/playwright.config.*` uses `E2E_BASE_URL` when set and otherwise starts
  local servers with `webServer`.
