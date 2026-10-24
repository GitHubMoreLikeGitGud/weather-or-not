# Weather-or-Not evaluation report

Generated 2026-10-24T13:35:59.019Z. Every number below is measured and read from a file: the saved runs under data/runs, the DQ onboarding file (data/dq/latest.json) and the join-map measurements (data/eval/joinmap.json, one-off Lightning SQL statements under the reader allowlist). Nothing is typed by hand; "not measured" marks what the files do not hold.

## Runs used

| Run | Utility | CIK | Period | Claim | Started | Source |
| --- | --- | --- | --- | --- | --- | --- |
| r20261024T203050a220 | FIRSTENERGY CORP | 0001031296 | CY2025Q1 | colder weather | 2026-10-24T12:30:50.151Z | data/runs |
| r20261024T2034350adc | AMERICAN ELECTRIC POWER CO INC | 0000004904 | CY2025Q1 | favorable weather | 2026-10-24T12:34:35.825Z | data/runs |
| r20261024T203648826a | AMERICAN ELECTRIC POWER CO INC | 0000004904 | CY2025Q1 | favorable weather | 2026-10-24T12:36:48.574Z | data/runs |
| r20261024T20391416bf | FIRSTENERGY CORP | 0001031296 | CY2025Q1 | colder weather | 2026-10-24T12:39:14.725Z | data/runs |
| r20261024T204637522f | FIRSTENERGY CORP | 0001031296 | CY2025Q1 | colder weather | 2026-10-24T12:46:37.596Z | data/runs |

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

From run r20261024T204637522f (FIRSTENERGY CORP, CY2025Q1): 39 peers, 39 with weather; the peer set is identical across the 3 run(s) of this utility.

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

From the weather_quarter evidence rows of run r20261024T204637522f (CY2025Q1: 56 stations; CY2024Q1: 56 stations). Utility coverage is the minimum over its stations, then the minimum of the two periods. 43 of 43 utilities have every station in the rows; lowest utility coverage 0.9556; 0 below 0.9.

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

### AMERICAN ELECTRIC POWER CO INC (CIK 0000004904), run r20261024T203648826a

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
| Identical across runs | yes (2 run(s): r20261024T2034350adc, r20261024T203648826a) |

### FIRSTENERGY CORP (CIK 0001031296), run r20261024T204637522f

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
| Identical across runs | yes (3 run(s): r20261024T203050a220, r20261024T20391416bf, r20261024T204637522f) |

## 5. Data quality

Rule `coverage_ok` on `lightning.metastore.weatherornot.weather_or_not_usl.weather_quarter`, run 2026-10-24T19:31:39+0800, 739.3 s in all, ok true; RUN DQ 342 total / 342 valid / 0 invalid in 557.2 s; 0 invalid station-quarter(s).

| Statement | Seconds | Rows | Error |
| --- | --- | --- | --- |
| dq_run_coverage | 557.2 | 1 |  |
| dq_invalid | 181.7 | 0 |  |

Utility FK rule (recorded at onboarding, see 1d): 43 / 42 / 1; the invalid row is MGE ENERGY INC (SIC 4900).

## 6. Per run

| Run | Utility | Mode | Chunks | Wall | Planner calls | Valid first try | Repaired | Fallbacks | Median tok/s | Memo | E-complete | E-cov | Skipped steps | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| r20261024T203050a220 | FIRSTENERGY CORP | cold | 5 | 84.1 s | 9 | 9 | 0 | 0 | 140.7 | model, 135 words, 2 attempt(s) | 9/20 (11 unresolved object names) | 19/19 (1.000) | none | supported / high / DQ pass |
| r20261024T2034350adc | AMERICAN ELECTRIC POWER CO INC | cold | 5 | 99.7 s | 9 | 8 | 1 | 0 | 140.6 | template, 243 words, 2 attempt(s) | 9/20 (11 unresolved object names) | 19/19 (1.000) | none | supported / high / DQ pass |
| r20261024T203648826a | AMERICAN ELECTRIC POWER CO INC | warm | 4 | 100.7 s | 8 | 7 | 1 | 0 | 141.2 | template, 243 words, 2 attempt(s) | 20/20 | 19/19 (1.000) | tag_chosen (mem-61) | supported / high / DQ pass |
| r20261024T20391416bf | FIRSTENERGY CORP | warm | 4 | 105.5 s | 8 | 7 | 1 | 0 | 140.2 | model, 184 words, 1 attempt(s) | 20/20 | 19/19 (1.000) | tag_chosen (mem-49) | supported / high / DQ pass |
| r20261024T204637522f | FIRSTENERGY CORP | warm | 4 | 133.2 s | 8 | 5 | 2 | 1 | 139.5 | model, 184 words, 1 attempt(s) | 20/20 | 19/19 (1.000) | tag_chosen (mem-49) | supported / high / DQ pass |

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

Degree-day statements and memo time per run:

| Run | weather_quarter current | weather_quarter previous | Memo | Model | Think | Cloud model calls | Refused hosts | Recast conflicts |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| r20261024T203050a220 | 18.2 s | 18.4 s | 3.2 s | nemotron-3-nano:4b | on | 0 | 0 | 0 |
| r20261024T2034350adc | 18.7 s | 18.6 s | 6.6 s | nemotron-3-nano:4b | on | 0 | 0 | 1 |
| r20261024T203648826a | 19.2 s | 18.3 s | 2.8 s | nemotron-3-nano:4b | on | 0 | 0 | 1 |
| r20261024T20391416bf | 18.5 s | 18.4 s | 2.7 s | nemotron-3-nano:4b | on | 0 | 0 | 0 |
| r20261024T204637522f | 18.4 s | 18.3 s | 2.7 s | nemotron-3-nano:4b | on | 0 | 0 | 0 |

Totals over 5 run(s): 42 planner calls, 36 valid on the first reply, 5 repaired, 1 deterministic fallback(s); 41 tool calls chosen by the model; memo drafts 8 (0 with an unknown number), 3 model memo(s) kept, 2 template memo(s); evidence 78/100 complete; claims 95/95 cited; cloud model calls 0; refused hosts 0.

## 7. Cold against warm

A warm run is one that skipped at least one checklist step from memory (the remembered revenue tag).

| Group | Runs | Chunks (mean) | Wall (mean) | Wall (min to max) | Planner calls (mean) | Skipped steps (mean) | Runs |
| --- | --- | --- | --- | --- | --- | --- | --- |
| all, cold | 2 | 5.00 | 91.9 s | 84.1 s to 99.7 s | 9.00 | 0.00 | r20261024T203050a220, r20261024T2034350adc |
| all, warm | 3 | 4.00 | 113.1 s | 100.7 s to 133.2 s | 8.00 | 1.00 | r20261024T203648826a, r20261024T20391416bf, r20261024T204637522f |
| FIRSTENERGY CORP, cold | 1 | 5.00 | 84.1 s | 84.1 s to 84.1 s | 9.00 | 0.00 | r20261024T203050a220 |
| FIRSTENERGY CORP, warm | 2 | 4.00 | 119.4 s | 105.5 s to 133.2 s | 8.00 | 1.00 | r20261024T20391416bf, r20261024T204637522f |
| AMERICAN ELECTRIC POWER CO INC, cold | 1 | 5.00 | 99.7 s | 99.7 s to 99.7 s | 9.00 | 0.00 | r20261024T2034350adc |
| AMERICAN ELECTRIC POWER CO INC, warm | 1 | 4.00 | 100.7 s | 100.7 s to 100.7 s | 8.00 | 1.00 | r20261024T203648826a |

