// sdd-kit: managed file. Do not edit; local changes are overwritten on kit update.
// Shared result format and CLI runner for the kit checks.
//
// Every check returns a report:
//   { check, ok, skipped?, reason?, findings: [{ level: 'error'|'warning', file?, line?, message, hint? }] }
// `ok` is false only when there is at least one error. Warnings never fail a check.
// CLI: human-readable text by default, `--json` for machines; exit code 0 (ok) or 1 (errors or usage problem).
import { relative } from 'node:path';
import { realpathSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { findRoot } from './project.mjs';

export function makeReport(check, findings, extra = {}) {
  return { check, ok: !findings.some((f) => f.level === 'error'), findings, ...extra };
}

export function skippedReport(check, reason) {
  return { check, ok: true, skipped: true, reason, findings: [] };
}

/** Collector that keeps file paths relative to the project root. */
export function findingsFor(root) {
  const list = [];
  const add = (level, file, line, message, hint) => {
    const f = { level, message };
    if (file) f.file = relative(root, file) || file;
    if (line) f.line = line;
    if (hint) f.hint = hint;
    list.push(f);
  };
  return {
    list,
    error: (file, line, message, hint) => add('error', file, line, message, hint),
    warning: (file, line, message, hint) => add('warning', file, line, message, hint),
  };
}

export function formatText(report) {
  const out = [];
  if (report.skipped) {
    out.push(`${report.check}: skipped — ${report.reason}`);
    return out.join('\n');
  }
  for (const f of report.findings) {
    const where = f.file ? `${f.file}${f.line ? `:${f.line}` : ''}: ` : '';
    out.push(`${f.level === 'error' ? 'ERROR' : 'warning'} ${where}${f.message}`);
    if (f.hint) out.push(`        → ${f.hint}`);
  }
  const errors = report.findings.filter((f) => f.level === 'error').length;
  const warnings = report.findings.length - errors;
  out.push(`${report.check}: ${report.ok ? 'OK' : 'FAILED'} (${errors} error(s), ${warnings} warning(s))`);
  return out.join('\n');
}

/** Parses `--flag value`, `--flag=value` and boolean `--flag`. */
export function parseArgs(argv, booleans = []) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) {
      args._.push(a);
      continue;
    }
    const eq = a.indexOf('=');
    const key = a.slice(2, eq === -1 ? undefined : eq);
    if (eq !== -1) args[key] = a.slice(eq + 1);
    else if (booleans.includes(key)) args[key] = true;
    else args[key] = argv[++i];
  }
  return args;
}

/**
 * Runs a check from the command line.
 * `run(args, root)` returns a report. `usage` is printed on --help or a usage error.
 */
export async function runCli(name, usage, run, booleans = []) {
  const args = parseArgs(process.argv.slice(2), ['json', 'help', ...booleans]);
  if (args.help) {
    console.log(usage);
    return;
  }
  const root = args.root || findRoot();
  let report;
  try {
    if (!root) throw new UsageError('no openspec/ directory found (run inside the project or pass --root)');
    report = await run(args, root);
  } catch (e) {
    if (!(e instanceof UsageError)) throw e;
    if (args.json) console.log(JSON.stringify({ check: name, ok: false, error: e.message, findings: [] }, null, 2));
    else console.error(`${name}: ${e.message}\n\n${usage}`);
    process.exitCode = 1;
    return;
  }
  console.log(args.json ? JSON.stringify(report, null, 2) : formatText(report));
  process.exitCode = report.ok ? 0 : 1;
}

export class UsageError extends Error {}

/** True when the module is the entry point (`node check-x.mjs`). */
export function isMain(importMetaUrl) {
  if (!process.argv[1]) return false;
  try {
    return importMetaUrl === pathToFileURL(realpathSync(process.argv[1])).href;
  } catch {
    return false;
  }
}
