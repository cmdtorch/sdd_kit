// Text-level edits of openspec/config.yaml. The file is user-authored (comments, examples), so it is
// never re-serialised: the kit only replaces or inserts its marked block inside `context: |`, the
// value of the top-level `schema:` line and its own marked `skillsScope: project` line. Every result is
// re-parsed to prove it is still valid YAML.
import { readFileSync } from 'node:fs';
import { parseYaml } from '../../kit/openspec/tooling/lib/yaml.mjs';

export const BEGIN = '# >>> sdd-kit >>>';
export const END = '# <<< sdd-kit <<<';

export class ConfigEditError extends Error {}

/** Kit block lines (unindented, markers included) from the fragment, with the questions language set. */
export function kitBlock(fragmentPath, questionsLanguage) {
  const { value } = parseYaml(readFileSync(fragmentPath, 'utf8'));
  const lines = value.context.replace(/\n$/, '').split('\n');
  const out = lines.map((l) => (/^- Questions language:/.test(l) ? `- Questions language: ${questionsLanguage}` : l));
  if (out[0] !== BEGIN || out[out.length - 1] !== END) throw new Error('config fragment context must be exactly the marked kit block');
  return out;
}

/** Questions language currently set in a config text, or null. */
export function currentQuestionsLanguage(text) {
  const m = text.match(/^\s*- Questions language:\s*(.+?)\s*$/m);
  return m ? m[1] : null;
}

function verify(text) {
  try {
    return parseYaml(text).value || {};
  } catch (e) {
    throw new ConfigEditError(`the edited config.yaml would not be valid YAML (${e.message}); nothing was changed`);
  }
}

/**
 * Inserts or replaces the kit block in `context`. Returns the new text.
 * Supports: markers already present (replace), `context: |` block scalar (append inside it), no
 * context at all (add one). Folded (`>`) or single-line contexts are refused with an explanation.
 */
export function upsertKitBlock(text, block) {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const begin = lines.findIndex((l) => l.trim() === BEGIN);
  if (begin !== -1) {
    const end = lines.findIndex((l, i) => i > begin && l.trim() === END);
    if (end === -1) throw new ConfigEditError(`config.yaml has "${BEGIN}" but no "${END}" marker; fix it by hand`);
    const indent = lines[begin].match(/^ */)[0];
    lines.splice(begin, end - begin + 1, ...block.map((b) => indent + b));
    const out = lines.join('\n');
    verify(out);
    return out;
  }
  const ctx = lines.findIndex((l) => /^context:/.test(l));
  if (ctx === -1) {
    while (lines.length && lines[lines.length - 1].trim() === '') lines.pop();
    const out = [...lines, '', 'context: |', ...block.map((b) => '  ' + b), ''].join('\n');
    verify(out);
    return out;
  }
  const header = lines[ctx].replace(/\s+#.*$/, '').trim();
  if (!/^context:\s*\|[-+]?\d?$/.test(header)) {
    throw new ConfigEditError(`config.yaml "context" must be a literal block scalar ("context: |") for the kit to add its lines; found "${lines[ctx].trim()}". Convert it and run again.`);
  }
  let last = ctx; // last line that belongs to the block
  let indent = null;
  for (let i = ctx + 1; i < lines.length; i++) {
    const l = lines[i];
    if (l.trim() === '') continue;
    const ind = l.match(/^ */)[0].length;
    if (ind === 0) break;
    if (indent === null) indent = ind;
    last = i;
  }
  const pad = ' '.repeat(indent ?? 2);
  lines.splice(last + 1, 0, ...block.map((b) => pad + b));
  const out = lines.join('\n');
  verify(out);
  return out;
}

/** Removes the kit block (markers included). */
export function removeKitBlock(text) {
  const lines = text.split('\n');
  const begin = lines.findIndex((l) => l.trim() === BEGIN);
  if (begin === -1) return text;
  const end = lines.findIndex((l, i) => i > begin && l.trim() === END);
  if (end === -1) throw new ConfigEditError(`config.yaml has "${BEGIN}" but no "${END}" marker; fix it by hand`);
  lines.splice(begin, end - begin + 1);
  const out = lines.join('\n');
  verify(out);
  return out;
}

// OpenSpec 2.x keeps a project's skills in the project when the config says so; without it `openspec update`
// asks once in a terminal where to keep them (design decision 1 of upgrade-openspec-2). The comment marks the
// line as the installer's: uninstall removes only a marked line, never one the team wrote.
export const SKILLS_SCOPE_LINE = 'skillsScope: project # added by sdd-kit: OpenSpec skills stay in the project';
const SKILLS_SCOPE = /^skillsScope:[^\n]*$/m;
const MARKED_SKILLS_SCOPE = /^skillsScope: project # added by sdd-kit\b[^\n]*(\n|$)/m;

/** Current top-level `skillsScope:` value, or null. */
export function currentSkillsScope(text) {
  const m = text.match(/^skillsScope:\s*['"]?([^'"#\s]+)['"]?\s*(#.*)?$/m);
  return m ? m[1] : null;
}

/**
 * Sets the top-level `skillsScope: project`: a text that already says `project` is returned as it is; another
 * value is replaced; a missing key is added after the `schema:` line (at the top when there is none).
 */
export function setSkillsScope(text) {
  if (currentSkillsScope(text) === 'project') return text;
  let out;
  if (SKILLS_SCOPE.test(text)) out = text.replace(SKILLS_SCOPE, SKILLS_SCOPE_LINE);
  else if (/^schema:.*$/m.test(text)) out = text.replace(/^schema:.*$/m, (line) => `${line}\n${SKILLS_SCOPE_LINE}`);
  else out = `${SKILLS_SCOPE_LINE}\n${text}`;
  const v = verify(out);
  if (v.skillsScope !== 'project') throw new ConfigEditError('could not set "skillsScope" in config.yaml; nothing was changed');
  return out;
}

/** Removes the `skillsScope` line the installer added; a line the team wrote is kept. */
export function removeSkillsScope(text) {
  if (!MARKED_SKILLS_SCOPE.test(text)) return text;
  const out = text.replace(MARKED_SKILLS_SCOPE, '');
  verify(out);
  return out;
}

/** Current top-level `schema:` value, or null. */
export function currentSchema(text) {
  const m = text.match(/^schema:\s*['"]?([^'"#\s]+)['"]?\s*(#.*)?$/m);
  return m ? m[1] : null;
}

/** Sets the top-level `schema:` value (adds the line at the top when missing). */
export function setSchema(text, schema) {
  const out = /^schema:.*$/m.test(text) ? text.replace(/^schema:.*$/m, `schema: ${schema}`) : `schema: ${schema}\n${text}`;
  const v = verify(out);
  if (v.schema !== schema) throw new ConfigEditError('could not set "schema" in config.yaml; nothing was changed');
  return out;
}

