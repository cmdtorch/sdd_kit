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
- [x] **Autonomous apply.** After the planning rounds apply runs to the end without the developer, stopping
  only for decisions that belong to them.
- [x] **Meta-repositories.** One root with the kit and application clones in sub-folders, each with its own git.
- [x] **Planning without stops.** Planning goes on to the next artifact by itself and stops only where a human is
  needed: two question rounds without `Looks correct`, recommended answers, depth levels, a digest after the
  specs. Replaces "`/opsx:continue` from the menu".

## Planned

- [ ] **Quality metrics.** Measure how well the kit works.
- [ ] **Apply through subagents.** The main chat splits `tasks.md` into small batches by dependency and hands
  each batch to a fresh subagent, one after another, so neither the main chat nor a subagent overflows
  its context.
- [ ] **Parallel subagents.** Tests and code are written by separate subagents in parallel to speed up apply.
- [ ] **Tests for the kit itself.** Decide how to test sdd-kit end to end.
- [ ] **Stage indicator.** A Claude Code plugin that shows the current stage.
- [ ] **A lighter apply.** Make the implementation stage faster and simpler.
- [ ] **QA stage and E2E rework.** Remove the test-case schemas and rework the E2E stage.
- [ ] **Early environment check.** Find environment problems before the implementation starts.

## Raw ideas

Not planned; may never be done.

- **Auto mode.** The AI settles minor questions itself and asks a human only the important ones. *Partly done:
  the depth levels decide what the agent settles itself.*
- **Less chat dependence.** The workflow runs without a human watching the chat.
