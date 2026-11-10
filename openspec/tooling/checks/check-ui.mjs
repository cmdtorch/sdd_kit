#!/usr/bin/env node
// sdd-kit: managed file. Do not edit; local changes are overwritten on kit update.
// check-ui — UI screenshots and the UI inventory of a change (openspec/protocols/ui-inventory.md), on all
// kit schemas (clarify, clarify-ai-qa, clarify-qa, lean).
//
// Always: every file in sources/ui/ is an accepted screenshot (.png .jpg .jpeg .webp, any case) or the
//   notes file screens.md; no subfolders; hidden files (.DS_Store) are ignored. The rest runs only in UI mode (at least one screenshot); with
//   every screenshot deleted the inventory is ignored.
// Stage `base` (before any artifact after the questions): ui-inventory.md exists; every screenshot is
//   registered as [U<n>] (clarify family: "## Sources" of clarifications.md; lean: the inventory's
//   screenshots table); the inventory lists every screenshot with a matching SHA-256 fingerprint and no
//   deleted one; screens, variants and decisions are well formed; on the clarify family every decision
//   cites its source (in scope: [desc], [D<n>] or an answered [Q<n>]; out of scope, decoration, mock: an
//   answered [Q<n>] of a confirmed round; existing: nothing); `[U<n>] <element>` citations in the planning
//   artifacts name an element shown on that screenshot; a lean proposal names every element.
// Later stages; each runs the checks of the stages before it (uiStageFor maps an artifact to its stage):
//   design  — every `in scope` / `mock` element names scenarios `<capability-path> :: <Scenario name>` that
//             exist in the change's delta specs (ADDED / MODIFIED requirements).
//   plan    — schemas with a design (clarify family): design.md has a "## Screens" table (Screen, Pages and
//             components) with a row for every screen that has an `in scope` / `mock` element.
//   tasks   — the same checks as plan (the stage before writing tasks.md).
//   archive — every task line in tasks.md that names an inventory screen in backticks links at least one
//             `sources/ui/<file>` screenshot of that screen.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { toLines, fenceMask, stripComments, headings, sectionRange, firstTable, isTaskLine, fold } from '../lib/markdown.mjs';
import { loadChangeDeltas, changeScenarios } from '../lib/spec-parser.mjs';
import { parseClarifications, roundStatus, isBlankAnswer } from '../lib/clarifications.mjs';
import { scanUiFolder, isUiMode, parseInventory, allElements, elementOnShot, normTag, UI_DIR, INVENTORY_FILE, NOTES_FILE, DECISIONS, BUILT_DECISIONS } from '../lib/ui-inventory.mjs';
import { changeDir, changeSchema, readChangeFile, isClarifyFamily, isKitSchema, hasTestCases, KIT_SCHEMAS } from '../lib/project.mjs';
import { makeReport, skippedReport, findingsFor, runCli, isMain, UsageError } from '../lib/report.mjs';
import { FILES as GROUNDED_FILES } from './check-grounding.mjs';

const CHECK = 'check-ui';
/**
 * Stages in order; each includes the ones before it.
 *   base    — before any planning artifact after the questions (lean: before every planning artifact)
 *   design  — before design.md (lean: verification-plan.md) and later
 *   plan    — before verification-plan.md on the schemas with a design
 *   tasks   — before tasks.md
 *   archive — before the archive
 */
export const UI_STAGES = ['base', 'design', 'plan', 'tasks', 'archive'];

/**
 * The stage to run before writing `artifact` (an artifact id of the schema) of a change on `schema`, or null
 * when no UI check runs before it (clarifications.md, unknown artifacts, schemas outside the kit). The
 * archive runs the stage `archive`.
 *   clarify family: proposal, specs, test-cases → base; design → design; verification-plan → plan; tasks → tasks
 *   lean (no design): proposal, specs → base; verification-plan → design; tasks → tasks
 */
export function uiStageFor(schema, artifact) {
  if (!isKitSchema(schema)) return null;
  if (artifact === 'proposal' || artifact === 'specs') return 'base';
  if (isClarifyFamily(schema)) {
    if (artifact === 'test-cases') return hasTestCases(schema) ? 'base' : null;
    return { design: 'design', 'verification-plan': 'plan', tasks: 'tasks' }[artifact] ?? null;
  }
  return { 'verification-plan': 'design', tasks: 'tasks' }[artifact] ?? null;
}
const USAGE = `Usage: check-ui --change <name> [--stage ${UI_STAGES.join('|')}] [--root <dir>] [--json]

Checks the UI screenshots in openspec/changes/<name>/${UI_DIR}/ and ${INVENTORY_FILE}: formats, registration,
fingerprints, decisions and their sources, [U<n>] <element> citations. Later stages add: scenarios of built
elements (design), the "## Screens" table of design.md (plan, tasks), screenshot links of UI tasks (archive).
Default stage: base.`;

/** Planning artifacts read for `[U<n>]` citations. */
export const CITING_FILES = ['proposal.md', 'test-cases.md', 'design.md', 'verification-plan.md', 'tasks.md'];
const SHA256 = /^[0-9a-f]{64}$/;
const ALLOWED = `allowed: ${DECISIONS.join(', ')}`;
// `[U<n>]` optionally followed by an element name: a backticked name or a kebab-case word.
const CITATION = /\[U(\d+)\](?:[ \t]+(?:`([^`]+)`|([a-z0-9]+(?:-[a-z0-9]+)+)\b))?/gi;

const SCREEN_COLUMNS = ['Screen', 'Pages and components'];
// `sources/ui/<file>` in a task: a link target, a backticked path or plain text.
const SHOT_LINK = /sources\/ui\/([^\s)\]`'"<>]+)/g;

const sha256File = (path) => createHash('sha256').update(readFileSync(path)).digest('hex');
const isBuilt = (el) => BUILT_DECISIONS.includes(el.decision);
const isNoneCell = (cell) => /^[\s—–-]*$/.test(cell);
const quote = (s, max = 80) => (s.length > max ? `${s.slice(0, max - 1)}…` : s);
const atLeast = (stage, min) => UI_STAGES.indexOf(stage) >= UI_STAGES.indexOf(min);

/** Runs the check. Options: { root, change, stage = 'base' }. */
export function checkUi({ root, change, stage = 'base' }) {
  if (!change) throw new UsageError('--change is required');
  if (!UI_STAGES.includes(stage)) throw new UsageError(`--stage must be one of ${UI_STAGES.join(', ')}`);
  const dir = changeDir(root, change);
  if (!existsSync(dir)) throw new UsageError(`change "${change}" not found at ${dir}`);
  const schema = changeSchema(root, change);
  if (!isKitSchema(schema)) return skippedReport(CHECK, `change "${change}" uses schema "${schema}" (UI sources apply to ${KIT_SCHEMAS.map((s) => `"${s}"`).join(', ')})`);
  const clarify = isClarifyFamily(schema);

  const f = findingsFor(root);
  const uiDir = join(dir, UI_DIR);
  const invPath = join(dir, INVENTORY_FILE);
  const clarPath = join(dir, 'clarifications.md');

  // --- formats (also when the mode is off) -----------------------------------------------------
  const scan = scanUiFolder(dir);
  for (const x of scan.invalid) {
    const path = join(uiDir, x.name);
    if (x.kind === 'folder') f.error(path, null, `\`${x.name}\` is a folder; ${UI_DIR}/ takes no subfolders`, `move its screenshots up into ${UI_DIR}/ (PNG, JPG or WebP) and delete the folder`);
    else f.error(path, null, `\`${x.name}\` is not an accepted screenshot (PNG, JPG, WebP) — export it as PNG`, `export the mockup as PNG into ${UI_DIR}/ and delete \`${x.name}\`; only ${NOTES_FILE} may sit beside the screenshots`);
  }
  if (!isUiMode(scan)) return makeReport(CHECK, f.list, { change, stage, uiMode: false });

  // --- registration (clarify family: "## Sources") --------------------------------------------------
  const clarContent = clarify ? readChangeFile(root, change, 'clarifications.md') : null;
  const parsed = clarContent ? parseClarifications(clarContent) : null;
  if (clarify) {
    if (!parsed) {
      f.error(clarPath, null, 'clarifications.md does not exist, so no screenshot can be registered', `register each screenshot under "## Sources" as "- [U<n>] Screenshot — \`${UI_DIR}/<file>\`"`);
    } else {
      const byFile = new Map([...parsed.sources.ui].filter(([, v]) => v.file).map(([tag, v]) => [v.file, tag]));
      for (const file of scan.screenshots) {
        if (!byFile.has(file)) f.error(clarPath, null, `screenshot \`${file}\` is not registered under "## Sources"`, `add "- [U<n>] Screenshot — \`${UI_DIR}/${file}\`" with the next free number`);
      }
      for (const [tag, v] of parsed.sources.ui) {
        if (!v.file) f.error(clarPath, v.line, `[${tag}] under "## Sources" names no screenshot file`, `write its path, \`${UI_DIR}/<file>\``);
        else if (!scan.screenshots.includes(v.file)) f.error(clarPath, v.line, `[${tag}] is registered for \`${v.file}\`, which is missing from ${UI_DIR}/`, 'remove the registration and move its elements in the inventory to another screenshot, or restore the file');
      }
    }
  }

  // --- the inventory ---------------------------------------------------------------------------
  const invContent = readChangeFile(root, change, INVENTORY_FILE);
  if (invContent === null) {
    f.error(invPath, null, `the UI inventory is missing (${INVENTORY_FILE}) while ${UI_DIR}/ holds screenshots`, 'write the UI inventory per openspec/protocols/ui-inventory.md before the questions and the proposal');
    return makeReport(CHECK, f.list, { change, stage, uiMode: true });
  }
  const inv = parseInventory(invContent);
  for (const p of inv.problems) f.error(invPath, p.line, p.message);

  // screenshots table: every file listed, no deleted file, fingerprints match
  const listed = new Map(inv.screenshots.map((s) => [s.file, s]));
  for (const file of scan.screenshots) {
    if (!listed.has(file)) {
      f.error(invPath, null, `screenshot \`${file}\` is missing from the inventory`, `open it, add its row to "## Screenshots" with its SHA-256 fingerprint (sha256sum / shasum -a 256), and its screen and elements${clarify ? '; ask about new elements in the current round' : ''}`);
    }
  }
  for (const s of inv.screenshots) {
    if (!s.file) {
      f.error(invPath, s.line, `${s.tag} in the screenshots table names no file`);
      continue;
    }
    if (!scan.screenshots.includes(s.file)) {
      f.error(invPath, s.line, `screenshot \`${s.file}\` is listed in the inventory but missing from ${UI_DIR}/`, 'remove its row, screen and elements from the inventory, or move the elements to another screenshot');
      continue;
    }
    if (!SHA256.test(s.fingerprint)) {
      f.error(invPath, s.line, `screenshot \`${s.file}\` has no valid SHA-256 fingerprint in the inventory`, 'compute it with sha256sum (Linux, WSL) or shasum -a 256 (macOS) and write the 64 hex digits');
    } else if (sha256File(join(uiDir, s.file)) !== s.fingerprint) {
      f.error(invPath, s.line, `screenshot \`${s.file}\` has changed since the inventory was written (its fingerprint no longer matches)`, `open the screenshot again, update its elements in the inventory${clarify ? ' (ask about new or changed elements in the current round)' : ''}, then record its new fingerprint`);
    }
    if (clarify && parsed) {
      const reg = parsed.sources.ui.get(s.tag);
      if (reg && reg.file && reg.file !== s.file) f.error(invPath, s.line, `${s.tag} is \`${s.file}\` in the inventory but \`${reg.file}\` under "## Sources"`, 'use the same tag for the same file in both');
    }
  }

  // screens and variants
  const tags = new Set(inv.screenshots.map((s) => s.tag));
  const onScreen = new Set();
  for (const screen of inv.screens) {
    for (const shot of screen.shots) {
      onScreen.add(shot.tag);
      if (!tags.has(shot.tag)) f.error(invPath, screen.shotsLine, `screen "${screen.name}" lists ${shot.tag}, which is not in the screenshots table`);
      if (screen.shots.length > 1 && !shot.variant) f.error(invPath, screen.shotsLine, `${shot.tag} of screen "${screen.name}" has no variant label`, `write it as "${shot.tag} (desktop)" — a screen with several screenshots names a variant for each`);
    }
    if (screen.shots.length < 2) continue;
    const known = new Set(screen.shots.flatMap((s) => [fold(s.tag), ...(s.variant ? [fold(s.variant)] : [])]));
    for (const el of screen.elements) {
      if (!el.variants.length) {
        f.error(invPath, el.line, `element "${el.name}" of screen "${screen.name}" names no variant`, `screen "${screen.name}" has ${screen.shots.length} screenshots; write in Variants the ones that show the element (${screen.shots.map((s) => s.variant || s.tag).join(', ')})`);
      }
      for (const v of el.variants.filter((x) => !known.has(fold(x)))) {
        f.error(invPath, el.line, `element "${el.name}" of screen "${screen.name}" names the variant "${v}", which is not on the screen's Screenshots line`);
      }
    }
  }
  for (const s of inv.screenshots) {
    if (s.file && scan.screenshots.includes(s.file) && !onScreen.has(s.tag)) f.error(invPath, s.line, `screenshot ${s.tag} (\`${s.file}\`) is not listed under any screen`, 'add it to the "Screenshots:" line of its screen');
  }

  // decisions and their sources
  const confirmed = new Set(parsed ? parsed.rounds.filter((r) => roundStatus(parsed, r.name).confirmed).map((r) => r.name) : []);
  for (const { screen, element: el } of allElements(inv)) {
    const who = `element "${el.name}" (screen "${screen.name}")`;
    if (!el.decision) {
      f.error(invPath, el.line, `${who} has no decision (${ALLOWED})`, clarify ? 'ask about it in the current round and record the decision with the answer' : 'record the decision');
      continue;
    }
    if (!DECISIONS.includes(el.decision)) {
      f.error(invPath, el.line, `${who} has the unknown decision "${el.decisionRaw}" (${ALLOWED})`, '"Not yet defined" is not a decision; ask again until the element gets one');
      continue;
    }
    if (!clarify || el.decision === 'existing' || !parsed) continue;
    const valid = []; // cited tags that back the decision
    for (const tag of el.sources) {
      if (tag === 'desc') {
        if (parsed.sources.desc) valid.push(tag);
        else f.error(invPath, el.line, `${who} cites [desc], but "## Sources" has no [desc] entry`);
      } else if (tag.startsWith('D')) {
        if (parsed.sources.docs.has(tag)) valid.push(tag);
        else f.error(invPath, el.line, `${who} cites [${tag}], which is not registered under "## Sources"`);
      } else if (tag.startsWith('Q')) {
        const q = parsed.questions.get(Number(tag.slice(1)));
        if (!q) f.error(invPath, el.line, `${who} cites ${tag}, which does not exist in clarifications.md`);
        else if (q.answerLine === null || isBlankAnswer(q.answer)) f.error(invPath, el.line, `${who} cites ${tag}, which is not answered yet`);
        else if (el.decision !== 'in scope' && !confirmed.has(q.round)) f.error(invPath, el.line, `${who} cites ${tag} of the ${q.round} round, which is not confirmed ("Looks correct")`, `the decision "${el.decision}" needs an answered question of a confirmed round`);
        else valid.push(tag);
      }
    }
    if (el.decision === 'in scope') {
      if (!valid.length) {
        const onlyShots = el.sources.length > 0 && el.sources.every((t) => t.startsWith('U'));
        f.error(invPath, el.line, `${who} is "in scope" ${onlyShots ? 'but cites only a screenshot; a screenshot alone does not back it' : 'with no valid source'}`, 'cite [desc], a registered [D<n>] or an answered [Q<n>]; if no source names it, ask about it');
      }
    } else if (!valid.some((t) => t.startsWith('Q'))) {
      f.error(invPath, el.line, `${who} is "${el.decision}" and needs an answered question of a confirmed round`, `ask about it, cite the answer as [Q<n>] in the Source column`);
    }
  }

  // [U<n>] <element> citations in the planning artifacts
  const registered = clarify ? new Set(parsed ? parsed.sources.ui.keys() : []) : tags;
  const elementsByName = new Map();
  for (const x of allElements(inv)) {
    const k = fold(x.element.name);
    if (!elementsByName.has(k)) elementsByName.set(k, []);
    elementsByName.get(k).push(x);
  }
  for (const name of CITING_FILES) {
    const content = readChangeFile(root, change, name);
    if (content === null) continue;
    const path = join(dir, name);
    const raw = toLines(content);
    const fences = fenceMask(raw);
    const lines = stripComments(raw, fences);
    // check-grounding reports unregistered tags in the files it reads (clarify family only)
    const tagsChecked = !clarify || !GROUNDED_FILES.includes(name);
    for (let i = 0; i < lines.length; i++) {
      if (fences[i]) continue;
      for (const m of lines[i].matchAll(CITATION)) {
        const tag = normTag(`U${m[1]}`);
        if (!registered.has(tag)) {
          if (tagsChecked) f.error(path, i + 1, `[${tag}] is not a registered screenshot`, clarify ? 'register it under "## Sources" of clarifications.md' : `add it to the screenshots table of ${INVENTORY_FILE}`);
          continue;
        }
        const elName = (m[2] || m[3] || '').trim();
        if (!elName) continue;
        const candidates = elementsByName.get(fold(elName));
        if (!candidates) {
          f.error(path, i + 1, `\`[${tag}] ${elName}\`: the inventory has no element "${elName}"`, 'use the element name from the inventory');
        } else if (!candidates.some(({ screen, element }) => elementOnShot(screen, element, tag))) {
          f.error(path, i + 1, `\`[${tag}] ${elName}\`: the inventory does not list "${elName}" on ${tag}`, `cite the screenshot that shows it (${[...new Set(candidates.flatMap(({ screen, element }) => screen.shots.filter((s) => elementOnShot(screen, element, s.tag)).map((s) => `[${s.tag}]`)))].join(', ') || 'none'})`);
        }
      }
    }
  }

  // lean: the proposal names every element
  if (!clarify) {
    const proposal = readChangeFile(root, change, 'proposal.md');
    if (proposal !== null) {
      const text = fold(stripComments(toLines(proposal)).join('\n'));
      for (const { screen, element } of allElements(inv)) {
        const n = fold(element.name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        if (!new RegExp(`(^|[^\\w-])${n}($|[^\\w-])`).test(text)) {
          f.error(join(dir, 'proposal.md'), null, `element "${element.name}" (screen "${screen.name}") is missing from the proposal`, 'list every inventory element with its decision in proposal.md');
        }
      }
    }
  }

  if (atLeast(stage, 'design')) checkScenarios(f, root, dir, inv, invPath);
  if (atLeast(stage, 'plan') && clarify) checkScreens(f, root, change, dir, inv);
  if (atLeast(stage, 'archive')) checkTaskLinks(f, root, change, dir, inv);
  return makeReport(CHECK, f.list, { change, stage, uiMode: true });
}

/** Stage `design`: every built element names scenarios that exist in the change's delta specs. */
function checkScenarios(f, root, dir, inv, invPath) {
  const known = new Map(); // capability -> Set(scenario)
  for (const s of changeScenarios(loadChangeDeltas(root, dir))) {
    if (!known.has(s.capability)) known.set(s.capability, new Set());
    known.get(s.capability).add(s.scenario);
  }
  for (const { screen, element: el } of allElements(inv)) {
    if (!isBuilt(el)) continue;
    const who = `element "${el.name}" (screen "${screen.name}", ${el.decision})`;
    if (!el.scenarios.length) {
      f.error(invPath, el.line, `${who} names no scenario`, 'write the scenarios of the delta specs that cover it in the Scenarios column as `<capability-path> :: <Scenario name>`; if none does, add one to the specs');
      continue;
    }
    for (const ref of el.scenarios) {
      const names = known.get(ref.capability);
      if (names && names.has(ref.scenario)) continue;
      const where = names ? `the delta spec ${ref.capability}` : `${ref.capability}, a capability with no delta spec in the change`;
      f.error(invPath, el.line, `${who} names the scenario "${ref.scenario}" (${where}), which is not in the change's delta specs`, 'use the exact capability path and scenario name, or add the scenario to the specs');
    }
  }
}

/** Stage `plan` (schemas with a design): a "## Screens" row in design.md for every screen with a built element. */
function checkScreens(f, root, change, dir, inv) {
  const path = join(dir, 'design.md');
  const content = readChangeFile(root, change, 'design.md');
  const rows = new Map(); // folded screen name -> pages cell
  let problem = content === null ? 'design.md does not exist' : 'design.md has no "## Screens" section';
  if (content !== null) {
    const raw = toLines(content);
    const fences = fenceMask(raw);
    const lines = stripComments(raw, fences).map((l, i) => (fences[i] ? '' : l));
    const range = sectionRange(lines, (h) => h.level === 2 && /^Screens$/i.test(h.title), fences);
    const table = range && firstTable(lines, range.start, range.end);
    const idx = table ? SCREEN_COLUMNS.map((c) => table.header.findIndex((h) => fold(h) === fold(c))) : [];
    if (range && !table) problem = '"## Screens" in design.md has no table';
    else if (table && idx.includes(-1)) {
      f.error(path, table.line + 1, `the "## Screens" table needs the columns ${SCREEN_COLUMNS.join(', ')}`);
      return;
    } else if (table) {
      problem = 'the "## Screens" table of design.md has no row for it';
      for (const row of table.rows) rows.set(fold(row.cells[idx[0]] ?? ''), { pages: (row.cells[idx[1]] ?? '').trim(), line: row.line + 1 });
    }
  }
  for (const screen of inv.screens) {
    if (!screen.elements.some(isBuilt)) continue;
    const row = rows.get(fold(screen.name));
    if (!row) f.error(path, null, `screen "${screen.name}" has built elements, but ${problem}`, `add a row "| ${screen.name} | <pages and components it changes> |" under "## Screens" (columns: ${SCREEN_COLUMNS.join(', ')})`);
    else if (isNoneCell(row.pages)) f.error(path, row.line, `screen "${screen.name}" has no pages or components in the "## Screens" table`, 'name the pages and components the change builds or changes for it');
  }
}

/** Stage `archive`: every task naming an inventory screen in backticks links a screenshot of that screen. */
function checkTaskLinks(f, root, change, dir, inv) {
  const content = readChangeFile(root, change, 'tasks.md');
  if (content === null) return;
  const path = join(dir, 'tasks.md');
  const screens = new Map(inv.screens.map((s) => [fold(s.name), s]));
  const fileTag = new Map(inv.screenshots.map((s) => [s.file, s.tag]));
  const raw = toLines(content);
  const fences = fenceMask(raw);
  const lines = stripComments(raw, fences);
  const headingLines = new Set(headings(lines, fences).map((h) => h.line));
  for (let i = 0; i < lines.length; i++) {
    if (fences[i] || !isTaskLine(lines[i])) continue;
    // the task text: its line plus indented continuation lines up to the next task, heading or blank line
    let text = lines[i];
    for (let j = i + 1; j < lines.length && !fences[j] && /^\s+\S/.test(lines[j]) && !isTaskLine(lines[j]) && !headingLines.has(j); j++) text += `\n${lines[j]}`;
    const named = new Map();
    for (const m of text.matchAll(/`([^`]+)`/g)) {
      const screen = screens.get(fold(m[1]));
      if (screen) named.set(screen.name, screen);
    }
    if (!named.size) continue;
    const linked = new Set([...text.matchAll(SHOT_LINK)].map((m) => fileTag.get(m[1])).filter(Boolean));
    const task = quote(lines[i].replace(/^\s*(?:[-*+]|\d{1,9}[.)])\s*\[[^\]]*\]\s*/, '').trim());
    for (const screen of named.values()) {
      if (screen.shots.some((s) => linked.has(s.tag))) continue;
      const files = screen.shots.map((s) => inv.screenshots.find((x) => x.tag === s.tag)?.file).filter(Boolean);
      f.error(path, i + 1, `task "${task}" names the screen "${screen.name}" but links no screenshot of it`, `link ${files.map((x) => `${UI_DIR}/${x}`).join(' or ') || `its screenshot under ${UI_DIR}/`} in the task`);
    }
  }
}

if (isMain(import.meta.url)) {
  runCli(CHECK, USAGE, (args, root) => checkUi({ root, change: args.change, stage: args.stage || 'base' }));
}
