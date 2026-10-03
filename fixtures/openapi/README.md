# Real drf-spectacular output (0.30.0, Django 6.1, DRF 3.18), captured 2026-10-03

`drf-before.json` → `drf-after.json`: adds `GET /api/v1/sales/export/` (required query params date_from/date_to, 403),
removes `note` from Sale, adds read-only `total` and required `currency`. Keys sorted for stable diffs.
