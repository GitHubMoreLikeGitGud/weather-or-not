// Offline robustness check of a saved card: the same attribute() the agent runs (seed 7, 300
// resamples), on the saved growth (g) and degree-day change (dw) of the target and its peers.
// It drops each peer in turn (leave-one-out), drops named peer groups, and recomputes the
// heating-only degree-day change from the saved weather rows. No model, no gateway: it reads one
// saved run. The committed output is docs/eval/robustness-sample-run.json.
//
//   npx tsx src/eval/robustness.ts [<run.json>] [--out <file>]
//   (default: the committed sample run, docs/sample-run/r20261024T213805fb4e.json)

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { attribute, type Attribution, type PeerPoint, type TargetPoint } from "../tools/attribution.ts";

export const SAMPLE_RUN = fileURLToPath(new URL("../../../docs/sample-run/r20261024T213805fb4e.json", import.meta.url));

/** Peer groups dropped together. Vistra, NRG and Constellation file under SIC 4911 like the others,
 * but most of their revenue comes from competitive generation and retail rather than regulated supply. */
export const PEER_GROUPS: { label: string; ciks: string[] }[] = [
  { label: "without Vistra, NRG and Constellation", ciks: ["0001692819", "0001013871", "0001868275"] },
];

interface SavedPeer extends PeerPoint {
  name: string;
}

export interface SavedRun {
  run_id: string;
  period: string;
  previous_period: string;
  card: {
    utility: { cik: string; name: string; stations: string[] };
    weather: { delta_w: number };
    peers: { list: SavedPeer[] };
    attribution: Attribution;
  };
  evidence: { template_id?: string; params?: Record<string, string>; columns?: string[]; rows?: unknown[][] }[];
}

const r6 = (x: number | null): number | null => (x === null ? null : Number(x.toFixed(6)));

export interface CardSummary {
  peers: number;
  beta: number | null;
  beta_range: [number | null, number | null];
  weather: number | null;
  weather_range: [number | null, number | null];
  ratio: number | null;
  verdict: string;
  confidence: string;
}

function summary(a: Attribution): CardSummary {
  return {
    peers: a.peers,
    beta: r6(a.beta),
    beta_range: [r6(a.ranges.beta.lo), r6(a.ranges.beta.hi)],
    weather: r6(a.weather),
    weather_range: [r6(a.ranges.weather.lo), r6(a.ranges.weather.hi)],
    ratio: r6(a.claim.ratio),
    verdict: a.claim.verdict,
    confidence: a.confidence,
  };
}

function count<T extends string>(xs: T[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const x of xs) out[x] = (out[x] ?? 0) + 1;
  return out;
}

/** Mean HDD and CDD over the utility's stations for one quarter, from a saved weather_quarter record. */
function stationMeans(run: SavedRun, period: string): { hdd: number; cdd: number; stations: number } {
  const m = /^CY(\d{4})Q([1-4])$/u.exec(period);
  if (!m) throw new Error(`unexpected period ${period}`);
  const ev = run.evidence.find((e) => e.template_id === "weather_quarter" && e.params?.year === m[1] && e.params?.quarter === m[2]);
  if (!ev?.columns || !ev.rows) throw new Error(`no weather_quarter evidence for ${period}`);
  const col = (k: string) => ev.columns!.indexOf(k);
  const [iSt, iH, iC] = [col("station_id"), col("hdd"), col("cdd")];
  const want = new Set(run.card.utility.stations);
  const rows = ev.rows.filter((r) => want.has(String(r[iSt])));
  if (rows.length !== want.size) throw new Error(`${period}: ${rows.length} of ${want.size} stations in the saved rows`);
  const mean = (i: number) => rows.reduce((s, r) => s + Number(r[i]), 0) / rows.length;
  return { hdd: mean(iH), cdd: mean(iC), stations: rows.length };
}

export function robustness(run: SavedRun) {
  const a = run.card.attribution;
  const target: TargetPoint = { cik: a.target.cik, g: a.target.g, dw: a.target.dw, coverage: a.target.coverage };
  const peers: SavedPeer[] = run.card.peers.list.map((p) => ({ cik: p.cik, name: p.name, g: Number(p.g), dw: Number(p.dw) }));
  const point = (ps: SavedPeer[]): PeerPoint[] => ps.map((p) => ({ cik: p.cik, g: p.g, dw: p.dw }));

  const full = attribute(target, point(peers));
  const saved = summary(a);
  const fresh = summary(full);

  const loo = peers.map((p) => ({ dropped: p.name, cik: p.cik, ...summary(attribute(target, point(peers.filter((q) => q.cik !== p.cik)))) }));
  const ratios = loo.map((r) => r.ratio ?? 0);
  const betas = loo.map((r) => r.beta ?? 0);

  const groups = PEER_GROUPS.map((gr) => {
    const kept = peers.filter((p) => !gr.ciks.includes(p.cik));
    return { label: gr.label, dropped: peers.filter((p) => gr.ciks.includes(p.cik)).map((p) => p.name), ...summary(attribute(target, point(kept))) };
  });

  const cur = stationMeans(run, run.period);
  const prev = stationMeans(run, run.previous_period);

  return {
    source: "docs/sample-run/" + run.run_id + ".json",
    run_id: run.run_id,
    utility: run.card.utility.name,
    method: "attribute() from agent/src/tools/attribution.ts (OLS slope, 300 bootstrap resamples, seed 7, 10th to 90th percentile) on the saved g and dw of the target and its peers; no model, no gateway",
    target: { g: r6(target.g), dw: r6(target.dw) },
    full: { ...fresh, equals_saved_card: JSON.stringify(fresh) === JSON.stringify(saved), weather_range_share_of_change: [r6(full.ranges.weather.lo / target.g), r6(full.ranges.weather.hi / target.g)] },
    leave_one_out: {
      runs: loo.length,
      verdicts: count(loo.map((r) => r.verdict)),
      confidence: count(loo.map((r) => r.confidence)),
      ratio_min: r6(Math.min(...ratios)),
      ratio_max: r6(Math.max(...ratios)),
      beta_min: r6(Math.min(...betas)),
      beta_max: r6(Math.max(...betas)),
      changed: loo.filter((r) => r.verdict !== fresh.verdict || r.confidence !== fresh.confidence),
      all: loo,
    },
    peer_groups: groups,
    degree_days_over_the_utility_stations: {
      stations: cur.stations,
      hdd: [r6(prev.hdd), r6(cur.hdd)],
      hdd_change: r6(cur.hdd / prev.hdd - 1),
      cdd: [r6(prev.cdd), r6(cur.cdd)],
      hdd_plus_cdd_change: r6((cur.hdd + cur.cdd) / (prev.hdd + prev.cdd) - 1),
      card_delta_w: r6(run.card.weather.delta_w),
      periods: [run.previous_period, run.period],
    },
  };
}

function main(): void {
  const args = process.argv.slice(2);
  const outAt = args.indexOf("--out");
  const out = outAt >= 0 ? args[outAt + 1] : null;
  const path = args.find((x, i) => !x.startsWith("--") && (outAt < 0 || i !== outAt + 1)) ?? SAMPLE_RUN;
  const run = JSON.parse(readFileSync(resolve(path), "utf8")) as SavedRun;
  const res = robustness(run);
  const pct = (x: number | null) => (x === null ? "n/a" : `${x >= 0 ? "+" : ""}${(x * 100).toFixed(1)}%`);
  const f = res.full;
  console.log(`${res.utility} ${res.run_id}: ${f.peers} peers, beta ${f.beta?.toFixed(3)}, weather ${pct(f.weather)}, ratio ${f.ratio?.toFixed(3)}, ${f.verdict}, ${f.confidence}; equals the saved card: ${f.equals_saved_card}`);
  console.log(`  weather range as a share of the change: ${pct(f.weather_range_share_of_change[0])} to ${pct(f.weather_range_share_of_change[1])}`);
  const l = res.leave_one_out;
  console.log(`  leave one peer out (${l.runs} runs): ${Object.entries(l.verdicts).map(([k, v]) => `${k} ${v}`).join(", ")}; confidence ${Object.entries(l.confidence).map(([k, v]) => `${k} ${v}`).join(", ")}; ratio ${l.ratio_min?.toFixed(3)} to ${l.ratio_max?.toFixed(3)}; beta ${l.beta_min?.toFixed(3)} to ${l.beta_max?.toFixed(3)}`);
  for (const c of l.changed) console.log(`    without ${c.dropped}: ratio ${c.ratio?.toFixed(3)}, ${c.verdict}, ${c.confidence} (beta ${c.beta?.toFixed(3)}, range ${c.beta_range[0]?.toFixed(3)} to ${c.beta_range[1]?.toFixed(3)})`);
  for (const g of res.peer_groups) console.log(`  ${g.label}: ${g.peers} peers, beta ${g.beta?.toFixed(3)} (${g.beta_range[0]?.toFixed(3)} to ${g.beta_range[1]?.toFixed(3)}), weather ${pct(g.weather)} (${pct(g.weather_range[0])} to ${pct(g.weather_range[1])}), ratio ${g.ratio?.toFixed(3)}, ${g.verdict}, ${g.confidence}`);
  const d = res.degree_days_over_the_utility_stations;
  console.log(`  ${d.stations} stations, ${d.periods.join(" to ")}: heating degree days ${pct(d.hdd_change)} (${d.hdd[0]?.toFixed(1)} to ${d.hdd[1]?.toFixed(1)}); cooling ${d.cdd[0]?.toFixed(1)} to ${d.cdd[1]?.toFixed(1)}; heating plus cooling ${pct(d.hdd_plus_cdd_change)} (card ${pct(d.card_delta_w)})`);
  if (out) {
    writeFileSync(resolve(out), JSON.stringify(res, null, 2) + "\n", "utf8");
    console.log(`wrote ${out}`);
  }
}

if (process.argv[1] && import.meta.url.toLowerCase() === pathToFileURL(resolve(process.argv[1])).href.toLowerCase()) main();
