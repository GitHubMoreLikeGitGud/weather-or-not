# Meterless conformance results

Run on 24 Oct 2026 against the engines vendored in `engines/` (upstream `Meterless/Meterless` commit `1742dec56a66e58eef9dda2d2b865823758ca8cd`, see [`engines/UPSTREAM.md`](../engines/UPSTREAM.md)). Windows 11, Node v22.13.1, Python 3.12.0. Each engine was installed with `npm install` in its `reference/` folder, then run exactly as its conformance README says. The lock files that `npm install` rewrites were restored afterwards with `git checkout -- engines`; `git status --short engines` was empty at the end.

## Summary

| Check | Command (working directory) | Result | Exit code |
|---|---|---|---|
| H-MEM conformance, vendored reference | `npx tsx ../conformance/runner.ts` (`engines/hmem/reference`) | **13/13 checks passed** | 0 |
| Markovian conformance, vendored reference | `npx tsx ../conformance/runner.ts` (`engines/markovian/reference`) | **8/8 checks passed** | 0 |
| World Model conformance, vendored reference | `npx tsx ../conformance/runner.ts` (`engines/world-model/reference`) | **8/8 checks passed** | 0 |
| World Model idempotency check | `npx tsx scripts/idempotency-check.ts` (`engines/world-model/reference`) | **diff: empty** | 0 |
| **H-MEM conformance, Weather-or-Not facade** | `HMEM_IMPL=<repo>/agent/src/memory/hmemFacade.ts npx tsx ../engines/hmem/conformance/runner.ts` (`agent`) | **13/13 checks passed**; the runner prints `implementation = .../agent/src/memory/hmemFacade.ts` | 0 |

`git diff -- engines/` is empty: the facade subclasses the reference class from `agent/src/` and changes nothing under `engines/`.

## Details

### H-MEM (13 checks)

| Group | Checks |
|---|---|
| record-validation | rv-001, rv-002 |
| feedback-deltas | fd-001 to fd-005 |
| ranking-order | ro-001, ro-002 |
| sleep-guardrails | sg-001 |
| conflict-gate | cg-001 |
| ledger-audit | la-001 |
| dream-boundary | db-001 |

All PASS, on the reference and on the facade.

### Markovian (8 checks)

```
PASS eff-001 efficiency model reproduces the documented worked example: N=20 -> 86% (within 0.5%)
PASS snap-001 run records carry a mandatory chunkConfig snapshot
PASS snap-002 historical efficiency is computed against the run's own snapshot, not current config
PASS ovl-001 overlap contract: implement [OVERLAP] or reject non-zero; accept-and-ignore fails
PASS lab-001 token numbers are labeled: runs carry estimated or measured
PASS ref-001 reflection failure does not fail the run
PASS mrk-001 markers are cleaned from display content and drive completion
PASS cfg-001 config bounds reject out-of-range values with a typed error, never silent truncation
8/8 checks passed
```

### World Model (8 checks)

```
PASS sid-001 stable ids: diacritics and NBSP normalize identically (NFKD + strip marks)
PASS sid-002 stable ids: distinct names stay distinct (no over-normalization)
PASS band-001 merge bands at the boundaries: 0.85 auto, 0.84 review, 0.82 review, 0.81 new
PASS prov-001 writes without provenance are rejected
PASS idem-001 ingest idempotency: same batch twice produces an empty diff
PASS idem-002 the idempotency check can fail: a mutated batch changes the shape
PASS bitemp-001 bitemporal edges: a superseding edge closes the old one; point-in-time queries respect validity
PASS audit-001 every mutation writes an audit entry in order
8/8 checks passed
```

Idempotency check output:

```
run 1: processed=3 clusters=1 changed=true
run 2: processed=0 skipped=3 changed=false
diff: empty
```

## What the Weather-or-Not code adds to each engine, and how the contract is kept

| Engine | Where | Addition | Contract kept |
|---|---|---|---|
| H-MEM | `agent/src/memory/hmemFacade.ts`, `recastConflicts.ts`, `seed.ts` | `addFact()` writes facts with Zetaris provenance (`zetaris_object`, SQL sha256, endpoint, accession number, filing date, licence, retrieval time, latency, cache state, evidence id), deduplicated per fact key: a re-run reconfirms the fact and refreshes its provenance (latest retrieval wins, earlier ones kept in a history of at most 5). `recast_comparative` conflicts hold both memories and both accession numbers, are resolved by rule R1 and can be overridden by the analyst under a signed contract (`recasts.override` is the only write path). `tag_choice` and `station_choice` facts persist across runs, so a warm run skips the probe step. `why(memoryId)` returns the memory, its provenance, its ledger history and its conflicts. Source notes are seeded at boot from the Zetaris getting-started manifest and its `known_to_fail` notes. | Every write goes through the reference store and ledger, so every write has a ledger entry; `add`, `query` and `feedback` are not overridden; the loser of a conflict is marked `supersededBy`, nothing is deleted. The engine's own runner loads the facade through `HMEM_IMPL` and passes 13/13. |
| Markovian | `agent/src/loop/investigate.ts`, `generator.ts`, `tools.ts`, `checklist.ts`, `telemetry.ts` | One question is one chain: `chunkSize` 3000, `maxChunks` 10, `carryoverTokens` 800, `overlapTokens` 0. The generator asks Nemotron for the next tool, runs it through the host's `NEEDS_TOOL` executor (ten tools), digests the result and plans again, at most two tool calls per chunk. A checklist of 11 items decides completion; an invalid planner reply gets one repair round, a second failure makes the host take the next checklist step itself and labels it `fallback`. Token numbers are labelled `measured` (Ollama counts) or `estimated` (chars/4). | The vendored orchestrator runs unchanged; the generator is the engine's own extension point. Live: carried state at most 284 to 387 tokens (estimated) against the 800 budget over the four clean runs ([`docs/nemotron-bench.md`](nemotron-bench.md)). |
| World Model | `agent/src/world/world.ts` | Entities utility, state, station, SIC, filing and quarter; relationships `serves` (valid from the annual report's description), `represented_by`, `peer_of` (per period, with g, dw and the peer's tag), `reported_in` (per tag, period and accession number; valid from the filing date), `recasts`, `classified_as`, `observed_in` (station to quarter with the degree days). Every write's `at` is the source record's own date, never the retrieval time. | The reference's idempotency property holds on live rows: the warm runs re-ingested the same frames facts and appended 0 events (769 before and after, see [`docs/nemotron-bench.md`](nemotron-bench.md)). Multi-valued relations carry a per-target context so the reference's single-valued close rule does not retire them. |
| Scout Intent | `agent/src/contract/` | A partial reimplementation (no reference engine is vendored, and it is labelled as such): risk classes and HMAC-signed, single-use execution contracts that expire within 15 minutes. Medium risk for the gateway's registrar plans (verified by the Python gateway, `gateway/contracts.py`, with a shared test vector); high risk for `override_recast` with an analyst approval and a reason (verified by the agent server). | An integrity check, as Scout's own documentation says, not cryptographic-grade security. |
