// Preloaded by `npm test` (`node --import ./tests/helpers/isolate-tmp.mjs --test ...`): points the system
// temporary folder (TMPDIR, TMP, TEMP) of the test run at a fresh folder of its own, so nothing a test or a hook
// it runs writes under `os.tmpdir()` (for example the planning session state in `<tmp>/sdd-kit-planning/`) lands
// in the real temporary folder. Test files and the hooks they spawn inherit the environment. The folder is
// removed when the run ends. A process that already runs inside an isolated run keeps that folder.
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

if (!process.env.SDD_KIT_TEST_TMP) {
  const dir = mkdtempSync(join(tmpdir(), 'sdd-kit-test-run-'));
  process.env.SDD_KIT_TEST_TMP = dir;
  process.env.TMPDIR = dir;
  process.env.TMP = dir;
  process.env.TEMP = dir;
  process.on('exit', () => {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      // best effort: a leftover folder inside the system temporary folder is harmless
    }
  });
}
