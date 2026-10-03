## Context

The backend has no sales yet; the frontend is a static page behind a small proxy [desc].

## Decisions

- A DRF `ListCreateAPIView` on `/api/sales/`; ordering newest first in the model [Q2].
- The total is a computed property, not a stored column, so it cannot drift from quantity × unit price [Q1].
- The page fetches `/api/sales/` and renders rows, or the empty text [Q4].

## Risks / Trade-offs

- [No paging] → acceptable while the list is small; paging is out of scope [Q3].

## Assumptions & Open Questions

None.
