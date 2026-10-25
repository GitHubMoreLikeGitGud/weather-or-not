# Nemotron in the question chain: measured settings and numbers

Every number here is measured on the live stack (local Zetaris through the gateway on 127.0.0.1:8793, Ollama on 127.0.0.1:11434) and copied from the saved runs under `data/runs/<id>/run.json`. Token counts and durations are what Ollama reports (`prompt_eval_count`, `eval_count`, `eval_duration`); the full-history baseline and the carryover sizes are estimated at chars/4, as the Markovian reference engine estimates. Nothing in this file is a projection.

## Settings

| Job | Model | think | temperature | seed | num_ctx | num_predict | format |
|---|---|---|---|---|---|---|---|
| planner (one step of the chain) | `nemotron-3-nano:4b` (Ollama) | on | 0 | 7 | 8192 | 3072 (2048 in the runs of 24 Oct 20:30 to 20:46 below) | JSON schema: thought, action {tool from the dynamic enum, input}, state, done |
| memo | `nemotron-3-nano:4b` | off | 0 | 7 | 8192 | 1024 | JSON schema: {memo} |

The model host must be a loopback address; any other host is refused and counted (`telemetry.refused_model_hosts` in every run, 0 in every run below). Cloud model calls: 0.

The planner picks a tool from the tools the host allows at that step; the host runs the tool, records the evidence and gives the model a digest of at most 800 tokens; at most two tool calls per chunk, carryover state at most 800 tokens, at most 10 chunks. An invalid reply gets one repair round; a second invalid reply (or no action while the checklist is open) makes the host take the next checklist step itself ("fallback"). The memo's every number is string-matched against the formatted tool outputs; a draft with any other number is rejected once with the reason, then the template memo is used.

Settings changed after the five runs below (24 Oct, after 20:46), before the clean re-runs recorded at the end of this file:

- Planner `num_predict` 2,048 to 3,072 for every planner step. In the five runs, five of the six invalid first replies were empty content with Ollama `done_reason` `length`: the model spent the whole 2,048-token output budget on thinking and never started the JSON.
- When a first reply is empty with `done_reason` `length`, the repair round runs with think off: the same schema and the same prompt plus the repair note, so the budget goes to the JSON. A repair after any other error keeps think on. The deterministic fallback stays the last resort. Each planner call records `repair_think_off` and the run summary counts `planner_repairs_think_off`.
- Memo length policy: a draft whose numbers all match is kept at 100 to 250 words; the template memo is used only below 100 words, above 250 or on a number that is not a tool output. The retry wording that names the missing length and the paragraphs to add stays. In the five runs, four 95-word drafts with every number right were rejected on length alone.

## FirstEnergy, CY2025Q1 vs CY2024Q1, cold run (run r20261024T203050a220, 24 Oct 2026 20:30 SGT)

Wall 84.1 s for the whole question (two Lightning SQL degree-day statements of 18.2 and 18.4 s included). 5 chunks, 9 planner calls, 9 tool calls.

| Chunk | Planner calls | Tools run (chosen by the model) | Prompt tokens, first call (measured) | Prompt tokens, both calls | Output tokens | Full-history baseline, first call (estimated) | Carryover in / out (estimated) | Chunk wall ms |
|---|---|---|---|---|---|---|---|---|
| 1 | 2 | resolve_utility, probe_revenue_tag | 1,422 | 3,348 | 869 | 1,257 | 0 / 202 | 7,824 |
| 2 | 2 | get_revenue, get_peers | 1,552 | 3,259 | 819 | 1,993 | 202 / 271 | 9,295 |
| 3 | 2 | get_weather, dq_gate | 1,607 | 3,490 | 1,359 | 2,679 | 271 / 300 | 47,420 |
| 4 | 2 | attribute, not_tested | 1,701 | 3,532 | 1,084 | 3,354 | 300 / 281 | 12,664 |
| 5 | 1 | finalize | 1,561 | 1,561 | 484 | 3,865 | 281 / 282 | 6,937 |

Per planner call (measured): prompt / output tokens, tokens per second, wall ms, chosen tool.

| Call | Valid first try | Tool chosen | Prompt | Output | tok/s | Wall ms |
|---|---|---|---|---|---|---|
| 1.1 | yes | resolve_utility | 1,422 | 309 | 134.5 | 3,002 |
| 1.2 | yes | probe_revenue_tag | 1,926 | 560 | 141.3 | 4,319 |
| 2.1 | yes | get_revenue | 1,552 | 432 | 140.7 | 3,382 |
| 2.2 | yes | get_peers | 1,707 | 387 | 141.0 | 3,078 |
| 3.1 | yes | get_weather | 1,607 | 710 | 141.2 | 5,321 |
| 3.2 | yes | dq_gate | 1,883 | 649 | 139.7 | 4,985 |
| 4.1 | yes | attribute | 1,701 | 441 | 140.4 | 7,444 |
| 4.2 | yes | not_tested | 1,831 | 643 | 143.7 | 4,790 |
| 5.1 | yes | finalize | 1,561 | 484 | 140.3 | 3,740 |

- JSON valid on the first reply: 9 of 9 planner calls; repair rounds 0; fallback steps 0; the tool the model chose was the checklist's next step every time. The model's echo of the checklist differed from the host's on 6 of 9 calls (the host's checklist is the one that counts; the echo is ignored).
- Planner tokens over the run: 15,190 in / 4,615 out (measured). Median planner speed 140.7 tok/s.
- Carryover state: at most 300 tokens (estimated) against the 800 budget. First-call prompts summed over the chunks: 6,620 tokens (estimated) against 13,148 for a full-history agent sending every earlier reply and digest again: a 49.7% saving on that estimate; the measured first-call prompts stayed between 1,422 and 1,701 tokens while the baseline grew from 1,257 to 3,865.
- Memo: 2 attempts. The first draft had every number right but was 68 words (rejected: 150 to 250 wanted); the second was 135 words with every number matching a tool output and was kept. 2,475 tokens in / 406 out, 146.9 tok/s, 0.85 s and 1.91 s of generation.
- Tool latencies (ms, measured): submission 241, frames_fact 204, concept_window 219, six frames_seeds 190-238, weather_quarter 18,231 and 18,391 (one Lightning SQL statement per quarter over 56 stations), dq_gate 4 (reads the onboarding file), attribute 225, memo 3,192. World Model ingest of the 43 utilities' frames facts 1,330.

## American Electric Power, CY2025Q1 vs CY2024Q1, cold run (run r20261024T2034350adc, 20:34 SGT)

Wall 99.7 s. 5 chunks, 9 planner calls, 9 tool calls, all chosen by the model. This is the question with a live own-period restatement: the fy2025 10-Q reports 5,463,400,000 for the quarter and the 2026 10-Q's comparative column 5,463,000,000; the chain recorded the `recast_comparative` conflict and used the own filing's value (rule R1).

| Call | Valid first try | Tool chosen | Prompt | Output | tok/s | Wall ms |
|---|---|---|---|---|---|---|
| 1.1 | yes | resolve_utility | 1,422 | 303 | 135.0 | 2,539 |
| 1.2 | yes | probe_revenue_tag | 1,930 | 634 | 141.2 | 4,805 |
| 2.1 | yes | get_revenue | 1,559 | 457 | 140.0 | 3,561 |
| 2.2 | yes | get_peers | 1,798 | 507 | 142.8 | 3,877 |
| 3.1 | yes | get_weather | 1,777 | 465 | 137.1 | 7,544 |
| 3.2 | yes | dq_gate | 2,059 | 459 | 141.6 | 3,592 |
| 4.1 | yes | attribute | 1,878 | 510 | 140.6 | 3,949 |
| 4.2 | yes | not_tested | 2,007 | 556 | 140.7 | 4,275 |
| 5.1 | no (2 replies) | finalize | 3,485 | 2,631 | 133.5 | 18,917 |

- JSON valid on the first reply: 8 of 9. Call 5.1's first reply was empty content: the model spent the whole 2,048-token output budget in its thinking and produced no JSON (Ollama `done_reason` length). The repair round (the same prompt plus the error) produced a valid reply that chose `finalize`. No fallback step was needed.
- Planner tokens over the run: 17,915 in / 6,522 out (measured); median 140.6 tok/s. Carryover at most 371 tokens (estimated). First-call prompts 6,829 against a 13,440 full-history estimate (49.2% less).
- Memo: both drafts were 95 words with every number matching a tool output; both were rejected for length (150 to 250 wanted) and the template memo (243 words) was used. The retry prompt has since been changed to name the missing length and the paragraphs to add; the next runs measure whether that helps.
- Tool latencies (ms): submission 226, frames_fact 186, concept_window 241, frames_seeds 193-264, weather_quarter 18,681 and 18,576, attribute 241, memo 6,636 (two drafts).

## American Electric Power, warm run (run r20261024T203648826a, 20:36 SGT)

The same question a second time, with the revenue tag remembered from the first run (H-MEM `tag_choice`, memory mem-61; the read is in the trust ledger and cited by a `memory` evidence record).

- 4 chunks instead of 5: the `probe_revenue_tag` step was skipped (`skipped_steps` = tag_chosen); 8 planner calls, 8 tool calls, all chosen by the model; 7 of 8 valid first try, 1 repair (call 4.2, again an all-thinking first reply cut at num_predict, then a valid `finalize`).
- Wall 100.7 s: the two degree-day statements (19.2 and 18.3 s) and the repair round (18.9 s) dominate, so the saved probe (0.2 s of SQL and one planner call of about 4 s) does not show in the wall time.
- Planner tokens 17,982 in / 7,230 out; median 141.2 tok/s; carryover at most 404 tokens; first-call prompts 5,775 against 10,868 estimated (46.9% less).
- The World Model received the same rows again and appended no event (769 events before and after): the reference idempotency property on live data. H-MEM reconfirmed the facts it already held (12 memories touched, 7 of them from the first run) and kept the one recast conflict.
- One planner input was wrong although harmless: call 3.2 chose `attribute` with a `tag` of `RevenueFromContractWithCustomerExcludingAssessedTax` (AEP's tag is `Revenues`); the tool takes no input and ignored it. The host now rejects a `tag` that is not the utility's tag for every tool, which would have cost a repair round here.
- Memo: again two 95-word drafts, numbers all matching, rejected for length; template memo.

## FirstEnergy, warm run (run r20261024T20391416bf, 20:39 SGT)

The demo question a second time, with the tag remembered (mem-49) and the retry wording for the memo in place.

| Call | Valid first try | Tool chosen | Prompt | Output | tok/s | Wall ms |
|---|---|---|---|---|---|---|
| 1.1 | yes | resolve_utility | 1,757 | 560 | 134.1 | 8,085 |
| 1.2 | yes | get_revenue | 2,181 | 463 | 132.5 | 3,857 |
| 2.1 | yes | get_peers | 1,556 | 594 | 140.6 | 4,501 |
| 2.2 | yes | get_weather | 1,981 | 524 | 140.8 | 4,077 |
| 3.1 | yes | dq_gate | 1,748 | 1,185 | 143.1 | 8,605 |
| 3.2 | yes | attribute | 1,964 | 414 | 137.5 | 3,335 |
| 4.1 | yes | not_tested | 1,591 | 965 | 143.0 | 10,470 |
| 4.2 | no (2 replies) | finalize | 3,429 | 2,887 | 139.7 | 20,513 |

- 4 chunks instead of 5 (the probe step skipped); 8 planner calls, 7 valid first try, 1 repair (call 4.2: all-thinking first reply cut at num_predict, then a valid `finalize`); 8 tool calls chosen by the model; 0 fallback. The attribution is identical to the cold run (beta 0.506526, weather +8.2005%).
- Memo: kept on the first draft, 184 words, every number matching a tool output; 1,280 tokens in / 360 out, 148.5 tok/s, 2.4 s. The draft follows the findings closely and carries a few hyphen-space artefacts ("degree- day") from the model's output; the numbers are untouched.
- Wall 105.5 s: the two degree-day statements 18.5 and 18.4 s, the repair round 20.5 s, the other planner calls 3.3 to 10.5 s.
- Planner tokens 16,207 in / 7,592 out; median 140.2 tok/s; carryover at most 298 tokens; first-call prompts 5,504 against 10,086 estimated (45.4% less). World Model: 769 events before and after (nothing appended).

## Across the four runs

| | FE cold | AEP cold | AEP warm | FE warm |
|---|---|---|---|---|
| Chunks | 5 | 5 | 4 | 4 |
| Planner calls (valid first try / repaired) | 9 (9 / 0) | 9 (8 / 1) | 8 (7 / 1) | 8 (7 / 1) |
| Tool calls chosen by the model / fallback | 9 / 0 | 9 / 0 | 8 / 0 | 8 / 0 |
| Median planner tok/s | 140.7 | 140.6 | 141.2 | 140.2 |
| Planner tokens in / out | 15,190 / 4,615 | 17,915 / 6,522 | 17,982 / 7,230 | 16,207 / 7,592 |
| Max carryover (estimated) | 300 | 371 | 404 | 298 |
| First-call prompts vs full-history estimate | 6,620 / 13,148 | 6,829 / 13,440 | 5,775 / 10,868 | 5,504 / 10,086 |
| Memo | model, 2nd draft (135 w) | template (2 x 95 w) | template (2 x 95 w) | model, 1st draft (184 w) |
| Numbers wrong in any memo draft | 0 | 0 | 0 | 0 |
| Wall | 84.1 s | 99.7 s | 100.7 s | 105.5 s |
| Cloud model calls | 0 | 0 | 0 | 0 |

The three invalid first replies were all on the `finalize` step and all the same failure: the model used the whole output budget thinking and returned no content. Every tool the model chose was the checklist's next step (34 of 34 calls on these four first-settings runs; the four clean re-runs below give 33 of 34, see "Pick = the checklist's next step, run by run"). The deterministic fallback step, which exists for the case the repair also fails, did not have to run in these four runs.

## FirstEnergy, fifth run (review), warm (run r20261024T204637522f, 20:46 SGT)

The demo question once more on the committed tree, with the tag remembered (mem-49) and the planner-input tag check in force, to see whether the card reproduces and how the fallback path behaves when the repair round fails too.

| Call | Valid first try | Tool chosen | Prompt | Output | tok/s | Wall ms |
|---|---|---|---|---|---|---|
| 1.1 | yes | resolve_utility | 1,757 | 560 | 133.5 | 4,529 |
| 1.2 | yes | get_revenue | 2,181 | 463 | 133.3 | 3,836 |
| 2.1 | yes | get_peers | 1,560 | 357 | 137.0 | 7,984 |
| 2.2 | no (2 replies) | get_weather | 4,355 | 1,612 | 145.7 | 11,691 |
| 3.1 | yes | dq_gate | 1,754 | 659 | 140.9 | 5,033 |
| 3.2 | yes | attribute | 1,970 | 406 | 138.1 | 3,275 |
| 4.1 | no (2 replies) | not_tested | 3,245 | 3,282 | 143.0 | 23,078 |
| 4.2 | no (2 replies, both invalid) | none; the host ran `finalize` itself | 3,441 | 4,096 | 147.0 | 32,092 |

- The card is identical to the cold run (beta 0.506526, weather +8.2005%, every number equal) and the memo text equals the previous warm run's memo byte for byte (184 words, first draft, every number matched): temperature 0 and seed 7 make the chain reproducible when the tool outputs are the same.
- JSON valid on the first reply: 5 of 8; repaired 2; fallback 1. Call 2.2's first reply named `RegulatedAndUnregulatedOperatingRevenue` as the tag for `get_weather` and was rejected by the host's tag check (the schema error added after the AEP warm run); the repair chose the same tool with the utility's tag. Calls 4.1 and 4.2 returned empty content on the first reply (thinking used the whole 2,048-token output budget), and 4.2's repair reply was empty as well, so the host took the `finalize` step itself. The fallback produced the same verdict and the same memo path as a model-chosen `finalize` would have.
- Planner tokens 20,263 in / 11,435 out; median 139.5 tok/s; carryover at most 298 tokens; first-call prompts 5,504 against 10,439 estimated (47.3% less). Memo 1,280 in / 360 out, 148.5 tok/s, 2.7 s. `weather_quarter` 18,419 and 18,293 ms. World Model 769 events before and after. Wall 133.2 s: the two repair rounds and the failed repair add about 50 s over the earlier warm run.
- Across the five runs: 42 planner calls, 36 valid on the first reply, 5 repaired, 1 fallback. Of the six invalid first replies, five were empty content from thinking past `num_predict` (four on `finalize`, one on `not_tested`) and one was the wrong tag; the one fallback was `finalize` after an empty repair reply too. The `finalize` step is where the model runs out of output budget most often.

## Clean re-runs on the changed settings (24 Oct 2026, 21:38 to 21:47 SGT)

The runtime state (H-MEM, World Model, runs, evidence) was reset and the warm-up plus the four questions ran again on the committed code with the three changes listed under Settings: planner output budget 3,072 tokens, the repair after an empty length-cut reply with think off, and the 100 to 250 word memo policy. Every number below is read from `data/runs/<id>/run.json` by a script; the memo column is the kept draft.

| | FE cold | AEP cold | FE warm | AEP warm |
|---|---|---|---|---|
| run_id | r20261024T213805fb4e | r20261024T214009cd85 | r20261024T214205a2e5 | r20261024T2145294e73 |
| Chunks | 5 | 5 | 4 | 4 |
| Planner calls | 9 | 9 | 8 | 8 |
| Valid first try | 9 | 7 | 6 | 6 |
| Repaired | 0 | 2 | 2 | 2 |
| Repairs run with think off | 0 | 1 | 2 | 1 |
| Fallback steps | 0 | 0 | 0 | 0 |
| Tool calls chosen by the model | 9 | 9 | 8 | 8 |
| Memo (source, words, attempts) | model, 184 words, 1 | model, 176 words, 1 | model, 184 words, 1 | model, 176 words, 1 |
| Numbers wrong in any memo draft | 0 | 0 | 0 | 0 |
| Planner tokens in / out (measured) | 15,101 / 5,699 | 20,356 / 8,647 | 17,891 / 9,895 | 19,688 / 8,264 |
| Median planner tok/s | 140.4 | 139.5 | 139.2 | 139.8 |
| Memo tok/s | 145.5 | 147.8 | 149.2 | 140.5 |
| Max carryover (estimated) | 284 | 358 | 298 | 387 |
| First-call prompts vs full-history estimate | 6,615 / 12,956 | 6,812 / 13,770 | 5,521 / 10,251 | 5,827 / 11,441 |
| `weather_quarter` current / previous (ms) | 20,005 / 20,959 | 18,308 / 18,576 | 23,938 / 18,804 | 18,212 / 18,564 |
| Skipped from memory | none | none | tag_chosen (mem-49) | tag_chosen (mem-61) |
| Wall (ms) | 97,457 | 114,942 | 128,063 | 112,654 |
| Cloud model calls | 0 | 0 | 0 | 0 |

Across the four: 34 planner calls, 28 valid on the first reply, 6 repaired (4 of the repair rounds ran with think off), 0 fallback steps; 34 tool calls chosen by the model; 4 memo drafts, 4 kept on the first draft, 0 numbers that were not a tool output; 18 chunks; wall 453,116 ms in total (113.3 s mean).

The six repaired calls, from the per-call records:

| Run | Call | First reply | Repair | Repair think | Prompt tokens (first / repair) | Output tokens (both replies) | Wall ms |
|---|---|---|---|---|---|---|---|
| AEP cold | 4.1 | `attribute` with the tag `RegulatedAndUnregulatedOperatingRevenue` (not AEP's tag; schema error) | valid `attribute` | on | 1,837 / 4,178 | 952 | 7,132 |
| AEP cold | 4.2 | empty content, cut at num_predict | valid `not_tested` | off | 1,966 / 3,983 | 3,414 | 24,122 |
| FE warm | 4.1 | empty content, cut at num_predict | valid `not_tested` | off | 1,597 / 3,245 | 3,367 | 23,661 |
| FE warm | 4.2 | empty content, cut at num_predict | valid `finalize` | off | 1,695 / 3,441 | 3,358 | 23,771 |
| AEP warm | 2.1 | `get_revenue` with the tag `RevenueFromContractWithCustomerExcludingAssessedTax` (schema error) | valid `get_revenue` | on | 1,680 / 3,763 | 1,056 | 8,059 |
| AEP warm | 4.2 | empty content, cut at num_predict | valid `finalize` | off | 1,942 / 3,935 | 3,414 | 24,265 |

What the four runs show, stated plainly:

- The larger budget did not stop the empty replies: four first replies still spent the whole 3,072-token output budget thinking (all on the `not_tested` and `finalize` steps, the same two steps as before). Every one of those four was repaired by the think-off round on its first try, and the deterministic fallback did not run in any of the four runs (in the five earlier runs it ran once, when the think-on repair was empty too). The think-off repair costs about 24 s per occurrence (the cut first reply plus the repair), which is why the warm runs are not faster in wall time.
- The other two repairs were the tag check (commit 8727309) rejecting a tag that is not the utility's; the repair chose the same tool with the right tag.
- The memo policy kept every first draft (184, 176, 184, 176 words, every number a tool output); the template memo was not needed. In the five earlier runs the template was used twice and a second draft once.
- The cards equal the earlier runs' to the printed digit (FE beta 0.5065, weather +8.20%; AEP beta 0.5287, weather +8.92%; 39 peers, supported, high, DQ pass in all four; the AEP recast conflict recorded again, rule R1).

## Think on, think off and no model (25 Oct 2026)

Does the model's thinking earn its cost? The four clean questions (FirstEnergy and AEP, CY2025Q1 against CY2024Q1, claim "colder weather", each cold and then warm) ran once per planner mode on the code at `0a7ea45`, each mode on a fresh data directory holding only the DQ onboarding file (`npm run warmup` first, then an empty H-MEM, World Model and run store, so the first run of each utility is cold), in the order FirstEnergy cold, AEP cold, FirstEnergy warm, AEP warm:

```bash
cd agent
npm run ask -- --cik 0001031296 --period CY2025Q1 --claim "colder weather" --think on    # the shipped setting
npm run ask -- --cik 0001031296 --period CY2025Q1 --claim "colder weather" --think off
npm run ask -- --cik 0001031296 --period CY2025Q1 --claim "colder weather" --no-model    # the host takes every checklist step and writes the template memo
```

(and the same for AEP, `--cik 0000004904`). `--think` sets the planner only; the memo always runs with think off. The model was unloaded (`ollama stop`) before the no-model runs. GPU memory was sampled with `nvidia-smi` about every 0.5 s during each run. Windows does not report GPU memory per process, so the figure is the whole card's memory in use, desktop included: 3,745 MiB with no model loaded (NVIDIA GeForce RTX 4070 Ti SUPER, 16,376 MiB). Ollama 0.40.7 listed the loaded model at 3.0 GB, 100% on the GPU, context 8192; the warm-up read 2,881 MiB in VRAM. The per-run summary is in [`eval/nemotron-ablation.json`](eval/nemotron-ablation.json).

Per mode (four questions each, measured):

| Mode | Wall, mean (min to max) | Planner calls | Valid first try | Repaired (of them, think-off repairs after an empty reply) | Fallbacks | Pick = checklist's next | Median planner tok/s (per run) | Planner tokens out | Planner wall, sum | Memos kept from the model / verdict check pass | Peak GPU memory |
|---|---|---|---|---|---|---|---|---|---|---|---|
| think on | 103.2 s (94.0 to 111.2) | 34 | 27 | 6 (4) | 1 | 31 of 33 | 143.9 to 150.5 | 33,225 | 247.1 s | 4 of 4 / 4 of 4 | 7,145 MiB |
| think off | 72.5 s (69.0 to 75.3) | 34 | 27 | 7 (0) | 0 | 30 of 34 | 147.2 to 152.3 | 14,595 | 124.1 s | 4 of 4 / 4 of 4 | 6,981 MiB |
| no model | 38.5 s (38.0 to 39.4) | 0 | n/a | n/a | 34 (the host ran every step) | n/a | n/a | 0 | 0.0 s | 0 of 4 / 4 of 4 | 3,765 MiB |

Per run:

| Mode | Question | Run | Wall | Chunks | Planner calls | Valid first try | Repaired (of them, think-off repairs after an empty reply) | Fallbacks | Pick = checklist's next | Median planner tok/s | Planner tokens out | Memo (verdict check) | Card | Peak GPU memory |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| think on | FirstEnergy, cold | r20261025T1158279a6a | 98.6 s | 5 | 9 | 8 | 1 (1) | 0 | 9 of 9 | 147.4 | 7,540 | model, 184 words, 1 draft(s) (pass) | supported, high; weather +8.2% | 7,145 MiB (+3,400) |
| think on | AEP, cold | r20261025T1200096856 | 111.2 s | 5 | 9 | 7 | 2 (1) | 0 | 9 of 9 | 150.5 | 9,546 | model, 176 words, 1 draft(s) (pass) | supported, high; weather +8.9% | 7,142 MiB (+3,397) |
| think on | FirstEnergy, warm | r20261025T120204f6fe | 94.0 s | 4 | 8 | 7 | 1 (1) | 0 | 8 of 8 | 146.4 | 7,017 | model, 184 words, 1 draft(s) (pass) | supported, high; weather +8.2% | 7,135 MiB (+3,390) |
| think on | AEP, warm | r20261025T120341bd7e | 109.1 s | 4 | 8 | 5 | 2 (1) | 1 | 5 of 7 | 143.9 | 9,122 | model, 176 words, 1 draft(s) (pass) | supported, high; weather +8.9% | 7,111 MiB (+3,366) |
| think off | FirstEnergy, cold | r20261025T1205387bc9 | 70.4 s | 5 | 9 | 8 | 1 (0) | 0 | 8 of 9 | 147.2 | 3,190 | model, 184 words, 1 draft(s) (pass) | supported, high; weather +8.2% | 6,981 MiB (+3,236) |
| think off | AEP, cold | r20261025T12065254de | 75.1 s | 5 | 9 | 8 | 1 (0) | 0 | 8 of 9 | 149.7 | 4,103 | model, 176 words, 1 draft(s) (pass) | supported, high; weather +8.9% | 6,933 MiB (+3,188) |
| think off | FirstEnergy, warm | r20261025T1208115888 | 69.0 s | 4 | 8 | 6 | 2 (0) | 0 | 7 of 8 | 148.1 | 3,186 | model, 184 words, 1 draft(s) (pass) | supported, high; weather +8.2% | 6,918 MiB (+3,173) |
| think off | AEP, warm | r20261025T1209241992 | 75.3 s | 4 | 8 | 5 | 3 (0) | 0 | 7 of 8 | 152.3 | 4,116 | model, 176 words, 1 draft(s) (pass) | supported, high; weather +8.9% | 6,919 MiB (+3,174) |
| no model | FirstEnergy, cold | r20261025T121049e2be | 39.4 s | 5 | 0 | n/a | n/a | 9 (the host ran every step) | n/a | n/a | 0 | template, 213 words (pass) | supported, high; weather +8.2% | 3,747 MiB (+2) |
| no model | AEP, cold | r20261025T1211326433 | 38.5 s | 5 | 0 | n/a | n/a | 9 (the host ran every step) | n/a | n/a | 0 | template, 243 words (pass) | supported, high; weather +8.9% | 3,748 MiB (+3) |
| no model | FirstEnergy, warm | r20261025T121214a147 | 38.0 s | 4 | 0 | n/a | n/a | 8 (the host ran every step) | n/a | n/a | 0 | template, 213 words (pass) | supported, high; weather +8.2% | 3,748 MiB (+3) |
| no model | AEP, warm | r20261025T1212561cb4 | 38.0 s | 4 | 0 | n/a | n/a | 8 (the host ran every step) | n/a | n/a | 0 | template, 243 words (pass) | supported, high; weather +8.9% | 3,765 MiB (+20) |

What it shows, stated plainly:

- **Think off was faster and no less reliable on these four questions.** Mean wall 72.5 s against 103.2 s with think on (30% less); the planner wrote 14,595 output tokens against 33,225 and spent 124.1 s in planner calls against 247.1 s. JSON valid on the first reply: 27 of 34 in both modes. With think on, 4 of the 7 invalid first replies were empty (the thinking used the whole 3,072-token output budget) and one run needed the deterministic fallback (AEP warm: an empty reply, then a repair that named the wrong tag); with think off there was no empty reply and no fallback, but all 7 of its invalid first replies named another utility's revenue tag (the host's tag check rejected each one and the repair fixed it).
- **The cards do not depend on the mode.** All 12 cards equal the published ones to the printed digit (FirstEnergy beta 0.5065, weather +8.2%, supported, high; AEP beta 0.5287, weather +8.9%, supported, high, one recast conflict), the four without a model included. That is by design, since every number is a deterministic tool output; it also means the model's measured contribution is the memo and the order of the steps, not the numbers.
- **The memo is the model's visible work.** With a model, 8 of 8 memos were the model's first draft (184 and 176 words) and passed the number and verdict checks; without one, the card carries the template memo (213 and 243 words).
- **The order of steps.** The model's pick equalled the checklist's next step in 31 of 33 model picks with think on and 30 of 34 with think off; the exceptions were the peers loaded before the revenue (five times) and the Not-tested list written before the weather (once), both orders the checklist allows.
- **No model is the floor:** 38.0 to 39.4 s, nearly all of it the two degree-day statements in Lightning SQL (about 18 s each) and the other gateway calls.
- **VRAM.** Peak whole-card memory was 7,111 to 7,145 MiB with think on and 6,918 to 6,981 MiB with think off, against 3,747 to 3,765 MiB with no model: the 4B model at context 8192 took about 3,170 to 3,400 MiB above the desktop level at its peak on this card. In every run with a model, the card's memory also fell to the desktop level once, for about 1.5 to 2 s, and came back: the model was unloaded and reloaded mid-run. The agent's host-RAM guard unloads the model when less than 2,048 MiB of host RAM is free (2,433 to 5,664 MiB was free at the start of these runs), which is the likely cause; its events are not written to the run file, so it is not confirmed.
- **Speed.** Median planner speed per run was 143.9 to 150.5 tok/s with think on and 147.2 to 152.3 with think off on 25 Oct, against 139.2 to 140.4 on the clean runs of 24 Oct, which stay the figures quoted elsewhere.
- **Not changed.** The shipped planner setting stays think on, because the code and the saved runs are frozen for judging. On this evidence think off would be the better default for this checklist; that is reported here rather than switched two days before the deadline.

## Pick = the checklist's next step, run by run (recount from the run files, 25 Oct 2026)

Counted from each saved run's timeline: a model pick "equals the checklist" when the tool it chose is the first not-yet-run step in the fallback order of `agent/src/loop/checklist.ts` (`resolve_utility`, `probe_revenue_tag`, `get_revenue`, `get_peers`, `get_weather`, `dq_gate`, `attribute`, `not_tested`, `finalize`; a warm run skips the tag probe from memory). Fallback steps are not model picks.

| Run set | Run | Utility | Model picks | Equal to the checklist | Exception |
|---|---|---|---|---|---|
| First settings, 24 Oct | `r20261024T203050a220` | FirstEnergy, cold | 9 | 9 | |
| | `r20261024T2034350adc` | AEP, cold | 9 | 9 | |
| | `r20261024T203648826a` | AEP, warm | 8 | 8 | |
| | `r20261024T20391416bf` | FirstEnergy, warm | 8 | 8 | |
| | `r20261024T204637522f` | FirstEnergy, warm (review) | 7 | 7 | |
| **Clean re-runs, 24 Oct** | `r20261024T213805fb4e` | FirstEnergy, cold (the README demo run) | 9 | 9 | |
| | `r20261024T214009cd85` | AEP, cold | 9 | 9 | |
| | `r20261024T214205a2e5` | FirstEnergy, warm | 8 | 8 | |
| | `r20261024T2145294e73` | AEP, warm | 8 | 7 | `get_peers` before `get_revenue` |
| Four other utilities, 25 Oct | `r20261025T115028c6c5` | Southern Co | 9 | 8 | `attribute` before `dq_gate` |
| | `r20261025T11524841a9` | Duke Energy | 9 | 9 | |
| | `r20261025T11542503bf` | Xcel Energy | 9 | 9 | |
| | `r20261025T1155534448` | Entergy | 9 | 8 | `get_peers` before `get_revenue` |
| Ablation, think on, 25 Oct | `r20261025T1158279a6a` | FirstEnergy, cold | 9 | 9 | |
| | `r20261025T1200096856` | AEP, cold | 9 | 9 | |
| | `r20261025T120204f6fe` | FirstEnergy, warm | 8 | 8 | |
| | `r20261025T120341bd7e` | AEP, warm | 7 | 5 | `get_peers` before `get_revenue`; `not_tested` before `get_weather` |
| Ablation, think off, 25 Oct | `r20261025T1205387bc9` | FirstEnergy, cold | 9 | 8 | `get_peers` before `get_revenue` |
| | `r20261025T12065254de` | AEP, cold | 9 | 8 | `get_peers` before `get_revenue` |
| | `r20261025T1208115888` | FirstEnergy, warm | 8 | 7 | `get_peers` before `get_revenue` |
| | `r20261025T1209241992` | AEP, warm | 8 | 7 | `get_peers` before `get_revenue` |

Totals: first settings 41 of 41 (34 of 34 over the first four); **clean re-runs 33 of 34** (the figure the README, the deck and the video quote); four other utilities 34 of 36; ablation think on 31 of 33, think off 30 of 34. Every exception is a step the host allowed at that point; the cards of the same question are identical across the run sets ("the same 12 cards to the printed digit" in the ablation above).

## The memo: Nemotron's measured job (25 Oct 2026)

The ablation above shows the numbers and the verdict do not depend on the model: with no model the deterministic fallback takes the checklist's steps and the cards are identical. What the model adds is the memo, and that is what is measured:

- **Numbers.** Every number in a draft must match a host-formatted tool output (string match at write time, `agent/src/llm/memo.ts`): 0 numbers outside the tool outputs in every saved draft (12 drafts over the nine evaluation runs; the four clean runs kept their first draft).
- **Verdict.** The draft must state the card's verdict and no other: 8 of the 9 evaluation-run memos pass (the ninth, from the first settings, says only "consistent with the claim"); 4 of 4 with think on and 4 of 4 with think off in the ablation; on the four other utilities, 2 of 4 runs fell back to the template memo because both drafts left out the verdict.
- **Labels (new, offline).** `agent/src/eval/memoBinding.ts` checks that each label a memo names (the like-for-like change, the degree-day change, the peer sensitivity, the weather part, the industry part, the remainder) is followed in the same sentence by the card's own value for that label, as the host formats it. Over every saved run with a memo (the nine evaluation runs, the four other utilities and the twelve ablation runs: 25 memos, 17 written by the model and 8 template memos):

```
npx tsx src/eval/memoBinding.ts <runs dir> ...
memos 25; every named label bound to its own value in 25
  like-for-like change: match 25, mismatch 0, absent 0
  degree-day change: match 25, mismatch 0, absent 0
  peer sensitivity (beta): match 25, mismatch 0, absent 0
  weather part: match 22, mismatch 0, absent 3
  industry part: match 23, mismatch 0, absent 2
  remainder: match 25, mismatch 0, absent 0
```

  "Absent" means the memo did not name that label with one of the listed words (three model memos say the weather "accounts for" the change instead); it is not a failure. The check runs on the saved run files, which stay local (`data/` is gitignored); on the committed sample run (`docs/sample-run/`, revenue levels masked) it is asserted in `agent/test/memo-binding.test.ts`, together with a memo whose industry and remainder figures are swapped, which it rejects.

**Which setting the evidence favours.** Think off: 72.5 s against 103.2 s per question, 27 of 34 JSON-valid first replies either way, 0 fallbacks against 1, the same cards and 4 of 4 model memos kept. The shipped planner setting stays think on only because the code and the saved runs were frozen for judging; `--think off` on the command line, or `WON_THINK=off` for every job, selects it.
