// Kit schemas (`clarify`, `lean`): valid for the pinned CLI, expected dependency graph,
// upstream `spec-driven` instructions and templates kept verbatim (kit text is only appended).
import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cliSkipReason, makeProject, openspecJson } from './helpers/openspec.mjs';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const KIT_OPENSPEC = join(REPO, 'kit', 'core', 'openspec');
const SCHEMAS = join(KIT_OPENSPEC, 'schemas');
const UPSTREAM = join(REPO, 'fixtures', 'upstream', 'spec-driven-1.13.0');

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
    project = makeProject({ clarify: join(SCHEMAS, 'clarify'), lean: join(SCHEMAS, 'lean') });
    for (const [change, schema] of [['u1', 'spec-driven'], ['c1', 'clarify'], ['l1', 'lean']]) {
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
      const change = schema === 'clarify' ? 'c1' : 'l1';
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
      const change = schema === 'clarify' ? 'c1' : 'l1';
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
