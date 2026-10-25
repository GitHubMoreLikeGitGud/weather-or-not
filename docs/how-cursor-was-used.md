# How Cursor was used

Weather-or-Not was developed in a Cursor workspace with project rules in `.cursor/rules` and `AGENTS.md`. Cursor Agent wrote the deterministic tools that do the arithmetic the model is never allowed to do: the degree-day SQL template and its reference implementation, the attribution (peer set, slope, seeded bootstrap, three-way split, confidence labels, claim verdict) and the like-for-like revenue layer (companyconcept history, recast detection, rule R1, frames helpers), each with its vitest suite. Three headless runs, all on 24 Oct 2026, all exit 0 on the first attempt. This page lists every Cursor task, its commits, what the reviewer changed afterwards, and what was not built by Cursor Agent.

Cursor Agent did not write the Zetaris SQL pairs, the gateway, the agent loop, the memory and World Model integration, the server, the UI, the evaluation or the documentation. Those were written outside Cursor Agent (see [below](#what-cursor-agent-did-not-write)).

## How the workspace is set up

- **`AGENTS.md`** (repository root): the rules that always apply. It covers the layout, Lightning SQL rules, Zetaris scope, the read-only engines, "the model never decides and never computes", one data path, source etiquette, secrets, public text and integrity.
- **`.cursor/rules/`**, five project rules:

  | Rule file | Applies to | Covers |
  |---|---|---|
  | `safety.mdc` | always | method integrity (the model never computes a number; every memo number must match a tool output), untrusted input, network, secrets, public-text rules |
  | `style.mdc` | always | languages, code style, tests, commit conventions |
  | `zetaris.mdc` | `gateway/`, `zetaris/`, `scripts/`, `agent/src/zetaris/` | Lightning SQL rules for the gateway, the onboarding scripts and the USL model |
  | `meterless.mdc` | `engines/`, `agent/src/memory/`, `world/`, `loop/`, `contract/` | Meterless engine contracts and the never-edit rule for `engines/` |
  | `data-licences.mdc` | `seeds/`, `docs/`, `zetaris/`, `README.md`, `NOTICE`, `metadata.json`, `scripts/` | licences, attribution text, what data may be committed (never extracted SEC values) |

- **Task files** in [`docs/cursor-tasks/`](cursor-tasks/README.md). Each one is a self-contained brief with the same sections: goal, workspace, files to read, inputs, deliverables, constraints, checks, out of scope, commit message. The inputs include the exact formulas of the method and a known-answer fixture in `agent/test/fixtures/` whose expected numbers were computed independently of the code under test (`make_fixtures.py`, Python), so a task is green only when the implementation reproduces the method's numbers. Cursor Agent ran headless from the repository root:

  ```powershell
  & "$env:LOCALAPPDATA\cursor-agent\cursor-agent.cmd" -p --trust --force --workspace . --output-format text "Read docs/cursor-tasks/<file>.md and complete it. Run the listed checks until green. Do not commit; leave the changes in the working tree."
  ```

- **Checks** were scoped to each task's files (`npx vitest run <filter>` and `npx tsc --noEmit -p tsconfig.tools.json`), because at the time of the runs the repository still carried suites inherited from the sister project ClearShelf (same author) whose modules had not been copied over; those were removed later in the day.
- **Review.** Each run's changes were reviewed with `git diff` against the method in the build spec (formulas, the tenths-of-a-degree-C to F conversion, bootstrap percentiles, confidence rules, claim thresholds, rule R1) and committed unchanged as `Cn: <task> (Cursor Agent)`. Corrections went into separate commits (`Cn review: <what>`), so the history shows what Cursor Agent wrote and what changed later.

CLI version 2026.10.22, model `Auto`, Cursor Pro plan. All runs took place on 24 Oct 2026 (SGT).

## Tasks run by Cursor Agent

| Task | What Cursor Agent produced | Commit | State at the end of the run | Corrected afterwards |
|---|---|---|---|---|
| **C1** degree days ([task file and run record](cursor-tasks/C1-degree-days.md)) | `agent/src/tools/degreeDays.ts`: the Lightning SQL statement for heating and cooling degree days per station and quarter (tenths of a degree C to F, both quality-flag filters, inner join of the TMAX and TMIN views, coverage over the calendar day count), input validation, a pure reference implementation over daily rows, and the utility aggregation (mean total degree days over its stations, year-on-year change, minimum coverage). `agent/test/degree-days.test.ts`: 13 tests against synthetic daily series (two made-up stations; 2024 Q1, 2025 Q1 and 2025 Q3) with known answers. | `1a8743c` "C1: degree days SQL template and reference implementation (Cursor Agent)" | 122.4 s, exit 0. 13 tests green, type check clean. Cursor Agent committed by itself as `00a89bf` with an automatic co-author trailer; the message was amended to the repository's plain form (tree unchanged), which is why the hash is `1a8743c`. From C2 on the prompt says "Do not commit". | `2b2533b`: the F conversion evaluates in the same left-to-right order as the SQL expression (the two paths differed in the last binary digits only); a `null` result column throws instead of reading as 0, with a test. 14 tests after the review. |
| **C2** attribution ([task file and run record](cursor-tasks/C2-attribution.md)) | `agent/src/tools/attribution.ts`: peer-set construction with recorded exclusions, OLS slope with a Theil-Sen cross-check, the weather / industry / company-specific split, 300-resample bootstrap ranges from a seeded PRNG (mulberry32, seed 7), confidence labels and the claim verdict. `agent/test/attribution.test.ts`: 13 tests, including a three-peer case computed by hand and a thirty-peer synthetic case. | `4d83e2e` "C2: attribution with seeded bootstrap, confidence labels and claim verdict (Cursor Agent)" | 198.1 s, exit 0. 13 tests green, type check clean. No commit by Cursor Agent, as asked. | `1ced57c`: the claim thresholds are compared exactly. Cursor Agent had added a 1e-15 allowance to pass a fixture boundary case (`0.02 / 0.10`, which is 0.19999999999999998 in floating point); that was a defect in the reviewer's fixture, so the fixture's boundary cases were changed to ratios that are exact in binary floating point and regenerated; only `attribution.json` changed. |
| **C3** like-for-like revenue and frames helpers ([task file and run record](cursor-tasks/C3-recast-and-frames.md)) | `agent/src/tools/frames.ts`: revenue-tag probing order, frame period ids and table names, CIK padding, `loc` to state, frames row parsing, growth. `agent/src/tools/recast.ts`: companyconcept period matching, original / comparative / current fact selection, recast detection with rule R1 (keep both values and both accession numbers) and like-for-like growth. Two suites, 22 tests, against a fixture with a recast comparative. | `222843d` "C3: like-for-like revenue with recast rule R1 and frames helpers (Cursor Agent)" | 163.3 s, exit 0. 22 tests green, type check clean. No commit by Cursor Agent, as asked. | Nothing. |

Commits marked `(Cursor Agent)`: `git log --grep "(Cursor Agent)"` lists `1a8743c`, `4d83e2e` and `222843d`. The task files and fixtures are commit `658d53a`; the "do not commit" change to the C2 and C3 task files is `0c14efe`.

Wall time of the three runs: 122.4 + 198.1 + 163.3 = 483.8 s of Cursor Agent time; no re-runs and no task-file clarification were needed.

**How much of it is still in the tree.** After the review commits, `git blame` attributes 1,824 of the 1,844 lines in the eight files to the three Cursor Agent commits: `degreeDays.ts` 286 of 289, `attribution.ts` 306 of 308, `degree-days.test.ts` 286 of 301, and all of `frames.ts` (134), `recast.ts` (242), `attribution.test.ts` (238), `frames.test.ts` (161) and `recast.test.ts` (171). The four suites together hold 49 tests, all green (they are part of `npm test`), and `npx tsc --noEmit -p tsconfig.tools.json` is clean.

## What Cursor Agent did not write

Everything else was written outside the three Cursor Agent runs:

- the task files, the known-answer fixtures and their generator (`agent/test/fixtures/make_fixtures.py`);
- the Zetaris objects: every Lightning SQL pair in `zetaris/sql/`, the `weather_or_not_usl` model and its DQ rule, `zetaris/README.md` and the manifest;
- the gateway (`gateway/`: templates, allowlist, registrar, contract check, JDBC channel, tests) and the scripts (`scripts/`: warm-up, DQ onboarding, join-map measurement, seed curation);
- the agent loop (`agent/src/loop/`), the planner and memo jobs (`agent/src/llm/`), the ten host tools, the H-MEM facade with Zetaris provenance and the recast conflicts (`agent/src/memory/`), the World Model wrapper (`agent/src/world/`), the execution contracts (`agent/src/contract/`), the evidence store, the run store, the runtime and the CLI;
- the server (`agent/src/server.ts`) and the analyst UI (`ui/`);
- the evaluation (`agent/src/eval/`, `scripts/eval_joinmap.py`, `docs/eval-report.md`) and the Nemotron bench (`docs/nemotron-bench.md`);
- this documentation, the README, `metadata.json`, `NOTICE`, the architecture figure, the deck and the video.

The vendored Meterless engines in `engines/` were written by neither; see [`engines/UPSTREAM.md`](../engines/UPSTREAM.md) and the README's pre-existing code section.
