#!/usr/bin/env node
// sdd-kit: managed file. Do not edit; local changes are overwritten on kit update.
// check-answers — are the clarifying questions answered and confirmed?
//
// Modes:
//   --artifact <id>   gate before writing <id>: its round (proposal→Main, specs→Specs, design→Design,
//                     verification-plan→Verification) must be complete and confirmed (used by hooks)
//   --round <name>    the named round must be complete and confirmed
//   (default)         consistency: every round whose artifact already exists must be confirmed (used by CI)
// Format problems in the file are always reported (errors for things that break gating, warnings otherwise).
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parseClarifications, roundStatus, answerLetters, describe, ROUND_FOR_ARTIFACT, KNOWN_ROUNDS } from '../lib/clarifications.mjs';
import { changeDir, changeSchema, readChangeFile } from '../lib/project.mjs';
import { makeReport, skippedReport, findingsFor, runCli, isMain, UsageError } from '../lib/report.mjs';

const CHECK = 'check-answers';
const USAGE = `Usage: check-answers --change <name> [--artifact <id> | --round <Main|Specs|Design|Verification|Apply>] [--root <dir>] [--json]

Checks that clarifying questions in openspec/changes/<name>/clarifications.md are answered
and that the round summary is confirmed with exactly "Looks correct".`;

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

/** Runs the check. Options: { root, change, artifact?, round? }. */
export function checkAnswers({ root, change, artifact, round }) {
  if (!change) throw new UsageError('--change is required');
  const dir = changeDir(root, change);
  if (!existsSync(dir)) throw new UsageError(`change "${change}" not found at ${dir}`);
  const schema = changeSchema(root, change);
  if (schema !== 'clarify') return skippedReport(CHECK, `change "${change}" uses schema "${schema}" (question rounds exist only in "clarify")`);
  if (artifact && !(artifact in ROUND_FOR_ARTIFACT)) {
    return skippedReport(CHECK, `artifact "${artifact}" does not depend on a question round`);
  }
  if (round && !KNOWN_ROUNDS.includes(round)) throw new UsageError(`unknown round "${round}" (expected ${KNOWN_ROUNDS.join(', ')})`);

  const file = join(dir, 'clarifications.md');
  const f = findingsFor(root);
  const content = readChangeFile(root, change, 'clarifications.md');
  if (content === null) {
    f.error(file, null, 'clarifications.md does not exist', 'create it first: it is the first artifact of the clarify schema');
    return makeReport(CHECK, f.list, { change });
  }
  const parsed = parseClarifications(content);

  // --- format (always) -------------------------------------------------------------------------
  for (const p of parsed.problems) f.error(file, p.line, p.message);
  if (!parsed.sources.desc) f.warning(file, null, 'no [desc] entry under "## Sources"');
  for (const r of parsed.rounds) {
    if (!KNOWN_ROUNDS.includes(r.name)) f.warning(file, r.line, `unknown round "${r.name}" (expected ${KNOWN_ROUNDS.join(', ')})`);
  }
  for (const q of parsed.questions.values()) {
    if (q.answerLine === null) f.error(file, q.line, `Q${q.n} has no [Answer]: tag`);
    if (!q.for) f.warning(file, q.line, `Q${q.n} has no "For: Dev | PO/PM" line`);
    else if (!/^(Dev|PO\/PM)$/.test(q.for)) f.warning(file, q.line, `Q${q.n} has "For: ${q.for}" (expected Dev or PO/PM)`);
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
  return makeReport(CHECK, f.list, { change, rounds: required });
}

if (isMain(import.meta.url)) {
  runCli(CHECK, USAGE, (args, root) => checkAnswers({ root, change: args.change, artifact: args.artifact, round: args.round }));
}
