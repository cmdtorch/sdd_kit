// Text tests for the autonomous-apply rules (change autonomous-after-clarify): the agent's conduct lives in
// openspec/protocols/apply.md and the protocols and schema instructions that point to it. These tests read the
// kit texts and check that each rule is stated where the agent reads it.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseYaml } from '../kit/openspec/tooling/lib/yaml.mjs';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const kit = (...p) => readFileSync(join(REPO, 'kit', ...p), 'utf8');
const protocol = (name) => kit('openspec', 'protocols', name);
// collapse line breaks so phrases may wrap
const flat = (s) => s.replace(/\s+/g, ' ');
const APPLY = flat(protocol('apply.md'));
const TESTING = flat(protocol('testing.md'));
const SCHEMAS = ['clarify', 'clarify-ai-qa', 'clarify-qa', 'lean'];
const schema = (name) => parseYaml(kit('openspec', 'schemas', name, 'schema.yaml')).value;
const artifact = (name, id) => flat(schema(name).artifacts.find((a) => a.id === id).instruction);
const applyInstruction = (name) => flat(schema(name).apply.instruction);
/** The section of a protocol under `## <n>.` up to the next `## `. */
const section = (text, n) => {
  const m = text.match(new RegExp(`\\n## ${n}\\. [^\\n]*\\n([\\s\\S]*?)(?=\\n## |$)`));
  assert.ok(m, `section ${n} not found`);
  return flat(m[1]);
};

describe('autonomous apply: running without the developer', () => {
  // @scenario workflow/autonomous-apply :: Planning complete, nothing blocks
  test('apply runs every task, the test review, the full suite and the E2E stage without a question', () => {
    assert.match(APPLY, /every task, the test review, the full suite and the E2E stage, without a question to the developer/);
    for (const s of SCHEMAS) {
      const a = applyInstruction(s);
      assert.match(a, /openspec\/protocols\/apply\.md/, s);
      assert.match(a, /without a question to the developer, except at the stops/, s);
    }
  });

  // @scenario workflow/autonomous-apply :: Requirement gap during apply
  test('a requirement gap goes to the Apply round and the agent waits', () => {
    const stops = section(protocol('apply.md'), 2);
    assert.match(stops, /\*\*Requirement gap\*\*: behaviour that no source, answer or spec decides\. Append the question to the `## Apply round` of `clarifications\.md`/);
    assert.match(stops, /wait for the answer/);
  });

  // @scenario workflow/autonomous-apply :: Test still fails after two fix attempts
  test('a test that still fails after the second attempt stops the agent, who shows both attempts', () => {
    assert.match(section(protocol('apply.md'), 2), /\*\*Failing test\*\*: a test still fails after your second fix attempt.*Show the developer the failing test and both attempts/);
  });

  // @scenario workflow/autonomous-apply :: Environment blocks the start during the work
  test('an environment that blocks the start during the work is a stop', () => {
    const stops = section(protocol('apply.md'), 2);
    assert.match(stops, /\*\*Environment\*\*: during a task the application or the stack no longer starts with the project's own instructions/);
    assert.match(stops, /a container is unreachable, Docker does not see the project folders or a port is closed/);
    assert.match(stops, /describe what blocks you and wait for the developer's decision/);
  });

  // @scenario workflow/autonomous-apply :: Situation outside the plan
  test('a situation outside the plan is reported instead of worked around', () => {
    assert.match(section(protocol('apply.md'), 2), /\*\*Outside the plan\*\*:.*withdrawn from the package registry.*report it and wait instead of choosing a way around it/);
  });

  // @scenario workflow/autonomous-apply :: Case needs a real phone
  test('a single check that cannot run is recorded and the work goes on', () => {
    const s = section(protocol('apply.md'), 3);
    assert.match(s, /an SMS to arrive on a real phone/);
    assert.match(s, /do not stop: record it under "Not verified automatically" in `apply-report\.md` with the cause and go on with the next task/);
  });

  // @scenario workflow/autonomous-apply :: Application itself does not start
  test('an application that no longer starts is the environment stop, not a recorded check', () => {
    assert.match(section(protocol('apply.md'), 3), /When the application itself no longer starts with the project's instructions, that is the environment stop \(§2\), not a recorded check/);
  });

  // @scenario workflow/autonomous-apply :: Stop on one test with independent tasks left
  test('independent tasks are finished before a stop on one test', () => {
    assert.match(APPLY, /When a stop concerns a single test or the environment, first finish the tasks that do not depend on it, then stop/);
    assert.match(APPLY, /a test of task group 3 still fails after two attempts and group 4 does not depend on it: finish group 4/);
  });

  // @scenario workflow/autonomous-apply :: Requirement gap stops at once
  test('a requirement gap stops at once', () => {
    assert.match(APPLY, /A requirement gap stops at once: ask before you start any other task/);
  });

  // @scenario workflow/autonomous-apply :: Agent suggests freeing a port
  test('options are suggested, not carried out', () => {
    assert.match(APPLY, /port 5432 is taken by another program: you may suggest stopping that program or changing the project's port/);
    assert.match(APPLY, /Carry out none of them until the developer has chosen/);
  });

  // @scenario workflow/autonomous-apply :: Mail service missing in a test
  test('workarounds inside the application and its tests are allowed', () => {
    const s = section(protocol('apply.md'), 5);
    assert.match(s, /a registration test fails because no mail server is available: replace mail sending in the test with a stub and go on/);
    assert.match(s, /Never work around the system, the environment or the kit's workflow/);
  });

  // @scenario workflow/autonomous-apply :: Weakening without consent
  test('without consent a failing test keeps its assertions and stays enabled', () => {
    const s = section(protocol('apply.md'), 6);
    assert.match(s, /relaxing an assertion, skipping or deleting a test, lowering a threshold, switching off a quality rule/);
    assert.match(s, /Without the developer's explicit consent a failing test keeps its assertions and stays enabled/);
    assert.match(TESTING, /Weakening a test needs the developer's explicit consent and goes under "Weakened tests" in `apply-report\.md` \(`openspec\/protocols\/apply\.md` §6\)/);
  });

  // @scenario workflow/autonomous-apply :: Change ready to archive
  test('the ready message names the report and the archive command; the agent does not archive', () => {
    const s = section(protocol('apply.md'), 9);
    assert.match(s, /the change is ready to archive/);
    assert.match(s, /`apply-report\.md`/);
    assert.match(s, /`\/opsx:archive`/);
    assert.match(s, /Do not archive the change yourself/);
  });
});

describe('environment check: the start check and the project tools', () => {
  // @scenario workflow/environment-check :: Agent proposes the list
  test('the agent proposes the project tool list and writes it only after the developer confirms', () => {
    const s = section(protocol('apply.md'), 10);
    assert.match(s, /the README starts the stack with `docker compose` and runs the tests with `make test`: propose `docker — stack, E2E` and `make — tests`/);
    assert.match(s, /Write `openspec\/project-tools` only after the developer confirms/);
  });

  // @scenario workflow/environment-check :: No running application needed
  test('without "Running application: yes" the application is not started before the first task', () => {
    const s = section(protocol('apply.md'), 4);
    assert.match(s, /`Running application: yes`/);
    assert.match(s, /Otherwise do not start the application before the first task/);
    assert.match(TESTING, /\*Environment\* ends with the line `Running application: yes` or `Running application: no`/);
  });

  // @scenario workflow/environment-check :: No instructions or no address
  test('without start instructions or an address the agent asks once', () => {
    assert.match(section(protocol('apply.md'), 4), /ask the developer once and suggest writing the commands and the address into CLAUDE\.md/);
  });

  // @scenario workflow/environment-check :: Ports unreachable
  test('a failed start stops before the first task with three ways for E2E and two for integration checks', () => {
    const s = section(protocol('apply.md'), 4);
    assert.match(s, /the stack starts but its published ports are refused/);
    assert.match(s, /Stop before the first task/);
    assert.match(s, /\*\*E2E stage\*\* — three ways: switch it off; fix the cause; skip it deliberately/);
    assert.match(s, /\*\*Integration checks through the stack\*\* — two ways: fix the cause; skip them deliberately/);
    assert.match(s, /Never pick a way yourself, and do nothing else until the developer chooses/);
  });

  // @scenario workflow/environment-check :: Developer chooses to fix inside the project
  test('a fix inside the project is made and the start check runs again', () => {
    assert.match(section(protocol('apply.md'), 4), /When the fix lies inside the project .* make it and run the start check again/);
  });

  // @scenario workflow/environment-check :: Fix outside the project
  test('a fix outside the project waits for the developer to allow that specific change', () => {
    assert.match(section(protocol('apply.md'), 4), /When the fix lies outside the project .* change nothing outside the project unless the developer allows that specific change; after the fix run the start check again/);
  });
});

describe('manual checks: reasons, dangerous functions, the report and the consent list', () => {
  // @scenario workflow/manual-checks :: Hourly payout to cards
  test('a function that moves money to many users gets a dangerous manual row', () => {
    const s = section(protocol('testing.md'), 1);
    assert.match(s, /A function is \*\*dangerous\*\* when it moves money \(payments, payouts, charges, balances\), acts on many users or records at once, or deletes or changes data irreversibly/);
    assert.match(s, /a payout to the card of every user whose balance is above 1000, every hour: `dangerous: money, many users`/);
  });

  // @scenario workflow/manual-checks :: Role check only
  test('a role check alone is not dangerous', () => {
    assert.match(section(protocol('testing.md'), 1), /Sign-in, roles and access rights alone do not make a function dangerous: a check that a user without the admin role cannot open the admin page gets no `dangerous:` row/);
  });

  // @scenario workflow/manual-checks :: Two unverified entries
  test('the consent list is one question that lists every entry without consent', () => {
    const s = section(protocol('apply.md'), 8);
    assert.match(s, /ask the developer once, after everything else is done, with one question that lists all of them/);
    assert.match(s, /`Consent: "<the developer's words>" \(developer, <date>\)`/);
  });

  // @scenario workflow/manual-checks :: Entry already agreed
  test('entries that already carry a consent are not in the question', () => {
    assert.match(section(protocol('apply.md'), 8), /Entries that already carry a `Consent:` line — from the developer's choice at a failed start check or an E2E case accepted at the stop — are not in the question/);
  });

  // @scenario workflow/manual-checks :: Developer refuses an entry
  test('a refused entry leaves the change not ready to archive', () => {
    assert.match(section(protocol('apply.md'), 8), /When the developer does not agree to an entry, report that the change is not ready to archive, name that entry and wait for the developer's instructions; the entry gets no `Consent:` line/);
  });

  // @scenario workflow/manual-checks :: Effort given as the reason
  test('the test-case reviewer reports effort given as a manual reason as major', () => {
    const review = flat(protocol('review-test-cases.md'));
    assert.match(review, /\*\*Manual reason\.\*\* A case labelled `manual` gives a `Manual reason:` that starts with `cannot be automated:` or `dangerous:`/);
    assert.match(review, /Effort or difficulty given as the reason \(e\.g\. `cannot be automated: too much work`\) is a `major` finding/);
    assert.match(flat(kit('claude', 'agents', 'test-cases-reviewer.md')), /effort given as a manual reason is a major finding/);
    assert.match(flat(protocol('test-cases.md')), /`Manual reason:` line under `Labels:`/);
  });

  // @scenario workflow/manual-checks :: Verification round on an infrastructure change
  test('the Verification round never asks whether a check should be automated or stay manual', () => {
    const q = flat(protocol('questions.md'));
    assert.doesNotMatch(q, /checks that can only be done manually/);
    assert.match(q, /Never ask whether a check should be automated or stay manual/);
    for (const s of SCHEMAS) {
      const plan = artifact(s, 'verification-plan');
      assert.doesNotMatch(plan, /which checks can only be manual/, s);
      assert.match(plan, /never ask whether a check should be automated or stay manual/i, s);
    }
  });

  // @scenario workflow/manual-checks :: Report after the E2E stage
  test('an E2E case accepted at the stop goes to the report with its consent', () => {
    const e2e = flat(protocol('e2e.md'));
    assert.match(e2e, /every accepted case goes under "Not verified automatically" in `apply-report\.md` with its reason and a `Consent:` line with the developer's acceptance, so it is not asked again at the end/);
    assert.doesNotMatch(e2e, /list for the developer, as manual checks for QA/);
  });
});

describe('the schema texts follow the protocol', () => {
  test('no "verify by hand" tasks and no manual list in the tasks instruction', () => {
    for (const s of SCHEMAS) {
      const t = artifact(s, 'tasks');
      assert.doesNotMatch(t, /list the manual checks for the developer/, s);
      assert.match(t, /No task asks a human to check something by hand/, s);
      assert.match(t, /`apply-report\.md`/, s);
    }
  });

  test('the apply instruction starts with the start check and ends with the report', () => {
    for (const s of SCHEMAS) {
      const a = applyInstruction(s);
      assert.match(a, /start-check\.mjs/, s);
      assert.match(a, /`apply-report\.md`/, s);
      assert.doesNotMatch(a, /the manual checks are listed for the developer/, s);
      assert.doesNotMatch(a, /list the `e2e` test cases for QA as manual checks/, s);
    }
  });

  test('the verification plan template has the Manual reason column and the Running application line', () => {
    for (const s of SCHEMAS) {
      const tpl = kit('openspec', 'schemas', s, 'templates', 'verification-plan.md');
      assert.match(tpl, /\| Capability \| Requirement \| Scenario \| Level \| Critical \| Test data \/ setup \| Manual reason \|/, s);
      assert.match(tpl, /Running application: /, s);
    }
  });
});
