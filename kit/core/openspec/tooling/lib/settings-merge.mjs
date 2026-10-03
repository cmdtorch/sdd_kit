// sdd-kit: managed file. Do not edit; local changes are overwritten on kit update.
// Merges the kit's hooks into a project's .claude/settings.json without touching anything else (D10):
// other hooks (e.g. graphify), plugins, permissions and unknown keys stay exactly as they are.
// Kit hooks are recognised by their command pointing into `openspec/tooling/hooks/`, so a re-run
// replaces old kit entries instead of duplicating them, and `removeKitHooks` cleanly uninstalls.

const KIT_HOOK = /openspec\/tooling\/hooks\//;

export function isKitHook(h) {
  return Boolean(h && h.type === 'command' && typeof h.command === 'string' && KIT_HOOK.test(h.command));
}

const clone = (x) => JSON.parse(JSON.stringify(x));

/** Returns a copy of `settings` without any kit hook; groups left empty by that are dropped. */
export function removeKitHooks(settings) {
  const out = clone(settings || {});
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
  return out;
}

/** Pretty JSON as Claude Code writes it (2-space indent, trailing newline). */
export function formatSettings(settings) {
  return JSON.stringify(settings, null, 2) + '\n';
}
