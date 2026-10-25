// The Evaluation screen's pure render (ui/views/eval.js) on the committed docs/eval-report.json:
// the attribution panel labels the remainder range as combined bounds, not a percentile. And the
// committed sweep of every eligible seed (docs/eval/seeds-cy2025q1.json) as one panel above it.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const EVAL_URL = new URL("../../ui/views/eval.js", import.meta.url).href;
const { renderReport, renderSweep } = (await import(/* @vite-ignore */ EVAL_URL)) as { renderReport: (rep: unknown) => string; renderSweep: (sw: unknown) => string };

const REPORT = JSON.parse(readFileSync(new URL("../../docs/eval-report.json", import.meta.url), "utf8")) as unknown;
const SWEEP = JSON.parse(readFileSync(new URL("../../docs/eval/seeds-cy2025q1.json", import.meta.url), "utf8")) as { runs: unknown[] };

const text = (html: string) => html.replace(/<[^>]+>/gu, " ").replace(/\s+/gu, " ");

describe("the evaluation screen", () => {
  it("labels the remainder range on the committed report as combined bounds, not a percentile", () => {
    const t = text(renderReport(REPORT));
    expect(t).toContain("Attribution per utility");
    expect(t).toContain("the beta, weather and industry ranges are the 10th to 90th percentile of the peer bootstrap; the remainder range combines the weather and industry bounds, so it is wider than a percentile");
    expect(t).toMatch(/Remainder \[range\]/u);
  });

  it("shows the committed sweep: 18 / 11 / 12 of 41, one row per eligible run, the two controls named", () => {
    const html = renderSweep(SWEEP);
    const t = text(html);
    expect(t).toContain("Every eligible seed utility, CY2025Q1 against CY2024Q1");
    expect(t).toMatch(/18 supported 11 partly supported 12 not supported 0 withheld or failed 40 \/ 41 confidence high/u);
    expect(html.match(/<tr>/gu)?.length).toBe(1 + 41);
    expect(t).toContain("HAWAIIAN ELECTRIC INDUSTRIES INC r20261026T000137f70d -6.1% +20.0% (1) +12.9% [+5.3%, +20.3%] -20.8% [-34.0%, -7.6%] 2.14 not supported high 1 recast conflict(s)");
    expect(t).toContain("Not eligible, run last as controls: IDACORP INC (withheld: no like-for-like revenue); ONCOR ELECTRIC DELIVERY CO LLC (withheld: no like-for-like revenue).");
    expect(renderSweep(null)).toBe("");
  });
});
