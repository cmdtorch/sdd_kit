// Kit schemas (`clarify`, `lean`, `clarify-ai-qa`, `clarify-qa`): valid for the pinned CLI, expected dependency graph,
// upstream `spec-driven` instructions and templates kept verbatim (kit text is only appended).
import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync, writeFileSync, mkdirSync, mkdtempSync, cpSync, renameSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';
import { metarepo, writeChange, hook, runKit, CHANGE, C as C_ORDERS } from './helpers/metarepo.mjs';
import { cliSkipReason, makeProject, openspecJson } from './helpers/openspec.mjs';
import { parseYaml } from '../kit/openspec/tooling/lib/yaml.mjs';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const KIT_OPENSPEC = join(REPO, 'kit', 'openspec');
const SCHEMAS = join(KIT_OPENSPEC, 'schemas');
const UPSTREAM = join(REPO, 'fixtures', 'upstream', 'spec-driven-1.15.0');

const EXPECTED_GRAPH = {
  clarify: {
    clarifications: [],
    proposal: ['clarifications'],
    specs: ['proposal'],
    design: ['proposal'],
    'verification-plan': ['specs', 'design'],
    tasks: ['specs', 'design', 'verification-plan'],
  },
  lean: {
    proposal: [],
    specs: ['proposal'],
    'verification-plan': ['specs'],
    tasks: ['specs', 'verification-plan'],
  },
};
const TEST_CASE_GRAPH = {
  clarifications: [],
  proposal: ['clarifications'],
  specs: ['proposal'],
  'test-cases': ['specs'],
  design: ['proposal', 'test-cases'],
  'verification-plan': ['specs', 'design'],
  tasks: ['specs', 'design', 'verification-plan'],
};
EXPECTED_GRAPH['clarify-ai-qa'] = TEST_CASE_GRAPH;
EXPECTED_GRAPH['clarify-qa'] = TEST_CASE_GRAPH;
const TEST_CASE_SCHEMAS = ['clarify-ai-qa', 'clarify-qa'];
const CHANGE_OF = { clarify: 'c1', lean: 'l1', 'clarify-ai-qa': 'a1', 'clarify-qa': 'q1' };
const schemaDoc = (schema) => parseYaml(readFileSync(join(SCHEMAS, schema, 'schema.yaml'), 'utf8')).value;
const UPSTREAM_ARTIFACTS = ['proposal', 'specs', 'design', 'tasks'];

describe('kit schema files (no CLI needed)', () => {
  for (const schema of Object.keys(EXPECTED_GRAPH)) {
    test(`${schema}: name field equals directory name`, () => {
      const yaml = readFileSync(join(SCHEMAS, schema, 'schema.yaml'), 'utf8');
      assert.match(yaml, new RegExp(`^name: ${schema}$`, 'm'));
    });

    test(`${schema}: carries the managed-file header`, () => {
      const yaml = readFileSync(join(SCHEMAS, schema, 'schema.yaml'), 'utf8');
      assert.ok(yaml.startsWith('# sdd-kit: managed file.'));
    });

    test(`${schema}: upstream templates are kept (identical or extended)`, () => {
      for (const tpl of readdirSync(join(UPSTREAM, 'templates'))) {
        const kitTpl = join(SCHEMAS, schema, 'templates', tpl);
        if (!existsSync(kitTpl)) continue; // e.g. lean has no design
        assert.ok(
          readFileSync(kitTpl, 'utf8').startsWith(readFileSync(join(UPSTREAM, 'templates', tpl), 'utf8')),
          `${schema}/templates/${tpl} must start with the upstream template`,
        );
      }
    });

    test(`${schema}: every referenced protocol file exists`, () => {
      const yaml = readFileSync(join(SCHEMAS, schema, 'schema.yaml'), 'utf8');
      const refs = [...yaml.matchAll(/openspec\/protocols\/([\w-]+\.md)/g)].map((m) => m[1]);
      assert.ok(refs.length > 0);
      for (const ref of new Set(refs)) {
        assert.ok(existsSync(join(KIT_OPENSPEC, 'protocols', ref)), `missing protocol ${ref}`);
      }
    });
  }
});

describe('kit schemas against the pinned OpenSpec CLI', { skip: cliSkipReason() }, () => {
  let project;
  const instr = {};

  before(() => {
    project = makeProject(Object.fromEntries(Object.keys(EXPECTED_GRAPH).map((s) => [s, join(SCHEMAS, s)])));
    for (const [change, schema] of [['u1', 'spec-driven'], ...Object.entries(CHANGE_OF).map(([s, c]) => [c, s])]) {
      openspecJson(project, ['new', 'change', change, '--schema', schema]);
      instr[schema] = {};
      const status = openspecJson(project, ['status', '--change', change]);
      for (const a of status.artifacts) {
        instr[schema][a.id] = openspecJson(project, ['instructions', a.id, '--change', change]).instruction;
      }
    }
  });

  for (const schema of Object.keys(EXPECTED_GRAPH)) {
    test(`${schema}: schema validate passes`, () => {
      const res = openspecJson(project, ['schema', 'validate', schema]);
      assert.equal(res.valid, true, JSON.stringify(res.issues));
    });

    test(`${schema}: artifact dependency graph`, () => {
      const change = CHANGE_OF[schema];
      const status = openspecJson(project, ['status', '--change', change]);
      const graph = Object.fromEntries(status.artifacts.map((a) => [a.id, a.requires]));
      assert.deepEqual(graph, EXPECTED_GRAPH[schema]);
    });

    test(`${schema}: upstream instructions are kept verbatim as a prefix`, () => {
      for (const id of UPSTREAM_ARTIFACTS) {
        if (!(id in EXPECTED_GRAPH[schema])) continue;
        const upstream = instr['spec-driven'][id];
        const kit = instr[schema][id];
        assert.ok(upstream && upstream.length > 100, `upstream instruction for ${id} not found`);
        assert.ok(kit.startsWith(upstream.trimEnd()), `${schema}.${id} must start with the upstream instruction`);
        assert.ok(kit.length > upstream.length, `${schema}.${id} should append kit rules`);
      }
    });

    test(`${schema}: apply instruction keeps upstream text and appends kit rules`, () => {
      const change = CHANGE_OF[schema];
      const dir = join(project, 'openspec', 'changes', change);
      for (const id of Object.keys(EXPECTED_GRAPH[schema])) {
        if (id === 'specs') {
          mkdirSync(join(dir, 'specs', 'x'), { recursive: true });
          writeFileSync(join(dir, 'specs', 'x', 'spec.md'), '');
        } else {
          writeFileSync(join(dir, `${id}.md`), id === 'tasks' ? '- [ ] 1.1 task\n' : '');
        }
      }
      const apply = openspecJson(project, ['instructions', 'apply', '--change', change]);
      assert.equal(apply.state, 'ready');
      assert.ok(apply.instruction.startsWith('Read context files, work through pending tasks, mark complete as you go.'));
      assert.match(apply.instruction, /openspec\/protocols\/testing\.md/);
    });
  }
});

describe('test-case schemas: files (no CLI needed)', () => {
  // @scenario workflow/test-case-schemas :: Same artifacts in both schemas
  test('clarify-ai-qa and clarify-qa list the same artifacts in the stage order', () => {
    const expected = ['clarifications', 'proposal', 'specs', 'test-cases', 'design', 'verification-plan', 'tasks'];
    for (const schema of TEST_CASE_SCHEMAS) {
      assert.deepEqual(schemaDoc(schema).artifacts.map((a) => a.id), expected, schema);
    }
  });

  test('test-cases artifact requires the specs and the design requires the test cases', () => {
    for (const schema of TEST_CASE_SCHEMAS) {
      const byId = Object.fromEntries(schemaDoc(schema).artifacts.map((a) => [a.id, a]));
      assert.equal(byId['test-cases'].generates, 'test-cases.md', schema);
      assert.deepEqual(byId['test-cases'].requires, ['specs'], schema);
      assert.deepEqual(byId.design.requires, ['proposal', 'test-cases'], schema);
    }
  });

  // Artifacts where the test-case schemas append their test-case additions after clarify's text, which
  // they keep verbatim as a prefix (as the kit appends KIT RULES to upstream text).
  const EXTENDED = new Set(['verification-plan']);

  test('artifacts shared with clarify keep identical instructions and templates (D2)', () => {
    const clarify = Object.fromEntries(schemaDoc('clarify').artifacts.map((a) => [a.id, a]));
    for (const schema of TEST_CASE_SCHEMAS) {
      for (const a of schemaDoc(schema).artifacts) {
        const base = clarify[a.id];
        if (!base) continue;
        assert.equal(a.template, base.template, `${schema}.${a.id} template name differs from clarify`);
        const tpl = readFileSync(join(SCHEMAS, schema, 'templates', a.template), 'utf8');
        const baseTpl = readFileSync(join(SCHEMAS, 'clarify', 'templates', base.template), 'utf8');
        if (EXTENDED.has(a.id)) {
          assert.ok(a.instruction.startsWith(base.instruction), `${schema}.${a.id} instruction does not start with clarify's verbatim`);
          assert.ok(tpl.startsWith(baseTpl), `${schema}/templates/${a.template} does not start with clarify's verbatim`);
          continue;
        }
        assert.equal(a.instruction, base.instruction, `${schema}.${a.id} instruction differs from clarify`);
        assert.equal(tpl, baseTpl, `${schema}/templates/${a.template} differs from clarify`);
      }
    }
  });

  test('the verification plan of the test-case schemas adds the "Test case coverage" table (D9)', () => {
    const clarifyPlan = schemaDoc('clarify').artifacts.find((a) => a.id === 'verification-plan');
    for (const schema of TEST_CASE_SCHEMAS) {
      const plan = schemaDoc(schema).artifacts.find((a) => a.id === 'verification-plan');
      const added = plan.instruction.slice(clarifyPlan.instruction.length);
      assert.match(added, /Test case\s+coverage/, schema);
      assert.match(added, /`automated` names its level: unit,\s+integration or both/, schema);
      const tpl = readFileSync(join(SCHEMAS, schema, 'templates', plan.template), 'utf8');
      assert.match(tpl, /\n## Test case coverage\n\n\| Capability \| Scenario \| Case \| Labels \| Level \|\n/, schema);
    }
    assert.doesNotMatch(readFileSync(join(SCHEMAS, 'clarify', 'templates', clarifyPlan.template), 'utf8'), /Test case coverage/);
  });

  test('only clarify-qa hands the test cases over to a human QA', () => {
    const tc = (schema) => schemaDoc(schema).artifacts.find((a) => a.id === 'test-cases').instruction;
    assert.match(tc('clarify-qa'), /Handed over to QA/);
    assert.doesNotMatch(tc('clarify-ai-qa'), /Handed over to QA/);
    for (const schema of TEST_CASE_SCHEMAS) assert.match(tc(schema), /test-cases-reviewer/, schema);
  });
});

describe('test-case schemas against the pinned OpenSpec CLI', { skip: cliSkipReason() }, () => {
  let project;
  const ids = (change) => openspecJson(project, ['status', '--change', change]).artifacts.map((a) => a.id);

  before(() => {
    project = makeProject(Object.fromEntries(Object.keys(EXPECTED_GRAPH).map((s) => [s, join(SCHEMAS, s)])));
  });

  // @scenario workflow/test-case-schemas :: Test cases come after the specs
  test('on clarify-qa with specs written, test-cases is ready and the design is blocked by it', () => {
    openspecJson(project, ['new', 'change', 'tc-order', '--schema', 'clarify-qa']);
    const dir = join(project, 'openspec', 'changes', 'tc-order');
    writeFileSync(join(dir, 'clarifications.md'), '# Clarifications\n');
    writeFileSync(join(dir, 'proposal.md'), '## Why\n');
    mkdirSync(join(dir, 'specs', 'inventory', 'sale-export'), { recursive: true });
    writeFileSync(join(dir, 'specs', 'inventory', 'sale-export', 'spec.md'), '## ADDED Requirements\n');
    const status = Object.fromEntries(openspecJson(project, ['status', '--change', 'tc-order']).artifacts.map((a) => [a.id, a]));
    assert.equal(status.specs.status, 'done');
    assert.equal(status['test-cases'].status, 'ready');
    assert.equal(status.design.status, 'blocked');
    assert.ok(status.design.requires.includes('test-cases'));
  });

  // @scenario workflow/test-case-schemas :: Clarify has no test-cases artifact
  test('a new clarify change has the clarify artifacts and no test-cases artifact', () => {
    openspecJson(project, ['new', 'change', 'plain-clarify', '--schema', 'clarify']);
    assert.deepEqual(ids('plain-clarify'), ['clarifications', 'proposal', 'specs', 'design', 'verification-plan', 'tasks']);
  });

  // @scenario workflow/test-case-schemas :: Lean has no test-cases artifact
  test('a new lean change has the lean artifacts and no test-cases artifact', () => {
    openspecJson(project, ['new', 'change', 'plain-lean', '--schema', 'lean']);
    assert.deepEqual(ids('plain-lean'), ['proposal', 'specs', 'verification-plan', 'tasks']);
  });
});

// --- Subagent apply (change add-subagent-execution): the plan lines in the tasks instruction, the subagent
// rules in the apply instruction, and no check that reads the plan lines or the group size. -----------------

const flatText = (s) => s.replace(/\s+/g, ' ');
const tasksInstruction = (schema) => flatText(schemaDoc(schema).artifacts.find((a) => a.id === 'tasks').instruction);
const applyInstruction = (schema) => flatText(schemaDoc(schema).apply.instruction);
const KIT_SCHEMAS = Object.keys(EXPECTED_GRAPH);

describe('tasks instruction: group plan lines (no CLI needed)', () => {
  // @scenario workflow/task-groups :: Tasks instruction shows the plan lines
  test('every kit schema tells the agent to write Depends on / Area / Shared under each group heading, with an example', () => {
    for (const schema of KIT_SCHEMAS) {
      const t = tasksInstruction(schema);
      assert.match(t, /right under every `## <n>\.` group heading, before its tasks, write three lines: `Depends on:`/, schema);
      assert.match(t, /`Area:` the files and folders it changes/, schema);
      assert.match(t, /`Shared:` the shared resources it changes or its tests use, or `none`/, schema);
      assert.match(t, /`openspec\/protocols\/subagents\.md`/, schema);
    }
  });

  // @scenario workflow/task-groups :: Group with its plan lines
  test('the example group depends on group 1, names its folder and adds a library as dependencies', () => {
    for (const schema of KIT_SCHEMAS) {
      const raw = schemaDoc(schema).artifacts.find((a) => a.id === 'tasks').instruction;
      assert.match(raw, /## 2\. Order API\n\s*\n\s*Depends on: 1\n\s*Area: src\/api\/orders\/\n\s*Shared: dependencies\n/, schema);
      assert.match(tasksInstruction(schema), /`dependencies` \(dependency manifests and lock files: a group that adds a library\)/, schema);
    }
  });

  // @scenario workflow/task-groups :: Independent group
  test('a group that needs nothing from the others has Depends on: none', () => {
    for (const schema of KIT_SCHEMAS) {
      assert.match(tasksInstruction(schema), /`Depends on:` the numbers of the groups it needs, or `none`/, schema);
      assert.match(tasksInstruction(schema), /a group that needs nothing from the others has `Depends on: none`/, schema);
    }
  });

  // @scenario workflow/task-groups :: Area of a frontend group
  test('a group that changes only web/src/orders/ has that folder as its area', () => {
    for (const schema of KIT_SCHEMAS) {
      assert.match(tasksInstruction(schema), /a group that changes only `web\/src\/orders\/` has `Area: web\/src\/orders\/`/, schema);
    }
  });

  // @scenario workflow/task-groups :: Rename across the project
  test('an area that cannot be named in advance is unknown', () => {
    for (const schema of KIT_SCHEMAS) {
      assert.match(tasksInstruction(schema), /or `unknown` when they cannot be named in advance \(a rename across the whole project\)/, schema);
    }
  });

  // @scenario workflow/task-groups :: Tasks instruction lists the shared resources
  test('the seven shared resources are named, each with what it covers', () => {
    for (const schema of KIT_SCHEMAS) {
      const t = tasksInstruction(schema);
      assert.match(t, /`dependencies` \(dependency manifests and lock files/, schema);
      assert.match(t, /`migrations` \(database migrations and schema\)/, schema);
      assert.match(t, /`settings` \(shared project settings: build, linter, test configuration, environment variables\)/, schema);
      assert.match(t, /`assembly` \(shared assembly points: route files, module registration\)/, schema);
      assert.match(t, /`database`, `ports`, `docker` \(its tests use the test database, fixed ports, Docker\)/, schema);
    }
  });

  // @scenario workflow/task-groups :: Group installs a library
  test('adding a library is a dependencies change', () => {
    for (const schema of KIT_SCHEMAS) assert.match(tasksInstruction(schema), /`dependencies` \([^)]*a group that adds a library\)/, schema);
  });

  // @scenario workflow/task-groups :: Group whose tests use the database
  test('a group whose tests use the test database and that changes no shared file has Shared: database', () => {
    for (const schema of KIT_SCHEMAS) {
      assert.match(tasksInstruction(schema), /A group whose tests use the test database and that changes no shared file has `Shared: database`/, schema);
    }
  });

  // @scenario workflow/task-groups :: Tasks instruction states the limit
  test('a group has at most 5 tasks and about 10 touched files; larger work is split', () => {
    for (const schema of KIT_SCHEMAS) {
      assert.match(tasksInstruction(schema), /a group has at most 5 tasks and about 10 touched files\. Split larger work into several groups/, schema);
    }
  });

  // @scenario workflow/task-groups :: Large group is split
  test('work of 9 tasks becomes two groups or more', () => {
    for (const schema of KIT_SCHEMAS) assert.match(tasksInstruction(schema), /\(9 tasks become two groups or more\)/, schema);
  });

  // @scenario workflow/task-groups :: Final group depends on all
  test('the final group depends on every other group', () => {
    for (const schema of KIT_SCHEMAS) {
      assert.match(tasksInstruction(schema), /The final group depends on every other group: in a `tasks\.md` with groups 1 to 4 it has `Depends on: 1, 2, 3`/, schema);
    }
  });
});

describe('apply instruction: subagent rules (no CLI needed)', () => {
  // @scenario workflow/subagent-apply :: Change with three groups
  test('on a change stamped 0.5.0 or later every group before the final one goes to task-implementer and the main agent edits no code', () => {
    for (const schema of KIT_SCHEMAS) {
      const a = applyInstruction(schema);
      assert.match(a, /on a change stamped 0\.5\.0 or later \(`x-sdd-kit` in its `\.openspec\.yaml`\) follow `openspec\/protocols\/subagents\.md`/, schema);
      assert.match(a, /Hand every task group before the final group to a new `task-implementer` subagent/, schema);
      assert.match(a, /edit no project code or tests yourself/, schema);
      assert.match(a, /check off a group's tasks only after you accept it/, schema);
      assert.match(a, /On older or unstamped changes you implement and verify yourself, as before/, schema);
    }
  });

  // @scenario workflow/subagent-delegation :: Developer runs verify
  test('verify of a stamped change runs in the change-verifier subagent and its fixes in subagents', () => {
    for (const schema of KIT_SCHEMAS) {
      const a = applyInstruction(schema);
      assert.match(a, /verify runs in the `change-verifier` subagent/, schema);
      assert.match(a, /\(fixes go to subagents too\)/, schema);
    }
  });

  test('the agents the apply instruction names are kit files', () => {
    for (const name of ['task-implementer', 'change-verifier']) {
      assert.ok(existsSync(join(REPO, 'kit', 'claude', 'agents', `${name}.md`)), name);
    }
  });

  test('a temp install of the kit passes lint-kit with the new instructions', () => {
    const root = mkdtempSync(join(tmpdir(), 'sdd-kit-schemas-install-'));
    cpSync(join(REPO, 'fixtures', 'projects', 'pilot-like'), root, { recursive: true });
    renameSync(join(root, 'gitignore.txt'), join(root, '.gitignore'));
    mkdirSync(join(root, '.claude'), { recursive: true });
    execFileSync('git', ['init', '-q'], { cwd: root });
    const inst = spawnSync(process.execPath, [join(REPO, 'installer', 'sdd-kit.mjs'), 'install', '--yes', '--skip-openspec', '--target', root], { cwd: root, encoding: 'utf8' });
    assert.equal(inst.status, 0, inst.stdout + inst.stderr);
    const lint = spawnSync(process.execPath, [join(root, 'openspec', 'tooling', 'checks', 'lint-kit.mjs')], { cwd: root, encoding: 'utf8' });
    assert.equal(lint.status, 0, lint.stdout + lint.stderr);
  });
});

describe('plan lines and group size are not checked (processes on temp projects)', () => {
  const ROW = [['Order is created', 'unit', 'backend']];
  /** tasks.md from groups [{ title, plan: [lines] | null, tasks: n }]; `tag` prefixes every group but the last. */
  const tasksMd = (groups, tag = '') =>
    [
      '# Tasks',
      '',
      ...groups.flatMap((g, k) => [
        `## ${k + 1}. ${tag && k < groups.length - 1 ? `[${tag}] ` : ''}${g.title}`,
        '',
        ...(g.plan ? [...g.plan, ''] : []),
        ...Array.from({ length: g.tasks ?? 1 }, (_, i) => `- [ ] ${k + 1}.${i + 1} Write the code part ${i + 1} and verify its test passes`),
        '',
      ]),
    ].join('\n');
  /** A plain change and a meta-repository change, each with `groups` written through the tasks gate. */
  function judge(groups) {
    const out = [];
    for (const meta of [false, true]) {
      const root = meta ? metarepo() : metarepo({ clones: null, create: [] });
      writeChange(root, ROW, { marked: meta, column: meta });
      const path = join(root, C_ORDERS, 'tasks.md');
      const content = tasksMd(groups, meta ? 'backend' : '');
      const gate = hook(root, 'answers-gate.mjs', { hook_event_name: 'PreToolUse', tool_name: 'Write', tool_input: { file_path: path, content } });
      writeFileSync(path, content);
      const after = hook(root, 'artifact-feedback.mjs', { hook_event_name: 'PostToolUse', tool_name: 'Write', tool_input: { file_path: path, content } });
      const check = runKit(root, 'checks/check-tasks.mjs', ['--change', CHANGE, '--json']);
      out.push({ meta, gate, after, check, report: JSON.parse(check.out) });
    }
    return out;
  }
  const assertSilent = (results) => {
    for (const { meta, gate, after, check, report } of results) {
      const where = meta ? 'meta-repository change' : 'plain change';
      assert.equal(gate.code, 0, `${where}: the tasks gate blocks: ${gate.err}`);
      assert.equal(gate.err, '', where);
      assert.doesNotMatch(after.out + after.err, /problem|warning|error|Depends on|Area:|Shared:|group size|tasks per group/i, where);
      assert.equal(check.code, 0, `${where}: ${check.out}`);
      assert.deepEqual(report.findings, [], where);
    }
  };
  const PLAN = ['Depends on: none', 'Area: src/orders/', 'Shared: none'];

  // @scenario workflow/task-groups :: Group above the limit is not blocked
  test('a group of 7 tasks is written and no check reports its size', () => {
    assertSilent(judge([{ title: 'Orders', plan: PLAN, tasks: 7 }, { title: 'Final checks', plan: ['Depends on: 1', 'Area: unknown', 'Shared: none'] }]));
  });

  // @scenario workflow/task-groups :: Group without plan lines
  test('a group without plan lines is written, and the protocol runs it alone after the earlier groups', () => {
    assertSilent(
      judge([
        { title: 'Orders', plan: PLAN },
        { title: 'Order list' },
        { title: 'Final checks', plan: ['Depends on: 1, 2', 'Area: unknown', 'Shared: none'] },
      ]),
    );
    const proto = flatText(readFileSync(join(KIT_OPENSPEC, 'protocols', 'subagents.md'), 'utf8'));
    assert.match(proto, /A group with a plan line missing or unreadable \(for example `Depends on: the API group`\) depends on every earlier group and has an unknown area\. No check reports such lines/);
    assert.match(proto, /A group with `Area: unknown` runs alone: no other group's subagent runs at the same time/);
    assert.match(proto, /Start a group only after every group in its `Depends on:` line is accepted/);
  });

  // @scenario workflow/task-groups :: Malformed plan line
  test('a group with "Depends on: the API group" is written, and the protocol runs it alone after every earlier group', () => {
    assertSilent(
      judge([
        { title: 'Order API', plan: PLAN },
        { title: 'Order screen', plan: ['Depends on: none', 'Area: web/orders/', 'Shared: none'] },
        { title: 'Order export', plan: ['Depends on: the API group', 'Area: src/export/', 'Shared: none'] },
        { title: 'Final checks', plan: ['Depends on: 1, 2, 3', 'Area: unknown', 'Shared: none'] },
      ]),
    );
    const proto = flatText(readFileSync(join(KIT_OPENSPEC, 'protocols', 'subagents.md'), 'utf8'));
    assert.match(proto, /unreadable \(for example `Depends on: the API group`\) depends on every earlier group and has an unknown area/);
    assert.match(proto, /A group with `Area: unknown` runs alone/);
  });
});

// --- Planning protocol pointers (change streamline-planning, design D-5): the clarify and lean instructions, the
// clarifications template and the kit block of config.yaml point to planning.md for changes stamped 0.6.0 or later
// and keep the present rules for earlier changes and the test-case schemas. ---------------------------------------

describe('planning protocol pointers (no CLI needed)', () => {
  const POINTER = /on a change on `clarify` or `lean` stamped with kit version 0\.6\.0 or later \(`x-sdd-kit` in its `\.openspec\.yaml`\), follow `openspec\/protocols\/planning\.md` first; where it differs from these rules, it applies\. Earlier changes and the `clarify-ai-qa` and `clarify-qa` schemas keep these rules/;

  test('every artifact instruction of clarify and lean after the clarifications points to planning.md', () => {
    for (const schema of ['clarify', 'lean']) {
      for (const a of schemaDoc(schema).artifacts) {
        if (a.id === 'clarifications') continue;
        assert.match(flatText(a.instruction), POINTER, `${schema}.${a.id}`);
      }
    }
  });

  test('the clarifications instruction names the new-rules lines and keeps the earlier rules', () => {
    const c = flatText(schemaDoc('clarify').artifacts.find((a) => a.id === 'clarifications').instruction);
    assert.match(c, /On a change on `clarify` stamped with kit version 0\.6\.0 or later \(`x-sdd-kit` in its `\.openspec\.yaml`\), follow `openspec\/protocols\/planning\.md` first/);
    assert.match(c, /recommend an option only with a basis, on a `Recommended:` line \(planning\.md §12\)/);
    assert.match(c, /close the Main round without a summary confirmation, or with the line `No questions\.`/);
    assert.match(c, /keep the rules below: no `Recommended:` line, `Depth:` `Minimal`, `Standard` or `Comprehensive` \(default `Comprehensive`\), and the summary confirmation/);
    assert.match(c, /Depth from the file header; default Comprehensive/);
  });

  test('the apply instruction of clarify runs the answers check of planning.md on new changes', () => {
    assert.match(applyInstruction('clarify'), /On a change stamped 0\.6\.0 or later, run `node openspec\/tooling\/checks\/check-answers\.mjs --change <name>` before the first task and before each task group, and start no task while it reports a changed answer \(`openspec\/protocols\/planning\.md` §7\)/);
  });

  test('the clarifications template explains both depth names and points to planning.md', () => {
    for (const schema of ['clarify', ...TEST_CASE_SCHEMAS]) {
      const tpl = readFileSync(join(SCHEMAS, schema, 'templates', 'clarifications.md'), 'utf8');
      assert.match(flatText(tpl), /On `clarify` stamped 0\.6\.0 or later \(openspec\/protocols\/planning\.md\): `Depth: low`, `medium` or `high` \(the level chosen in the starter menu, otherwise `medium`\), an `Answer mode:` line, the rounds Main and Technical without a summary confirmation\. Earlier changes and the test-case schemas: `Minimal`, `Standard` or `Comprehensive`/, schema);
      assert.match(tpl, /^Depth: Comprehensive$/m, schema);
    }
  });

  test('the kit block of config.yaml points to planning.md and keeps the earlier depth default', () => {
    const frag = readFileSync(join(REPO, 'kit', 'config-fragment.yaml'), 'utf8');
    assert.match(frag, /Clarifying questions: openspec\/protocols\/questions\.md \(default depth: Comprehensive\)/);
    assert.match(flatText(frag), /Planning of changes on `clarify` or `lean` stamped 0\.6\.0 or later: openspec\/protocols\/planning\.md first \(no `\/opsx:continue`, two rounds, recommendations, depth `low`, `medium` or `high`, default `medium`\)/);
  });
});
