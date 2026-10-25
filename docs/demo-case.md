# The demo case: FirstEnergy, CY2025Q1 against CY2024Q1

Every number on this page is read from a saved run of the agent (`data/runs/<id>/run.json`, the same files behind [`docs/eval-report.md`](eval-report.md)) or from the Zetaris record in [`zetaris/README.md`](../zetaris/README.md). Nothing is typed from memory. The run quoted is the clean cold run `r20261024T213805fb4e` of 24 Oct 2026 (21:38 SGT); four other runs of the same question produced the same card to the printed digit. Captures of the real UI for this case are the deck's images: the answer card [`docs/deck/img/card-fe.png`](deck/img/card-fe.png) and its revenue and weather panels [`card-fe-revenue-weather.png`](deck/img/card-fe-revenue-weather.png), the live timeline [`timeline.png`](deck/img/timeline.png) with the degree-day step [`timeline-weather.png`](deck/img/timeline-weather.png), the evidence drawer with the SQL [`drawer-sql.png`](deck/img/drawer-sql.png), the AEP conflict on the memory screen [`memory-conflict.png`](deck/img/memory-conflict.png) and the AEP card [`card-aep-dark.png`](deck/img/card-aep-dark.png), the graph [`graph.png`](deck/img/graph.png), the evaluation tables [`eval.png`](deck/img/eval.png), [`eval-joinmap.png`](deck/img/eval-joinmap.png), [`eval-totals.png`](deck/img/eval-totals.png) and the telemetry footer [`telemetry-footer.png`](deck/img/telemetry-footer.png).

## The question

> FIRSTENERGY CORP's CY2025Q1 revenue changed year on year (CY2024Q1 to CY2025Q1) and management credits "colder weather". How much of the change is weather?

FirstEnergy (CIK 0001031296, ticker FE, SIC 4911, headquartered in Ohio) serves customers in Ohio, Pennsylvania, New Jersey, West Virginia and Maryland (the seed file's curated reading of its service territory). Nine first-order airport stations stand for those five states.

## The answer card

**Verdict sentence (as the UI prints it):** FIRSTENERGY CORP's revenue rose +14.5% year on year; weather is consistent with +8.2% of that (range +1.6% to +14.0%), so the claim "colder weather" is supported with high confidence.

| Step | What the agent found | Evidence |
|---|---|---|
| Revenue, like for like | `Revenues` 3,765,000,000 in the quarter's own 10-Q (accession 0001031296-25-000017, filed 2025-04-30) against 3,287,000,000 as that same filing reports the comparative quarter (the original fy2024 filing 0001031296-24-000026 reported the same value, so no recast). Growth **+14.54%**. | `concept_window` over `won.concept_0001031296_Revenues`, 19 rows, 177 ms, cache hit |
| Weather | Total degree days (heating plus cooling) over the 9 stations: 2,163.95 in 2024 Q1, 2,514.29 in 2025 Q1, **+16.19%**; coverage **1.000** (every station reported every day of both quarters). | two `weather_quarter` statements in Lightning SQL over `won.ghcn_2025_tmax` / `tmin` and `won.ghcn_2024_tmax` / `tmin`, 56 stations each (the target's and every peer's), 20.0 s and 21.0 s |
| Peers | **39** of the 43 seed utilities: 32 under `Revenues`, 3 under `RevenueFromContractWithCustomerExcludingAssessedTax`, 4 under `RegulatedAndUnregulatedOperatingRevenue`. Excluded with reasons: IDACORP (no CY2025Q1 fact under any of the three tags), MGE Energy (SIC 4900, not in 4911 / 4931 / 4932), Oncor (no CY2024Q1 fact under its tag). | six `frames_seeds` calls (one per tag and period), 164 to 216 ms each, cache hit |
| Sensitivity | OLS slope of peer revenue growth on peer degree-day change: beta **0.5065** (range 0.1012 to 0.8639); Theil-Sen cross-check 0.3057. | deterministic tool, 300 of 300 bootstrap resamples valid, seed 7, ranges at the 10th and 90th percentiles |
| Split | Weather **+8.20%** (range +1.64% to +13.99%); industry-wide **+2.87%** (range -1.81% to +8.72%); company-specific remainder **+3.48%** (range -8.16% to +14.72%). | the attribution record, derived from the revenue, peers and weather records |
| Claim | ratio of the weather part to the whole change 0.564; **supported** (at least 0.5 with the same sign); confidence **high** (39 peers, coverage 1.0, the slope interval excludes zero). | |
| DQ gate | **pass**: the `coverage_ok` rule's onboarding run (2026-10-24 19:31 SGT, 342 station-quarters, 0 invalid, 739.3 s in all) names none of the utility's stations, and the utility's own station coverage is 1.0000 against the rule's 0.9. | `data/dq/latest.json` plus the coverage column of the weather result |

The run took 97.5 s: 5 Markovian chunks, 9 planner calls (9 valid on the first reply, 0 repaired, 0 fallback steps), 9 tool calls all chosen by the model, median planner speed 140.4 tokens/s, cloud model calls 0. It produced 20 evidence records (11 Lightning SQL, 2 DQ, 6 tool, 1 model); every one of the 19 claims on the card cites a record (E-cov 1.00) and every record carries every required field (E-complete 1.00).

**The memo**, written by the model on its first draft, 184 words, every number matched against a tool output (quoted as saved; the UI joins the model's hyphen-space artefacts at render time):

> Revenue under Revenues rose from 3,287.0 million to 3,765.0 million, a like-for-like change of +14.5% (the current quarter from its own filing, the previous quarter as that filing restates it). Heating plus cooling degree days over the utility's 9 stations in 5 states moved from 2,164 to 2,514, a change of +16.2%, with station coverage 1.00. Across 39 peer utilities the sensitivity of revenue growth to the degree- day change is 0.51 (Theil-Sen 0.31), bootstrap range [0.10, 0.86] from 300 resamples at the 10th and 90th percentiles. The weather part is +8.2% [+1.6%, +14.0%], the industry- wide part +2.9% [-1.8%, +8.7%] and the company- specific remainder +3.5% [-8.2%, +14.7%]. Claim verdict: supported; confidence high. DQ gate: pass (the coverage_ok rule names none of the utility's stations and its own coverage meets the rule). The analysis did not test Fuel- cost pass- through inside revenue, Rate cases, Data- centre and other large- load growth, Mergers, acquisitions and divestitures, The fourth quarter and full- year periods, Weather normals, Service territories simplified, GHCN quality flags. The confidence label is high and the DQ gate result is pass.

## What the filing itself says

The agent does not read the MD&A; it reads XBRL facts and temperatures. The author checked the Q1 2025 10-Q (accession 0001031296-25-000017) by hand: its MD&A reports heating degree days for the quarter as "15% above the same period of 2024" and credits higher customer usage to colder temperatures. The agent's station-based total degree days rose +16.2%, next to the company's own +15%, and the weather part of +8.2% (range +1.6% to +14.0%) is consistent with the claim. The same filing names base rate cases in three of the utility's states, which is where the positive company-specific remainder (+3.5%) points; rate cases are on the Not-tested list, so the agent does not claim them.

## What a naive year-on-year read would have done

A naive read takes the two quarters from the XBRL frames endpoint, which serves the most recently filed fact for each quarter. For FirstEnergy that happens to give the same numbers (the 2026 10-Q repeats 3,765,000,000 for CY2025Q1 and the 2025 10-Q repeats 3,287,000,000 for CY2024Q1), so the naive read is right here, by luck, and cannot know that it is. The agent reads the quarter's own filing through companyconcept, compares every filing's value for both quarters, and puts both accession numbers on the card with the line "No recast: the comparative equals the original".

The second demo utility shows the trap live. American Electric Power (CIK 0000004904), same quarter, run `r20261024T214009cd85`:

- Its own 10-Q (0000004904-25-000061, filed 2025-05-06) reports `Revenues` of **5,463,400,000** for CY2025Q1. The next year's 10-Q (0000004904-26-000034, filed 2026-05-05) restates the same quarter as **5,463,000,000**, and that restated value is what the frames endpoint serves today.
- The agent records a `recast_comparative` conflict, `rc-4cd5f8bdf0bd`, with both memories (mem-62 for the own filing, mem-65 for the later filing), both accession numbers and both filing dates, and resolves it by rule R1: use the current quarter's value as reported in its own fy2025 filing; a later restatement is recorded, not applied. Like-for-like growth is **+8.71%** (5,463.4 against 5,025.7 million); a naive read gives +8.70%.
- The rest of the card: degree days +16.86% over 9 stations in 6 states, coverage 0.9889 (one station lost one day); 39 peers; beta 0.5287 (range 0.0746 to 0.8772); weather +8.92% (range +1.26% to +14.79%), industry +3.47% (range -1.64% to +9.02%), remainder -3.68% (range -15.10% to +9.09%); ratio 1.024, so the weather part is consistent with the whole change and the card words it that way; supported, high; DQ pass. 114.9 s, 5 chunks, 9 planner calls (7 valid first try, 2 repaired, 1 of them with think off). Memo by the model, 176 words, first draft.
- `npm run cli -- why mem-62` prints the fact, its provenance (`won.concept_0000004904_Revenues`, the SQL sha256, the companyconcept endpoint, the filing, the retrieval time and latency, the earlier retrieval kept in the history), the evidence ids, the conflict with both values and the rule, and the ledger: create, conflict_detected, update.

**The analyst override.** On the Memory and why screen the analyst can choose the later filing's value with a reason. The UI signs a high-risk `override_recast` contract (`POST /api/approvals/sign`), posts it with the choice (`POST /api/override`), and the conflict's status becomes `overridden` with the analyst's reason and the contract id; the H-MEM ledger records `conflict_resolved` by the analyst. "Re-run with the override" asks the question again: `get_revenue` uses 5,463,000,000 instead of rule R1's 5,463,400,000, recomputes the growth (+8.70%), and writes an evidence record naming the override, the contract and both values; the attribution is unchanged to the printed digit because 0.4 million on 5,463 million does not move it. A second use of the same contract is refused (`replayed`); a request without a contract is refused (`missing`) and logged, and nothing is written. The exact routes and the refusal codes are in [`docs/api.md`](api.md).

## The same question for four other utilities

FirstEnergy and AEP both came out "supported". To see whether the method ever says something else, the same question (CY2025Q1 against CY2024Q1, claim "the weather", the default, because these four filings were not read by hand) was asked once through the agent on 25 Oct 2026 for each of the four other seed utilities whose companyconcept views were registered at onboarding. Every result is listed; the full tables are in [`eval-report.md`](eval-report.md) section 8 and the per-run summary in [`eval/contrast-cy2025q1.json`](eval/contrast-cy2025q1.json).

| Utility | Run | Revenue, like for like | Degree days | Weather (range) | Industry | Remainder | Verdict |
|---|---|---|---|---|---|---|---|
| Southern Co | `r20261025T115028c6c5` | +17.0% | +12.9% | +6.6% (+0.9% to +11.3%) | +2.8% | +7.6% | **partly supported** (ratio 0.39), high |
| Duke Energy | `r20261025T11524841a9` | +7.5% | +16.5% | +8.7% (+1.2% to +14.8%) | +3.4% | -4.7% | supported (1.16), high |
| Xcel Energy | `r20261025T11542503bf` | +7.0% | +13.1% | +6.8% (+0.9% to +11.4%) | +3.6% | -3.4% | supported (0.97), high |
| Entergy | `r20261025T1155534448` | +1.9% | +18.0% | +10.2% (+2.1% to +16.7%) | +2.9% | -11.3% | supported (5.46), high |

On Southern Co the agent's answer to "was it the weather?" is "partly": weather accounts for roughly 6.6 of the 17.0 points, and the company-specific remainder is larger than the weather part. Entergy is the opposite problem: the weather part is 5.5 times the whole change, so the card's "supported" means weather alone would have lifted revenue far more than it rose and something else pulled it down by about as much; the rule has no upper bound (README, Limitations). The confidence label is high on all four for the reason it is high on FirstEnergy (the peer slope's range stays above zero), and every weather range is about as wide: 0.9 to 2.1 points at its low end, 11.3 to 16.7 at its high end.

## Not tested

The card lists what the method cannot see, and the memo repeats it:

1. Fuel-cost pass-through inside revenue: a fuel or purchased-power clause moves revenue without moving margin, and revenue is the only series read.
2. Rate cases: approved base-rate changes between the two quarters are not read from the filings.
3. Data-centre and other large-load growth: customer mix and volume changes beyond weather are not separated from the remainder.
4. Mergers, acquisitions and divestitures: changes to the reporting entity between the quarters are not detected.
5. The fourth quarter and full-year periods: the frames API has no three-month fourth-quarter frame, so only the first three quarters are compared.
6. Weather normals: the comparison is year on year, not against a ten-year normal.
7. Service territories simplified: states served are capped at six per utility (the largest systems serve more) and come from a curated reading of the annual report's service-territory text; one or two airport stations stand for each state.
8. GHCN quality flags: a day with a non-empty quality flag on either temperature element is dropped rather than corrected; coverage reports how many days remain.

## Reproducing it

With the full stack running ([README, Quickstart B](../README.md#b-full-stack-zetaris-gateway-agent-and-ui)):

```bash
cd agent
npm run ask -- --cik 0001031296 --period CY2025Q1 --claim "colder weather"
npm run ask -- --cik 0000004904 --period CY2025Q1 --claim "colder weather"
npm run cli -- why mem-62
```

Temperature 0 and seed 7 make the chain reproducible when the tool outputs are the same: the five FirstEnergy runs of 24 Oct 2026 share one card, and two of them share the memo text byte for byte. The second run of a utility is a warm run: the remembered revenue tag skips the probe step (4 chunks instead of 5).
