#!/usr/bin/env node
// sdd-kit: managed file. Do not edit; local changes are overwritten on kit update.
// Prints what the test reviewer needs (openspec/protocols/review-tests.md): every scenario of the change with
// its THEN / AND clauses and planned levels, every test carrying its marker (file:line), and heuristic signals
// of weak tests. Collecting markers runs verify.yaml's `collect` commands (no tests are executed).
//   node openspec/tooling/bin/review-input.mjs --change <name> [--json]
import { existsSync } from 'node:fs';
import { testReviewInput, renderTestReviewInput } from '../lib/reviews.mjs';
import { parseArgs } from '../lib/report.mjs';
import { findRoot, changeDir } from '../lib/project.mjs';

const args = parseArgs(process.argv.slice(2), ['json', 'help']);
if (args.help || !args.change) {
  console.log('Usage: review-input.mjs --change <name> [--json] [--root <dir>]');
  process.exit(args.help ? 0 : 1);
}
const root = args.root || findRoot();
const dir = root && changeDir(root, args.change);
if (!dir || !existsSync(dir)) {
  console.error(`sdd-kit review-input: change "${args.change}" not found`);
  process.exit(1);
}
const input = testReviewInput(root, dir);
console.log(args.json ? JSON.stringify(input, null, 2) : renderTestReviewInput(args.change, input));
