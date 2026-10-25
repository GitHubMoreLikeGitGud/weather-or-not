# Weather-or-Not demo video: narration script

Spoken by a synthetic text-to-speech voice. Times are the start of each line in `weather-or-not-demo.mp4`; the burned-in captions and `weather-or-not-demo.srt` use the same text. Numbers are read from `docs/eval-report.md`, `docs/demo-case.md` or from the screen at that moment.

Where the video says more than the code does (the lines below stay as spoken, so they match the audio and the captions):

- **2:02.6** "the coverage_ok rule on weather_quarter gates every verdict": the gate reads that rule's onboarding result (`data/dq/latest.json`) and re-applies coverage at least 0.9 to the question's own stations; no DQ statement runs per question.
- **3:22.8** "0 memo numbers from the model": what is measured is 0 of 12 memo drafts with a number that is not a tool output.
- **Telemetry footer, 96 tokens/s:** the live run was recorded while a headless browser took screenshots of the page on the same machine; the 139.2 to 140.4 tokens/s in the README are the medians of the four clean runs, recorded without capture.

**0:00.6** Weather-or-Not. The utility says it was the weather. Weather-or-Not checks.

**0:05.6** A solo entry from Singapore.

**0:08.5** An analyst is handed a filing that credits colder weather. Checking it means peers, degree days, and a comparative column that a later filing can restate: American Electric Power's own 10-Q reports 5,463.4 million; the next year's restates it as 5,463.0. Rule R1 keeps the quarter's own filing and records the conflict.

**0:33.3** The analyst picks FirstEnergy, the first quarter of 2025, and the claim: colder weather.

**0:43.9** Each chunk streams as the local Nemotron model plans it. The planner's text is shown as a plan, never as a fact; only tool rows carry numbers.

**0:54.3** Degree days are computed in Lightning SQL, about 20 seconds a quarter; the whole question takes about two minutes.

**1:09.0** Revenue rose 14.5% like for like. Weather is consistent with 8.2 points of that, range 1.6 to 14.0; industry 2.9; the remainder 3.5. Supported, with high confidence: 39 peers, coverage 1.00, and the data-quality gate passed.

**1:34.0** Every figure is a button. The citation is the Lightning SQL itself: the statement, its hash, the rows, the Zetaris object, the endpoint, the licence and the retrieval time.

**1:48.1** In Zetaris Lightning, SEC EDGAR is a set of REST tables and NOAA GHCN-Daily a set of parquet tables; the weather_or_not_usl semantic layer joins them with keys and a data-quality rule.

**2:02.6** The layer has five tables with primary and foreign keys and nine data-quality rules; the coverage_ok rule on weather_quarter gates every verdict.

**2:13.4** Memory and why. The restatement is a conflict in H-MEM with both accession numbers; the why trace shows the fact's provenance and its trust ledger.

**2:26.5** The analyst can override rule R1 with a reason. The server signs a single-use high-risk contract, applies the override, and the ledger records who decided.

**2:39.5** The World Model keeps utilities, states, stations and filings as a graph whose edges carry the source's own dates.

**2:49.6** The footer is measured: the planner calls and how many were valid first try, prompt tokens per chunk flat against the full-history estimate, the median tokens a second, and zero cloud model calls.

**3:02.4** One data path: Zetaris Lightning is the only route to SEC EDGAR, NOAA and the SIC list, and the gateway's named templates are the only SQL. Meterless engines run the chain, the memory and the world model. Nemotron plans and writes on one local GPU, and never computes a number.

**3:22.8** Measured over nine runs: 171 of 171 card claims cited; join map 6 of 6; 300 of 300 bootstrap resamples; 64 of 76 planner calls valid first try, 1 fallback; 0 memo numbers from the model; 0 cloud calls.

**3:42.1** Weather-or-Not. Every number is cited, and every override is signed.
