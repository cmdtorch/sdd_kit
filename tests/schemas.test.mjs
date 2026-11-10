// Kit schemas (`clarify`, `lean`, `clarify-ai-qa`, `clarify-qa`): valid for the pinned CLI, expected dependency graph,
// upstream `spec-driven` instructions and templates kept verbatim (kit text is only appended).
import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
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
