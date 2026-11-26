// Text tests for the run rules of apply (change project-test-commands, design D-5, D-8): a task group and every fix
// subagent run only the test files of their work, wider runs happen once at the end by the main agent, a long run
// goes into the background, a command of `openspec/test-commands.md` that does not work is a stop, and a missing
// file or command never blocks the work. These tests read the kit texts (testing.md, apply.md, subagents.md,
// metarepo.md and the `task-implementer` definition) and check that each rule is stated where the agent reads it.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const kit = (...p) => readFileSync(join(REPO, 'kit', ...p), 'utf8');
// collapse line breaks so phrases may wrap; bold markers do not split a phrase
const flat = (s) => s.replace(/\*\*/g, '').replace(/\s+/g, ' ');
const protocol = (name) => kit('openspec', 'protocols', name);
/** The section `## <n>. …` of a protocol, up to the next `## ` outside a fence, flattened. */
const section = (name, n) => {
  const lines = protocol(name).split('\n');
  const start = lines.findIndex((l) => l.startsWith(`## ${n}. `));
  assert.ok(start >= 0, `section ${n} not found in ${name}`);
  let fence = false;
  const body = [];
  for (const line of lines.slice(start + 1)) {
    if (line.startsWith('```')) fence = !fence;
    if (!fence && line.startsWith('## ')) break;
    body.push(line);
  }
  return flat(body.join('\n'));
};
const implementer = () => flat(kit('claude', 'agents', 'task-implementer.md'));

describe('a task group runs only its own test files', () => {
  // @scenario workflow/test-runs :: Group runs its two test files
  test('a group runs its own test files with the one-file command, never a folder or the full suite', () => {
    const s = section('testing.md', 5);
    assert.match(s, /On a change stamped 0\.7\.0 or later a task group runs only its own test files: the test files it creates or changes and the existing test files of the code it changes, each with the one-file command of `openspec\/test-commands\.md` \(§8\), or with the project's instructions when the file has none/);
    assert.match(s, /It never runs a whole folder of tests or the full suite/);
    assert.match(s, /a group that changes `api\/orders\.py` and writes `api\/tests\/test_orders\.py`, in a folder `api\/tests\/` of 40 test files, runs `api\/tests\/test_orders\.py` and the existing test file of `api\/orders\.py`, each with the one-file command, and neither the folder `api\/tests\/` nor the full suite/);
    assert.match(implementer(), /Run only the test files of your work: on a task group the test files you create or change and the existing test files of the code you change/);
    assert.match(implementer(), /Never run a whole folder of tests or the full suite/);
  });

  // @scenario workflow/test-runs :: Fix after a failing own test
  test('after a fix of an own test the group reruns that file or only the failed tests, no wider run', () => {
    assert.match(section('testing.md', 5), /After a fix for a failing own test, rerun that test file, or only the failed tests with the failed-only command, and no wider run/);
  });
});

describe('fix subagents and wider runs', () => {
  // @scenario workflow/test-runs :: Review fix
  test('every fix subagent runs only the test files of its work; a review fix runs its one file', () => {
    const s = section('testing.md', 5);
    assert.match(s, /every other implementation subagent of apply \(a replacement, a collision fix, a review fix, a full-suite fix\) runs only the test files of its work, with the one-file or the failed-only command, and no folder or full-suite run/);
    assert.match(s, /a subagent that strengthens the assertions of `api\/tests\/test_orders\.py` after the test review runs `api\/tests\/test_orders\.py` with the one-file command and no wider run/);
    assert.match(s, /The subagents of the E2E stage keep running the E2E tests through `e2e-run\.mjs`/);
    assert.match(implementer(), /on a fix the test files of the fix, or only the failed tests/);
  });

  // @scenario workflow/test-runs :: Neighbouring test broken by a group
  test('a neighbouring test broken by a group is found by the main agent\'s full suite and goes to one fix subagent', () => {
    assert.match(section('testing.md', 5), /The tests outside the groups' own files \(the rest of a folder, the whole suite\) run only in the main agent's full-suite run at the end of apply \(§6\)/);
    assert.match(section('testing.md', 6), /Example: group 2 breaks a test in `api\/tests\/test_invoices\.py`, a file that is not its own: your full-suite run reports the failing test, and one fix subagent gets it with the failing output/);
  });

  // @scenario workflow/test-runs :: Fix subagent reruns only the failing tests
  test('the full-suite fix subagent reruns only the failing tests; the main agent runs the full suite again', () => {
    assert.match(section('testing.md', 6), /the fix subagent reruns only the failing tests \(that test file or the failed-only command\), never the full suite, and you run the failed commands again yourself/);
    assert.match(section('subagents.md', 8), /On a change stamped 0\.7\.0 or later the fix subagent reruns only the failing tests, never the full suite/);
    assert.match(implementer(), /the main agent runs it at the end/);
  });

  // @scenario workflow/test-runs :: No test is left out
  test('apply ends without a stop only after a last full-suite run that covered every test and passed', () => {
    assert.match(section('testing.md', 5), /No test is left out: the full suite at the end covers every test of the project/);
    assert.match(section('testing.md', 6), /Apply ends without a stop only when the full suite has run at least once and its last run covered every test of the project and passed/);
  });

  // @scenario workflow/test-runs :: Tests of two groups after a collision
  test('after a collision the main agent runs the own test files of both groups with the one-file command', () => {
    const s = section('subagents.md', 5);
    assert.match(s, /On a change stamped 0\.7\.0 or later the tests of both groups are the own test files of each group \(`openspec\/protocols\/testing\.md` §5\), each run with the one-file command, with no folder or full-suite run/);
    assert.match(s, /Example: group 3 changed a file in the area of the accepted group 2: run the own test files of group 2 and group 3 with the one-file command/);
  });
});

describe('a long run goes into the background', () => {
  const longRuns = () => section('testing.md', 5);

  // @scenario workflow/test-runs :: Full suite of 12 minutes
  test('a full suite of 12 minutes starts in the background and its result is read when it has ended', () => {
    const s = longRuns();
    assert.match(s, /A test run is long when its command's duration in `openspec\/test-commands\.md` is 2 minutes or more, or when it is wider than single test files \(the failed-only command, the full suite\) and no duration is written/);
    assert.match(s, /Start a long run with the Bash tool's background mode, end your step and read the result when the notice that it ended arrives/);
    assert.match(s, /Never start it as a foreground command, and never wait for it with repeated sleep-and-check commands/);
    assert.match(s, /a full suite written as `— 12 min` starts in the background, and its result is read when the run has ended/);
    assert.match(section('subagents.md', 8), /Start the full suite in the background when it is long \(`openspec\/protocols\/testing\.md` §5\) and read its result when the run has ended/);
  });

  // @scenario workflow/test-runs :: Short one-file run stays in the foreground
  test('a one-file run of 1 minute is not long and may run in the foreground', () => {
    assert.match(longRuns(), /a one-file command written as `— 1 min` is not long and runs in the foreground/);
  });

  // @scenario workflow/test-runs :: Failed-only run without a duration
  test('a failed-only run without a duration starts in the background', () => {
    assert.match(longRuns(), /a failed-only command without a duration starts in the background/);
    assert.match(implementer(), /Start a long run \(2 minutes or more written in the file, or a failed-only run without a duration\) in the background and wait for the notice that it ended; never wait with sleep-and-check commands/);
  });

  // @scenario workflow/test-runs :: One-file run of 3 minutes
  test('a one-file run of 3 minutes starts in the background', () => {
    assert.match(longRuns(), /a one-file command written as `— 3 min` starts in the background/);
  });
});

describe('changes started under earlier rules', () => {
  // @scenario workflow/test-runs :: Protocol limits the new rule to new changes
  test('testing.md limits the own-test-files rule to changes stamped 0.7.0 or later and keeps the earlier rule', () => {
    const s = section('testing.md', 5);
    assert.match(s, /On a change stamped 0\.7\.0 or later a task group runs only its own test files/);
    assert.match(s, /A change stamped below 0\.7\.0 or without the stamp keeps the earlier rule: run tests scoped to what you are changing; the full suite runs at the end/);
    assert.match(implementer(), /On a change stamped below 0\.7\.0 or without the stamp, run tests scoped to what you change/);
  });
});

describe('a missing file or command never blocks the work', () => {
  // @scenario workflow/test-commands :: No file at apply
  test('without the file the agent runs the instructions\' commands and proposes the file in the ready message', () => {
    const s = section('testing.md', 8);
    assert.match(s, /When the file is missing, holds `none`, or lacks the command you need, find the command in the project's instructions, as before, and go on: never stop for the file/);
    assert.match(s, /On a change stamped 0\.7\.0 or later, unless the file holds `none`, the ready message proposes the commands you used that the file lacks: a missing file, section or line/);
    assert.match(s, /write them only after the developer confirms/);
    assert.match(section('apply.md', 9), /On a change stamped 0\.7\.0 or later, unless `openspec\/test-commands\.md` holds `none`, the ready message also proposes the test commands you used that the file lacks \(a missing file, section or line\); write them only after the developer confirms/);
  });

  // @scenario workflow/test-commands :: One command missing
  test('a missing one-file line is taken from the README and proposed in the ready message', () => {
    assert.match(section('testing.md', 8), /a file with a `Full suite:` line and no `One file:` line, and a README that runs one file with `make test FILE=<path>`: run the file with the README's command, and the ready message proposes adding ``One file: `make test FILE=<file>` `` to the file/);
  });

  // @scenario workflow/test-commands :: File says none
  test('a file with the single line none gets no proposal in the ready message', () => {
    assert.match(section('testing.md', 8), /A file with the single line `none` gets no proposal/);
    assert.match(section('apply.md', 9), /unless `openspec\/test-commands\.md` holds `none`/);
  });

  // @scenario workflow/test-commands :: Repository without a section
  test('a repository without a section takes its commands from the instructions and the ready message proposes the section', () => {
    assert.match(section('testing.md', 8), /a `\[frontend\]` group in a root file with a section for `backend` only takes its commands from the meta-repository's instructions and goes on, and the ready message proposes a `## Repository: frontend` section with the commands it used/);
    assert.match(section('metarepo.md', 4), /A repository without a section is handled as a missing command: take its commands from the meta-repository's instructions, go on, and propose the section in the ready message/);
  });

  // @scenario workflow/test-commands :: Draft covers every declared clone
  test('a draft in a meta-repository has a section per declared clone and root only when it names its own commands', () => {
    const s = section('testing.md', 8);
    assert.match(s, /A draft has a section for every declared clone, and a `## Repository: root` section only when the root's instructions name test commands of the root itself/);
    assert.match(s, /Never write a commands file inside a clone/);
  });
});

describe('a command that does not work is a stop', () => {
  // @scenario workflow/test-commands :: Unknown flag
  test('a command rejected before any test runs stops the agent; the file stays unchanged', () => {
    const s = section('testing.md', 8);
    assert.match(s, /A command of the file does not work when the shell or the tool it calls rejects the command itself before the project's tests are loaded: the command is not found, an option is unknown, a task or target is missing/);
    assert.match(s, /Then stop \(`openspec\/protocols\/apply\.md` §2\): show the developer the command and its output, and wait\. Do not replace the command and do not edit the file on your own/);
    assert.match(s, /the one-file command ends with the error "unknown option --reuse-db" before any test runs: stop and show the developer the command and that error; `openspec\/test-commands\.md` stays unchanged/);
  });

  // @scenario workflow/test-commands :: Failing tests are not this stop
  test('a command that runs the tests and some fail is a failing test with fix attempts', () => {
    assert.match(section('testing.md', 8), /When the command runs the tests and some of them fail, those are failing tests, handled with the fix attempts of §7, not this stop/);
  });

  // @scenario workflow/test-commands :: Import error in the group's code
  test('an import error in the project\'s code is a failing test, not the stop for a command', () => {
    assert.match(section('testing.md', 8), /An error in the project's code or tests \(an import, syntax or collection error\), for example an import error in the file the group has just changed, is a failing test too: fix the code, not the command/);
    assert.match(implementer(), /Failing tests and errors in the project's code or tests \(an import, syntax or collection error\) are failing tests, not this stop/);
  });

  // @scenario workflow/test-commands :: Command from the instructions does not work
  test('a command found in the instructions that does not work is handled as before', () => {
    assert.match(section('testing.md', 8), /A command found in the project's instructions, not in the file, that does not work is handled as before: look for the right command in the instructions, and ask the developer once when you find none/);
  });

  // @scenario workflow/test-commands :: Developer gives the right command
  test('the corrected command from the developer is written into the file and the stopped work goes on', () => {
    assert.match(section('testing.md', 8), /When the developer answers with the corrected command, write it into the file and go on with the stopped work/);
  });

  // @scenario workflow/test-commands :: Subagent meets the broken command
  test('a subagent that meets the broken command ends with a stop report and the main agent asks', () => {
    assert.match(implementer(), /When a command of `openspec\/test-commands\.md` does not start the tests \(the command is not found, an option is unknown, a task or target is missing, before any test runs\), stop and write a stop report with the command and its output; do not replace the command or edit the file/);
    assert.match(section('subagents.md', 7), /Test command\. A subagent that meets a command of `openspec\/test-commands\.md` that does not start the tests ends and reports the stop/);
    assert.match(section('testing.md', 8), /A `task-implementer` subagent that meets such a command ends with a stop report; the main agent asks the developer \(`openspec\/protocols\/subagents\.md` §7\)/);
  });

  // @scenario workflow/autonomous-apply :: Test command of the file does not start
  test('apply.md lists the test command of the file as a stop: show the command and its output and wait', () => {
    const s = section('apply.md', 2);
    assert.match(s, /Test command: a command of the project's `openspec\/test-commands\.md` does not start the tests: the shell or the tool rejects the command itself before any test runs, for example the one-file command ends with "no rule to make target 'test'"\. Stop, show the developer the command and that output, and wait instead of running another command/);
    assert.match(s, /A run that loads the tests and fails is a failing test, not this stop \(`openspec\/protocols\/testing\.md` §8\)/);
  });
});

describe('independent work goes on before the stop for a command', () => {
  // @scenario workflow/test-commands :: Other repository's groups go on
  test('the main agent completes the groups that do not need the command, then shows the command and its output', () => {
    const s = section('subagents.md', 7);
    assert.match(s, /Handle it like the environment stop: let the running subagents finish, complete through subagents the groups that do not need that command and do not depend on the stopped group, then show the developer the command and its output/);
    assert.match(s, /Example: in a meta-repository the one-file command of the `backend` section does not work and a `\[frontend\]` group does not depend on the stopped `\[backend\]` group: complete the frontend group through a subagent, then show the developer the backend command and its output/);
    assert.match(section('apply.md', 2), /The same holds for a test command that does not work \(`openspec\/protocols\/subagents\.md` §7\)/);
  });

  // @scenario workflow/test-commands :: Every remaining group needs the command
  test('when every remaining group needs the command, no further group starts', () => {
    assert.match(section('subagents.md', 7), /When every remaining group needs the command, for example in a project with one repository where the one-file command does not work, start no further group and ask the developer/);
  });
});
