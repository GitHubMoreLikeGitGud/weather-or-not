# C3: Like-for-like revenue (companyconcept history, recast detection, rule R1) and frames helpers

## Goal

`agent/src/tools/recast.ts` and `agent/src/tools/frames.ts` exist and are unit-tested. `recast.ts` reads a companyconcept-shaped history (`units.USD[]`), finds the facts for a calendar quarter (Q1 to Q3) or a fiscal year, detects when the comparative figure reported in the following year's filing differs from the figure first reported (a recast), resolves it with rule R1 (use the comparative as reported in the current filing) while keeping both values and both accession numbers, and computes like-for-like growth. `frames.ts` holds the revenue-tag probing order, the frames period and table naming, CIK padding, `loc` to state, and frames row parsing. No model calls, no network.

## Workspace

This repository (`agent/` is the Node 22 + TypeScript package; run commands from `agent/`). Other work may be in progress in the working tree while this task runs. Leave every file that is not under **Deliverables** alone.

## Read first

- `.cursor/rules/style.mdc` and `.cursor/rules/safety.mdc` (inherited from the sister project; the language, style, test and commit rules apply). `AGENTS.md` does not exist yet; skip it.
- `agent/tsconfig.json`, `agent/tsconfig.tools.json`, `agent/package.json`.
- `agent/test/fixtures/companyconcept-recast.json` (the fixture; described under **Inputs**) and `agent/test/fixtures/make_fixtures.py` (how it was built; do not port its code).
- `agent/test/gtin.test.ts` for the test style.

`npx vitest run` with no filter also runs suites inherited from the sister project that fail here because their modules were not copied. That is known and out of scope: never edit, delete or "fix" them. Run only the filtered commands under **Checks**.

## Inputs

### SEC shapes (public API, as observed)

- **companyconcept** `https://data.sec.gov/api/xbrl/companyconcept/CIK<cik10>/us-gaap/<tag>.json`: `{cik: number, taxonomy, tag, label, description, entityName, units: {USD: Fact[]}}` with `Fact = {start?: "yyyy-mm-dd", end: "yyyy-mm-dd", val: number, accn: string, fy: number, fp: "Q1"|"Q2"|"Q3"|"FY", form: string, filed: "yyyy-mm-dd", frame?: string}`. A 10-Q for Q1 of year y reports the current quarter (`fy = y, fp = "Q1"`) and the comparative for Q1 of y-1 under the same `fy`, `fp`, `accn` and `filed`, with the earlier `start`/`end`. Year-to-date facts (6 and 9 months) sit next to the quarterly ones and share `fy`, `fp` and `accn`. `frame` is present only on some facts: never use it for matching.
- **frames** `https://data.sec.gov/api/xbrl/frames/us-gaap/<tag>/USD/CY<yyyy>Q<n>.json`: `data[]` of `{accn, cik: number, entityName, loc: "US-NC" | "GB" | ..., start, end, val}`. Quarterly frames exist for Q1 to Q3 (`CY2025Q1`); the full year is `CY2024` (no `Q`). Registration at run time accepts only `^CY\d{4}Q[1-3]$`.
- **Revenue tags**, probing order: `Revenues`, then `RevenueFromContractWithCustomerExcludingAssessedTax`, then `RegulatedAndUnregulatedOperatingRevenue`. The first tag with a value for the target in the frame is the target's tag. Table-name slugs, fixed: `revenues`, `rfc`, `regrev`.

### The method (fixed in advance; implement exactly this)

- **Period** = `{year, quarter}` with `quarter` 1 to 4, or `{year, quarter: null}` for the fiscal year. Calendar fiscal years are assumed (the seed utilities are calendar-year filers); document this in a comment.
- **Period matching** of a fact (UTC dates from `yyyy-mm-dd`; `start` required):
  - quarter n: duration `(end - start)` in days is between 80 and 100 inclusive, and `end` is within 15 days either side of the calendar quarter end (Mar 31, Jun 30, Sep 30, Dec 31 of `year`);
  - fiscal year: duration between 350 and 380 inclusive, and `end` within 15 days either side of Dec 31 of `year`.
  A 6-month or 9-month fact never matches a quarter.
- **Original** fact for a period: among the matching facts, the earliest `filed`; ties broken by the smallest `accn`.
- **Comparative** fact for period P = (y-1, Q), as reported in the current filing: among the matching facts, those with `fy === y` (`P.year + 1`) and `fp === "Q<n>"` (or `"FY"`), the latest `filed`; ties broken by the largest `accn`. `null` when there is none.
- **Current** fact for period (y, Q): matching facts with `fy === y` and the matching `fp`, latest `filed`, ties by largest `accn`; when none, the latest-filed matching fact; `null` when the period has no fact at all.
- **Recast detection and rule R1** for the previous period: `recast = comparative !== null && comparative.val !== original.val`. The chosen value is `comparative.val` when a comparative exists (whether or not it differs), otherwise `original.val`. Both facts stay in the result; nothing is deleted or averaged. The conflict is named `recast_comparative` and the rule `R1`.
- **Growth** `g = (rev_current - rev_previous) / rev_previous` (throws when `rev_previous` is not a positive finite number).

### Fixture `agent/test/fixtures/companyconcept-recast.json`

Synthetic (`"synthetic": true`, CIK 9999999, entity "Synthetic Utility Holdings (fixture)", tag `Revenues`). `concept` is a companyconcept-shaped object whose `units.USD` holds 14 facts:

- FY2023 as first reported in the 2023 10-K (`accn ...-24-000001`, 3.9e9) and as the comparative in the 2024 10-K (`...-25-000001`, 3.9e9): equal, no recast.
- 2024 Q1 (`...-24-000002`, filed 2024-05-01, 1.0e9), Q2 (`...-24-000003`, 0.9e9) with its 6-month fact (1.9e9), Q3 (`...-24-000004`, 1.2e9) with its 9-month fact (3.1e9).
- FY2024 (`...-25-000001`, 4.1e9).
- Q1 2025 10-Q (`...-25-000002`, filed 2025-05-02): current quarter 1.1e9 and the Q1 2024 comparative **recast to 0.98e9**.
- Q2 2025 10-Q (`...-25-000003`): current 0.95e9, Q2 2024 comparative 0.9e9 (unchanged), and two 6-month facts.

`expected`: `cy2024q1_original {val 1e9, accn ...-24-000002, filed, fy 2024, fp Q1}`, `cy2024q1_comparative_in_cy2025q1_filing {val 0.98e9, accn ...-25-000002, fy 2025, fp Q1}`, `cy2024q1_recast true`, `cy2024q1_r1_value 980000000`, `cy2025q1_value 1100000000`, `cy2025q1_accn`, `growth_like_for_like 0.12244897959183673`, `growth_naive_original 0.10`, `cy2024q2_recast false`, `cy2024q2_value 900000000`, `cy2024q3_value 1200000000` (the 9-month fact must not match Q3), `cy2025q3_value null`, `fy2024_value 4100000000`, `fy2023_recast false`, `fy2023_value 3900000000`, `fy2024_accn`.

Read it in the test with `JSON.parse(readFileSync(new URL("./fixtures/companyconcept-recast.json", import.meta.url), "utf8"))`.

## Deliverables

| File | Contents |
|---|---|
| `agent/src/tools/frames.ts` | The module below. |
| `agent/src/tools/recast.ts` | The module below. |
| `agent/test/frames.test.ts`, `agent/test/recast.test.ts` | vitest suites with at least the cases below. |

### frames.ts

- `REVENUE_TAGS = ["Revenues", "RevenueFromContractWithCustomerExcludingAssessedTax", "RegulatedAndUnregulatedOperatingRevenue"] as const`, `type RevenueTag`, `TAG_SLUGS: Record<RevenueTag, string>` = `revenues`, `rfc`, `regrev`.
- `FRAME_PERIOD_RE = /^CY\d{4}Q[1-3]$/` (the registrar's rule).
- `type Period = { year: number; quarter: 1 | 2 | 3 | 4 | null }` (null = fiscal year). Export it from here and re-export from `recast.ts`.
- `framePeriod(period: Period): string` → `CY2025Q1` or `CY2024`; `parseFramePeriod(id: string): Period` accepts `CY\d{4}` and `CY\d{4}Q[1-4]`, throws otherwise.
- `frameTableName(tag: RevenueTag, period: Period): string` → `frames_<slug>_cy<yyyy>q<n>` (lower case), for example `frames_revenues_cy2025q1`, `frames_rfc_cy2025q1`; a fiscal-year period gives `frames_<slug>_cy<yyyy>`.
- `frameUrl(tag: RevenueTag, period: Period): string` → `https://data.sec.gov/api/xbrl/frames/us-gaap/<tag>/USD/<framePeriod>.json`; `conceptUrl(cik: number | string, tag: RevenueTag): string` → `https://data.sec.gov/api/xbrl/companyconcept/CIK<cik10>/us-gaap/<tag>.json`; `submissionsUrl(cik)` → `https://data.sec.gov/submissions/CIK<cik10>.json`.
- `cik10(cik: number | string): string` — left-pad with zeros to 10 digits; throws when the input is not 1 to 10 digits (after trimming) or is not a non-negative integer.
- `locToState(loc: string | null | undefined): string | null` — `US-NC` → `NC` (exactly `^US-[A-Z]{2}$`); anything else null.
- `interface FrameFact { accn: string; cik: number; entityName: string; loc: string | null; start: string; end: string; val: number }`, `interface FrameRow { cik10: string; entityName: string; state: string | null; start: string; end: string; val: number; accn: string }`, `parseFrameRows(rows: Record<string, unknown>[]): FrameRow[]` — accepts the fields as the gateway returns them (`cik` and `val` may arrive as numbers or numeric strings; throws on a missing `cik`, `val` or `accn`).
- `probeTag(values: Partial<Record<RevenueTag, number | null | undefined>>): { tag: RevenueTag; val: number } | null` — the first tag in `REVENUE_TAGS` order whose value is a finite number.
- `growth(revCurrent: number, revPrevious: number): number`.

### recast.ts

- `interface ConceptFact { start?: string; end: string; val: number; accn: string; fy: number; fp: string; form: string; filed: string; frame?: string }`, `interface CompanyConcept { cik: number; taxonomy: string; tag: string; entityName: string; units: { USD?: ConceptFact[] } }`.
- `matchesPeriod(fact: ConceptFact, period: Period): boolean`, `factsForPeriod(concept: CompanyConcept, period: Period): ConceptFact[]` (input order kept).
- `originalFact(facts: ConceptFact[]): ConceptFact | null`, `comparativeFact(facts: ConceptFact[], period: Period): ConceptFact | null`, `currentFact(facts: ConceptFact[], period: Period): ConceptFact | null` as defined above.
- `interface RecastCheck { period: string; conflict: "recast_comparative"; rule: "R1"; recast: boolean; original: ConceptFact | null; comparative: ConceptFact | null; chosen: number | null; note: string }` — `period` is `framePeriod(period)`; `note` says in one sentence what happened (no comparative, equal, or recast with both values).
- `checkRecast(concept: CompanyConcept, previous: Period): RecastCheck`.
- `interface LikeForLike { tag: string; current: Period; previous: Period; rev_current: number; rev_previous: number; growth: number; current_accn: string; current_filed: string; recast: RecastCheck }`.
- `likeForLikeGrowth(concept: CompanyConcept, current: Period): LikeForLike` — `previous` is the same quarter (or FY) of `current.year - 1`; `rev_previous` is `recast.chosen`; throws with a plain message when the current period has no fact or the previous period has no original.

### Test cases that must exist

`frames.test.ts`:

- `cik10(1326160)` and `cik10("0001326160")` are `"0001326160"`; `cik10("")`, `cik10("12345678901")`, `cik10("12a")` throw.
- `locToState("US-NC")` is `"NC"`; `"GB"`, `"us-nc"`, `null` give null.
- `framePeriod({year: 2025, quarter: 1})` is `CY2025Q1`, `framePeriod({year: 2024, quarter: null})` is `CY2024`; `parseFramePeriod` round-trips both and throws on `cy2025q1`, `CY2025Q5`, `2025Q1`; `FRAME_PERIOD_RE` accepts `CY2025Q1` and rejects `CY2025Q4`, `CY2024`, `CY2025Q1 `.
- `frameTableName("Revenues", {2025, 1})` is `frames_revenues_cy2025q1`; the RFC tag gives `frames_rfc_cy2025q1`; FY 2024 gives `frames_revenues_cy2024`; `frameUrl`, `conceptUrl(1326160, "Revenues")` and `submissionsUrl(1326160)` are the exact URLs above with `CIK0001326160`.
- `probeTag({Revenues: null, RevenueFromContractWithCustomerExcludingAssessedTax: 5})` picks the RFC tag; all null or absent gives null; `Revenues` wins when both are present; a non-finite value is skipped.
- `growth(1.1e9, 0.98e9)` is within 1e-15 of `0.12244897959183673`; `growth(1, 0)` and `growth(1, -5)` throw.
- `parseFrameRows` pads an integer `cik`, converts `loc`, coerces a string `val`, keeps `accn`, and throws on a row without `accn`.

`recast.test.ts` (on the fixture):

- `factsForPeriod` gives 2 facts for Q1 2024, 2 for Q2 2024 (the 6-month facts excluded), 1 for Q3 2024 (the 9-month fact excluded), 1 for FY2024, 2 for FY2023, 0 for Q3 2025.
- `originalFact` for Q1 2024 is `...-24-000002` with 1e9; `comparativeFact` for Q1 2024 is `...-25-000002` with 0.98e9; `currentFact` for Q1 2025 is `...-25-000002` with 1.1e9; `comparativeFact` for Q3 2024 is null.
- `checkRecast(concept, Q1 2024)`: `recast` true, `chosen` 980000000, `conflict` `recast_comparative`, `rule` `R1`, `original.accn` and `comparative.accn` as expected, `period` `CY2024Q1`; `checkRecast(concept, Q2 2024)`: `recast` false, `chosen` 900000000, comparative present; `checkRecast(concept, FY 2023)`: `recast` false, `chosen` 3900000000; `checkRecast(concept, Q3 2024)`: no comparative, `recast` false, `chosen` 1200000000.
- `likeForLikeGrowth(concept, Q1 2025)`: `rev_current` 1.1e9, `rev_previous` 0.98e9, `growth` within 1e-15 of the fixture, `current_accn` `...-25-000002`, `recast.recast` true; the naive growth from the original (`growth(1.1e9, 1e9)`) is 0.10, which differs; `likeForLikeGrowth(concept, Q3 2025)` throws; FY 2024 against FY 2023 gives `growth(4.1e9, 3.9e9)` with `recast.recast` false.
- A fact without `start` never matches; a fact whose `end` is 20 days after the quarter end does not match; a 95-day fact ending 10 days after Mar 31 does.

## Constraints

- No model calls, no network, no new dependencies, nothing added to `package.json`. Pure functions. ES modules, TypeScript run by tsx; `node:` builtins only.
- URLs are built only for the three `data.sec.gov` endpoints above; this module never fetches. Never put a `User-Agent` string, a credential or a local path in code, tests or fixtures.
- The fixture files and `make_fixtures.py` are inputs: do not edit or regenerate them. No real SEC data in tests.
- Do not edit `engines/`, `gateway/`, `zetaris/`, `.env.local`, `agent/package.json`, `agent/tsconfig.json`, `agent/tsconfig.tools.json`, `agent/src/tools/degreeDays.ts`, `agent/src/tools/attribution.ts`, the existing tests, or anything outside **Deliverables**.

## Checks

From `agent/`:

- `npx vitest run frames` and `npx vitest run recast` are green (or `npx vitest run frames recast`).
- `npx tsc --noEmit -p tsconfig.tools.json` reports no errors.

## Out of scope

Fetching from SEC (runs through Lightning REST tables), the H-MEM conflict record and the analyst override (agent lane), the registrar template (gateway lane), degree days (C1), attribution (C2), and the inherited failing suites.

## Commit

Do not run `git commit`; leave the changes in the working tree. The reviewer commits them, by explicit path, as:

`C3: like-for-like revenue with recast rule R1 and frames helpers (Cursor Agent)`

## Run record (2026-10-24)

Cursor Agent CLI 2026.10.22, model `Auto`, headless, workspace = this repository. The run wrote all four deliverables (`frames.ts` 134 lines, `recast.ts` 242 lines, `frames.test.ts` 161 lines, `recast.test.ts` 171 lines; 22 tests), ran the checks green and left the changes uncommitted as asked. Wall time 163.3 s, exit code 0. Committed unchanged as `222843d`.

Review against the method: the tag order and slugs, the period id and table naming, CIK padding, `loc` parsing, the period-matching windows (80 to 100 days and 350 to 380 days, end within 15 days of the period close, `start` required, `frame` ignored), the original / comparative / current selection with the stated tie-breaks, rule R1 with both facts kept, and like-for-like growth are as specified; the fixture's recast, the unchanged comparatives, the excluded 6- and 9-month facts and the growth of 0.12244897959183673 all reproduce. Checks re-run by the reviewer: 22 passed, `tsc` clean. No reviewer change was needed.
