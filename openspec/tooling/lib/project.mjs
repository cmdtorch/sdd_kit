// sdd-kit: managed file. Do not edit; local changes are overwritten on kit update.
// Locating the project root, changes and their schema.
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { parseYaml } from './yaml.mjs';

/** Schemas with the question rounds of `clarify` (and its gates, grounding and checks). */
export const CLARIFY_FAMILY = ['clarify', 'clarify-ai-qa', 'clarify-qa'];
/** Schemas with the test-cases stage between the specs and the design. */
export const TEST_CASE_SCHEMAS = ['clarify-ai-qa', 'clarify-qa'];
export const KIT_SCHEMAS = [...CLARIFY_FAMILY, 'lean'];

export function isClarifyFamily(schema) {
  return CLARIFY_FAMILY.includes(schema);
}

export function hasTestCases(schema) {
  return TEST_CASE_SCHEMAS.includes(schema);
}

/** Nearest directory (from `start` upwards) that contains `openspec/`; null if none. */
export function findRoot(start = process.cwd()) {
  let dir = resolve(start);
  while (true) {
    if (existsSync(join(dir, 'openspec')) && statSync(join(dir, 'openspec')).isDirectory()) return dir;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

export function changeDir(root, name) {
  return join(root, 'openspec', 'changes', name);
}

/** Active (non-archived) change names. */
export function listChanges(root) {
  const dir = join(root, 'openspec', 'changes');
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((n) => n !== 'archive' && statSync(join(dir, n)).isDirectory())
    .sort();
}

/** Schema name of a change from its `.openspec.yaml`; falls back to config `schema`, then spec-driven. */
export function changeSchema(root, name) {
  const meta = join(changeDir(root, name), '.openspec.yaml');
  if (existsSync(meta)) {
    try {
      const { value } = parseYaml(readFileSync(meta, 'utf8'));
      if (value && typeof value.schema === 'string') return value.schema;
    } catch {
      /* fall through */
    }
  }
  const cfg = join(root, 'openspec', 'config.yaml');
  if (existsSync(cfg)) {
    try {
      const { value } = parseYaml(readFileSync(cfg, 'utf8'));
      if (value && typeof value.schema === 'string') return value.schema;
    } catch {
      /* fall through */
    }
  }
  return 'spec-driven';
}

/** Schema of a change directory anywhere (also archived ones); null when it has no .openspec.yaml schema. */
export function schemaOfDir(dir) {
  const meta = join(dir, '.openspec.yaml');
  if (!existsSync(meta)) return null;
  try {
    const { value } = parseYaml(readFileSync(meta, 'utf8'));
    return value && typeof value.schema === 'string' ? value.schema : null;
  } catch {
    return null;
  }
}

/** Reads a file of a change directory, or null. */
export function readIn(dir, file) {
  const p = join(dir, file);
  return existsSync(p) ? readFileSync(p, 'utf8') : null;
}

export function isKitSchema(schema) {
  return KIT_SCHEMAS.includes(schema);
}

/** Artifact ids of the kit schemas by file name inside a change dir (specs are matched separately). */
export const ARTIFACT_FILES = {
  'clarifications.md': 'clarifications',
  'proposal.md': 'proposal',
  'test-cases.md': 'test-cases',
  'design.md': 'design',
  'verification-plan.md': 'verification-plan',
  'tasks.md': 'tasks',
};

/**
 * Which change and artifact a path belongs to: { change, artifact|null, rel } or null when the path is
 * not inside an active change (archived changes are ignored).
 */
export function locateInChange(root, absPath) {
  const base = join(root, 'openspec', 'changes') + '/';
  const p = resolve(absPath);
  if (!p.startsWith(base)) return null;
  const parts = p.slice(base.length).split('/');
  if (parts.length < 2 || parts[0] === 'archive') return null;
  const [change, ...rest] = parts;
  const rel = rest.join('/');
  let artifact = null;
  if (rest[0] === 'specs' && rel.endsWith('.md')) artifact = 'specs';
  else if (rest.length === 1) artifact = ARTIFACT_FILES[rest[0]] || null;
  return { change, artifact, rel };
}

/** Reads a file of the change, or null when it does not exist. */
export function readChangeFile(root, name, file) {
  const p = join(changeDir(root, name), file);
  return existsSync(p) ? readFileSync(p, 'utf8') : null;
}

/** Key of the kit version stamp in a change's `.openspec.yaml` (OpenSpec ignores `x-` keys). */
export const STAMP_KEY = 'x-sdd-kit';

/** Kit version recorded in a change's `.openspec.yaml`, or null for a change started before the stamp. */
export function changeKitVersion(root, name) {
  const meta = join(changeDir(root, name), '.openspec.yaml');
  if (!existsSync(meta)) return null;
  try {
    const { value } = parseYaml(readFileSync(meta, 'utf8'));
    const v = value && value[STAMP_KEY];
    return v === undefined || v === null || v === '' ? null : String(v);
  } catch {
    return null;
  }
}

/**
 * True for a change started under the autonomous-apply rules (manual reasons, apply-report.md, consent at
 * archive). The stamp came with those rules, so any stamped change follows them; unstamped changes keep the
 * rules they started with.
 */
export function isStamped(root, name) {
  return changeKitVersion(root, name) !== null;
}

/**
 * Stamps the kit version into the change's `.openspec.yaml` when its first kit artifact is written: the file
 * `rel` is the only artifact of the change and the stamp is missing. A change that already has other
 * artifacts started before the stamp and keeps the old rules. Returns the version written, or null.
 */
export function stampChange(root, name, rel) {
  const dir = changeDir(root, name);
  const meta = join(dir, '.openspec.yaml');
  const kitFile = join(root, 'openspec', 'tooling', 'kit.json');
  if (!existsSync(meta) || !existsSync(kitFile) || changeKitVersion(root, name) !== null) return null;
  const others = Object.keys(ARTIFACT_FILES).filter((f) => f !== rel && existsSync(join(dir, f)));
  if (others.length || (!rel.startsWith('specs/') && existsSync(join(dir, 'specs')))) return null;
  const version = JSON.parse(readFileSync(kitFile, 'utf8')).kitVersion;
  const text = readFileSync(meta, 'utf8');
  writeFileSync(meta, `${text}${text && !text.endsWith('\n') ? '\n' : ''}${STAMP_KEY}: ${version}\n`);
  return version;
}

/** First kit version whose changes are implemented by subagents (openspec/protocols/subagents.md). */
export const SUBAGENT_VERSION = '0.5.0';

/**
 * True when `version` is at least `min`, compared by major, minor and patch. A pre-release suffix counts as its
 * base version (`0.5.0-beta.1` ≥ `0.5.0`), so a beta can pilot the new rules. A missing or malformed version is false.
 */
export function versionAtLeast(version, min) {
  const parse = (v) => {
    const m = String(v ?? '').trim().match(/^v?(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/);
    return m ? m.slice(1, 4).map(Number) : null;
  };
  const a = parse(version);
  const b = parse(min);
  if (!a || !b) return false;
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i];
  return true;
}

/**
 * True for a change whose apply and verify run through subagents: stamped 0.5.0 or later. A missing stamp or an
 * older one keeps the single-agent apply and verify the change started with.
 */
export function usesSubagents(root, name) {
  return versionAtLeast(changeKitVersion(root, name), SUBAGENT_VERSION);
}

/** First kit version whose `clarify` and `lean` changes follow the planning rules of openspec/protocols/planning.md. */
export const NEW_PLANNING_VERSION = '0.6.0';
/** Schemas that follow those rules; the test-case schemas keep the rounds and confirmations of questions.md. */
export const NEW_PLANNING_SCHEMAS = ['clarify', 'lean'];

/**
 * True for a change that follows the new planning rules (two rounds closed without a summary confirmation,
 * depth levels, recommendations, automatic continuation): stamped 0.6.0 or later (a pre-release counts as its
 * base version) and on `clarify` or `lean`. Every hook and check asks this one function; other changes keep the
 * rules they started with.
 */
export function usesNewPlanning(root, name) {
  return NEW_PLANNING_SCHEMAS.includes(changeSchema(root, name)) && versionAtLeast(changeKitVersion(root, name), NEW_PLANNING_VERSION);
}

/** Top-level key of openspec/config.yaml (outside the kit block) with the model of the implementation subagents. */
export const SUBAGENT_MODEL_KEY = 'x-sdd-kit-subagent-model';
/** Short model names; `inherit` means the main chat's model. A full model ID starting with `claude-` is also allowed. */
export const SUBAGENT_MODELS = ['opus', 'sonnet', 'haiku', 'fable', 'inherit'];

export function isKnownSubagentModel(value) {
  return typeof value === 'string' && (SUBAGENT_MODELS.includes(value) || /^claude-\S+$/.test(value));
}

/**
 * The subagent model setting: { value: the configured value or null, model: what to pass (`inherit` = no override,
 * the main chat's model), known: false for an unknown value, which falls back to `inherit` }.
 */
export function subagentModel(root) {
  const cfg = join(root, 'openspec', 'config.yaml');
  let raw;
  if (existsSync(cfg)) {
    try {
      const { value } = parseYaml(readFileSync(cfg, 'utf8'));
      raw = value && value[SUBAGENT_MODEL_KEY];
    } catch {
      /* an unreadable config is reported by lint-kit */
    }
  }
  if (raw === undefined || raw === null || raw === '') return { value: null, model: 'inherit', known: true };
  const value = String(raw);
  return isKnownSubagentModel(value) ? { value, model: value, known: true } : { value, model: 'inherit', known: false };
}

/** Warning text for an unknown subagent model value. */
export function subagentModelWarning(value) {
  return `${SUBAGENT_MODEL_KEY} "${value}" in openspec/config.yaml is not a known model — allowed: ${SUBAGENT_MODELS.join(', ')}, or a full model ID starting with claude-`;
}

/** First kit version whose changes follow the test-command and test-run rules (openspec/protocols/testing.md). */
export const TEST_RUNS_VERSION = '0.7.0';

/**
 * True for a change that follows the test-command and test-run rules (the project file `openspec/test-commands.md`,
 * each task group runs only its own test files, long runs in the background): stamped 0.7.0 or later (a
 * pre-release counts as its base version), whatever the schema. A missing stamp or an older one keeps the rules the
 * change started with.
 */
export function usesTestCommands(root, name) {
  return versionAtLeast(changeKitVersion(root, name), TEST_RUNS_VERSION);
}
