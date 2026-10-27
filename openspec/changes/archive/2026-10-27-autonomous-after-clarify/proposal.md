# Proposal

## Why

In the pilot the kit finished the implementation and the E2E stage, and then handed the developer eight manual checks and three open "verify by hand" tasks that blocked the archive; the developer expected the kit to finish on its own once the questions were answered [desc][D1]. The causes are kit rules: `manual` is allowed for anything hard to automate, manual checks become apply tasks, and nothing checks up front whether the agent can start the application in its environment [D1].

## What Changes

- After the planning question rounds (Main, Specs, Design, Verification, and the test-case confirmation where the schema has it) the implementation, the checks and the E2E stage run without the developer [Q1].
- The agent stops and waits for the developer only on decisions that belong to a human: a requirement gap (Apply round, unchanged), a test that still fails after two fix attempts (unchanged), and an environment that does not let it start the application or the stack the way the project's instructions describe [Q1][Q2][Q3][Q6][Q19].
- When it stops for the environment, the agent describes what blocks it and may suggest options, but does not carry any of them out until the developer decides [Q6][Q8].
- Workarounds inside the application and its tests are allowed (create a user in advance, replace mail sending with a stub); working around the system or the kit's workflow is not, e.g. closing other applications to free ports for Docker [Q16].
- Without the developer's consent the agent changes nothing outside the project folder and its own temporary folder: no system or Docker settings, no programs installed into the system, no Docker containers, volumes or networks it did not create [Q7].
- Weakening a test or a check is allowed only with the developer's explicit consent, and the final report records which test, what was weakened, why, and that the developer agreed; today the kit forbids it always [Q17][Q22].
- A check may stay `manual` only when it cannot be automated at all, or when the function is dangerous (for example, an hourly payout to every user's card); the reason is written down, and "hard" or "slow" is not a reason; the test-case reviewer flags a `manual` label without a reason [Q4][Q18][D1].
- A dangerous function is tested automatically as usual, and a manual check is added on top; the agent itself decides that a function is dangerous and records why in the verification plan [Q23][Q24].
- The Verification round no longer asks whether to automate a check or keep it manual: automation is the rule [Q11].
- Manual checks never become apply tasks and never block the archive; they go to QA as one list with two sections: "manual checks" and "could not be verified automatically", each case with its reason [Q5][Q8][Q20].
- The environment is checked up front: the kit's health check (doctor) reports missing tools that the project mentions; at the start of apply the agent starts and stops the application with the project's own instructions and checks that it responds; when something is missing it reports and waits until the developer opens access or says to go on without it [Q9][Q10][Q21].
- The developer, not the agent, archives the change; the agent reports that everything is ready [Q15].
- Applies to all four kit schemas: `clarify`, `lean`, `clarify-ai-qa`, `clarify-qa` [Q12].
- Out of scope: the number and order of question rounds, the company's manual QA process (the kit only hands over the list), commits and pushes (the agent still does not commit unless asked), running in CI [Q13].

## Capabilities

### New Capabilities
- `workflow/autonomous-apply`: what runs without the developer after planning, the stops that remain, which workarounds are allowed, the boundary of the project folder, weakening tests only with consent, and who archives [Q1][Q2][Q3][Q6][Q7][Q8][Q15][Q16][Q17][Q19][Q22]
- `workflow/manual-checks`: when a check may be manual, dangerous functions, no automate-or-manual question, manual checks outside apply tasks and the archive gate, and the list for QA [Q4][Q5][Q8][Q11][Q18][Q20][Q23][Q24]
- `workflow/environment-check`: the up-front check of the environment in doctor and at the start of apply, and what happens when it fails [Q9][Q10][Q21]

### Modified Capabilities

None.

## Impact

| Area | Change |
|---|---|
| Kit schemas `clarify`, `lean`, `clarify-ai-qa`, `clarify-qa` | apply rules (stops, workarounds, project boundary, environment check at the start, report), tasks rules (no "verify by hand" tasks), verification-plan rules (manual only with a reason, dangerous functions) [Q1][Q5][Q12][Q21][Q24] |
| Kit protocols | `testing.md` (levels, manual rule, end of apply, list for QA), `test-cases.md` and the test-case reviewer (reason for `manual`), `questions.md` Verification round topics, `e2e.md` list for QA [Q4][Q11][Q20][D1] |
| Kit tooling | `doctor` reports missing tools the project mentions [Q9][Q21] |
| Archive gate | open manual checks no longer block the archive [Q5] |
| Kit docs | `docs/how-it-works.md`, the workflow guide, the decision log [D1] |
| Success measure | a repeated pilot of the same monorepo scaffold: after the questions the developer gets no task, and the change reaches ready-to-archive [Q14] |

## Assumptions & Open Questions

- The agent starts the application at the start of apply only when the verification plan needs a running application (integration checks through the stack, or E2E); a change without that skips it [assumption]
- When the project has no instructions for starting the application, the agent asks once and suggests writing the commands into CLAUDE.md, as the kit already does for test commands [assumption]
- A stop for a test that does not get fixed or for the environment does not block independent tasks: the agent finishes what does not depend on it first, then asks [assumption]
