# Verification Plan

## Scenario coverage

| Capability | Requirement | Scenario | Level | Critical | Test data / setup | Manual reason |
|---|---|---|---|---|---|---|
| questions/depth | Three depth levels | Level not chosen | unit | no | text of `planning.md` and the schema instructions | — |
| questions/depth | Three depth levels | Missing level line | unit | no | prepared change files or hook message | — |
| questions/depth | Three depth levels | Test-case schema keeps its depth names | unit | no | prepared change files or hook message | — |
| questions/depth | Three depth levels | Unknown level | unit | no | prepared change files or hook message | — |
| questions/depth | Three depth levels | Older change keeps its depth names | unit | no | prepared change files or hook message | — |
| questions/depth | The level sets what the agent investigates | High level finds an affected module | unit | no | text of `planning.md` and the schema instructions | — |
| questions/depth | The level sets what the agent investigates | Low level asks from the sources only | unit | no | text of `planning.md` and the schema instructions | — |
| questions/depth | The level sets what the agent investigates | Medium level reads the touched area | unit | no | text of `planning.md` and the schema instructions | — |
| questions/depth | The level sets what the agent settles itself | Low level settles what the user does not see | unit | no | text of `planning.md` and the schema instructions | — |
| questions/depth | The level sets what the agent settles itself | Low level asks about visible behaviour | unit | no | text of `planning.md` and the schema instructions | — |
| questions/depth | The level sets what the agent settles itself | Medium level settles a visible detail | unit | no | text of `planning.md` and the schema instructions | — |
| questions/depth | The level sets what the agent settles itself | Medium level asks about permissions | unit | no | text of `planning.md` and the schema instructions | — |
| questions/depth | The level sets what the agent settles itself | Medium level asks about data the user does not see | unit | no | text of `planning.md` and the schema instructions | — |
| questions/depth | The level sets what the agent settles itself | High level asks about the storage period | unit | no | text of `planning.md` and the schema instructions | — |
| questions/depth | The agent's own decisions are recorded as assumptions | Decision made while writing the specs | unit | no | text of `planning.md` and the schema instructions | — |
| questions/depth | Every question names what its answer changes | Reason names the dependent rule | unit | no | text of `planning.md` and the schema instructions | — |
| questions/depth | Every question names what its answer changes | High level names the finding | unit | no | text of `planning.md` and the schema instructions | — |
| questions/depth | On the high level every answer is checked for its consequences | Consequence of a narrowed permission | unit | no | text of `planning.md` and the schema instructions | — |
| questions/depth | On the high level every answer is checked for its consequences | Consequence already decided | unit | no | text of `planning.md` and the schema instructions | — |
| questions/depth | A changed level applies to later questions only | Level raised after the Main round | unit | no | text of `planning.md` and the schema instructions | — |
| questions/depth | A changed level applies to later questions only | Level lowered during a round | unit | no | text of `planning.md` and the schema instructions | — |
| questions/recommendations | A question carries a recommended option when there is a basis | Recommendation from the code | unit | no | text of `planning.md` and the schema instructions | — |
| questions/recommendations | A question carries a recommended option when there is a basis | No basis, no recommendation | unit | no | text of `planning.md` and the schema instructions | — |
| questions/recommendations | A question carries a recommended option when there is a basis | Several recommended options | unit | no | text of `planning.md` and the schema instructions | — |
| questions/recommendations | A question carries a recommended option when there is a basis | Older change has no recommendations | unit | no | text of `planning.md` and the schema instructions | — |
| questions/recommendations | A question carries a recommended option when there is a basis | Test-case schema has no recommendations | unit | no | text of `planning.md` and the schema instructions | — |
| questions/recommendations | The recommendation is recorded with the question | Recommendation in the file | unit | no | prepared change files or hook message | — |
| questions/recommendations | The recommendation is recorded with the question | Recommendation names an unknown option | unit | no | prepared change files or hook message | — |
| questions/recommendations | A recommendation is never an answer | Recommended question stays unanswered | integration | yes | temporary project with a prepared change; the hook run as a process with prepared input | — |
| questions/recommendations | No answer accepts all recommendations at once | Batch of questions in the chat | unit | no | text of `planning.md` and the schema instructions | — |
| questions/recommendations | No answer accepts all recommendations at once | Developer asks to accept everything | unit | no | text of `planning.md` and the schema instructions | — |
| questions/rounds | Two question rounds before the code | Design is written without a round of its own | unit | no | text of `planning.md` and the schema instructions | — |
| questions/rounds | Two question rounds before the code | Design fork is asked in the Technical round | unit | no | text of `planning.md` and the schema instructions | — |
| questions/rounds | Two question rounds before the code | Requirement gap during the implementation | unit | no | text of `planning.md` and the schema instructions | — |
| questions/rounds | The agent decides what the Verification round asked | Verification plan without questions | unit | no | text of `planning.md` and the schema instructions | — |
| questions/rounds | A round is closed when every question is answered | Proposal after the last answer | integration | no | temporary project with a prepared change; the hook run as a process with prepared input | — |
| questions/rounds | A round is closed when every question is answered | Blank answer still blocks | integration | yes | temporary project with a prepared change; the hook run as a process with prepared input | — |
| questions/rounds | A round is closed when every question is answered | Round not started blocks | integration | no | temporary project with a prepared change; the hook run as a process with prepared input | — |
| questions/rounds | A round is closed when every question is answered | Follow-up reopens the round | integration | no | temporary project with a prepared change; the hook run as a process with prepared input | — |
| questions/rounds | A round may have no question | Technical round without questions | integration | no | temporary project with a prepared change; the hook run as a process with prepared input | — |
| questions/rounds | A closed round counts as a confirmed round | Answer of a closed round is a valid source | unit | no | prepared change files or hook message | — |
| questions/rounds | A closed round counts as a confirmed round | Answer of an open round is not a source | unit | no | prepared change files or hook message | — |
| questions/rounds | The answer mode is asked once per change | Second round does not ask again | unit | no | text of `planning.md` and the schema instructions | — |
| questions/rounds | The answer mode is asked once per change | New chat does not ask again | unit | no | text of `planning.md` and the schema instructions | — |
| questions/rounds | The answer mode is asked once per change | Developer switches the mode | unit | no | text of `planning.md` and the schema instructions | — |
| questions/rounds | A changed answer of a closed round stops planning | Answer changed after the proposal | integration | yes | temporary project with a prepared change; the hook run as a process with prepared input | — |
| questions/rounds | A changed answer of a closed round stops planning | Technical round answer changed after the tasks | integration | no | temporary project with a prepared change; the hook run as a process with prepared input | — |
| questions/rounds | A changed answer of a closed round stops planning | Earlier answer restored | integration | no | temporary project with a prepared change; the hook run as a process with prepared input | — |
| questions/rounds | A changed answer of a closed round stops planning | Developer asks to update | unit | no | text of `planning.md` and the schema instructions | — |
| questions/rounds | A changed answer of a closed round stops planning | Added spaces are not a change | integration | no | temporary project with a prepared change; the hook run as a process with prepared input | — |
| questions/rounds | A changed answer of a closed round stops planning | Answer changed before any artifact | integration | no | temporary project with a prepared change; the hook run as a process with prepared input | — |
| questions/rounds | A changed answer also stops the implementation | Answer changed before apply | integration | yes | temporary project with a prepared change; the hook run as a process with prepared input | — |
| questions/rounds | A changed answer also stops the implementation | Answer changed during apply | unit | no | text of `planning.md` and the schema instructions | — |
| questions/rounds | Earlier changes and test-case schemas keep their rounds | Older change still needs the confirmation | integration | yes | temporary project with a prepared change; the hook run as a process with prepared input | — |
| questions/rounds | Earlier changes and test-case schemas keep their rounds | Test-case schema still needs the confirmation | integration | yes | temporary project with a prepared change; the hook run as a process with prepared input | — |
| ui-sources/inventory | Every element has a decision | Element without a decision blocks the proposal | unit | no | prepared change files or hook message | — |
| ui-sources/inventory | Every element has a decision | Not yet defined blocks the proposal | unit | no | prepared change files or hook message | — |
| ui-sources/inventory | Every element has a decision | Late element without a decision blocks the design | unit | no | prepared change files or hook message | — |
| ui-sources/inventory | Every element has a decision | Element without a decision blocks the archive | unit | no | prepared change files or hook message | — |
| ui-sources/inventory | Every element has a decision | Decisions are shown before the proposal on a new change | unit | no | text of `planning.md` and the schema instructions | — |
| ui-sources/inventory | On new changes a closed round backs a decision | Mock citing a closed round is accepted | unit | no | prepared change files or hook message | — |
| ui-sources/inventory | On new changes a closed round backs a decision | Mock citing an open round is reported | unit | no | prepared change files or hook message | — |
| ui-sources/screenshots | The AI asks whether the change has mockups | Yes without screenshots stops until continue | unit | no | text of `planning.md` and the schema instructions | — |
| ui-sources/screenshots | The AI asks whether the change has mockups | Empty folder on continue is asked again | unit | no | text of `planning.md` and the schema instructions | — |
| ui-sources/screenshots | The AI asks whether the change has mockups | Lean asks about mockups before the proposal | unit | no | text of `planning.md` and the schema instructions | — |
| ui-sources/screenshots | The AI asks whether the change has mockups | Yes on a new change waits for the developer's word | unit | no | text of `planning.md` and the schema instructions | — |
| ui-sources/screenshots | The AI asks whether the change has mockups | Screenshots in place on a new change | unit | no | text of `planning.md` and the schema instructions | — |
| ui-sources/screenshots | The AI asks whether the change has mockups | Done with an empty folder on a new change | unit | no | text of `planning.md` and the schema instructions | — |
| workflow/planning-flow | Planning goes on without a command | Next artifact is written without a command | integration | yes | temporary project with a prepared change; the hook run as a process with prepared input | — |
| workflow/planning-flow | Planning goes on without a command | Next artifact is written without a command | manual | yes | a new `clarify` change in a live Claude Code session | cannot be automated: `npm test` cannot run a live Claude Code session, and only there the hook holds the agent's turn |
| workflow/planning-flow | Planning goes on without a command | Technical round is prepared next | integration | no | temporary project with a prepared change; the hook run as a process with prepared input | — |
| workflow/planning-flow | Planning goes on without a command | Lean change goes on | integration | no | temporary project with a prepared change; the hook run as a process with prepared input | — |
| workflow/planning-flow | Planning goes on without a command | Change not touched in this session is left alone | integration | no | temporary project with a prepared change; the hook run as a process with prepared input | — |
| workflow/planning-flow | Planning goes on without a command | Change on a test-case schema is not continued | integration | yes | temporary project with a prepared change; the hook run as a process with prepared input | — |
| workflow/planning-flow | Planning goes on without a command | Older change is not continued | integration | yes | temporary project with a prepared change; the hook run as a process with prepared input | — |
| workflow/planning-flow | Planning goes on without a command | Unstamped change is not continued | integration | no | temporary project with a prepared change; the hook run as a process with prepared input | — |
| workflow/planning-flow | The agent stops where a human is needed | Unanswered question ends the turn | integration | yes | temporary project with a prepared change; the hook run as a process with prepared input | — |
| workflow/planning-flow | The agent stops where a human is needed | Question asked in the chat ends the turn | integration | no | temporary project with a prepared change; the hook run as a process with prepared input | — |
| workflow/planning-flow | The agent stops where a human is needed | Waiting for screenshots ends the turn | integration | no | temporary project with a prepared change; the hook run as a process with prepared input | — |
| workflow/planning-flow | The agent stops where a human is needed | Lean change waits for screenshots | integration | no | temporary project with a prepared change; the hook run as a process with prepared input | — |
| workflow/planning-flow | The agent stops where a human is needed | Changed answer ends the turn | integration | no | temporary project with a prepared change; the hook run as a process with prepared input | — |
| workflow/planning-flow | The developer pauses planning in plain words | Developer pauses | integration | no | temporary project with a prepared change; the hook run as a process with prepared input | — |
| workflow/planning-flow | The developer pauses planning in plain words | Question during a pause | unit | no | text of `planning.md` and the schema instructions | — |
| workflow/planning-flow | The developer pauses planning in plain words | Developer resumes | integration | no | temporary project with a prepared change; the hook run as a process with prepared input | — |
| workflow/planning-flow | A failing artifact check stops after two fix attempts | Check passes after a fix | unit | no | text of `planning.md` and the schema instructions | — |
| workflow/planning-flow | A failing artifact check stops after two fix attempts | Check still fails after two attempts | integration | no | temporary project with a prepared change; the hook run as a process with prepared input | — |
| workflow/planning-flow | A failing artifact check stops after two fix attempts | Write blocked by a cause only the developer can remove | unit | no | text of `planning.md` and the schema instructions | — |
| workflow/planning-flow | A failing artifact check stops after two fix attempts | Write blocked by an open question is a wait | integration | no | temporary project with a prepared change; the hook run as a process with prepared input | — |
| workflow/planning-flow | Planning starts and resumes without `/opsx:continue` | First artifact follows the creation | unit | no | text of `planning.md` and the schema instructions | — |
| workflow/planning-flow | Planning starts and resumes without `/opsx:continue` | Developer still runs the command | unit | no | text of `planning.md` and the schema instructions | — |
| workflow/planning-flow | The agent settles spec review findings itself | Finding fixed without the developer | unit | no | text of `planning.md` and the schema instructions | — |
| workflow/planning-flow | The agent settles spec review findings itself | Finding that needs a requirements decision | unit | no | text of `planning.md` and the schema instructions | — |
| workflow/planning-flow | The agent settles spec review findings itself | Older change waits for the developer | unit | no | text of `planning.md` and the schema instructions | — |
| workflow/planning-flow | At most two spec review runs | Second run after fixes | integration | no | temporary project with a prepared change; the hook run as a process with prepared input | — |
| workflow/planning-flow | At most two spec review runs | No third run | integration | no | temporary project with a prepared change; the hook run as a process with prepared input | — |
| workflow/planning-flow | At most two spec review runs | Finding the agent cannot fix | unit | no | text of `planning.md` and the schema instructions | — |
| workflow/planning-flow | At most two spec review runs | Second run finds a requirements gap | unit | no | text of `planning.md` and the schema instructions | — |
| workflow/planning-flow | At most two spec review runs | First review without findings | integration | no | temporary project with a prepared change; the hook run as a process with prepared input | — |
| workflow/planning-flow | A digest after the specs | Digest is printed and planning goes on | unit | no | text of `planning.md` and the schema instructions | — |
| workflow/planning-flow | A digest after the specs | Digest without own decisions | unit | no | text of `planning.md` and the schema instructions | — |
| workflow/planning-flow | A digest that cannot hold every decision points to the full list | Twenty own decisions | unit | no | text of `planning.md` and the schema instructions | — |
| workflow/planning-flow | Updated specs are reviewed once and the digest is printed again | Specs rewritten after a changed answer | integration | no | temporary project with a prepared change; the hook run as a process with prepared input | — |
| workflow/planning-flow | The end of planning recommends a new chat for apply | Planning is complete | unit | no | text of `planning.md` and the schema instructions | — |
| workflow/planning-flow | The kit adds no waiting notification | Guide recommends the built-in notifications | unit | no | text of `planning.md` and the schema instructions | — |
| workflow/planning-flow | The kit adds no waiting notification | No notification hook is installed | integration | no | temporary project with a prepared change; the hook run as a process with prepared input | — |
| workflow/schema-starter | Creating a change without a schema starts the menu | Unnamed schema is blocked | integration | no | temporary project with a prepared change; the hook run as a process with prepared input | — |
| workflow/schema-starter | Creating a change without a schema starts the menu | Unnamed schema through the wrapper is blocked | integration | no | temporary project with a prepared change; the hook run as a process with prepared input | — |
| workflow/schema-starter | Creating a change without a schema starts the menu | Schema named with a space is not blocked | integration | no | temporary project with a prepared change; the hook run as a process with prepared input | — |
| workflow/schema-starter | Creating a change without a schema starts the menu | Schema named with an equals sign is not blocked | integration | no | temporary project with a prepared change; the hook run as a process with prepared input | — |
| workflow/schema-starter | Creating a change without a schema starts the menu | Unknown schema is passed through | integration | no | temporary project with a prepared change; the hook run as a process with prepared input | — |
| workflow/schema-starter | The menu asks the depth level | Choosing the high level | unit | no | text of `planning.md` and the schema instructions | — |
| workflow/schema-starter | The menu asks the depth level | Medium is marked as recommended | unit | no | prepared change files or hook message | — |
| workflow/schema-starter | The menu asks the depth level | Only depth levels are offered | unit | no | prepared change files or hook message | — |
| workflow/schema-starter | A test-case schema can still be named in the command | Test-case schema named explicitly | integration | no | temporary project with a prepared change; the hook run as a process with prepared input | — |

## Exclusions

| Capability | Scenario | Reason |
|---|---|---|
| — | — | None. |

## Requirement trace

| Capability | Requirement | Sources |
|---|---|---|
| questions/depth | Three depth levels | [D1][Q2][Q14] |
| questions/depth | The level sets what the agent investigates | [D1] |
| questions/depth | The level sets what the agent settles itself | [D1] |
| questions/depth | The agent's own decisions are recorded as assumptions | [D1][Q20] |
| questions/depth | Every question names what its answer changes | [D1] |
| questions/depth | On the high level every answer is checked for its consequences | [D1] |
| questions/depth | A changed level applies to later questions only | [Q18] |
| questions/recommendations | A question carries a recommended option when there is a basis | [Q6] |
| questions/recommendations | The recommendation is recorded with the question | [Q6] |
| questions/recommendations | A recommendation is never an answer | [Q6] |
| questions/recommendations | No answer accepts all recommendations at once | [Q7] |
| questions/rounds | Two question rounds before the code | [D1] |
| questions/rounds | The agent decides what the Verification round asked | [D1] |
| questions/rounds | A round is closed when every question is answered | [D1][Q5] |
| questions/rounds | A round may have no question | [D1][Q5] |
| questions/rounds | A closed round counts as a confirmed round | [D1][Q5] |
| questions/rounds | The answer mode is asked once per change | [D1][Q9] |
| questions/rounds | A changed answer of a closed round stops planning | [Q5][Q19] |
| questions/rounds | A changed answer also stops the implementation | [Q23] |
| questions/rounds | Earlier changes and test-case schemas keep their rounds | [D1][Q3] |
| ui-sources/inventory | Every element has a decision | [Q26] |
| ui-sources/inventory | On new changes a closed round backs a decision | [D1][Q5] |
| ui-sources/screenshots | The AI asks whether the change has mockups | [D1][Q4] |
| workflow/planning-flow | Planning goes on without a command | [D1][Q3][Q4] |
| workflow/planning-flow | The agent stops where a human is needed | [D1][Q5][Q16][Q19][Q21] |
| workflow/planning-flow | The developer pauses planning in plain words | [Q21] |
| workflow/planning-flow | A failing artifact check stops after two fix attempts | [Q16] |
| workflow/planning-flow | Planning starts and resumes without `/opsx:continue` | [D1][Q4] |
| workflow/planning-flow | The agent settles spec review findings itself | [Q8] |
| workflow/planning-flow | At most two spec review runs | [Q17] |
| workflow/planning-flow | A digest after the specs | [D1][Q10][Q20] |
| workflow/planning-flow | A digest that cannot hold every decision points to the full list | [Q22] |
| workflow/planning-flow | Updated specs are reviewed once and the digest is printed again | [Q25] |
| workflow/planning-flow | The end of planning recommends a new chat for apply | [D1] |
| workflow/planning-flow | The kit adds no waiting notification | [Q11][Q12] |
| workflow/schema-starter | Creating a change without a schema starts the menu | [Q13][Q24] |
| workflow/schema-starter | The menu asks the depth level | [Q13][Q14][Q24] |
| workflow/schema-starter | A test-case schema can still be named in the command | [Q24] |

## Environment

- Node and the pinned OpenSpec CLI 1.15.0; the tests build temporary projects with changes on `clarify`, `lean` and `clarify-qa`, stamped 0.6.0, 0.5.0 and without a stamp.
- The command is `npm test`.
- Assumed without a question: the critical scenarios are those marked `yes` above; scenarios about the agent's behaviour are proven by tests that find the rule in `planning.md` and in the schema instructions; scenarios of modified requirements that keep their behaviour keep their present tests.
- Running application: no
