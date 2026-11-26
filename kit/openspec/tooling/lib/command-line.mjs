// sdd-kit: managed file. Do not edit; local changes are overwritten on kit update.
// Splitting a Bash command line into parts and words, shared by the PreToolUse hooks that look at a command
// (boundary-guard, test-run-guard). It is a plain text split, not a shell parser: what hides in a script or in
// `bash -c "…"` is left to the protocol rules, the second line behind the hooks.

/** Programs that run another command: dropped with their options before the command's own words. */
export const WRAPPERS = new Set(['env', 'nohup', 'time', 'exec', 'command', 'xargs', 'nice', 'stdbuf', 'timeout']);

/** Parts of a command line, split at `;`, `&&`, `||`, `|`, `&`, newlines and `$(` / backticks. */
export function commandParts(command) {
  return String(command)
    .split(/&&|\|\||[;|&\n`]|\$\(|\)/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/** Words of one part, quotes removed, leading VAR=value and wrappers (env, xargs, …) dropped. */
export function words(part) {
  const w = (part.match(/"[^"]*"|'[^']*'|\S+/g) || []).map((x) => x.replace(/^["']|["']$/g, ''));
  let i = 0;
  while (i < w.length) {
    if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(w[i])) {
      i++;
      continue;
    }
    if (!WRAPPERS.has(w[i])) break;
    i++;
    while (i < w.length && (w[i].startsWith('-') || /^\d+[smhd]?$/.test(w[i]))) i++; // wrapper options, `timeout 30`
  }
  return w.slice(i);
}
