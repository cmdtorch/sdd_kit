#!/usr/bin/env node
// sdd-kit: managed file. Do not edit; local changes are overwritten on kit update.
// The start check at the beginning of apply (openspec/protocols/apply.md): starts the application with the
// project's own command, requests an address of it until it answers, stops it again, and records the result.
//   node openspec/tooling/bin/start-check.mjs --change <name> --start "<cmd>" --url <url> [--stop "<cmd>"]
// The start command runs through `sh -c` in the project root, in its own process group. The address is
// requested every 2 seconds for up to 2 minutes (--interval / --timeout in seconds change that); a status
// below 500 passes. A start command that exits with an error fails at once. Afterwards the stop command runs
// (when given) and the process group of the start command is ended. The result goes to start-check.json in
// the change root (lib/start-check.mjs); the archive gate asks for it when the plan needs a running
// application. Exit code 0 when the check passed, 1 otherwise. The script changes nothing outside the
// project: the start and stop commands are the project's own.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from '../lib/report.mjs';
import { findRoot, changeDir } from '../lib/project.mjs';
import { START_CHECK_FILE } from '../lib/start-check.mjs';

const NAME = 'sdd-kit start-check';
const USAGE = `Usage: start-check.mjs --change <name> --start "<command>" --url <url> [--stop "<command>"]
                      [--timeout <seconds>] [--interval <seconds>] [--root <dir>]

Starts the application with the project's command, requests <url> every 2 seconds for up to 2 minutes
(a status below 500 passes), stops it again and writes ${START_CHECK_FILE} in the change root.`;
const OUTPUT_LINES = 30;

function fail(message) {
  console.error(`${NAME}: ${message}`);
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** One request: { status } or { error }. */
async function probe(url) {
  try {
    const res = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(5000) });
    await res.body?.cancel();
    return { status: res.status };
  } catch (e) {
    return { error: String(e?.cause?.code || e?.cause?.message || e?.message || e) };
  }
}

/** Ends the process group of the start command: TERM, then KILL after 5 s. */
async function endGroup(child) {
  const alive = () => {
    try {
      process.kill(-child.pid, 0);
      return true;
    } catch {
      return false;
    }
  };
  if (!alive()) return;
  try {
    process.kill(-child.pid, 'SIGTERM');
  } catch {
    return;
  }
  for (let i = 0; i < 50 && alive(); i++) await sleep(100);
  if (alive()) {
    try {
      process.kill(-child.pid, 'SIGKILL');
    } catch {
      /* already gone */
    }
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2), ['help']);
  if (args.help) {
    console.log(USAGE);
    return 0;
  }
  for (const k of ['change', 'start', 'url']) if (!args[k]) fail(`--${k} is required\n\n${USAGE}`);
  if (!/^https?:\/\//i.test(args.url)) fail(`--url must be an http(s) address, got "${args.url}"`);
  const root = args.root || findRoot();
  if (!root) fail('no openspec/ directory found (run inside the project or pass --root)');
  const dir = changeDir(root, args.change);
  if (!existsSync(dir)) fail(`change "${args.change}" not found`);
  const timeout = Number(args.timeout ?? 120) * 1000;
  const interval = Number(args.interval ?? 2) * 1000;
  if (!(timeout > 0) || !(interval > 0)) fail('--timeout and --interval must be positive numbers of seconds');

  const started = Date.now();
  const child = spawn('sh', ['-c', args.start], { cwd: root, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  const keep = (d) => {
    output = (output + d).split('\n').slice(-OUTPUT_LINES).join('\n');
  };
  child.stdout.on('data', keep);
  child.stderr.on('data', keep);
  let exit = null;
  child.on('exit', (code, signal) => (exit = { code, signal }));

  let last = {};
  let ok = false;
  let error = null;
  while (true) {
    last = await probe(args.url);
    if (last.status !== undefined && last.status < 500) {
      ok = true;
      break;
    }
    if (exit && exit.code !== 0) {
      error = `the start command exited with code ${exit.code ?? exit.signal}`;
      break;
    }
    if (Date.now() - started >= timeout) {
      error = last.status !== undefined ? `answered ${last.status}` : `did not answer within ${timeout / 1000} s (${last.error})`;
      break;
    }
    await sleep(interval);
  }

  if (args.stop) {
    const r = spawnSync('sh', ['-c', args.stop], { cwd: root, encoding: 'utf8', timeout: 120000 });
    if (r.status !== 0) keep(`[stop command exited with code ${r.status}]\n${r.stderr || ''}`);
  }
  await endGroup(child);

  const record = {
    ok,
    url: args.url,
    start: args.start,
    stop: args.stop || null,
    status: last.status ?? null,
    error,
    seconds: Math.round((Date.now() - started) / 100) / 10,
    at: new Date().toISOString(),
    output: output.trim(),
  };
  writeFileSync(join(dir, START_CHECK_FILE), JSON.stringify(record, null, 2) + '\n');
  if (ok) {
    console.log(`${NAME}: start check passed: ${args.url} answered ${record.status} after ${record.seconds} s; the application is stopped again.`);
    return 0;
  }
  console.log(`${NAME}: start check failed: ${args.url} ${error}.`);
  if (record.output) console.log(`Last output of the start command:\n${record.output}`);
  console.log(`Stop before the first task and let the developer choose (openspec/protocols/apply.md, "Failed start").`);
  return 1;
}

main().then((code) => process.exit(code), (e) => fail(e?.stack || String(e)));
