# Weather-or-Not evaluation report

Generated 2026-10-24T13:57:08.662Z. Every number below is measured and read from a file: the saved runs under data/runs, the DQ onboarding file (data/dq/latest.json) and the join-map measurements (data/eval/joinmap.json, one-off Lightning SQL statements under the reader allowlist). Nothing is typed by hand; "not measured" marks what the files do not hold.

## Runs used

| Run | Utility | CIK | Period | Claim | Started | Source |
| --- | --- | --- | --- | --- | --- | --- |
| r20261024T203050a220 | FIRSTENERGY CORP | 0001031296 | CY2025Q1 | colder weather | 2026-10-24T12:30:50.151Z | saved copy 1 |
| r20261024T2034350adc | AMERICAN ELECTRIC POWER CO INC | 0000004904 | CY2025Q1 | favorable weather | 2026-10-24T12:34:35.825Z | saved copy 1 |
| r20261024T203648826a | AMERICAN ELECTRIC POWER CO INC | 0000004904 | CY2025Q1 | favorable weather | 2026-10-24T12:36:48.574Z | saved copy 1 |
| r20261024T20391416bf | FIRSTENERGY CORP | 0001031296 | CY2025Q1 | colder weather | 2026-10-24T12:39:14.725Z | saved copy 1 |
| r20261024T204637522f | FIRSTENERGY CORP | 0001031296 | CY2025Q1 | colder weather | 2026-10-24T12:46:37.596Z | saved copy 1 |
| r20261024T213805fb4e | FIRSTENERGY CORP | 0001031296 | CY2025Q1 | colder weather | 2026-10-24T13:38:05.321Z | data/runs |
| r20261024T214009cd85 | AMERICAN ELECTRIC POWER CO INC | 0000004904 | CY2025Q1 | colder weather | 2026-10-24T13:40:09.051Z | data/runs |
| r20261024T214205a2e5 | FIRSTENERGY CORP | 0001031296 | CY2025Q1 | colder weather | 2026-10-24T13:42:05.445Z | data/runs |
| r20261024T2145294e73 | AMERICAN ELECTRIC POWER CO INC | 0000004904 | CY2025Q1 | colder weather | 2026-10-24T13:45:29.637Z | data/runs |

Seeds: 43 utilities, 56 stations. DQ file present; join-map file present.

## 1. Join map (Lightning SQL over the seed objects)

Measured 2026-10-24T21:30:45+0800; bound 60 s per statement; 17 statements in 97.6 s wall; login admin under the reader allowlist.

### 1a. Frames `cik` (LPAD to 10 digits) against the seeds' submission views

| Tag | Period | Seeds | LPAD join matched | Integer IN count (frames_seeds) | Agree | Statement ms |
| --- | --- | --- | --- | --- | --- | --- |
| Revenues | CY2025Q1 | 43 | 34 | 34 | yes | 6,271 |
| Revenues | CY2024Q1 | 43 | 35 | 35 | yes | 6,331 |
| RFC | CY2025Q1 | 43 | 21 | 21 | yes | 6,165 |
| RFC | CY2024Q1 | 43 | 23 | 23 | yes | 6,219 |
| RUOR | CY2025Q1 | 43 | 9 | 9 | yes | 6,155 |
| RUOR | CY2024Q1 | 43 | 11 | 11 | yes | 6,340 |

Control without LPAD (integer string against the zero-padded cik): 0 matched (6,281 ms).

| Period | Seeds with a fact under any of the three tags | Seeds | Statement ms |
| --- | --- | --- | --- |
| CY2025Q1 | 42 | 43 | 508 |
| CY2024Q1 | 43 | 43 | 416 |

### 1b. Frames `loc` (US-XX) against the business-address state of the submission view

| Tag | Period | Seeds present | Equal | Different | Missing |
| --- | --- | --- | --- | --- | --- |
| Revenues | CY2025Q1 | 34 | 34 | 0 | 0 |
| Revenues | CY2024Q1 | 35 | 35 | 0 | 0 |
| RFC | CY2025Q1 | 21 | 21 | 0 | 0 |
| RFC | CY2024Q1 | 23 | 23 | 0 | 0 |
| RUOR | CY2025Q1 | 9 | 9 | 0 | 0 |
| RUOR | CY2024Q1 | 11 | 11 | 0 | 0 |

No differing or missing `loc` rows were listed (the listing statement runs only where a count says there are any).

### 1c. Station to state (USL station table against seeds/stations.json)

57 USL rows in 44,736 ms; 56 of 56 seed stations present, 56 with the same state, 0 with a different state, 0 missing; 1 USL station(s) not in the seed file (USW00013740).

### 1d. SIC foreign key (submissions `sic` against the company_dns SIC list)

Plain SQL (LEFT JOIN won.sic_codes, 6,834 ms): 42 of 43 seeds join; orphan(s): MGE ENERGY INC (CIK 0001161728, SIC 4900).

Recorded (not re-run; zetaris/README.md, SEC-side verification and DQ (Day 1 onboarding record)): `RUN DQ sic TABLE lightning.metastore.weatherornot.weather_or_not_usl.utility` -> Foreign Key Constraint 43 total / 42 valid / 1 invalid in 79.1 s; `SHOW DQ INVALID RECORD sic TABLE lightning.metastore.weatherornot.weather_or_not_usl.utility` -> MGE ENERGY INC (CIK 0001161728, SIC 4900, WI) in 93.3 s. SIC 4900 has no row in the company_dns V4 list; MGE Energy is a target-only seed (never a peer).

## 2. Peers per tag and exclusions

From run r20261024T214205a2e5 (FIRSTENERGY CORP, CY2025Q1): 39 peers, 39 with weather; the peer set is identical across the 5 run(s) of this utility.

| Tag | Peers |
| --- | --- |
| RUOR | 4 |
| Revenues | 32 |
| RFC | 3 |

| Excluded CIK | Reason (from the card) |
| --- | --- |
| 0001057877 | IDACORP INC: excluded: current period missing (no fact under any of the three tags) |
| 0001161728 | MGE ENERGY INC: excluded: SIC 4900 not in 4911, 4931, 4932 (tag RegulatedAndUnregulatedOperatingRevenue) |
| 0001193311 | ONCOR ELECTRIC DELIVERY CO LLC: excluded: previous period missing (tag Revenues) |

## 3. Weather coverage per utility

From the weather_quarter evidence rows of run r20261024T2145294e73 (CY2025Q1: 56 stations; CY2024Q1: 56 stations). Utility coverage is the minimum over its stations, then the minimum of the two periods. 43 of 43 utilities have every station in the rows; lowest utility coverage 0.9556; 0 below 0.9.

| CIK | Utility | Stations | CY2025Q1 | CY2024Q1 | Min |
| --- | --- | --- | --- | --- | --- |
| 0001326160 | Duke Energy CORP | 9 | 0.9889 | 1.0000 | 0.9889 |
| 0000092122 | SOUTHERN CO | 3 | 1.0000 | 1.0000 | 1.0000 |
| 0000753308 | NEXTERA ENERGY INC | 2 | 1.0000 | 1.0000 | 1.0000 |
| 0000004904 | AMERICAN ELECTRIC POWER CO INC | 9 | 0.9889 | 1.0000 | 0.9889 |
| 0000072903 | XCEL ENERGY INC | 9 | 1.0000 | 1.0000 | 1.0000 |
| 0000065984 | ENTERGY CORP /DE/ | 5 | 1.0000 | 1.0000 | 1.0000 |
| 0001711269 | Evergy, Inc. | 2 | 1.0000 | 1.0000 | 1.0000 |
| 0001002910 | AMEREN CORP | 3 | 1.0000 | 1.0000 | 1.0000 |
| 0000811156 | CMS ENERGY CORP | 2 | 0.9556 | 1.0000 | 0.9556 |
| 0000936340 | DTE ENERGY CO | 2 | 0.9556 | 1.0000 | 0.9556 |
| 0000783325 | WEC ENERGY GROUP, INC. | 4 | 0.9556 | 1.0000 | 0.9556 |
| 0000352541 | ALLIANT ENERGY CORP | 3 | 1.0000 | 1.0000 | 1.0000 |
| 0000922224 | PPL Corp | 4 | 1.0000 | 1.0000 | 1.0000 |
| 0001031296 | FIRSTENERGY CORP | 9 | 1.0000 | 1.0000 | 1.0000 |
| 0000788784 | PUBLIC SERVICE ENTERPRISE GROUP INC | 2 | 1.0000 | 1.0000 | 1.0000 |
| 0001047862 | CONSOLIDATED EDISON INC | 1 | 1.0000 | 1.0000 | 1.0000 |
| 0000072741 | EVERSOURCE ENERGY | 3 | 1.0000 | 1.0000 | 1.0000 |
| 0001109357 | EXELON CORP | 9 | 1.0000 | 1.0000 | 1.0000 |
| 0000827052 | EDISON INTERNATIONAL | 2 | 1.0000 | 1.0000 | 1.0000 |
| 0001004980 | PG&E Corp | 2 | 1.0000 | 1.0000 | 1.0000 |
| 0001032208 | SEMPRA | 2 | 1.0000 | 1.0000 | 1.0000 |
| 0000764622 | PINNACLE WEST CAPITAL CORP | 1 | 1.0000 | 1.0000 | 1.0000 |
| 0000784977 | PORTLAND GENERAL ELECTRIC CO /OR/ | 1 | 1.0000 | 1.0000 | 1.0000 |
| 0001057877 | IDACORP INC | 1 | 1.0000 | 1.0000 | 1.0000 |
| 0001993004 | NorthWestern Energy Group, Inc. | 3 | 1.0000 | 1.0000 | 1.0000 |
| 0001130464 | BLACK HILLS CORP /SD/ | 4 | 1.0000 | 1.0000 | 1.0000 |
| 0000104918 | AVISTA CORP | 2 | 1.0000 | 1.0000 | 1.0000 |
| 0001021635 | OGE ENERGY CORP. | 1 | 1.0000 | 1.0000 | 1.0000 |
| 0001130310 | CENTERPOINT ENERGY INC | 4 | 0.9889 | 1.0000 | 0.9889 |
| 0001692819 | Vistra Corp. | 8 | 1.0000 | 1.0000 | 1.0000 |
| 0001013871 | NRG ENERGY, INC. | 2 | 1.0000 | 1.0000 | 1.0000 |
| 0000354707 | HAWAIIAN ELECTRIC INDUSTRIES INC | 1 | 1.0000 | 1.0000 | 1.0000 |
| 0000066756 | ALLETE INC | 4 | 1.0000 | 1.0000 | 1.0000 |
| 0001466593 | Otter Tail Corp | 5 | 1.0000 | 1.0000 | 1.0000 |
| 0001161728 | MGE ENERGY INC | 2 | 1.0000 | 1.0000 | 1.0000 |
| 0000755001 | UNITIL CORP | 2 | 1.0000 | 1.0000 | 1.0000 |
| 0001108426 | TXNM ENERGY INC | 3 | 1.0000 | 1.0000 | 1.0000 |
| 0000715957 | DOMINION ENERGY, INC | 3 | 1.0000 | 1.0000 | 1.0000 |
| 0001868275 | Constellation Energy Corp | 7 | 1.0000 | 1.0000 | 1.0000 |
| 0001111711 | NISOURCE INC. | 2 | 0.9889 | 1.0000 | 0.9889 |
| 0001193311 | ONCOR ELECTRIC DELIVERY CO LLC | 2 | 1.0000 | 1.0000 | 1.0000 |
| 0000100122 | TUCSON ELECTRIC POWER CO | 1 | 1.0000 | 1.0000 | 1.0000 |
| 0000096271 | TAMPA ELECTRIC CO | 2 | 1.0000 | 1.0000 | 1.0000 |

## 4. Attribution with bootstrap ranges

### AMERICAN ELECTRIC POWER CO INC (CIK 0000004904), run r20261024T2145294e73

| Quantity | Value |
| --- | --- |
| Revenue tag | Revenues |
| g (year on year) | +8.71% |
| Accession numbers | current 0000004904-25-000061; previous original 0000004904-24-000046; previous comparative 0000004904-25-000061; recast no |
| Degree-day change | +16.86% |
| Peers | 39 |
| beta [range] | 0.5287 [0.0746, 0.8772] |
| Theil-Sen slope | 0.4036 |
| Weather | +8.92% [+1.26%, +14.79%] |
| Industry | +3.47% [-1.64%, +9.02%] |
| Remainder | -3.68% [-15.10%, +9.09%] |
| Bootstrap | 300 of 300 resamples valid, 0 skipped (zero variance), seed 7 |
| Coverage | 0.9889 |
| Confidence | high |
| Claim ratio / verdict | 1.024 / supported |
| Recast conflicts on the card | 1 |
| Identical across runs | yes (4 run(s): r20261024T2034350adc, r20261024T203648826a, r20261024T214009cd85, r20261024T2145294e73) |

### FIRSTENERGY CORP (CIK 0001031296), run r20261024T214205a2e5

| Quantity | Value |
| --- | --- |
| Revenue tag | Revenues |
| g (year on year) | +14.54% |
| Accession numbers | current 0001031296-25-000017; previous original 0001031296-24-000026; previous comparative 0001031296-25-000017; recast no |
| Degree-day change | +16.19% |
| Peers | 39 |
| beta [range] | 0.5065 [0.1012, 0.8639] |
| Theil-Sen slope | 0.3057 |
| Weather | +8.20% [+1.64%, +13.99%] |
| Industry | +2.87% [-1.81%, +8.72%] |
| Remainder | +3.48% [-8.16%, +14.72%] |
| Bootstrap | 300 of 300 resamples valid, 0 skipped (zero variance), seed 7 |
| Coverage | 1.0000 |
| Confidence | high |
| Claim ratio / verdict | 0.564 / supported |
| Recast conflicts on the card | 0 |
| Identical across runs | yes (5 run(s): r20261024T203050a220, r20261024T20391416bf, r20261024T204637522f, r20261024T213805fb4e, r20261024T214205a2e5) |

## 5. Data quality

Rule `coverage_ok` on `lightning.metastore.weatherornot.weather_or_not_usl.weather_quarter`, run 2026-10-24T19:31:39+0800, 739.3 s in all, ok true; RUN DQ 342 total / 342 valid / 0 invalid in 557.2 s; 0 invalid station-quarter(s).

| Statement | Seconds | Rows | Error |
| --- | --- | --- | --- |
| dq_run_coverage | 557.2 | 1 |  |
| dq_invalid | 181.7 | 0 |  |

Utility FK rule (recorded at onboarding, see 1d): 43 / 42 / 1; the invalid row is MGE ENERGY INC (SIC 4900).

## 6. Per run

| Run | Utility | Mode | Chunks | Wall | Planner calls | Valid first try | Repaired | Repaired with think off | Fallbacks | Median tok/s | Memo | E-complete | E-cov | Skipped steps | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| r20261024T203050a220 | FIRSTENERGY CORP | cold | 5 | 84.1 s | 9 | 9 | 0 | not recorded | 0 | 140.7 | model, 135 words, 2 attempt(s) | 9/20 (11 unresolved object names) | 19/19 (1.000) | none | supported / high / DQ pass |
| r20261024T2034350adc | AMERICAN ELECTRIC POWER CO INC | cold | 5 | 99.7 s | 9 | 8 | 1 | not recorded | 0 | 140.6 | template, 243 words, 2 attempt(s) | 9/20 (11 unresolved object names) | 19/19 (1.000) | none | supported / high / DQ pass |
| r20261024T203648826a | AMERICAN ELECTRIC POWER CO INC | warm | 4 | 100.7 s | 8 | 7 | 1 | not recorded | 0 | 141.2 | template, 243 words, 2 attempt(s) | 20/20 | 19/19 (1.000) | tag_chosen (mem-61) | supported / high / DQ pass |
| r20261024T20391416bf | FIRSTENERGY CORP | warm | 4 | 105.5 s | 8 | 7 | 1 | not recorded | 0 | 140.2 | model, 184 words, 1 attempt(s) | 20/20 | 19/19 (1.000) | tag_chosen (mem-49) | supported / high / DQ pass |
| r20261024T204637522f | FIRSTENERGY CORP | warm | 4 | 133.2 s | 8 | 5 | 2 | not recorded | 1 | 139.5 | model, 184 words, 1 attempt(s) | 20/20 | 19/19 (1.000) | tag_chosen (mem-49) | supported / high / DQ pass |
| r20261024T213805fb4e | FIRSTENERGY CORP | cold | 5 | 97.5 s | 9 | 9 | 0 | 0 | 0 | 140.4 | model, 184 words, 1 attempt(s) | 20/20 | 19/19 (1.000) | none | supported / high / DQ pass |
| r20261024T214009cd85 | AMERICAN ELECTRIC POWER CO INC | cold | 5 | 114.9 s | 9 | 7 | 2 | 1 | 0 | 139.5 | model, 176 words, 1 attempt(s) | 20/20 | 19/19 (1.000) | none | supported / high / DQ pass |
| r20261024T214205a2e5 | FIRSTENERGY CORP | warm | 4 | 128.1 s | 8 | 6 | 2 | 2 | 0 | 139.2 | model, 184 words, 1 attempt(s) | 20/20 | 19/19 (1.000) | tag_chosen (mem-49) | supported / high / DQ pass |
| r20261024T2145294e73 | AMERICAN ELECTRIC POWER CO INC | warm | 4 | 112.7 s | 8 | 6 | 2 | 1 | 0 | 139.8 | model, 176 words, 1 attempt(s) | 20/20 | 19/19 (1.000) | tag_chosen (mem-61) | supported / high / DQ pass |

Memo drafts (word count, numbers not found in any tool output):

| Run | Draft | Words | Unknown numbers | Kept |
| --- | --- | --- | --- | --- |
| r20261024T203050a220 | 1 | 68 | 0 | no |
| r20261024T203050a220 | 2 | 135 | 0 | yes |
| r20261024T2034350adc | 1 | 95 | 0 | no |
| r20261024T2034350adc | 2 | 95 | 0 | no |
| r20261024T203648826a | 1 | 95 | 0 | no |
| r20261024T203648826a | 2 | 95 | 0 | no |
| r20261024T20391416bf | 1 | 184 | 0 | yes |
| r20261024T204637522f | 1 | 184 | 0 | yes |
| r20261024T213805fb4e | 1 | 184 | 0 | yes |
| r20261024T214009cd85 | 1 | 176 | 0 | yes |
| r20261024T214205a2e5 | 1 | 184 | 0 | yes |
| r20261024T2145294e73 | 1 | 176 | 0 | yes |

Degree-day statements and memo time per run:

| Run | weather_quarter current | weather_quarter previous | Memo | Model | Think | Cloud model calls | Refused hosts | Recast conflicts |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| r20261024T203050a220 | 18.2 s | 18.4 s | 3.2 s | nemotron-3-nano:4b | on | 0 | 0 | 0 |
| r20261024T2034350adc | 18.7 s | 18.6 s | 6.6 s | nemotron-3-nano:4b | on | 0 | 0 | 1 |
| r20261024T203648826a | 19.2 s | 18.3 s | 2.8 s | nemotron-3-nano:4b | on | 0 | 0 | 1 |
| r20261024T20391416bf | 18.5 s | 18.4 s | 2.7 s | nemotron-3-nano:4b | on | 0 | 0 | 0 |
| r20261024T204637522f | 18.4 s | 18.3 s | 2.7 s | nemotron-3-nano:4b | on | 0 | 0 | 0 |
| r20261024T213805fb4e | 20.0 s | 21.0 s | 2.8 s | nemotron-3-nano:4b | on | 0 | 0 | 0 |
| r20261024T214009cd85 | 18.3 s | 18.6 s | 2.8 s | nemotron-3-nano:4b | on | 0 | 0 | 1 |
| r20261024T214205a2e5 | 23.9 s | 18.8 s | 2.7 s | nemotron-3-nano:4b | on | 0 | 0 | 0 |
| r20261024T2145294e73 | 18.2 s | 18.6 s | 3.0 s | nemotron-3-nano:4b | on | 0 | 0 | 1 |

Totals over 9 run(s): 76 planner calls, 64 valid on the first reply, 11 repaired (4 of them with think off), 1 deterministic fallback(s); 75 tool calls chosen by the model; memo drafts 12 (0 with an unknown number), 7 model memo(s) kept, 2 template memo(s); evidence 158/180 complete; claims 171/171 cited; cloud model calls 0; refused hosts 0.

## 7. Cold against warm

A warm run is one that skipped at least one checklist step from memory (the remembered revenue tag).

| Group | Runs | Chunks (mean) | Wall (mean) | Wall (min to max) | Planner calls (mean) | Skipped steps (mean) | Runs |
| --- | --- | --- | --- | --- | --- | --- | --- |
| all, cold | 4 | 5.00 | 99.1 s | 84.1 s to 114.9 s | 9.00 | 0.00 | r20261024T203050a220, r20261024T2034350adc, r20261024T213805fb4e, r20261024T214009cd85 |
| all, warm | 5 | 4.00 | 116.0 s | 100.7 s to 133.2 s | 8.00 | 1.00 | r20261024T203648826a, r20261024T20391416bf, r20261024T204637522f, r20261024T214205a2e5, r20261024T2145294e73 |
| FIRSTENERGY CORP, cold | 2 | 5.00 | 90.8 s | 84.1 s to 97.5 s | 9.00 | 0.00 | r20261024T203050a220, r20261024T213805fb4e |
| FIRSTENERGY CORP, warm | 3 | 4.00 | 122.3 s | 105.5 s to 133.2 s | 8.00 | 1.00 | r20261024T20391416bf, r20261024T204637522f, r20261024T214205a2e5 |
| AMERICAN ELECTRIC POWER CO INC, cold | 2 | 5.00 | 107.3 s | 99.7 s to 114.9 s | 9.00 | 0.00 | r20261024T2034350adc, r20261024T214009cd85 |
| AMERICAN ELECTRIC POWER CO INC, warm | 2 | 4.00 | 106.7 s | 100.7 s to 112.7 s | 8.00 | 1.00 | r20261024T203648826a, r20261024T2145294e73 |

## 8. Four other utilities, same quarter (added 25 Oct 2026)

Sections 1 to 7 above are unchanged and cover the nine runs of 24 Oct 2026. This section adds one cold run each for the four other seed utilities whose companyconcept views were registered at onboarding (Southern Co, Duke Energy, Xcel Energy, Entergy), asked through the agent on 25 Oct 2026 with the same command as the demo case: `npm run ask -- --cik <cik10> --period CY2025Q1 --claim "the weather"` (code at `0a7ea45`). The claim is the default "the weather": these four filings were not read by hand, so no management wording is quoted. Every result is published, not a pick. The summary per run is in [`eval/contrast-cy2025q1.json`](eval/contrast-cy2025q1.json).

| Utility | Run | g | Degree days | Weather (range) | Industry | Remainder | Ratio | Verdict, confidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Southern Co | r20261025T115028c6c5 | +17.0% | +12.9% (3 stations, coverage 1.00) | +6.6% (+0.9% to +11.3%) | +2.8% | +7.6% | 0.39 | **partly supported**, high |
| Duke Energy | r20261025T11524841a9 | +7.5% | +16.5% (9 stations, coverage 0.99) | +8.7% (+1.2% to +14.8%) | +3.4% | -4.7% | 1.16 | supported, high |
| Xcel Energy | r20261025T11542503bf | +7.0% | +13.1% (9 stations, coverage 1.00) | +6.8% (+0.9% to +11.4%) | +3.6% | -3.4% | 0.97 | supported, high |
| Entergy | r20261025T1155534448 | +1.9% | +18.0% (5 stations, coverage 1.00) | +10.2% (+2.1% to +16.7%) | +2.9% | -11.3% | 5.46 | supported, high |

Read plainly:

- **Southern Co is the "partly" case.** Weather is consistent with 6.6 of the 17.0 points of revenue growth (ratio 0.39, between the rule's 0.2 and 0.5), and the company-specific remainder (+7.6) is larger than the weather part: "it was the weather" would explain well under half of this rise.
- **Entergy shows a limit of the verdict rule.** "Supported" only asks that the weather part be at least half the change with the same sign. Here it is 5.5 times the change (+10.2 against +1.9) and the remainder is -11.3: weather alone would have lifted revenue far more than it rose, and something the method does not see pulled it down by about as much. The rule has no upper bound, so this card's "supported" should be read that way, not as a confirmation of a sentence nobody quoted.
- **Duke Energy and Xcel Energy:** the weather part is about the whole change (ratio 1.16 and 0.97) and the remainder is negative.
- **Confidence is high on all four** for the same reason as on FirstEnergy (the peer slope's range stays above zero with 39 peers and coverage of at least 0.95); it does not mean the weather part is precise: every weather range runs from 1 to 2 points at its low end to 11 to 17 points at its high end.
- **Planner and memo:** 36 planner calls, 33 valid on the first reply, 3 repaired (all with think off), 0 fallbacks. The model's pick differed from the checklist's next step twice (Southern Co: `attribute` before `dq_gate`; Entergy: `get_peers` before `get_revenue`); the card does not depend on the order. The memo verdict check (a draft must state the card's verdict) rejected both drafts in two of the four runs (Southern Co and Entergy; 0 numbers wrong in any draft), so those two cards carry the template memo; Duke Energy and Xcel Energy kept the model's first draft.

The tables below are the output of `agent/src/eval/run.ts` over these four runs alone (`--data` pointing at a directory that holds only them), sections "Runs used", 4 and 6, unedited:

| Run | Utility | CIK | Period | Claim | Started | Source |
| --- | --- | --- | --- | --- | --- | --- |
| r20261025T115028c6c5 | SOUTHERN CO | 0000092122 | CY2025Q1 | the weather | 2026-10-25T03:50:28.921Z | data/runs |
| r20261025T11524841a9 | Duke Energy CORP | 0001326160 | CY2025Q1 | the weather | 2026-10-25T03:52:48.484Z | data/runs |
| r20261025T11542503bf | XCEL ENERGY INC | 0000072903 | CY2025Q1 | the weather | 2026-10-25T03:54:25.623Z | data/runs |
| r20261025T1155534448 | ENTERGY CORP /DE/ | 0000065984 | CY2025Q1 | the weather | 2026-10-25T03:55:53.710Z | data/runs |

### 8a. Attribution with bootstrap ranges

#### ENTERGY CORP /DE/ (CIK 0000065984), run r20261025T1155534448

| Quantity | Value |
| --- | --- |
| Revenue tag | Revenues |
| g (year on year) | +1.87% |
| Accession numbers | current 0000065984-25-000046; previous original 0000065984-25-000046; previous comparative 0000065984-25-000046; recast no |
| Degree-day change | +17.99% |
| Peers | 39 |
| beta [range] | 0.5677 [0.1165, 0.9281] |
| Theil-Sen slope | 0.4464 |
| Weather | +10.22% [+2.10%, +16.70%] |
| Industry | +2.91% [-2.43%, +8.48%] |
| Remainder | -11.25% [-23.31%, +2.21%] |
| Bootstrap | 300 of 300 resamples valid, 0 skipped (zero variance), seed 7 |
| Coverage | 1.0000 |
| Confidence | high |
| Claim ratio / verdict | 5.464 / supported |
| Recast conflicts on the card | 0 |
| Identical across runs | yes (1 run(s): r20261025T1155534448) |

#### XCEL ENERGY INC (CIK 0000072903), run r20261025T11542503bf

| Quantity | Value |
| --- | --- |
| Revenue tag | RegulatedAndUnregulatedOperatingRevenue |
| g (year on year) | +7.04% |
| Accession numbers | current 0000072903-25-000088; previous original 0000072903-24-000096; previous comparative 0000072903-25-000088; recast no |
| Degree-day change | +13.15% |
| Peers | 39 |
| beta [range] | 0.5189 [0.0701, 0.8652] |
| Theil-Sen slope | 0.3119 |
| Weather | +6.82% [+0.92%, +11.37%] |
| Industry | +3.61% [-1.29%, +9.13%] |
| Remainder | -3.39% [-13.47%, +7.41%] |
| Bootstrap | 300 of 300 resamples valid, 0 skipped (zero variance), seed 7 |
| Coverage | 1.0000 |
| Confidence | high |
| Claim ratio / verdict | 0.969 / supported |
| Recast conflicts on the card | 0 |
| Identical across runs | yes (1 run(s): r20261025T11542503bf) |

#### SOUTHERN CO (CIK 0000092122), run r20261025T115028c6c5

| Quantity | Value |
| --- | --- |
| Revenue tag | Revenues |
| g (year on year) | +16.99% |
| Accession numbers | current 0000092122-25-000042; previous original 0000092122-24-000042; previous comparative 0000092122-25-000042; recast no |
| Degree-day change | +12.87% |
| Peers | 39 |
| beta [range] | 0.5123 [0.0682, 0.8762] |
| Theil-Sen slope | 0.3966 |
| Weather | +6.59% [+0.88%, +11.28%] |
| Industry | +2.77% [-2.15%, +9.02%] |
| Remainder | +7.63% [-3.31%, +18.26%] |
| Bootstrap | 300 of 300 resamples valid, 0 skipped (zero variance), seed 7 |
| Coverage | 1.0000 |
| Confidence | high |
| Claim ratio / verdict | 0.388 / partly supported |
| Recast conflicts on the card | 0 |
| Identical across runs | yes (1 run(s): r20261025T115028c6c5) |

#### Duke Energy CORP (CIK 0001326160), run r20261025T11524841a9

| Quantity | Value |
| --- | --- |
| Revenue tag | RegulatedAndUnregulatedOperatingRevenue |
| g (year on year) | +7.53% |
| Accession numbers | current 0001326160-25-000150; previous original 0001326160-24-000108; previous comparative 0001326160-25-000150; recast no |
| Degree-day change | +16.47% |
| Peers | 39 |
| beta [range] | 0.5311 [0.0736, 0.9009] |
| Theil-Sen slope | 0.4071 |
| Weather | +8.75% [+1.21%, +14.84%] |
| Industry | +3.44% [-1.69%, +9.04%] |
| Remainder | -4.65% [-16.34%, +8.01%] |
| Bootstrap | 300 of 300 resamples valid, 0 skipped (zero variance), seed 7 |
| Coverage | 0.9889 |
| Confidence | high |
| Claim ratio / verdict | 1.161 / supported |
| Recast conflicts on the card | 0 |
| Identical across runs | yes (1 run(s): r20261025T11524841a9) |

### 8b. Per run

| Run | Utility | Mode | Chunks | Wall | Planner calls | Valid first try | Repaired | Repaired with think off | Fallbacks | Median tok/s | Memo | E-complete | E-cov | Skipped steps | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| r20261025T115028c6c5 | SOUTHERN CO | cold | 5 | 102.8 s | 9 | 8 | 1 | 1 | 0 | 147.9 | template, 215 words, 2 attempt(s) | 20/20 | 19/19 (1.000) | none | partly supported / high / DQ pass |
| r20261025T11524841a9 | Duke Energy CORP | cold | 5 | 93.6 s | 9 | 8 | 1 | 1 | 0 | 147.8 | model, 178 words, 1 attempt(s) | 22/22 | 21/21 (1.000) | none | supported / high / DQ pass |
| r20261025T11542503bf | XCEL ENERGY INC | cold | 5 | 84.6 s | 9 | 9 | 0 | 0 | 0 | 147.4 | model, 199 words, 1 attempt(s) | 22/22 | 21/21 (1.000) | none | supported / high / DQ pass |
| r20261025T1155534448 | ENTERGY CORP /DE/ | cold | 5 | 105.7 s | 9 | 8 | 1 | 1 | 0 | 146.9 | template, 214 words, 2 attempt(s) | 20/20 | 19/19 (1.000) | none | supported / high / DQ pass |

Memo drafts (word count, numbers not found in any tool output):

| Run | Draft | Words | Unknown numbers | Kept |
| --- | --- | --- | --- | --- |
| r20261025T115028c6c5 | 1 | 155 | 0 | no |
| r20261025T115028c6c5 | 2 | 152 | 0 | no |
| r20261025T11524841a9 | 1 | 178 | 0 | yes |
| r20261025T11542503bf | 1 | 199 | 0 | yes |
| r20261025T1155534448 | 1 | 125 | 0 | no |
| r20261025T1155534448 | 2 | 125 | 0 | no |

Degree-day statements and memo time per run:

| Run | weather_quarter current | weather_quarter previous | Memo | Model | Think | Cloud model calls | Refused hosts | Recast conflicts |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| r20261025T115028c6c5 | 18.2 s | 17.9 s | 9.4 s | nemotron-3-nano:4b | on | 0 | 0 | 0 |
| r20261025T11524841a9 | 18.2 s | 18.2 s | 2.6 s | nemotron-3-nano:4b | on | 0 | 0 | 0 |
| r20261025T11542503bf | 18.2 s | 18.1 s | 6.3 s | nemotron-3-nano:4b | on | 0 | 0 | 0 |
| r20261025T1155534448 | 17.6 s | 17.8 s | 3.3 s | nemotron-3-nano:4b | on | 0 | 0 | 0 |

Totals over 4 run(s): 36 planner calls, 33 valid on the first reply, 3 repaired (3 of them with think off), 0 deterministic fallback(s); 36 tool calls chosen by the model; memo drafts 6 (0 with an unknown number), 2 model memo(s) kept, 2 template memo(s); evidence 84/84 complete; claims 80/80 cited; cloud model calls 0; refused hosts 0.

