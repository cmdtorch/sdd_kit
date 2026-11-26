// sdd-kit: managed file. Do not edit; local changes are overwritten on kit update.
// The project's test commands: `openspec/test-commands.md`, a project file the kit never writes (the agent drafts
// it and the developer confirms it; openspec/protocols/testing.md). A command is the list item
//   - <One file|Failed only|Full suite>: `<command>` [— <n> min]
// with a whole number of minutes; the one-file command holds the placeholder `<file>`. Every other line is free
// text and is ignored. `## Repository: <name>` headings open sections (a meta-repository); items before the first
// such heading belong to the unnamed section ''. The first item of a label in a section counts. The single line
// `none` (the developer declined the file) yields no commands. This parser is the only kit code that reads the file.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export const TEST_COMMANDS_FILE = 'openspec/test-commands.md';
export const LABELS = ['One file', 'Failed only', 'Full suite'];
export const FILE_PLACEHOLDER = '<file>';

const ITEM = /^\s*[-*]\s+(one file|failed only|full suite)\s*:\s*`([^`]+)`(.*)$/i;
const DURATION = /^\s*[—–-]\s*(\d+)\s*min\s*$/;
const SECTION = /^##\s+Repository:\s*(\S+)\s*$/i;

/**
 * Parses the file's content: { none, sections: { [name]: { [label]: { command, minutes } } } }, where the unnamed
 * section is '' and `minutes` is a whole number or null. A section without command items is left out.
 */
export function parseTestCommands(content) {
  const text = String(content ?? '');
  if (/^\s*none\s*$/i.test(text)) return { none: true, sections: {} };
  const sections = {};
  let section = '';
  for (const line of text.split(/\r?\n/)) {
    const s = line.match(SECTION);
    if (s) {
      section = s[1];
      continue;
    }
    const m = line.match(ITEM);
    if (!m) continue;
    const label = LABELS.find((l) => l.toLowerCase() === m[1].toLowerCase());
    const command = m[2].trim();
    if (!command) continue;
    const items = (sections[section] ??= {});
    if (items[label]) continue;
    const d = m[3].match(DURATION);
    items[label] = { command, minutes: d ? Number(d[1]) : null };
  }
  return { none: false, sections };
}

/** The parsed `openspec/test-commands.md` of the project, or null when it is missing or unreadable. */
export function readTestCommands(root) {
  const file = join(root, TEST_COMMANDS_FILE);
  if (!existsSync(file)) return null;
  try {
    return parseTestCommands(readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * The one-file command of a section (`repository` null or '' for the unnamed section) with `<file>` replaced by
 * `file`; null when the section, its one-file item or the placeholder is missing.
 */
export function oneFileCommand(parsed, repository, file) {
  const item = parsed?.sections?.[repository || '']?.['One file'];
  if (!item || !item.command.includes(FILE_PLACEHOLDER)) return null;
  return item.command.split(FILE_PLACEHOLDER).join(file);
}
