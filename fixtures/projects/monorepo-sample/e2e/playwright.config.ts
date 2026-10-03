import { defineConfig } from '@playwright/test';

// CI: E2E_BASE_URL points at the docker compose stack (frontend on :8080).
// Locally: Playwright starts the backend and the frontend itself (ports E2E_BACKEND_PORT / E2E_FRONTEND_PORT).
const external = process.env.E2E_BASE_URL;
const backendPort = process.env.E2E_BACKEND_PORT || '8000';
const frontendPort = process.env.E2E_FRONTEND_PORT || '4173';

export default defineConfig({
  testDir: './tests',
  workers: 1,
  use: { baseURL: external || `http://localhost:${frontendPort}` },
  webServer: external
    ? undefined
    : [
        {
          command: `uv run python manage.py migrate --noinput -v 0 && uv run python manage.py runserver ${backendPort} --noreload`,
          cwd: '../backend',
          url: `http://localhost:${backendPort}/api/sales/`,
          env: { SQLITE_PATH: 'e2e.sqlite3' },
          reuseExistingServer: false,
          timeout: 120_000,
        },
        {
          command: 'node ../frontend/server.mjs',
          url: `http://localhost:${frontendPort}/`,
          env: { PORT: frontendPort, BACKEND_URL: `http://localhost:${backendPort}` },
          reuseExistingServer: false,
        },
      ],
});
