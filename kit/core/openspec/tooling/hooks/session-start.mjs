#!/usr/bin/env node
// sdd-kit: managed file. Do not edit; local changes are overwritten on kit update.
// session-start — SessionStart hook. Tells Claude (and, through it, the developer) where each active
// kit-schema change stands: next artifact, open questions, unconfirmed rounds, task progress.
// Warns when the OpenSpec CLI differs from the pinned version (D12) or the installed OpenSpec skills
// drift from the kit's workflow profile (D20).
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { runHook, hookRoot, addContext } from '../lib/hook-io.mjs';
import { listChanges, changeSchema, changeDir, isKitSchema, readChangeFile } from '../lib/project.mjs';
import { parseClarifications, roundStatus } from '../lib/clarifications.mjs';
import { isMain } from '../lib/report.mjs';
import { readState, fingerprint } from '../lib/state.mjs';
import { referencedStoreLines } from '../lib/stores.mjs';

export const ARTIFACT_ORDER = {
  clarify: ['clarifications', 'proposal', 'specs', 'design', 'verification-plan', 'tasks'],
  lean: ['proposal', 'specs', 'verification-plan', 'tasks'],
};

function exists(dir, id) {
  if (id !== 'specs') return existsSync(join(dir, `${id}.md`));
  const walk = (d) => existsSync(d) && readdirSync(d, { withFileTypes: true }).some((e) => (e.isDirectory() ? walk(join(d, e.name)) : e.name.endsWith('.md')));
  return walk(join(dir, 'specs'));
}

let openQuestions = false;

/** One status line per kit change. */
export function changeLine(root, name, schema) {
  const dir = changeDir(root, name);
  const order = ARTIFACT_ORDER[schema];
  const next = order.find((id) => !exists(dir, id));
  const parts = [];
  if (next) parts.push(`next artifact: ${next}`);
  else {
    const tasks = readChangeFile(root, name, 'tasks.md') || '';
    const done = (tasks.match(/^\s*-\s*\[[xX]\]/gm) || []).length;
    const open = (tasks.match(/^\s*-\s*\[ \]/gm) || []).length;
    parts.push(open ? `apply: ${done}/${done + open} tasks done` : existsSync(join(dir, 'verification.md')) ? 'all tasks done, verification.md written — ready for archive checks' : 'all tasks done — verification.md missing');
  }
  const last = readState(root, `verify-${name}`);
  if (last) {
    if (!last.ok) parts.push('last verification FAILED (see verification.md)');
    else if (last.fingerprint && last.fingerprint !== fingerprint(root, name)) parts.push('files changed since the last green verification — re-run it before archiving');
    else if (!last.complete) parts.push(`verified; manual checks pending: ${(last.manualPending || []).join(', ')}`);
    else parts.push('verified (green)');
  }
  if (schema === 'clarify') {
    const content = readChangeFile(root, name, 'clarifications.md');
    if (content) {
      const parsed = parseClarifications(content);
      for (const r of parsed.rounds) {
        const st = roundStatus(parsed, r.name);
        if (st.confirmed) continue;
        openQuestions = true;
        if (st.unanswered.length) parts.push(`${r.name} round: ${st.unanswered.length} unanswered (${st.unanswered.map((q) => (q.kind === 'question' ? `Q${q.n}` : 'requested changes')).slice(0, 6).join(', ')}${st.unanswered.length > 6 ? ', …' : ''})`);
        else if (!r.summary) parts.push(`${r.name} round: answers complete, summary confirmation not written yet`);
        else parts.push(`${r.name} round: summary waiting for "Looks correct" (now: ${st.summaryAnswer ? `"${st.summaryAnswer}"` : 'blank'})`);
      }
    }
  }
  return `- ${name} [${schema}] — ${parts.join('; ')}`;
}

function openspecVersion() {
  const r = spawnSync(process.env.OPENSPEC_BIN || 'openspec', ['--version'], { encoding: 'utf8', timeout: 8000, env: { ...process.env, OPENSPEC_TELEMETRY: '0' } });
  return r.status === 0 ? r.stdout.trim() : null;
}

export function sessionContext(root) {
  const lines = [];
  const kitFile = join(root, 'openspec', 'tooling', 'kit.json');
  const kit = existsSync(kitFile) ? JSON.parse(readFileSync(kitFile, 'utf8')) : null;

  const kitChanges = [];
  let otherChanges = 0;
  for (const name of listChanges(root)) {
    const schema = changeSchema(root, name);
    if (isKitSchema(schema)) kitChanges.push(changeLine(root, name, schema));
    else otherChanges++;
  }
  if (kitChanges.length) {
    lines.push('sdd-kit: active changes on kit schemas (protocols: openspec/protocols/):', ...kitChanges);
    if (openQuestions) lines.push('Unanswered or unconfirmed question rounds block the next artifact (answers-gate). Tell the developer what is waiting for them before starting other work.');
  }
  lines.push(...referencedStoreLines(root));
  if (otherChanges) lines.push(`sdd-kit: ${otherChanges} other change(s) use their own schema (e.g. spec-driven) and keep their old workflow.`);

  if (kit?.openspecVersion) {
    const v = openspecVersion();
    if (v === null) lines.push(`sdd-kit WARNING: the openspec CLI was not found. The kit needs OpenSpec ${kit.openspecVersion}: npm i -g @fission-ai/openspec@${kit.openspecVersion}`);
    else if (v !== kit.openspecVersion) lines.push(`sdd-kit WARNING: openspec CLI is ${v}, the kit is pinned to ${kit.openspecVersion}. Install the pinned version: npm i -g @fission-ai/openspec@${kit.openspecVersion}`);
  }
  const skills = join(root, '.claude', 'skills');
  if (existsSync(skills) && kit) {
    const drift = [];
    if (existsSync(join(skills, 'openspec-propose'))) drift.push('openspec-propose is installed (creates all artifacts in one pass, skipping question rounds)');
    if (!existsSync(join(skills, 'openspec-continue-change'))) drift.push('openspec-continue-change is missing');
    if (drift.length) {
      lines.push(`sdd-kit WARNING: OpenSpec skills differ from the kit profile: ${drift.join('; ')}. Probably a plain "openspec update" ran with a personal profile. Fix: node openspec/tooling/bin/openspec.mjs update`);
    }
  }
  return lines.join('\n');
}

if (isMain(import.meta.url)) {
  runHook('session-start', (input) => {
    const root = hookRoot(input);
    if (!root) return;
    const text = sessionContext(root);
    if (text) addContext('SessionStart', text);
  });
}
