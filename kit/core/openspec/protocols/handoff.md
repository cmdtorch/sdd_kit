<!-- sdd-kit: managed file. Do not edit; local changes are overwritten on kit update. -->
# Frontend handoff protocol

Backend first, then frontend (decision D15). When a backend change is done, the frontend must be able to
start **without asking the backend anything**. The handoff is the document that makes that possible. It
is written from facts, not memory:

- the change's delta specs (behaviour, rules, errors);
- `api-changes.json` — the machine diff of the OpenAPI document.

## 1. When

At the end of apply in a backend change, after the tests are green:

1. `node openspec/tooling/bin/api.mjs diff --change <change>` — writes `api-changes.json`: every added,
   modified and removed operation, and which changes break existing clients.
2. If there are no operations, no handoff is needed. Stop here.
3. Otherwise write `openspec/changes/<change>/frontend-handoff.md` (format below).
4. `node openspec/tooling/bin/api.mjs snapshot` — updates the committed API baseline, so the next change
   diffs against this one.
5. Verify and archive as usual. The archive gate refuses an API change without a complete, current handoff.

## 2. Format

```markdown
# Frontend handoff — <change>

## Summary

What the frontend can build now, in two or three sentences. Link the user-facing behaviour, not the code.

## Endpoints

### GET /api/v1/sales/export/

- **Change:** added
- **Purpose:** download the paid sales of a period (spec: inventory/sales-export — "Successful export", "Empty period")
- **Permissions:** accountant, school_admin; others get 403
- **Request:** query `date_from` (date, required), `date_to` (date, required), `page` (int, optional)
- **Response:** 200 — paginated `{count, next, previous, results[{student, total}]}`; `total` is a decimal string
- **Errors:**
  | Status | When | Body |
  |---|---|---|
  | 400 | date_from after date_to | `{"date_to": ["must be on or after date_from"]}` |
  | 403 | not an accountant or admin | `{"detail": "..."}` |
- **Pagination / filtering / sorting:** 25 per page; ordered by sale date
- **Example:**
  ```http
  GET /api/v1/sales/export/?date_from=2026-09-01&date_to=2026-09-30
  ```
  ```json
  {"count": 2, "next": null, "previous": null, "results": [{"student": "Aysel M.", "total": "150.00"}]}
  ```

## Breaking changes

- `GET /api/v1/sales/` — field `note` removed from the response; the sales table must stop showing it.

## Not changed / known limitations

- ...
```

## 3. Rules

- **Every operation in `api-changes.json` gets a `### METHOD /path` section**, exactly as the file names it.
  - Added or modified operations: `Permissions`, `Request`, `Response`, `Errors` and `Example`.
  - Removed operations: `Migration` (what the frontend uses instead).
  - `check-handoff` checks all of this.
- **Errors** list every error scenario the specs define for that operation: status, when it happens, the
  body the frontend receives. Validation messages are shown to users, so give the exact text.
- **Breaking changes** — every operation `api-changes.json` marks breaking appears in
  `## Breaking changes`, with what the frontend must change. Write `None.` only when nothing breaks.
- **Facts only.** Describe what the code and the specs do now. Unknowns are written as questions for the
  backend, never guessed.
- **Plain words for behaviour.** Field names stay exact; explain what they mean for the screen.

## 4. Frontend side

In the frontend repository (or the frontend part of a monorepo):

```
node openspec/tooling/bin/handoff.mjs import --from <backend-repo> --change <backend-change> [--as <frontend-change>]
```

This creates a `clarify` change whose sources are the backend handoff (`[D1]`) and the backend delta specs
(`[D2]`). In that change the API is settled:

- **Ask only UI and UX questions:** screens, navigation, loading / empty / error states, how each error is
  shown, permissions in the UI, copy, formats, responsiveness.
- **A gap in the API** (missing field, unclear error) is a question with `For: Dev` addressed to the backend.
  Do not invent the answer.
