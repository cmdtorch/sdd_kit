# Proposal

## Why

Developers who use the kit complain that a feature takes too long [desc]. In the measured feature about
5 h 50 m of 15 active hours were waits for answers, and the planning stage forces a stop after every artifact
and a `Looks correct` that developers give without reading the summary [D1].

## What Changes

- Planning goes on by itself: after an artifact is written and nothing waits for a human, the agent writes the
  next artifact without `/opsx:continue`. This is always on; there is no setting to switch it off [D1][Q4].
- **BREAKING** The `Looks correct` summary confirmation is removed: a question round is closed when it has no
  blank answer [D1][Q5].
- When an answer of a closed round is changed after artifacts were written from it, the agent warns that the
  artifacts no longer match the answers and waits for the developer's instruction [Q5].
- **BREAKING** Two question rounds instead of four: Main and one technical round (specs and design forks); the
  Verification round is removed [D1].
- The answer mode is asked once per change, before the first batch of questions [Q9].
- A question names a recommended option with its reason wherever the recommendation rests on a source, an
  existing spec or the code. There is no "accept all recommendations" answer [Q6][Q7].
- The agent fixes the findings of the spec reviewer itself and stops with a question only where a finding
  needs a decision about the requirements [Q8].
- After the specs the agent prints a short digest of what will be built and goes on without waiting [D1][Q10].
- At the end of planning the agent says that apply can start and strongly recommends `/clear` or a new chat
  for it [D1].
- Question depth becomes three levels. The level sets how deep the agent investigates before it asks and what
  it may settle itself, not how many questions it asks; a question is asked only when the agent can name what
  changes in the spec with the answer [D1][Q2].
- The depth level is chosen in the menu at the creation of a change; the middle level is the default
  [Q13][Q14].
- **BREAKING** The test-case schemas leave the starter menu: the menu asks only the depth level and creates
  the change on `clarify` [Q24].
- The developer pauses the automatic continuation in plain words ("stop", "pause") and resumes it the same
  way [Q21].
- A changed answer also keeps the implementation from starting or going on until the developer has the
  artifacts updated or restores the answer [Q23].
- A digest that cannot hold every decision of the agent shows the most important ones, the number of the
  others and where the full list is [Q22].
- A failing artifact check stops planning after two fix attempts; the spec reviewer runs at most twice
  [Q16][Q17].
- After the agent has rewritten the specs because of a changed answer, the spec reviewer runs once on them
  and the digest is printed again [Q25].
- In a change with mockups the agent shows its decisions about the screen elements in a short message before
  the proposal, without waiting [Q26].
- The kit adds no waiting notification; its guide recommends Claude Code's built-in notifications [Q11][Q12].
- The new rules apply to the `clarify` and `lean` schemas; `clarify-ai-qa` and `clarify-qa` keep their present
  rules until they are removed [Q3].
- Changes started before the release keep the rules they started with [D1].

Not part of this change: a lighter apply, the removal of the QA stage with the rework of E2E, and an early
environment check [D1].

## Capabilities

### New Capabilities

- `workflow/planning-flow`: how planning moves from artifact to artifact without a command, what the agent does
  with spec review findings, the digest after the specs and the message at the end of planning [D1][Q4][Q8][Q10].
- `questions/rounds`: which question rounds exist, when a round is closed, how the answer mode is asked and what
  happens when an answer changes after its round is closed [D1][Q5][Q9].
- `questions/recommendations`: when a question carries a recommended option and how the answer is recorded
  [Q6][Q7].
- `questions/depth`: the three depth levels, what each one investigates and settles, and the rule that every
  question names what its answer changes [D1][Q2][Q14].

### Modified Capabilities

- `workflow/schema-starter`: the starter menu asks the depth level instead of the schema; the test-case schemas
  are no longer offered [Q13][Q24].
- `ui-sources/screenshots`: after the answer that mockups exist, the developer continues by saying that the
  screenshots are in place instead of running `/opsx:continue` [D1][Q4].
- `ui-sources/inventory`: on new changes a decision cites an answered question of a closed round, without a
  summary confirmation, and the developer sees the decisions in a message before the proposal [D1][Q5][Q26].

## Impact

- Kit protocols, schema instructions and templates of `clarify` and `lean`; the checks and hooks that read a
  round's confirmation; a new hook for the automatic continuation; the starter menu; the kit's guide and
  `docs/how-it-works.md` [D1][Q3].
- Success is judged by eye: teams stop complaining about long planning [Q15].

## Assumptions & Open Questions

- The levels are named `low`, `medium` and `high`. The level and the chosen answer mode are recorded as lines
  of the change's clarifications file when the agent writes it; the developer may change the level at any
  time, and the Apply round uses the same answer mode. [assumption]
- "Default medium" means: the menu marks it as recommended, and it applies when a change is created without the
  menu. [assumption]
- On `lean` the new rules that apply are: the automatic continuation, the stop after two failed attempts to
  pass an artifact's check, the message at the end of planning and the pause. `lean` has no depth level and no
  digest. [assumption]
- The Verification round is removed whole: which scenarios are critical, the test data and the environment are
  decided by the agent and recorded in the verification plan as assumptions. [assumption]
- The second round is called "Technical round" and also asks the design forks; `design.md` is still always
  written in this change; the Apply round stays. Where existing kit rules speak of a confirmed round or of the
  Specs round, on new changes a closed round and the Technical round take their place. [assumption]
- A round without questions is closed once the agent has recorded in the clarifications file that it has
  none. [assumption]
- A recommendation is a line of its own under the question, with the option and the reason; a multi-select
  question may recommend several options. On "accept all recommendations" the agent fills in no answer and asks
  the developer to answer each question. [assumption]
- "What changes with the answer" is the existing `Why this is asked` line of a question. [assumption]
- The digest is written in the project's questions language, takes at most 15 lines and exists only on
  `clarify`. [assumption]
- After the creation of a change the agent writes the first artifact at once; after "mockups exist" the
  developer adds the screenshots and says "done"; with the folder still empty the agent asks once whether to
  wait or to go on without mockups. [assumption]
- Findings left after the second spec review run: one that needs a decision about the requirements becomes a
  question, the others are listed in the digest and planning goes on. [assumption]
- The menu asks one question, the depth level, and creates the change on `clarify`; a test-case schema can
  still be named in the command, and such a change follows the old rules. [assumption]
- The kit's guide recommends Claude Code's built-in notifications; the kit registers none of its own.
  [assumption]
- What each level investigates: `low` the sources and the description; `medium` also the existing specs and
  the code of the touched area; `high` also the impact in the code, every requirement under the lenses roles,
  states, errors, boundaries, concurrent use and existing data, the bugs QA would file after the release, and
  the consequences of every answer. [assumption]
- What the agent settles itself: on `low` everything that does not change the behaviour a user sees; on
  `medium` also minor details of visible behaviour, while everything about permissions, money and data,
  visible or not, is asked; on `high` nothing that no source,
  spec or code settles. Its decisions are listed as assumptions and appear in the digest. [assumption]
- A write that a kit check blocks for a cause the agent cannot remove counts like an unfixed error: after two
  attempts the agent stops and shows the cause. A block by an open question is a wait, not an attempt.
  [assumption]
- Decisions the agent makes after the proposal are added to the proposal's assumptions (while the specs are
  written) or recorded in the assumptions of the design and the verification plan; the digest shows all of them
  so far, those that change visible behaviour first. [assumption]
- The agent also fixes the findings of the second spec review run, without a further run; only what it could
  not fix goes into the digest. [assumption]
- The lines of the clarifications file read `No questions.`, `Answer mode: chat`, `file` or `discussion`, and
  `Recommended: A, C — <reason>`. An answer counts as changed when its text differs, spaces at its ends
  ignored. [assumption]
- The new rules apply to changes stamped with kit version 0.6.0 or later. [assumption]
