#!/usr/bin/env node
// sdd-kit: managed file. Do not edit; local changes are overwritten on kit update.
// test-gate — Stop hook. Apply cannot finish with failing tests.
//
// A change is "armed" when the agent checks off its last task in tasks.md (artifact-feedback records
// that). When Claude tries to stop and an armed change exists, this hook runs the full verification
// (verify.yaml: full suite + quality gate + E2E) and check-traceability. If anything fails, the stop is
// blocked and the failure output goes back to Claude. Re-entry is bounded (D: stop_block_limit, default
// 3, reset on every new human message): after that the stop is allowed and the human is told to decide.
// A green run disarms the change. Waiting for an answer in the Apply round never blocks. After a handover
// the gate stays quiet for that change until files change (fingerprint) — the human already knows, and the
// archive gate and CI still refuse an unverified change.
import { runHook, hookRoot } from '../lib/hook-io.mjs';
import { listChanges, changeSchema, isKitSchema, readChangeFile } from '../lib/project.mjs';
import { loadVerifyConfig } from '../lib/verify-config.mjs';
import { runVerification } from '../lib/verify-run.mjs';
import { readState, writeState, fingerprint } from '../lib/state.mjs';
import { parseClarifications, roundStatus } from '../lib/clarifications.mjs';
import { checkTraceability } from '../checks/check-traceability.mjs';
import { isMain } from '../lib/report.mjs';

const out = (obj) => process.stdout.write(JSON.stringify(obj) + '\n');

function waitingForHuman(root, change) {
  const c = readChangeFile(root, change, 'clarifications.md');
  if (!c) return false;
  const st = roundStatus(parseClarifications(c), 'Apply');
  return st.exists && !st.confirmed;
}

/** Decides what the Stop hook does. Returns {block?: reason, systemMessage?} (empty = allow silently). */
export function testGate(input) {
  const root = hookRoot(input);
  if (!root) return {};
  const cfg = loadVerifyConfig(root);
  if (!cfg || cfg.gates.stop === 'off') return {};
  const armed = listChanges(root).filter((n) => isKitSchema(changeSchema(root, n)) && readState(root, `armed-${n}`)?.armed);
  if (!armed.length) return {};

  const counterKey = `stop-${String(input.session_id || 'session').replace(/[^\w-]/g, '')}`;
  const counter = input.stop_hook_active ? readState(root, counterKey) || { count: 0 } : { count: 0 };
  const failures = [];
  const notes = [];
  const handedOver = [];
  for (const change of armed) {
    if (waitingForHuman(root, change)) continue;
    const fp = fingerprint(root, change);
    const armState = readState(root, `armed-${change}`);
    if (armState?.handedOverFingerprint && fp && armState.handedOverFingerprint === fp) continue;
    const last = readState(root, `verify-${change}`);
    let ok;
    let manual = [];
    if (last && fp && last.fingerprint === fp && last.ok) {
      ok = true;
      manual = last.manualPending || [];
    } else {
      const r = runVerification({ root, change, mode: 'full', write: true });
      const trace = checkTraceability({ root, change, markers: r.markers });
      const traceErrors = trace.findings.filter((f) => f.level === 'error');
      ok = r.ok && !traceErrors.length;
      manual = r.manualPending.map((m) => `${m.scenario} (${m.capability})`);
      if (!ok) {
        const lines = [`Change "${change}" is not verified:`];
        for (const p of r.problems) lines.push(`- ${p}`);
        for (const row of r.rows.filter((x) => x.level !== 'manual' && x.verdict !== 'Met')) lines.push(`- ${row.verdict}: "${row.scenario}" (${row.capability}, ${row.level}) — ${row.actual}; ${row.evidence}`);
        for (const f of traceErrors) lines.push(`- ${f.message}`);
        failures.push(lines.join('\n'));
        handedOver.push({ change, fp });
      }
    }
    if (ok) {
      writeState(root, `armed-${change}`, { armed: false, at: new Date().toISOString() });
      if (manual.length) notes.push(`sdd-kit: "${change}" passed automated verification; manual checks still need a human result in verification.md: ${manual.join(', ')}.`);
    }
  }
  if (!failures.length) {
    writeState(root, counterKey, { count: 0 });
    return notes.length ? { systemMessage: notes.join('\n') } : {};
  }
  const limit = cfg.gates.stop_block_limit;
  if (counter.count >= limit) {
    writeState(root, counterKey, { count: 0 });
    for (const h of handedOver) writeState(root, `armed-${h.change}`, { armed: true, handedOverFingerprint: h.fp, at: new Date().toISOString() });
    return {
      systemMessage: `sdd-kit test gate: still failing after ${limit} attempt(s) — handing over to you. Decide how to proceed (fix, change the plan, or accept the risk explicitly); the change cannot be archived until verification is green.\n\n${failures.join('\n\n')}`,
    };
  }
  writeState(root, counterKey, { count: counter.count + 1 });
  return {
    block: `sdd-kit test gate (attempt ${counter.count + 1} of ${limit}): apply is not finished.\n\n${failures.join('\n\n')}\n\nFix the code, not the tests (openspec/protocols/testing.md §7), then finish again. If you cannot fix it, stop and explain the options to the human — after ${limit} attempts the gate hands over anyway.`,
  };
}

if (isMain(import.meta.url)) {
  runHook('test-gate', (input) => {
    const d = testGate(input);
    if (d.block) {
      // exit 2 + stderr: verified to make Claude continue with this text (docs/openspec-facts.md K4)
      process.stderr.write(d.block + '\n');
      process.exit(2);
    }
    if (d.systemMessage) out({ systemMessage: d.systemMessage });
  });
}
