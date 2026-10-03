// sdd-kit: managed file. Do not edit; local changes are overwritten on kit update.
// Review inputs and review status (openspec/protocols/review-tests.md, review-specs.md).
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadChangeDeltas, changeScenarios } from './spec-parser.mjs';
import { parsePlan, key } from './plan.mjs';
import { loadVerifyConfig } from './verify-config.mjs';
import { collectMarkers } from './verify-run.mjs';
import { findPythonTest, findTsTest, pythonSignals, tsSignals } from './test-smells.mjs';
import { readIn } from './project.mjs';

export const TEST_REVIEW = 'reviews/test-review.md';
export const SPEC_REVIEW = 'reviews/spec-review.md';

const thenClauses = (body) =>
  body
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => /^[-*]\s*\*\*(THEN|AND)\*\*/.test(l))
    .map((l) => l.replace(/^[-*]\s*\*\*(THEN|AND)\*\*\s*/, ''));

/** Everything the test reviewer needs for a change: scenarios, THEN clauses, plan, marked tests + signals. */
export function testReviewInput(root, dir) {
  const deltas = loadChangeDeltas(root, dir);
  const plan = parsePlan(readIn(dir, 'verification-plan.md') || '');
  const scenarios = [];
  for (const { capability, delta } of deltas) {
    for (const r of [...delta.added, ...delta.modified]) {
      for (const s of r.scenarios) scenarios.push({ capability, requirement: r.name, scenario: s.name, then: thenClauses(s.body) });
    }
  }
  let markers = [];
  const notes = [];
  let cfg = null;
  try {
    cfg = loadVerifyConfig(root);
  } catch (e) {
    notes.push(e.message);
  }
  if (cfg) {
    const c = collectMarkers({ root });
    markers = c.markers;
    notes.push(...c.problems);
  } else notes.push('openspec/tooling/verify.yaml is missing: marked tests could not be collected');
  const fileCache = new Map();
  const readTestFile = (rel) => {
    if (!fileCache.has(rel)) fileCache.set(rel, existsSync(join(root, rel)) ? readFileSync(join(root, rel), 'utf8') : null);
    return fileCache.get(rel);
  };
  for (const s of scenarios) {
    const k = key(s.capability, s.scenario);
    s.planned = [...new Set(plan.coverage.rows.filter((r) => key(r.capability, r.scenario) === k).map((r) => r.level))];
    s.excluded = plan.exclusions.rows.some((r) => key(r.capability, r.scenario) === k);
    s.tests = markers
      .filter((m) => key(m.capability, m.scenario) === k)
      .map((m) => {
        const file = m.file || m.test.split('::')[0];
        const content = readTestFile(file);
        let found = null;
        let signals = [];
        if (content !== null) {
          if (/\.py$/.test(file)) {
            found = findPythonTest(content, m.test);
            if (found) signals = pythonSignals(found, s.then.length);
          } else {
            let line = Number((m.test.match(/:(\d+)\s*›/) || [])[1]);
            if (!line) {
              // no "file:line ›" in the id (e.g. sdd-json reports): find the test by its title
              const title = m.test.split(/::|›/).pop().trim();
              const idx = content.split('\n').findIndex((l) => l.includes(`test(${JSON.stringify(title).slice(0, -1)}`) || l.includes(`test('${title}'`) || l.includes(`test(\`${title}\``));
              line = idx >= 0 ? idx + 1 : 0;
            }
            found = line ? findTsTest(content, line) : null;
            if (found) signals = tsSignals(found, s.then.length);
          }
        }
        return { level: m.level, test: m.test, file, line: found?.line ?? null, signals, located: Boolean(found) };
      });
    s.missing = s.planned.filter((lvl) => lvl !== 'manual' && !s.tests.some((t) => t.level === lvl));
  }
  return { scenarios, notes };
}

export function renderTestReviewInput(change, input) {
  const out = [`# Review input — ${change}`, '', 'Signals are heuristics: confirm or dismiss each one by reading the test (openspec/protocols/review-tests.md).', ''];
  for (const n of input.notes) out.push(`> note: ${n}`, '');
  for (const s of input.scenarios) {
    out.push(`## ${s.capability} › ${s.requirement} › "${s.scenario}"`, '');
    out.push(`Planned: ${s.planned.length ? s.planned.join(', ') : s.excluded ? 'excluded' : 'NOT PLANNED'}`);
    out.push('THEN / AND:', ...(s.then.length ? s.then.map((t) => `- ${t}`) : ['- (none)']));
    out.push('Tests:');
    if (!s.tests.length) out.push('- (no test carries this scenario marker)');
    for (const t of s.tests) {
      out.push(`- ${t.level}: ${t.test}${t.line ? ` (${t.file}:${t.line})` : t.located ? '' : ' (source not found)'}`);
      if (t.signals.length) out.push(`  signals: ${t.signals.join('; ')}`);
    }
    if (s.missing.length) out.push(`Missing: ${s.missing.join(', ')} (planned, no marked test)`);
    out.push('');
  }
  return out.join('\n');
}

/** Problems with the test review of a change directory (empty = fine). Needed when unit/e2e rows are planned. */
export function testReviewProblems(dir) {
  const plan = parsePlan(readIn(dir, 'verification-plan.md') || '');
  if (!plan.coverage.rows.some((r) => r.level === 'unit' || r.level === 'e2e')) return [];
  const text = readIn(dir, TEST_REVIEW);
  if (text === null) return [`no test review (${TEST_REVIEW}) — run the test-reviewer subagent (openspec/protocols/review-tests.md)`];
  const verdict = (text.match(/^Verdict:\s*(READY|NOT-READY)\s*$/m) || [])[1];
  if (!verdict) return [`${TEST_REVIEW} has no "Verdict: READY" or "Verdict: NOT-READY" line`];
  if (verdict === 'READY') return [];
  const decision = text.split(/^## Human decision\s*$/m)[1];
  const body = decision ? decision.replace(/<!--[\s\S]*?-->/g, '').split(/^## /m)[0].trim() : '';
  return body ? [] : [`test review is NOT-READY and "## Human decision" is empty — fix the findings and review again, or the human records the decision`];
}
