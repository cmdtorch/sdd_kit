# Design

## Context

The kit reads one project: `findRoot` returns the nearest folder with `openspec/`, and `listProjectFiles` in
`openspec/tooling/lib/markers.mjs` lists the files to scan with one `git ls-files` in that root. In a
meta-repository the root ignores `repos/*`, so the clones never reach the list, and the traceability check, the
review input, the archive gate and the E2E fingerprints all see a project without tests [D1].

`listProjectFiles` is the single source of project files: the marker and case-reference search
(`collectMarkers`, `collectCaseRefs`), the review input (`openspec/tooling/lib/reviews.mjs`) and the E2E run
fingerprints (`openspec/tooling/lib/e2e-runs.mjs`) all call it, so widening it to the clones fixes every reader at
once [D1][Q26].

The work builds on the 0.4 line, which stays beta: it extends code from the unarchived changes `add-e2e-stage`,
`add-qa-test-cases-stage` and `add-ui-sources` (check-e2e, the test-case coverage table, apply-report) [Q7].

## Goals / Non-Goals

**Goals:**

- A meta-repository change can be planned, implemented and archived from the root with tests in the clones,
  every rule of 0.4 included [D1][Q7].
- Every rule is keyed on `openspec/clones` and on the change's `x-sdd-kit-metarepo` mark, so a project without
  clones and a change started before the switch run the 0.4 code paths unchanged [Q36][Q40][D1].
- Install, update and doctor run unattended from a mise task [D1][Q34].

**Non-Goals:**

- Cloning, pulling, branches, protecting `main`, the API contract between clones, and git worktrees [D1][Q38].
- Moving a clone's own OpenSpec into the root, clones tracked by the root or as submodules, and sessions started
  inside a clone [Q2].
- Reading mise configuration: the clone list is the kit's own file [Q3][Q37].

## Decisions

### 1. One protocol for the meta-repository rules

A new protocol `openspec/protocols/metarepo.md` holds every rule the agent follows in a meta-repository: the
*Repository* column of the plan and its `e2e` level, the repository tag of task groups, working in the group's
repository with its own commands from the meta-repository's instructions and mise tasks, the per-repository report
sections, the E2E question only for web-interface changes, E2E tests in a root folder, and `AGENTS.md` for missing
commands [Q44][Q9][Q33][Q39].

The kit block of `openspec/config.yaml` (`kit/config-fragment.yaml`) gets one line for every project: "When
`openspec/clones` exists, follow `openspec/protocols/metarepo.md`." The plan, tasks and report templates and the
schema instructions stay as they are, so a single-repository project reads nothing new [Q44][D1].

Alternatives: rules spread over `testing.md`, `apply.md`, `e2e.md` and the schema instructions, or new columns in
every template; both were declined in the Design round [Q44].

### 2. The clone list library

A new `openspec/tooling/lib/clones.mjs` parses `openspec/clones` (a path or `name=path` per line, `#` comments,
names from letters, digits, `-`, `_`, `.`, case-sensitive, `root` reserved, the folder name as the default name),
returns the clones with an `exists` flag and the list errors, and answers two questions [Q3][Q37][Q40]:

- `isMetarepo(root)`: `openspec/clones` exists, even with no clone line [Q40].
- `followsMetarepo(root, change)`: the change's `.openspec.yaml` holds `x-sdd-kit-metarepo: true` [Q36].

Every rule below runs only when `followsMetarepo` is true, except the doctor, the installer and the guard of a
clone's OpenSpec, which run on `isMetarepo` [Q36][Q19]. A list error is reported by every check that reads the
list, and the archive gate blocks on it [Q3].

### 3. Project files include the clones

`listProjectFiles(root)` keeps the root's `git ls-files` and, in a meta-repository, adds for each existing clone
`git -C <clone> ls-files -z --cached --others --exclude-standard`, prefixed with the clone path. Each clone's own
`openspec/` and `.claude/` are skipped, and the root's `openspec/markers-ignore` applies to the prefixed paths. A
clone folder without git is walked like a project outside git [D1][Q41].

Because every reader goes through this function, markers, case references, the review input, the archive gate and
the E2E fingerprints see the clones, with paths that start with the clone folder [D1][Q26]. A helper
`repositoryOf(file)` maps a path to its clone name, or to `root` for a path outside every clone, the root's
`openspec/` and the E2E test folder [Q12][Q42].

The E2E fingerprint stays a hash of file contents, now over the clones too: an edit anywhere invalidates a run, a
commit without an edit does not, and files a clone ignores never count [Q26].

### 4. Repository binding in the plan

`openspec/tooling/lib/plan.mjs` reads an optional *Repository* column in *Scenario coverage* and *Test case
coverage* (comma-separated names) and the level `e2e`. On a change that follows the meta-repository rules,
`check-traceability` [Q4][Q5][Q16][Q31][Q32]:

- reports a missing column, an empty cell and an unknown name, and the level `e2e` outside a meta-repository [Q5][Q31][Q32];
- with `--markers`, requires for a `unit` or `integration` row a marked test whose `repositoryOf` is each named
  repository, reporting the scenario and the repository without a test [Q4][Q41];
- reports a named clone that is missing as missing, instead of the test [Q22][D1];
- leaves an `e2e` row to `check-e2e`; a marker in an E2E test does not close a `unit` or `integration`
  row [Q32][Q42].

### 5. Repository of task groups

A parser in `openspec/tooling/lib/markdown.mjs` reads `## <n>. [<name>] <title>` headings. A new check
`openspec/tooling/checks/check-tasks.mjs` reports, on a meta-repository change, every group except the last of two
or more without exactly one known repository, and a missing clone named by a group [Q11][Q20][Q22].

answers-gate runs it on the content about to be written: `content` for Write, the current file with the
replacements applied for Edit and MultiEdit; a shell write to `tasks.md` is checked on the file after the fact by
artifact-feedback and by the archive gate [Q11].

### 6. Report sections per repository

`openspec/tooling/lib/apply-report.mjs` reads `## Repository: <name>` sections with their `Command:` and
`Result:` lines. On a meta-repository change `check-apply-report` requires one section per repository named by a
task group, each with at least one of both lines, and reports a repeated section; a section for another repository
is allowed and the result is not judged. The archive gate already blocks on its errors [Q10][Q23][Q24].

### 7. E2E in a meta-repository

`check-e2e` on a meta-repository change requires the test folder of `e2e.md` to be a root folder outside every
clone, counts the `e2e` plan rows like the scenarios listed in `e2e.md`, and keeps its own rule that only tests in
that folder are E2E tests [Q14][Q17][Q32]. With `Mode: skipped`, an `e2e` row counts only as an agreed entry of
"Not verified automatically", like an `e2e` case today [Q32]. The start check is unchanged: one command from the
root and one address [Q15].

### 8. Guard and mark in the existing hooks

answers-gate gets one more rule: on a meta-repository, a write by a file tool, or by the shell writes it already
detects, to a path inside a declared clone's `openspec/` is blocked with a message naming the clone. No new hook
is registered in `.claude/settings.json` [Q19][Q27].

artifact-feedback, where it stamps `x-sdd-kit` with the first kit artifact, also writes `x-sdd-kit-metarepo:
true` when `isMetarepo` holds [Q36].

### 9. Installer and doctor

`installer/sdd-kit.mjs` [Q28][Q34][Q43]:

- In a terminal without `--yes`, `install` asks the repository kind next to the language, then clone paths until an
  empty answer, asking again after an invalid path; `update` asks neither [Q28][Q43].
- `--metarepo [<entries>]` chooses a meta-repository, merges the entries into `openspec/clones` (a known entry is
  skipped, a known path under another name is an error) and validates everything before writing [Q34][Q37].
- `openspec/clones` is a project file, outside the kit manifest: update and uninstall never change it, and nothing
  is written inside a clone [D1][Q36].

`openspec/tooling/bin/doctor.mjs` reports list errors, warns about missing clones, and looks up to three levels
below the root for undeclared folders with their own `.git`; in a terminal without `--yes` it asks to add each,
otherwise it prints the line. None of it changes "Ready." except list errors [Q35][D1].

### 10. Tests and documentation

The tests build a meta-repository in a temporary folder: `git init` of the root with `repos/*` in `.gitignore`
and of two clones, because nested git repositories cannot live in `fixtures/`. The acceptance scenarios of the
requirements become kit tests, then a pilot runs on the Landau ERP meta-repository [Q13][D1].

`docs/how-it-works.md` describes the new protocol, library, check and installer flag; `docs/decisions.md` gets the
decisions; `CHANGELOG.md` gets an entry under `## Unreleased` [Q7].

## Risks / Trade-offs

- **Hook time.** One `git ls-files` per clone and a content hash of every clone file for E2E runs; with the
  boilerplate's 17 clones this is 17 short git calls. A kit test holds the search under half of the archive
  gate's timeout on a frontend with large dependencies [D1].
- **Shell writes through `cd`.** The guard of a clone's OpenSpec misses a path reached after `cd` in the same
  command; the specs accept this gap [Q19].
- **Content of an Edit.** answers-gate computes the file after an Edit to judge task groups; if the replacement
  cannot be applied, the gate lets the write through and artifact-feedback reports the result [Q11].
- **Beta base.** The change edits code of unarchived 0.4 changes; fixes to their pilot problems may conflict with
  it [Q7].

## Assumptions & Open Questions

None.
