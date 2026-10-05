// Interactive install wizard: detects the project layout, asks a few questions with detected defaults and
// returns the same options the command-line flags produce. Zero dependencies (D3).
//
//   const ask = createAsker(process.stdin, process.stdout);
//   const answers = await runWizard({ root, ask, detected: detectProject(root), currentLanguage });
//   ask.close();
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, dirname, basename } from 'node:path';

export const LAYOUTS = [
  { id: 'single', label: 'Single repository (backend only, no separate frontend repository)' },
  { id: 'monorepo', label: 'Monorepo (backend/, frontend/, e2e/ in this repository)' },
  { id: 'split-backend', label: 'Backend repository; the frontend lives in another repository' },
  { id: 'split-frontend', label: 'Frontend repository; the backend lives in another repository' },
];

const isDir = (p) => existsSync(p) && statSync(p).isDirectory();
const readText = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : '');
const mentionsDjango = (dir) =>
  existsSync(join(dir, 'manage.py')) || ['pyproject.toml', 'requirements.txt'].some((f) => /\bdjango\b/i.test(readText(join(dir, f))));
const hasPlaywright = (dir) => isDir(dir) && readdirSync(dir).some((f) => /^playwright\.config\.(m?[jt]s|cjs)$/.test(f));

/** Guesses the layout and presets from the files in the project root. Only used for defaults. */
export function detectProject(root) {
  const monorepo = isDir(join(root, 'backend')) && isDir(join(root, 'frontend'));
  const backendDir = monorepo ? join(root, 'backend') : root;
  const django = mentionsDjango(backendDir);
  const e2e = isDir(join(root, 'e2e')) || hasPlaywright(root) || hasPlaywright(join(root, 'e2e'));
  const frontendOnly = !monorepo && !django && existsSync(join(root, 'package.json')) && !existsSync(join(root, 'pyproject.toml'));
  const sibling = join(dirname(resolve(root)), 'backend');
  const backendPath = frontendOnly && basename(resolve(root)) !== 'backend' && isDir(sibling) ? '../backend' : null;
  const layout = monorepo ? 'monorepo' : frontendOnly ? 'split-frontend' : 'single';
  return { layout, django, e2e, backendPath };
}

/**
 * Line-based asker over any readable/writable pair. Lines that arrive before a question is asked are queued,
 * so piped input works. End of input answers every remaining question with its default.
 */
export function createAsker(input, output) {
  const queue = [];
  const waiting = [];
  let buffer = '';
  let ended = false;
  const push = (line) => (waiting.length ? waiting.shift()(line) : queue.push(line));
  const onData = (chunk) => {
    buffer += chunk;
    let i;
    while ((i = buffer.indexOf('\n')) !== -1) {
      push(buffer.slice(0, i).replace(/\r$/, ''));
      buffer = buffer.slice(i + 1);
    }
  };
  const onEnd = () => {
    if (buffer) push(buffer);
    buffer = '';
    ended = true;
    while (waiting.length) waiting.shift()(null);
  };
  input.setEncoding?.('utf8');
  input.on('data', onData);
  input.on('end', onEnd);
  const line = (prompt) => {
    output.write(prompt);
    if (queue.length) return Promise.resolve(queue.shift());
    if (ended) return Promise.resolve(null);
    return new Promise((r) => waiting.push(r));
  };
  const answer = async (prompt, def) => {
    const a = await line(prompt);
    if (a === null) output.write('\n');
    return a === null ? def : a.trim() || def;
  };
  return {
    say: (text) => output.write(text + '\n'),
    async text(question, def = '') {
      return answer(`${question}${def ? ` [${def}]` : ''}: `, def);
    },
    async confirm(question, def = true) {
      for (;;) {
        const a = String(await answer(`${question} [${def ? 'Y/n' : 'y/N'}]: `, def ? 'y' : 'n')).toLowerCase();
        if (['y', 'yes'].includes(a)) return true;
        if (['n', 'no'].includes(a)) return false;
        output.write('  please answer y or n\n');
      }
    },
    async choose(question, choices, defId) {
      output.write(`${question}\n`);
      choices.forEach((c, i) => output.write(`  ${i + 1}) ${c.label}${c.id === defId ? '  (detected)' : ''}\n`));
      const def = String(choices.findIndex((c) => c.id === defId) + 1 || 1);
      for (;;) {
        const a = String(await answer(`Choose 1-${choices.length} [${def}]: `, def));
        const byNum = choices[Number(a) - 1];
        const byId = choices.find((c) => c.id === a);
        if (byNum || byId) return (byNum || byId).id;
        output.write(`  please enter a number from 1 to ${choices.length}\n`);
      }
    },
    close() {
      input.off('data', onData);
      input.off('end', onEnd);
      input.pause?.();
    },
  };
}

/** Asks the install questions. Returns install options (presets, adapter, role, backendPath, questionsLanguage, ci). */
export async function runWizard({ ask, detected, currentLanguage = null }) {
  ask.say('sdd-kit install wizard — press Enter to accept the value in [brackets].\n');
  const layout = await ask.choose('How is this project organised?', LAYOUTS, detected.layout);
  const opts = { presets: [], adapter: null, role: null, backendPath: null };
  if (layout === 'monorepo') opts.adapter = 'monorepo';
  if (layout.startsWith('split-')) {
    opts.adapter = 'split';
    opts.role = layout === 'split-backend' ? 'backend' : 'frontend';
  }
  if (layout !== 'split-frontend') {
    if (await ask.confirm('Is the backend Django (pytest + drf-spectacular)?', detected.django)) opts.presets.push('django');
    else ask.say('  → no stack preset: write openspec/tooling/verify.yaml by hand after the install (docs/guide/install.md).');
  }
  if (layout === 'monorepo' && (await ask.confirm('Browser E2E tests with Playwright (e2e/)?', detected.e2e))) opts.presets.push('playwright');
  if (layout === 'split-frontend') {
    const p = await ask.text('Path to the backend checkout on this machine (empty: register it later)', detected.backendPath || '');
    opts.backendPath = p || null;
  }
  opts.questionsLanguage = await ask.text('Language of the clarifying questions (PO/PM receive them as written)', currentLanguage || 'English');
  opts.ci = await ask.confirm('Add the GitHub Actions workflow (.github/workflows/sdd-kit.yml)?', true);
  return opts;
}

/** The command line that does the same as the wizard answers, for docs and other repositories. */
export function equivalentCommand(o) {
  const q = (s) => (/^[\w./-]+$/.test(s) ? s : `'${s.replace(/'/g, `'\\''`)}'`);
  const parts = ['sdd-kit install'];
  if (o.adapter) parts.push(`--adapter ${o.adapter}`);
  if (o.role) parts.push(`--role ${o.role}`);
  if (o.backendPath) parts.push(`--backend-path ${q(o.backendPath)}`);
  if (o.presets?.length) parts.push(`--preset ${o.presets.join(',')}`);
  if (o.questionsLanguage) parts.push(`--questions-language ${q(o.questionsLanguage)}`);
  if (o.ci) parts.push('--ci');
  return parts.join(' ');
}
