#!/usr/bin/env node
// sdd-kit: managed file. Do not edit; local changes are overwritten on kit update.
// One command that tells a developer whether this machine and this repository are ready for sdd-kit work,
// and how to fix what is not. Read-only, except one case: in a terminal (without --yes / --json) it asks whether
// to add each undeclared nested repository of a meta-repository to openspec/clones.
//   node openspec/tooling/bin/doctor.mjs [--json] [--yes]
// Project tools: `openspec/project-tools` (a project file the kit never overwrites; openspec/protocols/apply.md)
// lists the commands the project's checks need, one per line: `<command> — <checks it is needed for>`, or the
// single line `none`. A listed command that is not on the path is a warning, never an error.
// Meta-repository (`openspec/clones` exists; openspec/protocols/metarepo.md): a clone list error is an error, a
// declared clone whose folder is missing is a warning, and a folder up to three levels below the root with its
// own `.git` that the list does not declare is offered (hidden, dependency and build folders and declared clones
// are skipped; a taken name becomes `<parent>-<folder>`). The offer never changes "Ready.". Without the list
// nothing is said about clones. Nothing is ever written inside a clone.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { findRoot } from '../lib/project.mjs';
import { parseArgs, isMain } from '../lib/report.mjs';
import { CLONES_FILE, readClones, mergeEntries, cloneLine } from '../lib/clones.mjs';

const run = (cmd, args, opts = {}) => spawnSync(cmd, args, { encoding: 'utf8', timeout: 15000, ...opts, env: { ...process.env, OPENSPEC_TELEMETRY: '0', ...(opts.env || {}) } });
const has = (cmd) => run('sh', ['-c', `command -v '${cmd.replace(/'/g, '')}'`]).status === 0;

export const PROJECT_TOOLS = 'openspec/project-tools';

/** Lines of openspec/project-tools: [{ command, checks }]; [] for `none`, blank lines and `#` comments. */
export function parseProjectTools(content) {
  const out = [];
  for (const raw of String(content).split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#') || /^none\.?$/i.test(line)) continue;
    const m = line.match(/^(\S+)\s*(?:[—–:]|\s-\s)\s*(.*)$/);
    out.push({ command: (m ? m[1] : line.split(/\s+/)[0]).replace(/`/g, ''), checks: m ? m[2].trim() : '' });
  }
  return out;
}

/** Doctor items about the project tools (none when the list is missing or `none`). */
function projectTools(root, add) {
  const file = join(root, PROJECT_TOOLS);
  if (!existsSync(file)) return;
  const tools = parseProjectTools(readFileSync(file, 'utf8'));
  if (!tools.length) return;
  const missing = tools.filter((t) => !has(t.command));
  for (const t of missing) {
    add('warning', 'project tools', `${t.command} is not on the path — needed for: ${t.checks || 'the project\'s checks'}`, `install ${t.command}, or tell the agent how the project runs without it; the agent does not install programs into the system on its own`);
  }
  if (!missing.length) add('ok', 'project tools', `${tools.map((t) => t.command).join(', ')} found`);
}

// Folders never searched for nested repositories: dependencies, build output, caches.
const SKIPPED = new Set(['node_modules', 'bower_components', 'jspm_packages', 'vendor', 'venv', '__pycache__', 'dist', 'build', 'out', 'target', 'coverage', 'tmp', 'openspec']);
const MAX_DEPTH = 3;

/** Undeclared folders with their own `.git`, up to three levels below the root: ['repos/frontend', ...]. */
export function nestedRepositories(root, declaredPaths) {
  const found = [];
  const walk = (rel, depth) => {
    let entries;
    try {
      entries = readdirSync(rel ? join(root, rel) : root, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (!e.isDirectory() || e.name.startsWith('.') || SKIPPED.has(e.name)) continue;
      const path = rel ? `${rel}/${e.name}` : e.name;
      if (declaredPaths.includes(path)) continue;
      if (existsSync(join(root, path, '.git'))) {
        found.push(path);
        continue;
      }
      if (depth < MAX_DEPTH) walk(path, depth + 1);
    }
  };
  walk('', 1);
  return found.sort();
}

/** The line offered for an undeclared repository: its path, or `<parent>-<folder>=<path>` for a taken name. */
export function offeredLine(path, takenNames) {
  const parts = path.split('/');
  const name = parts[parts.length - 1];
  if (!takenNames.includes(name)) return cloneLine({ name, path });
  const alt = parts.length > 1 ? `${parts[parts.length - 2]}-${name}` : `${name}-2`;
  return cloneLine({ name: alt, path });
}

/** Doctor items about the clone list (none without openspec/clones). */
function clones(root, add) {
  const list = readClones(root);
  if (!list.present) return;
  for (const e of list.errors) add('error', 'clones', `${CLONES_FILE}:${e.line}: ${e.message}`, `fix the line in ${CLONES_FILE}: <path> or <name>=<path>, a path inside the root, names from letters, digits, -, _, .`);
  for (const c of list.clones.filter((x) => !x.exists)) add('warning', 'clones', `the clone \`${c.name}\` at ${c.path} is missing`, `clone the repository into ${c.path}, or remove its line from ${CLONES_FILE}`);
  const present = list.clones.filter((x) => x.exists);
  if (!list.errors.length) add('ok', 'clones', present.length ? `${present.length} clone(s) declared and present: ${present.map((c) => c.name).join(', ')}` : `${CLONES_FILE} declares no present clone`);
  const taken = list.clones.map((c) => c.name);
  for (const path of nestedRepositories(root, list.clones.map((c) => c.path))) {
    const line = offeredLine(path, taken);
    taken.push(line.includes('=') ? line.split('=')[0] : path.split('/').pop());
    const item = add('warning', 'clones', `${path} has its own git but is not declared in ${CLONES_FILE}`, `add the line \`${line}\` to ${CLONES_FILE} if it is a clone of this meta-repository`);
    item.offer = { path, line };
  }
}

/** Human-readable doctor result: one line per item, the fixes, and "Ready." or the problem count. */
export function formatDoctor(items) {
  const mark = { ok: '✓', warning: '!', error: '✗' };
  const out = [];
  for (const i of items) {
    out.push(`${mark[i.level]} ${i.check}: ${i.message}`);
    if (i.fix) out.push(`    fix: ${i.fix}`);
  }
  const errors = items.filter((i) => i.level === 'error').length;
  out.push(errors ? `\n${errors} problem(s) to fix before working with sdd-kit.` : '\nReady.');
  return out.join('\n');
}

export function doctor(root) {
  const items = []; // {level: ok|warning|error, check, message, fix?}
  const add = (level, check, message, fix) => {
    const item = { level, check, message, ...(fix ? { fix } : {}) };
    items.push(item);
    return item;
  };

  const major = Number(process.versions.node.split('.')[0]);
  if (major >= 20) add('ok', 'node', `Node ${process.versions.node}`);
  else add('error', 'node', `Node ${process.versions.node} is too old`, 'install Node 20 or newer');

  const kitFile = join(root, 'openspec', 'tooling', 'kit.json');
  const kit = existsSync(kitFile) ? JSON.parse(readFileSync(kitFile, 'utf8')) : null;
  if (!kit) {
    add('error', 'kit', 'sdd-kit is not installed in this repository', 'npx github:cmdtorch/sdd_kit install (see the kit README)');
    return items;
  }
  add('ok', 'kit', `sdd-kit ${kit.kitVersion}`);

  const os = run(process.env.OPENSPEC_BIN || 'openspec', ['--version']);
  if (os.status !== 0) add('error', 'openspec', 'the openspec CLI was not found', `npm i -g @fission-ai/openspec@${kit.openspecVersion}`);
  else if (os.stdout.trim() !== kit.openspecVersion) add('error', 'openspec', `openspec ${os.stdout.trim()} is installed, the kit needs ${kit.openspecVersion}`, `npm i -g @fission-ai/openspec@${kit.openspecVersion}`);
  else add('ok', 'openspec', `openspec ${kit.openspecVersion}`);

  if (has('claude')) add('ok', 'claude', `Claude Code ${run('claude', ['--version']).stdout.trim().split(' ')[0]}`);
  else add('warning', 'claude', 'Claude Code was not found on PATH', 'install Claude Code: https://code.claude.com');

  if (run('git', ['rev-parse', '--git-dir'], { cwd: root }).status !== 0) add('warning', 'git', 'not a git repository: test markers are found through git, CI needs it', 'git init');

  const manifestFile = join(root, 'openspec', 'tooling', 'kit-manifest.json');
  if (existsSync(manifestFile)) {
    const m = JSON.parse(readFileSync(manifestFile, 'utf8'));
    const bad = Object.entries(m.files).filter(([rel, hash]) => !existsSync(join(root, rel)) || createHash('sha256').update(readFileSync(join(root, rel))).digest('hex') !== hash);
    if (bad.length) add('warning', 'kit files', `${bad.length} kit file(s) edited or missing: ${bad.slice(0, 5).map(([r]) => r).join(', ')}${bad.length > 5 ? ', …' : ''}`, `kit updates will not touch them; restore with: npx github:cmdtorch/sdd_kit#v${kit.kitVersion} update --force (backups are kept)`);
    else add('ok', 'kit files', `${Object.keys(m.files).length} kit files unchanged`);
  }

  const settings = join(root, '.claude', 'settings.json');
  const st = existsSync(settings) ? readFileSync(settings, 'utf8') : '';
  const hooks = ['session-start', 'answers-gate', 'archive-gate', 'boundary-guard', 'artifact-feedback', 'schema-starter', 'test-cases-run-limit'].filter((h) => !st.includes(`openspec/tooling/hooks/${h}.mjs`));
  if (hooks.length) add('error', 'hooks', `kit hooks missing in .claude/settings.json: ${hooks.join(', ')}`, `npx github:cmdtorch/sdd_kit#v${kit.kitVersion} update`);
  else add('ok', 'hooks', 'kit hooks registered in .claude/settings.json');

  const skills = join(root, '.claude', 'skills');
  const names = existsSync(skills) ? readdirSync(skills) : [];
  if (names.includes('openspec-propose') || !names.includes('openspec-continue-change')) {
    add('warning', 'skills', 'OpenSpec skills differ from the kit profile (propose installed or continue missing)', 'node openspec/tooling/bin/openspec.mjs update');
  } else add('ok', 'skills', 'OpenSpec skills follow the kit profile');

  projectTools(root, add);
  clones(root, add);
  return items;
}

/** Terminal questions of the health check: { ask(question) → answer, say(text) }. */
function terminalIo() {
  return {
    async ask(question) {
      const rl = createInterface({ input: process.stdin, output: process.stdout });
      try {
        return await rl.question(question);
      } finally {
        rl.close();
      }
    },
    say: (text) => console.log(text),
  };
}

/**
 * The health check with its one question: in a terminal (`interactive`), each undeclared nested repository is
 * offered, and on "yes" its line is appended to openspec/clones. Without a terminal it only reports. Returns the
 * items, an added repository reported as ok.
 */
export async function runDoctor(root, { interactive = false, io = terminalIo() } = {}) {
  const items = doctor(root);
  if (!interactive) return items;
  for (const item of items.filter((i) => i.offer)) {
    const answer = String(await io.ask(`${item.offer.path} has its own git but is not declared in ${CLONES_FILE}. Add the line \`${item.offer.line}\`? [y/N] `)).trim().toLowerCase();
    if (!answer.startsWith('y')) continue;
    const file = join(root, CLONES_FILE);
    const m = mergeEntries(readFileSync(file, 'utf8'), [item.offer.line]);
    if (m.errors.length) {
      io.say(`  not added: ${m.errors.join('; ')}`);
      continue;
    }
    writeFileSync(file, m.content);
    Object.assign(item, { level: 'ok', message: `added \`${item.offer.line}\` to ${CLONES_FILE}` });
    delete item.fix;
    delete item.offer;
  }
  return items;
}

if (isMain(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2), ['json', 'help', 'yes']);
  if (args.help) {
    console.log('Usage: doctor.mjs [--json] [--yes] [--root <dir>]');
    process.exit(0);
  }
  const root = args.root || findRoot();
  if (!root) {
    console.error('sdd-kit doctor: no openspec/ directory found — run it inside a repository that has the kit installed');
    process.exit(1);
  }
  const items = await runDoctor(root, { interactive: Boolean(process.stdin.isTTY) && !args.yes && !args.json });
  const errors = items.filter((i) => i.level === 'error').length;
  if (args.json) console.log(JSON.stringify({ ok: !errors, items }, null, 2));
  else console.log(formatDoctor(items));
  process.exit(errors ? 1 : 0);
}
