# Zetaris objects for Weather-or-Not

Lightning SQL for every Zetaris object the agent reads, as `NN_*_create.sql` / `NN_*_select.sql` pairs in `sql/`, in the getting-started style (header: source, licence, format, docs, rate limit, status, caveats). One statement per JDBC call, no trailing semicolon, qualified names. Every statement is checked against the gateway allowlist (`gateway/allowlist.py`) and logged to `data/evidence/sql_log.jsonl`; REST statements carry the User-Agent placeholder `YOUR_APP_NAME YOUR_CONTACT_EMAIL`, which the runner and the gateway replace from `WON_USER_AGENT` in `.env.local` at run time (never a literal in this repository).

```bash
.venv/Scripts/python -m gateway.run_sql zetaris/sql/01_won_sec_create.sql --dry-run
.venv/Scripts/python -m gateway.run_sql zetaris/sql/01_won_sec_create.sql --skip-exists
.venv/Scripts/python -m gateway.run_sql zetaris/sql/01_won_sec_select.sql
```

The runner waits at least 0.1 s between statements that may call SEC EDGAR (10 requests per second), bounds `RUN DQ` / `SHOW DQ` at 120 s and everything else at 600 s, and treats "already exists" as done with `--skip-exists` (neither `CREATE LIGHTNING DATABASE` nor `CREATE SCHEMASTORE CONTAINER` accepts `IF NOT EXISTS` on 2.4.3.1: parse error `mismatched input 'not'`).

| Script | Objects |
|---|---|
| `01_won_sec` | Lightning database `WON_SEC`; SchemaStore container `won`; frames `WON_SEC.frames_<tag>_<period>` and views `won.frames_<tag>_<period>` for the three revenue tags x CY2025Q1, CY2024Q1; companyconcept `WON_SEC.concept_<cik10>_<tag>` and views `won.concept_<cik10>_<tag>` for the four Day-0 utilities; submissions `WON_SEC.submissions_<cik10>` and views `won.submission_<cik10>`; every view cached |
| `02_won_dns` | Lightning database `WON_DNS`; `WON_DNS.sic_codes_v4_raw` (company_dns V4, cached); view `won.sic_codes` (code, description, division, division_desc, major_group, major_group_desc; cached) |
| `03_won_frames_runtime_template` | The four statements the gateway registrar issues for a new frames period (documentation of `gateway/templates.py` `register_frames`; not run by the runner) |
| `04_won_ghcn` | Lightning database `WON_GHCN`; filestore tables `WON_GHCN.ghcn_2024_tmax`, `ghcn_2024_tmin`, `ghcn_2025_tmax`, `ghcn_2025_tmin` (NOAA GHCN-Daily parquet, public S3); station-filtered views `won.ghcn_<year>_<element>` (cached); `_select` holds the count gates and the degree-day validation queries |
| `05_won_usl` | Namespace `lightning.metastore.weatherornot`; USL `weather_or_not_usl` with `sic_code`, `utility`, `station`, `weather_quarter`, `revenue_quarter`, descriptions on the model and every table and column; activations of `station` and `weather_quarter` from the GHCN views; DQ rule `coverage_ok`; `_select` runs LIST DQ, RUN DQ, SHOW DQ and the USL joins |

## SEC EDGAR and SIC (gates G3, G4, G5, G7; Fri 24 Oct 2026, 17:1x SGT, Zetaris 2.4.3.1 local Docker)

### Objects

- `WON_SEC` (REST, host `data.sec.gov`), 16 raw tables: 6 frames, 6 companyconcept, 4 submissions; plus `frames_Revenues_CY2025Q2` registered at run time (G7).
- `WON_DNS` (REST, host `company-dns.mediumroast.io`), `sic_codes_v4_raw`.
- Container `won` (shared with the GHCN views), 17 SEC/SIC views (18 with the G7 period), all cached. The Spark UI storage tab (`127.0.0.1:4040`, the cache truth source) lists every one as an `In-memory table`; the 18 views plus the raw SIC table hold about 1.2 MB together (frames views 143-193 KB each, concept views 4-11 KB, submission views about 1.2 KB, `won.sic_codes` 54 KB, `WON_DNS.sic_codes_v4_raw` 255 KB).

Inferred shapes (`DESCRIBE`): frames raw `data array<struct<accn, cik:bigint, end, entityName, loc, start, val>>` (`val` was inferred `double` for CY2025Q1 and `bigint` for CY2025Q2: cast it downstream); companyconcept raw `units struct<USD:array<struct<accn, end, filed, form, fp, frame, fy:bigint, start, val:bigint>>>` (`frame` is missing from some filers' facts, so the views never select it); the `won.submission_*` views are five strings (`cik` is the zero-padded 10-digit string).

### Verified counts (Zetaris vs the source response fetched independently with the same User-Agent, same day)

| Object | Zetaris | Source | |
|---|---|---|---|
| `won.frames_Revenues_CY2025Q1` | 1,937 | 1,937 (`data` length) | match |
| `won.frames_Revenues_CY2024Q1` | 2,095 | 2,095 | match |
| `won.frames_RevenueFromContractWithCustomerExcludingAssessedTax_CY2025Q1` | 2,546 | 2,546 | match |
| `won.frames_RevenueFromContractWithCustomerExcludingAssessedTax_CY2024Q1` | 2,654 | 2,654 | match |
| `won.frames_RegulatedAndUnregulatedOperatingRevenue_CY2025Q1` | 20 | 20 | match |
| `won.frames_RegulatedAndUnregulatedOperatingRevenue_CY2024Q1` | 22 | 22 | match |
| `won.frames_Revenues_CY2025Q2` (G7, registered through the gateway) | 1,941 | 1,941 | match |
| `won.concept_0001326160_Revenues` / `_RegulatedAndUnregulatedOperatingRevenue` (Duke Energy) | 70 / 170 | 70 / 170 (`units.USD` length) | match |
| `won.concept_0000092122_Revenues` (Southern Co) | 293 | 293 | match |
| `won.concept_0000072903_Revenues` / `_RegulatedAndUnregulatedOperatingRevenue` (Xcel Energy) | 210 / 115 | 210 / 115 | match |
| `won.concept_0000065984_Revenues` (Entergy) | 98 | 98 | match |
| `won.submission_<cik10>` x 4 | 1 row each; sic 4931, 4911, 4931, 4911; states NC, GA, MN, LA | same | match |
| `won.sic_codes` | 1,005 (1,005 distinct 4-digit codes) | 1,005 (`total`) | match |

A frames period is one fact per filer: 1,937 facts = 1,937 distinct `cik` in Revenues CY2025Q1. The frames API aligns fiscal quarters to the calendar quarter, so `start` ranges from 2024-11-23 and `end` to 2025-05-11 in that period; the method's 3-month check uses the `start`/`end` columns, not the frame name. 1,742 of the 1,937 facts carry a US state in `loc` (`US-XX`); 195 carry a country code.

Which tag a utility reports its quarterly revenue under differs: Duke Energy and Xcel Energy have no quarterly `Revenues` facts and report `RegulatedAndUnregulatedOperatingRevenue` (CY2025Q1 8,249,000,000 and 3,906,000,000); Southern Co and Entergy report `Revenues` (7,775,000,000 and 2,846,874,000). The companyconcept endpoint answers 404 for a tag a filer never used (Southern Co: only `Revenues`; Entergy: no `RegulatedAndUnregulatedOperatingRevenue`), so concept tables exist per (filer, tag) and are registered on demand (`register_concept`). Like-for-like (method step 2): Southern Co's CY2024Q1 value is 6,646,000,000 both as first filed (accn 0000092122-24-000042, filed 2024-05-02) and as the comparative in the CY2025Q1 filing (0000092122-25-000042); Duke's is 7,671,000,000 in both filings; Entergy's CY2024Q1 `Revenues` fact exists only in the 2025 filing (the 2024 filing used `RevenueFromContractWithCustomerExcludingAssessedTax`), a tag switch the recast check has to treat as "comparative only".

### Join map (measured in Lightning SQL, four utilities)

| Check | Result |
|---|---|
| frames `LPAD(CAST(cik AS STRING), 10, '0')` = submissions `cik`, CY2025Q1 | Revenues 2 of 4 (Southern, Entergy); RevenueFromContract... 0 of 4; RegulatedAndUnregulated... 2 of 4 (Duke, Xcel): 4 of 4 across the probe order |
| the same join without LPAD (`CAST(cik AS STRING) = cik`) | 0 (the formats differ: integer vs zero-padded string) |
| frames `loc` = `'US-' + submissions business state` | 4 of 4 agree (US-LA, US-MN, US-GA, US-NC) |
| submissions `sic` = `won.sic_codes.code` | 4 of 4 join; descriptions agree up to case and "&" vs "and" (4931 "Electric & Other Services Combined" vs "Electric and Other Services Combined"); all division E, major group 49 |

### Timings (JDBC statement time, one connection)

- `CREATE LIGHTNING REST TABLE`: frames 338-1,421 ms (median about 450 ms), companyconcept 328-467 ms, submissions 313-388 ms, company_dns V4 1,484 ms. `CREATE SCHEMASTORE VIEW` 55-80 ms (no source call).
- `CACHE TABLE` on a view: frames 237-1,304 ms, concept 221-340 ms, submission 327-348 ms, `won.sic_codes` 200 ms; `CACHE TABLE WON_DNS.sic_codes_v4_raw` 566 ms. The whole of `01_won_sec_create.sql` (50 statements, 17 SEC requests for CREATE and 17 for CACHE) ran in under a minute.
- Cached reads: `COUNT(*)` 150-250 ms; a filer lookup 160-230 ms; the LPAD join of a frames view with the four submission views 450-890 ms; the four-way loc agreement query 891 ms. `DESCRIBE` on a raw table 26-37 ms, on a view 97-120 ms.
- Through the gateway (`POST /sql/template`, 127.0.0.1:8793): 200-370 ms wall for `frames_count`, `frames_fact`, `concept_history` (293 rows), `submission`, `sic`, all with `cache_state: hit`.

### Run-time registration (G7)

`POST /registrar/register_frames {"tag": "Revenues", "period": "CY2025Q2", "contract": ...}` with a signed medium-risk execution contract (`scripts/registrar_call.py` signs one from `WON_CONTRACT_SECRET`) returned 200 in 1.2 s wall: `registrar_frames_table` 469 ms, `registrar_frames_view` 58 ms, `registrar_frames_describe` 112 ms (7 columns returned to the caller), `registrar_frames_cache` 379 ms. The new objects are `WON_SEC.frames_Revenues_CY2025Q2` and `won.frames_Revenues_CY2025Q2` (Data Explorer: WON_SEC, and the `won` container); `frames_count` for the period then answered 1,941 from cache (152 ms statement), equal to the source. The reply and the SQL log keep the User-Agent placeholder; the declared value went to Zetaris only. Refusals checked: period `CY2025Q4` 400 `bad_params` before any contract check; valid parameters without a contract 403 `missing`; a registrar template through `/sql/template` 403; `sic` with a quote in the code 400; a reader template over an unregistered filer 502 `TABLE_OR_VIEW_NOT_FOUND` with `cache_state: miss` (the agent then calls `register_concept`).

### Gateway templates (`gateway/templates.py`)

Reader (`POST /sql/template`): `frames_period(tag, period)` -> cik, entityName, loc, start, end, val, accn (the HTTP reply holds the first 200 rows, `row_count` the total); `frames_count(tag, period)`; `frames_fact(tag, period, cik10)`; `concept_history(cik10, tag)` -> fy, fp, form, filed, accn, start, end, val; `submission(cik10)` -> cik, name, sic, sicDescription, state; `sic(code)`. Registrar plans (`POST /registrar/<action>`, each: raw table -> view -> DESCRIBE -> CACHE, the two CREATEs skipping "already exists", CACHE bounded at 600 s): `register_frames(tag, period)`, `register_concept(cik10, tag)`, `register_submission(cik10)`. Parameters: `tag` is a 3-value enum, `period` matches `^CY\d{4}Q[1-3]$`, `cik10` `^\d{10}$`, `sic` `^\d{4}$`. The warm-up (`CACHE_TARGETS` in `gateway/app.py`) re-caches the 17 SEC/SIC views after a driver restart.

## NOAA GHCN-Daily parquet (gate G2; Fri 24 Oct 2026, 17:0x to 17:2x SGT, Zetaris 2.4.3.1 local Docker)

### Objects

- `WON_GHCN` (FILESTORE, PARQUET, public bucket `s3a://noaa-ghcn-pds/parquet/by_year/YEAR=<yyyy>/ELEMENT=<TMAX|TMIN>/`, endpoint `s3.us-east-1.amazonaws.com`, no credentials): `ghcn_2025_tmax`, `ghcn_2025_tmin`, `ghcn_2024_tmax`, `ghcn_2024_tmin`. Each partition is 9 parquet files, about 14.9 MB and 4.31 to 4.37 million rows (every station worldwide); a station's days are spread over the 9 files. Inferred schema (`DESCRIBE`, 7 columns): `ID string, DATE string (yyyymmdd), DATA_VALUE bigint (tenths of a degree C), M_FLAG, Q_FLAG, S_FLAG, OBS_TIME string`. The raw tables are never cached.
- Views `won.ghcn_2025_tmax`, `won.ghcn_2025_tmin`, `won.ghcn_2024_tmax`, `won.ghcn_2024_tmin` (same 7 columns, `WHERE ID IN (...)` over the 56 seed stations of `seeds/stations.json` plus `USW00013740`, Richmond VA, the validation station of the degree-day check; no seed utility uses it). All four cached; the Spark UI storage tab lists each as an `In-memory table` of 264 to 269 KB (2 partitions).

### Verified counts (Zetaris vs pyarrow over the same files, anonymous S3, same day)

| Check | Zetaris | pyarrow | |
|---|---|---|---|
| `WON_GHCN.ghcn_2025_tmax` rows with `ID = 'USW00013740'` (raw table, S3 scan) | 365 | 365 (9 files) | match |
| `won.ghcn_2025_tmax` rows / distinct stations / dates | 20,801 / 57 / 20250101 to 20251231 | 20,436 seed rows + 365 | match |
| `won.ghcn_2025_tmin` | 20,799 / 57 | 20,434 + 365 | match |
| `won.ghcn_2024_tmax` | 20,859 / 57 / 20240101 to 20241231 | 20,493 + 366 | match |
| `won.ghcn_2024_tmin` | 20,858 / 57 | 20,492 + 366 | match |

2025 is a complete year in the parquet (through 2025-12-31). Every seed station is present in all four partitions.

### Degree days in Lightning SQL (the `weather_quarter` template, `04_won_ghcn_select.sql` query 5)

Per station and quarter: `TMAX` joined to `TMIN` on `ID` and `DATE`, days with a non-empty `Q_FLAG` on either element dropped, `Tmean F = ((TMAX + TMIN) / 2) / 10 * 9 / 5 + 32`, `HDD = SUM(GREATEST(0, 65 - Tmean F))`, `CDD = SUM(GREATEST(0, Tmean F - 65))`, the quarter from `substr(DATE, 5, 2)`, `coverage = days_observed / days in the quarter` (Q1 90 or 91 in a leap year, Q2 91, Q3 92). The same arithmetic, in the same evaluation order, as `agent/src/tools/degreeDays.ts`.

| Station, quarter | Zetaris HDD / CDD / days / coverage | pyarrow | |
|---|---|---|---|
| USW00013740 (Richmond VA), 2025 Q1 | 2022.69 / 22.08 / 90 / 1.0 | 2022.69 / 22.08 / 90 / 1.0 | match to 0.01 |
| USW00013722 (Raleigh NC), 2025 Q1 | 1538.88 / 28.41 / 90 / 1.0 | 1538.88 / 28.41 / 90 / 1.0 | match to 0.01 |

### Timings (JDBC statement time)

- `CREATE LIGHTNING DATABASE` 158 ms; `CREATE LIGHTNING FILESTORE TABLE` 4.5 to 7.0 s each (partition listing and schema inference); `DESCRIBE` 52 to 133 ms; `CREATE SCHEMASTORE VIEW` 3.0 to 3.1 s each.
- `CACHE TABLE` on a view: 42.1 / 45.4 / 41.0 / 43.2 s (2025 TMAX, 2025 TMIN, 2024 TMAX, 2024 TMIN); each scans the 9 files of its partition once.
- Uncached `COUNT(*) ... WHERE ID = ...` on a raw table: 29.4 s.
- Reads of a cached view: `COUNT(*)` 8.8 to 10.8 s; the two-view degree-day join for one quarter 19.0 s. The Spark SQL UI shows these queries executing in Spark in about 70 ms from `Scan In-memory table won.ghcn_...` (the parquet scan node outputs 0 rows): the cache is used, and the remaining 9 s per view is spent before Spark execution, resolving the filestore source, once per filestore table the query references (one view about 9 s, two views about 19 s). This is a property of the filestore source on this instance, not a cache miss; the agent therefore asks for all of a period's stations in one `weather_quarter` call (up to 40 ids) instead of one call per utility.

### Gateway templates and warm-up

- `weather_quarter(year, quarter, station_list)`: the degree-day query above over `won.ghcn_<year>_tmax` and `won.ghcn_<year>_tmin`; `station_list` is 1 to 40 station ids separated by commas (`^US[A-Z0-9]{9}(,US[A-Z0-9]{9}){0,39}$`), rendered as a quoted `IN` list. Returns `station_id, year, quarter, hdd, cdd, days_observed, days_in_quarter, coverage`.
- `usl_describe()`: `LOAD USL weather_or_not_usl NAMESPACE lightning.metastore.weatherornot`. `dq_invalid()`: `SHOW DQ ALL INVALID TABLE ...weather_quarter`. `dq_run_coverage()`: `RUN DQ coverage_ok TABLE ...weather_quarter`.
- `CACHE_TARGETS` in `gateway/app.py` ends with the four GHCN views (`templates.GHCN_VIEWS`, 2025 first), so the warm-up re-caches them after a driver restart (about 3 minutes for the four). `scripts/warmup.py` does the same from the command line and prints per-view timings and in-memory sizes (`--force` re-caches everything, `--refresh` uncaches first). Live: 21 targets (17 SEC/SIC views + 4 GHCN views) all already cached, `COUNT(*)` 140 to 260 ms on the SEC views and 8.9 to 9.1 s on the GHCN views, 38.9 s in all, no failures.
- Through the gateway (`POST /sql/template`, 127.0.0.1:8793): `weather_quarter` for 2025 Q1 and 2024 Q1 with two stations answered in 18.3 s and 17.6 s wall (statement 18.3 s and 17.5 s), `cache_state: hit`, values equal to the runner's; `usl_describe` 43 ms wall; `select1` 60 ms.
- A cached derived view holding the whole degree-day table (`won.weather_quarter`, 342 rows) was tried and abandoned: reads of it took 109 s (its CACHE 109 s, a filtered read 108 s), slower than the two-view join, because every view layer resolves the filestore sources again. It remains on the instance uncached (no DROP is issued by this repository) and nothing reads it.

## USL weather_or_not_usl (gate G6; Fri 24 Oct 2026, 17:3x to 18:0x SGT)

### Model

`lightning.metastore.weatherornot.weather_or_not_usl` (usl id 1825), compiled and deployed as ONE statement with five tables (`05_won_usl_create.sql`):

| Table | Key | Foreign keys | Activated from |
|---|---|---|---|
| `sic_code(code, description)` | PK `code` | | SEC lane: `won.sic_codes` |
| `utility(cik, name, ticker, sic, hq_state)` | PK `cik` | `sic` -> `sic_code.code` | SEC lane: `won.submission_<cik10>` |
| `station(id, state, name)` | PK `id` | | `won.ghcn_2025_tmax` (DISTINCT `ID`) joined to an inline `VALUES` list of the 57 seed stations (state, name) |
| `weather_quarter(station_id, year, quarter, hdd, cdd, days_observed, coverage)` | PK `(station_id, year, quarter)` | `station_id` -> `station.id` | the four `won.ghcn_<year>_<element>` views: TMAX x TMIN joins for 2025 and 2024, Q1 to Q3, same arithmetic as the `weather_quarter` template |
| `revenue_quarter(cik, xbrl_tag, year, quarter, val, accn, filed, is_comparative)` | PK `(cik, xbrl_tag, year, quarter, accn)` | `cik` -> `utility.cik` | SEC lane: frames and companyconcept views |

Findings while compiling:
- Table-level composite primary keys (`PRIMARY KEY (station_id, year, quarter)`) are accepted by Zetaris 2.4.3.1; `LOAD USL` returns them as the table's `primaryKey.columns`. `boolean`, `int`, `double` and `varchar(n)` columns are accepted.
- The first COMPILE failed with `Invalid DDL statement. Please provide a valid CREATE TABLE statement using Spark SQL or ANSI SQL syntax` because a column was named `tag`: `tag` is a reserved word in the Lightning catalog parser (an `UPDATE USL ... revenue_quarter.tag SET COLUMN DESCRIPTION` fails with `no viable alternative at input`). The column is therefore `xbrl_tag`; nothing else changed.
- `COMPILE USL IF NOT EXISTS` on the deployed model is a 28 ms no-op that returns the model JSON. `CREATE NAMESPACE IF NOT EXISTS` is idempotent (parent `lightning.metastore` first).
- Descriptions on the model, every table and every column: 31 `UPDATE USL ... SET [TABLE | COLUMN] DESCRIPTION <unquoted text>` statements, 14 to 38 ms each (a quoted string would be stored with its quotes; the text carries no semicolon or apostrophe). `LOAD USL` (32 ms) returns them, so the planner prompt can be built from the model.
- An inline table `SELECT ... FROM VALUES (...), (...) AS seed(id, state, name)` is accepted in an activation query (and in a plain SELECT: 142 ms).

### Timings (JDBC statement time)

| Statement | Time |
|---|---|
| `COMPILE USL ... DEPLOY` (5 tables) | 161 ms |
| `ACTIVATE USL TABLE ...station` | 9.0 s (one GHCN view behind it) |
| `ACTIVATE USL TABLE ...weather_quarter` | 35.5 s (four GHCN views) |
| `REGISTER DQ coverage_ok TABLE ...weather_quarter AS coverage >= 0.9` | 184.1 s (the rule is evaluated on registration) |
| `SHOW NAMESPACES OR TABLES IN lightning.metastore.weatherornot` | 106 ms |
| `SELECT COUNT(*), COUNT(state) FROM ...station` | 44.1 s (57 / 57) |
| `SELECT id, state, name FROM ...station ORDER BY id` | 87.7 s (57 rows) |

Every read of a USL table activated over the filestore views pays the per-filestore-table resolution described above, once more per layer: the `station` table (one view) answers in 44 to 88 s, `weather_quarter` (four views) in minutes. The DQ templates (`dq_run_coverage`, `dq_invalid`) therefore carry a 300 s bound (`Template.timeout_s`), the other templates keep the gateway default of 60 s, and the agent's client waits up to 330 s for them (`TEMPLATE_TIMEOUT_MS`). The fast path for the agent is the `weather_quarter` template over the views (about 19 s per quarter for any station list), with the USL table as the governed, DQ-checked copy.

### Verification (`05_won_usl_select.sql`)

Run with `--timeout 600` (a read of a USL table over the filestore views takes minutes; the runner's RUN/SHOW DQ default of 120 s is too short here).

| Check | Result | Time |
|---|---|---|
| `SHOW NAMESPACES OR TABLES IN lightning.metastore.weatherornot` | `weather_or_not_usl`, 5 tables | 106 ms |
| `LOAD USL` | the model with every description | 32 ms |
| `station`: rows, rows with a state | 57 / 57 | 44.1 s |
| `station` rows ordered by id | 57 (Norfolk and Richmond both VA) | 87.7 s |
| `weather_quarter`: rows, stations, min coverage, rows below 0.9 | 342 (57 x 2 years x Q1-Q3) / 57 / 0.9556 / 0 | 186.2 s |
| `weather_quarter` for USW00013740, six quarters | 2024 Q1 1672.53 / 9.18 / 91 d; Q2 185.28 / 639.81 / 91; Q3 0.51 / 1123.68 / 92; 2025 Q1 2022.69 / 22.08 / 90; Q2 226.92 / 574.80 / 91; Q3 7.14 / 951.39 / 92; coverage 1.0: every value equals the pyarrow computation | 180.2 s |
| Join map, station -> state coverage (`station` LEFT JOIN `weather_quarter` by state) | 43 states, 57 stations, 342 station-quarters, 342 with coverage >= 0.9 (two-station states: CA, FL, IL, IN, MD, MI, MN, NJ, OH, PA, SD, TX, VA, WI) | 240.2 s |
| `LIST DQ USL` | 9 rules: 5 primary keys (two composite, named `station_id,year,quarter` and `cik,xbrl_tag,year,quarter,accn`), 3 foreign keys (`sic`, `station_id`, `cik`), custom `coverage_ok` | 19 ms |
| `RUN DQ id TABLE ...station` | Primary Key Constraint: 57 total, 57 valid, 0 invalid | 85.9 s |
| `RUN DQ coverage_ok TABLE ...weather_quarter` | Custom Data Quality: 342 total, 342 valid, 0 invalid (a first attempt with a 300 s bound timed out and was cancelled; the completed run is this one) | 361.4 s |
| `SHOW DQ ALL INVALID TABLE ...weather_quarter` | did not return within 900 s (cancelled). The Spark UI shows the USL relation materialised once per rule evaluation (about 3 minutes each; three rules on the table), so the all-rules form takes about 18 minutes here and is not usable as a per-question gate | > 900 s |
| plain-SQL equivalent of `coverage_ok` on the USL table (`WHERE NOT (coverage >= 0.9)`) | 0 rows (agrees with RUN DQ) | 187.9 s |
| `SHOW DQ INVALID RECORD coverage_ok TABLE ...weather_quarter` (the gateway's `dq_invalid`) | 0 rows | 181.5 s |
| Join inside the USL (`weather_quarter` x `station` by state, six Duke Energy states): mean TDD per state and quarter | 36 rows. Q1 TDD 2024 -> 2025: NC 1343.49 -> 1567.29, SC 1180.77 -> 1384.56, FL 599.39 -> 632.17, IN 2160.14 -> 2511.24, OH 2398.56 -> 2848.91, KY 1837.05 -> 2158.83 (colder Q1 in every state; one station-quarter at coverage 0.9889, the rest 1.0) | 224.3 s |
| `weather_quarter` for USW00013740 after the re-activation with double arithmetic | the same six quarters, now as doubles (2025 Q1 HDD 2022.6900000000012, CDD 22.079999999999984, 90 days): equal to pyarrow to 0.01 | 179.8 s |

Two statements failed on the first pass and were corrected in the file: an aggregate over the USL table's double columns (`AVG(w.hdd + w.cdd)`, with or without `ROUND`) raised `java.math.BigDecimal is not a valid external type for schema of double` while encoding the result (the USL layer carries `double` columns as decimals; the query now casts the operands with `CAST(... AS DOUBLE)` inside the aggregate), and the first `RUN DQ coverage_ok` did not return within 300 s (re-run with a longer bound, above). The FK rule `station_id` on `weather_quarter` was not run separately (each DQ run on that table takes about six minutes). The `SHOW DQ ALL INVALID` statement stays in the file for completeness; on this table it did not return within 900 s, so the gateway's `dq_invalid` template reads the single `coverage_ok` rule (`SHOW DQ INVALID RECORD coverage_ok`, 181 s live). The primary-key and station foreign-key rules hold by construction (`weather_quarter` and `station` derive from the same views) and are checked by `RUN DQ` at onboarding, not per question.

### What the agent should know

- Weather numbers: one `weather_quarter` call per (year, quarter) with every station the question needs (up to 40 ids, about 19 s), not one call per utility.
- DQ gate: `dq_run_coverage` (361 s) and `dq_invalid` (181 s) are onboarding or warm-up checks, bounded at 600 s; the per-question coverage check uses the `coverage` column the `weather_quarter` template already returns (the same rule, `coverage >= 0.9`).
- The USL `weather_quarter` table is the governed copy (keys, descriptions, DQ); a read of it takes about three minutes on this instance.
- `revenue_quarter.xbrl_tag` is the tag column (`tag` is a reserved word).

