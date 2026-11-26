// Text tests for the step after the Main round and the rules of the test-commands file (change
// project-test-commands, design D-2, D-5, D-6, D-8): the planning protocol gets the section "After the Main round"
// (the drafts of the project files, the early start check and its failure), the `clarify` proposal instruction points
// to it, and the testing protocol describes `openspec/test-commands.md`. These tests read the kit text and check that
// each rule is stated where the agent reads it.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseYaml } from '../kit/openspec/tooling/lib/yaml.mjs';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const PROTOCOLS = join(REPO, 'kit', 'openspec', 'protocols');
const SCHEMAS = join(REPO, 'kit', 'openspec', 'schemas');
// collapse line breaks so phrases may wrap; bold markers do not split a phrase
const flat = (s) => s.replace(/\*\*/g, '').replace(/\s+/g, ' ');
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const protocol = (name) => readFileSync(join(PROTOCOLS, name), 'utf8');
/** The section `## <n>. <title>…` of a protocol text, up to the next `## ` outside a fence, flattened. */
const sectionOf = (text, title, name) => {
  const lines = text.split('\n');
  const start = lines.findIndex((l) => new RegExp(`^## \\d+\\. ${escape(title)}`).test(l));
  assert.ok(start >= 0, `section "${title}" not found in ${name}`);
  let fence = false;
  const body = [];
  for (const line of lines.slice(start + 1)) {
    if (line.startsWith('```')) fence = !fence;
    if (!fence && line.startsWith('## ')) break;
    body.push(line);
  }
  return flat(body.join('\n'));
};
const afterMain = () => sectionOf(protocol('planning.md'), 'After the Main round', 'planning.md');
const commandsFile = () => sectionOf(protocol('testing.md'), 'The test commands file', 'testing.md');
const schemaDoc = (schema) => parseYaml(readFileSync(join(SCHEMAS, schema, 'schema.yaml'), 'utf8')).value;
const proposalInstruction = (schema) => flat(schemaDoc(schema).artifacts.find((a) => a.id === 'proposal').instruction);

describe('after the Main round: who gets the step', () => {
  // @scenario workflow/test-commands :: First change of a project
  test('a clarify change stamped 0.7.0 shows the draft right after the Main round and waits before the proposal', () => {
    const s = afterMain();
    assert.match(s, /Applies only to `clarify` changes stamped with kit version 0\.7\.0 or later/);
    assert.match(s, /As soon as the Main round is closed, before you write the proposal, do these steps in order/);
    assert.match(s, /When `openspec\/project-tools` .* or `openspec\/test-commands\.md` .* is missing, draft the missing ones from the project's instructions/);
    assert.match(s, /Run `planning\.mjs wait` and end the turn/);
    assert.match(proposalInstruction('clarify'), /On a `clarify` change stamped 0\.7\.0 or later, before writing this file do the steps after the Main round of `openspec\/protocols\/planning\.md` §14: the drafts of the missing project files and the early start check/);
  });

  // @scenario workflow/test-commands :: File already exists
  test('a file that exists, with commands or with none, is not proposed', () => {
    assert.match(afterMain(), /When a file exists, with commands or with the line `none`, do not propose it/);
    assert.match(commandsFile(), /When the developer declines, write the single line `none` and do not propose the file in a later change/);
  });

  // @scenario workflow/test-commands :: Test-case schema change
  test('a change on a test-case schema writes the proposal without proposing the file', () => {
    assert.match(afterMain(), /A `lean` change, a change on `clarify-ai-qa` or `clarify-qa`, and a change stamped below 0\.7\.0 or without the stamp get none of these steps: write the proposal right after the Main round, propose no project file during planning/);
  });

  // @scenario workflow/test-commands :: Change stamped 0.6.1
  test('a change stamped below 0.7.0 gets no proposal of the file and takes the commands from the instructions', () => {
    assert.match(afterMain(), /Example: a change stamped 0\.6\.1 in a project without `openspec\/test-commands\.md`: write the proposal without proposing the file/);
    assert.match(commandsFile(), /A change stamped below 0\.7\.0 or without the stamp gets no proposal of the file: find the commands in the project's instructions/);
  });

  // @scenario workflow/test-commands :: Tool list and commands in one message
  test('both missing files are proposed in one message with one question, and the early check follows the answer', () => {
    const s = afterMain();
    assert.match(s, /show both drafts in one chat message, with one question: confirm, correct or decline/);
    assert.match(s, /2\. The early start check\./);
    assert.match(s, /After the developer's answer to the drafts, go on with the early start check, before the proposal/);
  });
});

describe('the test commands file: draft and confirmation', () => {
  // @scenario workflow/test-commands :: Developer confirms the draft
  test('the confirmed draft is written with exactly the confirmed commands', () => {
    const s = commandsFile();
    assert.match(s, /When the file is missing, draft it from the project's instructions \(README, CLAUDE\.md, Makefile, package scripts, CI configuration\), show the draft to the developer and write it only after the developer confirms/);
    assert.match(s, /Write exactly the confirmed commands/);
  });

  // @scenario workflow/test-commands :: Developer corrects the draft
  test('a correction of the developer goes into the written command', () => {
    assert.match(commandsFile(), /with the developer's corrections: when the developer answers that the full suite needs the flag `--reuse-db`, the `Full suite:` command carries `--reuse-db`/);
  });

  // @scenario workflow/test-commands :: Developer declines
  test('a decline writes the single line none and the file is never proposed again', () => {
    assert.match(commandsFile(), /When the developer declines, write the single line `none` and do not propose the file in a later change/);
    assert.match(commandsFile(), /The single line `none` means the developer declined the file: it holds no command/);
  });

  // @scenario workflow/test-commands :: Nothing written before the answer
  test('the file does not exist until the developer answers', () => {
    assert.match(commandsFile(), /until the developer answers, the file does not exist/);
    assert.match(afterMain(), /Write no file before the answer/);
  });

  // @scenario workflow/test-commands :: Quality checks stay in the instructions
  test('the file holds test commands only; a lint command of the README stays out of the draft', () => {
    const s = commandsFile();
    assert.match(s, /The file holds test commands only: no quality-check command \(lint, types, build\), no start or stop command and no address of the application/);
    assert.match(s, /A draft for a project whose README names `make test` and `make lint` holds `make test` and no line for `make lint`/);
  });
});

describe('the test commands file: durations', () => {
  // @scenario workflow/test-commands :: Duration from the developer
  test('a duration the developer names at the confirmation is written as whole minutes', () => {
    assert.match(commandsFile(), /A duration comes from the project's instructions or from the developer's words at the confirmation: when the developer says that the full suite takes about 12 minutes, the `Full suite:` line ends with `— 12 min`/);
  });

  // @scenario workflow/test-commands :: Unknown duration
  test('without a named duration the line has none', () => {
    assert.match(commandsFile(), /When neither names a duration, the line has none/);
  });

  // @scenario workflow/test-commands :: No test run while drafting
  test('no test command runs while the file is drafted', () => {
    assert.match(commandsFile(), /Run none of the project's test commands while you draft the file, not even to measure a duration/);
    assert.match(afterMain(), /run none of the project's test commands while you draft/);
  });

  // @scenario workflow/test-commands :: A slower real run changes nothing
  test('a duration is never updated from a real run', () => {
    assert.match(commandsFile(), /A duration is written once: never update it from a real run\. A full suite written as `— 12 min` that takes 20 minutes stays `— 12 min`/);
  });
});

describe('the testing protocol names the file first', () => {
  test('the header paragraph names the commands file first and the instructions as the fallback', () => {
    const header = flat(protocol('testing.md').split(/\n## 1\. /)[0]);
    assert.match(header, /Use the project's own commands: first those of `openspec\/test-commands\.md` \(§8\), then the project's instructions \(README, CLAUDE\.md, Makefile, package scripts, CI config\)/);
  });
});

describe('the early start check right after the Main round', () => {
  // @scenario workflow/environment-check :: Change that does not need the application
  test('the early check runs even when the change may not need a running application', () => {
    assert.match(afterMain(), /run the start check .* even when the change may not need a running application \(a change that only renames a field in a report\)/);
  });

  // @scenario workflow/environment-check :: No start instructions
  test('without a start command the early check is skipped without a question', () => {
    assert.match(afterMain(), /When the instructions name no start command or no address, skip the check without a question: ask nothing about it and go on with the proposal/);
  });

  // @scenario workflow/environment-check :: Start command without an address
  test('a start command without an address skips the early check too', () => {
    const s = afterMain();
    assert.match(s, /When the project's instructions name both the command that starts the application and an address it serves, run the start check/);
    assert.match(s, /When the instructions name no start command or no address, skip the check without a question/);
  });

  // @scenario workflow/environment-check :: Test-case schema change
  test('a test-case schema change has no early check; the check stays at the start of apply', () => {
    assert.match(afterMain(), /propose no project file during planning, and leave the start check to the beginning of apply \(`openspec\/protocols\/apply\.md` §4\)/);
  });

  // @scenario workflow/environment-check :: Meta-repository
  test('in a meta-repository the early check uses the one command run from the root', () => {
    assert.match(afterMain(), /In a meta-repository use the one command the instructions name to start, from the root, every clone the application needs, and run it from the root/);
  });
});

describe('a failed early start check stops planning', () => {
  // @scenario workflow/environment-check :: Ports refused during planning
  test('the agent reports the failure, offers the two ways and writes no proposal until the developer chooses', () => {
    const s = afterMain();
    assert.match(s, /A failed early start check\. Write no further artifact\. Report what failed, from the script's output \(for example the published ports are refused\), and offer two ways: fix the cause and run the check again, or go on with planning without a passed check/);
    assert.match(s, /Never pick a way yourself: run `planning\.mjs wait` and end the turn/);
    assert.match(s, /The ways about E2E and the integration checks .* belong to a failed check before the first task only; do not offer them here/);
  });

  // @scenario workflow/environment-check :: Developer fixes the cause
  test('after the fix the check runs again and a pass lets the proposal be written', () => {
    assert.match(afterMain(), /Fix the cause: when the developer says the cause is fixed, run the start check again; when it passes, write the proposal/);
  });

  // @scenario workflow/environment-check :: Developer goes on without a passed check
  test('going on writes the proposal and leaves the check to the start of apply', () => {
    assert.match(afterMain(), /Go on: write the proposal\. The record stays failed, so before the first task of apply the start check runs again when the plan needs a running application/);
  });
});

describe('the project tool list right after the Main round', () => {
  // @scenario workflow/environment-check :: Agent proposes the list
  test('on a clarify change stamped 0.7.0 the list is proposed right after the Main round, also when the check is skipped', () => {
    const s = afterMain();
    assert.match(s, /The tool list is settled here, right after the Main round, also when the early start check is skipped/);
    assert.match(s, /Write no file before the answer/);
  });

  // @scenario workflow/environment-check :: Developer declines the list
  test('a declined draft is written as the single line none', () => {
    assert.match(afterMain(), /on a decline the single line `none`/);
  });
});

describe('planning stops and the round closing name the step', () => {
  test('the stops table and the closing of a round point to the step after the Main round', () => {
    const planning = protocol('planning.md');
    assert.match(sectionOf(planning, 'Where planning stops', 'planning.md'), /the developer's answer to the drafts of the project files, or the choice after a failed early start check \(§14\) \| run `planning\.mjs wait`/);
    assert.match(sectionOf(planning, 'Question rounds', 'planning.md'), /after the Main round of a `clarify` change stamped 0\.7\.0 or later, do the steps of §14 first/);
  });
});
