# Cursor task files

Weather-or-Not is developed in a Cursor workspace with project rules in `.cursor/rules` (the convention and the rule files come from the sister project ClearShelf, same author). Larger pieces of work are written up as task files in this folder and handed to Cursor Agent, which runs headless against the repository. Each task file is a self-contained brief: Cursor Agent reads it, does the work, and runs the listed checks until they pass. The task files and their commits are the record of how Cursor was used; the summary is [`docs/how-cursor-was-used.md`](../how-cursor-was-used.md).

The deterministic tools (degree days, attribution, like-for-like revenue) are the Cursor tasks C1 to C3. Their expected numbers come from known-answer fixtures in `agent/test/fixtures/` that were computed independently of the code under test (`make_fixtures.py`), so a task is green only when the implementation reproduces the method's numbers.

## File naming

- One file per task: `Cn-<short-slug>.md`, for example `C1-degree-days.md`.
- `n` is the task number from the build plan (C1 to C5). Numbers are never reused; a task that needs a second pass gets a new section in the same file, not a new number.
- This `README.md` describes the convention and is not a task.

## Sections in a task file

Every task file uses these headings, in this order:

1. **Goal.** One or two sentences: what exists when the task is done.
2. **Workspace.** The folder Cursor Agent runs in. Usually the repository root; a task that works in another folder says so here.
3. **Read first.** The files to read before starting: the relevant `.cursor/rules/*.mdc` (and `AGENTS.md` once it exists), and any sample data or guides.
4. **Inputs.** Sample responses, contracts, schemas or fixtures the task builds from, with their paths.
5. **Deliverables.** The exact paths to create or change. Anything not listed is out of bounds.
6. **Constraints.** Task-specific rules on top of the project rules (for example "read-only", "no new dependencies", "never edit `engines/`").
7. **Checks.** The commands that must pass, such as `cd agent && npx vitest run <filter>` and `npx tsc --noEmit -p tsconfig.tools.json`, or `.venv/Scripts/python -m pytest gateway/tests`. The task is done when they are green. Tests are never weakened or skipped to get there. While the repository still carries suites inherited from the sister project that do not run here, checks are scoped to the task's own files.
8. **Out of scope.** What the task must not do.
9. **Commit.** The commit message to use: `Cn: <task> (Cursor Agent)`.

A task file names environment variables (for example `ZETARIS_JDBC_JAR`) but never contains their values. Credentials stay in `.env.local`, which is gitignored.

## Running a task

From the repository root, in PowerShell:

```powershell
& "$env:LOCALAPPDATA\cursor-agent\cursor-agent.cmd" -p --trust --force --workspace . --output-format text "Read docs/cursor-tasks/<file>.md and complete it. Run the listed checks until green."
```

- Keep the prompt short; the task file carries the detail. Windows limits the length of a command line.
- Never put secrets in the prompt.
- A task whose **Workspace** is another folder is run with `--workspace <that folder>`.

## Review and commit

1. Before the run: commit or stash everything, so the diff afterwards shows only Cursor Agent's work.
2. After the run: review `git status` and `git diff`. Check that only the paths under **Deliverables** changed, that the checks pass when run again by hand, and that no secret, private path or bulk source data was added.
3. Stage the deliverables by explicit path (`git add <path> ...`, never `git add -A`) and commit with the message from the task file: `Cn: <task> (Cursor Agent)`. Plain messages only, with no trailers.
4. Transcripts of runs are kept privately, outside the repository. Each transcript starts with the exact command line of the run (no secrets), followed by the start time, wall time and exit code.

## Task index

| Task | File | Scope | Status |
|---|---|---|---|
| C1 | C1-degree-days.md | degree-day SQL template text, TypeScript reference implementation, utility aggregation, tests against a synthetic 90-day series | done 2026-10-24 (122 s, exit 0, 13 tests green); two small reviewer fixes in a separate commit (see the run record) |
| C2 | C2-attribution.md | peer set, OLS and Theil-Sen slope, seeded bootstrap ranges, three-way split, confidence labels, claim verdict, tests against hand-computed cases | done 2026-10-24 (198 s, exit 0, 13 tests green); one reviewer fix to the claim thresholds and the fixture in a separate commit (see the run record) |
| C3 | C3-recast-and-frames.md | companyconcept history parsing, period matching, recast detection and rule R1, tag probing, frames helpers, tests with a recast fixture | done 2026-10-24 (163 s, exit 0, 22 tests green); no reviewer change needed (see the run record) |
| C4 | C4-sql-static-checks.md | gateway tests and static checks on the `zetaris/sql` pairs | not written yet |
| C5 | C5-answer-card.md | answer card rendering from a saved run | not written yet (only if time allows) |
