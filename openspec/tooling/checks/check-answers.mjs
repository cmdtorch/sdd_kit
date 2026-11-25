#!/usr/bin/env node
// sdd-kit: managed file. Do not edit; local changes are overwritten on kit update.
// check-answers — are the clarifying questions answered and confirmed?
//
// Modes:
//   --artifact <id>   gate before writing <id>: its round (proposal→Main, specs→Specs, design→Design,
//                     verification-plan→Verification) must be complete and confirmed (used by hooks)
//   --round <name>    the named round must be complete and confirmed
//   (default)         consistency: every round whose artifact already exists must be confirmed (used by CI)
// A change under the new planning rules (lib/project.mjs usesNewPlanning; openspec/protocols/planning.md) has the
// rounds Main (proposal) and Technical (specs, design, verification-plan) and Apply; a round is closed, without a
// summary confirmation, when it holds a question or "No questions." and no blank answer. Its file also needs
// "Depth: low|medium|high", may record "Answer mode: chat|file|discussion", and each "Recommended: <letters> —
// <reason>" line must name options of its question. In the default mode it also reports each answer that changed
// after artifacts were written from it (the answers lock, lib/answers-lock.mjs); apply runs this before the first
// task. Earlier changes and the test-case schemas keep every rule above.
// Format problems in the file are always reported (errors for things that break gating, warnings otherwise).
// Before the first proposal of a change without screenshots, the Main round must hold the question marked
// "(UI mockups)" (openspec/protocols/ui-inventory.md §1).
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parseClarifications, roundStatus, answerLetters, describe, roundsFor, ROUND_FOR_ARTIFACT, KNOWN_ROUNDS, NEW_ROUNDS, DEPTH_LEVELS, ANSWER_MODES } from '../lib/clarifications.mjs';
import { changeDir, changeSchema, readChangeFile, isClarifyFamily, usesNewPlanning, CLARIFY_FAMILY } from '../lib/project.mjs';
import { makeReport, skippedReport, findingsFor, runCli, isMain, UsageError } from '../lib/report.mjs';
import { scanUiFolder, isUiMode, INVENTORY_FILE } from '../lib/ui-inventory.mjs';
import { lockDifferences } from '../lib/answers-lock.mjs';

const CHECK = 'check-answers';
const USAGE = `Usage: check-answers --change <name> [--artifact <id> | --round <Main|Specs|Design|Verification|Technical|Apply>] [--root <dir>] [--json]

Checks that clarifying questions in openspec/changes/<name>/clarifications.md are answered
and that the round summary is confirmed with exactly "Looks correct" (changes under the new planning
rules: the rounds Main, Technical and Apply are closed when no answer is blank).`;

export const MOCKUPS_MARK = '(UI mockups)';

/**
 * The mockups question is required only before the first proposal, and only while the change shows no
 * sign of mockups: no screenshot in sources/ui/ and no ui-inventory.md (left after deleting screenshots).
 */
function needsMockupsQuestion(dir, parsed) {
  if (existsSync(join(dir, 'proposal.md'))) return false;
  if (isUiMode(scanUiFolder(dir)) || existsSync(join(dir, INVENTORY_FILE))) return false;
  return ![...parsed.questions.values()].some((q) => q.round === 'Main' && q.title.includes(MOCKUPS_MARK));
}

const WAY_OUT = /not yet defined|not applicable|\bnone\b|\bnothing\b|not identified/i;

function artifactExists(dir, id) {
  if (id === 'specs') {
    const specs = join(dir, 'specs');
    if (!existsSync(specs)) return false;
    const walk = (d) => readdirSync(d, { withFileTypes: true }).some((e) => (e.isDirectory() ? walk(join(d, e.name)) : e.name.endsWith('.md')));
    return walk(specs);
  }
  return existsSync(join(dir, `${id}.md`));
}

/** Format findings shared by both rules: questions, follow-ups and answers. */
function checkQuestions(f, file, parsed) {
  for (const q of parsed.questions.values()) {
    if (q.answerLine === null) f.error(file, q.line, `Q${q.n} has no [Answer]: tag`);
    if (!q.why) f.warning(file, q.line, `Q${q.n} has no "Why this is asked:" line`);
    if (!q.options.some((o) => o.key === 'X')) f.warning(file, q.line, `Q${q.n} has no "X. Other (please specify)" option`);
    if (q.options.length && !q.options.some((o) => WAY_OUT.test(o.text))) {
      f.warning(file, q.line, `Q${q.n} has no "Not yet defined / Not applicable / None" option`);
    }
    for (const n of q.followUpOf) {
      if (!parsed.questions.has(n)) f.error(file, q.line, `Q${q.n} is a follow-up to Q${n}, which does not exist`);
      else if (n >= q.n) f.warning(file, q.line, `Q${q.n} follows up Q${n}, which comes later`);
    }
    if (q.answerLine !== null && q.answer && q.options.length) {
      const keys = new Set(q.options.map((o) => o.key));
      const unknown = answerLetters(q.answer).filter((l) => !keys.has(l));
      if (unknown.length) f.warning(file, q.answerLine, `Q${q.n} answer refers to option(s) ${unknown.join(', ')} that do not exist`);
    }
  }
}

/** The mockups question before the first proposal (openspec/protocols/ui-inventory.md §1). */
function checkMockups(f, file, dir, parsed, artifact) {
  if (artifact === 'proposal' && needsMockupsQuestion(dir, parsed)) {
    f.error(
      file,
      roundStatus(parsed, 'Main').round?.line ?? null,
      `the Main round has no question marked "${MOCKUPS_MARK}" (needed before writing proposal)`,
      `ask "Are there UI mockups for this change? ${MOCKUPS_MARK}" as the first Main round question (openspec/protocols/ui-inventory.md §1); on "yes" create sources/ui/ and wait for the screenshots`,
    );
  }
}

/** The file of a change under the new planning rules (openspec/protocols/planning.md). */
function checkNewRules({ f, file, dir, parsed, artifact, round, change, root }) {
  const PLANNING = 'openspec/protocols/planning.md';
  const levels = DEPTH_LEVELS.join(', ').replace(/, (?=[^,]*$)/, ' or ');
  const modes = ANSWER_MODES.join(', ').replace(/, (?=[^,]*$)/, ' or ');

  // --- format (always) -------------------------------------------------------------------------
  for (const p of parsed.problems) f.error(file, p.line, p.message);
  if (!parsed.sources.desc) f.warning(file, null, 'no [desc] entry under "## Sources"');
  if (parsed.depth === null) {
    f.error(file, null, `the "Depth:" line is missing — the level must be ${levels}`, 'write "Depth: <level>" under the title: the level the developer chose, otherwise "Depth: medium"');
  } else if (!DEPTH_LEVELS.includes(parsed.depth)) {
    f.error(file, parsed.depthLine, `Depth "${parsed.depth}" is unknown: the level must be ${levels}`, 'write the level the developer chose, otherwise "Depth: medium"');
  }
  if (parsed.answerMode !== null && !ANSWER_MODES.includes(parsed.answerMode)) {
    f.error(file, parsed.answerModeLine, `Answer mode "${parsed.answerMode}" is unknown: write chat, file or discussion`, `record the way the developer chose to answer: ${modes}`);
  }
  for (const r of parsed.rounds) {
    if (!NEW_ROUNDS.includes(r.name)) f.warning(file, r.line, `unknown round "${r.name}" (expected ${NEW_ROUNDS.join(', ')})`);
    if (r.noQuestions && r.questions.length) {
      f.error(file, r.noQuestionsLine, `"${r.name}" round has questions and the line "No questions."`, 'remove the line "No questions." from a round that asks questions');
    }
  }
  checkQuestions(f, file, parsed);
  for (const q of parsed.questions.values()) {
    const keys = new Set(q.options.map((o) => o.key));
    for (const rec of q.recommendations) {
      if (!rec.letters.length || !rec.reason) {
        f.error(file, rec.line, `Q${q.n}: the recommendation must read "Recommended: <letters> — <reason>"`, 'name the recommended option letters, comma-separated, then " — " and the source, spec or code it rests on; without such a basis write no recommendation');
        continue;
      }
      for (const l of rec.letters.filter((x) => !keys.has(x))) {
        f.error(file, rec.line, `Q${q.n}: the recommended option ${l} is not an option of the question`, `recommend one of ${[...keys].join(', ') || 'its options'}`);
      }
    }
  }

  // --- gating ----------------------------------------------------------------------------------
  let required;
  if (artifact) required = [NEW_ROUND_FOR(artifact)];
  else if (round) required = [round];
  else required = [...new Set(Object.keys(roundsFor(true).forArtifact).filter((id) => artifactExists(dir, id)).map(NEW_ROUND_FOR))];
  for (const name of required) {
    const st = roundStatus(parsed, name);
    const after = Object.keys(roundsFor(true).forArtifact).filter((id) => NEW_ROUND_FOR(id) === name && artifactExists(dir, id));
    const why = artifact ? ` (needed before writing ${artifact})` : round ? '' : ` (${after.join(', ')} already exist${after.length === 1 ? 's' : ''})`;
    if (!st.exists) {
      f.error(file, null, `"## ${name} round" is missing — the ${name} round has not been run${why}`, `run the ${name} round per ${PLANNING}`);
      continue;
    }
    for (const e of st.unanswered) {
      f.error(file, e.line, `${describe(e)} is not answered${why}`, 'get the answer from the developer and write it after [Answer]:; a recommendation is not an answer');
    }
    if (!st.round.questions.length && !st.round.noQuestions) {
      f.error(file, st.round.line, `"${name}" round has no question and no "No questions." line${why}`, `write the round's questions, or the line "No questions." when there is nothing to ask (${PLANNING})`);
    }
  }
  if (!artifact && !round) {
    for (const d of lockDifferences(root, change)) {
      const q = parsed.questions.get(d.n);
      f.error(
        file,
        q ? q.answerLine ?? q.line : null,
        `the answer to Q${d.n} changed after ${d.artifacts.join(', ')} ${d.artifacts.length === 1 ? 'was' : 'were'} written from the earlier answer`,
        `warn the developer and wait: update ${d.artifacts.length === 1 ? 'that artifact' : 'those artifacts'} only on the developer's word, or go on once the earlier answer is restored (${PLANNING}); no task starts meanwhile`,
      );
    }
  }
  checkMockups(f, file, dir, parsed, artifact);
  return makeReport(CHECK, f.list, { change, rounds: required });
}

const NEW_ROUND_FOR = (artifact) => roundsFor(true).forArtifact[artifact];

/** Runs the check. Options: { root, change, artifact?, round? }. */
export function checkAnswers({ root, change, artifact, round }) {
  if (!change) throw new UsageError('--change is required');
  const dir = changeDir(root, change);
  if (!existsSync(dir)) throw new UsageError(`change "${change}" not found at ${dir}`);
  const schema = changeSchema(root, change);
  if (!isClarifyFamily(schema)) return skippedReport(CHECK, `change "${change}" uses schema "${schema}" (question rounds exist only in ${CLARIFY_FAMILY.map((s) => `"${s}"`).join(', ')})`);
  const newPlanning = usesNewPlanning(root, change);
  const { forArtifact, known } = roundsFor(newPlanning);
  if (artifact && !(artifact in forArtifact)) {
    return skippedReport(CHECK, `artifact "${artifact}" does not depend on a question round`);
  }
  if (round && !known.includes(round)) throw new UsageError(`unknown round "${round}" (expected ${known.join(', ')})`);

  const file = join(dir, 'clarifications.md');
  const f = findingsFor(root);
  const content = readChangeFile(root, change, 'clarifications.md');
  if (content === null) {
    f.error(file, null, 'clarifications.md does not exist', 'create it first: it is the first artifact of the clarify schema');
    return makeReport(CHECK, f.list, { change });
  }
  const parsed = parseClarifications(content, { newPlanning });
  if (newPlanning) return checkNewRules({ f, file, dir, parsed, artifact, round, change, root });

  // --- format (always) -------------------------------------------------------------------------
  for (const p of parsed.problems) f.error(file, p.line, p.message);
  if (!parsed.sources.desc) f.warning(file, null, 'no [desc] entry under "## Sources"');
  for (const r of parsed.rounds) {
    if (!KNOWN_ROUNDS.includes(r.name)) f.warning(file, r.line, `unknown round "${r.name}" (expected ${KNOWN_ROUNDS.join(', ')})`);
  }
  checkQuestions(f, file, parsed);
  for (const r of parsed.rounds) {
    if (r.summary && r.summary.answerLine === null) f.error(file, r.summary.line, `${describe(r.summary)} has no [Answer]: tag`);
  }

  // --- gating ----------------------------------------------------------------------------------
  let required;
  if (artifact) required = [ROUND_FOR_ARTIFACT[artifact]];
  else if (round) required = [round];
  else required = Object.entries(ROUND_FOR_ARTIFACT).filter(([id]) => artifactExists(dir, id)).map(([, r]) => r);

  const INVALID_SUMMARY = (v) => v && !/^_*$/.test(v) && !['Looks correct', 'Request changes'].includes(v);
  for (const r of parsed.rounds) {
    if (!required.includes(r.name) && r.summary && INVALID_SUMMARY(r.summary.answer)) {
      f.warning(file, r.summary.answerLine, `${describe(r.summary)} answer "${r.summary.answer}" must be exactly "Looks correct" or "Request changes"`);
    }
  }
  for (const name of required) {
    const st = roundStatus(parsed, name);
    const why = artifact ? ` (needed before writing ${artifact})` : round ? '' : ` (${Object.keys(ROUND_FOR_ARTIFACT).find((k) => ROUND_FOR_ARTIFACT[k] === name)} already exists)`;
    if (!st.exists) {
      f.error(file, null, `"## ${name} round" is missing${why}`, `run the ${name} round per openspec/protocols/questions.md`);
      continue;
    }
    for (const e of st.unanswered) {
      f.error(file, e.line, `${describe(e)} is not answered${why}`, e.kind === 'changes' ? 'ask "What should change?" and record the reply' : 'get the answer from the user and write it after [Answer]:');
    }
    if (!st.round.summary) {
      f.error(file, st.round.line, `"${name}" round has no summary confirmation${why}`, 'add "### Summary confirmation — ' + name + ' round" and ask the user to confirm');
    } else if (st.summaryAnswer === null || st.summaryAnswer === '' || /^_*$/.test(st.summaryAnswer)) {
      f.error(file, st.round.summary.line, `"${name}" round summary is not confirmed yet${why}`, 'ask the user: Looks correct / Request changes');
    } else if (st.summaryAnswer === 'Request changes') {
      f.error(file, st.round.summary.line, `"${name}" round summary says "Request changes"${why}`, 'apply the requested changes, reset the summary answer and confirm again');
    } else if (st.summaryAnswer !== 'Looks correct') {
      f.error(file, st.round.summary.answerLine, `"${name}" round summary answer "${st.summaryAnswer}" must be exactly "Looks correct"${why}`, 'no letters, numbers or notes — store exactly "Looks correct" or "Request changes"');
    }
  }
  checkMockups(f, file, dir, parsed, artifact);
  return makeReport(CHECK, f.list, { change, rounds: required });
}

if (isMain(import.meta.url)) {
  runCli(CHECK, USAGE, (args, root) => checkAnswers({ root, change: args.change, artifact: args.artifact, round: args.round }));
}
