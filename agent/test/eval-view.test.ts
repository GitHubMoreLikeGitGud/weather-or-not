// The Evaluation screen's pure render (ui/views/eval.js) on the committed docs/eval-report.json:
// the attribution panel labels the remainder range as combined bounds, not a percentile.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const EVAL_URL = new URL("../../ui/views/eval.js", import.meta.url).href;
const { renderReport } = (await import(/* @vite-ignore */ EVAL_URL)) as { renderReport: (rep: unknown) => string };

const REPORT = JSON.parse(readFileSync(new URL("../../docs/eval-report.json", import.meta.url), "utf8")) as unknown;

describe("the evaluation screen", () => {
  it("labels the remainder range on the committed report as combined bounds, not a percentile", () => {
    const t = renderReport(REPORT).replace(/<[^>]+>/gu, " ").replace(/\s+/gu, " ");
    expect(t).toContain("Attribution per utility");
    expect(t).toContain("the beta, weather and industry ranges are the 10th to 90th percentile of the peer bootstrap; the remainder range combines the weather and industry bounds, so it is wider than a percentile");
    expect(t).toMatch(/Remainder \[range\]/u);
  });
});
