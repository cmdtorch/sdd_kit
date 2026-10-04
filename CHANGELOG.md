# Changelog

All notable changes to sdd-kit. Versions follow [Semantic Versioning](https://semver.org/):
MAJOR — a change a project must act on (format of an artifact, a gate that blocks more, a removed command);
MINOR — new capability, backwards compatible; PATCH — fixes.

## 0.1.0 — 2026-10-04

First version, ready for the pilot.

- Schemas `clarify` (features, question rounds) and `lean` (small changes), forked from OpenSpec 1.13.0 `spec-driven`.
- Protocols: questions, grounding, testing, handoff, spec review, test review.
- Checks: answers, grounding, specs, traceability, verification, handoff, lint-kit; CI entry point `ci.mjs`.
- Hooks: answers-gate, archive-gate, test-gate (Stop), artifact-feedback, session-start.
- `verify.mjs` (verification matrix from real test results), `api.mjs` (API baseline and diff), `handoff.mjs`
  (frontend import), `review-input.mjs`, `doctor.mjs`, `openspec.mjs` (kit profile wrapper).
- Subagents `spec-reviewer`, `test-reviewer`; command `/sdd:clarify`.
- Presets `django` (pytest plugin, drf-spectacular), `playwright`; adapters `monorepo`, `split`.
- Installer: install / update / status / uninstall with a manifest of hashes; GitHub Actions workflow (`--ci`).
