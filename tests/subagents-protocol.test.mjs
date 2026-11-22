// Text tests for the subagent execution protocol (change add-subagent-execution): the main agent's
// orchestration rules live in openspec/protocols/subagents.md. These tests read the kit text and check that each
// rule is stated where the agent reads it.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseYaml } from '../kit/openspec/tooling/lib/yaml.mjs';
import { install } from '../installer/sdd-kit.mjs';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const FILE = join(REPO, 'kit', 'openspec', 'protocols', 'subagents.md');
const RAW = existsSync(FILE) ? readFileSync(FILE, 'utf8') : '';
// headings inside fenced examples (`## 2. Order API`) are not sections
const PROSE = RAW.replace(/```[\s\S]*?```/g, '');
// collapse line breaks so phrases may wrap
const flat = (s) => s.replace(/\s+/g, ' ');
/** The section of the protocol under `## <n>.` up to the next `## `. */
const section = (n) => {
  const m = PROSE.match(new RegExp(`\\n## ${n}\\. [^\\n]*\\n([\\s\\S]*?)(?=\\n## |$)`));
  assert.ok(m, `section ${n} not found in subagents.md`);
  return flat(m[1]);
};
/** Section `## <n>.` of another kit protocol, fenced examples removed (apply.md §7 has `## ` inside a fence). */
const protoSection = (name, n) => {
  const text = readFileSync(join(REPO, 'kit', 'openspec', 'protocols', name), 'utf8').replace(/```[\s\S]*?```/g, '');
  const m = text.match(new RegExp(`\\n## ${n}\\. [^\\n]*\\n([\\s\\S]*?)(?=\\n## |$)`));
  assert.ok(m, `section ${n} not found in ${name}`);
  return flat(m[1]);
};
/** The text before the first numbered section. */
const intro = () => flat(PROSE.split(/\n## 1\. /)[0]);

describe('subagents protocol: when it applies', () => {
  test('the protocol is a managed kit file', () => {
    assert.ok(RAW.startsWith('<!-- sdd-kit: managed file.'), 'subagents.md missing or without the managed-file header');
  });

  // @scenario workflow/subagent-apply :: Change with three groups
  test('every task group before the final group goes to its own new subagent on changes stamped 0.5.0 or later', () => {
    const s = intro();
    assert.match(s, /stamped with kit version 0\.5\.0 or later \(`x-sdd-kit` in the change's `\.openspec\.yaml`/);
    assert.match(s, /Hand every task group of `tasks\.md` before the final group to a new subagent, one subagent per group/);
  });

  // @scenario workflow/subagent-apply :: Change with one group
  test('a change with a single group still runs it in a subagent', () => {
    assert.match(intro(), /whatever the size of the change: a change with a single group also runs it in a subagent, not in the main agent/);
  });

  // @scenario workflow/subagent-apply :: Apply protocol states the rule
  test('the protocol says the rule holds on changes stamped 0.5.0 or later and cannot be switched off', () => {
    const s = intro();
    assert.match(s, /0\.5\.0 or later/);
    assert.match(s, /No setting switches this off/);
    assert.match(s, /without the stamp, or stamped below 0\.5\.0, is implemented and verified as before: by the main agent alone/);
    // apply.md, the protocol apply starts from, states the rule too and points to subagents.md
    const a = protoSection('apply.md', 1);
    assert.match(a, /On a change stamped 0\.5\.0 or later, every task group before the final group is handed to a new subagent, and this cannot be switched off/);
    assert.match(a, /`openspec\/protocols\/subagents\.md`/);
  });
});

describe('subagents protocol: plan lines and scheduling', () => {
  test('plan lines are read from under each group heading, with the shared resources', () => {
    const s = section(1);
    assert.match(s, /`Depends on:`.*`Area:`.*`Shared:`/);
    for (const r of ['dependencies', 'migrations', 'settings', 'assembly', 'database', 'ports', 'docker']) {
      assert.match(s, new RegExp(`\`${r}\``), r);
    }
  });

  // @scenario workflow/task-groups :: Dependent group waits
  test('a group starts only after every group of its Depends on line is accepted', () => {
    assert.match(section(2), /Start a group only after every group in its `Depends on:` line is accepted/);
  });

  // @scenario workflow/subagent-apply :: Chain of groups
  test('a chain of groups runs one after another, each after the previous one is accepted', () => {
    assert.match(section(2), /group 2 has `Depends on: 1` and group 3 has `Depends on: 2`: run groups 1, 2 and 3 one after another, each after the previous one is accepted/);
  });

  // @scenario workflow/subagent-apply :: Backend and frontend groups
  test('independent groups with disjoint areas and no shared files may run at the same time', () => {
    const s = section(2);
    assert.match(s, /Run subagents at the same time only for groups that do not depend on each other, whose areas are known and do not overlap, and that do not both name the same one of `dependencies`, `migrations`, `settings` or `assembly`/);
    assert.match(s, /group 2 with `Area: api\/` and group 3 with `Area: web\/`, both with `Depends on: none` and `Shared: none`, may run at the same time/);
    assert.match(s, /there is no fixed limit/);
  });

  // @scenario workflow/subagent-apply :: Overlapping areas run in order
  test('groups whose areas overlap do not run at the same time', () => {
    assert.match(section(2), /Two groups whose areas both contain `src\/config\.ts` run one after the other/);
  });

  // @scenario workflow/subagent-apply :: Both groups change migrations
  test('groups that both name migrations do not run at the same time', () => {
    assert.match(section(2), /two groups with disjoint areas that both name `migrations` run one after the other/);
  });

  // @scenario workflow/subagent-apply :: Group without an area runs alone
  test('a group with Area: unknown runs alone', () => {
    assert.match(section(2), /A group with `Area: unknown` runs alone: no other group's subagent runs at the same time/);
  });

  // The unreadable-plan-line rule of workflow/task-groups ("Group without plan lines", "Malformed plan line") is
  // proven by group 6 together with check-tasks; here only the protocol's wording is checked.
  test('a group with a missing or unreadable plan line depends on every earlier group with an unknown area', () => {
    assert.match(section(1), /A group with a plan line missing or unreadable \(for example `Depends on: the API group`\) depends on every earlier group and has an unknown area/);
  });

  // @scenario workflow/subagent-apply :: Backend and frontend clones
  test('meta-repository groups of different repositories run one after another', () => {
    const s = section(2);
    assert.match(s, /`openspec\/protocols\/metarepo\.md`/);
    assert.match(s, /`## 2\. \[backend\] Order API` and `## 3\. \[frontend\] Order screen` run one after another/);
    assert.match(s, /Only groups of the same repository may run in parallel/);
  });
});

describe('subagents protocol: test runs on shared resources', () => {
  // @scenario workflow/subagent-apply :: Project gives each run its own database
  test('groups sharing only database may run tests together when the project creates a database per run', () => {
    assert.match(section(3), /share only `database` and the project's own test setup creates and deletes a separate database for each test run: their tests may run at the same time, each against its own database/);
  });

  // @scenario workflow/subagent-apply :: One shared test database
  test('groups on one fixed test database never run tests at the same time', () => {
    const s = section(3);
    assert.match(s, /their test runs must not overlap in time/);
    assert.match(s, /all use one fixed test database/);
    assert.match(s, /run such groups one after another/);
  });

  // @scenario workflow/subagent-apply :: Groups sharing ports
  test('groups whose tests use the same fixed port never run tests at the same time', () => {
    const s = section(3);
    assert.match(s, /`database`, `ports` or `docker`/);
    assert.match(s, /their test runs must not overlap in time/);
    assert.match(s, /Otherwise — for example their tests all use one fixed test database, or start a server on the same fixed port — run such groups one after another/);
  });

  // @scenario workflow/subagent-apply :: Kit does not add isolation
  test('the kit does not change the project test setup to isolate databases', () => {
    assert.match(section(3), /Do not change the project's test setup to create a database per run unless a task of the change asks for it/);
  });
});

describe('subagents protocol: one working folder', () => {
  // @scenario workflow/subagent-apply :: No commits during apply
  test('subagents share the working folder and nothing is committed, branched or merged', () => {
    const s = section(4);
    assert.match(s, /in the project's working folder, with no separate copy of the repository/);
    assert.match(s, /Do not commit, create branches or worktrees, stash or merge/);
    assert.match(s, /uncommitted changes in the working folder; the developer commits, as before/);
  });
});

describe('subagents protocol: the changed-files check', () => {
  test('the check reconciles the subagent report with git status', () => {
    const s = section(5);
    assert.match(s, /`git status --porcelain`/);
    assert.match(s, /`Changed files:` list of every file it created, changed or deleted, including files changed by commands/);
    assert.match(s, /A file in the git delta that no subagent listed has no owner: run the tests of the groups whose areas it lies in; when it lies in no declared area, it is a file outside every area \(accepted, see below\)/);
  });

  // @scenario workflow/subagent-apply :: Change inside the group's area
  test('a file in the group own area is accepted', () => {
    assert.match(section(5), /In the group's own area: accepted/);
  });

  // @scenario workflow/subagent-apply :: File outside every declared area
  test('a file outside every declared area is accepted', () => {
    assert.match(section(5), /In no group's area, for example `README\.md`: accepted/);
  });

  // @scenario workflow/subagent-apply :: Collision with another group, tests pass
  test('a collision with an accepted group whose tests pass is accepted without a fix subagent', () => {
    assert.match(section(5), /In the area of an accepted group: run the tests of both groups\. When they pass, accept the group without a fix subagent/);
  });

  // @scenario workflow/subagent-apply :: Collision with a group still running
  test('a collision with a running group waits for it, then both groups are tested', () => {
    assert.match(section(5), /In the area of a group whose subagent is still running: wait until that subagent ends, then run the tests of both groups before you accept either/);
  });

  // @scenario workflow/subagent-apply :: Collision with a group not started yet
  test('a collision with a group not started yet is accepted and the later subagent is told', () => {
    assert.match(section(5), /In the area of a group not started yet: accept the group, and tell that group's subagent, when you start it, which of its files were changed and by which group/);
  });

  // @scenario workflow/subagent-apply :: Collision with another group, tests fail twice
  test('a collision whose tests still fail after two fix subagents stops apply', () => {
    const s = section(5);
    assert.match(s, /When they fail, hand the fix to a new subagent, at most two fix attempts/);
    assert.match(s, /still fail after the second attempt, stop: do not accept the group, and show the developer the failing tests and both fix attempts/);
    assert.match(s, /A group with an open collision is not accepted/);
  });
});

describe('subagents protocol: accepting a group', () => {
  // @scenario workflow/subagent-apply :: Group accepted
  test('only the main agent checks off tasks, and only for accepted groups', () => {
    const s = section(6);
    assert.match(s, /Only you check off tasks in `tasks\.md`, and only after you have accepted their group/);
    assert.match(s, /check every task of the group; tasks of groups not yet accepted stay unchecked/);
    assert.match(s, /A subagent never edits `tasks\.md`/);
  });

  // @scenario workflow/subagent-apply :: First subagent breaks off
  test('an unfinished subagent is replaced once, with a note of the done tasks', () => {
    const s = section(6);
    assert.match(s, /not a stop of `openspec\/protocols\/apply\.md` §2 — a tool error, its context ran out, an incomplete result/);
    assert.match(s, /start one new subagent for the group's remaining tasks, with a note of the tasks already done/);
  });

  // @scenario workflow/subagent-apply :: Second subagent also breaks off
  test('when the replacement also breaks off the main agent stops and tells the developer', () => {
    assert.match(section(6), /When that subagent also ends without finishing, stop and tell the developer which tasks of the group remain and why both subagents ended/);
  });
});


describe('subagents protocol: stops', () => {
  // @scenario workflow/subagent-apply :: Requirement gap while another group runs
  test('on a requirement gap no new subagent starts, running groups finish, then the question is recorded and asked', () => {
    const s = section(7);
    assert.match(s, /A subagent cannot ask the developer\. When it reaches a stop of `openspec\/protocols\/apply\.md` §2, it ends and reports the stop to you; you ask the developer/);
    assert.match(s, /\*\*Requirement gap, consent, outside the plan\.\*\* Start no new subagent, let the running subagents finish their current group, then ask/);
    assert.match(s, /groups 2 and 3 run in parallel and group 2's subagent reports a requirement gap: start no new subagent, wait for group 3 to finish, append the question to the `## Apply round` of `clarifications\.md` and ask the developer/);
  });

  // @scenario workflow/subagent-apply :: Consent needed while another group runs
  test('a consent stop also waits for the running groups before asking for consent', () => {
    assert.match(section(7), /group 2's subagent reports that it needs to install a tool into the system: start no new subagent, wait for group 3 to finish and ask the developer for consent/);
  });

  // @scenario workflow/subagent-apply :: Failing test with independent groups left
  test('on a failing test independent groups are completed through subagents before the stop is shown', () => {
    const s = section(7);
    assert.match(s, /\*\*Failing test, environment\.\*\* First complete, through subagents, the groups that do not depend on the stopped group, then show the developer the stop/);
    assert.match(s, /a test of group 2 still fails after two fix attempts and group 4 does not depend on group 2: complete group 4 through a subagent, then show the failing test/);
  });

  // @scenario workflow/subagent-apply :: Failed start check
  test('a failed start check stops before any implementation subagent starts', () => {
    assert.match(section(7), /\*\*Failed start check\.\*\* The start check runs before any subagent starts\. When it fails, no implementation subagent starts: report what failed and offer the ways of `openspec\/protocols\/apply\.md` §4/);
  });

  test('apply.md §2 says that stops reach the developer through the main agent', () => {
    assert.match(protoSection('apply.md', 2), /On a change implemented through subagents, a subagent that reaches a stop ends and reports it, and the main agent asks the developer \(`openspec\/protocols\/subagents\.md` §7\)/);
  });
});

describe('subagents protocol: the final group', () => {
  // @scenario workflow/subagent-apply :: Final group
  test('the main agent runs the final group: test reviewer and apply-report.md itself, the full suite in a subagent', () => {
    const s = section(8);
    assert.match(s, /You run the final group yourself/);
    assert.match(s, /Start the `test-reviewer` subagent/);
    assert.match(s, /Hand the full suite to a new subagent/);
    assert.match(s, /Write `apply-report\.md`/);
  });

  // @scenario workflow/subagent-apply :: End-of-apply suite
  test('the full-suite subagent runs the suite and quality checks, fixes failures and reports commands and result', () => {
    assert.match(section(8), /it runs the project's full test suite and quality checks \(`openspec\/protocols\/testing\.md` §6\), fixes what fails and reports the commands and their result/);
  });

  // @scenario workflow/subagent-apply :: Fix after the test review
  test('a fix after the test review goes to a new subagent; the main agent edits no test or code', () => {
    const s = section(8);
    assert.match(s, /Hand the fix of each blocker or major finding to a new subagent; edit no test or code file yourself/);
    assert.match(s, /You write only the change's own files: `tasks\.md` check marks, `apply-report\.md`, `e2e\.md`, `clarifications\.md`\. Every other edit, including a small fix after the test review, after a check or in the E2E stage, goes to a new subagent/);
  });

  // @scenario workflow/subagent-apply :: Failing E2E test
  test('a failing E2E test is fixed by a new subagent and the main agent runs the E2E tests again', () => {
    assert.match(section(8), /every fix of a failing E2E test, in the application code or in the test, goes to a new subagent; after the fix, run the E2E tests again yourself/);
    assert.match(protoSection('e2e.md', 8), /On a change stamped 0\.5\.0 or later each fix attempt is made by a new subagent, and you run the tests again \(`openspec\/protocols\/subagents\.md` §8\)/);
    // each fix subagent makes one attempt; the attempts per test of e2e.md §8 are counted across subagents
    assert.match(section(8), /Each E2E fix subagent makes one fix attempt; the up to three attempts per test of `openspec\/protocols\/e2e\.md` §8 are counted across subagents/);
    // writing the E2E tests also goes to a task-implementer, and e2e.md §6 says so where the tests are written
    assert.match(protoSection('e2e.md', 6), /On a change stamped 0\.5\.0 or later the E2E tests are written by a `task-implementer` subagent \(`openspec\/protocols\/subagents\.md` §8\)/);
    assert.match(section(9), /\(a task group, a replacement, a collision fix, a review fix, the full suite, writing the E2E tests, an E2E fix\) is a `task-implementer` subagent/);
  });

  test('testing.md points to the subagents protocol during apply and at its end', () => {
    assert.match(protoSection('testing.md', 5), /On a change stamped 0\.5\.0 or later each task group is done by a subagent that follows this section \(`openspec\/protocols\/subagents\.md`\)/);
    assert.match(protoSection('testing.md', 6), /On a change stamped 0\.5\.0 or later the fixes and the full suite run in subagents \(`openspec\/protocols\/subagents\.md` §8\)/);
  });
});

describe('subagents protocol: models and the progress line', () => {
  test('every implementation subagent is a task-implementer told its limits', () => {
    const s = section(9);
    assert.match(s, /is a `task-implementer` subagent/);
    assert.match(s, /starts no other subagent, asks the developer nothing, edits no planning artifact and no `tasks\.md`/);
  });

  // @scenario workflow/subagent-apply :: Full-suite subagent ignores the setting
  test('only task groups and collision fixes get the model setting; the full suite runs on the main model', () => {
    const s = section(9);
    assert.match(s, /run `node openspec\/tooling\/bin\/subagent-model\.mjs`/);
    assert.match(s, /pass that model to the subagents of task groups, their replacements and collision fixes/);
    assert.match(s, /`inherit` means: pass no model, the subagent runs on the main chat's model/);
    assert.match(s, /When it also prints a `warning:` line, repeat it in the chat/);
    assert.match(s, /Every other subagent, among them the full suite, review fixes, E2E fixes and verify, runs on the main chat's model, whatever the setting/);
  });

  // @scenario workflow/subagent-apply :: Group finished, tests pass
  test('after each subagent one chat line names the group, tasks, model and test result', () => {
    const s = section(9);
    assert.match(s, /After each subagent ends, write one line in the chat: the group number and name \(for a subagent without a group `fix: <what>` or `full suite`\), the tasks done, the model it ran on, and whether its tests pass or which fail/);
    assert.match(s, /`2\. Order API — 2\.1–2\.4 — sonnet — tests pass`/);
    assert.match(s, /`## Subagent runs` of `apply-report\.md`/);
  });

  // @scenario workflow/subagent-apply :: Full-suite subagent finished
  test('the full-suite line starts with full suite and names the model and the result', () => {
    assert.match(section(9), /`full suite — — opus — every test passes`/);
  });

  // @scenario workflow/subagent-apply :: Group finished, tests fail
  test('the line of a group with failing tests names the failing tests', () => {
    assert.match(section(9), /`3\. Order screen — 3\.1–3\.3 — sonnet — 2 tests fail: shows total, hides empty cart`/);
  });
});

describe('subagents protocol: delegation outside apply', () => {
  // @scenario workflow/subagent-delegation :: Developer runs verify
  test('verify runs in the change-verifier subagent and the main agent shows its findings', () => {
    const s = section(10);
    assert.match(s, /On a change stamped 0\.5\.0 or later, verify .* runs in the `change-verifier` subagent/);
    assert.match(s, /reports its findings to you and changes no file\. Show the findings to the developer/);
    assert.match(s, /A change stamped below 0\.5\.0 or without a stamp is verified by you, as before/);
  });

  // @scenario workflow/subagent-delegation :: Verify finding is fixed
  test('a verify finding is fixed by a new subagent, not by the main agent', () => {
    assert.match(section(10), /Every fix that follows, for example of a scenario without implementation, goes to a new `task-implementer` subagent, not to you/);
  });

  // @scenario workflow/subagent-delegation :: Code study before the questions
  test('at other stages code reading may go to Explore, with the reason said in the chat first', () => {
    const s = section(11);
    assert.match(s, /At other stages .* you may hand reading and studying the project's code to a subagent, Claude Code's `Explore` subagent, and use its summary/);
    assert.match(s, /Before you start it, say in the chat why/);
  });

  // @scenario workflow/subagent-delegation :: Reading subagent proposes a decision
  test('the reading subagent describes every option and changes no planning artifact', () => {
    assert.match(section(11), /Ask it for a summary of what it found that describes every option it sees \(for example both possible places for a new module\), and decide yourself or ask the developer/);
    assert.match(section(11), /never decisions, answers to clarifying questions, or writing or editing a planning artifact/);
  });

  // @scenario workflow/subagent-delegation :: Protocol limits what is delegated
  test('only reading and studying code is delegated outside apply, never decisions or artifact edits', () => {
    const s = section(11);
    assert.match(s, /Only reading and studying code may be handed over: never decisions, answers to clarifying questions, or writing or editing a planning artifact \(`clarifications\.md`, `proposal\.md`, specs, `design\.md`, `verification-plan\.md`, `tasks\.md`, test cases\)/);
    assert.match(s, /The reviewer subagents keep writing only their review files/);
  });
});

describe('subagents protocol: config pointer', () => {
  test('the kit block of config-fragment.yaml points to the subagents protocol', () => {
    const frag = readFileSync(join(REPO, 'kit', 'config-fragment.yaml'), 'utf8');
    const block = frag.split('# >>> sdd-kit >>>')[1].split('# <<< sdd-kit <<<')[0];
    assert.match(block, /Apply and verify through subagents \(changes stamped 0\.5\.0 or later\): openspec\/protocols\/subagents\.md/);
  });
});

describe('subagent definitions', () => {
  /** Install the kit into a fresh folder and read one agent definition from `.claude/agents/`. */
  const installed = async (name) => {
    const root = mkdtempSync(join(tmpdir(), 'sdd-kit-subagents-'));
    const r = await install({ target: root, skipOpenspec: true, yes: true, json: true });
    const rel = `.claude/agents/${name}.md`;
    assert.ok(r.files.some((f) => f.rel === rel && f.op === 'create'), `${rel} is installed`);
    const text = readFileSync(join(root, rel), 'utf8');
    const fm = parseYaml(text.split('---\n')[1]).value;
    const body = text.split('---\n').slice(2).join('---\n');
    assert.equal(fm.name, name);
    assert.equal(fm.model, 'inherit');
    assert.ok(fm.description && fm.description.length > 40, `${name} description`);
    assert.ok(body.startsWith('<!-- sdd-kit: managed file.'), `${name} has the managed-file header`);
    assert.ok(existsSync(join(root, 'openspec/protocols/subagents.md')), 'the protocol it points to is installed');
    return { fm, tools: fm.tools.split(/,\s*/), body: flat(body) };
  };

  // @scenario workflow/subagent-apply :: Subagent definition states the limits
  test('task-implementer states its limits and ends with a Changed files: report', async () => {
    const { fm, tools, body } = await installed('task-implementer');
    assert.ok(tools.includes('Edit') && tools.includes('Write'), 'the implementer edits code');
    assert.ok(!tools.includes('Agent') && !tools.includes('Task'), 'the implementer has no tool to start subagents');
    assert.match(body, /Start no other subagent/);
    assert.match(body, /Ask the developer nothing/);
    assert.match(body, /Edit no planning artifact \(`clarifications\.md`, `proposal\.md`, specs, `design\.md`, `verification-plan\.md`, test cases\) and not `tasks\.md`/);
    assert.match(body, /`openspec\/protocols\/testing\.md`/);
    assert.match(body, /`openspec\/protocols\/subagents\.md`/);
    assert.match(body, /stop report/);
    // every stop of apply.md §2, not only some of them
    assert.match(body, /On any stop of `openspec\/protocols\/apply\.md` §2 \(requirement gap, test still failing after two attempts, environment, consent, outside the plan\), stop and write a stop report: what, why, what you need/);
    assert.match(fm.description, /writing the E2E tests/);
    assert.match(body, /`Changed files:`/);
  });

  // @scenario workflow/subagent-delegation :: Verify subagent changes nothing
  test('change-verifier has no Edit or Write tool, reports findings and changes no file', async () => {
    const { tools, body } = await installed('change-verifier');
    for (const t of ['Edit', 'Write', 'NotebookEdit', 'Agent', 'Task']) assert.ok(!tools.includes(t), `change-verifier must not have ${t}`);
    assert.ok(tools.includes('Read'), 'change-verifier reads the change and the code');
    assert.match(body, /Change no file/);
    assert.match(body, /Run only commands that read or test/);
    assert.match(body, /names every scenario without implementation/);
    assert.match(body, /report your findings to the main agent/);
  });
});
