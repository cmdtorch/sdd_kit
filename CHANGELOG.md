# Changelog

All notable changes to sdd-kit. Versions follow [Semantic Versioning](https://semver.org/):
MAJOR — a change a project must act on (format of an artifact, a gate that blocks more, a removed command);
MINOR — new capability, backwards compatible; PATCH — fixes.

## Unreleased

- `openspec/markers-ignore` (the project's file): paths where the kit does not look for scenario markers,
  e.g. documentation or sample code that shows them.
- A marker counts only when it starts its line (after indentation and a comment opener), as `testing.md` §3
  already required. Markers mentioned in prose or inside string literals are no longer picked up.

## 0.2.0 — 2026-10-18

The kit no longer depends on the project's stack or layout. **Breaking** for projects on 0.1.0.

- Removed: stack presets (`django`, `playwright`, the pytest plugin), topology adapters (`monorepo`, `split`),
  `verify.yaml`, `verify.mjs` and `verification.md`, the Stop-hook test gate, browser E2E, the frontend handoff
  (`api.mjs`, `handoff.mjs`, `check-handoff`, stores), the generated GitHub workflow and `ci.mjs`, the install wizard.
- Scenario markers are plain comments in any language: `@scenario <capability> :: <Scenario name>`. The kit finds
  them by reading the project files and never runs tests; the agent runs the project's own test commands.
- Verification levels are `unit`, `integration`, `manual`.
- Clarifying questions no longer carry `For: Dev | PO/PM`: every question is written so it can be forwarded to
  whoever knows the answer.
- The archive gate checks: all tasks done, kit checks pass, every automated scenario has a marked test, test review.

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
