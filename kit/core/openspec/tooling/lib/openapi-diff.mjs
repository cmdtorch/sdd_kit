// sdd-kit: managed file. Do not edit; local changes are overwritten on kit update.
// Operation-level diff of two OpenAPI 3 documents (JSON), zero dependencies. Good enough to tell the
// frontend what changed and what breaks it; not a full OpenAPI validator.
//
// Every operation (METHOD path) is reduced to a flat shape:
//   params     "query:date_from" → {type, required}
//   request    "student", "items[].qty" → {type, required}  (+ requestRequired)
//   responses  "200" → { "items[].total" → {type} }
// $ref (#/components/...) and allOf are resolved; oneOf/anyOf become a "oneOf" type; cycles stop at depth.
//
// Breaking for an existing client: removed operation; new required parameter or request field; a parameter
// or request field that became required; any type change; a removed response field; a removed 2xx status.

const METHODS = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'];
const MAX_DEPTH = 8;

function deref(doc, node, seen = new Set()) {
  let n = node;
  while (n && n.$ref) {
    if (seen.has(n.$ref)) return { type: `cycle(${n.$ref.split('/').pop()})` };
    seen.add(n.$ref);
    const parts = n.$ref.replace(/^#\//, '').split('/').map((p) => p.replace(/~1/g, '/').replace(/~0/g, '~'));
    n = parts.reduce((o, k) => (o ? o[k] : undefined), doc);
  }
  return n || {};
}

function typeOf(s) {
  if (s.oneOf || s.anyOf) return 'oneOf';
  let t = s.type || (s.properties ? 'object' : s.items ? 'array' : s.enum ? 'string' : 'any');
  if (Array.isArray(t)) t = t.filter((x) => x !== 'null').join('|');
  if (s.format) t += `(${s.format})`;
  if (s.enum) t += `{${s.enum.filter((e) => e !== null && e !== '').join(',')}}`;
  return t;
}

/** Flattens a schema into "path" → {type, required}. */
export function flatten(doc, schema, prefix = '', out = {}, depth = 0, required = false) {
  let s = deref(doc, schema);
  if (s.allOf) {
    const merged = { type: 'object', properties: {}, required: [] };
    for (const part of s.allOf) {
      const p = deref(doc, part);
      Object.assign(merged.properties, p.properties || {});
      merged.required.push(...(p.required || []));
      if (p.type && p.type !== 'object') merged.type = p.type;
    }
    s = merged;
  }
  if (prefix) out[prefix] = { type: typeOf(s), required };
  if (depth >= MAX_DEPTH) return out;
  if (s.properties) {
    const req = new Set(s.required || []);
    for (const [name, child] of Object.entries(s.properties)) {
      const c = deref(doc, child);
      if (c.readOnly && out.__mode === 'request') continue;
      flatten(doc, child, prefix ? `${prefix}.${name}` : name, out, depth + 1, req.has(name));
    }
  }
  if (s.items) flatten(doc, s.items, `${prefix}[]`, out, depth + 1, false);
  return out;
}

const jsonSchema = (content) => {
  if (!content) return null;
  const key = Object.keys(content).find((k) => k.includes('json')) || Object.keys(content)[0];
  return key ? content[key].schema || null : null;
};

function shapeOf(doc, op, pathItem) {
  const params = {};
  for (const raw of [...(pathItem.parameters || []), ...(op.parameters || [])]) {
    const p = deref(doc, raw);
    params[`${p.in}:${p.name}`] = { type: typeOf(deref(doc, p.schema || {})), required: Boolean(p.required) };
  }
  const body = op.requestBody ? deref(doc, op.requestBody) : null;
  const reqSchema = body ? jsonSchema(body.content) : null;
  const request = {};
  if (reqSchema) {
    Object.defineProperty(request, '__mode', { value: 'request', enumerable: false, writable: true });
    flatten(doc, reqSchema, '', request);
  }
  const responses = {};
  for (const [status, raw] of Object.entries(op.responses || {})) {
    const r = deref(doc, raw);
    const sch = jsonSchema(r.content);
    responses[status] = sch ? flatten(doc, sch) : {};
  }
  return { params, request, requestRequired: Boolean(body && body.required), responses, summary: op.summary || op.description || '', security: (op.security || doc.security || []).map((x) => Object.keys(x)[0] || 'anonymous') };
}

/** All operations: { "GET /path": shape }. */
export function operations(doc) {
  const out = {};
  for (const [path, item] of Object.entries(doc.paths || {})) {
    for (const m of METHODS) if (item[m]) out[`${m.toUpperCase()} ${path}`] = shapeOf(doc, item[m], item);
  }
  return out;
}

function compareFields(where, before, after, details, { responseSide }) {
  for (const [f, a] of Object.entries(after)) {
    const b = before[f];
    if (!b) {
      const breaking = !responseSide && a.required;
      details.push({ where, field: f, change: 'added', breaking, text: `${where}: ${responseSide ? 'new field' : a.required ? 'new REQUIRED field' : 'new optional field'} "${f}" (${a.type})` });
    } else {
      if (b.type !== a.type) details.push({ where, field: f, change: 'type', breaking: true, text: `${where}: "${f}" type ${b.type} → ${a.type}` });
      if (!responseSide && !b.required && a.required) details.push({ where, field: f, change: 'required', breaking: true, text: `${where}: "${f}" is now required` });
      if (!responseSide && b.required && !a.required) details.push({ where, field: f, change: 'optional', breaking: false, text: `${where}: "${f}" is now optional` });
    }
  }
  for (const [f, b] of Object.entries(before)) {
    if (after[f]) continue;
    details.push({ where, field: f, change: 'removed', breaking: responseSide, text: `${where}: field "${f}" removed${responseSide ? '' : ' (clients may stop sending it)'}` });
  }
}

/** Diff of two OpenAPI documents. Returns { operations: [{method, path, change, breaking, details, shape?}] }. */
export function diffOpenapi(before, after) {
  const A = operations(before);
  const B = operations(after);
  const ops = [];
  for (const id of [...new Set([...Object.keys(A), ...Object.keys(B)])].sort((x, y) => x.split(' ')[1].localeCompare(y.split(' ')[1]) || x.localeCompare(y))) {
    const [method, path] = [id.slice(0, id.indexOf(' ')), id.slice(id.indexOf(' ') + 1)];
    if (!A[id]) {
      ops.push({ method, path, change: 'added', breaking: false, details: [], shape: B[id] });
      continue;
    }
    if (!B[id]) {
      ops.push({ method, path, change: 'removed', breaking: true, details: [{ where: 'operation', change: 'removed', breaking: true, text: 'operation removed' }] });
      continue;
    }
    const a = A[id];
    const b = B[id];
    const details = [];
    compareFields('parameter', a.params, b.params, details, { responseSide: false });
    compareFields('request body', a.request, b.request, details, { responseSide: false });
    if (!a.requestRequired && b.requestRequired) details.push({ where: 'request body', change: 'required', breaking: true, text: 'request body is now required' });
    for (const status of new Set([...Object.keys(a.responses), ...Object.keys(b.responses)])) {
      if (!b.responses[status]) details.push({ where: `response ${status}`, change: 'removed', breaking: /^2/.test(status), text: `response ${status} removed` });
      else if (!a.responses[status]) details.push({ where: `response ${status}`, change: 'added', breaking: false, text: `new response ${status}` });
      else compareFields(`response ${status}`, a.responses[status], b.responses[status], details, { responseSide: true });
    }
    if (JSON.stringify(a.security) !== JSON.stringify(b.security)) details.push({ where: 'security', change: 'modified', breaking: true, text: `authentication changed: ${a.security.join(', ') || 'none'} → ${b.security.join(', ') || 'none'}` });
    if (details.length) ops.push({ method, path, change: 'modified', breaking: details.some((d) => d.breaking), details, shape: b });
  }
  return { operations: ops };
}

/** Stable JSON (sorted keys) for snapshots and comparisons. */
export function stableJson(value) {
  const sort = (v) => (Array.isArray(v) ? v.map(sort) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sort(v[k])])) : v);
  return JSON.stringify(sort(value), null, 2) + '\n';
}
