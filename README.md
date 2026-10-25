# Weather-or-Not

**The utility says it was the weather. Weather-or-Not checks.** It splits a US electric utility's year-on-year revenue change into a weather part, an industry-wide part and a company-specific remainder, each with a range and a confidence label, and cites every number to the Lightning SQL that produced it.

Open Agent Hackathon 2026, Track 2: The Agent That Can Explain Why. Team: Umar Mohktar, Singapore - solo.

- **User:** anyone who is handed the sentence "it was the weather" and has to decide whether to believe it: a state utility-commission analyst or consumer advocate preparing for a rate case, a utility credit analyst in earnings season, a reporter.
- **Problem:** revenue moves with heating and cooling demand, with rates, with fuel pass-through and with load growth, and the filing credits "colder weather" in one sentence. Checking that sentence by hand means reading two quarters of a utility's own filings (where the comparative column can be restated), the same quarters for every peer, and daily temperatures at the airports of every state served.
- **Measured on the demo case** (FirstEnergy, CY2025Q1 against CY2024Q1; details in [`docs/demo-case.md`](docs/demo-case.md) and [`docs/eval-report.md`](docs/eval-report.md)):
  - Revenue rose +14.5% like for like (3,765.0 million in the quarter's own 10-Q against 3,287.0 million as that filing restates the prior quarter; both accession numbers are on the card). Total degree days over the utility's 9 stations in 5 states rose +16.2%, coverage 1.00.
  - Weather is consistent with +8.2% of that change (range +1.6% to +14.0%), the industry-wide part +2.9% (range -1.8% to +8.7%), the company-specific remainder +3.5% (range -8.2% to +14.7%); sensitivity beta 0.51 (range 0.10 to 0.86) over 39 peers; verdict **supported**, confidence **high**. The verdict compares the central estimate with the change (ratio 0.564, supported at 0.5 or more); confidence high means the beta range excludes zero with 39 peers and coverage 1.00, not that the weather range is narrow. The same card came out of five runs of the question, to the printed digit.
  - The run took 97.5 s on one local GPU: 5 Markovian chunks, 9 planner calls, all valid on the first reply; the two degree-day statements in Lightning SQL took 20.0 and 21.0 s of it. The memo (184 words) was written by the model and every one of its numbers matched a tool output.
  - A second utility (American Electric Power) carries a live restatement: its own 10-Q reports 5,463.4 million for the quarter, the next year's 10-Q restates it as 5,463.0 million. The agent records the conflict, resolves it by rule R1, and the analyst can override it under a signed contract.

Demo video: https://youtu.be/JXRQMF2Xfl0 (unlisted, 3:48).

![Weather-or-Not architecture: SEC EDGAR, NOAA GHCN-Daily and the company_dns SIC list are read only through Zetaris Lightning; a gateway exposes named SQL templates; a Markovian question chain planned by local Nemotron runs ten deterministic tools; H-MEM and the World Model keep provenance and history; every number cites its evidence record; the analyst works in the UI.](docs/architecture.png)

## Contents

[What it does](#what-it-does) · [What is new](#what-is-new) · [Quickstart](#quickstart) · [Architecture](#architecture) · [Zetaris](#zetaris-the-data-layer) · [Meterless](#meterless-reasoning-memory-and-contracts) · [NVIDIA](#nvidia-nemotron-3-nano-4b-locally) · [Cursor](#how-cursor-was-used) · [Evaluation](#evaluation) · [Limitations](#limitations) · [Responsible use](#responsible-use) · [Dependencies](#dependencies-and-licences) · [Data and licences](#data-and-licences) · [Pre-existing code](#pre-existing-code) · [Licence](#licence)

## What it does

For one utility (by name, ticker or CIK), one calendar quarter (Q1 to Q3) and the words management used, Weather-or-Not answers "how much of the revenue change is weather?" and ends with a verdict on the claim: supported, partly supported or not supported, with a confidence label.

- **One data path, cited.** SEC EDGAR (XBRL frames, companyconcept and submissions), NOAA GHCN-Daily and the company_dns SIC list are read only through Zetaris Lightning. Every number on the answer card links to an evidence record holding the Lightning SQL that produced it, its sha256, the rows, the Zetaris object, the source endpoint, the licence, the retrieval time, the latency and the cache state. The SQL can be pasted into Zetaris and re-run.
- **Like-for-like revenue.** The current quarter's value is read from the quarter's own 10-Q through companyconcept, and the previous quarter from the comparative column of that same filing. If a later filing restates a value, the agent records a `recast_comparative` conflict with both values and both accession numbers in H-MEM, resolves it by rule R1 (the question's own filing decides) and shows it on the card. A frames read alone would silently take whichever filing came last.
- **Peers pooled across three XBRL tags.** Utilities report quarterly revenue under `Revenues`, `RevenueFromContractWithCustomerExcludingAssessedTax` or `RegulatedAndUnregulatedOperatingRevenue`; each of the 43 seed utilities contributes under its own first available tag (SIC 4911, 4931 or 4932, both periods present, |g| below 60%). Every exclusion is recorded with its reason.
- **Degree days computed in Lightning SQL.** Heating and cooling degree days per station and quarter come from one statement over the cached GHCN parquet views: TMAX joined to TMIN, days with a quality flag dropped, coverage reported. One call per quarter covers the target's and every peer's stations (56 station ids).
- **Deterministic attribution.** The slope of peer revenue growth on peer degree-day change (OLS, with a Theil-Sen cross-check), the weather part of the target, the industry median and the remainder, with 300-resample bootstrap ranges from a seeded generator (seed 7). Confidence follows a fixed rule on peers, coverage and the slope interval.
- **A data-quality gate from the semantic layer.** The `coverage_ok` rule's onboarding result (`RUN DQ` on the USL `weather_quarter` table, written to `data/dq/latest.json`) and the utility's own station coverage gate the verdict; the card states the rule's run time. The utility foreign-key rule found the one SIC orphan among the seeds (MGE Energy, SIC 4900) at onboarding; the peer filter keeps MGE out by its SIC code.
- **Memory with provenance.** Every fact the agent learns carries its Zetaris object, SQL hash, endpoint, accession number and retrieval time; a reconfirmed fact refreshes its provenance and keeps the history. Remembered tag and station choices make the second run of a utility skip a step. `why mem-62` prints the trace. The World Model keeps utilities, states, stations, SIC codes, filings and quarters as a graph whose edges are dated by source time, so re-ingesting the same rows writes nothing.
- **The model plans and writes, never computes.** Nemotron chooses the next tool in each Markovian chunk and writes the memo; the host string-matches every number in the memo against the tool outputs and rejects a draft with any other number. The memo must also state the card's verdict and no other verdict; 8 of the 9 saved memos pass that check (the ninth, from the first settings, says only "consistent with the claim"). Which number goes with which label is not checked. In the four clean runs the tool the model chose was the checklist's next step every time (34 of 34 calls): its measured contribution is valid JSON plans and a grounded memo, not a different path. A "Not tested" list names what the method cannot see.

## What is new

- **The recast trap is handled, not hidden.** The comparative column of a 10-Q can be restated; a naive year-on-year read takes the most recently filed fact. Weather-or-Not reads the quarter's own filing and its own comparative, and when a later filing differs it records the conflict with both accession numbers. On the second demo utility the restatement is live (5,463.4 million against 5,463.0 million), rule R1 picks the quarter's own filing, and the analyst can override it with a signed, single-use contract; a re-run then uses the chosen value and says so in its evidence.
- **The citation is the SQL.** An evidence record holds the exact Lightning SQL, its hash, the rows and the Zetaris object. The agent never writes SQL: it sends a template id and parameters to a gateway that holds 28 named templates behind an allowlist.
- **Degree days are a Lightning SQL result**, computed over the cached GHCN parquet views, with the quality-flag policy and the coverage in the statement itself. The same arithmetic in TypeScript, the gateway template and the parquet files read directly agree to 0.01 ([`zetaris/README.md`](zetaris/README.md)).
- **A DQ rule gates a verdict.** The USL `coverage_ok` rule (coverage at least 0.9 per station-quarter), run at onboarding, and the utility's own coverage column decide whether the verdict is given. The SIC foreign-key rule's one invalid row is a real finding (MGE Energy files under SIC 4900, which the SIC list does not carry).
- **Memory you can interrogate.** H-MEM facts carry Zetaris provenance; conflicts keep both sides; `why` prints the ledger from creation through conflict detection and resolution to the latest reconfirmation. The World Model answers "what did we know, and since when?" with edges valid from the filing date or the annual report's description.
- **A 4B model on a flat context.** Markovian chunks keep the planner's first-attempt prompts between 1,421 and 2,317 tokens on the four clean runs, while a full-history agent's first prompts would have summed to an estimated 12,956 tokens against the 6,615 measured on the demo run, 48.9% less ([`docs/nemotron-bench.md`](docs/nemotron-bench.md)); the carried state stayed between 284 and 387 tokens against an 800-token budget.
- **Honest output.** Ranges and confidence labels, never a point estimate alone; "consistent with" wording; eight Not-tested items on every card (fuel pass-through, rate cases, large-load growth, mergers, Q4, weather normals, the six-state cap, the quality-flag policy).

## Quickstart

### A. Three-minute check: no Zetaris, no GPU

Needs Node 22.12 or newer, Python 3.12 and git. On a fresh clone of this repository the agent steps took under 10 seconds on the development PC (Windows 11), plus download time.

```bash
# Agent: 203 unit tests in 16 files on synthetic fixtures (no network) and the type check
cd agent && npm ci && npm test && npm run typecheck && cd ..

# Meterless conformance on the vendored engines: 13/13, 8/8, 8/8, then "diff: empty"
cd engines/hmem/reference && npm install && npx tsx ../conformance/runner.ts && cd ../../..
cd engines/markovian/reference && npm install && npx tsx ../conformance/runner.ts && cd ../../..
cd engines/world-model/reference && npm install && npx tsx ../conformance/runner.ts && npx tsx scripts/idempotency-check.ts && cd ../../..
git checkout -- engines   # npm install rewrites the licence field in the vendored lock files

# Weather-or-Not's H-MEM extension, run through the engine's own conformance runner: 13/13
cd agent && HMEM_IMPL="$PWD/src/memory/hmemFacade.ts" npx tsx ../engines/hmem/conformance/runner.ts && cd ..

# Gateway: 236 passed, 2 skipped (the skipped ones need a live Zetaris)
python -m venv .venv
.venv/Scripts/pip install -r gateway/requirements-dev.txt        # macOS/Linux: .venv/bin/pip
.venv/Scripts/python -X utf8 -m pytest gateway/tests -q

# The analyst UI in its empty state: no runs are committed, so it shows the 43 seed utilities and "No saved runs yet"
cd agent && npm run dev                                          # open http://127.0.0.1:8794
```

Without a gateway or Ollama the server still starts and serves the UI; `/api/health` reports `gateway_ok: false` and every screen says what it would show after a run. Measured on the fresh clone: `npm ci` 2 s (38 packages, 0 vulnerabilities), `npm test` 16 files / 203 tests in 2.34 s, `tsc` 0 errors, gateway tests 236 passed / 2 skipped in 1.48 s. The conformance results are in [`docs/conformance.md`](docs/conformance.md).

### B. Full stack: Zetaris, gateway, agent and UI

**Prerequisites**

- Docker Desktop with the Zetaris platform installed locally. This is Zetaris 2.4.3.1 with the `ui`, `api`, `driver` and `postgres` containers: the UI is on `localhost:3000`, JDBC on `localhost:10000`. The platform bundle, which includes the JDBC driver JAR, and the registry login come from the "Run locally" page of a Zetaris Cloud account.
- Java 11 or newer (tested with 21), Python 3.12, Node 22.12 or newer.
- [Ollama](https://ollama.com) (tested with 0.40.7) and the model: `ollama pull nemotron-3-nano:4b` (2.8 GB).
- Tested on Windows 11. The commands below are PowerShell; on macOS or Linux use `.venv/bin/` instead of `.venv\Scripts\`.

**Steps**

```powershell
Copy-Item .env.local.example .env.local
#   ZETARIS_JDBC_JAR                  path to the driver JAR from the Zetaris bundle
#   ZETARIS_ADMIN_USERNAME/_PASSWORD  your Zetaris login (ZETARIS_READER_* optional, see Limitations)
#   WON_USER_AGENT                    "<application name> <operator contact>", the User-Agent SEC EDGAR asks for
#   WON_CONTRACT_SECRET               python -c "import secrets; print(secrets.token_hex(32))"
#   ZETARIS_GETTING_STARTED_DIR       optional: a clone of the Zetaris getting-started repository, read to seed H-MEM

python -m venv .venv
.venv\Scripts\pip install -r gateway\requirements.txt

# Zetaris objects, in onboarding order (zetaris/README.md): SEC frames, concept and submissions; SIC codes; GHCN parquet;
# the other 39 seed filers; then the USL, which activates its tables from those views. --dry-run prints the statements first.
.venv\Scripts\python -m gateway.run_sql zetaris\sql\01_won_sec_create.sql --dry-run
.venv\Scripts\python -m gateway.run_sql zetaris\sql\01_won_sec_create.sql --skip-exists
.venv\Scripts\python -m gateway.run_sql zetaris\sql\02_won_dns_create.sql --skip-exists
.venv\Scripts\python -m gateway.run_sql zetaris\sql\04_won_ghcn_create.sql --skip-exists      # four CACHE statements of 41 to 45 s each
.venv\Scripts\python -m gateway.run_sql zetaris\sql\06_won_sec_seeds_create.sql --skip-exists # 129 statements, 49 s
.venv\Scripts\python -m gateway.run_sql zetaris\sql\05_won_usl_create.sql --skip-exists --timeout 600   # REGISTER DQ takes about 3 min
.venv\Scripts\python scripts\dq_onboard.py            # RUN DQ coverage_ok + SHOW DQ INVALID RECORD: 9 to 12 min, writes data/dq/latest.json

.venv\Scripts\python -X utf8 -m gateway.app           # terminal 1: gateway on 127.0.0.1:8793, 28 templates, re-caches the views at start

cd agent
npm ci
npm run warmup                                        # gateway cache check, model load, memory seed
npm run ask -- --cik 0001031296 --period CY2025Q1 --claim "colder weather"   # the demo question from the command line
npm run dev                                           # terminal 2: open http://127.0.0.1:8794
```

- Every statement the runner and the gateway send is checked against the allowlist in `gateway/allowlist.py` (hosts `data.sec.gov`, `company-dns.mediumroast.io`, the `noaa-ghcn-pds` bucket; only `WON_*` databases, the `won` container and the `lightning.metastore.weatherornot` namespace) and logged with its sha256 to `data/evidence/sql_log.jsonl`. The REST statements carry a User-Agent placeholder that is filled from `WON_USER_AGENT` on the wire only.
- The Zetaris cache is driver-wide and lost on a driver restart; the gateway re-caches the 64 views at start, and `scripts/warmup.py --skip-dq` does the same from the command line before a demo (about 3 minutes for the four GHCN views).
- `scripts/dq_onboard.py` belongs to onboarding, not to a demo: while it runs, the driver is busy and even cached reads slow down ([`zetaris/README.md`](zetaris/README.md), "DQ gate").
- Without `ZETARIS_READER_*` credentials the gateway runs read templates on the admin login behind the reader allowlist (see [Limitations](#limitations)).

### Try it

1. **Ask:** FirstEnergy, CY2025Q1, claim "colder weather". The timeline shows each Markovian chunk, the planner's plan (rendered as the model's plan, never as a fact) and each tool with its latency; "Computing degree days in Lightning SQL" stays on screen for the two `weather_quarter` statements (about 18 to 24 s each). The card lands after about 100 to 130 s (97.5 to 128.1 s on the four clean runs): the verdict sentence, the three parts with ranges, the growth with both accession numbers, the weather with stations and coverage, the peers table with exclusions, the DQ panel with the rule's run time, the Not-tested list and the memo ("Copy as markdown" gives the memo with every citation).
2. Click any figure to open the **evidence drawer**: the Lightning SQL and its sha256, the template and parameters, the Zetaris object, the endpoint, the licence, the retrieval time, the latency, the cache state and the rows. A derived number (the attribution) links to the records it was computed from.
3. **Memory and why:** the run's memory ids, the `why` trace of a fact (provenance, ledger, history of retrievals) and the recast conflicts.
4. **Ask** American Electric Power, CY2025Q1, "colder weather". The card shows the recast conflict (5,463.4 million in the quarter's own filing against 5,463.0 million in the next year's filing; rule R1 keeps the own filing). On Memory and why, override it with a reason: the UI signs a high-risk contract, posts the override, the panel repaints to "overridden", and "Re-run with the override" asks the question again with the chosen value; the new card and its evidence name the contract.
5. **Graph:** the utility's World Model neighbourhood (states served, peers of this period, filings, SIC) with the dates the edges are valid from, and the source-time timeline.
6. **Evaluation:** the measured report (join map, peers, coverage, bootstrap ranges, DQ timings, planner validity, memo acceptance, cold against warm). The telemetry footer shows the model, planner calls and validity, fallback steps, measured against naive prompt tokens per chunk, tokens per second and cloud model calls (0).

**Command line** (from `agent/`):

```bash
npm run ask -- --cik 0001031296 --period CY2025Q1 --claim "colder weather"   # one question; --utility FE also works; --json, --out <file>
npm run replay -- <run_id>                                                  # print a saved run (no model, no gateway)
npm run cli -- runs                                                         # list the saved runs
npm run cli -- why mem-62                                                   # "why do you believe this?" ledger trace for one fact
npm run warmup                                                              # gateway warm-up, model load, memory seed
npx tsx src/eval/run.ts                                                     # rewrite the evaluation report from the saved runs
```

The API contract the UI is built on is in [`docs/api.md`](docs/api.md).

## Architecture

The diagram above is drawn by [`docs/architecture.py`](docs/architecture.py) ([SVG](docs/architecture.svg)). A question runs like this:

1. **Zetaris** federates the sources as Lightning REST tables (SEC frames, companyconcept, submissions; the company_dns SIC list) and a parquet filestore (NOAA GHCN-Daily, by year and element), flattens them in cached SchemaStore views, and models them in the `weather_or_not_usl` Unified Semantic Layer with primary and foreign keys and the custom DQ rule `coverage_ok`.
2. **The gateway** (`gateway/`, Python, FastAPI + JDBC, `127.0.0.1:8793`) is the only route to Zetaris. The agent sends a template id and parameters, never SQL. The gateway checks them against fixed patterns and an allowlist, runs one of 28 named templates, and logs each statement with its sha256. That logged text becomes the citation. Registrar plans (a new frames period, a filer's concept history or submissions profile) run only under a signed medium-risk contract.
3. **The Markovian question chain** (`agent/src/loop/`) runs the vendored Markovian orchestrator unchanged. The generator asks Nemotron which of the ten tools to call next (`resolve_utility`, `probe_revenue_tag`, `register_frames`, `get_revenue`, `get_peers`, `get_weather`, `dq_gate`, `attribute`, `not_tested`, `finalize`), a `NEEDS_TOOL` executor runs it, and an 11-item checklist defines when the question is answered. The carried state is capped at 800 tokens and the chain at 10 chunks; an invalid planner reply gets one repair round, and after a second failure the host takes the next checklist step itself and labels it a fallback.
4. **Deterministic tools** (`agent/src/tools/`) compute every number: degree days (the Lightning SQL text and its TypeScript reference), like-for-like revenue with rule R1, the peer set with recorded exclusions, OLS and Theil-Sen slopes, the 300-resample bootstrap (seed 7), the confidence label and the claim verdict.
5. **H-MEM and the World Model** (`agent/src/memory/`, `agent/src/world/`) keep facts with Zetaris provenance, the recast conflicts, the remembered tag and station choices, and the utility graph with edges dated by source time.
6. **Evidence and contracts** (`agent/src/evidence/`, `agent/src/contract/`): every claim on the card cites evidence records; the analyst's override of a recast resolution is the one high-risk action and needs an HMAC-signed, single-use contract that expires within 15 minutes.
7. **The server and the analyst UI** (`agent/src/server.ts`, `ui/`, plain HTML and ES modules over server-sent events, `127.0.0.1:8794`): Ask with a live timeline, the answer card, the evidence drawer, Memory and why with the override form, Graph, Evaluation and the telemetry footer. Saved runs render fully without the model.

| Path | What it holds |
|---|---|
| `agent/` | Node 22 + TypeScript (tsx, no runtime dependencies): loop, tools, memory, World Model, contracts, evidence, server, CLI, evaluation; tests in `agent/test/` |
| `gateway/` | Python 3.12 Zetaris gateway: templates, allowlist, registrar, contract check, JDBC channel, SQL runner; tests in `gateway/tests/` |
| `zetaris/` | Lightning SQL `NN_*_create.sql` / `_select.sql` pairs, the manifest, verified counts and timings |
| `scripts/` | warm-up, DQ onboarding, join-map measurement, dev-time seed curation (not part of the agent) |
| `seeds/` | the 43 utilities (CIK, name, SIC, states served, station ids) and the 56 GHCN stations |
| `ui/` | analyst UI, no build step |
| `engines/` | Meterless H-MEM, Markovian and World Model reference engines, vendored unchanged |
| `docs/` | evaluation report, conformance results, Nemotron bench, API contract, demo case, Cursor task files |

Everything under `data/` is runtime state and gitignored: runs, evidence, the SQL log, H-MEM, the World Model, the DQ file and the contract ledgers.

## Zetaris: the data layer

Zetaris is Weather-or-Not's only runtime path to data. It federates the sources, caches them, holds the semantic contract (the USL), and the onboarding result of its DQ rule gates the verdict. Instance: local Docker, Zetaris 2.4.3.1, reached over JDBC (`jdbc:zetaris:lightning@localhost:10000`). Every number in this section comes from [`zetaris/README.md`](zetaris/README.md).

**Lightning databases, REST and filestore tables** (`zetaris/sql/01` to `06`):

| Object | Source | Notes |
|---|---|---|
| `WON_SEC.frames_<tag>_<period>` | SEC XBRL frames, `https://data.sec.gov/api/xbrl/frames/us-gaap/<tag>/USD/<period>.json` | 6 at onboarding (three tags, CY2025Q1 and CY2024Q1) plus 2 registered at run time through the gateway's registrar (Revenues CY2025Q2 and CY2024Q2); counts equal the source (1,937 facts for Revenues CY2025Q1) |
| `WON_SEC.concept_<cik10>_<tag>` | SEC companyconcept, the filer's full history under one tag | 10 tables for the filers whose like-for-like history the questions needed; counts equal the source (FirstEnergy Revenues 194, American Electric Power Revenues 304) |
| `WON_SEC.submissions_<cik10>` | SEC submissions, `cik, name, sic, sicDescription, state` only (never street fields) | 43, one per seed utility |
| `WON_DNS.sic_codes_v4_raw` | company_dns V4 SIC list | 1,005 codes |
| `WON_GHCN.ghcn_<yyyy>_<tmax\|tmin>` | NOAA GHCN-Daily parquet on the public bucket, `by_year/YEAR=<yyyy>/ELEMENT=<TMAX\|TMIN>/` | 4 partitions (2024 and 2025), 9 files and 4.3 million rows each; the views `won.ghcn_*` filter to the 56 seed stations (plus one validation station) and are cached; counts equal pyarrow over the same files |

Every raw table has a flattened view in the SchemaStore container `won` (`LATERAL VIEW explode` for the SEC arrays), and every view is cached: 64 cache targets that the gateway re-caches after a driver restart.

**Unified Semantic Layer** `lightning.metastore.weatherornot.weather_or_not_usl` (`zetaris/sql/05`, compiled and deployed as one statement, every table and column described). Five tables, with the row counts from onboarding:

| `utility` | `sic_code` | `station` | `weather_quarter` | `revenue_quarter` |
|---|---|---|---|---|
| 43 | 1,005 | 57 | 342 | 133 |

**The DQ gate.** `LIST DQ USL` lists 9 rules: 5 primary keys (two composite), 3 foreign keys (`sic`, `station_id`, `cik`) and the custom rule `coverage_ok` (`coverage >= 0.9` on `weather_quarter`). `RUN DQ coverage_ok` at onboarding: 342 total, 342 valid, 0 invalid (557 s on Day 1; the whole onboarding pass 739 s), written to `data/dq/latest.json`, which the agent's `dq_gate` tool reads together with the utility's own station coverage; the card states the run time. `RUN DQ sic` on `utility`: 43 total, 42 valid, 1 invalid in 79.1 s, and `SHOW DQ INVALID RECORD sic` names MGE Energy (SIC 4900, absent from the SIC list) in 93.3 s. The primary-key rules on `revenue_quarter` (133 / 133 / 0) and `sic_code` (1,005 / 1,005 / 0) and the `cik` foreign key (133 / 133 / 0) hold.

**Degree days in Lightning SQL.** The `weather_quarter(year, quarter, station_list)` template joins the TMAX and TMIN views on station and date, drops days with a quality flag on either element, converts tenths of a degree C to F and sums heating and cooling degree days with the coverage over the calendar day count. For the validation station (Richmond VA, 2025 Q1) the template, the agent's own SQL text over JDBC and the TypeScript reference over the parquet rows read with pyarrow all give HDD 2022.69, CDD 22.08, 90 days.

**Measured on this instance.**

- A cached SEC view answers in 150 to 250 ms; `frames_seeds` (the 43 seed filers in one reply) 200 to 260 ms through the gateway.
- Any read of a GHCN-backed view pays about 9 s per filestore table before Spark executes (the Spark UI shows the in-memory scan itself in about 70 ms), so the two-view degree-day statement takes 17.6 to 19.0 s for any station list, and the agent asks for all 56 stations of a period in one call: two calls per question.
- USL reads pay a hop per source view: `usl_revenue` 2 to 4 s (six frames views), `usl_utility` 45 to 141 s (43 submission views), the USL `weather_quarter` table about 3 min, `RUN DQ coverage_ok` 361 to 557 s, `SHOW DQ ALL INVALID` did not return within 900 s. The USL tables are therefore the governed copies, DQ-checked at onboarding; no question reads them.
- Run-time registration of a new frames period through the gateway's registrar (table, view, DESCRIBE, CACHE) took 1.08 to 1.2 s and the new table counted the same facts as the source response fetched the same minute.

**What we learned.** `tag` is a reserved word in the Lightning catalog parser (the column is `xbrl_tag`). `CREATE LIGHTNING DATABASE` and `CREATE SCHEMASTORE CONTAINER` accept no `IF NOT EXISTS` on 2.4.3.1. Frames infer `val` as `double` for one period and `bigint` for another, so the templates cast it. Table-level composite primary keys and inline `VALUES` tables are accepted in a USL activation. A USL aggregate over `double` columns needs an explicit `CAST` inside the aggregate. Each of these is recorded in `zetaris/README.md` with the statement that showed it.

## Meterless: reasoning, memory and contracts

The engines come from [Meterless/Meterless](https://github.com/Meterless/Meterless) at commit `1742dec56a66e58eef9dda2d2b865823758ca8cd`. They are vendored unchanged (see [`engines/UPSTREAM.md`](engines/UPSTREAM.md)), and Weather-or-Not extends them only from `agent/src/` by subclassing, wrapping or composing. `git diff -- engines/` is empty. The conformance suites were run in this repository on 24 Oct 2026; full output in [`docs/conformance.md`](docs/conformance.md).

| Engine | How Weather-or-Not uses it | Where | Conformance |
|---|---|---|---|
| **Markovian**, vendored | One question is one chain of bounded chunks (carryover 800 tokens, at most 10 chunks). Nemotron plans each chunk, a `NEEDS_TOOL` executor runs the chosen tool, the host digests the result and plans again, at most two tools per chunk. Measured on the four clean runs: planner first-attempt prompts between 1,421 and 2,317 tokens (a repair prompt, which repeats the reply and the errors, up to 4,178); first-call prompts summed per run 5,521 to 6,812 against a full-history estimate of 10,251 to 13,770; carryover at most 284 to 387 tokens. | `agent/src/loop/` | 8/8 |
| **H-MEM**, vendored and extended by subclass | Facts with Zetaris provenance (object, SQL sha256, endpoint, accession number, filing date, licence, retrieval time, latency, cache state), reconfirmed rather than duplicated, with the earlier retrievals kept in a history. `recast_comparative` conflicts keep both memories and both accession numbers, are resolved by rule R1 and can be overridden by the analyst under a signed contract. Remembered tag and station choices make a warm run skip the probe step (4 chunks instead of 5). `why(memoryId)` prints the ledger. | `agent/src/memory/` | 13/13 vendored; 13/13 with the Weather-or-Not subclass loaded through the engine's own runner |
| **World Model**, vendored and wrapped | A graph of utilities, states, stations, SIC codes, filings and quarters; `serves` edges valid from the annual report's description, `reported_in` edges valid from the filing date, `peer_of` edges per period with g and dw. Every write's time is the source record's own date, so re-ingesting the same rows appends nothing: the warm runs left the event count at 769. | `agent/src/world/` | 8/8; idempotency check `diff: empty` |
| **Scout Intent**, partial reimplementation (no reference engine is vendored) | Risk classes and HMAC-signed, single-use execution contracts that expire within 15 minutes: medium risk for the gateway's registrar plans (verified by the Python gateway, with a shared test vector), high risk for `override_recast` with an analyst approval and a reason (verified by the agent server; the refusal is logged and nothing is written). This is an integrity check, as in Scout's own documentation, not cryptographic-grade security. The injection guard is kept from the sister project; the model's inputs here are host-formatted digests of tool outputs (utility names and numbers from the sources), not free-text documents. | `agent/src/contract/` | none (partial, labelled) |

## NVIDIA: Nemotron 3 Nano 4B, locally

`nemotron-3-nano:4b` runs in local Ollama (tested with 0.40.7). Settings: temperature 0, seed 7, `num_ctx` 8192, one call at a time, output under a JSON schema (Ollama `format`) validated on the host. The planner runs with think on and an output budget of 3,072 tokens; the memo with think off and 1,024. The model host must be a loopback address: any other host is refused and counted (`refused_model_hosts`, 0 in every run). Nemotron does two jobs and computes nothing:

1. **The Markovian planner**, which chooses the next tool from the ones the host allows at that step and keeps the chain's hypotheses (think on).
2. **The memo**, 100 to 250 words from the tool outputs (think off). Every number in the draft is string-matched against the formatted tool outputs, and the draft must state the card's verdict and no other verdict; a draft that fails either check is rejected once with the reason, then the template memo is used. 8 of the 9 saved memos pass the verdict check (the ninth, from the first settings, says only "consistent with the claim"); which number goes with which label is not checked.

| Measured ([`docs/nemotron-bench.md`](docs/nemotron-bench.md), [`docs/eval-report.md`](docs/eval-report.md)) | Value |
|---|---|
| Planner speed, median per run | 139.2 to 140.4 tokens/s on the four clean runs (139.5 to 141.2 on the five earlier runs) |
| Memo speed | 140.5 to 149.2 tokens/s; 2.7 to 3.0 s per memo |
| One question, wall time | 97.5 to 128.1 s on the four clean runs; the two degree-day statements take 18.2 to 23.9 s each |
| JSON valid on the first reply | 64 of 76 planner calls over the nine saved runs; 11 repaired (4 of the repair rounds with think off); 1 deterministic fallback |
| Memo | 12 drafts, 0 with a number that was not a tool output; the four clean runs kept their first draft (184, 176, 184, 176 words) |
| Cloud model calls | 0, by construction: the model client accepts loopback URLs only |
| Cold against warm | a warm run skips the tag probe from memory (4 chunks instead of 5, 8 planner calls instead of 9) but is not faster in wall time: the degree-day statements and the repair rounds dominate |

What the bench shows plainly: when the first reply is empty, it is because the model spent the whole output budget thinking (Ollama `done_reason` `length`), on the `not_tested` and `finalize` steps. Raising the budget from 2,048 to 3,072 did not stop it; a repair round with think off fixed every such case on the four clean runs in about 24 s each. In two further verification runs through the server the think-off repair once produced a wrong tag and the deterministic fallback ran `attribute` instead; the card was unaffected because the step is deterministic.

## How Cursor was used

Developed in Cursor; see [`docs/how-cursor-was-used.md`](docs/how-cursor-was-used.md). That page lists the three headless task runs that wrote the deterministic tools (degree days, attribution, like-for-like revenue with rule R1; 1,824 of the 1,844 lines in eight files), their commits, what the reviewer corrected afterwards, and what was built outside those runs: everything else.

## Evaluation

All numbers are measured unless labelled otherwise. The full report is [`docs/eval-report.md`](docs/eval-report.md), generated by `agent/src/eval/run.ts` from nine saved runs of 24 Oct 2026 (five on the first settings, four clean re-runs after the planner budget, think-off repair and memo-policy changes), the DQ onboarding file and 17 one-off join-map statements in Lightning SQL.

**Join map** (section 1): frames `cik` padded to 10 digits joins the seeds' submission views for every tag and period (Revenues 34 and 35 seeds, RFC 21 and 23, RUOR 9 and 11 for CY2025Q1 and CY2024Q1), equal to the integer `IN` count the `frames_seeds` template uses; the control without padding joins 0. Frames `loc` agrees with the submission's business-address state for every seed present (133 of 133 rows across the six views). 56 of 56 seed stations are in the USL `station` table with the same state. The SIC foreign key joins 42 of 43 seeds; the orphan is MGE Energy (SIC 4900).

**Peers and coverage** (sections 2 and 3): 39 peers for FirstEnergy (32 under `Revenues`, 3 under `RevenueFromContractWithCustomerExcludingAssessedTax`, 4 under `RegulatedAndUnregulatedOperatingRevenue`), identical across its five runs; IDACORP excluded (no CY2025Q1 fact under any tag), MGE Energy (SIC 4900), Oncor (no CY2024Q1 fact under its tag). Coverage per utility over 56 stations: 43 of 43 utilities have every station in the rows, the lowest utility coverage is 0.9556, none below 0.9.

**Attribution with bootstrap ranges** (section 4), identical across every run of each utility:

| Utility | g | Degree days | Peers | beta (range) | Weather (range) | Industry (range) | Remainder (range) | Ratio / verdict / confidence |
|---|---|---|---|---|---|---|---|---|
| FirstEnergy | +14.54% | +16.19% | 39 | 0.5065 (0.1012 to 0.8639); Theil-Sen 0.3057 | +8.20% (+1.64% to +13.99%) | +2.87% (-1.81% to +8.72%) | +3.48% (-8.16% to +14.72%) | 0.564 / supported / high |
| American Electric Power | +8.71% | +16.86% | 39 | 0.5287 (0.0746 to 0.8772); Theil-Sen 0.4036 | +8.92% (+1.26% to +14.79%) | +3.47% (-1.64% to +9.02%) | -3.68% (-15.10% to +9.09%) | 1.024 / supported / high |

Both from 300 of 300 valid resamples, seed 7; coverage 1.0000 and 0.9889; one recast conflict on the AEP card. The AEP weather part exceeds the whole change (ratio above 1), so the card words it as "consistent with" and the remainder is negative.

**Data quality** (section 5): `coverage_ok` run 2026-10-24 19:31 (SGT), 739.3 s in all, `RUN DQ` 342 / 342 / 0 in 557.2 s, `SHOW DQ INVALID RECORD` 0 rows in 181.7 s; the utility FK rule 43 / 42 / 1 (MGE Energy).

**Planner, memo and evidence** (section 6), over the nine runs: 76 planner calls, 64 valid on the first reply, 11 repaired (4 with think off), 1 deterministic fallback; 75 tool calls chosen by the model; 12 memo drafts, 0 with an unknown number, 7 model memos kept and 2 template memos (both on the first settings, when 95-word drafts were rejected for length); evidence records 158 of 180 complete (the 22 incomplete ones are the two earliest cold runs' unresolved object names, fixed before the clean re-runs; 20 of 20 in every later run); claims cited 171 of 171 (E-cov 1.000 in every run); cloud model calls 0; refused hosts 0. The four clean runs: 34 planner calls, 28 valid first try, 6 repaired (4 think off), 0 fallbacks, 4 memos kept on the first draft. Two further verification runs through the server API (not in the report) had 16 planner calls, 11 valid first try, 4 repaired and 1 fallback in 121.8 and 156.2 s.

**Cold against warm** (section 7): cold runs 5 chunks and 9 planner calls, mean wall 99.1 s (84.1 to 114.9 s); warm runs 4 chunks and 8 planner calls, mean wall 116.0 s (100.7 to 133.2 s). The skipped probe saves one planner call and a 0.2 s statement; the repair rounds (about 24 s each) and the degree-day statements decide the wall time.

**What did not go well:**

- **The 4B model runs out of output budget thinking.** 8 of the 11 repaired calls and the one fallback were empty first replies on `not_tested` or `finalize`. The think-off repair fixes them, at about 24 s each, so warm runs are not faster in wall time.
- **Three planner inputs named another utility's revenue tag.** The host rejects a tag that is not the utility's (a schema error, one repair round each); before that check one such input was silently ignored.
- **Memo length on the first settings.** Four 95-word drafts with every number right were rejected for length alone; the policy is now 100 to 250 words and the four clean runs kept their first draft.
- **The two earliest cold runs** carried placeholder object names in 11 of 20 evidence records (a provenance refresh bug, fixed in commit `47c7cdd`); they stay in the report as measured.
- **Not measured:** the model's VRAM in this repository; a think on/off ablation of the planner; cold against warm on an empty memory store; analyst time saved (there is no baseline of the manual check); the override re-run is measured in the verification notes, not in the report.

## Limitations

- **Revenue is a proxy for volume.** A fuel or purchased-power clause moves revenue without moving margin; rate cases, large-load growth, mergers and divestitures are not read from the filings. All of this is on every card's Not-tested list.
- **About 40 peers on one quarter give wide ranges.** The weather part's 10th to 90th percentile range spans +1.6% to +14.0% on the demo case; the confidence label is high because the slope interval excludes zero, not because the range is narrow.
- **Days with a GHCN quality flag are dropped**, not corrected; coverage reports how many days remain (two stations lose one and four days in 2025 Q1).
- **States served are capped at six per utility** and curated from the annual reports' service-territory text; one or two airport stations stand for each state. The largest systems serve more states.
- **The fourth quarter and full year are not compared**: the frames API has no three-month fourth-quarter frame. Weather normals are not read; the comparison is year on year.
- **MGE Energy is a target-only seed.** Its SIC 4900 is not in the SIC list the USL foreign key checks, so it is never a peer; the finding is shown, not hidden.
- **The USL tables are off the hot path.** A read of a USL table pays a hop per source view (45 s to minutes here), so the agent reads the cached views through the templates and the USL is the governed copy checked at onboarding; no question reads it (the evidence drawer cites the cached views' SQL).
- **The DQ gate reads the onboarding result.** `dq_gate` reads the onboarding `RUN DQ coverage_ok` file and re-applies the 0.9 threshold to the question's own coverage; it does not check the file's age, and without the file it gates on coverage alone. The SIC foreign-key result is not part of the gate.
- **No least-privilege reader yet.** The non-admin Zetaris login was not configured, so the gateway runs read templates on the admin login behind the reader allowlist; `/health` reports `admin_fallback`.
- **The model's empty replies.** With think on, the 4B model sometimes spends the whole output budget thinking and returns no JSON; the repair round then runs with think off, and the deterministic fallback is the last resort (it ran once in nine runs and once in two verification runs).
- **Warm runs are not faster in wall time.** Memory saves a planner call and a statement; the degree-day statements (about 18 s each) and any repair round decide the wall time.
- **A local demo identity.** `POST /api/approvals/sign` issues an analyst contract to any request on this machine that names the server as its Host and carries no foreign Origin. There is no login. A real deployment needs single sign-on in front of the two write endpoints.
- **Scope:** 43 seed utilities, 56 stations; frames registered for CY2024Q1 and CY2025Q1 under three tags (plus two run-time registrations), GHCN cached for 2024 and 2025. The two run-time registrations were operator calls through the gateway's registrar; the agent's own `register_frames` step, which asks the registrar for another quarter (Q1 to Q3), is unit-tested and has not run in a saved question. One analyst and one model job at a time. Tested on Windows 11 only. No personal data is read or stored.

## Responsible use

- The model never computes a number and never decides. Degree days come from Lightning SQL, every other number from deterministic TypeScript; the verdict is a fixed function of the attribution and the DQ label; every memo number is string-matched against a tool output.
- Results carry ranges and a confidence label, never a point estimate alone, and the wording is "consistent with" and "accounts for roughly". The Not-tested list is on every card and in every memo.
- The analyst's override of a recast resolution is logged with the reason and the contract id, in the H-MEM ledger and in the evidence of the re-run. Nothing in the saved runs is edited after the fact.
- Source etiquette: SEC EDGAR at most 10 requests per second with the declared User-Agent (0.1 s floor in the runner); SEC data is queried live and never redistributed; the GHCN parquet is read anonymously from the public bucket; company_dns is called with an identifying User-Agent. All three are cached in Zetaris.
- Secrets (`WON_USER_AGENT`, `WON_CONTRACT_SECRET`, the Zetaris login) live only in `.env.local`, which is gitignored; the SQL files carry a placeholder that is filled on the wire only. They never appear in prompts, logs, evidence or commits.
- The planner's `thought` is shown as the model's plan, never as a fact; only tool lines carry facts, each with its evidence.

## Dependencies and licences

| Component | Version | Licence |
|---|---|---|
| Node.js | 22.12 or newer (tested 22.13.1) | MIT |
| tsx, vitest, vite, @types/node (dev only; the agent has no runtime dependencies) | 4.23.15, 5.0.3, 7.3.7, 22.20.5 | MIT |
| TypeScript (dev only) | 7.0.2 | Apache-2.0 |
| FastAPI, pytest (dev) | 0.161.1, 9.1.1 | MIT |
| uvicorn, httpx (dev) | 0.54.0, 0.28.1 | BSD-3-Clause |
| JayDeBeApi | 1.2.3 | LGPL-3.0 |
| JPype1 | 1.7.1 | Apache-2.0 |
| Meterless reference engines (vendored) | commit `1742dec` | Apache-2.0 |
| Ollama | 0.40.7 | MIT |
| NVIDIA Nemotron 3 Nano 4B (`nemotron-3-nano:4b`, not redistributed) | the Ollama build | NVIDIA Open Model License |
| Zetaris platform 2.4.3.1 and its JDBC driver (not redistributed) | 2.4.3.1 | Zetaris terms |
| Java runtime | 11 or newer (tested 21) | per distribution |
| Python | 3.12 | PSF |

## Data and licences

- **SEC EDGAR** (XBRL frames, companyconcept, submissions): a work of the US government, public domain. Read live through Zetaris with the declared User-Agent under the fair-access policy (at most 10 requests per second), never bulk-redistributed. No extracted SEC data is committed beyond the numbers cited in [`docs/eval-report.md`](docs/eval-report.md) and [`docs/demo-case.md`](docs/demo-case.md) (growth rates, accession numbers and the two restated values of the demo utilities); `seeds/utilities.json` holds public identifiers only (CIK, name, SIC, headquarters state, ticker) plus the curated states served and station ids.
- **NOAA GHCN-Daily**, from the Registry of Open Data on AWS (`noaa-ghcn-pds`, CC0-1.0; a work of the US government, cite NOAA NCEI). Read through Zetaris; `seeds/stations.json` holds station ids, names and states from `ghcnd-stations.txt`.
- **company_dns**: an Apache-2.0 service serving the US SIC code list. Read through Zetaris.
- **Zetaris getting-started repository** (Apache-2.0): its data manifest and `known_to_fail` notes are read at boot, when `ZETARIS_GETTING_STARTED_DIR` is set, to seed H-MEM with source notes.
- No personal data is read or stored. Submissions are read for `cik, name, sic, sicDescription` and the business-address state only; no street field is ever selected.

## Pre-existing code

Weather-or-Not was written for this hackathon. The pre-existing code is:

- **The Meterless reference engines** H-MEM, Markovian and World Model (Apache-2.0), vendored unchanged in `engines/`.
- **`gateway/jdbc.py`**, adapted from `scripts/zetaris_sql.py` in the [Zetaris getting-started repository](https://github.com/zetaris/getting-started) at commit `6a2fbaa` (Apache-2.0): the `.env.local` loader, the SQL statement splitter and the JayDeBeApi channel; Windows JDK discovery, column names and timings in results, a bounded wait with statement cancel and a lock per connection were added.
- **Scaffolding from ClearShelf**, the author's Track 3 entry (Apache-2.0, same author, declared as pre-existing): the gateway pattern (templates, allowlist, registrar, contract check), the agent server and SSE pattern, the Markovian generator and telemetry, the H-MEM facade and World Model wrapper patterns, the evidence store, the contract module, the UI shell and `ui/lib.js`. Each adapted file says so in its header; everything specific to this entry (the Zetaris objects and USL, the templates, the ten tools and the method, the recast conflicts, the question chain, the analyst screens, the evaluation) is new.

## Licence

Apache-2.0, see [`LICENSE`](LICENSE) and [`NOTICE`](NOTICE).
