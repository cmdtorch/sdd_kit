<!-- sdd-kit: managed file. Do not edit; local changes are overwritten on kit update. -->
# UI inventory protocol

Applies to changes on all four kit schemas (`clarify`, `clarify-ai-qa`, `clarify-qa`, `lean`) whose
`sources/ui/` folder holds at least one screenshot: the change is then in **UI mode**. Screenshots exported from
the design tool are requirement sources. Before the first questions the AI lists what the screens offer, every
element gets a decision, and every element the change builds gets a scenario. A button on the mockup that no
requirement mentions is asked about before the proposal, not found by QA.

Without a screenshot nothing here applies except the mockups question (§1), and every workflow behaves as
without this protocol. When every
screenshot is deleted, UI mode is off again and `ui-inventory.md` is ignored.

**`ui-inventory.md` is the source of truth for the UI.** Decisions about an element made in chat count only
once they are in the inventory (and, on the clarify family, in an answer in `clarifications.md`).

---

## 1. Screenshots

- Put them in `openspec/changes/<change>/sources/ui/`. Accepted: `.png`, `.jpg`, `.jpeg`, `.webp`, in any
  letter case. Name them so they sort in screen order, e.g. `01-orders-list.png`, `02-orders-list-mobile.png`.
- Besides the screenshots only `sources/ui/screens.md` may sit there: optional notes from the developer on what
  each screenshot shows (flows, which variant is which). Read it, it is context; it is not a source tag.
- Any other file (SVG, PDF, a Figma or Word file) or a subfolder blocks the next artifact, even when the
  folder holds no screenshot. Ask the developer to export the mockup as PNG and to delete the original.
  Hidden system files (names starting with `.`, such as `.DS_Store`) are ignored.
- Screenshots stay in git with the change and move with it to the archive. They are never copied into
  `openspec/specs/`.
- **Variants of one screen** (desktop and mobile, different user roles) are separate screenshots but one
  screen of the inventory (§3).

### Asking for mockups

The developer may not know that screenshots can be given, so ask — unless `sources/ui/` already holds a
screenshot; then go straight to §2.

- **Clarify family:** the first Main round question is "Are there UI mockups for this change?", with the mark
  `(UI mockups)` at the end of its heading (always in English, like `(follow-up to Q<n>)`). Write and ask it
  alone, before the other Main round questions:

  ```markdown
  ### Q1. Are there UI mockups for this change? (UI mockups)
  Why this is asked: screenshots of the mockups become requirement sources, and every button on them gets a decision.
  - A. Yes, I will export them as screenshots
  - B. No, there will be no mockups
  - C. Not yet defined
  - X. Other (please specify)
  ```

  The proposal is blocked while the Main round has no question with this mark, `sources/ui/` holds no
  screenshot and there is no `ui-inventory.md`. A change whose proposal exists is not checked.
- **`lean`:** ask the same in chat before the proposal and record it under `## Clarifications` of the proposal.
- **"Yes":** create `openspec/changes/<change>/sources/ui/`, tell the developer to export every screen and state
  as PNG, JPG or WebP into it (no `.fig`, SVG or PDF; optional notes in `screens.md`; names that sort in screen
  order), and to run `/opsx:continue` when all are there. Then stop: write no other question and no artifact.
- **Continued with an empty folder:** ask once more — wait for the screenshots, or continue without mockups.
  Record the reply as a follow-up question in the same round.
- **"No"** (or "continue without mockups"): go on with the other questions; nothing else here applies.
  Screenshots added later are handled as late screenshots (§7).

## 2. Registering screenshots as `[U<n>]`

Each screenshot is a source with its own tag `U<n>`, numbered like `D<n>` (unique, never reused).

- **Clarify family:** one line per screenshot under `## Sources` of `clarifications.md`, with its path:

  ```markdown
  - [U1] Screenshot: orders list, desktop — `sources/ui/01-orders-list.png`
  - [U2] Screenshot: orders list, mobile — `sources/ui/02-orders-list-mobile.png`
  ```

- **`lean`:** the screenshots table of `ui-inventory.md` (§3) is the register; nothing goes elsewhere.
- The same tag names the same file in the register and in the inventory.
- **Citing.** Planning artifacts cite a screenshot as `[U<n>]` like any other tag (`grounding.md`), and one
  element on it as `` [U<n>] <element-name> `` with the element name from the inventory, e.g.
  `[U1] export-button`. The element must be listed for that screenshot (on a screen with variants: in the
  variant that screenshot shows). Spec text carries no tags, as always.
- **A screenshot shows, it does not decide.** It proves that an element is drawn, not that the change builds
  it or how it behaves. An `in scope` decision needs another source (§4).

## 3. The inventory

`openspec/changes/<change>/ui-inventory.md`:

```markdown
# UI Inventory

## Screenshots

| Tag | File | Fingerprint |
|---|---|---|
| U1 | 01-orders-list.png | 3f9a0c…(64 hex digits) |
| U2 | 02-orders-list-mobile.png | 8c1d47… |

## Screen: orders-list

Screenshots: U1 (desktop), U2 (mobile)

| Element | Type | Variants | Decision | Source | Scenarios |
|---|---|---|---|---|---|
| export-button | button | desktop, mobile | in scope | [Q3] | inventory/sale-export :: Successful export |
| bulk-delete | button | desktop | out of scope | [Q5] | — |
| empty-state | state | desktop, mobile | in scope | [D1] | inventory/sale-export :: Empty period |
| logout-button | button | desktop, mobile | existing | — | — |
```

The headings, the `Screenshots:` line and the column names stay exactly as shown and in English: the kit's
checks read them.

- **`## Screenshots`** — one row per file in `sources/ui/`: tag, file name, SHA-256 fingerprint.
- **`## Screen: <name>`** — one section per screen; the name is kebab-case and unique (`orders-list`,
  `export-modal`). Tasks and the design refer to it by this name.
- **`Screenshots:`** — the tags of the screen's screenshots. Every screenshot is on exactly one screen. A screen
  with several screenshots gives each a variant label in parentheses: `U1 (desktop), U2 (mobile)`.
- **Element table**, one row per element:
  - `Element` — a kebab-case name of at least two words (`export-button`, `period-field`, `empty-state`),
    unique within the screen. Citations and scenario links use it.
  - `Type` — `button`, `link`, `field`, `toggle`, `menu` or `state`.
  - `Variants` — on a screen with several screenshots, the variant labels (or tags) that show the element,
    separated by commas. Leave it `—` on a screen with one screenshot.
  - `Decision` — §4.
  - `Source` — the tags that back the decision (§4).
  - `Scenarios` — the spec scenarios that cover a built element, as `<capability-path> :: <Scenario name>`,
    several separated by `;`; `—` for none. Filled when the specs are written (§6).

**What is listed:** every interactive element (buttons, links, fields, toggles, menus) and every screen state
(empty, error, loading), the shown ones and the ones the screens need but do not show. **Not listed:** static
text, table columns and card fields, icons and decoration that does nothing. The spec reviewer checks this.

### Fingerprints

Open the screenshot and look at it **before** you write its row; then compute its fingerprint:

```bash
sha256sum openspec/changes/<change>/sources/ui/01-orders-list.png        # Linux, WSL
shasum -a 256 openspec/changes/<change>/sources/ui/01-orders-list.png    # macOS
```

The project settings allow both commands on files under `openspec/changes/` without a permission prompt. Write the 64 hex digits into the
`Fingerprint` cell. A mismatch means the file was replaced: the check names
the file and does not print the new value. Look at the image again, update its elements, then record the new
fingerprint (§7). Never copy a fingerprint without opening the image.

## 4. Decisions

Every element has exactly one decision. `Not yet defined` and an empty cell are not decisions: they block the
next artifact.

| Decision | Means | Source on the clarify family | Scenario |
|---|---|---|---|
| `in scope` | the change builds it | `[desc]`, a registered `[D<n>]` or an answered `[Q<n>]`; a `[U<n>]` alone is not enough | required |
| `mock` | a stub now, the real work later | an answered `[Q<n>]` of a confirmed round | required; it states what the user sees (§6) |
| `out of scope` | not part of the change | an answered `[Q<n>]` of a confirmed round | none |
| `decoration` | drawn, does nothing (e.g. a disabled button) | an answered `[Q<n>]` of a confirmed round | none |
| `existing` | already works and the change leaves it alone | none | none |

- An element that a source names as part of the change gets `in scope` without a question, citing that
  source. Every other element that is not `existing` is asked about (§5); record the decision with the
  answer's tag.
- Out of scope, decoration and mock are the developer's call, never yours.
- On `lean` the Source column stays `—`: you record the decisions yourself (§9).

## 5. The Main round (clarify family)

1. Register every screenshot (§2) and read `sources/ui/screens.md` if it exists.
2. Open every screenshot and write `ui-inventory.md` with all screens and elements, decisions still empty.
   **Write it before the questions:** the answers gate blocks adding questions to `clarifications.md` while
   screenshots exist and the inventory does not. Writing the inventory itself is never blocked.
3. Ask about the gaps between the UI and the requirements, in the Main round, one decision per question:
   - **an element no source names** — what does the "Delete" button do, and does it belong to this change?
     Offer the decisions as options (in scope with its behaviour, a stub for now, out of scope, only
     decoration);
   - **a requirement with no element or state on the screenshots** — the requirement says the accountant sees
     an import error; where and how is it shown?
   - **a missing screen state** — the orders list is shown with orders; what does it show when there are none,
     while loading, on an error?

   Elements a source names and `existing` elements need no question. Write the questions so they can be
   forwarded without the screenshots: describe the element and where it is ("the red Delete button at the top
   right of the orders list").
4. Record every decision in the inventory with the answer's tag as the answers come in.
5. The round summary lists every element with its decision, so the developer reviews the inventory together
   with the summary; there is no separate confirmation.

The proposal is blocked until every element has a decision backed as §4 says. Cite the screenshots where they
ground a statement, e.g. "Export button on the orders list [Q3][U1]".

## 6. Specs and test cases

- Every `in scope` and `mock` element names, in its `Scenarios` cell, one or more scenarios of the change's
  delta specs that cover it, with the exact capability path and scenario name. Fill the cells right after the
  spec files are written. Until every built element names existing scenarios, `design.md` (on `lean`,
  `verification-plan.md`) and the archive are blocked. If no scenario covers an element, add one to the specs.
- **Mock scenarios state what the user sees** and what does not happen: "**THEN** the message "Sharing is
  coming soon" is shown **AND** nothing is shared" — not just "nothing happens". The spec reviewer judges this.
- **Test-case schemas:** every test case under a scenario that a built element names carries the `e2e` label,
  alone or with others (`automated, e2e`).

## 7. Late, replaced and deleted screenshots

The check compares `sources/ui/` with the inventory before every artifact and before the archive.

- **Added** — open it, register it (§2), add its row with the fingerprint, put it on its screen (a new screen
  or a new variant of one) and list its new elements.
- **Replaced** (the fingerprint no longer matches) — open it again, update its elements, then write the new
  fingerprint.
- **Deleted** — remove its row and its registration; move its elements to another screenshot of the screen, or
  remove the screen and its elements.
- **All deleted** — UI mode is off; the inventory is ignored. Tell the developer.

Ask only about the new or changed elements, in the current question round (the round of the artifact you are
about to write; during implementation the `## Apply round`). On `lean` record their decisions yourself. Adding
those questions is never blocked; the next artifact and the archive are, until the inventory is up to date.

## 8. Design, tasks and implementation

- **Design** (schemas with a design): `design.md` has a section `## Screens` with a row for every screen that
  has an `in scope` or `mock` element. The `Screen` cell holds the screen name from the inventory; each row
  ends with the screen's screenshot tags, as grounding requires a tag on every table row:

  ```markdown
  ## Screens

  | Screen | Pages and components |
  |---|---|
  | orders-list | OrdersPage, ExportButton [U1][U2] |
  | export-modal | ExportDialog (new), OrdersPage [U3] |
  ```

  A missing row blocks the verification plan, the tasks and the archive.
- **Tasks:** a task that builds or changes a screen names it in backticks and links at least one screenshot of
  that screen by its path under `sources/ui/`:

  ```markdown
  - [ ] 3.2 Build the `export-modal` dialog per [the mockup](sources/ui/04-export-modal.png) and verify ...
  ```

  A link to another screen's screenshot does not count. The archive is blocked while a task that names a
  screen in backticks links none of its screenshots, so do not put a screen name in backticks in a task that
  does not build it.
- **Implementation:** before writing the code of a screen, open its screenshots and read its section of
  `ui-inventory.md`. Build what the decisions say: an `out of scope` or `decoration` element is not wired up,
  a `mock` element behaves as its scenario says.

## 9. `lean`

`lean` has no question rounds; the rest of this protocol applies unchanged.

- Without screenshots, ask about mockups in chat before the proposal (§1).
- Write `ui-inventory.md` before the proposal; its screenshots table is the register (§2).
- Record a decision for every element yourself, without questions and without citations (Source `—`). If a
  decision would mean guessing user-visible behaviour or scope, stop and recommend `clarify`.
- `proposal.md` lists every inventory element by its name with its decision (a list or a table under What
  Changes). Spec files are blocked while an element is missing from it.
- Scenario coverage (§6) is required before `verification-plan.md`; screen names and screenshot links in tasks
  (§8) apply too; there is no design and no `## Screens` table.

## 10. Checks and gates

`node openspec/tooling/checks/check-ui.mjs --change <change> [--stage design|plan|tasks|archive]`

| Before | What must hold |
|---|---|
| the Main round questions | `ui-inventory.md` exists |
| `proposal.md`, a spec file, `test-cases.md` (`lean`: the proposal and the specs) | only accepted files in `sources/ui/`; every screenshot registered and in the inventory with a matching fingerprint, no deleted one listed; screens, variants and decisions well formed; decisions backed (§4); `[U<n>] <element>` citations name an element on that screenshot; `lean`: the proposal names every element |
| `design.md` (`lean`: `verification-plan.md`) | the above, and every `in scope` / `mock` element names existing scenarios |
| `verification-plan.md`, `tasks.md` | the above, and a `## Screens` row for every screen with a built element |
| the archive | all of the above, and every task naming a screen in backticks links its screenshot |

The answers gate and the archive gate run these checks; a blocked write names what to fix. Errors in the file
being written do not block that write, so a broken artifact can always be fixed. Do not try to get around
the gates.

Right after a write, without blocking it, the artifact feedback hook shows you the errors of the check:

- after `ui-inventory.md` — the checks before the proposal (formats, registration, fingerprints, screens,
  variants, decisions). On the clarify family, decisions and their sources may wait for the answers of the
  current round; fix the rest now.
- after `tasks.md` — the errors in `tasks.md` itself, including tasks that name a screen in backticks and
  link none of its screenshots. Fix them now instead of at the archive.
