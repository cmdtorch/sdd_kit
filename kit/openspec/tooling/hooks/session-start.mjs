#!/usr/bin/env node
// sdd-kit: managed file. Do not edit; local changes are overwritten on kit update.
// session-start — SessionStart hook. Tells Claude (and, through it, the developer) where each active
// kit-schema change stands: next artifact, open questions, unconfirmed rounds, task progress. A change under the new
// planning rules (openspec/protocols/planning.md) is reported with its open questions and its changed answers (the
// answers lock, lib/answers-lock.mjs), never with a summary waiting for "Looks correct".
// Warns when the OpenSpec CLI differs from the pinned version (D12) or the installed OpenSpec skills
// drift from the kit's workflow profile (D20): the drift check of lib/skills.mjs (OpenSpec's `update --dry-run` with
// the pinned CLI, the file check otherwise), run when .claude/skills/ exists; a check that could not run is a warning.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { runHook, hookRoot, addContext } from '../lib/hook-io.mjs';
import { listChanges, changeSchema, changeDir, isKitSchema, isClarifyFamily, readChangeFile, usesNewPlanning } from '../lib/project.mjs';
import { lockDifferences } from '../lib/answers-lock.mjs';
import { parseClarifications, roundStatus } from '../lib/clarifications.mjs';
import { isMain } from '../lib/report.mjs';
import { taskCounts } from '../lib/markdown.mjs';
import { skillDrift, openspecCliVersion, SKILLS_FIX, SKILLS_CHECK_COMMAND } from '../lib/skills.mjs';

export const ARTIFACT_ORDER = {
  clarify: ['clarifications', 'proposal', 'specs', 'design', 'verification-plan', 'tasks'],
  lean: ['proposal', 'specs', 'verification-plan', 'tasks'],
  'clarify-ai-qa': ['clarifications', 'proposal', 'specs', 'test-cases', 'design', 'verification-plan', 'tasks'],
  'clarify-qa': ['clarifications', 'proposal', 'specs', 'test-cases', 'design', 'verification-plan', 'tasks'],
};

function exists(dir, id) {
  if (id !== 'specs') return existsSync(join(dir, `${id}.md`));
  const walk = (d) => existsSync(d) && readdirSync(d, { withFileTypes: true }).some((e) => (e.isDirectory() ? walk(join(d, e.name)) : e.name.endsWith('.md')));
  return walk(join(dir, 'specs'));
}

let openQuestions = false;
let changedAnswers = false;

/** One status line per kit change. */
export function changeLine(root, name, schema) {
  const dir = changeDir(root, name);
  const order = ARTIFACT_ORDER[schema];
  const next = order.find((id) => !exists(dir, id));
  const parts = [];
  if (next) parts.push(`next artifact: ${next}`);
  else {
    const { done, open } = taskCounts(readChangeFile(root, name, 'tasks.md') || '');
    parts.push(open ? `apply: ${done}/${done + open} tasks done` : 'all tasks done — run the full test suite, then archive');
  }
  if (isClarifyFamily(schema)) {
    const content = readChangeFile(root, name, 'clarifications.md');
    const newPlanning = usesNewPlanning(root, name);
    if (content) {
      const parsed = parseClarifications(content, { newPlanning });
      for (const r of parsed.rounds) {
        const st = roundStatus(parsed, r.name);
        if (st.confirmed) continue;
        openQuestions = true;
        if (st.unanswered.length) parts.push(`${r.name} round: ${st.unanswered.length} unanswered (${st.unanswered.map((q) => (q.kind === 'question' ? `Q${q.n}` : 'requested changes')).slice(0, 6).join(', ')}${st.unanswered.length > 6 ? ', …' : ''})`);
        else if (newPlanning) parts.push(`${r.name} round: no question and no "No questions." line yet`);
        else if (!r.summary) parts.push(`${r.name} round: answers complete, summary confirmation not written yet`);
        else parts.push(`${r.name} round: summary waiting for "Looks correct" (now: ${st.summaryAnswer ? `"${st.summaryAnswer}"` : 'blank'})`);
      }
    }
    for (const d of lockDifferences(root, name)) {
      changedAnswers = true;
      parts.push(`changed answer: Q${d.n} (${d.artifacts.join(', ')} written from the earlier answer)`);
    }
  }
  return `- ${name} [${schema}] — ${parts.join('; ')}`;
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
    if (changedAnswers) lines.push('A changed answer blocks the artifacts written after it and every task (answers-gate, check-answers): warn the developer, name the questions and the artifacts, and wait until they tell you to update the artifacts or restore the earlier answer (openspec/protocols/planning.md).');
  }
  if (otherChanges) lines.push(`sdd-kit: ${otherChanges} other change(s) use their own schema (e.g. spec-driven) and keep their old workflow.`);

  let v;
  if (kit?.openspecVersion) {
    v = openspecCliVersion();
    if (v === null) lines.push(`sdd-kit WARNING: the openspec CLI was not found. The kit needs OpenSpec ${kit.openspecVersion}: npm i -g @fission-ai/openspec@${kit.openspecVersion}`);
    else if (v !== kit.openspecVersion) lines.push(`sdd-kit WARNING: openspec CLI is ${v}, the kit is pinned to ${kit.openspecVersion}. Install the pinned version: npm i -g @fission-ai/openspec@${kit.openspecVersion}`);
  }
  const skills = join(root, '.claude', 'skills');
  if (existsSync(skills) && kit) {
    const { drift, failed } = skillDrift(root, kit, { version: v });
    if (failed) lines.push(`sdd-kit WARNING: the OpenSpec skill check could not run: ${failed}. See why: ${SKILLS_CHECK_COMMAND}`);
    else if (drift.length) {
      lines.push(`sdd-kit WARNING: OpenSpec skills differ from the kit profile: ${drift.join('; ')}. Probably a plain "openspec update" ran with a personal profile. Fix: ${SKILLS_FIX}`);
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
