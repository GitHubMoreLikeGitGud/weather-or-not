# C2: Attribution (peer set, OLS and Theil-Sen slope, seeded bootstrap, three-way split, confidence, claim verdict)

## Goal

`agent/src/tools/attribution.ts` exists and is unit-tested: it builds the peer set from revenue rows with recorded exclusions, estimates the weather sensitivity of revenue growth across peers (OLS slope with a Theil-Sen cross-check), splits a target utility's growth into a weather part, an industry part and a company-specific remainder, attaches 10th-90th percentile bootstrap ranges from a seeded PRNG, labels confidence, and tests management's "it was the weather" claim. No model calls, no network, no randomness other than the seeded PRNG.

## Workspace

This repository (`agent/` is the Node 22 + TypeScript package; run commands from `agent/`). Other work may be in progress in the working tree while this task runs. Leave every file that is not under **Deliverables** alone.

## Read first

- `.cursor/rules/style.mdc` and `.cursor/rules/safety.mdc` (inherited from the sister project; the language, style, test and commit rules apply). `AGENTS.md` does not exist yet; skip it.
- `agent/tsconfig.json`, `agent/tsconfig.tools.json`, `agent/package.json`.
- `agent/test/fixtures/attribution.json` (the fixture; described under **Inputs**) and `agent/test/fixtures/make_fixtures.py` (how the expected numbers were produced, including a bit-exact Python replica of the PRNG; read it to understand the fixture, do not port its code).
- `agent/src/tools/degreeDays.ts` if it exists (C1): the shapes `UtilityTdd` and `utilityWeatherChange` produce the `dw` and `coverage` inputs of this task. Do not import it; this module takes plain numbers.
- `agent/test/gtin.test.ts` for the test style.

`npx vitest run` with no filter also runs suites inherited from the sister project that fail here because their modules were not copied. That is known and out of scope: never edit, delete or "fix" them. Run only the filtered command under **Checks**.

## Inputs

### The method (fixed in advance; implement exactly this)

Inputs: target utility T with growth `g_T`, weather change `dw_T` and `coverage`; peers p with `g_p` and `dw_p`.

1. **Peer set** from revenue rows `{cik, sic, rev_current, rev_previous}`: keep every filer that is not T, is in the seed list (so its states are known), has SIC 4911, 4931 or 4932, has both periods present with `rev_previous > 0`, and has `|g_p| < 0.60` where `g_p = (rev_current - rev_previous) / rev_previous`. Record each drop as `excluded: <reason>` (exact strings below). Target is at least 20 peers; fewer than 12 makes confidence low (step 6).
2. **Sensitivity.** `beta` = OLS slope of `g_p` on `dw_p` across peers (with intercept): `beta = sum((x - xbar) * (y - ybar)) / sum((x - xbar)^2)`. Cross-check: Theil-Sen slope = median of the pairwise slopes `(y_j - y_i) / (x_j - x_i)` over `i < j` with `x_j != x_i`. Both are reported; `beta` (OLS) drives the split.
3. **Weather part** of T = `beta * dw_T`.
4. **Industry part** = median over peers of `(g_p - beta * dw_p)`.
5. **Company-specific remainder** = `g_T - weather - industry`.
6. **Ranges.** Bootstrap over peers: 300 resamples; for each, draw n indices with replacement (`Math.floor(rng() * n)`, in order, where n is the peer count) from the PRNG below seeded with 7; recompute `beta_b` on the resample; skip a resample whose x values have zero variance (fewer than two distinct `dw`) without drawing anything else; `weather_b = beta_b * dw_T`; `industry_b` = median over the resample of `(g - beta_b * dw)`. Ranges are the 10th and 90th percentiles (type 7, linear interpolation: with sorted values v[0..m-1], `h = (m - 1) * p`, `lo = floor(h)`, `value = v[lo] + (h - lo) * (v[min(lo + 1, m - 1)] - v[lo])`) over the valid resamples, for `beta`, `weather` and `industry`. The remainder range comes from the other two: `remainder.lo = g_T - weather.hi - industry.hi`, `remainder.hi = g_T - weather.lo - industry.lo`.
7. **Confidence**: `high` if peers >= 20 and `coverage >= 0.95` and the `beta` range excludes 0 (`lo > 0` or `hi < 0`); otherwise `medium` if peers >= 12 and `coverage >= 0.9`; otherwise `low`.
8. **Claim verdict** on "management says weather": `ratio = |weather| / |g_T|`. `supported` if weather has the same sign as `g_T` and `ratio >= 0.5`; `partly supported` if the same sign and `0.2 <= ratio < 0.5`; `not supported` otherwise (opposite sign, `ratio < 0.2`, or `g_T = 0`, where `ratio` is `null`).

### Seeded PRNG (required, exactly this)

mulberry32, seed 7, the standard form:

```ts
export function mulberry32(seed: number): () => number {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
```

From seed 7 the first five values are `0.011704753153026104, 0.06195825757458806, 0.97690763277933, 0.6990287057124078, 0.5214452685322613` (also in the fixture as `prng_seed7_first5`).

### Fixture `agent/test/fixtures/attribution.json`

Synthetic. Keys:

- `prng_seed7_first5`: the five values above.
- `cases[0]` "three-peer hand case": `target {cik, g: 0.09, dw: 0.08, coverage: 0.97}`, peers `(dw, g)` = (-0.10, -0.05), (0.00, 0.01), (0.10, 0.10). Hand computation: xbar 0, ybar 0.02, Sxy = 0.015, Sxx = 0.02, `beta = 0.75`; pairwise slopes 0.6, 0.75, 0.9 so Theil-Sen 0.75; weather = 0.06; residuals 0.025, 0.01, 0.025 so industry = 0.025; remainder = 0.005; ratio 0.6667 → `supported`; 3 peers → `low`. `expected` holds these plus the bootstrap block `{resamples: 300, valid: 293, skipped_zero_variance: 7, beta: {lo, hi}, weather: {lo, hi}, industry: {lo, hi}, remainder: {lo, hi}}` computed with the PRNG and rules above (beta range is [0.6, 0.9]).
- `cases[1]` "thirty-peer synthetic case": 30 peers with `dw` from -0.15 to 0.14 and `g` close to `0.8 * dw + 0.02`; target `g 0.11, dw 0.10, coverage 0.97`. `expected` holds `beta` (about 0.825), `theil_sen`, `weather`, `industry`, `remainder`, the bootstrap block (300 valid), `claim_ratio`, `claim_verdict` (`supported`), `beta_interval_excludes_zero` (true) and `confidence` (`high`).
- `peer_set`: `target_cik`, `seed_ciks`, eight `rows` and the exact `expected_peers` (`cik`, `g`) and `expected_excluded` (`cik`, `reason`) lists. Reasons, exact text: `excluded: target`, `excluded: not in seed list`, `excluded: SIC 4941 not in 4911, 4931, 4932`, `excluded: previous period missing` (also `excluded: current period missing` and `excluded: previous revenue not positive` for those cases), `excluded: |g| >= 60% (0.7000)` (`g` with four decimals). Check order: target, seed list, SIC, missing or non-positive periods, `|g|`.
- `confidence_cases[]`: `{peers, coverage, beta_lo, beta_hi, expected}`.
- `claim_cases[]`: `{g, weather, expected, ratio}` (`ratio` is `null` when `g` is 0).

Read it in the test with `JSON.parse(readFileSync(new URL("./fixtures/attribution.json", import.meta.url), "utf8"))`.

## Deliverables

| File | Contents |
|---|---|
| `agent/src/tools/attribution.ts` | The module below. |
| `agent/test/attribution.test.ts` | vitest suite with at least the cases below. |

### attribution.ts

Exports (names fixed; the agent lane imports them):

- `mulberry32(seed: number): () => number` as above.
- `median(values: number[]): number` (throws on empty; even count → mean of the two middle values), `percentile(values: number[], p: number): number` (type 7 as above; throws on empty), `olsSlope(xs: number[], ys: number[]): number | null` (null when fewer than 2 points or `Sxx` is 0), `theilSen(xs: number[], ys: number[]): number | null` (null when no pair has distinct x).
- `PEER_SICS = ["4911", "4931", "4932"]`, `MAX_ABS_PEER_GROWTH = 0.6`.
- `interface RevenueRow { cik: string; sic: string | null; rev_current: number | null; rev_previous: number | null }`, `interface PeerGrowth { cik: string; g: number; rev_current: number; rev_previous: number }`, `interface Exclusion { cik: string; reason: string }`.
- `peerSet(rows: RevenueRow[], targetCik: string, seedCiks: string[]): { peers: PeerGrowth[]; excluded: Exclusion[] }` — rule 1; input order kept.
- `interface PeerPoint { cik: string; g: number; dw: number }`, `interface TargetPoint extends PeerPoint { coverage: number }`, `interface Range { lo: number; hi: number }`.
- `type Confidence = "high" | "medium" | "low"`, `type ClaimVerdict = "supported" | "partly supported" | "not supported"`.
- `confidenceLabel(peers: number, coverage: number, betaRange: Range): Confidence` — rule 7.
- `claimVerdict(g: number, weather: number): { ratio: number | null; verdict: ClaimVerdict }` — rule 8.
- `interface Attribution { target: TargetPoint; peers: number; beta: number; theil_sen: number | null; weather: number; industry: number; remainder: number; ranges: { beta: Range; weather: Range; industry: Range; remainder: Range }; bootstrap: { resamples: number; valid: number; skipped_zero_variance: number; seed: number }; coverage: number; confidence: Confidence; claim: { ratio: number | null; verdict: ClaimVerdict } }`.
- `attribute(target: TargetPoint, peers: PeerPoint[], options?: { resamples?: number; seed?: number }): Attribution` — rules 2 to 8 with defaults 300 and 7; throws when fewer than 2 peers, when `Sxx` is 0, or when no resample is valid.

### Test cases that must exist (`agent/test/attribution.test.ts`)

- `mulberry32(7)` produces `prng_seed7_first5` exactly (`toBe`); two generators from the same seed agree; seed 8 differs.
- `median([3, 1, 2])` is 2, `median([1, 2, 3, 4])` is 2.5, empty throws; `percentile([1, 2, 3, 4, 5], 0.1)` is 1.4 and `percentile(..., 0.9)` is 4.6 (hand: h = 0.4 and 3.6).
- `olsSlope` and `theilSen` on the three-peer `dw`/`g` arrays give 0.75 and 0.75; `olsSlope([1, 1, 1], [1, 2, 3])` and `theilSen` on the same are null.
- `attribute` on `cases[0]`: `beta`, `theil_sen`, `weather`, `industry`, `remainder` within 1e-12 of 0.75, 0.75, 0.06, 0.025, 0.005; every `ranges` bound within 1e-9 of `expected.bootstrap`; `bootstrap.valid` 293 and `skipped_zero_variance` 7; `confidence` `low`; `claim.verdict` `supported` with `ratio` within 1e-12 of 0.06 / 0.09.
- `attribute` on `cases[1]`: every point estimate and range bound within 1e-9 of `expected`; `confidence` `high`; `claim.verdict` `supported`.
- Determinism: calling `attribute` twice gives deep-equal results; `seed: 8` changes at least one range bound.
- `confidenceLabel` reproduces every `confidence_cases[]` entry; `claimVerdict` reproduces every `claim_cases[]` entry (`ratio` within 1e-12, or null).
- `peerSet` on `peer_set` gives exactly `expected_peers` (`g` within 1e-12, same order) and `expected_excluded` (same reasons, same order).
- `attribute` throws with one peer and with peers whose `dw` are all equal.

## Constraints

- No model calls, no network, no `Math.random`, no new dependencies, nothing added to `package.json`. Pure functions. ES modules, TypeScript run by tsx; `node:` builtins only.
- The fixture files and `make_fixtures.py` are inputs: do not edit or regenerate them.
- Do not edit `engines/`, `gateway/`, `zetaris/`, `.env.local`, `agent/package.json`, `agent/tsconfig.json`, `agent/tsconfig.tools.json`, `agent/src/tools/degreeDays.ts`, the existing tests, or anything outside **Deliverables**.

## Checks

From `agent/`:

- `npx vitest run attribution` is green.
- `npx tsc --noEmit -p tsconfig.tools.json` reports no errors.

## Out of scope

Fetching revenue or weather numbers (they come from Lightning SQL through the gateway), the memo text, the UI bars, degree days (C1), SEC parsing (C3), and the inherited failing suites.

## Commit

Do not run `git commit`; leave the changes in the working tree. The reviewer commits them, by explicit path, as:

`C2: attribution with seeded bootstrap, confidence labels and claim verdict (Cursor Agent)`

## Run record (2026-10-24)

Cursor Agent CLI 2026.10.22, model `Auto`, headless, workspace = this repository. The run wrote both deliverables (`attribution.ts` 309 lines, `attribution.test.ts` 238 lines, 13 tests), ran the two checks green and left the changes uncommitted as asked. Wall time 198.1 s, exit code 0. Committed unchanged as `4d83e2e`.

Review against the method: the PRNG is the required form and reproduces the fixture's first five values exactly; OLS, Theil-Sen, the peer-set exclusions and their wording, the resampling order, the zero-variance skip, the type-7 percentiles, the remainder range, the confidence rules and the three-way split are as specified; both fixture cases reproduce to 1e-9. Checks re-run by the reviewer: 13 passed, `tsc` clean.

Reviewer change, in a separate commit (`1ced57c`): `claimVerdict` compared the ratio to the thresholds with a 1e-15 allowance, added because the fixture's boundary case `0.02 / 0.10` is 0.19999999999999998 in floating point. That was a defect in the fixture, not in the reading of the rule: the thresholds are now compared exactly and the fixture's boundary cases use ratios that are exact in binary floating point (0.25 / 0.5 and 0.2 / 1.0); `make_fixtures.py` was edited and the fixtures regenerated (only `attribution.json` changed). After the review: 13 passed, `tsc` clean.
