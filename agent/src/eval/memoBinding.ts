// Offline label-number binding check for saved memos. The memo check at write time
// (llm/memo.ts) proves every number is a tool output and the verdict is the card's; it does not
// prove the number sits next to the right label. This check does: for each label the memo names
// (the like-for-like change, the degree-day change, the peer sensitivity, the weather part, the
// industry part, the remainder), the first number after the label in the same sentence must be
// the card's own value for that label, formatted as the host formats it. A label the memo does
// not name is "absent", not a failure. No model, no gateway: it reads saved runs only.
//
//   npx tsx src/eval/memoBinding.ts <runs dir> [<runs dir> ...]   (each holding <run_id>/run.json)

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { num, pct } from "../loop/tools.ts";

export interface BindingCard {
  growth?: { g?: number | null } | null;
  weather?: { delta_w?: number | null } | null;
  attribution?: { beta?: number | null; weather?: number | null; industry?: number | null; remainder?: number | null } | null;
}

export interface BindingResult {
  label: string;
  expected: string[];
  found: string | null;
  status: "match" | "mismatch" | "absent";
}

const HY = "[\\s\\-\\u2010\\u2011]*";

interface Rule {
  label: string;
  re: RegExp;
  kind: "pct" | "plain";
  window: number;
  expected: (c: BindingCard) => string[];
}

const RULES: Rule[] = [
  { label: "like-for-like change", re: new RegExp(`like${HY}for${HY}like (?:change|growth)`, "giu"), kind: "pct", window: 30, expected: (c) => (typeof c.growth?.g === "number" ? [pct(c.growth.g)] : []) },
  { label: "degree-day change", re: new RegExp(`degree${HY}days?\\b`, "giu"), kind: "pct", window: 140, expected: (c) => (typeof c.weather?.delta_w === "number" ? [pct(c.weather.delta_w)] : []) },
  { label: "peer sensitivity (beta)", re: /\b(?:sensitivity|beta)\b/giu, kind: "plain", window: 90, expected: (c) => (typeof c.attribution?.beta === "number" ? [num(c.attribution.beta), num(c.attribution.beta, 3)] : []) },
  { label: "weather part", re: /\bweather (?:part|component|effect|share|contribution)\b/giu, kind: "pct", window: 40, expected: (c) => (typeof c.attribution?.weather === "number" ? [pct(c.attribution.weather)] : []) },
  { label: "industry part", re: new RegExp(`industry(?:${HY}wide)? (?:part|component|effect|share|contribution|median)`, "giu"), kind: "pct", window: 40, expected: (c) => (typeof c.attribution?.industry === "number" ? [pct(c.attribution.industry)] : []) },
  { label: "remainder", re: /\bremainder\b/giu, kind: "pct", window: 40, expected: (c) => (typeof c.attribution?.remainder === "number" ? [pct(c.attribution.remainder)] : []) },
];

const PCT_TOKEN = /[+\-−]?\d[\d,]*(?:\.\d+)?%/u;
const PLAIN_TOKEN = /(?<![\d.])[+\-−]?\d+\.\d+(?![\d%])/u;

/** The first number of the wanted kind after `at`, within `window` characters and the same sentence. */
function firstAfter(text: string, at: number, window: number, kind: Rule["kind"]): string | null {
  let tail = text.slice(at, at + window);
  const stop = /\.\s+[A-Z]/u.exec(tail);
  if (stop) tail = tail.slice(0, stop.index + 1);
  const m = (kind === "pct" ? PCT_TOKEN : PLAIN_TOKEN).exec(tail);
  return m ? m[0].replace("−", "-") : null;
}

/** Each label's binding in one memo: every occurrence of a named label must be followed by its own value. */
export function checkBinding(text: string, card: BindingCard): BindingResult[] {
  const out: BindingResult[] = [];
  for (const r of RULES) {
    const expected = r.expected(card);
    if (!expected.length) continue;
    let status: BindingResult["status"] = "absent";
    let found: string | null = null;
    for (const m of text.matchAll(r.re)) {
      const tok = firstAfter(text, m.index! + m[0].length, r.window, r.kind);
      if (tok === null) continue;
      found = tok;
      if (expected.includes(tok)) {
        if (status === "absent") status = "match";
      } else {
        status = "mismatch";
        break;
      }
    }
    out.push({ label: r.label, expected, found, status });
  }
  return out;
}

interface SavedMemoRun {
  run_id: string;
  card: BindingCard & { memo?: { text?: string; source?: string } | null };
}

function main(): void {
  const dirs = process.argv.slice(2);
  if (!dirs.length) {
    console.error("usage: npx tsx src/eval/memoBinding.ts <runs dir> [<runs dir> ...]");
    process.exit(2);
  }
  let memos = 0;
  let pass = 0;
  const byLabel = new Map<string, { match: number; mismatch: number; absent: number }>();
  for (const d of dirs) {
    for (const id of readdirSync(resolve(d)).filter((x) => /^r\d{8}T\d{6}[0-9a-f]{4}$/u.test(x)).sort()) {
      const p = join(resolve(d), id, "run.json");
      if (!existsSync(p)) continue;
      const run = JSON.parse(readFileSync(p, "utf8")) as SavedMemoRun;
      const memo = run.card.memo;
      if (!memo?.text) continue;
      memos += 1;
      const res = checkBinding(memo.text, run.card);
      const bad = res.filter((r) => r.status === "mismatch");
      if (!bad.length) pass += 1;
      for (const r of res) {
        const s = byLabel.get(r.label) ?? { match: 0, mismatch: 0, absent: 0 };
        s[r.status] += 1;
        byLabel.set(r.label, s);
      }
      console.log(`${run.run_id}\t${memo.source ?? "?"}\t${bad.length ? `MISMATCH ${bad.map((b) => `${b.label}: ${b.found} (card ${b.expected[0]})`).join("; ")}` : "ok"}\t${res.map((r) => `${r.label}=${r.status}`).join(", ")}`);
    }
  }
  console.log(`memos ${memos}; every named label bound to its own value in ${pass}`);
  for (const [k, s] of byLabel) console.log(`  ${k}: match ${s.match}, mismatch ${s.mismatch}, absent ${s.absent}`);
}

if (process.argv[1] && import.meta.url.toLowerCase() === pathToFileURL(resolve(process.argv[1])).href.toLowerCase()) main();
