---
description: sdd-kit — run or continue the clarifying-question round for the current stage of a change
argument-hint: "[change-name]"
---
<!-- sdd-kit: managed file. Do not edit; local changes are overwritten on kit update. -->
Run a clarifying-question round for change `$ARGUMENTS` (if empty: the only active change on the `clarify`
schema; if there are several, ask which one). Follow `openspec/protocols/questions.md` exactly.

1. Pick the round for the change's current stage: no proposal → Main; proposal but no specs → Specs; specs but
   no design → Design; design but no verification plan → Verification; tasks exist → Apply.
2. If that round has unanswered questions, collect the answers (offer the answer modes). If it is confirmed
   and the user wants to add something, append follow-up questions (continue the numbering) and reset that
   round's summary answer to blank.
3. Analyse the answers, add follow-ups, and finish with the summary confirmation.

Write only `clarifications.md` (and `sources/` for new requirement sources). Never write other artifacts in
this command.
