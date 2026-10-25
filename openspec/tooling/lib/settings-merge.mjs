// sdd-kit: managed file. Do not edit; local changes are overwritten on kit update.
// Merges the kit's hooks into a project's .claude/settings.json without touching anything else (D10):
// other hooks (e.g. graphify), plugins, permissions and unknown keys stay exactly as they are.
// Kit hooks are recognised by their command pointing into `openspec/tooling/hooks/`, so a re-run
// replaces old kit entries instead of duplicating them, and `removeKitHooks` cleanly uninstalls.
// Kit permissions (read-only kit scripts in `permissions.allow`) are recognised by `openspec/tooling/`.

const KIT_HOOK = /openspec\/tooling\/hooks\//;
const KIT_PERMISSION = /openspec\/tooling\//;

export function isKitHook(h) {
  return Boolean(h && h.type === 'command' && typeof h.command === 'string' && KIT_HOOK.test(h.command));
}

const clone = (x) => JSON.parse(JSON.stringify(x));

/** Returns a copy of `settings` without any kit hook; groups left empty by that are dropped. */
export function removeKitHooks(settings) {
  const out = removeKitPermissions(clone(settings || {}));
  if (!out.hooks || typeof out.hooks !== 'object') return out;
  for (const [event, groups] of Object.entries(out.hooks)) {
    if (!Array.isArray(groups)) continue;
    const kept = [];
    for (const g of groups) {
      if (!g || !Array.isArray(g.hooks)) {
        kept.push(g);
        continue;
      }
      const rest = g.hooks.filter((h) => !isKitHook(h));
      if (rest.length === g.hooks.length) kept.push(g);
      else if (rest.length) kept.push({ ...g, hooks: rest });
    }
    if (kept.length) out.hooks[event] = kept;
    else delete out.hooks[event];
  }
  if (!Object.keys(out.hooks).length) delete out.hooks;
  return out;
}

/** Copy without kit permission entries; an emptied allow list / permissions object is dropped. */
function removeKitPermissions(settings) {
  const out = clone(settings);
  const allow = out.permissions?.allow;
  if (!Array.isArray(allow)) return out;
  const rest = allow.filter((e) => !(typeof e === 'string' && KIT_PERMISSION.test(e)));
  if (rest.length === allow.length) return out;
  if (rest.length) out.permissions.allow = rest;
  else {
    delete out.permissions.allow;
    if (!Object.keys(out.permissions).length) delete out.permissions;
  }
  return out;
}

/**
 * Adds the fragment's hooks after the project's own hooks (existing kit hooks are replaced).
 * Idempotent: merge(merge(s, f), f) deep-equals merge(s, f).
 */
export function mergeSettings(settings, fragment) {
  if (settings !== undefined && settings !== null && (typeof settings !== 'object' || Array.isArray(settings))) {
    throw new Error('.claude/settings.json must contain a JSON object');
  }
  if (settings?.hooks !== undefined && (typeof settings.hooks !== 'object' || Array.isArray(settings.hooks))) {
    throw new Error('.claude/settings.json "hooks" must be an object');
  }
  const out = removeKitHooks(settings || {});
  const add = clone(fragment.hooks || {});
  if (Object.keys(add).length) out.hooks = out.hooks || {};
  for (const [event, groups] of Object.entries(add)) {
    out.hooks[event] = [...(out.hooks[event] || []), ...groups];
  }
  const allow = fragment.permissions?.allow || [];
  if (allow.length) {
    out.permissions = out.permissions || {};
    out.permissions.allow = [...(out.permissions.allow || []), ...allow.filter((e) => !(out.permissions.allow || []).includes(e))];
  }
  return out;
}

/** Pretty JSON as Claude Code writes it (2-space indent, trailing newline). */
export function formatSettings(settings) {
  return JSON.stringify(settings, null, 2) + '\n';
}
