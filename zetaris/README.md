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
