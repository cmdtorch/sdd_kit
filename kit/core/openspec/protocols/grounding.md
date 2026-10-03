<!-- sdd-kit: managed file. Do not edit; local changes are overwritten on kit update. -->
# Grounding protocol

Applies to changes on the `clarify` schema. Every statement in the planning artifacts must be traceable
to something a human said or wrote. If it is not traceable, it is an assumption and must be labelled as one.

## 1. Source tags

| Tag | Means | Valid when |
|---|---|---|
| `[desc]` | the developer's description in `## Sources` | always |
| `[D<n>]` | a registered requirement source (document, tracker task, client message) | the statement is **explicitly** in that source, not inferred from it |
| `[Q<n>]` | an answer in `clarifications.md` | the question exists, its answer is not blank, and its round summary is `Looks correct` |
| `[assumption]` | not confirmed by any source | **only** inside the `## Assumptions & Open Questions` section |

- Combine tags when several sources back one statement: `[Q3][D1]`.
- When a later answer narrows an earlier one, cite the later one. Mention the earlier one only if the
  difference matters, e.g. "accountants only [Q14] (narrows [Q3])".

## 2. Where tags are required

`proposal.md` and `design.md`:

- **Every substantive block** carries at least one tag at its end. A substantive block is a
  paragraph, a list item or a table data row (one tag cell or a trailing tag per row).
- Headings and the `## Capabilities` path lines are exempt: the capability *descriptions* need tags,
  the `` `path`: `` prefix does not.
- Both files contain `## Assumptions & Open Questions`. When there are none, it says `None.`.
- Every entry there is tagged `[assumption]` and must already be listed in a confirmed round summary
  ("Assumptions I will make"). Never introduce a new assumption silently at generation time.

`specs/**/spec.md`: **no tags and no change-local IDs** (`Q3`, `D1`, `FR1`). Requirement and scenario
names are the merge keys at archive time and test marker keys, so spec text stays clean. Traceability
for specs lives in `verification-plan.md` (the requirement trace table, see `testing.md`).

## 3. Rules

1. **Unselected options are not decisions.** An option the user did not choose never becomes a
   requirement, a non-goal or an exclusion.
2. **Assumptions stay assumptions.** Content tagged `[assumption]` remains an assumption in every
   later artifact until a question in `clarifications.md` confirms it.
3. **`Not yet defined` stays open.** Never fill it with plausible detail. Carry it as an open question
   or an assumption, or ask a follow-up.
4. **Unsupported content is removed or asked about.** If a statement has no source, delete it or add
   a follow-up question. Do not keep it untagged.
5. **No silent strengthening.** A tag records provenance; it does not allow you to widen the claim.
   "Accountants can export [Q3]" does not ground "accountants can export and email reports".
6. **Sources disagree → ask.** When a registered source contradicts an answer or an existing spec,
   ask a follow-up instead of picking one yourself.
