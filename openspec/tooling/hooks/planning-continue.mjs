#!/usr/bin/env node
// sdd-kit: managed file. Do not edit; local changes are overwritten on kit update.
// planning-continue — Stop hook. Planning goes on without /opsx:continue (openspec/protocols/planning.md): when the
// agent tries to end its turn after it wrote an artifact of a change in this session, and nothing waits for the
// developer, the hook keeps the turn going and names the next step: the next artifact from
// `openspec status --change <name> --json`, or, on clarify, the question round that artifact depends on when that
// round is not prepared yet (the Technical round after the proposal).
// Only changes under the new planning rules (lib/project.mjs usesNewPlanning: stamped 0.6.0 or later, clarify or
// lean); older, unstamped and test-case-schema changes keep their workflow. The turn ends (no output) when:
//   - the session wrote no artifact of a new-rules change (lib/session-state.mjs, recorded by artifact-feedback);
//   - the developer paused planning, or the agent marked a wait (bin/planning.mjs pause | wait);
//   - a question of clarifications.md has a blank answer;
//   - the mockups were answered "yes" and sources/ui/ holds no screenshot yet (lean: sources/ui/ exists and is
//     empty before the proposal);
//   - an answer differs from the one a written artifact was based on (lib/answers-lock.mjs);
//   - planning is complete, or the CLI gives no next artifact;
//   - the hook asked twice in a row for the same next step without a new artifact (loop guard: Claude Code does not
//     limit repeated blocks, docs/openspec-facts.md K14); a new message of the developer starts the count again.
// Fails open: any error lets the turn end.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { runHook, hookRoot, blockStop } from '../lib/hook-io.mjs';
import { changeDir, changeSchema, isClarifyFamily, readChangeFile, usesNewPlanning } from '../lib/project.mjs';
import { parseClarifications, roundStatus, roundsFor, isBlankAnswer, answerLetters } from '../lib/clarifications.mjs';
import { lockDifferences } from '../lib/answers-lock.mjs';
import { scanUiFolder, isUiMode, INVENTORY_FILE, UI_DIR } from '../lib/ui-inventory.mjs';
import { readSession, writeSession, canonicalRoot } from '../lib/session-state.mjs';
import { MOCKUPS_MARK } from '../checks/check-answers.mjs';
import { isMain } from '../lib/report.mjs';

/** Continuations in a row for the same next step without a new artifact. */
export const MAX_CONTINUATIONS = 2;
const PLANNING_CMD = 'node openspec/tooling/bin/planning.mjs';

function parsedClarifications(root, change) {
  const content = readChangeFile(root, change, 'clarifications.md');
  return content === null ? null : parseClarifications(content, { newPlanning: true });
}

/** No accepted screenshot and no ui-inventory.md (left once screenshots were handled). */
function noScreenshots(dir) {
  return !existsSync(join(dir, INVENTORY_FILE)) && !isUiMode(scanUiFolder(dir));
}

/** True when an answer means "yes": its option text, or the free text, starts with "yes". */
function saysYes(question) {
  const answer = question.answer.trim();
  const letters = answerLetters(answer);
  const texts = letters.map((l) => question.options.find((o) => o.key === l)?.text ?? '');
  texts.push(letters.length ? answer.replace(/^[A-Z](?:\s*,\s*[A-Z])*\s*[—–:.-]?\s*/, '') : answer);
  return texts.some((t) => /^yes\b/i.test(t.trim()));
}

/** clarify: the mockups question is answered "yes", not followed up, and no screenshot is in place. */
function waitsForScreenshots(dir, parsed) {
  const questions = [...parsed.questions.values()];
  const q = questions.find((x) => x.round === 'Main' && x.title.includes(MOCKUPS_MARK));
  if (!q || isBlankAnswer(q.answer) || !saysYes(q)) return false;
  if (questions.some((f) => f.followUpOf.includes(q.n) && !isBlankAnswer(f.answer))) return false;
  return noScreenshots(dir);
}

/** Why the change waits for the developer, or null when nothing does. */
export function humanNeeded(root, change, schema) {
  const dir = changeDir(root, change);
  const proposal = existsSync(join(dir, 'proposal.md'));
  if (isClarifyFamily(schema)) {
    const parsed = parsedClarifications(root, change);
    if (parsed) {
      for (const r of parsed.rounds) if (roundStatus(parsed, r.name).unanswered.length) return `the ${r.name} round has an unanswered question`;
      if (!proposal && waitsForScreenshots(dir, parsed)) return 'the screenshots of the mockups are not in place yet';
    }
    if (lockDifferences(root, change).length) return 'an answer changed after artifacts were written from it';
    return null;
  }
  if (!proposal && existsSync(join(dir, UI_DIR)) && noScreenshots(dir)) return 'the screenshots of the mockups are not in place yet';
  return null;
}

/** `openspec status --change <name> --json`, or null when the CLI fails. */
export function openspecStatus(root, change) {
  const xdg = join(root, 'openspec', 'tooling', 'xdg');
  const r = spawnSync(process.env.OPENSPEC_BIN || 'openspec', ['status', '--change', change, '--json'], {
    cwd: root,
    encoding: 'utf8',
    timeout: 15000,
    env: { ...process.env, ...(existsSync(xdg) ? { XDG_CONFIG_HOME: xdg } : {}), OPENSPEC_TELEMETRY: '0', DO_NOT_TRACK: '1' },
  });
  if (r.error || r.status !== 0 || typeof r.stdout !== 'string') return null;
  const at = r.stdout.indexOf('{');
  if (at === -1) return null;
  try {
    return JSON.parse(r.stdout.slice(at));
  } catch {
    return null;
  }
}

/**
 * The next step of planning from the CLI status: { kind: 'artifact', artifact, key } or, on clarify, when the round
 * the next artifact depends on is not prepared yet, { kind: 'round', round, artifact, key }; null when planning is
 * complete or nothing is ready.
 */
export function nextStep(root, change, schema, status) {
  if (!status || status.isPlanningComplete || !Array.isArray(status.artifacts)) return null;
  const ready = status.artifacts.find((a) => a && a.status === 'ready');
  if (!ready || typeof ready.id !== 'string') return null;
  const round = isClarifyFamily(schema) ? roundsFor(true).forArtifact[ready.id] : null;
  if (round) {
    const parsed = parsedClarifications(root, change);
    if (parsed && !roundStatus(parsed, round).confirmed) return { kind: 'round', round, artifact: ready.id, key: `round:${round}` };
  }
  return { kind: 'artifact', artifact: ready.id, key: ready.id };
}

/** The message that keeps the agent working. */
export function reasonFor(change, step) {
  const lines = [`sdd-kit: planning of change "${change}" goes on without a command (openspec/protocols/planning.md).`];
  if (step.kind === 'round') {
    const asks = step.round === 'Technical' ? 'the questions about the specs and the design forks' : 'its questions';
    lines.push(
      `Prepare its ${step.round} round now: add the section "## ${step.round} round" to clarifications.md with ${asks}, or the line "No questions." when there are none. The ${step.artifact} come${step.artifact === 'specs' ? '' : 's'} once the round is closed; while a question waits for an answer, end the turn and tell the developer.`,
    );
  } else {
    lines.push(`Write it now — next artifact: ${step.artifact} (openspec instructions ${step.artifact} --change "${change}" --json).`);
  }
  lines.push(
    'Do not ask the developer to run /opsx:continue.',
    `End the turn instead only where a human is needed: when you asked the developer something in the chat, or an artifact check still fails (or its write stays blocked) after your second fix attempt, run \`${PLANNING_CMD} wait --change ${change}\` and tell the developer what you need (the remaining errors, the cause only they can remove). When the developer asked to stop or pause, run \`${PLANNING_CMD} pause --change ${change}\`.`,
  );
  return lines.join('\n');
}

/** { block: reason } to keep the turn going, or { end: why } to let it end. */
export function decide(input) {
  const root = hookRoot(input);
  if (!root) return { end: 'no project' };
  const state = readSession(input.session_id);
  if (!state || typeof state.change !== 'string' || !state.change) return { end: 'no change in this session' };
  if (canonicalRoot(state.root) !== canonicalRoot(root)) return { end: 'another project' };
  const change = state.change;
  if (!existsSync(join(changeDir(root, change), '.openspec.yaml'))) return { end: 'change gone' };
  if (!usesNewPlanning(root, change)) return { end: 'earlier planning rules' };
  if (state.pause) return { end: 'paused' };
  if (state.wait) return { end: 'waiting for the developer' };
  const schema = changeSchema(root, change);
  const human = humanNeeded(root, change, schema);
  if (human) return { end: human };
  const step = nextStep(root, change, schema, openspecStatus(root, change));
  if (!step) return { end: 'planning complete or nothing ready' };
  const same = input.stop_hook_active !== false && state.next === step.key;
  const continuations = (same ? Number(state.continuations) || 0 : 0) + 1;
  if (continuations > MAX_CONTINUATIONS) {
    writeSession(input.session_id, { ...state, continuations, next: step.key });
    return { end: 'no new artifact after two continuations' };
  }
  writeSession(input.session_id, { ...state, continuations, next: step.key });
  return { block: reasonFor(change, step) };
}

if (isMain(import.meta.url)) {
  runHook('planning-continue', (input) => {
    const result = decide(input);
    if (result.block) blockStop(result.block);
  });
}
