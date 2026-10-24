# C1: Degree days per station-quarter (SQL template text and reference implementation)

## Goal

`agent/src/tools/degreeDays.ts` exists and is unit-tested: it renders the Lightning SQL statement that computes heating and cooling degree days per station and quarter over the cached GHCN parquet views, it holds a pure TypeScript reference implementation of the same arithmetic (used to test the method against a synthetic 90-day series with known answers), and it aggregates station results into a utility's total degree days and year-on-year weather change. No model calls, no network, no database connection.

## Workspace

This repository (`agent/` is the Node 22 + TypeScript package; run commands from `agent/`). Other work may be in progress in the working tree while this task runs (`gateway/`, `zetaris/`, `seeds/`, `scripts/`). Leave every file that is not under **Deliverables** alone.

## Read first

- `.cursor/rules/style.mdc` and `.cursor/rules/safety.mdc`. The rule files were inherited from the sister project and still carry its names (CLEARSHELF, ports 8790/8791); the parts that apply here are the language, style, test and commit rules. `AGENTS.md` does not exist yet; skip it.
- `agent/tsconfig.json`, `agent/tsconfig.tools.json` and `agent/package.json` (ES modules, `.ts` import extensions, `@types/node` for `node:fs`, vitest 5, TypeScript 7).
- `agent/test/fixtures/degree-days.json` (the fixture; described under **Inputs**) and `agent/test/fixtures/make_fixtures.py` (how the expected numbers were produced; read it to understand the fixture, do not port its code).
- `agent/test/gtin.test.ts` for the test style used in this repository (plain `describe`/`it`, hand-computed values explained in comments).

`npx vitest run` with no filter also runs suites inherited from the sister project that fail here because their modules were not copied. That is known and out of scope: never edit, delete or "fix" them. Run only the filtered command under **Checks**.

## Inputs

### The method (fixed in advance; implement exactly this)

Daily GHCN values arrive in tenths of a degree Celsius (`DATA_VALUE` on the `TMAX` and `TMIN` element tables). For each station and calendar quarter:

- `Tmean_tenths = (TMAX + TMIN) / 2` for a day where both elements are present and both pass quality control (`Q_FLAG` null or empty on both rows).
- `Tmean_F = Tmean_tenths / 10 * 9 / 5 + 32` (tenths of a degree C to degrees F).
- `HDD = sum over observed days of max(0, 65 - Tmean_F)`
- `CDD = sum over observed days of max(0, Tmean_F - 65)`
- `days_observed` = the number of days that entered the sums; `days_in_quarter` is the calendar count (leap-aware: 2024 has 91, 91, 92, 92 days in Q1 to Q4; 2025 has 90, 91, 92, 92); `coverage = days_observed / days_in_quarter`.
- A day that is missing one element, or whose `Q_FLAG` is set on either element, is not observed. Days outside the quarter are ignored.

Per utility: `TDD_u = mean over its stations of (HDD + CDD)` for the quarter, `delta_w = (TDD_u,y - TDD_u,y-1) / TDD_u,y-1`. A utility's coverage for a (year, quarter) is the minimum coverage over its stations (the stricter choice); its coverage for an attribution is the minimum of the current and previous period.

### GHCN parquet shape (as cached in Lightning)

Columns `ID string` (11 characters, for example `USW00013740`), `DATE string` (`yyyymmdd`), `DATA_VALUE int64` (tenths of a degree C), `M_FLAG`, `Q_FLAG`, `S_FLAG`, `OBS_TIME`. One table per year and element; the station-filtered, cached views are named `won.ghcn_<yyyy>_tmax` and `won.ghcn_<yyyy>_tmin` by default (both the database/container and table parts are parameters, validated).

### Fixture `agent/test/fixtures/degree-days.json`

Synthetic (`"synthetic": true`), station ids made up (`USW00099001`, `USW00099002`). Keys:

- `conversions[]`: `{tenths_c, f}` pairs (0 → 32, 1000 → 212, -400 → -40, and two values either side of 65 F).
- `days_in_quarter`: `{"2024": [91, 91, 92, 92], "2025": [90, 91, 92, 92]}`.
- `daily`: object keyed `"<station>:<year>:Q<n>"`, each an array of rows `{ID, DATE, TMAX, TMIN, TMAX_Q_FLAG, TMIN_Q_FLAG}` with `TMAX`/`TMIN` in tenths of a degree C or `null` when missing, and `Q_FLAG` strings (`""` means passed; `"X"` means failed). Five series: `USW00099001` 2025 Q1 (90 days: 2 days with `TMIN` null, 1 day with `TMAX_Q_FLAG` "X" → 87 observed), `USW00099001` 2024 Q1 (91 days, 1 flagged → 90 observed), `USW00099002` 2025 Q1 (89 of 90), `USW00099002` 2024 Q1 (91 of 91), `USW00099001` 2025 Q3 (92 of 92, warm: all CDD).
- `expected[]`: for each series `{station_id, year, quarter, hdd, cdd, days_observed, days_in_quarter, coverage}`. For example `USW00099001` 2025 Q1: HDD 1785.06, CDD 0, 87/90, coverage 0.96667.
- `utility`: `{cik, stations, year, quarter, tdd_current, tdd_previous, delta_w, coverage_current, coverage_previous, coverage}` for the two stations, 2025 Q1 against 2024 Q1 (`tdd_current` 1170.075, `tdd_previous` 1356.375, `delta_w` -0.137351, `coverage` 0.96667).

Read it in the test with `JSON.parse(readFileSync(new URL("./fixtures/degree-days.json", import.meta.url), "utf8"))` (no `resolveJsonModule`, no JSON imports).

## Deliverables

| File | Contents |
|---|---|
| `agent/src/tools/degreeDays.ts` | The module below. |
| `agent/test/degree-days.test.ts` | vitest suite with at least the cases below. |

### degreeDays.ts

Exports (names fixed; the agent lane imports them):

- `DEGREE_DAY_BASE_F = 65`.
- `type Quarter = 1 | 2 | 3 | 4`.
- `tenthsCToF(tenths: number): number` — `tenths / 10 * 9 / 5 + 32`.
- `daysInQuarter(year: number, quarter: Quarter): number` — leap-aware.
- `quarterBounds(year: number, quarter: Quarter): { start: string; end: string }` — inclusive `yyyymmdd` strings, for example `{ start: "20250101", end: "20250331" }`.
- `interface DegreeDaySqlParams { year: number; quarter: Quarter; stations: string[]; tmaxTable?: string; tminTable?: string }`.
- `degreeDaySql(params: DegreeDaySqlParams): string` — returns ONE Lightning SQL statement (Spark-style SQL), no trailing semicolon, no semicolon anywhere, no comments. Validation (throw `Error` with a plain message): `year` integer 1900 to 2100; `quarter` in 1 to 4; `stations` non-empty, each matching `^[A-Z0-9]{11}$`, duplicates removed, order kept; table names matching `^[A-Za-z_][A-Za-z0-9_]*\.[A-Za-z_][A-Za-z0-9_]*$`, defaults `won.ghcn_<year>_tmax` and `won.ghcn_<year>_tmin`. Values are only ever interpolated after validation; the station list is rendered as single-quoted literals. Result columns, in this order: `station_id, year, quarter, hdd, cdd, days_observed, days_in_quarter, coverage`. Shape (keep it; the gateway template mirrors it):

  ```sql
  SELECT x.ID AS station_id, 2025 AS year, 1 AS quarter,
    SUM(CASE WHEN <tmean_f> < 65 THEN 65 - <tmean_f> ELSE 0 END) AS hdd,
    SUM(CASE WHEN <tmean_f> > 65 THEN <tmean_f> - 65 ELSE 0 END) AS cdd,
    COUNT(*) AS days_observed,
    90 AS days_in_quarter,
    COUNT(*) / 90.0 AS coverage
  FROM won.ghcn_2025_tmax x
  JOIN won.ghcn_2025_tmin n ON n.ID = x.ID AND n.DATE = x.DATE
  WHERE x.ID IN ('USW00013740', 'USW00094728')
    AND x.DATE >= '20250101' AND x.DATE <= '20250331'
    AND (x.Q_FLAG IS NULL OR x.Q_FLAG = '')
    AND (n.Q_FLAG IS NULL OR n.Q_FLAG = '')
  GROUP BY x.ID
  ```

  where `<tmean_f>` is `(((x.DATA_VALUE + n.DATA_VALUE) / 2.0) / 10.0 * 9.0 / 5.0 + 32)` (the same arithmetic as `tenthsCToF`; use `CASE WHEN`, not `GREATEST`). Whitespace and line breaks are free; the tests check content, not layout.
- `interface DailyRow { ID: string; DATE: string; TMAX: number | null; TMIN: number | null; TMAX_Q_FLAG?: string | null; TMIN_Q_FLAG?: string | null }`.
- `interface StationQuarter { station_id: string; year: number; quarter: Quarter; hdd: number; cdd: number; days_observed: number; days_in_quarter: number; coverage: number }`.
- `degreeDaysFromDaily(stationId: string, rows: DailyRow[], year: number, quarter: Quarter): StationQuarter` — the reference implementation of the method above over daily rows: keeps rows whose `ID` is `stationId` and whose `DATE` is inside the quarter; applies the missing-element and `Q_FLAG` rules; returns zeros with `days_observed: 0` when nothing qualifies.
- `stationQuarterFromRow(row: Record<string, unknown>): StationQuarter` — builds a `StationQuarter` from one result row of the SQL above as the gateway returns it (values may arrive as numbers or numeric strings; coerce with `Number`, throw on NaN or a missing column).
- `interface UtilityTdd { cik: string; year: number; quarter: Quarter; tdd: number; coverage: number; stations_used: string[]; stations_missing: string[] }`.
- `utilityTdd(cik: string, stations: string[], rows: StationQuarter[], year: number, quarter: Quarter): UtilityTdd` — mean of `hdd + cdd` over the listed stations that have a row for (year, quarter); `coverage` is the minimum over the used stations; missing stations are listed; throws when no station has a row.
- `utilityWeatherChange(current: UtilityTdd, previous: UtilityTdd): { delta_w: number; coverage: number }` — `delta_w = (current.tdd - previous.tdd) / previous.tdd` (throws if `previous.tdd` is 0), `coverage = min(current.coverage, previous.coverage)`.

### Test cases that must exist (`agent/test/degree-days.test.ts`)

- Every `conversions[]` pair: `tenthsCToF(tenths_c)` equals `f` (`toBeCloseTo(f, 10)`).
- `daysInQuarter` for all eight (year, quarter) pairs in `days_in_quarter`; `quarterBounds(2024, 1)` is `20240101`..`20240331`, `quarterBounds(2025, 4)` is `20251001`..`20251231`.
- For every series in `daily`: `degreeDaysFromDaily` equals the matching `expected[]` entry (`hdd` and `cdd` within 1e-6, `days_observed` and `days_in_quarter` exact, `coverage` within 1e-9).
- The 2025 Q1 series of `USW00099001` observes 87 of 90 days (two missing `TMIN`, one flagged `TMAX`); appending a row dated `20250401` and a row for another station does not change the result.
- `utilityTdd` and `utilityWeatherChange` over the four Q1 `expected[]` rows reproduce the `utility` block (`tdd_current`, `tdd_previous`, `delta_w`, `coverage_current`, `coverage_previous`, `coverage`, within 1e-9); a station without a row appears in `stations_missing`; no rows at all throws.
- `stationQuarterFromRow` accepts numbers and numeric strings and throws on a missing column.
- `degreeDaySql({ year: 2025, quarter: 1, stations: ["USW00013740", "USW00094728", "USW00013740"] })`: contains `won.ghcn_2025_tmax` and `won.ghcn_2025_tmin`, `'USW00013740'` once and `'USW00094728'`, `'20250101'` and `'20250331'`, `90 AS days_in_quarter`, `/ 90.0`, both `Q_FLAG` filters, `GROUP BY x.ID`, the eight output column aliases in order, and no `;`. For 2024 Q1 the day count is 91. Custom table names are used when given.
- `degreeDaySql` throws on: an empty station list; a station id that is not 11 upper-case letters or digits (for example `"USW00013740'; DROP TABLE x --"` or `"usw00013740"`); quarter 5; year `2025.5`; a table name with a quote, a space or no dot.

## Constraints

- No model calls, no network, no database access, no new dependencies, nothing added to `package.json`. Pure functions. ES modules, TypeScript run by tsx; `node:` builtins only.
- Never put a credential, a `User-Agent` string or a local path in code, tests or fixtures.
- The fixture files and `make_fixtures.py` are inputs: do not edit them or regenerate them.
- Do not edit `engines/`, `gateway/`, `zetaris/`, `.env.local`, `agent/package.json`, `agent/tsconfig.json`, `agent/tsconfig.tools.json`, the existing tests, or anything outside **Deliverables**.

## Checks

From `agent/`:

- `npx vitest run degree-days` is green.
- `npx tsc --noEmit -p tsconfig.tools.json` reports no errors.

## Out of scope

The gateway template that runs this SQL (another lane copies the statement into `gateway/templates.py`), the seed station lists, the attribution (C2), SEC parsing (C3), and the inherited failing suites.

## Commit

`C1: degree days SQL template and reference implementation (Cursor Agent)`

## Run record (2026-10-24)

Cursor Agent CLI 2026.10.22, model `Auto`, headless, workspace = this repository. The run wrote both deliverables (`degreeDays.ts` 288 lines, `degree-days.test.ts` 286 lines, 13 tests), ran the two checks green, and committed by itself with the message above plus an automatic co-author trailer. Wall time 122.4 s, exit code 0. The commit staged exactly the two deliverables. The reviewer amended the message to the plain form the repository uses (commit `1a8743c`, tree unchanged); from C2 on the prompt says not to commit.

Review against the method: the conversion, the leap-aware day counts, the SQL shape (CASE WHEN, both quality-flag filters, inner join on station and date, coverage over the calendar day count, eight output columns, no semicolon), the input validation and the utility aggregation are as specified; every fixture series and the utility block reproduce. Checks re-run by the reviewer: 13 passed, `tsc` clean.

Reviewer changes, in a separate commit (`2b2533b`): `tenthsCToF` evaluates in the same left-to-right order as the SQL expression (the two paths differed in the last binary digits only); `stationQuarterFromRow` treats a `null` result column as missing instead of reading it as 0, with a test. After the review: 14 passed, `tsc` clean.
