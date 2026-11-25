# Design

## Context

Planning today stops after every artifact because the OpenSpec `continue` skill writes one artifact and ends
the turn, and the kit's gates require a `Looks correct` on every round summary [D1]. The kit steers the agent
with schema instructions, protocols, hooks and checks; in-flight changes keep the rules of the kit version
stamped into their `.openspec.yaml` [D1]. The new rules apply to `clarify` and `lean`; `clarify-ai-qa` and
`clarify-qa` keep theirs [Q3].

## Goals / Non-Goals

**Goals:**

- A change runs from the first answer to the end of the tasks without a command from the developer [D1][Q4].
- Fewer forced stops: no summary confirmation, two rounds, one answer-mode question [D1][Q5][Q9].
- Depth levels that change how deep the agent investigates, not how many questions it asks [D1][Q2].

**Non-Goals:**

- A lighter apply, the removal of the QA stage with the rework of E2E, and an early environment check [D1].
- A waiting notification shipped by the kit [Q11][Q12].
- A setting that switches the automatic continuation off [Q4].

## Decisions

### D-1. One version gate for the new planning rules

`lib/project.mjs` gets `usesNewPlanning(change)`: the change is stamped 0.6.0 or later (a pre-release counts
as its base version, like the 0.5.0 gate) and its schema is `clarify` or `lean`. Every hook and check asks
this one function. `kit.json` and `package.json` go to 0.6.0 in this change, so new changes get the stamp
[D1][Q3]. Rejected: a per-project setting, since the automatic continuation is always on [Q4].

### D-2. A Stop hook continues planning

A new hook `openspec/tooling/hooks/planning-continue.mjs` on Claude Code's `Stop` event answers
`{"decision": "block", "reason": "<next artifact of change X>"}` when a change of this session has a next
artifact to write and nothing waits for the developer [D1][Q4]. It lets the turn end when: a question in the
clarifications file has a blank answer, the mockups answer is "yes" and `sources/ui/` is empty, the answers
lock differs (D-4), planning is complete, or the session state holds a wait or a pause (D-3)
[Q5][Q19][Q21]. The next artifact comes from `openspec status --change <name> --json`, as the session-start
hook reads it [D1]. Rejected: editing the generated `continue` skill (the kit's doctor reports edited
skills, and an update overwrites them) and a kit command the developer must type (the routine stays) [D1].

### D-3. Session state outside git, written by the kit

Which change this session works on is recorded by the existing artifact-feedback hook when an artifact of a
change is written: a JSON file in the system temporary folder, keyed by the session id, with the change name
and the count of continuations since the last written artifact [D1]. The agent marks a wait or a pause with
`node openspec/tooling/bin/planning.mjs wait|pause|resume --change <name>`, which writes the same file
[Q21]. A `wait` (a question asked in the chat, an artifact check that still fails after two fix attempts) is
cleared by the developer's next message through a `UserPromptSubmit` hook; a `pause` stays until `resume`
[Q16][Q21]. Loop guard: after two continuations in a row without a newly written artifact the hook lets the
turn end [Q16]. Nothing of this state is stored in the change [D1].

### D-4. An answers lock detects changed answers

When an artifact of a new-rules change is written, artifact-feedback stores in
`openspec/changes/<change>/answers-lock.json` a SHA-256 of the answers of the round the artifact depends on
(Main for the proposal, Technical for the specs, the design, the verification plan and the tasks) [Q5]. The
answers gate compares the lock with the current answers before it lets a later artifact or a check-off in
`tasks.md` be written, and blocks with the question numbers and the artifacts written from the earlier answers
[Q19][Q23]. Restoring the answer makes the hashes equal again; an update rewrites the artifact and thereby its
lock entry [Q19]. The apply instructions run the same comparison (`check-answers`) before the first task
[Q23]. Rejected: hashes in `.openspec.yaml` (the kit's YAML reader handles flat keys only) [Q5].

### D-5. One new protocol holds the new rules

`openspec/protocols/planning.md` holds the automatic continuation and its stops, the pause, the two rounds,
the closing of a round, the answer mode, recommendations, the depth levels, the handling of spec review
findings, the digest and the message at the end of planning [D1][Q6][Q8][Q10][Q20][Q22]. The `clarify` and
`lean` instructions, `questions.md` and the kit block of `config.yaml` point to it for changes stamped 0.6.0
or later; the present text stays for earlier changes [D1][Q3]. The artifacts `clarify` shares with the
test-case schemas keep identical instructions (the pointer names the schemas it applies to), so the existing
equality test stays [Q3].

### D-6. The clarifications file and its check

For a new-rules change `lib/clarifications.mjs` and `check-answers` accept: the rounds Main, Technical and
Apply without a summary confirmation; the header lines `Depth: low|medium|high` and `Answer mode: <mode>`; a
`Recommended: <letters> — <reason>` line under a question, whose letters must be options of that question;
and the line `No questions.` in a round without questions [Q5][Q6][Q9][Q2]. `roundStatus()` reports a closed
round as confirmed for such a change, so `check-grounding` and `check-ui` need no rule of their own
[Q5]. The answers gate maps the proposal to the Main round and the specs, the design and the verification
plan to the Technical round, and blocks while the round's section is missing [D1].

### D-7. The starter menu asks the depth

`schema-starter.mjs` keeps blocking an unnamed `openspec new change`; its message now tells the agent to ask
one question, the depth level (`low`, `medium` recommended, `high`), to rerun the command with
`--schema clarify`, and to write the chosen level as the `Depth:` line of the clarifications file
[Q13][Q14][Q24]. A named schema passes as before, so `--schema clarify-qa` still creates a test-case change
[Q24].

### D-8. The run limit covers the spec reviewer

The hook `test-cases-run-limit.mjs` also counts runs of the `spec-reviewer` subagent for new-rules changes in
`reviews/spec-review-runs.json` and blocks a third run [Q17]. After an update of the specs because of a
changed answer (the lock entry of the specs is rewritten, D-4) the counter allows one more run [Q25].

### D-9. Agent behaviour stays protocol text

The digest, the message with the UI decisions before the proposal, the handling of review findings, the investigation per depth level, the rule that every question
names what its answer changes, and the message at the end of planning are rules in `planning.md`, without
scripts; tests assert that the protocol and the schema instructions state them
[Q8][Q10][Q20][Q22][Q26][D1].

## Risks / Trade-offs

- The `Stop` hook's blocking behaviour is not among the hook facts verified for this project; when it cannot
  hold the turn, D-2 falls and the implementation stops for a decision [D1].
- A wait or a pause the agent forgets to mark lets the hook push it on; the loop guard limits this to two
  continuations [Q16][Q21].
- Without the summary confirmation, a wrong scope is caught later: by the digest after the specs or not at
  all [Q10].
- Two sets of rules live side by side until the earlier changes and the test-case schemas are gone [Q3].

## Assumptions & Open Questions

- The behaviour of the hook on the end of the agent's turn in Claude Code is not verified yet; the first
  implementation task verifies it in a live Claude Code and records the result in `docs/openspec-facts.md`.
  When the hook cannot hold the turn, the implementation stops and the developer gets the options.
  [assumption]
- The lock file is named `answers-lock.json` and lives in the change folder. [assumption]
- The removal of the test-case schemas and their files from the kit stays a later change; here they only
  leave the menu. [assumption]
