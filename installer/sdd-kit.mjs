#!/usr/bin/env node
// sdd-kit installer. Zero dependencies (D3).
//
//   sdd-kit install   [--target <dir>] [--questions-language <lang>] [--keep-default-schema]
//                     [--skip-openspec] [--force] [--dry-run] [--yes] [--json]
//   sdd-kit update    (same as install; safe to re-run)
//   sdd-kit status    [--target <dir>] [--json]
//   sdd-kit uninstall [--target <dir>] [--force] [--dry-run] [--json]
//
// What install does (CLAUDE.md "Installer", D6, D9, D10, D12, D20, D22):
//   1. runs `openspec init --tools claude` with the kit profile when the project has no openspec/ yet
//   2. copies kit/core/openspec/** into openspec/ (protocols, schemas, tooling); files edited locally
//      are never overwritten (manifest of hashes; --force backs them up and replaces them)
//   3. adds the kit block to openspec/config.yaml context and sets `schema: clarify` as the default
//   4. merges the kit hooks into .claude/settings.json (project hooks are kept)
//   5. patches .gitignore (openspec/ and the shared parts of .claude/ are versioned)
//   6. runs `openspec update` through the kit wrapper, then lint-kit as a self-check
// Everything is planned and validated first; nothing is written when a step cannot be done safely.
import { existsSync, readFileSync, writeFileSync, mkdirSync, copyFileSync, rmSync, readdirSync, rmdirSync, statSync, realpathSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createInterface } from 'node:readline/promises';
import { listFiles, readManifest, planFiles, nextManifest, sha256, MANIFEST } from './lib/manifest.mjs';
import { patchGitignore, unpatchGitignore } from './lib/gitignore.mjs';
import { kitBlock, upsertKitBlock, removeKitBlock, currentQuestionsLanguage, currentSchema, setSchema, ConfigEditError } from './lib/config-edit.mjs';
import { mergeSettings, removeKitHooks, formatSettings } from '../kit/core/openspec/tooling/lib/settings-merge.mjs';
import { parseArgs } from '../kit/core/openspec/tooling/lib/report.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const USAGE = `sdd-kit — Spec-Driven Development kit for OpenSpec + Claude Code

Usage:
  sdd-kit install   [options]   install or update the kit in a project (safe to re-run)
  sdd-kit update    [options]   same as install
  sdd-kit status    [options]   show what is installed and what was edited locally
  sdd-kit uninstall [options]   remove the kit (keeps your changes, specs and edited files)

Options:
  --target <dir>               project root (default: current directory)
  --questions-language <lang>  language of clarifying questions (default: keep current, else English)
  --keep-default-schema        do not make "clarify" the default schema for new changes
  --preset <names>             comma-separated stack presets: django, playwright (remembered for updates;
                               they create openspec/tooling/verify.yaml when it does not exist yet)
  --skip-openspec              do not run the openspec CLI (no init/update of skills)
  --force                      replace locally edited kit files (a .sdd-kit-backup copy is kept);
                               uninstall: remove the kit even if changes still use its schemas
  --dry-run                    show the plan, write nothing
  --yes                        never ask questions
  --json                       machine-readable output`;

class InstallError extends Error {}

const KIT_SCHEMAS = ['clarify', 'lean'];

function kitPaths(kitDir) {
  return {
    core: join(kitDir, 'core'),
    openspecSrc: join(kitDir, 'core', 'openspec'),
    configFragment: join(kitDir, 'core', 'config-fragment.yaml'),
    settingsFragment: join(kitDir, 'core', 'claude-settings.fragment.json'),
    kitJson: join(kitDir, 'core', 'openspec', 'tooling', 'kit.json'),
  };
}

function readText(p) {
  return existsSync(p) ? readFileSync(p, 'utf8') : null;
}

function writeFileEnsured(p, content) {
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, content);
}

function openspecRun(args, { xdg, bin, cwd }) {
  const r = spawnSync(bin, args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, XDG_CONFIG_HOME: xdg, OPENSPEC_TELEMETRY: '0', DO_NOT_TRACK: '1' },
  });
  if (r.error) throw new InstallError(`cannot run "${bin}": ${r.error.message}`);
  if (r.status !== 0) throw new InstallError(`"openspec ${args.join(' ')}" failed:\n${r.stdout}\n${r.stderr}`);
  return r.stdout;
}

function checkOpenspec(bin, pinned, allowMismatch) {
  const r = spawnSync(bin, ['--version'], { encoding: 'utf8', env: { ...process.env, OPENSPEC_TELEMETRY: '0' } });
  if (r.error || r.status !== 0) {
    throw new InstallError(`the openspec CLI was not found. Install the pinned version first:\n  npm i -g @fission-ai/openspec@${pinned}\n(or pass --skip-openspec)`);
  }
  const v = r.stdout.trim();
  if (v !== pinned && !allowMismatch) {
    throw new InstallError(`openspec ${v} is installed, the kit is pinned to ${pinned} (D12):\n  npm i -g @fission-ai/openspec@${pinned}\n(or pass --allow-version-mismatch)`);
  }
  return v;
}

async function askLanguage(defaultLang) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const a = (await rl.question(`Language for clarifying questions (forwarded to PO/PM as written) [${defaultLang}]: `)).trim();
  rl.close();
  return a || defaultLang;
}

/** Builds the full install plan without writing anything. */
export function planInstall(opts) {
  const { root, kitDir, force = false, keepDefaultSchema = false, questionsLanguage = null, willInitOpenspec = false, presets: requested = [] } = opts;
  const k = kitPaths(kitDir);
  const kit = JSON.parse(readFileSync(k.kitJson, 'utf8'));
  const plan = { root, kitVersion: kit.kitVersion, openspecVersion: kit.openspecVersion, steps: [], warnings: [] };

  // presets: remembered in the manifest, extended by --preset
  const manifest = readManifest(root);
  const available = existsSync(join(kitDir, 'presets')) ? readdirSync(join(kitDir, 'presets')).sort() : [];
  for (const p of requested) if (!available.includes(p)) throw new InstallError(`unknown preset "${p}" (available: ${available.join(', ')})`);
  const presets = [...new Set([...(manifest?.presets || []), ...requested])].sort();
  plan.presets = presets;

  // files
  const kitFiles = listFiles(k.openspecSrc, 'openspec');
  for (const p of presets) {
    const src = join(kitDir, 'presets', p, 'openspec');
    if (existsSync(src)) Object.assign(kitFiles, listFiles(src, 'openspec'));
  }
  delete kitFiles[MANIFEST];
  plan.files = planFiles(root, kitFiles, manifest, { force });
  plan.manifest = nextManifest(kit.kitVersion, plan.files, presets);

  // verify.yaml: project-owned; created from presets only when missing
  const verifyPath = join(root, 'openspec', 'tooling', 'verify.yaml');
  const verifyOld = readText(verifyPath);
  if (verifyOld === null && presets.length) plan.verify = { path: verifyPath, old: null, new: composeVerify(kitDir, presets) };
  else {
    plan.verify = { path: verifyPath, old: verifyOld, new: verifyOld };
    if (verifyOld === null) plan.warnings.push('no openspec/tooling/verify.yaml: test gates cannot run tests. Re-run with --preset (django, playwright) or write it by hand');
  }

  // config.yaml
  const cfgPath = join(root, 'openspec', 'config.yaml');
  const cfgOld = readText(cfgPath);
  if (cfgOld === null && !willInitOpenspec) plan.warnings.push('openspec/config.yaml does not exist; a minimal one is created');
  let cfgNew = cfgOld ?? 'schema: spec-driven\n';
  const lang = questionsLanguage || (cfgOld && currentQuestionsLanguage(cfgOld)) || 'English';
  try {
    cfgNew = upsertKitBlock(cfgNew, kitBlock(k.configFragment, lang));
    const schema = currentSchema(cfgNew);
    if (!keepDefaultSchema && (schema === null || schema === 'spec-driven')) cfgNew = setSchema(cfgNew, 'clarify');
    else if (!keepDefaultSchema && !KIT_SCHEMAS.includes(schema)) plan.warnings.push(`default schema "${schema}" is kept (it is not spec-driven); new changes will not use "clarify" unless asked`);
  } catch (e) {
    if (e instanceof ConfigEditError) throw new InstallError(e.message);
    throw e;
  }
  plan.config = { path: cfgPath, old: cfgOld, new: cfgNew, questionsLanguage: lang, deferred: willInitOpenspec };

  // settings.json
  const setPath = join(root, '.claude', 'settings.json');
  const setOld = readText(setPath);
  let setObj;
  try {
    setObj = setOld === null || !setOld.trim() ? {} : JSON.parse(setOld);
  } catch (e) {
    throw new InstallError(`.claude/settings.json is not valid JSON (${e.message}); fix it first — nothing was changed`);
  }
  let merged;
  try {
    merged = mergeSettings(setObj, JSON.parse(readFileSync(k.settingsFragment, 'utf8')));
  } catch (e) {
    throw new InstallError(`cannot merge .claude/settings.json: ${e.message}`);
  }
  // keep the file byte-for-byte when the merge changes nothing (re-runs must not reformat it)
  const sameContent = setOld !== null && JSON.stringify(merged) === JSON.stringify(setObj);
  plan.settings = { path: setPath, old: setOld, new: sameContent ? setOld : formatSettings(merged) };

  // .gitignore
  const giPath = join(root, '.gitignore');
  const giOld = readText(giPath);
  plan.gitignore = { path: giPath, old: giOld, new: patchGitignore(giOld) };
  return plan;
}

/** verify.yaml text composed from the chosen presets' level fragments. */
export function composeVerify(kitDir, presets) {
  const levels = [];
  for (const [p, file] of [['django', 'verify.unit.yaml'], ['playwright', 'verify.e2e.yaml']]) {
    if (presets.includes(p)) levels.push(readFileSync(join(kitDir, 'presets', p, file), 'utf8').trimEnd());
  }
  return [
    '# sdd-kit verify.yaml — how this project runs its tests (openspec/protocols/testing.md).',
    `# Owned by the project: generated once from the presets (${presets.join(', ')}); edit freely, kit updates never overwrite it.`,
    '# Placeholders: {out} = JSON file the command writes; {files} = space-separated test ids/paths.',
    'version: 1',
    'levels:',
    ...levels,
    'gates:',
    '  stop: full            # Stop hook: full verification when apply claims all tasks done (off = disabled)',
    '  e2e: scoped           # which E2E tests the gates run: scoped (this change) | full | off',
    '  stop_block_limit: 3   # consecutive blocked stops before the human decides',
    'timeout_seconds: 1800   # per command',
    '',
  ].join('\n');
}

function applyFiles(root, files) {
  const done = [];
  for (const a of files) {
    const target = join(root, a.rel);
    if (['create', 'update', 'restore'].includes(a.op)) {
      mkdirSync(dirname(target), { recursive: true });
      copyFileSync(a.src, target);
    } else if (a.op === 'overwrite') {
      if (existsSync(target)) copyFileSync(target, target + '.sdd-kit-backup');
      mkdirSync(dirname(target), { recursive: true });
      copyFileSync(a.src, target);
    } else if (a.op === 'delete') {
      rmSync(target);
      pruneEmptyDirs(dirname(target), join(root, 'openspec'));
    }
    done.push(a);
  }
  return done;
}

function pruneEmptyDirs(dir, stopAt) {
  let d = dir;
  while (d.startsWith(stopAt) && d !== stopAt && existsSync(d) && statSync(d).isDirectory() && readdirSync(d).length === 0) {
    rmdirSync(d);
    d = dirname(d);
  }
}

const changed = (s) => s.old !== s.new;

export async function install(opts) {
  const root = resolve(opts.target || process.cwd());
  if (!existsSync(root) || !statSync(root).isDirectory()) throw new InstallError(`target ${root} is not a directory`);
  const kitDir = opts.kitDir || join(HERE, '..', 'kit');
  const k = kitPaths(kitDir);
  const kit = JSON.parse(readFileSync(k.kitJson, 'utf8'));
  const bin = process.env.OPENSPEC_BIN || 'openspec';
  const result = { command: 'install', root, kitVersion: kit.kitVersion, actions: [], warnings: [], dryRun: Boolean(opts.dryRun) };

  if (!opts.skipOpenspec) result.openspecCli = checkOpenspec(bin, kit.openspecVersion, opts.allowVersionMismatch);
  const willInit = !opts.skipOpenspec && !existsSync(join(root, 'openspec'));

  let lang = opts.questionsLanguage || null;
  if (!lang && !opts.yes && !opts.dryRun && !opts.json && process.stdin.isTTY) {
    const current = currentQuestionsLanguage(readText(join(root, 'openspec', 'config.yaml')) || '');
    if (!current) lang = await askLanguage('English');
  }

  // validate everything before writing (init changes config, so the plan is rebuilt after it)
  const presets = opts.presets || [];
  let plan = planInstall({ root, kitDir, force: opts.force, keepDefaultSchema: opts.keepDefaultSchema, questionsLanguage: lang, willInitOpenspec: willInit, presets });
  if (opts.dryRun) {
    result.plan = summarise(plan, willInit, !opts.skipOpenspec);
    return result;
  }
  if (willInit) {
    openspecRun(['init', '--tools', 'claude', '--no-animation'], { xdg: join(k.openspecSrc, 'tooling', 'xdg'), bin, cwd: root });
    result.actions.push({ step: 'openspec init --tools claude (kit profile)' });
    plan = planInstall({ root, kitDir, force: opts.force, keepDefaultSchema: opts.keepDefaultSchema, questionsLanguage: lang, presets });
  }
  result.files = applyFiles(root, plan.files).map(({ rel, op }) => ({ rel, op }));
  writeFileEnsured(join(root, MANIFEST), JSON.stringify(plan.manifest, null, 2) + '\n');
  for (const [name, s] of [['openspec/config.yaml', plan.config], ['.claude/settings.json', plan.settings], ['.gitignore', plan.gitignore], ['openspec/tooling/verify.yaml', plan.verify]]) {
    if (name === 'openspec/tooling/verify.yaml' && s.old === null && s.new === null) continue;
    if (changed(s)) writeFileEnsured(s.path, s.new);
    result.actions.push({ step: name, op: s.old === null ? 'create' : changed(s) ? 'update' : 'unchanged' });
  }
  result.questionsLanguage = plan.config.questionsLanguage;
  result.presets = plan.presets;
  if (plan.presets.includes('django')) result.warnings.push('django preset: register the pytest marker (see kit/presets/django/PRESET.md): markers = ["scenario(capability, name): ..."]');
  result.warnings.push(...plan.warnings);
  if (!opts.skipOpenspec) {
    // same as `node openspec/tooling/bin/openspec.mjs update`: the project's committed kit profile
    openspecRun(['update'], { xdg: join(root, 'openspec', 'tooling', 'xdg'), bin, cwd: root });
    result.actions.push({ step: 'openspec update (kit profile)' });
  }
  // self-check with the freshly installed tooling
  const { lintKit } = await import(pathToFileURL(join(root, 'openspec', 'tooling', 'checks', 'lint-kit.mjs')).href);
  result.lint = lintKit({ root });
  return result;
}

function summarise(plan, willInit, runOpenspec) {
  const s = { files: plan.files.map(({ rel, op }) => ({ rel, op })), presets: plan.presets, config: changed(plan.config) ? 'update' : 'unchanged', settings: changed(plan.settings) ? 'update' : 'unchanged', gitignore: changed(plan.gitignore) ? 'update' : 'unchanged', verify: plan.verify.old === null && plan.verify.new !== null ? 'create' : plan.verify.old === null ? 'missing' : 'kept', warnings: plan.warnings };
  if (willInit) s.openspec = 'init --tools claude, then update (kit profile)';
  else if (runOpenspec) s.openspec = 'update (kit profile)';
  return s;
}

export function status(opts) {
  const root = resolve(opts.target || process.cwd());
  const manifest = readManifest(root);
  if (!manifest) return { command: 'status', root, installed: false };
  const files = Object.entries(manifest.files).map(([rel, hash]) => {
    const p = join(root, rel);
    return { rel, state: !existsSync(p) ? 'missing' : sha256(readFileSync(p)) === hash ? 'ok' : 'modified' };
  });
  const settings = readText(join(root, '.claude', 'settings.json')) || '';
  const config = readText(join(root, 'openspec', 'config.yaml')) || '';
  return {
    command: 'status',
    root,
    installed: true,
    kitVersion: manifest.kitVersion,
    files: files.filter((f) => f.state !== 'ok'),
    fileCount: files.length,
    hooks: settings.includes('openspec/tooling/hooks/'),
    configBlock: config.includes('# >>> sdd-kit >>>'),
    questionsLanguage: currentQuestionsLanguage(config),
    defaultSchema: currentSchema(config),
  };
}

export function uninstall(opts) {
  const root = resolve(opts.target || process.cwd());
  const manifest = readManifest(root);
  if (!manifest) throw new InstallError(`sdd-kit is not installed in ${root} (no ${MANIFEST})`);
  const changesDir = join(root, 'openspec', 'changes');
  const users = existsSync(changesDir)
    ? readdirSync(changesDir).filter((n) => n !== 'archive' && existsSync(join(changesDir, n, '.openspec.yaml')) && /^schema:\s*(clarify|lean)\s*$/m.test(readFileSync(join(changesDir, n, '.openspec.yaml'), 'utf8')))
    : [];
  if (users.length && !opts.force) {
    throw new InstallError(`active changes still use kit schemas: ${users.join(', ')}. Archive them first, or pass --force (their schema will be missing).`);
  }
  const result = { command: 'uninstall', root, removed: [], kept: [], actions: [], dryRun: Boolean(opts.dryRun) };
  for (const [rel, hash] of Object.entries(manifest.files)) {
    const p = join(root, rel);
    if (!existsSync(p)) continue;
    if (sha256(readFileSync(p)) === hash) result.removed.push(rel);
    else result.kept.push(rel);
  }
  const edits = [];
  const cfgPath = join(root, 'openspec', 'config.yaml');
  const cfg = readText(cfgPath);
  if (cfg !== null) {
    let out = removeKitBlock(cfg);
    if (KIT_SCHEMAS.includes(currentSchema(out))) out = setSchema(out, 'spec-driven');
    edits.push(['openspec/config.yaml', cfgPath, cfg, out]);
  }
  const setPath = join(root, '.claude', 'settings.json');
  const set = readText(setPath);
  if (set !== null) edits.push(['.claude/settings.json', setPath, set, formatSettings(removeKitHooks(JSON.parse(set)))]);
  const giPath = join(root, '.gitignore');
  const gi = readText(giPath);
  if (gi !== null) edits.push(['.gitignore', giPath, gi, unpatchGitignore(gi)]);
  for (const [name, , oldT, newT] of edits) result.actions.push({ step: name, op: oldT === newT ? 'unchanged' : 'update' });
  if (opts.dryRun) return result;
  for (const rel of result.removed) {
    rmSync(join(root, rel));
    pruneEmptyDirs(dirname(join(root, rel)), join(root, 'openspec'));
  }
  rmSync(join(root, MANIFEST));
  pruneEmptyDirs(dirname(join(root, MANIFEST)), join(root, 'openspec'));
  for (const [, p, oldT, newT] of edits) if (oldT !== newT) writeFileSync(p, newT);
  result.note = 'OpenSpec skills in .claude/ were left as they are; run a plain "openspec update" to switch them back to your personal profile.';
  return result;
}

function printHuman(r) {
  const out = [];
  if (r.command === 'status') {
    if (!r.installed) return console.log(`sdd-kit is not installed in ${r.root}`);
    out.push(`sdd-kit ${r.kitVersion} in ${r.root}`);
    out.push(`  files: ${r.fileCount} managed, ${r.files.length} edited or missing`);
    for (const f of r.files) out.push(`    ${f.state}: ${f.rel}`);
    out.push(`  hooks in .claude/settings.json: ${r.hooks ? 'yes' : 'NO'}`);
    out.push(`  kit block in openspec/config.yaml: ${r.configBlock ? 'yes' : 'NO'}; questions language: ${r.questionsLanguage ?? '—'}; default schema: ${r.defaultSchema ?? '—'}`);
    return console.log(out.join('\n'));
  }
  if (r.command === 'uninstall') {
    out.push(`${r.dryRun ? '[dry run] ' : ''}sdd-kit uninstall in ${r.root}`);
    out.push(`  removed ${r.removed.length} kit file(s)`);
    for (const k of r.kept) out.push(`  kept (edited locally): ${k}`);
    for (const a of r.actions) out.push(`  ${a.step}: ${a.op}`);
    if (r.note) out.push(r.note);
    return console.log(out.join('\n'));
  }
  if (r.dryRun) {
    out.push(`[dry run] sdd-kit ${r.kitVersion} → ${r.root}`);
    const counts = {};
    for (const f of r.plan.files) counts[f.op] = (counts[f.op] || 0) + 1;
    out.push(`  kit files: ${Object.entries(counts).map(([k, v]) => `${v} ${k}`).join(', ')}`);
    for (const f of r.plan.files.filter((x) => !['unchanged', 'create', 'update'].includes(x.op))) out.push(`    ${f.op}: ${f.rel}`);
    out.push(`  openspec/config.yaml: ${r.plan.config}; .claude/settings.json: ${r.plan.settings}; .gitignore: ${r.plan.gitignore}`);
    if (r.plan.openspec) out.push(`  openspec CLI: ${r.plan.openspec}`);
    for (const w of r.plan.warnings) out.push(`  warning: ${w}`);
    return console.log(out.join('\n'));
  }
  out.push(`sdd-kit ${r.kitVersion} installed in ${r.root}`);
  const counts = {};
  for (const f of r.files) counts[f.op] = (counts[f.op] || 0) + 1;
  out.push(`  kit files: ${Object.entries(counts).map(([k, v]) => `${v} ${k}`).join(', ')}`);
  for (const f of r.files.filter((x) => x.op.startsWith('conflict') || x.op === 'keep-modified' || x.op === 'overwrite')) {
    out.push(
      `    ${f.op === 'overwrite' ? 'replaced (backup: .sdd-kit-backup)' : f.op === 'keep-modified' ? 'removed from the kit but edited locally, kept' : f.op === 'conflict-modified' ? 'edited locally, NOT updated' : 'exists and is not a kit file, NOT touched'}: ${f.rel}`,
    );
  }
  for (const a of r.actions) out.push(`  ${a.step}${a.op ? `: ${a.op}` : ''}`);
  out.push(`  questions language: ${r.questionsLanguage}; presets: ${r.presets.length ? r.presets.join(', ') : 'none'}`);
  for (const w of r.warnings) out.push(`  warning: ${w}`);
  const lintErrors = r.lint.findings.filter((f) => f.level === 'error');
  out.push(`  self-check (lint-kit): ${lintErrors.length ? 'FAILED' : 'OK'}`);
  for (const f of r.lint.findings) out.push(`    ${f.level}: ${f.file ?? ''}${f.line ? `:${f.line}` : ''} ${f.message}`);
  if (r.files.some((f) => f.op.startsWith('conflict'))) out.push('Some kit files were not updated because they differ from what the kit wrote. Review them, or re-run with --force (backups are kept).');
  out.push('Next: commit openspec/, .claude/settings.json, .claude/skills/openspec-*, .claude/commands/ and .gitignore.');
  console.log(out.join('\n'));
}

async function main() {
  const args = parseArgs(process.argv.slice(2), ['json', 'help', 'force', 'dry-run', 'yes', 'skip-openspec', 'keep-default-schema', 'allow-version-mismatch']);
  const cmd = args._[0];
  if (args.help || !cmd) {
    console.log(USAGE);
    process.exitCode = cmd || args.help ? 0 : 1;
    return;
  }
  const opts = {
    target: args.target,
    kitDir: args['kit-dir'],
    questionsLanguage: args['questions-language'],
    keepDefaultSchema: args['keep-default-schema'],
    skipOpenspec: args['skip-openspec'],
    allowVersionMismatch: args['allow-version-mismatch'],
    presets: args.preset ? String(args.preset).split(',').map((s) => s.trim()).filter(Boolean) : [],
    force: args.force,
    dryRun: args['dry-run'],
    yes: args.yes,
    json: args.json,
  };
  let result;
  try {
    if (cmd === 'install' || cmd === 'update') result = await install(opts);
    else if (cmd === 'status') result = status(opts);
    else if (cmd === 'uninstall') result = uninstall(opts);
    else throw new InstallError(`unknown command "${cmd}"\n\n${USAGE}`);
  } catch (e) {
    if (!(e instanceof InstallError)) throw e;
    if (args.json) console.log(JSON.stringify({ ok: false, error: e.message }, null, 2));
    else console.error(`sdd-kit: ${e.message}`);
    process.exitCode = 1;
    return;
  }
  if (args.json) console.log(JSON.stringify({ ok: true, ...result }, null, 2));
  else printHuman(result);
  if (result.lint && !result.lint.ok) process.exitCode = 1;
}

// entry point (also through the npm bin symlink created by `npx`)
if (process.argv[1] && pathToFileURL(realpathSync(process.argv[1])).href === import.meta.url) main();
