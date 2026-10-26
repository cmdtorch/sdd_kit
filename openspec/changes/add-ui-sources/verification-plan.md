# Verification Plan

## Scenario coverage

| Capability | Requirement | Scenario | Level | Critical | Test data / setup |
|---|---|---|---|---|---|
| ui-sources/screenshots | Screenshots switch the UI mode on | Change without screenshots needs no inventory | integration | no | temp project from a fixture, generated 1×1 PNGs in sources/ui/, hook run as a process |
| ui-sources/screenshots | Screenshots switch the UI mode on | Notes file alone does not switch the mode on | integration | no | temp project from a fixture, generated 1×1 PNGs in sources/ui/, hook run as a process |
| ui-sources/screenshots | Screenshots switch the UI mode on | Deleting every screenshot switches the mode off | integration | no | temp project from a fixture, generated 1×1 PNGs in sources/ui/, hook run as a process |
| ui-sources/screenshots | Screenshots switch the UI mode on | One screenshot switches the mode on | integration | no | temp project from a fixture, generated 1×1 PNGs in sources/ui/, hook run as a process |
| ui-sources/screenshots | UI check errors block the next artifact and the archive | Out of scope without an answer blocks the proposal | integration | yes | temp project from a fixture, generated 1×1 PNGs in sources/ui/, hook run as a process |
| ui-sources/screenshots | UI check errors block the next artifact and the archive | Inventory and questions are written while elements have no decision | integration | no | temp project from a fixture, generated 1×1 PNGs in sources/ui/, hook run as a process |
| ui-sources/screenshots | UI check errors block the next artifact and the archive | Questions about a late screenshot are not blocked | integration | no | temp project from a fixture, generated 1×1 PNGs in sources/ui/, hook run as a process |
| ui-sources/screenshots | UI check errors block the next artifact and the archive | Inventory errors are shown after the inventory is written | integration | no | temp project from a fixture, generated 1×1 PNGs in sources/ui/, hook run as a process (`artifact-feedback`) |
| ui-sources/screenshots | Each screenshot is a registered source | Unregistered screenshot is reported | unit | no | inventory text and generated 1×1 PNGs in a temp change |
| ui-sources/screenshots | Each screenshot is a registered source | Lean screenshots are registered in the inventory | unit | no | inventory text and generated 1×1 PNGs in a temp change |
| ui-sources/screenshots | Each screenshot is a registered source | Citation of an element not on that screenshot is reported | unit | no | inventory text and generated 1×1 PNGs in a temp change |
| ui-sources/screenshots | Each screenshot is a registered source | Unknown screenshot tag is reported | unit | no | inventory text and generated 1×1 PNGs in a temp change |
| ui-sources/screenshots | Only PNG, JPG and WebP are accepted | SVG file blocks the next artifact | integration | yes | temp project from a fixture, generated 1×1 PNGs in sources/ui/, hook run as a process |
| ui-sources/screenshots | Only PNG, JPG and WebP are accepted | SVG-only folder blocks the next artifact | integration | yes | temp project from a fixture, generated 1×1 PNGs in sources/ui/, hook run as a process |
| ui-sources/screenshots | Only PNG, JPG and WebP are accepted | Upper-case extensions are accepted | unit | no | inventory text and generated 1×1 PNGs in a temp change |
| ui-sources/screenshots | Only PNG, JPG and WebP are accepted | Hidden system files are ignored | unit | no | inventory text and generated 1×1 PNGs in a temp change, plus a `.DS_Store` file |
| ui-sources/screenshots | Screenshots stay with the change | Screenshots are archived with the change | integration | no | temp project from a fixture, generated 1×1 PNGs in sources/ui/, hook run as a process |
| ui-sources/screenshots | Late and replaced screenshots are caught | Screenshot added after the Main round blocks the specs | integration | yes | temp project from a fixture, generated 1×1 PNGs in sources/ui/, hook run as a process |
| ui-sources/screenshots | Late and replaced screenshots are caught | Replaced screenshot is caught by its fingerprint | unit | no | inventory text and generated 1×1 PNGs in a temp change |
| ui-sources/screenshots | Late and replaced screenshots are caught | Screenshot added during implementation blocks the archive | integration | yes | temp project from a fixture, generated 1×1 PNGs in sources/ui/, hook run as a process |
| ui-sources/screenshots | Deleted screenshots are caught | Deleted screenshot blocks the next artifact | integration | yes | temp project from a fixture, generated 1×1 PNGs in sources/ui/, hook run as a process |
| ui-sources/screenshots | Deleted screenshots are caught | Screenshot deleted during implementation blocks the archive | integration | yes | temp project from a fixture, generated 1×1 PNGs in sources/ui/, hook run as a process |
| ui-sources/screenshots | Deleted screenshots are caught | Elements moved to another screenshot pass | unit | no | inventory text and generated 1×1 PNGs in a temp change |
| ui-sources/inventory | The AI writes the inventory before the first questions | Main round questions are blocked without an inventory | integration | yes | temp project from a fixture, generated 1×1 PNGs in sources/ui/, hook run as a process |
| ui-sources/inventory | The AI writes the inventory before the first questions | Lean proposal is blocked without an inventory | integration | yes | temp project from a fixture, generated 1×1 PNGs in sources/ui/, hook run as a process |
| ui-sources/inventory | The AI writes the inventory before the first questions | Proposal is blocked without an inventory | integration | yes | temp project from a fixture, generated 1×1 PNGs in sources/ui/, hook run as a process |
| ui-sources/inventory | Variants of a screen are one screen | Desktop and mobile screenshots form one screen | unit | no | inventory text and generated 1×1 PNGs in a temp change |
| ui-sources/inventory | Variants of a screen are one screen | Element without a variant is reported | unit | no | inventory text and generated 1×1 PNGs in a temp change |
| ui-sources/inventory | Every element has a decision | Element without a decision blocks the proposal | integration | yes | temp project from a fixture, generated 1×1 PNGs in sources/ui/, hook run as a process |
| ui-sources/inventory | Every element has a decision | Not yet defined blocks the proposal | integration | yes | temp project from a fixture, generated 1×1 PNGs in sources/ui/, hook run as a process |
| ui-sources/inventory | Every element has a decision | Late element without a decision blocks the design | integration | yes | temp project from a fixture, generated 1×1 PNGs in sources/ui/, hook run as a process |
| ui-sources/inventory | Every element has a decision | Element without a decision blocks the archive | integration | yes | temp project from a fixture, generated 1×1 PNGs in sources/ui/, hook run as a process |
| ui-sources/inventory | Decisions are backed by a source | Out of scope without an answer is reported | unit | no | inventory text and generated 1×1 PNGs in a temp change |
| ui-sources/inventory | Decisions are backed by a source | Decoration citing an unanswered question is reported | unit | no | inventory text and generated 1×1 PNGs in a temp change |
| ui-sources/inventory | Decisions are backed by a source | Decision citing a question that does not exist is reported | unit | no | inventory text and generated 1×1 PNGs in a temp change |
| ui-sources/inventory | Decisions are backed by a source | Mock citing an unconfirmed round is reported | unit | no | inventory text and generated 1×1 PNGs in a temp change |
| ui-sources/inventory | Decisions are backed by a source | In scope backed only by a screenshot is reported | unit | no | inventory text and generated 1×1 PNGs in a temp change |
| ui-sources/inventory | Decisions are backed by a source | Mock backed by an answer passes | unit | no | inventory text and generated 1×1 PNGs in a temp change |
| ui-sources/inventory | Decisions are backed by a source | Existing element needs no citation | unit | no | inventory text and generated 1×1 PNGs in a temp change |
| ui-sources/inventory | The Main round asks about the gaps between the UI and the requirements | Button not in the requirements gets a question | manual | no | pilot: screenshot with a button no source names |
| ui-sources/inventory | The Main round asks about the gaps between the UI and the requirements | Requirement without a UI element gets a question | manual | no | pilot: requirement whose error state has no screenshot |
| ui-sources/inventory | The Main round asks about the gaps between the UI and the requirements | Missing screen state gets a question | manual | no | pilot: list screenshot without an empty-state screenshot |
| ui-sources/inventory | Lean changes decide without questions | Lean decisions need no citation | unit | no | inventory text and generated 1×1 PNGs in a temp change |
| ui-sources/inventory | Lean changes decide without questions | Lean proposal missing a decision blocks the specs | integration | yes | temp project from a fixture, generated 1×1 PNGs in sources/ui/, hook run as a process |
| ui-sources/coverage | Every built element has a scenario | In-scope element without a scenario blocks the design | integration | yes | temp project from a fixture, generated 1×1 PNGs in sources/ui/, hook run as a process |
| ui-sources/coverage | Every built element has a scenario | Lean element without a scenario blocks the verification plan | integration | yes | temp project from a fixture, generated 1×1 PNGs in sources/ui/, hook run as a process |
| ui-sources/coverage | Every built element has a scenario | Element names a scenario that does not exist | unit | no | inventory text and generated 1×1 PNGs in a temp change |
| ui-sources/coverage | Every built element has a scenario | Mock element without a scenario blocks the design | integration | yes | temp project from a fixture, generated 1×1 PNGs in sources/ui/, hook run as a process |
| ui-sources/coverage | Every built element has a scenario | Elements that are not built need no scenario | unit | no | inventory text and generated 1×1 PNGs in a temp change |
| ui-sources/coverage | Mock elements describe the mock behaviour | Mock scenario without a visible outcome is a review finding | manual | no | pilot: a mock element whose scenario says only "nothing happens" |
| ui-sources/coverage | UI test cases carry the e2e label | UI case without e2e is reported | unit | no | inventory text and generated 1×1 PNGs in a temp change |
| ui-sources/coverage | UI test cases carry the e2e label | UI case with automated and e2e passes | unit | no | inventory text and generated 1×1 PNGs in a temp change |
| ui-sources/implementation | The design maps screens to pages and components | Screen without a design row blocks the tasks | integration | yes | temp project from a fixture, generated 1×1 PNGs in sources/ui/, hook run as a process |
| ui-sources/implementation | The design maps screens to pages and components | Screen without a design row blocks the archive | integration | yes | temp project from a fixture, generated 1×1 PNGs in sources/ui/, hook run as a process |
| ui-sources/implementation | The design maps screens to pages and components | Screen with only a mock element needs a design row | unit | no | inventory text and generated 1×1 PNGs in a temp change |
| ui-sources/implementation | The design maps screens to pages and components | Screen with nothing to build needs no row | unit | no | inventory text and generated 1×1 PNGs in a temp change |
| ui-sources/implementation | UI tasks link their screenshots | UI task without a screenshot is reported | unit | no | inventory text and generated 1×1 PNGs in a temp change |
| ui-sources/implementation | UI tasks link their screenshots | UI task without a screenshot blocks the archive | integration | yes | temp project from a fixture, generated 1×1 PNGs in sources/ui/, hook run as a process |
| ui-sources/implementation | UI tasks link their screenshots | Missing screenshot link is shown after the tasks are written | integration | no | temp project from a fixture, generated 1×1 PNGs in sources/ui/, hook run as a process (`artifact-feedback`) |
| ui-sources/implementation | UI tasks link their screenshots | UI task linking another screen's screenshot is reported | unit | no | inventory text and generated 1×1 PNGs in a temp change |
| ui-sources/implementation | UI tasks link their screenshots | UI task with its screenshot passes | unit | no | inventory text and generated 1×1 PNGs in a temp change |
| ui-sources/implementation | The AI looks at the screen before building it | Screenshots are opened before the screen is built | manual | no | pilot: a UI task during apply |

## Exclusions

| Capability | Scenario | Reason |
|---|---|---|
| — | — | None. |

## Requirement trace

| Capability | Requirement | Sources |
|---|---|---|
| ui-sources/screenshots | Screenshots switch the UI mode on | [Q1][Q2][Q25] |
| ui-sources/screenshots | UI check errors block the next artifact and the archive | [Q7][Q14][Q21] |
| ui-sources/screenshots | Each screenshot is a registered source | [Q4][Q14] |
| ui-sources/screenshots | Only PNG, JPG and WebP are accepted | [Q3][Q20] |
| ui-sources/screenshots | Screenshots stay with the change | [Q9] |
| ui-sources/screenshots | Late and replaced screenshots are caught | [Q8][Q19][Q21] |
| ui-sources/screenshots | Deleted screenshots are caught | [Q24] |
| ui-sources/inventory | The AI writes the inventory before the first questions | [Q5][Q6] |
| ui-sources/inventory | Variants of a screen are one screen | [Q10] |
| ui-sources/inventory | Every element has a decision | [Q7][Q17][Q18][Q23] |
| ui-sources/inventory | Decisions are backed by a source | [Q16][Q17][Q18] |
| ui-sources/inventory | The Main round asks about the gaps between the UI and the requirements | [Q5][desc] |
| ui-sources/inventory | Lean changes decide without questions | [Q14] |
| ui-sources/coverage | Every built element has a scenario | [Q7][Q23] |
| ui-sources/coverage | Mock elements describe the mock behaviour | [Q23] |
| ui-sources/coverage | UI test cases carry the e2e label | [Q11] |
| ui-sources/implementation | The design maps screens to pages and components | [Q15][Q22] |
| ui-sources/implementation | UI tasks link their screenshots | [Q15][Q22] |
| ui-sources/implementation | The AI looks at the screen before building it | [Q15] |

## Environment

- Node.js and the pinned OpenSpec CLI, as for the rest of the kit suite; no network.
- Test images are generated inside the tests (tiny one-colour PNG, JPG and WebP files written as bytes); the repository holds no image files.
- Integration tests copy a fixture project into a temp directory, add screenshots and an inventory there, and run `answers-gate`, `archive-gate` and `artifact-feedback` as processes, as `tests/hooks.test.mjs` does.
- Manual rows are checked in the pilot on a real frontend task (the last task of this change), with a tester acting as QA.
