<!-- sdd-kit: managed file. Do not edit; local changes are overwritten on kit update. -->
# Planning protocol

Applies to changes on the `clarify` and `lean` schemas stamped with kit version 0.6.0 or later (`x-sdd-kit` in the
change's `.openspec.yaml`; a pre-release such as `0.6.0-beta.1` counts as its base version). Planning runs from the
first answer to the end of the tasks without a command from the developer, and stops only where a human is needed.

A change without the stamp, a change stamped below 0.6.0, and every change on `clarify-ai-qa` or `clarify-qa` keep
their rules: the rounds and the `Looks correct` summary confirmation of `openspec/protocols/questions.md`,
`/openspec-continue-change` after each artifact, and the spec review findings shown to the developer, who decides
(`openspec/protocols/review-specs.md`). Nothing in this protocol applies to them.

On `lean` these parts apply: the automatic continuation and its stops (§1–§4), the mockups (§8) and the end of
planning (§11). `lean` has no question rounds, no answer mode, no answers lock, no spec review and no digest.

---

## 1. Planning goes on by itself

- **The first artifact follows the creation.** Right after you create a change, write its first artifact in the same
  turn, without waiting for a command: on `clarify` the clarifications file with the first questions (the mockups
  question first when `sources/ui/` holds no screenshot, §8); on `lean` the proposal, after the mockups question in
  the chat (§8).
- **After every artifact, write the next one.** When an artifact is written and nothing waits for the developer (§2),
  go on with the next artifact of `openspec status --change <name>` in the same turn.
- **Never tell the developer to run `/openspec-continue-change`, at any point of planning.** When the developer runs it
  anyway, write the next artifact and go on with the ones after it as without the command.
- No setting switches this off.

The kit holds you to it. When you try to end your turn after you wrote an artifact of the change in this session,
the `Stop` hook `openspec/tooling/hooks/planning-continue.mjs` keeps the turn going (you see it as Stop hook
feedback) and names the next step: the next artifact, or on `clarify` the question round to prepare first (the
Technical round after the proposal, §5). Do what it names. It lets the turn end on the stops of §2, when planning is
complete, and after two continuations in a row without a newly written artifact. That last one is a loop guard, not a
way to stop: a stop needs one of the reasons of §2. Only the change you wrote an artifact of in this session is
continued.

## 2. Where planning stops

End the turn, and write no further artifact of the change, only while the change waits for the developer:

| The change waits for | What you do before you end the turn |
|---|---|
| a question in `clarifications.md` with a blank answer | tell the developer which questions are open and how to answer them (§6) |
| a question you asked in the chat (on `lean` the mockups question) | run `planning.mjs wait` (§3) |
| screenshots the developer said they will add (§8) | ask the developer to say when the screenshots are in place |
| an answer that changed after artifacts were written from it (§7) | warn the developer and wait for the instruction |
| an artifact check that still fails, or a write that stays blocked, after your second fix attempt (§4) | run `planning.mjs wait` and show the remaining errors or the cause |
| a pause the developer asked for (§3) | run `planning.mjs pause` |
| the developer's answer to the drafts of the project files, or the choice after a failed early start check (§14) | run `planning.mjs wait` |

Nothing else is a reason to stop: not "shall I go on", not a detail an answer, a source or a spec already settles.
Say in your last message what the change waits for.

## 3. Wait, pause and resume

The `Stop` hook cannot see a question you asked in the chat or what the developer told you. Mark it:

```bash
node openspec/tooling/bin/planning.mjs wait   --change <name> [--reason "<what you wait for>"]
node openspec/tooling/bin/planning.mjs pause  --change <name> [--reason "<the developer's words>"]
node openspec/tooling/bin/planning.mjs resume --change <name>
```

- **`wait`**: run it before you end a turn that waits for the reply to a question you asked in the chat, and when an
  artifact check still fails after your second fix attempt (§4). The developer's next message ends the wait (the
  `UserPromptSubmit` hook `openspec/tooling/hooks/planning-prompt.mjs`); then go on.
- **`pause`**: when the developer tells you in plain words to stop or pause ("stop, I want to think about the scope",
  "pause"), run it and end your turn. While planning is paused, answer the developer's messages, questions included
  ("why is the export in scope?"), write no artifact of the change and end your turn after each answer. The pause
  stays until `resume`.
- **`resume`**: when the developer tells you in plain words to go on ("go on", "continue"), run it and write the next
  artifact; planning then goes on without further commands.

The state lives in the system temporary folder, per Claude Code session; nothing is written into the change.

## 4. A failing artifact check

Right after a write, the artifact feedback hook shows you the errors the kit's checks find in the artifact, and a
gate may block a write. Fix the cause yourself and go on, without asking the developer: when the check passes after
a fix, write the next artifact.

- **Two fix attempts.** When the check still reports errors after your second fix attempt, or the write is still
  blocked after your second attempt, stop: run `planning.mjs wait`, write no further artifact, and show the developer
  the remaining errors of the check, as the check reports them, with what you tried.
- **A cause only the developer can remove counts the same.** Example: `sources/ui/` holds `mockup.svg`, so the write
  of the proposal is blocked (`openspec/protocols/ui-inventory.md` §1); after the second blocked attempt, name the
  `.svg` file and ask the developer to export it as PNG, JPG or WebP and to delete the original.
- **A block by an open question is a wait, not an attempt.** When the answers gate blocks a write because a question
  has a blank answer or a round is not closed, do not count it as an attempt: end the turn and name the unanswered
  question, not a failed check.

## 5. Question rounds (`clarify`)

`openspec/protocols/questions.md` still says how to write a question (§2), how answers are written (§4 *Answer
syntax*) and how to analyse them (§5). Where it differs from this section, this section applies. Wherever another kit
rule requires a confirmed round, a closed round counts as confirmed; wherever it names the Specs round, the Technical
round takes its place. Recommendations are in §12, the depth levels (what you investigate, what you settle yourself
and the `Why this is asked:` line) in §13.

### Two rounds before the code

| Round | Asked before writing | Topics |
|---|---|---|
| Main | `proposal.md` | as the Main row of `questions.md` §3 |
| Technical | the spec files | the completeness of the specs (the six dimensions of the Specs row of `questions.md` §3) and the design forks |
| Apply | — (during the implementation) | only real gaps found while coding |

- The Technical round, before the spec files, asks about the completeness of the specs and the design forks: choices
  that would change the specs, the approach or the task breakdown, such as a new table or a new column of an existing
  one, sync or async processing, a migration strategy or a new dependency. Deferrable details stay out.
- There is no Design round and no Verification round. `design.md` is still always written, after the specs, without
  a round of its own: its forks were asked in the Technical round. A fork you find only while writing the design is a
  follow-up question in the Technical round.
- Write `verification-plan.md` without a question to the developer. Decide yourself which scenarios are critical,
  which test data they need and which environment the checks need, and record these decisions in the plan as
  assumptions: a line `Assumed without a question:` in its `## Environment` that names them. Whether a check is
  automated or stays manual is decided by `openspec/protocols/testing.md` §1, never asked.
- During the implementation, a requirement gap (behaviour that no answer, source or spec decides) goes into the
  `## Apply round` of `clarifications.md`, asked in the recorded answer mode (§6).

### The file

```markdown
# Clarifications — <change-name>

Depth: medium
Answer mode: chat

## Sources

- [desc] Developer description: "<the developer's request, verbatim>"

## Main round

### Q1. <question>
...

[Answer]: B

## Technical round

No questions.
```

- `Depth:` (the level chosen when the change was created: `low`, `medium` or `high`) and `Answer mode:` (§6) are
  lines under the title, before `## Sources`.
- The round headings are `## Main round`, `## Technical round` and `## Apply round`, always in English. There is no
  `### Summary confirmation` and no `Looks correct`.

### Closing a round

- A round is closed when its section exists, holds at least one question or the line `No questions.`, and no
  question in it has a blank answer (follow-ups included). No summary confirmation is asked.
- Analyse the answers as `questions.md` §5 says. A follow-up goes into the same round with the next free number and
  opens the round again until it is answered.
- As soon as the round is closed, write the artifact that depends on it, in the same turn; after the Main round of
  a `clarify` change stamped 0.7.0 or later, do the steps of §14 first.
- **A round without questions.** When you find nothing to ask in a round, write its section with the single line
  `No questions.`: the round is closed, go on. Never write that line in a round that has a question.
- A round whose section is missing is not closed: the answers gate blocks the spec files while there is no
  `## Technical round`.

## 6. The answer mode (`clarify`)

Ask once per change, before the first batch of questions, how the developer wants to answer, with AskUserQuestion:

| Mode | Recorded as | How the questions are answered (`questions.md` §4) |
|---|---|---|
| questions in the chat | `Answer mode: chat` | as *Guide me*: you ask in batches and write each answer into the file |
| editing the file | `Answer mode: file` | as *I'll edit the file*: the developer fills in the file and says "done" |
| free discussion | `Answer mode: discussion` | as *Chat*: you discuss and write the decisions into the file |

- Record the choice right away as the `Answer mode:` line under the title of `clarifications.md`.
- Use the recorded mode for every later batch, the Technical round and the Apply round included, without asking
  again. With `Answer mode: file`, give the file path after you have written the questions and wait.
- In a new chat too, read the `Answer mode:` line and do not ask again.
- The developer may name another mode at any time ("ask me here instead"): update the line (`Answer mode: chat`) and
  use the new mode from the next batch on.

## 7. A changed answer (`clarify`)

The kit records which answers every written artifact was based on: `answers-lock.json` in the change folder, written
by the kit when an artifact is written (the proposal from the Main round; the specs, the design, the verification
plan and the tasks from the Main and Technical rounds). Never write or edit it. An answer counts as changed when its
text differs, spaces at its ends ignored.

- **Before any artifact is written from it**, a changed answer is simply the answer: write the artifact from it,
  without a warning.
- **After artifacts were written from it**, the answers gate blocks every later artifact and every check-off in
  `tasks.md`; its message names the questions and the artifacts written from the earlier answers. Warn the developer:
  which question changed and which artifacts no longer match. Write no further artifact and end the turn.
- The developer then either:
  - restores the earlier answer: the block is gone; go on without updating anything;
  - tells you to update: rewrite the named artifacts from the new answer, in order (proposal, specs, design,
    verification plan, tasks), then go on with the next artifact. Each rewrite renews the artifact's entry in the
    lock.
- **Review and digest after an update.** After you have rewritten the specs for a changed answer, run the spec
  reviewer once more on them (the run limit allows this one run, §9), fix its findings without a further run, and
  print the digest again (§10).
- **During apply.** Before the first task, before each task group, and whenever the developer tells you to go on, run
  `node openspec/tooling/checks/check-answers.mjs --change <name>`. While it reports a changed answer, start no task:
  warn the developer, naming the questions and the artifacts, and wait until they tell you to update the artifacts or
  restore the answer.

## 8. Mockups and the UI decisions

`openspec/protocols/ui-inventory.md` applies, with these differences:

- **Asking.** On `clarify` the mockups question is the first Main round question, as `ui-inventory.md` §1 says. On
  `lean`, ask in the chat before the proposal whether the change has UI mockups, run `planning.mjs wait`, end the
  turn, and record the answer under `## Clarifications` of the proposal.
- **"Yes" to the mockups question:** create `sources/ui/`, name the accepted formats (PNG, JPG or WebP; no `.fig`, SVG
  or PDF), and ask the developer to put the screenshots there and to say when they are in place ("done"). Do not
  name `/openspec-continue-change`. Write no other question and no artifact, and end the turn. The `Stop` hook lets
  the turn end while the folder holds no screenshot.
- **"Done" with the screenshots in place:** go on with the UI inventory (`openspec/protocols/ui-inventory.md` §2–§5)
  and the planning after it.
- **"Done" with the folder still empty:** ask once more whether to wait for the screenshots or to continue without
  mockups, before writing anything else; record the reply as a follow-up question in the same round (on `lean`: under
  `## Clarifications` of the proposal).
- **The UI decisions before the proposal** (`clarify`, UI mode). There is no round summary to show them in. When the
  Main round is closed and every inventory element has its decision, write a short message to the developer that
  names every element with its decision, screen by screen (for example `export-button — in scope`,
  `search-field — existing`), then write the proposal in the same turn, without waiting for a reply.

## 9. Spec review findings (`clarify`)

After the spec files are written, run the `spec-reviewer` subagent (`openspec/protocols/review-specs.md`). Its section
*For the main agent* (show the findings, the developer decides) applies only to earlier changes: on a change stamped
below 0.6.0 or without the stamp, show the verdict and the findings to the developer and wait for the decision. On a
change under this protocol you settle the findings yourself, without waiting for the developer:

- **Fix what the answers, the sources and the existing specs settle.** Rewrite the spec yourself and do not ask the
  developer what to do with the finding. Example: the review reports that a scenario's outcome says "properly saved"
  without a value, and an answer names the saved value: rewrite the scenario with that value.
- **A finding that needs a decision about the requirements becomes a question.** Add it to the Technical round with a
  blank `[Answer]:`, written so it can be asked as is (the review's suggested follow-up), and end the turn: the round
  is open again, and the design waits for the answer. Example: no answer says who may cancel an order.
- **Two runs at most.** After you have fixed the findings of the first run, run the spec reviewer once more on the
  same specs; never a third time. The hook `openspec/tooling/hooks/test-cases-run-limit.mjs` counts the runs in
  `reviews/spec-review-runs.json` and blocks a third one. When the first run reports no finding, there is no second
  run.
- **Findings of the second run: fix them too, without a further run.** One that needs a decision about the
  requirements becomes a Technical round question as above: the turn ends and the design is not written until it is
  answered. One you cannot fix (for example two requirements overlap and merging them would change their meaning) is
  listed in the digest (§10), and planning goes on with the design.
- **After an update for a changed answer** (§7) the reviewer runs once more on the rewritten specs; fix its findings
  without a further run.

## 10. The digest (`clarify`)

When the spec review is settled (no further run is due, and every finding is fixed, asked or kept for the digest),
print a digest in the chat and go on to the design in the same turn, without waiting for a reply.

- At most 15 lines, in the questions language (`Questions language:` in the context of `openspec/config.yaml`;
  English if not set).
- It says:
  - what will be built: the capabilities and their main rules;
  - what is deliberately left out;
  - the decisions you made yourself so far (the `[assumption]` entries of the proposal, later also those of the
    design and the verification plan), those that change the behaviour a user sees first. When every decision came
    from an answer, say that there are none; do not leave the part out;
  - the review findings you could not fix (§9), if any.
- No scenario counts.
- When your own decisions do not fit into the 15 lines, show those that change the behaviour a user sees first, then
  the number of the others ("and 14 more"), and name `proposal.md`, whose `## Assumptions & Open Questions` lists
  them all.
- After the specs were rewritten for a changed answer, print the digest again (§7).
- `lean` has no digest.

## 11. The end of planning

When the last planning artifact (`tasks.md`) is written, end the turn with a message that says apply can start, names
`/openspec-apply-change`, and strongly recommends running `/clear` or opening a new chat before it: apply works from
the artifacts, not from the planning conversation. Do not start apply yourself and start no task of the change.

## 12. Recommendations (`clarify`)

A question may name the answer you recommend, so the developer answers faster; the answer itself still comes only
from the developer. A change stamped below 0.6.0 or without the stamp, and every change on `clarify-ai-qa` or
`clarify-qa`, gets no recommendation: write its questions without a `Recommended:` line and name no recommended option
in the chat.

- **Recommend only with a basis.** A question names the option you recommend when a registered source, an existing
  spec or the project's code supports it; the reason names that basis. Example: the code already limits report
  exports to accountants: `Recommended: A — the existing export rule in the code lets only accountants export
  reports`. When no source, spec or code decides it (a business rule only the developer knows), write no
  recommendation: your background knowledge and common practice are not a basis. On `low` the basis is a registered
  source only (§13).
- **The line.** Write the recommendation on its own line under the options of the question, before `[Answer]:`, as
  `Recommended: <option letters, comma-separated> — <reason>`. Every letter must be an option of that question;
  `check-answers` reports one that is not. A question that allows several answers (`(select all that apply)`) may
  recommend several options: `Recommended: A, B — the requirement document names accountants and administrators`.
- **Never an answer.** Leave `[Answer]:` blank until the developer answers, whatever the question recommends. A
  question with a recommendation and a blank answer keeps its round open, and the answers gate blocks the artifact
  that depends on it.
- **In the chat**, show the recommendation with its question: mark the recommended option `(recommended)` and give the
  reason. Each question of a batch is asked with its own options. Never offer an option or a question that accepts
  the recommendations of several questions at once.
- **No accept-all.** When the developer asks in free text to accept all recommendations ("just take all your
  recommendations"), fill in no answer: say that every question needs its own answer and ask the developer to answer
  each question. A developer who picks the recommended option of one question answers it like any other option: write
  its letter.

## 13. Depth levels (`clarify`)

The depth level sets how far you investigate before you write the questions of a round and what you settle yourself,
not how many questions you ask: the question counts of `questions.md` §3 (*How many questions*) do not apply. Record
the level as the line `Depth: <level>` when you write the clarifications file: the level the developer chose in the
starter menu, otherwise `Depth: medium`. The levels are `low`, `medium` and `high`. `lean` has no depth level. Earlier
changes and the test-case schemas keep `Minimal`, `Standard` and `Comprehensive` of `questions.md`.

### What you investigate

Before you write the questions of a round, investigate, by level:

- `low`: the registered sources and the developer's description. No question and no recommendation of the round
  names the project's code or an existing spec as its basis.
- `medium`: also the existing specs and the code of the area the change touches. Do not ask what they settle: when
  the existing export spec limits a file to 10 000 rows, do not ask what the row limit is.
- `high`: also the code affected outside that area (for example a separate permissions module that decides who sees
  lists), every requirement under the lenses roles, states, errors, boundaries, concurrent use and existing data,
  and the bugs QA would likely file after the release. A question raised by such a finding names it (below).

### What you settle yourself

You settle yourself, by level:

- `low`: every decision that does not change the behaviour a user sees, such as how often a cached report total is
  recalculated.
- `medium`: also minor details of visible behaviour (an order, a label, a default value), such as the order in which
  a list is sorted.
- `high`: nothing that no source, spec or code settles.

And you ask:

- On `low` ask every decision that changes the behaviour a user sees, such as the order in which a list is sorted.
- On `medium` ask every decision about permissions, money and data, visible or not: who may delete a record, what an
  order costs, how long a generated export file is kept in storage.
- On `high` ask every decision that no source, spec or code settles, such as how long a generated export file is
  kept.

### Your own decisions are assumptions

Every decision you settle yourself is an `[assumption]` entry (`openspec/protocols/grounding.md`), never a question:

- in the proposal's `## Assumptions & Open Questions` when you make it before or while the proposal or the specs are
  written: a decision made while writing the specs (a list sorted by date) is added to the proposal's assumptions
  after the specs are written;
- a later decision goes into the assumptions of the design or of the verification plan.

No summary confirmation lists them; the digest shows them (§10).

### Every question names what its answer changes

- On every level the `Why this is asked:` line says what in the specs depends on the answer (a question about who may
  export a report: "this decides the permission rule for the export"). A question for which you cannot say it is not
  asked.
- On `high` the line also names the finding that raised the question: the place in the code, the source or the spec
  ("the existing export spec limits exports to accountants; this decides the permission rule for the new report").

### Consequences of the answers on `high`

On `high` check each answer for what it implies for existing behaviour and data. For each consequence that no
source, spec, code or answer decides, ask one follow-up question that quotes the answer, in the same round. Example:
"In Q3 you chose that only accountants may export reports. Other staff have already created exports: what happens to
them?" When an earlier answer already decides the consequence (existing exports stay visible to their authors), ask
no follow-up about it.

### A changed level

The developer may change the level at any time, by telling you or by editing the `Depth:` line. When told, update the
line (`Depth: high`). The new level applies only to questions not asked yet: never add a question to a closed round
because of it, and never rewrite or remove a question already asked, answered or not.

- Raised to `high` after the Main round is closed: the Main round gets no new question and the Technical round is
  prepared on `high`.
- Lowered to `low` while two questions of the round are unanswered: every question stays as it is and the Technical
  round is prepared on `low`.

## 14. After the Main round (`clarify`)

Applies only to `clarify` changes stamped with kit version 0.7.0 or later (a pre-release such as `0.7.0-beta.1`
counts as its base version). A `lean` change, a change on `clarify-ai-qa` or `clarify-qa`, and a change stamped
below 0.7.0 or without the stamp get none of these steps: write the proposal right after the Main round, propose no
project file during planning, and leave the start check to the beginning of apply
(`openspec/protocols/apply.md` §4). Example: a change stamped 0.6.1 in a project without
`openspec/test-commands.md`: write the proposal without proposing the file.

As soon as the Main round is closed, before you write the proposal, do these steps in order. None of them is a gate:
a missing file never blocks the work, and a skipped check is legitimate.

1. **The project files.** When `openspec/project-tools` (`openspec/protocols/apply.md` §10) or
   `openspec/test-commands.md` (`openspec/protocols/testing.md` §8) is missing, draft the missing ones from the
   project's instructions; run none of the project's test commands while you draft. When both are missing, show
   both drafts in one chat message, with one question: confirm, correct or decline. Run `planning.mjs wait` and end
   the turn. Write no file before the answer. From the answer write each file: the confirmed draft with the
   developer's corrections and the durations the developer named, or on a decline the single line `none`. When a
   file exists, with commands or with the line `none`, do not propose it; when both exist, skip this step. The tool
   list is settled here, right after the Main round, also when the early start check is skipped. After the
   developer's answer to the drafts, go on with the early start check, before the proposal.
2. **The early start check.** When the project's instructions name both the command that starts the application
   and an address it serves, run the start check
   (`node openspec/tooling/bin/start-check.mjs --change <name> --start "<command>" --url <address> [--stop "<command>"]`,
   as `openspec/protocols/apply.md` §4 *How* says), even when the change may not need a running application (a
   change that only renames a field in a report). It writes `start-check.json` in the change. When the instructions
   name no start command or no address, skip the check without a question: ask nothing about it and go on with the
   proposal. In a meta-repository use the one command the instructions name to start, from the root, every clone
   the application needs, and run it from the root.
3. **Passed or skipped:** write the proposal and go on with planning in the same turn.

**A failed early start check.** Write no further artifact. Report what failed, from the script's output (for example
the published ports are refused), and offer two ways: fix the cause and run the check again, or go on with planning
without a passed check. Never pick a way yourself: run `planning.mjs wait` and end the turn. The ways about E2E and
the integration checks (`openspec/protocols/apply.md` §4 *Failed start*) belong to a failed check before the first
task only; do not offer them here.

- **Fix the cause:** when the developer says the cause is fixed, run the start check again; when it passes, write
  the proposal. When it fails again, report it and offer the two ways again. A fix outside the project needs the
  developer's consent to that specific change (`openspec/protocols/apply.md` §5).
- **Go on:** write the proposal. The record stays failed, so before the first task of apply the start check runs
  again when the plan needs a running application (`openspec/protocols/apply.md` §4).
