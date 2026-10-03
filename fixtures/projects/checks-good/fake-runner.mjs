// Fake test runner for sdd-kit tests: behaves like a test tool configured in verify.yaml.
// Tests come from fake-tests.json: [{level, capability, scenario, test, outcome}].
//   node fake-runner.mjs collect <level> <out>        markers only (no outcome)
//   node fake-runner.mjs run <level> <out> [ids...]   results; exit 1 when a test failed
//   node fake-runner.mjs gate                         exit 1 when the file "fake-gate-fails" exists
// Every call is appended to fake-runs.log.
import { readFileSync, writeFileSync, appendFileSync, existsSync } from 'node:fs';
const [cmd, level, out, ...ids] = process.argv.slice(2);
appendFileSync('fake-runs.log', [cmd, level, ...ids].filter(Boolean).join(' ') + '\n');
if (cmd === 'gate') process.exit(existsSync('fake-gate-fails') ? 1 : 0);
const all = JSON.parse(readFileSync('fake-tests.json', 'utf8')).filter((t) => t.level === level);
const picked = ids.length ? all.filter((t) => ids.includes(t.test) || ids.includes(t.test.split('::')[0])) : all;
if (cmd === 'collect') {
  writeFileSync(out, JSON.stringify(picked.map(({ outcome, ...t }) => t)));
  process.exit(0);
}
writeFileSync(out, JSON.stringify(picked));
console.log(`${picked.filter((t) => t.outcome === 'passed').length} passed`);
process.exit(picked.some((t) => t.outcome === 'failed' || t.outcome === 'error') ? 1 : 0);
