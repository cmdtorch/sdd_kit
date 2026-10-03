// sdd-kit: managed file. Do not edit; local changes are overwritten on kit update.
// Heuristic signals of weak tests (openspec/protocols/testing.md §4) for the test reviewer. They are hints,
// not verdicts: the reviewer confirms or dismisses each one by reading the test.
// Supported: pytest (Python functions and methods) and Playwright / Jest-style `test(...)` in TS/JS.

const PY_ASSERT = /^\s*(assert\b|self\.assert\w*\(|[\w.]+\.assert_(called|any_call|has_calls|not_called)\w*\()/;
const PY_MOCK = /\.assert_(called|any_call|has_calls|not_called)|\bassert\s+\w+(\.\w+)*\.called\b/;
const PY_COMPARE = /==|!=|<=|>=|\s<\s|\s>\s|\bin\b|\bis\b|self\.assert(Equal|In|NotIn|Raises|Is)/;

/** Locates a pytest test by node id ("path::Class::test[param]") in file content: {line, body} or null. */
export function findPythonTest(content, nodeId) {
  const parts = nodeId.split('::').slice(1).map((p) => p.replace(/\[.*$/, ''));
  if (!parts.length) return null;
  const fn = parts[parts.length - 1];
  const cls = parts.length > 1 ? parts[parts.length - 2] : null;
  const lines = content.split('\n');
  let from = 0;
  if (cls) {
    const c = lines.findIndex((l) => new RegExp(`^\\s*class\\s+${cls}\\b`).test(l));
    if (c === -1) return null;
    from = c;
  }
  const d = lines.findIndex((l, i) => i >= from && new RegExp(`^\\s*(async\\s+)?def\\s+${fn}\\s*\\(`).test(l));
  if (d === -1) return null;
  const indent = lines[d].match(/^\s*/)[0].length;
  let end = d + 1;
  // the signature may span lines: skip to the line ending with ":"
  while (end < lines.length && !/:\s*(#.*)?$/.test(lines[end - 1])) end++;
  const bodyStart = end;
  while (end < lines.length && (lines[end].trim() === '' || lines[end].match(/^\s*/)[0].length > indent)) end++;
  let decoStart = d;
  while (decoStart > 0 && /^\s*@/.test(lines[decoStart - 1])) decoStart--;
  return { line: d + 1, body: lines.slice(bodyStart, end).join('\n'), decorators: lines.slice(decoStart, d).join('\n') };
}

/** Locates a Playwright test by its reported location "file:LINE › title": {line, body} or null. */
export function findTsTest(content, line) {
  const lines = content.split('\n');
  const start = line - 1;
  if (start < 0 || start >= lines.length) return null;
  const text = lines.slice(start).join('\n');
  const arrow = text.search(/=>\s*\{|function\s*\([^)]*\)\s*\{/);
  if (arrow === -1) return null;
  let i = text.indexOf('{', arrow);
  let depth = 0;
  const open = i;
  for (; i < text.length; i++) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}' && --depth === 0) break;
  }
  return { line, body: text.slice(open + 1, i), decorators: text.slice(0, open) };
}

/** Signals for a Python test body. `thenCount` = THEN/AND clauses of the scenario. */
export function pythonSignals({ body, decorators }, thenCount = 0) {
  const signals = [];
  const lines = body.split('\n').filter((l) => !/^\s*#/.test(l));
  const asserts = lines.filter((l) => PY_ASSERT.test(l));
  const raises = lines.filter((l) => /pytest\.raises\(|assertRaises/.test(l));
  if (/pytest\.mark\.(skip|xfail)|unittest\.skip/.test(decorators || '') || lines.some((l) => /pytest\.(skip|xfail)\(/.test(l))) signals.push('skipped or xfail');
  if (!asserts.length && !raises.length) {
    signals.push('no assertion');
    return signals;
  }
  if (asserts.length && asserts.every((l) => PY_MOCK.test(l))) signals.push('only mock calls are asserted');
  else if (asserts.length && !raises.length && asserts.every((l) => /status_code\s*==\s*\d+|status_code\s*in\s*/.test(l))) signals.push('only the status code is asserted');
  else if (asserts.length && asserts.every((l) => !PY_COMPARE.test(l) && !PY_MOCK.test(l))) signals.push('only truthiness is asserted (no comparison with an expected value)');
  const n = asserts.length + raises.length;
  if (thenCount && n < thenCount) signals.push(`${thenCount} THEN/AND clause(s), ${n} assertion(s)`);
  return signals;
}

/** Signals for a TS/JS test body. */
export function tsSignals({ body, decorators }, thenCount = 0) {
  const signals = [];
  if (/test\.(skip|fixme|fail)\(/.test(body) || /test\.(skip|fixme)\s*\(/.test(decorators || '')) signals.push('skipped, fixme or expected to fail');
  const expects = body.match(/\bexpect(\.soft)?\(/g) || [];
  if (!expects.length) {
    signals.push('no assertion');
    return signals;
  }
  const weak = body.match(/\.(toBeTruthy|toBeDefined|not\.toBeNull|not\.toBeUndefined)\(\)/g) || [];
  if (weak.length === expects.length) signals.push('only truthiness is asserted (toBeTruthy / toBeDefined)');
  if (thenCount && expects.length < thenCount) signals.push(`${thenCount} THEN/AND clause(s), ${expects.length} assertion(s)`);
  return signals;
}
