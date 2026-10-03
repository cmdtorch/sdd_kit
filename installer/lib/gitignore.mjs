// .gitignore patching (D6): `openspec/` is versioned; `.claude/` selectively — settings.json, agents,
// commands and the OpenSpec skills are versioned; settings.local.json, plugin data (tdd-guard) and
// worktrees stay ignored.
//
// Git cannot re-include a file whose parent directory is excluded, so a whole-directory ignore such as
// `.claude/` (the pilot has it) is commented out and replaced by `.claude/*` plus negations. The kit's
// lines live between markers; uninstall removes them and restores the commented-out lines.

export const BEGIN = '# >>> sdd-kit >>>';
export const END = '# <<< sdd-kit <<<';
export const DISABLED = '# sdd-kit disabled: ';

const WHOLE_OPENSPEC = /^\/?openspec(\/(\*\*?)?)?$/;
const WHOLE_CLAUDE = /^\/?\.claude(\/(\*\*?)?)?$/;

const ALWAYS = ['.claude/settings.local.json', '.claude/tdd-guard/', '.claude/worktrees/'];
const SELECTIVE = ['.claude/*', '!.claude/settings.json', '!.claude/agents/', '!.claude/commands/', '!.claude/skills/', '.claude/skills/*', '!.claude/skills/openspec-*/'];

function withoutBlock(lines) {
  const out = [];
  let inBlock = false;
  for (const l of lines) {
    if (l.trim() === BEGIN) inBlock = true;
    else if (l.trim() === END) inBlock = false;
    else if (!inBlock) out.push(l);
  }
  return out;
}

/** Returns the patched .gitignore text (input may be null when the file does not exist). */
export function patchGitignore(text) {
  const lines = withoutBlock((text ?? '').split('\n'));
  let claudeWasIgnored = false;
  const out = lines.map((l) => {
    const t = l.trim();
    if (t.startsWith(DISABLED)) {
      if (WHOLE_CLAUDE.test(t.slice(DISABLED.length).trim())) claudeWasIgnored = true;
      return l;
    }
    if (WHOLE_OPENSPEC.test(t)) return DISABLED + t;
    if (WHOLE_CLAUDE.test(t)) {
      claudeWasIgnored = true;
      return DISABLED + t;
    }
    return l;
  });
  while (out.length && out[out.length - 1].trim() === '') out.pop();
  const block = [BEGIN, '# openspec/ and the shared parts of .claude/ are versioned (sdd-kit D6)', ...(claudeWasIgnored ? SELECTIVE : []), ...ALWAYS, END];
  return [...out, ...(out.length ? [''] : []), ...block, ''].join('\n');
}

/** Removes the kit block and restores lines the kit disabled. */
export function unpatchGitignore(text) {
  const lines = withoutBlock(text.split('\n')).map((l) => (l.trim().startsWith(DISABLED) ? l.trim().slice(DISABLED.length) : l));
  while (lines.length && lines[lines.length - 1].trim() === '') lines.pop();
  return lines.length ? lines.join('\n') + '\n' : '';
}
