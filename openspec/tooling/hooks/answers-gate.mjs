#!/usr/bin/env node
// sdd-kit: managed file. Do not edit; local changes are overwritten on kit update.
// answers-gate — PreToolUse hook (Write|Edit|MultiEdit|Bash).
// Blocks writing a clarify-family artifact while the question round it depends on is unanswered or
// unconfirmed (proposal→Main, specs→Specs, design→Design, verification-plan→Verification).
// On a test-case schema (clarify-ai-qa, clarify-qa) design.md also needs a complete test-cases stage
// (check-test-cases --stage); a blocked spec write during that stage says the Specs round was reopened.
// UI sources (openspec/protocols/ui-inventory.md), on all four kit schemas, lean included: writing proposal.md,
// a spec, test-cases.md, design.md, verification-plan.md or tasks.md runs check-ui at the stage of that
// artifact (uiStageFor), judging the files already in the change; errors about the file being written are
// left out, so it can always be fixed. A clarifications.md write that adds a `### Q` heading is blocked while
// sources/ui/ holds screenshots and ui-inventory.md does not exist. No other UI rule touches
// clarifications.md or ui-inventory.md. Lean gets only the UI check (it has no question rounds).
// Manual reasons, on all four kit schemas, for a change stamped with the kit version (x-sdd-kit): tasks.md is
// blocked while check-traceability reports a `manual` plan row without a valid reason or a dangerous scenario
// without an automated row (openspec/protocols/testing.md §1); on the test-case schemas design.md is blocked
// by the same rule for test cases through check-test-cases --stage.
// Meta-repository changes (x-sdd-kit-metarepo: true; openspec/protocols/metarepo.md): tasks.md is blocked while
// check-tasks reports a task group without exactly one known repository, judged on the content about to be
// written (Write: `content`; Edit / MultiEdit: the current file with the replacements applied; when they cannot
// be applied the write passes and artifact-feedback reports the result).
// Meta-repository guard (openspec/clones exists; openspec/protocols/metarepo.md): a write into a declared clone's
// own `openspec/` folder is blocked with a message naming the clone, whatever the change: Write / Edit /
// MultiEdit, and shell writes (redirects, tee, sed -i / perl -i, cp / mv / install / rsync / ln targets, mv
// sources, rm, rmdir, truncate, touch, dd of=), with a relative or absolute path. Reading is not guarded, nor a
// path reached after `cd` in the same command (it resolves against the session folder).
// Bash: a command that writes to such an artifact (redirect, tee, cp, mv, sed -i, ...) is gated too;
// this is a heuristic — CI (check-answers) is the backstop.
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve, relative, isAbsolute } from 'node:path';
import { runHook, hookRoot, touchedFiles, block, absPath } from '../lib/hook-io.mjs';
import { locateInChange, changeSchema, changeDir, isClarifyFamily, isKitSchema, hasTestCases, isStamped } from '../lib/project.mjs';
import { checkUi, uiStageFor } from '../checks/check-ui.mjs';
import { scanUiFolder, isUiMode, INVENTORY_FILE, UI_DIR } from '../lib/ui-inventory.mjs';
import { ROUND_FOR_ARTIFACT } from '../lib/clarifications.mjs';
import { checkAnswers } from '../checks/check-answers.mjs';
import { checkTestCases } from '../checks/check-test-cases.mjs';
import { checkTraceability } from '../checks/check-traceability.mjs';
import { checkTasks } from '../checks/check-tasks.mjs';
import { TEST_CASES_FILE } from '../lib/test-cases.mjs';
import { isMain } from '../lib/report.mjs';
import { isMetarepo, readClones } from '../lib/clones.mjs';

const MAX_LISTED = 8;
const GATED_PATH = /(?:^|[\s'"=(])((?:\.\/)?(?:[^\s'"]*\/)?openspec\/changes\/[^\s'"/]+\/(?:proposal\.md|design\.md|verification-plan\.md|specs\/[^\s'"]+\.md))/g;
const WRITES = /(^|[^<>&0-9])>>?|\btee\b|\bcp\b|\bmv\b|\bsed\s+(-[a-zA-Z]*i|--in-place)|\bperl\s+-[a-zA-Z]*i|\bdd\b|\btruncate\b|\binstall\b|\brsync\b|writeFile|open\(.*['"]w/;

/** Gated targets of a Bash command (paths of kit artifacts it appears to write). */
export function bashTargets(command) {
  if (!WRITES.test(command)) return [];
  return [...command.matchAll(GATED_PATH)].map((m) => m[1]);
}

function listErrors(report) {
  const errors = report.findings.filter((f) => f.level === 'error');
  const lines = errors.slice(0, MAX_LISTED).map((f) => `  - ${f.file ? `${f.file}${f.line ? `:${f.line}` : ''}: ` : ''}${f.message}`);
  if (errors.length > MAX_LISTED) lines.push(`  - ... and ${errors.length - MAX_LISTED} more`);
  return lines;
}

function explain(change, artifact, report, duringTestCases) {
  const round = ROUND_FOR_ARTIFACT[artifact];
  const lines = [
    `sdd-kit answers-gate: ${artifact} of change "${change}" cannot be written yet — the ${round} round in clarifications.md is not complete and confirmed.`,
    ...listErrors(report),
  ];
  if (duringTestCases) {
    lines.push(
      'The test-cases stage reopened the Specs round with a follow-up question (openspec/protocols/test-cases.md §4.3). Change the delta specs only after the developer has answered it and confirmed the Specs round summary again; until then do not run the test-cases reviewer.',
    );
  }
  lines.push(
    `Continue the question protocol (openspec/protocols/questions.md): ask the user, write the answers into clarifications.md, analyse them, then get an explicit "Looks correct" on the ${round} round summary. Do not write ${artifact} any other way.`,
  );
  return lines.join('\n');
}

function explainTestCases(change, report) {
  return [
    `sdd-kit answers-gate: design of change "${change}" cannot be written yet — the test-cases stage is not complete.`,
    ...listErrors(report),
    'Continue the test-cases stage (openspec/protocols/test-cases.md): fix the test cases, settle every blocker and major finding of the AI QA review, and get an explicit "Looks correct" in "Stage result" of test-cases.md. Do not write design.md any other way.',
  ].join('\n');
}

function explainManual(change, report) {
  return [
    `sdd-kit answers-gate: tasks of change "${change}" cannot be written yet — the verification plan has manual checks without a valid reason.`,
    ...listErrors(report),
    'A check is manual only when it cannot be automated or the function is dangerous (openspec/protocols/testing.md §1): give each manual row a "Manual reason" starting with "cannot be automated:" or "dangerous:", or plan it as unit / integration. A dangerous scenario also needs an automated row. Do not write tasks.md any other way.',
  ].join('\n');
}

/** tasks.md of a stamped change waits for valid manual reasons in the plan. */
function manualGate(root, change) {
  if (!isStamped(root, change)) return null;
  const report = checkTraceability({ root, change, markers: null });
  const findings = report.findings.filter((f) => f.rule === 'manual-reason');
  return findings.length ? explainManual(change, { ...report, findings }) : null;
}

/**
 * The file a Write / Edit / MultiEdit call would leave at `path`; null when it cannot be computed (an
 * old_string that is not in the file, or a Bash call).
 */
export function contentAfter(input, path) {
  const ti = input.tool_input || {};
  if (input.tool_name === 'Bash') return null;
  if (typeof ti.content === 'string') return ti.content;
  const edits = Array.isArray(ti.edits) ? ti.edits.filter((e) => !e.file_path || absPath(input, e.file_path) === path) : [ti];
  let text = existsSync(path) ? readFileSync(path, 'utf8') : '';
  for (const e of edits) {
    if (typeof e.old_string !== 'string' || typeof e.new_string !== 'string') return null;
    if (e.old_string === '') {
      if (text !== '') return null;
      text = e.new_string;
      continue;
    }
    if (!text.includes(e.old_string)) return null;
    text = e.replace_all ? text.split(e.old_string).join(e.new_string) : text.replace(e.old_string, () => e.new_string);
  }
  return text;
}

/** tasks.md of a meta-repository change: every task group names its repository (check-tasks). */
function tasksGate(root, change, input, path) {
  const content = contentAfter(input, path);
  if (content === null) return null;
  const report = checkTasks({ root, change, content });
  if (!report.findings.some((f) => f.level === 'error')) return null;
  return [
    `sdd-kit answers-gate: tasks of change "${change}" cannot be written yet — every task group names the repository it runs in (openspec/protocols/metarepo.md).`,
    ...listErrors(report),
    'Start each group heading with one repository, "## 2. [backend] Order API": a clone name of openspec/clones or root; only the last of two or more groups (the final checks) may name none. Split a group that touches two repositories. Do not write tasks.md any other way.',
  ].join('\n');
}

function explainUi(change, artifact, report) {
  return [
    `sdd-kit answers-gate: ${artifact} of change "${change}" cannot be written yet — the UI check (check-ui) reports errors in the change's screenshots or UI inventory.`,
    ...listErrors(report),
    `Fix them first (openspec/protocols/ui-inventory.md): open the screenshots named above, update ${INVENTORY_FILE}, the specs or design.md as the messages say, and ask about new or changed elements in the current question round where the schema has one. Do not write ${artifact} any other way.`,
  ].join('\n');
}

const Q_HEADING = /^###\s+Q\d+\b/gm;
const countQuestions = (text) => (typeof text === 'string' ? (text.match(Q_HEADING) || []).length : 0);

/** Whether a Write / Edit / MultiEdit call adds a `### Q<n>` heading to the file at `path`. */
export function addsQuestion(input, path) {
  const ti = input.tool_input || {};
  if (typeof ti.content === 'string') {
    const old = existsSync(path) ? readFileSync(path, 'utf8') : '';
    return countQuestions(ti.content) > countQuestions(old);
  }
  const edits = Array.isArray(ti.edits) ? ti.edits.filter((e) => !e.file_path || absPath(input, e.file_path) === path) : [ti];
  return edits.some((e) => countQuestions(e.new_string) > countQuestions(e.old_string));
}

/** Main round questions wait for the UI inventory while screenshots exist. */
function questionsGate(root, change, input, path) {
  if (input.tool_name === 'Bash' || !addsQuestion(input, path)) return null;
  const dir = changeDir(root, change);
  if (!isUiMode(scanUiFolder(dir)) || existsSync(join(dir, INVENTORY_FILE))) return null;
  return [
    `sdd-kit answers-gate: questions cannot be added to clarifications.md of change "${change}" yet — ${UI_DIR}/ holds screenshots and ${INVENTORY_FILE} does not exist.`,
    `Write the UI inventory first (openspec/protocols/ui-inventory.md): open every screenshot, list its screens, interactive elements and states with fingerprints in ${INVENTORY_FILE}, then ask the Main round questions about them.`,
  ].join('\n');
}

/** check-ui at the stage of the artifact; errors about the file being written itself are left out. */
function uiGate(root, change, schema, artifact, path) {
  const stage = uiStageFor(schema, artifact);
  if (!stage) return null;
  const report = checkUi({ root, change, stage });
  const own = (f) => f.file && resolve(root, f.file) === path;
  const findings = report.findings.filter((f) => !(f.level === 'error' && own(f)));
  if (!findings.some((f) => f.level === 'error')) return null;
  return explainUi(change, artifact, { ...report, findings });
}

// --- Guard of a clone's own OpenSpec (meta-repository) -------------------------------------------------------

/** Words of one shell command line, split into simple commands: [[word, ...], ...]; quotes are removed. */
function shellCommands(command) {
  const commands = [];
  let words = [];
  let word = '';
  let has = false;
  const endWord = () => {
    if (has) words.push(word);
    word = '';
    has = false;
  };
  const endCommand = () => {
    endWord();
    if (words.length) commands.push(words);
    words = [];
  };
  const s = String(command);
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === "'" || ch === '"') {
      const close = s.indexOf(ch, i + 1);
      const end = close === -1 ? s.length : close;
      word += s.slice(i + 1, end);
      has = true;
      i = end;
    } else if (ch === '\\' && i + 1 < s.length) {
      word += s[++i];
      has = true;
    } else if (/\s/.test(ch) && ch !== '\n') {
      endWord();
    } else if (ch === '\n' || ch === ';' || ch === '|' || ch === '&' || ch === '(' || ch === ')') {
      // `2>&1` and `&>` stay redirects
      if (ch === '&' && (s[i - 1] === '>' || s[i + 1] === '>')) {
        word += ch;
        has = true;
        continue;
      }
      endCommand();
    } else if (ch === '>' || ch === '<') {
      // a redirect is a word of its own: `>`, `>>`, `2>`, `&>`, followed by its target
      const fd = /^[0-9&]?$/.test(word) ? word : null;
      if (fd === null) endWord();
      let op = (fd ?? '') + ch;
      if (s[i + 1] === ch) op += s[++i];
      word = '';
      has = false;
      words.push(op);
    } else {
      word += ch;
      has = true;
    }
  }
  endCommand();
  return commands;
}

const WRITE_TOOLS = new Set(['Write', 'Edit', 'MultiEdit']);
const FILE_ARGS = new Set(['tee', 'rm', 'rmdir', 'unlink', 'truncate', 'touch', 'shred']);
const TARGET_LAST = new Set(['cp', 'install', 'rsync', 'ln']);

/** Paths a shell command line writes, moves or removes (a heuristic: CI is the backstop). */
export function shellWriteTargets(command) {
  const targets = [];
  for (const words of shellCommands(command)) {
    const plain = [];
    for (let k = 0; k < words.length; k++) {
      const w = words[k];
      if (/^[0-9&]?>>?$/.test(w)) {
        const t = words[++k];
        if (t && !t.startsWith('&')) targets.push(t);
      } else if (/^[0-9]?<<?$/.test(w)) k++;
      else plain.push(w);
    }
    let i = 0;
    while (i < plain.length && (/^[A-Za-z_][A-Za-z0-9_]*=/.test(plain[i]) || ['sudo', 'command', 'env', 'nohup', 'time'].includes(plain[i]))) i++;
    const cmd = (plain[i] || '').split('/').pop();
    const args = plain.slice(i + 1);
    const operands = args.filter((a) => !a.startsWith('-'));
    if (FILE_ARGS.has(cmd)) targets.push(...operands);
    else if ((cmd === 'sed' || cmd === 'perl') && args.some((a) => /^-[a-zA-Z]*i/.test(a) || a.startsWith('--in-place'))) targets.push(...operands);
    else if (cmd === 'mv') targets.push(...operands);
    else if (TARGET_LAST.has(cmd)) {
      const t = args.findIndex((a) => a === '-t' || a === '--target-directory');
      if (t !== -1 && args[t + 1]) targets.push(args[t + 1]);
      else if (operands.length) targets.push(operands[operands.length - 1]);
    } else if (cmd === 'dd') targets.push(...args.filter((a) => a.startsWith('of=')).map((a) => a.slice(3)));
  }
  return targets.filter(Boolean);
}

/** The declared clone whose own `openspec/` folder holds the absolute path `abs`, or null. */
function cloneOpenspecOf(root, clones, abs) {
  const rel = relative(root, abs).split('\\').join('/');
  if (!rel || rel.startsWith('../') || isAbsolute(rel)) return null;
  return clones.find((c) => rel === `${c.path}/openspec` || rel.startsWith(`${c.path}/openspec/`)) || null;
}

/** Blocks a write into a declared clone's own OpenSpec from a session started in the root. */
export function cloneGuard(root, input) {
  if (!isMetarepo(root)) return null;
  const { clones } = readClones(root);
  if (!clones.length) return null;
  const base = input.cwd || root;
  const paths =
    input.tool_name === 'Bash'
      ? shellWriteTargets(String(input.tool_input?.command || '')).map((p) => resolve(base, p))
      : WRITE_TOOLS.has(input.tool_name)
        ? touchedFiles(input)
        : [];
  for (const abs of paths) {
    const clone = cloneOpenspecOf(root, clones, abs);
    if (!clone) continue;
    return [
      `sdd-kit answers-gate: ${relative(root, abs)} belongs to the OpenSpec of the clone \`${clone.name}\` (${clone.path}), not to this meta-repository.`,
      `A clone's own OpenSpec is not edited from the meta-repository root (openspec/protocols/metarepo.md): work on it from a session started in ${clone.path}. Reading it from here is fine. Do not write it any other way.`,
    ].join('\n');
  }
  return null;
}

export function gate(input) {
  const root = hookRoot(input);
  if (!root) return null;
  const guarded = cloneGuard(root, input);
  if (guarded) return guarded;
  let targets = [];
  if (input.tool_name === 'Bash') {
    const cmd = String(input.tool_input?.command || '');
    targets = bashTargets(cmd).map((p) => (p.startsWith('/') ? p : `${input.cwd || root}/${p.replace(/^\.\//, '')}`));
  } else {
    targets = touchedFiles(input);
  }
  for (const path of targets) {
    const loc = locateInChange(root, path);
    if (!loc || !loc.artifact) continue;
    if (!existsSync(changeDir(root, loc.change))) continue;
    const schema = changeSchema(root, loc.change);
    if (!isKitSchema(schema)) continue;
    const abs = resolve(path);
    if (loc.artifact === 'clarifications') {
      const msg = questionsGate(root, loc.change, input, abs);
      if (msg) return msg;
      continue;
    }
    if (isClarifyFamily(schema) && loc.artifact in ROUND_FOR_ARTIFACT) {
      const report = checkAnswers({ root, change: loc.change, artifact: loc.artifact });
      if (!report.ok) {
        const duringTestCases = loc.artifact === 'specs' && hasTestCases(schema) && existsSync(join(changeDir(root, loc.change), TEST_CASES_FILE));
        return explain(loc.change, loc.artifact, report, duringTestCases);
      }
      if (loc.artifact === 'design' && hasTestCases(schema)) {
        const stage = checkTestCases({ root, change: loc.change, stage: true });
        if (!stage.ok) return explainTestCases(loc.change, stage);
      }
    }
    if (loc.artifact === 'tasks') {
      const manual = manualGate(root, loc.change);
      if (manual) return manual;
      const repos = tasksGate(root, loc.change, input, abs);
      if (repos) return repos;
    }
    const ui = uiGate(root, loc.change, schema, loc.artifact, abs);
    if (ui) return ui;
  }
  return null;
}

if (isMain(import.meta.url)) {
  runHook('answers-gate', (input) => {
    const message = gate(input);
    if (message) block(message);
  });
}
