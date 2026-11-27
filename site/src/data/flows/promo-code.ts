import type { Flow } from './types';

/**
 * Sample content: the artifacts are shortened and written by hand in the kit's real formats.
 * They are not the output of a real run.
 */
export const promoCode: Flow = {
	name: 'add-promo-code',
	brief: 'Add a promo code field to checkout.',
	schema: 'clarify',
	stages: [
		{
			label: 'Request',
			who: 'you',
			title: 'You paste the brief',
			agent: 'Asks one question, how deep to dig, then creates the change and records the brief as a source.',
			you: 'Run one command and paste what the client wrote. No rewriting needed.',
			voiceOver: 'It starts with one sentence from a client. Nobody knows yet what it really means.',
			file: 'Claude Code',
			lang: 'chat',
			code: `/openspec-new-change add-promo-code

> How deep should the questions go?
medium (recommended)

> What should this change do?
Add a promo code field to checkout.

✓ openspec/changes/add-promo-code/
✓ schema: clarify
→ writing the Main round questions`,
		},
		{
			label: 'Questions',
			who: 'you',
			title: 'The agent asks what the brief left out',
			agent: 'Reads the brief, the specs and the code, then writes questions with options. Where a source supports an option, it recommends one.',
			you: 'Answer each question, or forward it to whoever decides. The proposal is blocked while an answer is blank.',
			voiceOver: 'Instead of guessing, the agent asks. Each question can be forwarded as it is.',
			file: 'clarifications.md',
			lang: 'md',
			code: `# Clarifications — add-promo-code

Depth: medium

## Main round

### Q3. Can a promo code be combined with a sale price?
Why this is asked: decides how the total is calculated.
- A. Yes, both discounts apply
- B. No, the larger discount wins
- C. Not yet defined
- X. Other (please specify)
Recommended: B — the pricing spec allows one discount.

[Answer]: B`,
		},
		{
			label: 'Proposal',
			who: 'agent',
			title: 'A proposal where every line has a source',
			agent: 'Writes the proposal. Each statement cites the answer it comes from; what the agent decided itself is listed as an assumption.',
			you: 'Nothing. Planning moves on by itself.',
			voiceOver: 'Now every statement points back to an answer. Nothing is invented.',
			file: 'proposal.md',
			lang: 'md',
			code: `## What Changes

- Checkout gets a promo code field with an Apply
  button. [desc]
- A code is case-insensitive and valid through its
  end date. [Q1][Q2]
- With a sale price, only the larger discount
  applies. [Q3]

## Assumptions

- One code per order.`,
		},
		{
			label: 'Specs',
			who: 'agent',
			title: 'Behaviour written as scenarios',
			agent: 'Turns the answers into requirements and scenarios. A spec reviewer checks that work could start from them without asking anything.',
			you: 'Read the digest and say "stop" if the scope is wrong. Backend and frontend now share one description.',
			voiceOver: 'The answers become scenarios: given, when, then. This is the contract for both sides.',
			file: 'specs/checkout/promo-code/spec.md',
			lang: 'md',
			code: `### Requirement: Expired codes are rejected
The checkout SHALL reject a promo code whose end
date has passed.

#### Scenario: Code expired yesterday
- **GIVEN** the code SPRING10 ended yesterday
- **WHEN** the buyer applies "spring10"
- **THEN** the total stays 100.00 and the message
  "This code has expired" is shown under the field`,
		},
		{
			label: 'Plan',
			who: 'agent',
			title: 'Each scenario gets a verification level',
			agent: 'Writes the design, plans how every scenario is verified and splits the work into tasks.',
			you: 'Nothing, unless a decision is yours to make.',
			voiceOver: 'Every scenario gets a level: unit, integration, end to end, or manual.',
			file: 'verification-plan.md',
			lang: 'md',
			code: `## Scenario coverage

| Scenario                    | Level       | Critical |
|-----------------------------|-------------|----------|
| Valid code lowers the total | integration | yes      |
| Code expired yesterday      | unit        | no       |
| Larger discount wins        | unit        | yes      |
| Buyer sees the error text   | e2e         | no       |`,
		},
		{
			label: 'Apply',
			who: 'agent',
			title: 'Test first, then the code',
			agent: 'For each task group writes the failing test with its scenario marker, then the code that makes it pass.',
			you: 'Start apply in a fresh chat. It runs to the end and stops only for decisions that belong to you.',
			voiceOver: 'The test comes first and fails. Then the code makes it pass.',
			file: 'tests/promo-code.test.js',
			lang: 'js',
			code: `// @scenario checkout/promo-code :: Code expired yesterday
test('an expired code leaves the total unchanged', () => {
  const cart = cartWith(100, { today: '2026-04-02' });
  const result = cart.apply('spring10');
  expect(result.total).toBe(100);
  expect(result.error).toBe('This code has expired');
});

✗ 1 failing
→ write the code
✓ 1 passing`,
		},
		{
			label: 'Review',
			who: 'agent',
			title: 'Would this test fail if the feature broke?',
			agent: 'A test reviewer checks that every THEN is really asserted. Then the full suite runs.',
			you: 'Nothing. The agent fixes the findings; what it cannot fix comes to you.',
			voiceOver: 'A reviewer asks one question of every test: would it fail if the feature broke?',
			file: 'reviews/test-review.md',
			lang: 'md',
			code: `# Test review — add-promo-code

Verdict: READY

| ID | Severity | Scenario             | Finding        |
|----|----------|----------------------|----------------|
| T1 | major    | Larger discount wins | asserts only   |
|    |          |                      | total < 100    |

Fixed: the test now asserts total == 80.

✓ 6 of 6 scenarios have a marked test`,
		},
		{
			label: 'Archive',
			who: 'you',
			title: 'The gate checks, then you archive',
			agent: 'Never archives by itself. The archive gate checks the tasks, the markers and the test review.',
			you: 'Run the archive command. The specs become the current description of the product.',
			voiceOver: 'One sentence became a checked, tested feature. And the spec stays as documentation.',
			file: 'Claude Code',
			lang: 'chat',
			code: `/openspec-archive-change add-promo-code

✓ every task is done
✓ every check passes
✓ every automated scenario has a marked test
✓ test review: READY

→ archived, specs merged into openspec/specs/`,
		},
	],
};
