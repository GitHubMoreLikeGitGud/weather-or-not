// The telemetry footer's pure render (ui/views/telemetry.js) on the committed sample run: the prompt
// saving it prints compares the measured prompts with the full-history estimate, and the
// estimate-against-estimate figure stays in the tooltip.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const URL_ = new URL("../../ui/views/telemetry.js", import.meta.url).href;
const { renderFooter, measuredSaving } = (await import(/* @vite-ignore */ URL_)) as {
  renderFooter: (t: unknown) => string;
  measuredSaving: (chart: unknown) => number | null;
};

const run = JSON.parse(readFileSync(new URL("../../docs/sample-run/r20261024T213805fb4e.json", import.meta.url), "utf8")) as {
  chart: { markovian_prompt_tokens_measured: number; naive_prompt_tokens_estimated: number }[];
  summary: { saving_vs_naive_estimated: number };
};

describe("the telemetry footer", () => {
  it("prints the measured prompts against the estimate (7,770 against 12,956: 40% less), not estimate against estimate", () => {
    const measured = run.chart.reduce((a, p) => a + p.markovian_prompt_tokens_measured, 0);
    const naive = run.chart.reduce((a, p) => a + p.naive_prompt_tokens_estimated, 0);
    expect([measured, naive]).toEqual([7770, 12956]);
    expect(measuredSaving(run.chart)).toBe(0.4);
    expect(run.summary.saving_vs_naive_estimated).toBe(0.489);
    const html = renderFooter(run);
    expect(html).toContain("naive est.</span>, 40% less");
    expect(html).toContain("estimate against estimate it is 49%");
    expect(measuredSaving([])).toBeNull();
  });
});
