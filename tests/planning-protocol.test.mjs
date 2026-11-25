// Text tests for the planning protocol (change streamline-planning): the agent's planning rules for changes stamped
// 0.6.0 or later on `clarify` and `lean` live in openspec/protocols/planning.md (design D-5, D-9). These tests read
// the kit text and check that each rule is stated where the agent reads it.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseYaml } from '../kit/openspec/tooling/lib/yaml.mjs';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const PROTOCOLS = join(REPO, 'kit', 'openspec', 'protocols');
const FILE = join(PROTOCOLS, 'planning.md');
const RAW = existsSync(FILE) ? readFileSync(FILE, 'utf8') : '';
// collapse line breaks so phrases may wrap; bold markers do not split a phrase
const flat = (s) => s.replace(/\*\*/g, '').replace(/\s+/g, ' ');
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Fenced examples removed, so `## ` inside a fence is not a section. */
const prose = (text) => text.replace(/```[\s\S]*?```/g, '');
/** The section `## <n>. <title>…` of a protocol text, up to the next `## `, flattened. */
const sectionOf = (text, title, name) => {
  const m = prose(text).match(new RegExp(`\\n## \\d+\\. ${escape(title)}[^\\n]*\\n([\\s\\S]*?)(?=\\n## |$)`));
  assert.ok(m, `section "${title}" not found in ${name}`);
  return flat(m[1]);
};
const section = (title) => sectionOf(RAW, title, 'planning.md');
/** The text before the first numbered section. */
const intro = () => flat(prose(RAW).split(/\n## 1\. /)[0]);
const protocol = (name) => readFileSync(join(PROTOCOLS, name), 'utf8');

describe('planning protocol: who it applies to', () => {
  test('the protocol is a managed kit file that applies to clarify and lean changes stamped 0.6.0 or later', () => {
    assert.ok(RAW.startsWith('<!-- sdd-kit: managed file.'), 'planning.md missing or without the managed-file header');
    const s = intro();
    assert.match(s, /Applies to changes on the `clarify` and `lean` schemas stamped with kit version 0\.6\.0 or later \(`x-sdd-kit` in the change's `\.openspec\.yaml`; a pre-release such as `0\.6\.0-beta\.1` counts as its base version\)/);
    assert.match(s, /A change without the stamp, a change stamped below 0\.6\.0, and every change on `clarify-ai-qa` or `clarify-qa` keep their rules/);
  });
});

describe('planning protocol: the automatic continuation and its stops', () => {
  // @scenario workflow/planning-flow :: First artifact follows the creation
  test('the first artifact is written in the same turn as the creation of the change', () => {
    const s = section('Planning goes on by itself');
    assert.match(s, /Right after you create a change, write its first artifact in the same turn, without waiting for a command: on `clarify` the clarifications file with the first questions/);
  });

  // @scenario workflow/planning-flow :: Developer still runs the command
  test('the agent never tells the developer to run /opsx:continue and treats the command like no command', () => {
    const s = section('Planning goes on by itself');
    assert.match(s, /Never tell the developer to run `\/opsx:continue`, at any point of planning/);
    assert.match(s, /When the developer runs it anyway, write the next artifact and go on with the ones after it as without the command/);
    assert.match(s, /`Stop` hook `openspec\/tooling\/hooks\/planning-continue\.mjs` keeps the turn going/);
  });

  // @scenario workflow/planning-flow :: Question during a pause
  test('during a pause the agent answers the developer, writes no artifact and ends its turn', () => {
    const s = section('Wait, pause and resume');
    assert.match(flat(RAW), /node openspec\/tooling\/bin\/planning\.mjs pause --change <name>/);
    assert.match(s, /when the developer tells you in plain words to stop or pause[^.]*, run it and end your turn/);
    assert.match(s, /While planning is paused, answer the developer's messages, questions included \("why is the export in scope\?"\), write no artifact of the change and end your turn after each answer/);
    assert.match(s, /when the developer tells you in plain words to go on \("go on", "continue"\), run it and write the next artifact/);
  });

  // @scenario workflow/planning-flow :: Check passes after a fix
  test('a check that passes after a fix lets the agent go on without asking', () => {
    const s = section('A failing artifact check');
    assert.match(s, /Fix the cause yourself and go on, without asking the developer: when the check passes after a fix, write the next artifact/);
    assert.match(s, /When the check still reports errors after your second fix attempt, or the write is still blocked after your second attempt, stop: run `planning\.mjs wait`, write no further artifact, and show the developer the remaining errors of the check/);
  });

  // @scenario workflow/planning-flow :: Write blocked by a cause only the developer can remove
  test('a write blocked by a file only the developer can replace stops after two attempts and names the file', () => {
    const s = section('A failing artifact check');
    assert.match(s, /A cause only the developer can remove counts the same/);
    assert.match(s, /after the second blocked attempt, name the `\.svg` file and ask the developer to export it as PNG, JPG or WebP/);
    assert.match(s, /A block by an open question is a wait, not an attempt/);
  });
});

describe('planning protocol: spec review findings', () => {
  // @scenario workflow/planning-flow :: Finding fixed without the developer
  test('a finding the answers settle is fixed without asking the developer', () => {
    const s = section('Spec review findings');
    assert.match(s, /Fix what the answers, the sources and the existing specs settle\. Rewrite the spec yourself and do not ask the developer what to do with the finding/);
    assert.match(s, /a scenario's outcome says "properly saved" without a value, and an answer names the saved value: rewrite the scenario with that value/);
  });

  // @scenario workflow/planning-flow :: Finding that needs a requirements decision
  test('a finding that needs a requirements decision becomes a Technical round question and the turn ends', () => {
    const s = section('Spec review findings');
    assert.match(s, /A finding that needs a decision about the requirements becomes a question\. Add it to the Technical round with a blank `\[Answer\]:`[^.]*, and end the turn/);
  });

  // @scenario workflow/planning-flow :: Older change waits for the developer
  test('an earlier change shows the review findings to the developer and waits', () => {
    assert.match(intro(), /the spec review findings shown to the developer, who decides \(`openspec\/protocols\/review-specs\.md`\)/);
    assert.match(section('Spec review findings'), /[Oo]n a change stamped below 0\.6\.0 or without the stamp, show the verdict and the findings to the developer and wait for the decision/);
  });

  // @scenario workflow/planning-flow :: Second run finds a requirements gap
  test('a requirements gap found by the second run is asked and the design waits', () => {
    const s = section('Spec review findings');
    assert.match(s, /Two runs at most\. After you have fixed the findings of the first run, run the spec reviewer once more on the same specs; never a third time/);
    assert.match(s, /Findings of the second run: fix them too, without a further run\. One that needs a decision about the requirements becomes a Technical round question as above: the turn ends and the design is not written until it is answered/);
  });

  // @scenario workflow/planning-flow :: Finding the agent cannot fix
  test('a finding the agent cannot fix goes into the digest and planning goes on with the design', () => {
    assert.match(section('Spec review findings'), /One you cannot fix \(for example two requirements overlap and merging them would change their meaning\) is listed in the digest[^.]*, and planning goes on with the design/);
    assert.match(section('The digest'), /the review findings you could not fix/);
  });
});

describe('planning protocol: the digest and the end of planning', () => {
  // @scenario workflow/planning-flow :: Digest is printed and planning goes on
  test('the digest is printed in the questions language and planning goes on without a reply', () => {
    const s = section('The digest');
    assert.match(s, /When the spec review is settled[^.]*, print a digest in the chat and go on to the design in the same turn, without waiting for a reply/);
    assert.match(s, /At most 15 lines, in the questions language/);
    assert.match(s, /what will be built: the capabilities and their main rules/);
    assert.match(s, /what is deliberately left out/);
    assert.match(s, /the decisions you made yourself so far/);
    assert.match(s, /No scenario counts/);
    assert.match(s, /`lean` has no digest/);
  });

  // @scenario workflow/planning-flow :: Digest without own decisions
  test('a digest without own decisions says there are none', () => {
    assert.match(section('The digest'), /When every decision came from an answer, say that there are none; do not leave the part out/);
  });

  // @scenario workflow/planning-flow :: Twenty own decisions
  test('a digest that cannot hold every decision shows the visible ones first, the number of the others and proposal.md', () => {
    assert.match(section('The digest'), /When your own decisions do not fit into the 15 lines, show those that change the behaviour a user sees first, then the number of the others[^,]*, and name `proposal\.md`, whose `## Assumptions & Open Questions` lists them all/);
  });

  // @scenario workflow/planning-flow :: Planning is complete
  test('the end of planning names /opsx:apply, recommends /clear or a new chat and starts no task', () => {
    const s = section('The end of planning');
    assert.match(s, /When the last planning artifact \(`tasks\.md`\) is written, end the turn with a message that says apply can start, names `\/opsx:apply`, and strongly recommends running `\/clear` or opening a new chat before it/);
    assert.match(s, /Do not start apply yourself and start no task of the change/);
  });
});

describe('planning protocol: the question rounds', () => {
  test('questions.md points changes stamped 0.6.0 or later on clarify to planning.md', () => {
    const q = flat(prose(protocol('questions.md')).split(/\n## 1\. /)[0]);
    assert.match(q, /On a change on `clarify` stamped with kit version 0\.6\.0 or later \(`x-sdd-kit` in its `\.openspec\.yaml`\), follow `openspec\/protocols\/planning\.md` first/);
    assert.match(q, /A change stamped below 0\.6\.0 or without the stamp, and every change on `clarify-ai-qa` or `clarify-qa`, follows this protocol unchanged/);
  });

  test('a round is closed when it holds a question or "No questions." and no blank answer, without a summary', () => {
    const s = section('Question rounds');
    assert.match(s, /A round is closed when its section exists, holds at least one question or the line `No questions\.`, and no question in it has a blank answer \(follow-ups included\)\. No summary confirmation is asked/);
    assert.match(s, /When you find nothing to ask in a round, write its section with the single line `No questions\.`: the round is closed, go on/);
  });

  // @scenario questions/rounds :: Design is written without a round of its own
  test('there is no Design round and the design is written without a round of its own', () => {
    const s = section('Question rounds');
    assert.match(s, /There is no Design round and no Verification round/);
    assert.match(s, /`design\.md` is still always written, after the specs, without a round of its own/);
  });

  // @scenario questions/rounds :: Design fork is asked in the Technical round
  test('the Technical round asks the design forks together with the completeness of the specs', () => {
    assert.match(section('Question rounds'), /The Technical round, before the spec files, asks about the completeness of the specs and the design forks: choices that would change the specs, the approach or the task breakdown, such as a new table or a new column of an existing one/);
  });

  // @scenario questions/rounds :: Requirement gap during the implementation
  test('a requirement gap found in apply goes into the Apply round', () => {
    assert.match(section('Question rounds'), /During the implementation, a requirement gap \(behaviour that no answer, source or spec decides\) goes into the `## Apply round` of `clarifications\.md`/);
  });

  // @scenario questions/rounds :: Verification plan without questions
  test('the verification plan is written without questions and records its assumptions', () => {
    assert.match(section('Question rounds'), /Write `verification-plan\.md` without a question to the developer\. Decide yourself which scenarios are critical, which test data they need and which environment the checks need, and record these decisions in the plan as assumptions/);
  });
});

describe('planning protocol: the answer mode', () => {
  // @scenario questions/rounds :: Second round does not ask again
  test('the recorded answer mode is used for later rounds without asking again', () => {
    const s = section('The answer mode');
    assert.match(s, /Ask once per change, before the first batch of questions/);
    assert.match(s, /Use the recorded mode for every later batch, the Technical round and the Apply round included, without asking again/);
    assert.match(s, /With `Answer mode: file`, give the file path after you have written the questions and wait/);
  });

  // @scenario questions/rounds :: New chat does not ask again
  test('a new chat reads the recorded answer mode', () => {
    assert.match(section('The answer mode'), /In a new chat too, read the `Answer mode:` line and do not ask again/);
  });

  // @scenario questions/rounds :: Developer switches the mode
  test('the developer switches the mode in plain words and the record is updated', () => {
    const s = section('The answer mode');
    assert.match(s, /The developer may name another mode at any time \("ask me here instead"\): update the line \(`Answer mode: chat`\) and use the new mode from the next batch on/);
    for (const mode of ['chat', 'file', 'discussion']) assert.match(s, new RegExp(`\`Answer mode: ${mode}\``));
  });
});

describe('planning protocol: a changed answer', () => {
  test('the answers lock is written by the kit and a changed answer stops planning', () => {
    const s = section('A changed answer');
    assert.match(s, /`answers-lock\.json` in the change folder, written by the kit when an artifact is written[^.]*\. Never write or edit it/);
    assert.match(s, /An answer counts as changed when its text differs, spaces at its ends ignored/);
    assert.match(s, /Warn the developer: which question changed and which artifacts no longer match\. Write no further artifact and end the turn/);
    assert.match(s, /restores the earlier answer: the block is gone; go on without updating anything/);
  });

  // @scenario questions/rounds :: Developer asks to update
  test('on "update" the agent rewrites the named artifacts in order and goes on', () => {
    assert.match(section('A changed answer'), /tells you to update: rewrite the named artifacts from the new answer, in order \(proposal, specs, design, verification plan, tasks\), then go on with the next artifact/);
  });

  // @scenario questions/rounds :: Answer changed during apply
  test('apply starts no task while an answer differs from the written artifacts', () => {
    assert.match(section('A changed answer'), /During apply\. Before the first task, before each task group, and whenever the developer tells you to go on, run `node openspec\/tooling\/checks\/check-answers\.mjs --change <name>`\. While it reports a changed answer, start no task: warn the developer, naming the questions and the artifacts, and wait until they tell you to update the artifacts or restore the answer/);
  });

  test('specs rewritten for a changed answer get one more review and a new digest', () => {
    assert.match(section('A changed answer'), /After you have rewritten the specs for a changed answer, run the spec reviewer once more on them[^.]*, fix its findings without a further run, and print the digest again/);
  });
});

describe('planning protocol: mockups and the UI decisions', () => {
  const ui = () => flat(prose(protocol('ui-inventory.md')));

  // @scenario ui-sources/screenshots :: Yes without screenshots stops until continue
  test('earlier changes keep /opsx:continue after "yes"; changes under planning.md wait for the developer\'s word', () => {
    const s = ui();
    assert.match(s, /tell the developer to export every screen and state as PNG, JPG or WebP into it .*?, and to run `\/opsx:continue` when all are there\. Then stop: write no other question and no artifact/);
    assert.match(s, /On a change on `clarify` or `lean` stamped with kit version 0\.6\.0 or later, the developer says when the screenshots are in place instead of running `\/opsx:continue` \(`openspec\/protocols\/planning\.md` §8\)/);
  });

  // @scenario ui-sources/screenshots :: Empty folder on continue is asked again
  test('continuing with an empty folder asks once more, on earlier and on new changes', () => {
    assert.match(ui(), /Continued with an empty folder: ask once more — wait for the screenshots, or continue without mockups/);
    assert.match(section('Mockups and the UI decisions'), /"Done" with the folder still empty: ask once more whether to wait for the screenshots or to continue without mockups, before writing anything else/);
  });

  // @scenario ui-sources/screenshots :: Lean asks about mockups before the proposal
  test('lean asks about mockups in the chat before the proposal and records the answer in it', () => {
    assert.match(ui(), /`lean`: ask the same in chat before the proposal and record it under `## Clarifications` of the proposal/);
    assert.match(section('Mockups and the UI decisions'), /On `lean`, ask in the chat before the proposal whether the change has UI mockups, run `planning\.mjs wait`, end the turn, and record the answer under `## Clarifications` of the proposal/);
  });

  // @scenario ui-sources/screenshots :: Yes on a new change waits for the developer's word
  test('"yes" on a new change asks the developer to say when the screenshots are in place, without /opsx:continue', () => {
    assert.match(section('Mockups and the UI decisions'), /"Yes" to the mockups question: create `sources\/ui\/`, name the accepted formats \(PNG, JPG or WebP[^)]*\), and ask the developer to put the screenshots there and to say when they are in place \("done"\)\. Do not name `\/opsx:continue`\. Write no other question and no artifact, and end the turn/);
  });

  // @scenario ui-sources/screenshots :: Screenshots in place on a new change
  test('"done" with the screenshots in place goes on with the UI inventory', () => {
    assert.match(section('Mockups and the UI decisions'), /"Done" with the screenshots in place: go on with the UI inventory \(`openspec\/protocols\/ui-inventory\.md` §2–§5\)/);
  });

  // @scenario ui-sources/screenshots :: Done with an empty folder on a new change
  test('"done" with an empty folder asks whether to wait or to go on without mockups and records the reply', () => {
    assert.match(section('Mockups and the UI decisions'), /before writing anything else; record the reply as a follow-up question in the same round \(on `lean`: under `## Clarifications` of the proposal\)/);
  });

  // @scenario ui-sources/inventory :: Decisions are shown before the proposal on a new change
  test('the UI decisions are shown in a message before the proposal, without waiting for a reply', () => {
    assert.match(section('Mockups and the UI decisions'), /When the Main round is closed and every inventory element has its decision, write a short message to the developer that names every element with its decision, screen by screen \(for example `export-button — in scope`, `search-field — existing`\), then write the proposal in the same turn, without waiting for a reply/);
    assert.match(ui(), /on a `clarify` change stamped 0\.6\.0 or later, which has no round summary, in a short message before the proposal \(`openspec\/protocols\/planning\.md` §8\)/);
  });
});

// --- Recommendations and depth levels (task group 7): the rules live in planning.md §12 and §13; the clarify
// schema's clarifications instruction points to them for changes stamped 0.6.0 or later. ----------------------

const schemaInstruction = (schema, id) => {
  const yaml = readFileSync(join(REPO, 'kit', 'openspec', 'schemas', schema, 'schema.yaml'), 'utf8');
  const doc = parseYaml(yaml).value;
  return flat(doc.artifacts.find((a) => a.id === id).instruction);
};

describe('planning protocol: recommendations', () => {
  // @scenario questions/recommendations :: Recommendation from the code
  test('a recommendation rests on a source, a spec or the code, and its reason names that basis', () => {
    const s = section('Recommendations');
    assert.match(s, /A question names the option you recommend when a registered source, an existing spec or the project's code supports it; the reason names that basis/);
    assert.match(s, /the code already limits report exports to accountants: `Recommended: A — the existing export rule in the code lets only accountants export reports`/);
    assert.match(s, /as `Recommended: <option letters, comma-separated> — <reason>`/);
  });

  // @scenario questions/recommendations :: No basis, no recommendation
  test('a question without a basis in a source, a spec or the code carries no recommendation', () => {
    const s = section('Recommendations');
    assert.match(s, /When no source, spec or code decides it \(a business rule only the developer knows\), write no recommendation: your background knowledge and common practice are not a basis/);
  });

  // @scenario questions/recommendations :: Several recommended options
  test('a multi-select question may recommend several options, the reason naming the document', () => {
    const s = section('Recommendations');
    assert.match(s, /A question that allows several answers \(`\(select all that apply\)`\) may recommend several options: `Recommended: A, B — the requirement document names accountants and administrators`/);
  });

  // @scenario questions/recommendations :: Older change has no recommendations
  test('a change stamped below 0.6.0 or without the stamp gets no recommendation', () => {
    const s = section('Recommendations');
    assert.match(s, /A change stamped below 0\.6\.0 or without the stamp, and every change on `clarify-ai-qa` or `clarify-qa`, gets no recommendation: write its questions without a `Recommended:` line and name no recommended option in the chat/);
  });

  // @scenario questions/recommendations :: Test-case schema has no recommendations
  test('a change on a test-case schema gets no recommendation, and the shared instruction says so', () => {
    assert.match(section('Recommendations'), /every change on `clarify-ai-qa` or `clarify-qa`, gets no recommendation/);
    for (const schema of ['clarify-ai-qa', 'clarify-qa']) {
      assert.match(schemaInstruction(schema, 'clarifications'), /Changes on `clarify-ai-qa` or `clarify-qa`, and changes stamped below 0\.6\.0 or without the stamp, keep the rules below: no `Recommended:` line/, schema);
    }
  });

  // @scenario questions/recommendations :: Batch of questions in the chat
  test('in the chat each question is asked with its own options and no choice accepts all recommendations', () => {
    const s = section('Recommendations');
    assert.match(s, /In the chat, show the recommendation with its question: mark the recommended option `\(recommended\)` and give the reason/);
    assert.match(s, /Each question of a batch is asked with its own options\. Never offer an option or a question that accepts the recommendations of several questions at once/);
  });

  // @scenario questions/recommendations :: Developer asks to accept everything
  test('"take all your recommendations" fills in no answer and the developer is asked to answer each question', () => {
    const s = section('Recommendations');
    assert.match(s, /When the developer asks in free text to accept all recommendations \("just take all your recommendations"\), fill in no answer: say that every question needs its own answer and ask the developer to answer each question/);
    assert.match(s, /Leave `\[Answer\]:` blank until the developer answers, whatever the question recommends/);
  });
});

describe('planning protocol: depth levels', () => {
  // @scenario questions/depth :: Level not chosen
  test('without the starter menu the level is medium, written as "Depth: medium"', () => {
    const s = section('Depth levels');
    assert.match(s, /Record the level as the line `Depth: <level>` when you write the clarifications file: the level the developer chose in the starter menu, otherwise `Depth: medium`/);
    assert.match(s, /`lean` has no depth level/);
    assert.match(schemaInstruction('clarify', 'clarifications'), /write the line `Depth: <level>` under the title: the level the developer chose in the starter menu, otherwise `Depth: medium`/);
  });

  // @scenario questions/depth :: High level finds an affected module
  test('high also investigates the code affected outside the touched area, the lenses and the likely QA bugs', () => {
    const s = section('Depth levels');
    assert.match(s, /`high`: also the code affected outside that area \(for example a separate permissions module that decides who sees lists\), every requirement under the lenses roles, states, errors, boundaries, concurrent use and existing data, and the bugs QA would likely file after the release/);
  });

  // @scenario questions/depth :: Low level asks from the sources only
  test('low investigates the sources and the description only, and nothing cites the code or a spec', () => {
    const s = section('Depth levels');
    assert.match(s, /`low`: the registered sources and the developer's description\. No question and no recommendation of the round names the project's code or an existing spec as its basis/);
  });

  // @scenario questions/depth :: Medium level reads the touched area
  test('medium also reads the existing specs and the code of the touched area and does not ask what they settle', () => {
    const s = section('Depth levels');
    assert.match(s, /`medium`: also the existing specs and the code of the area the change touches\. Do not ask what they settle: when the existing export spec limits a file to 10 000 rows, do not ask what the row limit is/);
  });

  // @scenario questions/depth :: Low level settles what the user does not see
  test('low settles every decision that does not change visible behaviour and lists it as an assumption', () => {
    const s = section('Depth levels');
    assert.match(s, /`low`: every decision that does not change the behaviour a user sees, such as how often a cached report total is recalculated/);
    assert.match(s, /Every decision you settle yourself is an `\[assumption\]` entry/);
  });

  // @scenario questions/depth :: Low level asks about visible behaviour
  test('low asks every decision that changes visible behaviour, the sort order of a list included', () => {
    assert.match(section('Depth levels'), /On `low` ask every decision that changes the behaviour a user sees, such as the order in which a list is sorted/);
  });

  // @scenario questions/depth :: Medium level settles a visible detail
  test('medium also settles minor details of visible behaviour: an order, a label, a default value', () => {
    assert.match(section('Depth levels'), /`medium`: also minor details of visible behaviour \(an order, a label, a default value\), such as the order in which a list is sorted/);
  });

  // @scenario questions/depth :: Medium level asks about permissions
  test('medium asks every decision about permissions, money and data, visible or not', () => {
    assert.match(section('Depth levels'), /On `medium` ask every decision about permissions, money and data, visible or not: who may delete a record/);
  });

  // @scenario questions/depth :: Medium level asks about data the user does not see
  test('medium asks about data the user does not see, such as the storage period of an export file', () => {
    assert.match(section('Depth levels'), /On `medium` ask every decision about permissions, money and data, visible or not: [^.]*how long a generated export file is kept in storage/);
  });

  // @scenario questions/depth :: Decision made while writing the specs
  test('a decision made while writing the specs is added to the proposal\'s assumptions', () => {
    const s = section('Depth levels');
    assert.match(s, /in the proposal's `## Assumptions & Open Questions` when you make it before or while the proposal or the specs are written: a decision made while writing the specs \(a list sorted by date\) is added to the proposal's assumptions after the specs are written/);
    assert.match(s, /a later decision goes into the assumptions of the design or of the verification plan/);
  });

  // @scenario questions/depth :: High level asks about the storage period
  test('high asks every decision that no source, spec or code settles', () => {
    const s = section('Depth levels');
    assert.match(s, /`high`: nothing that no source, spec or code settles/);
    assert.match(s, /On `high` ask every decision that no source, spec or code settles, such as how long a generated export file is kept/);
  });

  // @scenario questions/depth :: Reason names the dependent rule
  test('on every level the "Why this is asked:" line says what in the specs depends on the answer', () => {
    const s = section('Depth levels');
    assert.match(s, /On every level the `Why this is asked:` line says what in the specs depends on the answer \(a question about who may export a report: "this decides the permission rule for the export"\)\. A question for which you cannot say it is not asked/);
  });

  // @scenario questions/depth :: High level names the finding
  test('on high the "Why this is asked:" line also names the finding that raised the question', () => {
    assert.match(section('Depth levels'), /On `high` the line also names the finding that raised the question: the place in the code, the source or the spec \("the existing export spec limits exports to accountants; this decides the permission rule for the new report"\)/);
  });

  // @scenario questions/depth :: Consequence of a narrowed permission
  test('on high each answer is checked for its consequences, with a follow-up that quotes the answer', () => {
    const s = section('Depth levels');
    assert.match(s, /On `high` check each answer for what it implies for existing behaviour and data\. For each consequence that no source, spec, code or answer decides, ask one follow-up question that quotes the answer/);
    assert.match(s, /"In Q3 you chose that only accountants may export reports\. Other staff have already created exports: what happens to them\?"/);
  });

  // @scenario questions/depth :: Consequence already decided
  test('a consequence an earlier answer already decides gets no follow-up', () => {
    assert.match(section('Depth levels'), /When an earlier answer already decides the consequence \(existing exports stay visible to their authors\), ask no follow-up about it/);
  });

  // @scenario questions/depth :: Level raised after the Main round
  test('a raised level updates the Depth line and applies to the questions not asked yet', () => {
    const s = section('Depth levels');
    assert.match(s, /The developer may change the level at any time, by telling you or by editing the `Depth:` line\. When told, update the line \(`Depth: high`\)/);
    assert.match(s, /The new level applies only to questions not asked yet: never add a question to a closed round because of it/);
    assert.match(s, /Raised to `high` after the Main round is closed: the Main round gets no new question and the Technical round is prepared on `high`/);
  });

  // @scenario questions/depth :: Level lowered during a round
  test('a lowered level leaves the questions already asked as they are', () => {
    const s = section('Depth levels');
    assert.match(s, /never rewrite or remove a question already asked, answered or not/);
    assert.match(s, /Lowered to `low` while two questions of the round are unanswered: every question stays as it is and the Technical round is prepared on `low`/);
  });
});

describe('workflow guide: notifications', () => {
  // @scenario workflow/planning-flow :: Guide recommends the built-in notifications
  test('the workflow guide recommends Claude Code\'s built-in notifications for the moments the agent waits', () => {
    const guide = flat(readFileSync(join(REPO, 'docs', 'guide', 'workflow.md'), 'utf8'));
    assert.match(guide, /switch on Claude Code's built-in notifications/i);
    assert.match(guide, /built-in notifications[^.]*when the agent waits for you/i);
    assert.match(guide, /The kit adds no notification of its own/);
  });
});
