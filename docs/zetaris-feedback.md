# Zetaris: what we measured, and what it changed in the design

Zetaris 2.4.3.1 in local Docker on one Windows 11 PC, reached over JDBC through the gateway. Every number below is copied from [`zetaris/README.md`](../zetaris/README.md) (where the statement that showed it is recorded), [`docs/eval-report.md`](eval-report.md) or the README; nothing here is new measurement.

## Timings

| What | Measured | What it changed |
|---|---|---|
| A cached SEC view (frames, companyconcept, submissions) | 150 to 250 ms; `frames_seeds` (43 filers in one reply) 200 to 260 ms through the gateway | Revenue and peers are read from the cached views at question time |
| Any read of a GHCN parquet filestore view | about 9 s per filestore table before Spark executes; the Spark UI shows the in-memory scan itself in about 70 ms | The degree-day statement asks for all 56 stations of a quarter at once: two statements per question, 17.6 to 19.0 s each for any station list |
| A cached derived view holding the whole degree-day table (342 rows) | reads took 109 s, slower than the two-view join | Tried and abandoned |
| USL reads, one hop per source view | `usl_revenue` 2 to 4 s (six frames views), `usl_utility` 45 to 141 s (43 submission views), the USL `weather_quarter` table about 3 min | The USL tables are the governed copies checked at onboarding; no question reads them, and the evidence drawer cites the cached views' SQL |
| `RUN DQ coverage_ok` on the USL `weather_quarter` table | 361.4 s (Day 0) and 557.2 s (Day 1), 342 total / 342 valid / 0 invalid | DQ runs at onboarding; the verdict gate reads its result file and fails closed when the file is missing, unreadable or older than 30 days |
| `SHOW DQ ALL INVALID` on the same table | did not return within 900 s; the Spark UI shows the USL relation materialised once per rule (about 3 min each, three rules on the table) | The per-rule `SHOW DQ INVALID RECORD coverage_ok` is used instead (181.7 s, 0 rows) |
| Run-time registration through the gateway's registrar (table, view, DESCRIBE, CACHE) under a signed medium-risk contract | frames periods: 1.08 and 1.2 s; companyconcept tables during the 26 Oct sweep: 36 registrations, 0 failed, 883 to 2,092 ms (median 965 ms) | The agent extends the federation itself when a filer is missing |

## Parser and catalog behaviour

- `tag` is a reserved word in the Lightning catalog parser: a USL column named `tag` failed `COMPILE USL` with an invalid-DDL message. The column is `xbrl_tag`.
- `CREATE LIGHTNING DATABASE` and `CREATE SCHEMASTORE CONTAINER` accept no `IF NOT EXISTS` on 2.4.3.1; the SQL runner treats "already exists" as done (`--skip-exists`).
- SEC frames infer `val` as `double` for one period and `bigint` for another, so the templates cast it.
- An aggregate over a USL table's `double` columns raised `java.math.BigDecimal is not a valid external type for schema of double` until the aggregate carried an explicit `CAST`.
- Accepted and useful: table-level composite primary keys and inline `VALUES` tables in a USL activation; `COMPILE USL IF NOT EXISTS` on a deployed model is a 28 ms no-op.

## What would put the semantic layer on the question path

- A `utility_station` bridge table in the USL, so that the peers' growth and degree-day change come from one governed query. Not built: today those joins run in TypeScript over the cached views.
- A USL read in seconds rather than minutes over filestore sources, and `RUN DQ` fast enough to run per question instead of at onboarding.
