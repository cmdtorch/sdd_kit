// Kit-managed files: which files the kit owns in a project, and how to update them without ever
// overwriting a developer's edit (CLAUDE.md working rule 7).
//
// The manifest (openspec/tooling/kit-manifest.json) records the sha256 of every file as the kit wrote
// it. On update a file is replaced only when it still has that hash; otherwise it was edited locally
// and is reported as a conflict (or backed up and replaced with --force).
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

export const MANIFEST = 'openspec/tooling/kit-manifest.json';

export const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

/** Files of a source dir as project-relative paths: {rel: absoluteSource}. */
export function listFiles(srcDir, prefix) {
  const out = {};
  const walk = (d) => {
    for (const name of readdirSync(d).sort()) {
      const p = join(d, name);
      if (statSync(p).isDirectory()) walk(p);
      else out[`${prefix}/${relative(srcDir, p).split(sep).join('/')}`] = p;
    }
  };
  walk(srcDir);
  return out;
}

export function readManifest(root) {
  const p = join(root, MANIFEST);
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, 'utf8'));
}

/**
 * Plans file operations. `kitFiles` = {rel: sourcePath}. Returns a list of actions:
 *   {rel, op: 'create'|'update'|'unchanged'|'restore'|'conflict-modified'|'conflict-foreign'|'delete'|'keep-modified', ...}
 * `force` turns conflicts into 'overwrite' (with a backup).
 */
export function planFiles(root, kitFiles, manifest, { force = false } = {}) {
  const known = manifest?.files || {};
  const actions = [];
  for (const [rel, src] of Object.entries(kitFiles)) {
    const content = readFileSync(src);
    const newHash = sha256(content);
    const target = join(root, rel);
    if (!existsSync(target)) {
      actions.push({ rel, src, hash: newHash, op: rel in known ? 'restore' : 'create' });
      continue;
    }
    const curHash = sha256(readFileSync(target));
    if (curHash === newHash) {
      actions.push({ rel, src, hash: newHash, op: 'unchanged' });
    } else if (rel in known && known[rel] === curHash) {
      actions.push({ rel, src, hash: newHash, op: 'update' });
    } else {
      const kind = rel in known ? 'conflict-modified' : 'conflict-foreign';
      actions.push({ rel, src, hash: newHash, op: force ? 'overwrite' : kind, keptHash: known[rel] });
    }
  }
  for (const [rel, hash] of Object.entries(known)) {
    if (rel in kitFiles) continue;
    const target = join(root, rel);
    if (!existsSync(target)) continue;
    const modified = sha256(readFileSync(target)) !== hash;
    actions.push({ rel, op: modified && !force ? 'keep-modified' : 'delete' });
  }
  return actions;
}

/** Manifest content after applying `actions` (conflicts keep their previous hash, if any). */
export function nextManifest(kitVersion, actions) {
  const files = {};
  for (const a of actions) {
    if (['create', 'update', 'unchanged', 'restore', 'overwrite'].includes(a.op)) files[a.rel] = a.hash;
    else if (a.op === 'conflict-modified' && a.keptHash) files[a.rel] = a.keptHash;
  }
  return { kit: 'sdd-kit', kitVersion, files: Object.fromEntries(Object.entries(files).sort()) };
}
