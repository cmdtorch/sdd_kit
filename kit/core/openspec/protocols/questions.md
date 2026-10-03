<!-- sdd-kit: managed file. Do not edit; local changes are overwritten on kit update. -->
# Clarifying questions protocol

Applies to changes that use the `clarify` schema. Requirements we get from clients are often vague.
This protocol makes the gaps visible and gets them answered by a human **before** anything is written.

**The clarifications file is the source of truth.** Interactive answers, answers edited into the
file and decisions reached in chat all end up in this file. Nothing that is only said in chat counts.

Core rules:

- **When in doubt, ask.** Default to asking, not assuming.
- **Never answer on the user's behalf.** Fill an `[Answer]:` only from what the user said in this
  conversation or wrote into the file.
- **A question the user cannot answer without asking you to rephrase it is a defect.**

---

## 1. File layout

`openspec/changes/<change>/clarifications.md`:

```markdown
# Clarifications — <change-name>

Depth: Comprehensive

## Sources

- [desc] Developer description: "<the developer's request, verbatim>"
- [D1] <title of a requirement source> — `sources/<file>`

## Main round

### Q1. <question>
...

### Summary confirmation — Main round
...

## Specs round
...

## Design round
...

## Verification round
...
```

- One file per change. Each **round** is an `##` section, appended when its round starts.
- `Q<n>` numbers are unique across the **whole file** and never reused or renumbered
  (later artifacts cite them as `[Q<n>]`). Follow-ups continue the numbering.
- `Depth:` is `Minimal`, `Standard` or `Comprehensive`. Default: `Comprehensive`.
  Change it only when the developer asks.

### Language

- Write question text, `Why this is asked:` text, options and summary bullets in the **questions
  language** set in `openspec/config.yaml` context (`Questions language: <language>`; English if not
  set). PO/PM questions are forwarded verbatim, so they must be in the language the business speaks.
- The **structural keywords always stay in English**, because the kit's checks parse them:
  - the headings `## Sources`, `## Main round` (and the other round names), `### Q<n>.`,
    `### Summary confirmation — <Round>`, `### Requested changes — <Round> #<k>`;
  - the line labels `Depth:`, `For: Dev | PO/PM`, `Why this is asked:`;
  - the option labels `X. Other (please specify)`, `Not yet defined`;
  - `[Answer]:`, `Looks correct`, `Request changes`, `(follow-up to Q<n>)`, and the source tags.
- Everything after the clarifications file — proposal, specs, design, plans, tests — is written in English.

### Sources

- `[desc]` is the developer's description of the change, quoted exactly.
- `[D<n>]` is a requirement source: a document, a tracker task or a chat message from the client.
  - Store it under `openspec/changes/<change>/sources/` as `.md`, `.pdf` or `.txt`.
  - Text pasted into the conversation is saved by you as `sources/D<n>.md`.
  - For a `.docx` or another format you cannot read, ask the developer to export it to PDF or
    Markdown, or to paste the text.
- The register is the complete list of permitted sources. Your background knowledge and common
  practice are not sources.

## 2. Question format

```markdown
### Q3. Who can export the sales report: only accountants, or every staff member?
For: PO/PM
Why this is asked: the requirement says "users can export" but the report contains prices; this decides the permission rule.
- A. Only accountants
- B. Accountants and school administrators
- C. Every staff member
- D. Not yet defined
- X. Other (please specify)

[Answer]:
```

- `For:` is `Dev` or `PO/PM`.
  - `PO/PM` marks business questions: scope, rules, priorities, wording, who may do what.
  - The developer forwards these as they are, so they must make sense **without the file**:
    - no code identifiers, endpoint paths or framework terms;
    - the context needed is written into the question itself.
- `Why this is asked:` gives one line on what depends on the answer.
- Options:
  - Use letters `A.`, `B.`, … for real choices; they must be concrete and mutually exclusive.
    Prefer at most five. More than five usually means the question should be split, or turned into
    a multi-select.
  - Always include an honest way out: `Not yet defined`, `Not applicable` or `None`. This applies to
    multi-select questions too. It keeps a narrow change from forcing the user to pick invented detail.
  - The last option is always `X. Other (please specify)`.
- Multi-select questions add `(select all that apply)` to the question text.
- `[Answer]:` is left blank.
- Ask one decision per question.

### Writing good questions

- **Self-explanatory.** Never show a bare reference such as `FR3`, `Q2` or `D1` as if the reader
  knows it. Write what it names first.
- **Concrete over abstract.** Ask about the actual decision in the project's domain words:
  "Two parts of the requirement disagree: 30 days vs 90 days. Which one is right?" beats
  "What is the retention period?".
- **Do not re-ask.** Before adding a question, check that it is not already answered by:
  - this clarifications file (all rounds);
  - the registered sources;
  - existing specs (`openspec list --specs`, `openspec show "<spec-id>" --type spec`);
  - the code.

  If an earlier answer leaves a real gap, ask a **narrow follow-up that quotes it**:
  "In Q2 you chose accountants only. Does that include the head accountant's deputy?"

## 3. Rounds

| Round | Asked before writing | Topics (guidance, not a script) |
|---|---|---|
| Main | `proposal.md` | the problem and goal; who uses it (roles); what is in scope; **one explicit scope-boundary question** (what is deliberately left out); success criteria; constraints (deadlines, legal, integrations); existing behaviour or data that changes; permissions |
| Specs | spec files | completeness in six dimensions: **functional** behaviour; **non-functional** (performance, security, limits); **user scenarios** incl. error cases, empty states, edge cases, concurrency; **business rules** (calculations, statuses, validations, messages); **technical context** (integrations, existing APIs, data migration); **quality attributes** (accessibility, auditability, localisation) |
| Design | `design.md` | architectural forks only: choices that would change the specs, the approach or the task breakdown (data model options, sync vs async, migration strategy, new dependencies). Deferrable details stay out |
| Verification | `verification-plan.md` | which user journeys are critical enough for browser E2E; test data the scenarios need; environments; checks that can only be done manually |
| Apply | — (during implementation) | only real gaps found while coding. Append `## Apply round` and follow the same flow |

### How many questions

| Depth | Main round | Later rounds |
|---|---|---|
| Minimal | ~2–4 | 0–2 |
| Standard | ~5–8 | ~2–5 |
| Comprehensive | ~8–12+ | ~3–8 |

These are guidelines, not caps:

- A vague request deserves more questions; a crystal-clear one fewer. Never pad with noise.
- Later rounds ask only what earlier rounds and sources did not settle.
- A round with **zero** questions is allowed. It still gets a summary confirmation, which lists the
  decisions and assumptions you are about to rely on.
- Follow-ups and contradiction checks are mandatory at every depth.

## 4. Getting the answers

After writing the questions, use **AskUserQuestion** to offer the answer mode:

- **Guide me** — ask the questions here, interactively.
- **I'll edit the file** — the developer fills in the file and says "done".
- **Chat** — discuss freely; you extract the decisions.

Also tell the developer which questions are `For: PO/PM`, so they can forward them.

**Guide me**

- Use batches of at most 4 questions per AskUserQuestion call, with 2–4 options per question.
  Split a question with more options across calls (A–D, then E+). The file keeps the full option set.
- Tell the user before the first batch: "Pick *Other* on any question to discuss it first."
  - *Other* means "let's talk": discuss, then ask that question again.
  - Never write "Other" itself as the answer.
- After each batch, **immediately** write the answers into the file.

**I'll edit the file** — give the file path and wait for the user's signal ("done", "ready").
Do not read or act on the file before that.

**Chat** — discuss. When decisions emerge, write them into the matching `[Answer]:` tags, with the
user's own words where possible, followed by ` (chat)`.

### Answer syntax

| Meaning | Written as |
|---|---|
| single choice | `[Answer]: B` |
| several choices | `[Answer]: A, C` |
| Other | `[Answer]: X — <text>` |
| clarifying note | `[Answer]: B — only for the current school year` |
| delegated to you | `[Answer]: B (user accepted the recommendation)` — only after the reframe in §5 |
| not answered yet | blank, or only underscores (`[Answer]: ___`) |

## 5. Analysing the answers (mandatory)

When every question in the round has an answer, check the whole set before going on:

1. **Completeness.** No blank `[Answer]:` is left in the round.
2. **Validity.**
   - An answer that matches no option and is not a clear free-text answer → ask which option was meant.
   - "maybe B", "A or C" → ask the user to commit to one choice.
3. **Vagueness.** Look for "mix of", "not sure", "depends", "probably", "maybe", "for now", "etc.",
   "as usual", "standard", "normal", "some", "later".
4. **Red flags.**
   - A one-word answer to an open question.
   - An answer that dodges the question.
   - Lowering or disabling a quality target that was set earlier.
   - "up to you" or "whatever you think" → reframe once: "I want this to reflect *your* priorities —
     what matters most here: X or Y?" If the user still delegates, record it as delegated (§4).
5. **Contradictions**, between answers and against the sources and existing specs:
   - **Scope:** "keep it simple" vs. many advanced features.
   - **Risk:** "security is not a concern" vs. personal or financial data.
   - **Technology:** e.g. offline-first vs. real-time sync.
   - **Timeline vs. scope:** "needed this week" vs. a large feature set.
   - **Source conflict:** the answer disagrees with a registered source or an existing spec.

   For each contradiction: show both statements side by side, explain the conflict, then ask a
   targeted follow-up.
6. **Missing details** the next artifact needs.

Each finding becomes a follow-up question:

- It goes in the **same round section**, with the next free number.
- The heading names what it follows up: `### Q14. <question> (follow-up to Q3)`.
- It quotes the earlier answer.

Then collect and analyse again. Do not move on while anything is unresolved.

**Assumptions and unselected options**

- An option the user did not pick never becomes a requirement or an exclusion.
- `Not yet defined` is a real answer. It means the item is open: either ask a follow-up or carry it
  as an explicit assumption in the summary. Never fill it with invented detail.

## 6. Summary confirmation (mandatory, every round)

When the analysis finds nothing more to ask, append:

```markdown
### Summary confirmation — Main round

- <one bullet per decision, in plain words, citing [Q<n>] / [D<n>] / [desc]>
- ...

Assumptions I will make (not confirmed by an answer):
- <assumption> — or "None."

Does this all look correct before I continue?

- Looks correct
- Request changes

[Answer]:
```

- The summary bullets are **unordered** (never numbered).
- The two options have **no letters**.
- Ask the same question with AskUserQuestion (`Looks correct` / `Request changes`), then **end the turn**.
- Store the reply exactly: `[Answer]: Looks correct` or `[Answer]: Request changes`.
  Never add a letter, number or description.

If the reply is **Request changes**:

1. Append `### Requested changes — Main round #<k>`, with the question "What should change?" and a
   blank `[Answer]:`.
2. Ask that question and **end the turn**.
3. When the feedback arrives:
   - record it in that `[Answer]:`;
   - update the affected answers, or add follow-up questions;
   - rewrite the summary and reset its `[Answer]:` to blank;
   - confirm again.

**Any later edit** to an answer in a confirmed round resets that round's summary `[Answer]:` to
blank. The round must be confirmed again.

## 7. Gates

An artifact that depends on a round may be written only when both are true:

- that round has **no blank `[Answer]:`** (follow-ups and requested-changes entries included);
- its summary confirmation answer is **exactly `Looks correct`**.

Kit hooks and CI check this mechanically. Do not try to get around them by writing the file another way.

## 8. Ending a turn

Before you end a turn that waits for the user:

- Every question you asked must be in the file with a blank `[Answer]:`.
- This applies in every mode, chat included. A question that exists only in chat is invisible to
  the kit's hooks, and it gets lost.
