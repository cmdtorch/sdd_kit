#!/usr/bin/env node
// sdd-kit: managed file. Do not edit; local changes are overwritten on kit update.
// CI entry point (GitHub Actions workflow: .github/workflows/sdd-kit.yml). Hooks are the first line of
// defence; CI is the backstop (D2) — e.g. for writes that bypassed the hooks.
//
//   node openspec/tooling/bin/ci.mjs checks [--base <git-ref>]
//       no project dependencies needed: lint-kit, `openspec validate --all --strict` with the pinned CLI,
//       every kit check on every active kit change, and changes archived in this PR (vs --base or
//       origin/$GITHUB_BASE_REF): complete tasks, all-Met verification.md, complete handoff
//   node openspec/tooling/bin/ci.mjs verify [--change <name>]
//       needs the project's test environment (verify.yaml): for changes whose tasks are all done (or that
//       have verification.md) the full suite + gate + E2E run once and every planned scenario must have a
//       passing marked test; for changes in progress missing tests are warnings; with `api` configured the
//       API must equal the committed baseline
// Exit 1 on any error. Writes a Markdown summary to $GITHUB_STEP_SUMMARY when set.
import { spawnSync } from 'node:child_process';
import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs, isMain } from '../lib/report.mjs';
import { findRoot, listChanges, changeSchema, isKitSchema, readChangeFile, schemaOfDir, readIn } from '../lib/project.mjs';
import { lintKit } from '../checks/lint-kit.mjs';
import { checkAnswers } from '../checks/check-answers.mjs';
import { checkSpecs } from '../checks/check-specs.mjs';
import { checkGrounding } from '../checks/check-grounding.mjs';
import { checkTraceability } from '../checks/check-traceability.mjs';
import { checkHandoff } from '../checks/check-handoff.mjs';
import { checkVerification } from '../checks/check-verification.mjs';
import { loadVerifyConfig } from '../lib/verify-config.mjs';
import { runVerification, collectMarkers } from '../lib/verify-run.mjs';
import { checkApi } from '../lib/api.mjs';

const fmt = (f) => `${f.file ? `${f.file}${f.line ? `:${f.line}` : ''}: ` : ''}${f.message}`;

function tasksState(text) {
  const done = ((text || '').match(/^\s*-\s*\[[xX]\]/gm) || []).length;
  const open = ((text || '').match(/^\s*-\s*\[ \]/gm) || []).length;
  return { done, open, complete: done > 0 && open === 0 };
}

/** Collects results as { section, errors[], warnings[] }. */
class Results {
  constructor() {
    this.sections = [];
  }
  add(section, errors = [], warnings = []) {
    this.sections.push({ section, errors, warnings });
  }
  fromReport(section, report, { warningsToo = true, demote = false } = {}) {
    if (report.skipped) return;
    const e = report.findings.filter((f) => f.level === 'error').map(fmt);
    const w = warningsToo ? report.findings.filter((f) => f.level === 'warning').map(fmt) : [];
    if (demote) this.add(section, [], [...e, ...w]);
    else this.add(section, e, w);
  }
  get ok() {
    return this.sections.every((s) => !s.errors.length);
  }
  text() {
    const out = [];
    for (const s of this.sections) {
      out.push(`${s.errors.length ? 'FAIL' : 'ok  '} ${s.section}`);
      for (const e of s.errors) out.push(`       ERROR ${e}`);
      for (const w of s.warnings) out.push(`       warning ${w}`);
    }
    out.push(this.ok ? 'sdd-kit CI: OK' : 'sdd-kit CI: FAILED');
    return out.join('\n');
  }
  markdown(title) {
    const out = [`## sdd-kit — ${title}: ${this.ok ? '✅ passed' : '❌ failed'}`, '', '| Check | Result |', '|---|---|'];
    for (const s of this.sections) out.push(`| ${s.section} | ${s.errors.length ? `❌ ${s.errors.length} error(s)` : s.warnings.length ? `⚠️ ${s.warnings.length} warning(s)` : '✅'} |`);
    const details = this.sections.filter((s) => s.errors.length || s.warnings.length);
    if (details.length) {
      out.push('', '<details><summary>Details</summary>', '');
      for (const s of details) {
        out.push(`**${s.section}**`, '');
        for (const e of s.errors) out.push(`- ❌ ${e.replace(/\n/g, ' ')}`);
        for (const w of s.warnings) out.push(`- ⚠️ ${w.replace(/\n/g, ' ')}`);
        out.push('');
      }
      out.push('</details>');
    }
    return out.join('\n') + '\n';
  }
}

function openspecValidate(root, res) {
  const kit = JSON.parse(readFileSync(join(root, 'openspec', 'tooling', 'kit.json'), 'utf8'));
  const bin = process.env.OPENSPEC_BIN || 'openspec';
  const env = { ...process.env, OPENSPEC_TELEMETRY: '0', DO_NOT_TRACK: '1' };
  const v = spawnSync(bin, ['--version'], { encoding: 'utf8', env });
  if (v.error || v.status !== 0) return res.add('openspec validate', [`openspec CLI not found — install the pinned version: npm i -g @fission-ai/openspec@${kit.openspecVersion}`]);
  if (v.stdout.trim() !== kit.openspecVersion) return res.add('openspec validate', [`openspec ${v.stdout.trim()} is installed, the kit is pinned to ${kit.openspecVersion} (D12)`]);
  const r = spawnSync(bin, ['validate', '--all', '--strict', '--json'], { cwd: root, encoding: 'utf8', env, maxBuffer: 64 * 1024 * 1024 });
  let data;
  try {
    data = JSON.parse(r.stdout.slice(r.stdout.search(/[[{]/)));
  } catch {
    return res.add('openspec validate --all --strict', [`could not read the output (exit ${r.status}): ${(r.stdout + r.stderr).slice(0, 500)}`]);
  }
  const errors = [];
  for (const item of data.items || []) if (!item.valid) for (const i of item.issues) errors.push(`${item.type} ${item.id}: ${i.level}: ${i.message}`);
  res.add('openspec validate --all --strict', errors);
}

function archivedInPr(root, base) {
  const r = spawnSync('git', ['diff', '--name-only', '--diff-filter=A', `${base}...HEAD`, '--', 'openspec/changes/archive/'], { cwd: root, encoding: 'utf8' });
  if (r.status !== 0) return { error: `git diff against ${base} failed — check out with full history (actions/checkout fetch-depth: 0): ${r.stderr.trim()}` };
  const dirs = new Set(r.stdout.split('\n').filter(Boolean).map((p) => p.split('/').slice(0, 4).join('/')));
  return { dirs: [...dirs].sort() };
}

export function ciChecks({ root, base }) {
  const res = new Results();
  res.fromReport('lint-kit', lintKit({ root }));
  openspecValidate(root, res);
  for (const change of listChanges(root)) {
    const schema = changeSchema(root, change);
    if (!isKitSchema(schema)) continue;
    const p = `change ${change}`;
    if (schema === 'clarify') {
      res.fromReport(`${p}: check-answers`, checkAnswers({ root, change }));
      res.fromReport(`${p}: check-grounding`, checkGrounding({ root, change }));
    }
    res.fromReport(`${p}: check-specs`, checkSpecs({ root, change }));
    const trace = checkTraceability({ root, change, markers: null });
    trace.findings = trace.findings.filter((f) => !/markers were not checked/.test(f.message));
    res.fromReport(`${p}: check-traceability (plan)`, trace);
    if (existsSync(join(root, 'openspec', 'changes', change, 'api-changes.json'))) res.fromReport(`${p}: check-handoff`, checkHandoff({ root, change }));
    if (readChangeFile(root, change, 'verification.md') !== null) res.fromReport(`${p}: check-verification`, checkVerification({ root, change }), { demote: !tasksState(readChangeFile(root, change, 'tasks.md')).complete });
  }
  if (base) {
    const a = archivedInPr(root, base);
    if (a.error) res.add('archived in this PR', [a.error]);
    for (const rel of a.dirs || []) {
      const dir = join(root, rel);
      if (!isKitSchema(schemaOfDir(dir))) continue;
      const name = rel.split('/').pop().replace(/^\d{4}-\d{2}-\d{2}-/, '');
      const t = tasksState(readIn(dir, 'tasks.md'));
      res.add(`archived ${name}: tasks`, t.complete ? [] : [`${t.open} task(s) were not done when the change was archived`]);
      res.fromReport(`archived ${name}: check-verification`, checkVerification({ root, dir }));
      if (existsSync(join(dir, 'api-changes.json'))) res.fromReport(`archived ${name}: check-handoff`, checkHandoff({ root, dir }));
    }
  }
  return res;
}

export function ciVerify({ root, changes }) {
  const res = new Results();
  const cfg = loadVerifyConfig(root);
  if (!cfg) {
    res.add('verify.yaml', ['openspec/tooling/verify.yaml does not exist — CI cannot run the tests']);
    return res;
  }
  const cache = new Map();
  const names = changes?.length ? changes : listChanges(root).filter((c) => isKitSchema(changeSchema(root, c)));
  let inProgress = null;
  for (const change of names) {
    const t = tasksState(readChangeFile(root, change, 'tasks.md'));
    if (t.complete || readChangeFile(root, change, 'verification.md') !== null) {
      const r = runVerification({ root, change, mode: 'full', write: false, cache });
      const errors = [...r.problems];
      for (const row of r.rows.filter((x) => x.level !== 'manual' && x.verdict !== 'Met')) errors.push(`${row.verdict}: "${row.scenario}" (${row.capability}, ${row.level}) — ${row.actual}; ${row.evidence}`);
      res.add(`change ${change}: tests and scenario coverage`, errors, r.manualPending.map((m) => `manual check pending: ${m.scenario} (${m.capability})`));
      res.fromReport(`change ${change}: check-traceability (markers)`, checkTraceability({ root, change, markers: r.markers }));
    } else {
      inProgress = inProgress || collectMarkers({ root, cache });
      if (inProgress.problems.length) res.add(`change ${change}: collect markers`, inProgress.problems);
      res.fromReport(`change ${change} (in progress, ${t.done}/${t.done + t.open} tasks): check-traceability (markers)`, checkTraceability({ root, change, markers: inProgress.markers }), { demote: true });
    }
  }
  if (cfg.api) {
    const a = checkApi(root);
    res.add(
      'API baseline',
      a.ok ? [] : [`API differs from ${a.snapshot ?? 'the baseline'}: ${a.message ?? a.operations.map((o) => `${o.change} ${o.method} ${o.path}`).join(', ')} — finish the change: api.mjs diff, frontend-handoff.md, api.mjs snapshot (openspec/protocols/handoff.md)`],
    );
  }
  return res;
}

if (isMain(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2), ['help', 'json']);
  const cmd = args._[0];
  if (args.help || !['checks', 'verify'].includes(cmd)) {
    console.log('Usage: ci.mjs checks [--base <git-ref>] | verify [--change <name>]   [--json] [--root <dir>]');
    process.exit(args.help ? 0 : 1);
  }
  const root = args.root || findRoot();
  if (!root) {
    console.error('sdd-kit ci: no openspec/ directory found');
    process.exit(1);
  }
  const base = args.base || (process.env.GITHUB_BASE_REF ? `origin/${process.env.GITHUB_BASE_REF}` : null);
  const res = cmd === 'checks' ? ciChecks({ root, base }) : ciVerify({ root, changes: args.change ? [args.change] : null });
  console.log(args.json ? JSON.stringify({ ok: res.ok, sections: res.sections }, null, 2) : res.text());
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, res.markdown(cmd));
  process.exit(res.ok ? 0 : 1);
}
