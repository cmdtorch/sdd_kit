// sdd-kit: managed file. Do not edit; local changes are overwritten on kit update.
// Review inputs and review status (openspec/protocols/review-tests.md, review-specs.md).
import { loadChangeDeltas } from './spec-parser.mjs';
import { parsePlan, key } from './plan.mjs';
import { collectMarkers } from './markers.mjs';
import { readIn } from './project.mjs';

export const TEST_REVIEW = 'reviews/test-review.md';
export const SPEC_REVIEW = 'reviews/spec-review.md';

const thenClauses = (body) =>
  body
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => /^[-*]\s*\*\*(THEN|AND)\*\*/.test(l))
    .map((l) => l.replace(/^[-*]\s*\*\*(THEN|AND)\*\*\s*/, ''));

/** Everything the test reviewer needs for a change: scenarios, THEN clauses, planned levels, marked tests. */
export function testReviewInput(root, dir) {
  const deltas = loadChangeDeltas(root, dir);
  const plan = parsePlan(readIn(dir, 'verification-plan.md') || '');
  const markers = collectMarkers(root);
  const scenarios = [];
  for (const { capability, delta } of deltas) {
    for (const r of [...delta.added, ...delta.modified]) {
      for (const s of r.scenarios) scenarios.push({ capability, requirement: r.name, scenario: s.name, then: thenClauses(s.body) });
    }
  }
  for (const s of scenarios) {
    const k = key(s.capability, s.scenario);
    s.planned = [...new Set(plan.coverage.rows.filter((r) => key(r.capability, r.scenario) === k).map((r) => r.level))];
    s.excluded = plan.exclusions.rows.some((r) => key(r.capability, r.scenario) === k);
    s.tests = markers.filter((m) => key(m.capability, m.scenario) === k).map((m) => ({ file: m.file, line: m.line }));
    s.missing = s.planned.some((lvl) => lvl !== 'manual') && !s.tests.length;
  }
  return { scenarios };
}

export function renderTestReviewInput(change, input) {
  const out = [`# Review input — ${change}`, '', 'Read every listed test in full and judge it against openspec/protocols/review-tests.md.', ''];
  for (const s of input.scenarios) {
    out.push(`## ${s.capability} › ${s.requirement} › "${s.scenario}"`, '');
    out.push(`Planned: ${s.planned.length ? s.planned.join(', ') : s.excluded ? 'excluded' : 'NOT PLANNED'}`);
    out.push('THEN / AND:', ...(s.then.length ? s.then.map((t) => `- ${t}`) : ['- (none)']));
    out.push('Tests:');
    if (!s.tests.length) out.push('- (no test carries this scenario marker)');
    for (const t of s.tests) out.push(`- ${t.file}:${t.line}`);
    if (s.missing) out.push('Missing: planned as automated, but no test carries the marker');
    out.push('');
  }
  return out.join('\n');
}

/** Problems with the test review of a change directory (empty = fine). Needed when automated rows are planned. */
export function testReviewProblems(dir) {
  const plan = parsePlan(readIn(dir, 'verification-plan.md') || '');
  if (!plan.coverage.rows.some((r) => r.level !== 'manual')) return [];
  const text = readIn(dir, TEST_REVIEW);
  if (text === null) return [`no test review (${TEST_REVIEW}) — run the test-reviewer subagent (openspec/protocols/review-tests.md)`];
  const verdict = (text.match(/^Verdict:\s*(READY|NOT-READY)\s*$/m) || [])[1];
  if (!verdict) return [`${TEST_REVIEW} has no "Verdict: READY" or "Verdict: NOT-READY" line`];
  if (verdict === 'READY') return [];
  const decision = text.split(/^## Human decision\s*$/m)[1];
  const body = decision ? decision.replace(/<!--[\s\S]*?-->/g, '').split(/^## /m)[0].trim() : '';
  return body ? [] : [`test review is NOT-READY and "## Human decision" is empty — fix the findings and review again, or the human records the decision`];
}
