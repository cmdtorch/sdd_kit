// Checks of the documentation site pages against the kit. Each takes the page text and returns a list of problems.
import { existsSync } from 'node:fs';
import { join } from 'node:path';

export const INSTALL_PAGE = 'site/src/content/docs/start/install.md';
export const COMMANDS_PAGE = 'site/src/content/docs/reference/commands.md';

// Every `github:cmdtorch/sdd_kit` install command carries the tag `#v<version>`.
export function checkReleaseTag(text, version) {
  const tags = [...text.matchAll(/github:cmdtorch\/sdd_kit(#[^\s`]+)?/g)].map((m) => m[1]);
  if (!tags.length) return [`${INSTALL_PAGE}: no install command (github:cmdtorch/sdd_kit)`];
  return tags
    .filter((tag) => tag !== `#v${version}`)
    .map((tag) => (tag ? `${INSTALL_PAGE}: install command with the tag ${tag}, expected #v${version}` : `${INSTALL_PAGE}: install command with the tag missing, expected #v${version}`));
}

// Every `@fission-ai/openspec@<version>` and the `OpenSpec CLI` table row name the pinned version.
export function checkOpenspecVersion(text, pinned) {
  const found = [
    ...[...text.matchAll(/@fission-ai\/openspec@([^\s`|]+)/g)].map((m) => ({ where: 'command @fission-ai/openspec', version: m[1] })),
    ...[...text.matchAll(/^\s*\|\s*OpenSpec CLI\s*\|\s*([^|]*)\|/gm)].map((m) => ({ where: 'OpenSpec CLI row', version: (m[1].match(/\d+\.\d+\.\d+[^\s|]*/) ?? [m[1].trim()])[0] })),
  ];
  if (!found.length) return [`${INSTALL_PAGE}: names no OpenSpec version`];
  return found.filter((f) => f.version !== pinned).map((f) => `${INSTALL_PAGE}: ${f.where} names OpenSpec ${f.version || '(empty)'}, expected ${pinned}`);
}

// The first cell of every table row names an existing command: a skill, a kit command or a tooling script.
export function checkCommands(text, root) {
  const cells = [];
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line.startsWith('|')) continue;
    const cell = line.slice(1).split('|')[0].trim();
    if (/^:?-+:?$/.test(cell)) continue; // separator row
    if (/^\|\s*:?-+:?\s*\|/.test((lines[i + 1] ?? '').trim())) continue; // header row: the next line is the separator
    cells.push(cell.replace(/`/g, '').trim());
  }
  if (!cells.length) return [`${COMMANDS_PAGE}: lists no command`];
  const problems = [];
  for (const cell of cells) {
    const word = cell.split(/\s+/)[0];
    let slash;
    let tool;
    if ((slash = word.match(/^\/([\w-]+):([\w-]+)$/))) {
      if (!existsSync(join(root, 'kit/claude/commands', slash[1], `${slash[2]}.md`))) problems.push(`${COMMANDS_PAGE}: ${word} is not a kit command (kit/claude/commands/${slash[1]}/${slash[2]}.md)`);
    } else if ((slash = word.match(/^\/([\w-]+)$/))) {
      if (!existsSync(join(root, '.agents/skills', slash[1], 'SKILL.md'))) problems.push(`${COMMANDS_PAGE}: ${word} is not an OpenSpec skill of the kit (.agents/skills/${slash[1]}/SKILL.md)`);
    } else if (word === 'node' && (tool = cell.split(/\s+/)[1]?.match(/^openspec\/tooling\/(\S+)$/))) {
      if (!existsSync(join(root, 'kit/openspec/tooling', tool[1]))) problems.push(`${COMMANDS_PAGE}: openspec/tooling/${tool[1]} does not exist (kit/openspec/tooling/${tool[1]})`);
    } else {
      problems.push(`${COMMANDS_PAGE}: unknown command ${cell || '(empty cell)'}`);
    }
  }
  return problems;
}
