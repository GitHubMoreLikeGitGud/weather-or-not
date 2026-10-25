# Weather-or-Not demo video v2: narration script

Spoken by a synthetic text-to-speech voice. Times are the start of each line in `weather-or-not-demo-v2.mp4`; the burned-in captions and `weather-or-not-demo-v2.srt` use the same text. Shots are in [`shotlist-v2.md`](shotlist-v2.md).

**0:00.3** FirstEnergy's first-quarter 10-Q credits colder weather: heating degree days up 15%. Revenue rose 14.5%. How much of that was the weather?

**0:11.2** The answer: weather is consistent with 8.2 of those points, a bit over half. Supported, but with a wide range.

**0:19.0** A solo entry from Singapore.

**0:22.0** The analyst picks FirstEnergy, the first quarter of 2025, and the claim: colder weather.

**0:32.2** Each chunk streams as the local Nemotron model plans it. The planner's text is shown as a plan, never as a fact; only tool rows carry numbers.

**0:43.3** Degree days are computed in Lightning SQL, about 20 seconds a quarter; the whole question takes about two minutes.

**0:56.4** On the clean runs, the model's pick matched the checklist's own order in 33 of 34 calls; its real job is valid plans and the memo.

**1:11.5** Revenue rose 14.5% like for like. Weather is consistent with 8.2 of those points, so the claim is supported. But the range is wide, 1.6 to 14.0: high confidence means the weather effect is above zero, not that 8.2 is precise. Industry-wide, 2.9; company-specific, 3.5.

**1:33.5** The filing says heating degree days rose 15%; the agent's nine stations show total degree days up 16.2%: a check on a number the agent did not compute.

**1:44.8** The memo is the model's own writing: every number in it matched a tool output, it states the verdict, and it lists what was not tested.

**1:55.4** Every figure is a button. The citation is the Lightning SQL itself, with its hash, the rows, the Zetaris object, the endpoint, the licence and the time.

**2:07.1** A later filing's restatement is recorded, never applied silently: at American Electric Power it is 0.4 million, tiny here, decisive when material. An override needs a signed, single-use contract.

**2:22.9** The same question for Southern Company: revenue rose 17.0%, and weather is consistent with 6.6 points of it, so the claim is only partly supported. The company-specific part is larger.

**2:36.2** In Zetaris Lightning, SEC EDGAR is a set of REST tables and NOAA a set of parquet tables; the semantic layer adds keys and quality rules, and its coverage result gates the verdict.

**2:48.6** The footer is measured. It reads 96 tokens a second because the screen recorder shared the machine; runs without capture measured 139 to 140.

**2:58.3** One data path, through Zetaris. Meterless engines run the chain, the memory and the world model; Nemotron plans and writes on one local GPU.

**3:08.0** Measured: 171 of 171 claims cited, one card from five runs, zero cloud calls.

**3:16.2** Weather-or-Not. Every number is cited, and every override is signed.

## Where each spoken number comes from

| Spoken | Source |
| --- | --- |
| heating degree days up 15% (FirstEnergy's 10-Q) | `docs/demo-case.md`, the hand check of accession 0001031296-25-000017 |
| revenue +14.5%; weather 8.2 of those points, range 1.6 to 14.0; industry-wide 2.9; company-specific 3.5; "a bit over half" (ratio 0.564) | `README.md` "Measured on the demo case", `docs/demo-case.md`, the card on screen |
| what high confidence means | `README.md` ("The demo result"), the card's confidence sentence |
| total degree days +16.2% over nine stations | `docs/demo-case.md`, the card on screen |
| about 20 seconds a quarter; about two minutes a question | `docs/demo-case.md` (20.0 and 21.0 s), `README.md` (97.5 to 128.1 s) |
| 33 of 34 planner picks on the clean runs | `README.md` (NVIDIA bullet and "What it does") |
| 0.4 million restatement at American Electric Power (5,463.4 against 5,463.0 million) | `README.md`, `docs/demo-case.md` |
| Southern Co: revenue +17.0%, weather 6.6 points, partly supported, company-specific part (+7.6) larger | `README.md` table "Four other utilities, same quarter", `docs/eval-report.md` section 8 |
| 96 tokens a second under capture; 139 to 140 without | `README.md` NVIDIA section (139.2 to 140.4 on the four clean runs) |
| 171 of 171 claims cited; one card from five runs; zero cloud calls | `README.md`, `docs/eval-report.md` section 6 |
