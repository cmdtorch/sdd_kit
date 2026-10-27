# Roadmap

## Done

- [x] **Test cases before code.** Test cases are written in plain-text Gherkin before any code.
- [x] **TDD.** Apply writes the failing test first, then the code.
- [x] **E2E stage.** End-to-end tests run after the unit and integration tests.
- [x] **QA-reviewed Gherkin.** The generated test cases are reviewed by a QA engineer.
- [x] **Full pipeline.** Developer questions → answers checked, follow-up questions until none are left →
  specs → test cases → QA questions and review rounds → TDD tests → code checked by the tests → E2E tests.
- [x] **Iterative test-cases stage.** Like clarifications: the AI asks QA questions or shares documents,
  QA reviews and answers, and the AI reworks the test cases until no questions or remarks are left.
- [x] **Loop guard.** The AI QA review loop stops after three rounds.
- [x] **UI screenshots.** UI mockups and screenshots are clarify sources for frontend work.

## Planned

- [ ] **Quality metrics.** Measure how well the kit works.
- [ ] **Apply through subagents.** The main chat splits `tasks.md` into small batches by dependency and hands
  each batch to a fresh subagent, one after another, so neither the main chat nor a subagent overflows
  its context.
- [ ] **Parallel subagents.** Tests and code are written by separate subagents in parallel to speed up apply.
- [ ] **Tests for the kit itself.** Decide how to test sdd-kit end to end.
- [ ] **Stage indicator.** A Claude Code plugin that shows the current stage.
- [ ] **"Looks good" menu.** Find out why the menu does not offer "Looks good" and the move to the next stage.
- [ ] **`/opsx:continue` from the menu.** Offer continuing to the next artifact as a Claude Code menu choice.

## Raw ideas

Not planned; may never be done.

- **Auto mode.** The AI settles minor questions itself and asks a human only the important ones.
- **Less chat dependence.** The workflow runs without a human watching the chat.
