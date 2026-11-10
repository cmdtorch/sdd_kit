# Proposal

## Why

The kit is meant to drive frontend work as well as backend work, but UI mockups never reach the question rounds: a button that exists in the mockup and not in the written requirements is found only during implementation or by QA [desc]. Figma's own tools are paid, so screenshots exported from the design tool are the input [desc][D1].

## What Changes

- Screenshots placed in the change become requirement sources, each with its own tag `U<n>`; PNG, JPG and WebP are accepted, and they are kept in git with the change and archived with it [Q1][Q3][Q4][Q9].
- The UI mode switches on by itself when a change has screenshots; without screenshots every workflow behaves as today [Q1].
- The AI asks whether the change has mockups as the first Main round question (on `lean`: in chat before the proposal, the answer recorded in the proposal); "yes" without screenshots → it creates `sources/ui/`, explains what to put there and stops until `/opsx:continue`, asking once more if the folder is still empty; screenshots already in the folder → no question [Q31][Q32][Q33].
- The proposal cannot be written while the Main round has no question marked `(UI mockups)` and `sources/ui/` holds no screenshot; changes past the proposal and `lean` are not checked [Q34].
- The mode works in all four kit workflows: `clarify`, `clarify-ai-qa`, `clarify-qa` and `lean` [Q2].
- Before the Main round questions, the AI writes a UI inventory: the interactive elements (buttons, links, fields, toggles, menus) and screen states (empty, error, loading) of every screen; the developer reviews it together with the round summary [Q5][Q6].
- Variants of one screen (desktop, mobile, roles) are separate screenshots but one screen in the inventory, with each element marked by the variants that show it [Q10].
- Every inventory element gets one of five decisions: in scope, mock (a stub now, the real work later), out of scope, decoration, or existing and unchanged; out of scope, decoration and mock need a developer's answer, in scope needs a source other than the screenshot [Q7][Q16][Q17][Q18][Q23].
- Two strict gates: no artifact after the questions until every inventory element has a decision, and the specs cannot be completed until every in-scope or mock element is covered by a scenario [Q7][Q23].
- A file in an unsupported format blocks the next artifact until it is replaced by a PNG, JPG or WebP export [Q20].
- Screenshots added, replaced or deleted later block the next artifact and the archive until the inventory is updated; the AI asks only about the new elements, in the current round; when every screenshot is deleted the UI mode switches off [Q8][Q19][Q21][Q24][Q25].
- In `lean`, which has no question rounds, the AI writes the inventory with a decision for each element and lists the decisions in the proposal, without questions; the scenario coverage gate is the same [Q14].
- In the test-case workflows, a test case of a scenario that covers an inventory element must carry the `e2e` label [Q11].
- Screenshots are used during implementation: the design maps each inventory screen to the pages and components it changes, UI tasks link the screenshots of their screen, and the AI opens the screenshots and the inventory before building a screen; the first two are checked automatically [Q15][Q22].
- Out of scope: comparing the built screen with the screenshot (the future E2E stage), reading mockups from Figma (API, plugin, MCP), and design tokens [Q12].

## Capabilities

### New Capabilities
- `ui-sources/screenshots`: screenshots as requirement sources — the question about mockups, where they go, accepted formats, `U<n>` tags, storage, and screenshots that arrive late [Q1][Q3][Q4][Q8][Q9][Q31]
- `ui-sources/inventory`: the UI inventory — what it lists, who writes it, screen variants, the decision for every element and the Main round gate, and the `lean` variant [Q5][Q6][Q7][Q10][Q14]
- `ui-sources/coverage`: every in-scope element covered by a spec scenario before the specs are complete, and the `e2e` label for test cases of such scenarios [Q7][Q11]
- `ui-sources/implementation`: the screen-to-component table in the design, screenshot links in UI tasks, and the rule to open screenshots before building a screen [Q15]

### Modified Capabilities

None.

## Impact

| Area | Change |
|---|---|
| Kit schemas `clarify`, `clarify-ai-qa`, `clarify-qa`, `lean` | instructions for the inventory, the gates and the implementation rules [Q2][Q7][Q14][Q15] |
| Kit protocols | questions, grounding and testing rules for screenshots and the inventory; a protocol for the inventory [Q4][Q5][Q11] |
| Kit checks and hooks | inventory decisions before the proposal, scenario coverage before the design, late screenshots, `e2e` labels [Q7][Q8][Q11] |
| Kit docs and installer | `docs/how-it-works.md`, the workflow guide, the decision log [D1] |
| Success measure | a pilot on a real frontend task where QA finds no forgotten button [Q13] |

## Assumptions & Open Questions

- Screenshots live in `sources/ui/` of the change, the inventory in the change file `ui-inventory.md`, and optional notes on the screenshots in `sources/ui/screens.md` [assumption]
- The link between an inventory element and its scenario is written in the inventory (a column with the scenario name), not in the spec, because specs carry no source tags [assumption]
- "Decoration only" is allowed for an interactive element too (for example a disabled button with no behaviour); like "out of scope" it needs no scenario [assumption]
- The change edits the four schemas in `kit/`; in this repository the change itself runs under the installed copy 0.3.0 [assumption]
