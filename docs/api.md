# Weather-or-Not agent API

The analyst UI talks to the agent server (`agent/src/server.ts`, `npm run dev` in `agent/`) on `http://127.0.0.1:8794` (`UI_PORT`). The server also serves the files in `ui/` (`/` is `ui/index.html`). This page is the contract the UI is built against; the TypeScript types named below are the exact shapes.

## Rules every client follows

- **Host.** The server answers only requests whose `Host` is `127.0.0.1:<port>` or `localhost:<port>` (421 `host` otherwise).
- **Writes.** Every `POST` carries `content-type: application/json` and a JSON object body of at most 256 KB (415 `content_type`, 413 `too_large`, 400 `bad_json` otherwise), and no foreign `Origin` (403 `origin`). A page served by the server itself passes these checks.
- **Errors.** Every error is `{ "error": "<message>", "code": "<code>" }` with a 4xx/5xx status. The UI shows `error` as text. A 403 is a refusal (no contract, bad signature, replayed contract, cross-origin) and is shown as a refusal, never retried. A 409 is a state conflict (`busy`: a run is in progress; `not_applied`: the override could not be applied).
- **One model job at a time.** `POST /api/ask` starts a run and answers `202 { run_id }` at once, or `409 { busy_run_id }` while another run is in progress. Progress arrives on `GET /api/events`.
- **The UI never computes and never decides.** Every number on the card comes from a saved run; the UI renders it and links it to its evidence record. The analyst's override of a recast resolution runs only through `POST /api/override` with a contract from `POST /api/approvals/sign`; the UI forwards the contract it was given and never builds, edits or signs one.
- **Replay without the model.** Every read endpoint works from the saved runs under the data directory; a server started without the gateway or Ollama still serves them (`/api/health` then reports `gateway_ok: false`).
- **Data directory.** All paths derive from `WON_DATA_DIR` (default `<repo>/data`): runs, evidence, H-MEM, World Model, DQ file, contract ledgers, `agent.lock`, `eval/report.json`.

## Read endpoints (GET)

| Path | Returns |
|---|---|
| `/api/health` | `{ ok, service: "weather-or-not-agent", model, gateway, gateway_ok, gateway_templates, gateway_error, runs, data_dir, busy_run_id, sse_listeners }`. `model` is the local Ollama model name; `gateway_templates` is the number of templates the gateway's `/health` lists (28); `gateway_error` is the message when the gateway did not answer. |
| `/api/runs` | `{ runs: RunIndexEntry[], busy_run_id }`, newest first. `RunIndexEntry` (`agent/src/ops/runStore.ts`): `run_id, cik, period, claim, utility, verdict, confidence, started_at, wall_ms, chunks, memo_source, source` (`cli` or `server`). |
| `/api/seeds` | `{ utilities: [{ cik, name, ticker, sic, hq_state, states_served, station_ids, flags, latest_run_id: { <period>: run_id } }] }`: the 43 seed utilities of `seeds/utilities.json` with the newest saved run per period. |
| `/api/run/:id` | `SavedRun` = `RunResult & { saved: { source, note?, at } }` (below). 400 `bad_id` for a malformed id, 404 `not_found`. |
| `/api/run/:id/memo.md` | the memo as markdown (`text/markdown`, `content-disposition: inline`): verdict, memo text, revenue with both accession numbers, weather, the attribution table with ranges, the DQ gate, every cited claim with its evidence ids, the Not-tested list, the recast conflicts, the gaps, then a citations table with every evidence record (kind, template or tool, Zetaris object, endpoint, retrieval time, latency, SQL sha256) and the licences of the sources read. |
| `/api/run/:id/evidence` | `{ run_id, records: EvidenceRecord[] }` (inline in `run.json`, else from `<data>/evidence/<run_id>.jsonl`). |
| `/api/run/:id/evidence/:eid` | one `EvidenceRecord`; 400 `bad_id`, 404 `not_found`. |
| `/api/why/:memId` | `{ memory_id, memory, provenance, ledger, conflicts, related, lines }` (`WhyTrace`, `agent/src/memory/hmemFacade.ts`): the H-MEM record, its latest provenance (with `history` of earlier retrievals, at most 5), its ledger entries (create, update, conflict_detected, conflict_resolved, with actor and time), the recast conflicts it is part of, `related { supersedes, supersededBy }` and the plain-text trace the CLI prints (`npm run cli -- why mem-62`). 400 `bad_id` (ids are `mem-N`), 404 `not_found`. |
| `/api/conflicts` | `{ conflicts: RecastConflict[] }`, every recast conflict on record. |
| `/api/world[?full=1]` | `{ entities: { <type>: count }, edges: { <relationship>: count }, events, nodes_total, edges_total }`; with `full=1` also `graph: { nodes, edges }`. |
| `/api/world/:cik` | `{ cik, neighbourhood: { utility, edges: [{ type, dir, other, otherType, otherName, attrs, validFrom }] }, timeline }`: the utility's open edges (`serves`, `peer_of`, `reported_in`, `classified_as`, ...) and the source-time ordered event lines of the utility and the filings and peers that touch it. 400 `bad_cik`, 404 `not_found`. |
| `/api/telemetry` | `{ model, runs, busy_run_id, run_id, cik, period, started_at, wall_ms, chunks, summary, telemetry, chart, skipped_steps }` of the newest saved run: `summary` is the run's `TelemetrySummary`, `telemetry` its model block, `chart` the per-chunk prompt tokens (measured against the estimated full-history baseline), `skipped_steps` the checklist items a warm run took from memory. Fields are `null` when no run is saved. |
| `/api/eval` | `{ file: "eval/report.json", updated_at, report }`: the measured evaluation report (`agent/src/eval/run.ts` writes it; the committed copy is [`docs/eval-report.json`](eval-report.json)). 404 `not_found` when no report exists; the UI then shows "Not yet measured". |
| `/api/eval/sweep` | `{ file: "docs/eval/seeds-cy2025q1.json", committed: true, sweep }`: the committed sweep of every eligible seed utility for CY2025Q1 (41 cold runs of 26 Oct), shown on the Evaluation screen above the report. Read-only; 404 `not_found` when the file is absent. |

### Run (`RunResult`, `agent/src/loop/investigate.ts`)

- `run_id`, `cik`, `period`, `previous_period`, `claim`, `started_at`, `finished_at`, `wall_ms`.
- `card` (`RunCard`): `question`; `utility { cik, name, ticker, sic, hq_state, states_served, stations, flags }`; `verdict { claim, verdict: supported | partly supported | not supported, ratio, confidence: high | medium | low, withheld_reason }`; `growth { tag, g, rev_current, rev_previous, current_accn, current_filed, previous_original_accn, previous_comparative_accn, recast, tag_switch_note }`; `weather { delta_w, tdd_current, tdd_previous, coverage, stations_used, stations_missing }`; `peers { count, by_tag, with_weather, excluded: [{ cik, reason }], list: [{ cik, name, tag, g, dw }] }`; `attribution` (`Attribution`, `agent/src/tools/attribution.ts`: `target, peers, beta, theil_sen, weather, industry, remainder, ranges { beta, weather, industry, remainder: { lo, hi } }, bootstrap { resamples, valid, skipped_zero_variance, seed }, coverage, confidence, claim { ratio, verdict }`); `dq { label, basis, ranAt, elapsedS, rule, run { total, valid, invalid }, invalidRows, invalidForTarget, targetCoverage, evidenceIds, note }`; `recast_conflicts: RecastConflict[]`; `not_tested: string[]`; `memo { text, source: model | template, words, attempts, attempts_detail }`; `claims: [{ text, evidenceIds }]` (every claim on the card with its evidence ids); `gaps: string[]`.
- `checklist: [{ id, status, note, evidenceIds }]` for the 11 items (`utility_resolved, tag_chosen, revenue_like_for_like, peers_loaded, weather_target, weather_peers, dq_checked, attribution_done, claim_tested, not_tested_listed, memo_written`), `checklist_complete`, `skipped_steps: [{ item, memoryId, note }]`.
- `timeline` (planner and tool entries per chunk), `markovian { run_id, status, error, chunk_config, chunks, engine_estimate }`, `chunks`, `planner_calls` (each with `valid`, `attempts`, `repair_think_off`, measured tokens and tokens per second), `tool_calls`, `chart: [{ chunk, markovian_prompt_tokens_measured, markovian_prompt_tokens_estimated, naive_prompt_tokens_estimated, carryover_tokens_estimated }]`.
- `summary` (`TelemetrySummary`, `agent/src/loop/telemetry.ts`): `planner_calls, planner_valid, planner_valid_first_try, planner_repaired, planner_repairs_think_off, fallback_steps, tool_calls, tool_calls_by_model, tool_failures, planner_prompt_tokens, planner_eval_tokens, tool_model_tokens_in, tool_model_tokens_out, naive_prompt_tokens_estimated, markovian_prompt_tokens_estimated, saving_vs_naive_estimated, max_carryover_tokens_estimated, median_planner_tokens_per_s, labels`.
- `telemetry { model, think, median_planner_tokens_per_s, memo_tokens_per_s, cloud_model_calls: 0, refused_model_hosts, refused_gateway_hosts, memory_context_chars }`.
- `memory { ids, facts_total, conflicts, skipped_steps }`, `world { events, entities, edges }`, `timings_ms`, `evidence_ids`, `evidence: EvidenceRecord[]`, `evidence_file`, `quality { e_cov, claims, e_complete, records, incomplete_records }`.

### EvidenceRecord (`agent/src/evidence/store.ts`)

`id` (`ev-<run id>-NN`), `run_id`, `kind` (`zetaris_sql`, `registrar`, `dq`, `tool`, `memory`, `world_model`, `model`), `claim`, `queried_at` (the retrieval time); for Zetaris records `template_id`, `params`, `sql`, `sql_sha256`, `zetaris_object` (the object the claim is about), `zetaris_objects`, `raw_objects`, `source_url` (the endpoint behind the object: the SEC URL or the S3 prefix), `licence`, `source_cached_at`, `sources [{ object, url, licence, cached_at }]`, `columns`, `rows` (at most 60), `row_count`, `elapsed_ms` (statement latency as the gateway measured it), `cache_state`; `dq_source` and `reused` on DQ records; `model { name, think, prompt_sha256, tokens_in, tokens_out, attempts, eval_ms, tokens_per_s, label: "measured" }` on model records; `derived_from` (the records a tool or model record was computed from); `details`.

The UI's evidence drawer labels `template_id` as the template, `source_url` as the endpoint, `elapsed_ms` as the latency and `queried_at` as retrieved.

### RecastConflict (`agent/src/memory/recastConflicts.ts`)

`id` (`rc-<12 hex>`), `kind: "recast_comparative"`, `cik`, `tag`, `period`, `scope: previous_period | current_period`, `own_filing_memory`, `later_filing_memory`, `own_filing { val, accn, filed, fy, fp, form }`, `later_filing { ... }`, `rule: "R1"`, `rule_text`, `chosen: own_filing | later_filing`, `chosen_val`, `status: resolved_by_rule | overridden`, `detected_at`, `run_id`, `evidence_ids`, `override? { by, chosen, reason, at, contract_id }`.

## Write endpoints (POST, JSON body)

| Path | Body | Reply |
|---|---|---|
| `/api/ask` | `{ cik \| utility, period, claim?, max_chunks?, think? }`. `cik` is up to 10 digits (padded); `utility` is a seed name, ticker or CIK (`findUtility` in `agent/src/seeds.ts`); `period` matches `CY\d{4}Q[1-3]`; `claim` defaults to "the weather" (at most 300 characters); `max_chunks` 1 to 10. | `202 { run_id, cik, period, claim, utility, started_at, state: "running" }`, then the run's events on `/api/events` and the saved run at `/api/run/:id`. `409 busy` while a run is in progress; 400 `unknown_utility`, `missing_field`, `bad_cik`, `bad_period`, `bad_field`. |
| `/api/approvals/sign` | `{ action: "override_recast", params: { conflict_id, chosen: "own_filing" \| "later_filing", reason } }` | `200 { contract, expires_at }`: a signed high-risk `ExecutionContract` for the local demo identity `analyst` (below). 400 `bad_action`, `bad_field`, `bad_params`, `contract`. |
| `/api/override` | `{ conflict_id, chosen, reason, contract }` | `200 { conflict, contract_id }` with the conflict now `status: "overridden"` and `override { by: "analyst", chosen, reason, at, contract_id }`; an `override` event is published. 403 `refused: <reason>` with the verifier's code (below); 404 `not_found` for an unknown conflict; 409 `not_applied`. |

### The contract flow for `override_recast`

1. The analyst picks the value to use (`own_filing` or `later_filing`) and writes a reason on the Memory and why screen.
2. The UI posts `/api/approvals/sign` with `action: "override_recast"` and the three parameters. The server validates them (`conflict_id` is `rc-<12 hex>`, `chosen` is one of the two sides, `reason` is not empty, nothing else is accepted) and issues an `ExecutionContract` (`agent/src/contract/scout.ts`): `contractId, traceId, intent { primary: "override_recast", parameters }, risk { level: "high", flags: ["analyst_override"], approvals: [{ analyst approval with the reason }] }, toolPlan, scope { user: "analyst", surface: the UI surface, capabilities }, issuedAt, expiresAt` (15 minutes), `policyPackVersion: "weather-or-not-scout-subset@1"`, `signature` (HMAC-SHA256 over the canonical JSON, keyed by `WON_CONTRACT_SECRET`), `signedBy: "scout"`.
3. The UI posts `/api/override` with the same three parameters and the contract, unchanged.
4. The server verifies the contract against the expected action and parameters. A refusal is a 403 with one of the verifier's codes: `missing`, `malformed`, `bad_signature`, `wrong_signer`, `wrong_policy_pack`, `not_yet_valid`, `expired`, `ttl_too_long`, `wrong_action`, `risk_mismatch`, `out_of_scope`, `parameter_mismatch`, `approval_missing`, `replayed` (a contract is single-use). Every verification, accepted or refused, is appended to `<data>/contracts/verifier-server.jsonl`; a refused request writes nothing else.
5. On success the server calls `recasts.override(conflict_id, { chosen, reason, by: "analyst", contractId })`, the only write path for an override: the conflict's `status` becomes `overridden`, its `chosen_val` the chosen side's value, and the H-MEM ledger gets a `conflict_resolved` entry with actor `analyst`. The contract is consumed (`<data>/contracts/used-server.jsonl`) and an `override` event is published.
6. **Re-run with the override.** The override changes the record, not the saved run. The UI offers "Re-run with the override": a new `POST /api/ask` for the same utility and period. In that run `get_revenue` uses the overridden conflict's `chosen_val` instead of rule R1's value, recomputes the like-for-like growth, and records an evidence record (`details.tool: "override_recast"`) that names the contract id, the analyst's reason, rule R1's value and both growth figures; the new card carries the conflict with its `override` block.

The identity is a local demo identity: any process on this machine that names the server as `Host` and sends no foreign `Origin` can sign. A real deployment puts single sign-on in front of the two write endpoints.

## Server-sent events (`GET /api/events`)

One `EventSource('/api/events')` per page. Each event has an `id`, a `type` (the SSE event name) and a JSON `data` object that always includes `at`. A new connection receives only events from then on (`retry: 3000` first). On reconnect the browser sends `Last-Event-ID` and the server replays the events after it that it still holds (the last 500); `?since=<id>` does the same on a fresh connection.

| Event | Data (main fields) |
|---|---|
| `run_started` | `run_id, cik, period, claim, utility, max_chunks, think, started_at` |
| `chunk_start` | `run_id, chunk, carryover_tokens` (the carried state the chunk starts from, estimated) |
| `planner` | `run_id, chunk, call, valid, attempts, tool, thought, prompt_tokens, eval_tokens, tokens_per_s` (tokens measured by Ollama). `thought` is the model's plan as written: the UI renders it as the plan, never as a fact. `attempts` is 2 when a repair round ran; whether the repair ran with think off is in the saved run's `planner_calls[].repair_think_off`, not in the event. |
| `tool` | `run_id, chunk, seq, tool, source` (`model` or `fallback`), `fallback_reason, ok, fact, evidence_ids, latency_ms`. The `get_weather` tool runs two `weather_quarter` statements of about 18 to 24 s each; the `planner` event that chose it arrives first, so the UI shows "Computing degree days in Lightning SQL" until the `tool` event lands. |
| `chunk_end` | `run_id, chunk, state_tokens, complete` |
| `run_finished` | `run_id, cik, period, claim, utility, verdict, confidence, wall_ms, chunks, checklist_complete, memo_source, memo_words, g, weather, industry, remainder, ratio, recast_conflicts, skipped_steps, evidence_records, memory_ids` (and `announced_run_id` if the saved id differs from the announced one) |
| `run_failed` | `run_id, cik, period, claim, error` |
| `override` | `run_id, conflict_id, cik, tag, period, chosen, chosen_val, status, reason, by, contract_id, overridden_at` |

## Static files

`GET /` serves `ui/index.html`; other paths serve files under `ui/` only (parent segments, drive or scheme separators, backslashes and network paths are refused with 403 `forbidden`; a bad percent-encoding is 400 `bad_path`). Nothing outside `ui/` is ever served.
