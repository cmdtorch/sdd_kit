#!/usr/bin/env node
// sdd-kit: managed file. Do not edit; local changes are overwritten on kit update.
// check-e2e — the E2E stage record `e2e.md` of a change (openspec/protocols/e2e.md), on all kit schemas
// (clarify, clarify-ai-qa, clarify-qa, lean).
//
// --mode format (default; run after e2e.md is written): the format of e2e.md — the mode is real backend,
//   stubbed backend or skipped; unless skipped, the E2E test folder ("Tests:") and how the application is
//   started ("Start: command <cmd>" or "Start: developer at <url>") are recorded; every accepted case has a
//   reason; every screens row has a known result and an accepted difference has a reason; list items of
//   "## Scenarios" and "## No new run needed" are well formed. A change without e2e.md has nothing to check.
// --mode archive (run by the archive gate): the decision — on clarify-ai-qa / clarify-qa e2e.md is
//   required (the E2E decision is missing without it); on clarify / lean a change without e2e.md does not
//   use E2E; then the format checks, plus, unless E2E is skipped:
//   coverage — on clarify-ai-qa / clarify-qa every test case labelled `e2e` (test-cases.md), on clarify /
//     lean every scenario under "## Scenarios" (which must exist in the delta specs), has a test in the E2E
//     test folder that references it (@case / @scenario); tests outside the folder do not count;
//   runs — at least one run recorded by e2e-run.mjs in e2e-runs.json; a run used for a result has
//     retries 0; project files did not change after the latest run (unless that state is listed under
//     "## No new run needed");
//   results — every covered case or scenario that is not under "## Accepted cases" has a valid passed
//     latest result. A result is valid while project files outside the test folder are unchanged since its
//     run (or the current state is listed under "## No new run needed"), its own test file is unchanged, and
//     every shared file of the test folder (a file no recorded test lives in) is unchanged;
//   screens — in UI mode (a screenshot in sources/ui/), every screenshot has a "## Screens" row, and no row
//     has the result `differences` (an open difference); `accepted` with a reason passes. Without
//     screenshots there is no visual check.
// Skipped for schemas outside the kit.
import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { parseE2eRecord, E2E_FILE, MODES, SKIPPED, SCREEN_RESULTS, ACCEPTED, DIFFERENCES } from '../lib/e2e-record.mjs';
import { RUNS_FILE, normFolder, projectState, readRuns, stateId } from '../lib/e2e-runs.mjs';
import { collectCaseRefs, collectMarkers } from '../lib/markers.mjs';
import { parseTestCases, TEST_CASES_FILE } from '../lib/test-cases.mjs';
import { loadChangeDeltas, changeScenarios } from '../lib/spec-parser.mjs';
import { scanUiFolder, isUiMode, UI_DIR } from '../lib/ui-inventory.mjs';
import { changeDir, changeSchema, readChangeFile, isKitSchema, hasTestCases, KIT_SCHEMAS } from '../lib/project.mjs';
import { makeReport, skippedReport, findingsFor, runCli, isMain, UsageError } from '../lib/report.mjs';

const CHECK = 'check-e2e';
export const E2E_CHECK_MODES = ['format', 'archive'];
const USAGE = `Usage: check-e2e --change <name> [--mode format|archive] [--root <dir>] [--json]

Checks openspec/changes/<name>/${E2E_FILE}, the E2E stage record: the mode, the E2E test folder, how the
application is started, reasons of accepted cases and differences, results of the screenshot comparison.
--mode archive runs the checks of the archive gate.`;

const list = (values) => values.join(', ');

/** Format of the stage record (design D4, "always"). `ctx`: { record, file, f }. */
function checkFormat({ record: r, file, f }) {
  for (const p of r.problems) f.error(file, p.line, p.message);

  if (r.modeLine === null) {
    f.error(file, null, `${E2E_FILE} has no "Mode:" line (allowed: ${list(MODES)})`, 'write "Mode: real backend", "Mode: stubbed backend" or "Mode: skipped" under the title');
  } else if (r.mode === null) {
    f.error(file, r.modeLine, `the E2E mode is empty (allowed: ${list(MODES)})`);
  } else if (!MODES.includes(r.mode)) {
    f.error(file, r.modeLine, `unknown E2E mode "${r.modeRaw}" (allowed: ${list(MODES)})`);
  }

  if (r.mode !== SKIPPED) {
    if (r.tests === null) {
      f.error(file, r.testsLine, `the E2E test folder is missing (no "Tests:" value)`, 'write "Tests: <folder>", the project folder that holds the E2E tests of the change');
    }
    const s = r.start;
    if (!s) {
      f.error(file, null, `how the application is started is missing (no "Start:" value)`, 'write "Start: command <cmd>" or "Start: developer at <url>"');
    } else if (s.kind === null) {
      f.error(file, s.line, `the start "${s.raw}" is neither \`command <cmd>\` nor \`developer at <url>\``);
    } else if (s.kind === 'command' && !s.command) {
      f.error(file, s.line, 'the start command is missing', 'write "Start: command <cmd>"');
    } else if (s.kind === 'developer' && !s.url) {
      f.error(file, s.line, 'the developer starts the application, but the application address is missing', 'ask the developer for the address and write "Start: developer at <url>"');
    }
  }

  for (const a of r.accepted) {
    if (!a.reason) f.error(file, a.line, `accepted case "${a.name}" (${a.capability}): the reason is missing`, 'write "- <capability-path> :: <name> — <reason>" with the reason the developer gave');
  }

  for (const row of r.screens) {
    if (!row.result) {
      f.error(file, row.line, `screenshot \`${row.screenshot}\` has no result (allowed: ${list(SCREEN_RESULTS)})`);
    } else if (!SCREEN_RESULTS.includes(row.result)) {
      f.error(file, row.line, `screenshot \`${row.screenshot}\` has unknown result "${row.resultRaw}" (allowed: ${list(SCREEN_RESULTS)})`);
    } else if (row.result === ACCEPTED && !row.reason) {
      f.error(file, row.line, `the difference of screenshot \`${row.screenshot}\` is accepted, but the reason is missing`, 'write the reason the developer gave in the Reason column');
    }
  }
}

/** True when the archive steps apply: a known mode other than skipped, and a test folder. */
const needsE2e = ({ record: r }) => MODES.includes(r.mode) && r.mode !== SKIPPED && r.tests !== null;
const RUN_HINT = (change) => `run the E2E tests with \`node openspec/tooling/bin/e2e-run.mjs --change ${change}\``;

/**
 * The cases or scenarios that need an E2E test (design D4) and their tests in the test folder. Sets
 * ctx.folder and ctx.items: [{kind: 'case'|'scenario', capability, name, label}] (only items with a test).
 */
function checkCoverage(ctx) {
  ctx.items = [];
  if (!needsE2e(ctx)) return;
  const { root, change, dir, schema, file, record: r, f } = ctx;
  const folder = (ctx.folder = normFolder(r.tests));
  const abs = join(root, folder);
  if (!folder || !existsSync(abs) || !statSync(abs).isDirectory()) {
    f.error(file, r.testsLine, `the E2E test folder "${r.tests}" does not exist`, 'write the E2E tests of the change in that folder, or fix "Tests:"');
  }
  const items = [];
  let refs;
  if (hasTestCases(schema)) {
    const content = readChangeFile(root, change, TEST_CASES_FILE);
    if (content !== null) {
      for (const c of parseTestCases(content).capabilities) {
        for (const s of c.scenarios) {
          for (const k of s.cases) {
            if ((k.labels || []).includes('e2e')) items.push({ kind: 'case', capability: c.name, name: k.name, label: `E2E case "${k.name}" (${c.name})` });
          }
        }
      }
    }
    refs = collectCaseRefs(root, { under: folder }).map((m) => ({ capability: m.capability, name: m.name }));
  } else {
    const known = new Set(changeScenarios(loadChangeDeltas(root, dir)).map((s) => `${s.capability}\0${s.scenario}`));
    for (const s of r.scenarios) {
      if (!known.has(`${s.capability}\0${s.scenario}`)) {
        f.error(file, s.line, `listed scenario "${s.scenario}" (${s.capability}) is not a scenario of the change's delta specs`, 'use the exact capability path and scenario name of a delta spec, or remove the line');
        continue;
      }
      items.push({ kind: 'scenario', capability: s.capability, name: s.scenario, label: `E2E scenario "${s.scenario}" (${s.capability})` });
    }
    refs = collectMarkers(root, { under: folder }).map((m) => ({ capability: m.capability, name: m.scenario }));
  }
  const referenced = new Set(refs.map((m) => `${m.capability}\0${m.name}`));
  const keyword = (kind) => (kind === 'case' ? '@case' : '@scenario');
  for (const item of items) {
    if (referenced.has(`${item.capability}\0${item.name}`)) {
      ctx.items.push(item);
      continue;
    }
    f.error(file, null, `${item.label} has no E2E test: no test in ${folder}/ references it (tests outside the E2E test folder do not count)`, `write its E2E test in ${folder}/ with "${keyword(item.kind)} ${item.capability} :: ${item.name}" above it`);
  }
}

/** Whether a recorded test references an item. */
function references(test, item) {
  const refs = test.refs ?? {};
  if (item.kind === 'case') return (refs.cases ?? []).some((c) => c.capability === item.capability && c.name === item.name);
  return (refs.scenarios ?? []).some((s) => s.capability === item.capability && s.scenario === item.name);
}

/** The recorded runs, retries 0, and the validity of the latest result of every covered item (design D4). */
function checkRuns(ctx) {
  if (!needsE2e(ctx)) return;
  const { root, change, dir, record: r, f } = ctx;
  const folder = ctx.folder ?? normFolder(r.tests);
  const runsPath = join(dir, RUNS_FILE);
  const { runs, error } = readRuns(root, change);
  if (error) {
    f.error(runsPath, null, error, `${RUNS_FILE} is written only by e2e-run.mjs; ${RUN_HINT(change)}`);
    return;
  }
  if (!runs.length) {
    f.error(ctx.file, null, `the E2E stage has not run: no run is recorded in ${RUNS_FILE}`, RUN_HINT(change));
    return;
  }

  const current = projectState(root, folder);
  const currentId = stateId(current.appState);
  const decided = r.noNewRun.some((d) => current.appState.startsWith(d.state));
  const appValid = (run) => run.appState === current.appState || decided;
  const latest = runs.at(-1);
  if (!appValid(latest)) {
    f.error(
      ctx.file,
      null,
      `project files changed after the latest E2E run (${latest.at}, state ${stateId(latest.appState)}; now ${currentId})`,
      `${RUN_HINT(change)} again, or, when the developer decides no new run is needed, add "- ${currentId} — <what changed>" under "## No new run needed"`,
    );
  }

  // a test file is a file some recorded test lives in; every other file of the folder is shared
  const testFiles = new Set(runs.flatMap((run) => (run.tests ?? []).map((t) => t.file)));
  const accepted = new Set(r.accepted.map((a) => `${a.capability}\0${a.name}`));
  const retryRuns = new Set();
  for (const item of ctx.items ?? []) {
    if (accepted.has(`${item.capability}\0${item.name}`)) continue;
    let run = null;
    let tests = [];
    for (const candidate of runs) {
      const found = (candidate.tests ?? []).filter((t) => references(t, item));
      if (found.length) [run, tests] = [candidate, found];
    }
    if (!run) {
      f.error(ctx.file, null, `${item.label} has no recorded E2E result`, RUN_HINT(change));
      continue;
    }
    const before = run.testFiles ?? {};
    if (!appValid(run)) {
      f.error(ctx.file, null, `${item.label} has no valid E2E result after the latest application change: project files outside ${folder}/ changed after its run (${run.at})`, `${RUN_HINT(change)} again for every E2E test`);
      continue;
    }
    const own = [...new Set(tests.map((t) => t.file))].filter((p) => before[p] !== current.testFiles[p]);
    if (own.length) {
      f.error(ctx.file, null, `${item.label} has no valid E2E result after the change of its test file ${own.join(', ')} (run of ${run.at})`, `${RUN_HINT(change)} again for this test`);
      continue;
    }
    const shared = [...new Set([...Object.keys(before), ...Object.keys(current.testFiles)])]
      .filter((p) => !testFiles.has(p) && before[p] !== current.testFiles[p])
      .sort();
    if (shared.length) {
      f.error(ctx.file, null, `${item.label} has no valid E2E result after the change of the shared E2E file(s) ${shared.join(', ')} (run of ${run.at})`, `${RUN_HINT(change)} again for every E2E test`);
      continue;
    }
    if (run.retries !== 0) retryRuns.add(run);
    const failed = tests.filter((t) => t.status === 'failed');
    if (failed.length) {
      const where = failed.map((t) => `${t.file}:${t.line}`).join(', ');
      f.error(ctx.file, null, `${item.label}: the latest E2E result is failed (${where}, run of ${run.at})`, 'fix it (at most three attempts), or the developer accepts it under "## Accepted cases" with a reason');
    } else if (tests.every((t) => t.status === 'skipped')) {
      f.error(ctx.file, null, `${item.label}: its E2E test was skipped (run of ${run.at}) and it is not under "## Accepted cases"`, 'run it, or the developer accepts it under "## Accepted cases" with a reason');
    }
  }
  for (const run of retryRuns) {
    f.error(runsPath, null, `the E2E run of ${run.at} was made with retries: ${run.retries ?? 'unknown'}; retries must be 0`, 'set "retries: 0" in the Playwright config and run the E2E tests again');
  }
}

/** The visual check (design D4, UI mode): every screenshot has a "## Screens" row with no open difference. */
function checkScreens(ctx) {
  if (!needsE2e(ctx)) return;
  const { dir, file, record: r, f } = ctx;
  const scan = scanUiFolder(dir);
  if (!isUiMode(scan)) return;
  const rows = new Map(r.screens.map((row) => [row.screenshot, row]));
  for (const shot of scan.screenshots) {
    const row = rows.get(shot);
    if (!row) {
      f.error(file, r.sections.screens?.line ?? null, `screenshot \`${shot}\` has no result under "## Screens": the built screen is not compared with it`, `compare ${UI_DIR}/${shot} with the built screen at its window size and state, and add its row (${list(SCREEN_RESULTS)})`);
    } else if (row.result === DIFFERENCES) {
      f.error(file, row.line, `screenshot \`${shot}\` has an open difference: ${row.differences || '(not described)'}`, 'fix it (at most three attempts) and compare again, or the developer accepts it with a reason (Result "accepted")');
    }
  }
}

/** Steps of each check mode, in order; every step gets the same context. */
const FORMAT_STEPS = [checkFormat];
const ARCHIVE_STEPS = [...FORMAT_STEPS, checkCoverage, checkRuns, checkScreens];
const STEPS = { format: FORMAT_STEPS, archive: ARCHIVE_STEPS };

/** Runs the check. Options: { root, change, mode = 'format' }. */
export function checkE2e({ root, change, mode = 'format' }) {
  if (!change) throw new UsageError('--change is required');
  if (!E2E_CHECK_MODES.includes(mode)) throw new UsageError(`--mode must be one of ${list(E2E_CHECK_MODES)} (got "${mode}")`);
  const dir = changeDir(root, change);
  if (!existsSync(dir)) throw new UsageError(`change "${change}" not found at ${dir}`);
  const schema = changeSchema(root, change);
  if (!isKitSchema(schema)) {
    return skippedReport(CHECK, `change "${change}" uses schema "${schema}" (the E2E stage exists only in ${KIT_SCHEMAS.map((s) => `"${s}"`).join(', ')})`);
  }

  const f = findingsFor(root);
  const file = join(dir, E2E_FILE);
  const content = readChangeFile(root, change, E2E_FILE);
  if (content === null) {
    if (mode === 'archive' && hasTestCases(schema)) {
      f.error(file, null, `the E2E decision is missing: ${E2E_FILE} does not exist (schema "${schema}" records whether the change needs E2E)`, `write ${E2E_FILE} with "Mode: real backend", "Mode: stubbed backend" or "Mode: skipped" (openspec/protocols/e2e.md)`);
    }
    return makeReport(CHECK, f.list, { change, mode });
  }

  const ctx = { root, change, dir, schema, mode, file, record: parseE2eRecord(content), f };
  for (const step of STEPS[mode]) step(ctx);
  return makeReport(CHECK, f.list, { change, mode });
}

if (isMain(import.meta.url)) {
  runCli(CHECK, USAGE, (args, root) => checkE2e({ root, change: args.change, mode: args.mode ?? 'format' }));
}
