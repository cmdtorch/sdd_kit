# Adapter: split (separate backend and frontend repositories)

Decisions D7, D23, D24: the backend repository is the source of truth and is registered as an OpenSpec store; the
frontend repository references it read-only. E2E browser tests exist only in monorepos.

- `sdd-kit install --adapter split --role backend [--store-id backend]` — creates `.openspec-store/store.yaml`
  (commit it) and registers this checkout on the machine (`openspec store register`).
- `sdd-kit install --adapter split --role frontend [--store-id backend] [--backend-path ../backend]` — adds
  `references: [backend]` to `openspec/config.yaml` (the frontend sees the backend specs in every OpenSpec
  instruction) and registers the given backend checkout. Without `--backend-path` each developer registers it once:
  `node openspec/tooling/bin/openspec.mjs store register <path-to-backend> --id backend --yes`.
- Frontend work starts from a backend handoff: `node openspec/tooling/bin/handoff.mjs list` and
  `handoff.mjs import --from-store backend --change <name>`. Session start warns when the backend checkout is
  stale (behind its upstream or not fetched for 24 h) and lists handoffs not yet imported.
- OpenSpec does not sync stores and does not prevent writes through `--store`; the kit never writes there.
