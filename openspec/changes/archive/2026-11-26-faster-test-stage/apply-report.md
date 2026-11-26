# Apply Report

## Manual checks

None.

## Not verified automatically

None.

## Weakened tests

None.

## Subagent runs

- 1. Worker limit in the E2E runner — 1.1–1.2 — inherit — 54 tests pass
- 2. Protocol rules: E2E reruns and the final group — 2.1–2.4 — inherit — stopped by the developer before it finished
- 2. Protocol rules: E2E reruns and the final group (replacement) — 2.1–2.4 — opus — 875 tests pass
- 3. Documentation and version 0.6.1 — 3.1–3.2 — opus — 875 tests pass
- 4. Take the narrower E2E selection out — 4.1–4.2 — opus — 872 tests pass
- full suite — — main agent — 872 tests pass (`npm test`, lint-kit included)
