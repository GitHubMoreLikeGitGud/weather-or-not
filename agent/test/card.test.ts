// The answer card's pure render (ui/views/card.js) on the committed sample run and on synthetic
// variants of it: the range labels, the overshoot flag (display only) and the withheld layout,
// which must leave no empty template slot.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const CARD_URL = new URL("../../ui/views/card.js", import.meta.url).href;
const { renderCard, verdictSentence, overshootNote } = (await import(/* @vite-ignore */ CARD_URL)) as {
  renderCard: (run: unknown) => string;
  verdictSentence: (card: unknown) => string;
  overshootNote: (card: unknown) => string | null;
};

const SAMPLE = JSON.parse(readFileSync(new URL("../../docs/sample-run/r20261024T213805fb4e.json", import.meta.url), "utf8")) as Record<string, any>;
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

/** The visible text of the card: tags stripped, whitespace collapsed. */
function text(html: string): string {
  return html.replace(/<[^>]+>/gu, " ").replace(/\s+/gu, " ");
}

/** Template slots that rendered empty: "of  of", "(seed )", "= :", "change of cannot", "range  to". */
const EMPTY_SLOTS = [/\bof\s+of\b/u, /\(seed\s*\)/u, /=\s*:/u, /change of\s+cannot/u, /range\s+to\s*;/u, /Theil-Sen\s*\)/u, /Confidence\s*;/u, /station coverage\s*\./u];

describe("the answer card", () => {
  it("renders the committed sample run with the corrected range labels and the masked levels", () => {
    const html = renderCard(SAMPLE);
    const t = text(html);
    expect(t).toContain("the weather and industry ranges are the 10th to 90th percentile of 300 of 300 peer resamples (seed 7)");
    expect(t).toContain("the remainder range combines their bounds");
    expect(t).toContain("Committed sample run.");
    expect(t).toContain("revenue levels masked in this committed sample");
    expect(t).toMatch(/\+14\.5%/u);
    expect(html).not.toContain('data-overshoot="yes"');
    for (const re of EMPTY_SLOTS) expect(t).not.toMatch(re);
    expect(verdictSentence(SAMPLE.card)).toBe(`FIRSTENERGY CORP's revenue rose +14.5% year on year; weather is consistent with +8.2% of that (range +1.6% to +14.0%), so the claim "colder weather" is supported with high confidence.`);
  });

  it("flags an overshoot (weather part over twice the change, same sign) without changing the verdict", () => {
    const run = clone(SAMPLE);
    run.card.growth.g = 0.019;
    run.card.attribution.weather = 0.102;
    run.card.attribution.remainder = -0.113;
    run.card.verdict.ratio = 0.102 / 0.019;
    const note = overshootNote(run.card)!;
    expect(note).toContain("is 5.4 times the whole change (+1.9%)");
    expect(note).toContain("read the remainder (-11.3%)");
    const html = renderCard(run);
    expect(html).toContain('data-overshoot="yes"');
    expect(text(html)).toContain("supported");
    expect(overshootNote(SAMPLE.card)).toBeNull();
    run.card.attribution.weather = -0.102;
    expect(overshootNote(run.card)).toBeNull();
  });

  it("gives a withheld run with no attribution its own layout: the reason, the failed items, no empty slots", () => {
    const run = clone(SAMPLE);
    run.card.attribution = null;
    run.card.growth = null;
    run.card.weather = null;
    run.card.peers = { count: 0, by_tag: {}, with_weather: 0, excluded: [], list: [] };
    run.card.dq = null;
    run.card.memo = null;
    run.card.verdict = { claim: "colder weather", verdict: "withheld", ratio: null, confidence: null, withheld_reason: "gateway unreachable: nothing could be read through Zetaris" };
    run.card.gaps = ["get_revenue failed twice: fetch failed"];
    run.checklist = [{ id: "revenue_like_for_like", status: "failed", note: "fetch failed", evidenceIds: [] }];
    delete run.sample;
    const html = renderCard(run);
    const t = text(html);
    expect(t).toContain("No answer for this question");
    expect(t).toContain("Reason: gateway unreachable: nothing could be read through Zetaris.");
    expect(t).toContain("revenue like for like : fetch failed");
    expect(t).not.toContain("The change, split three ways");
    expect(t).not.toContain("Weather over growth");
    for (const re of EMPTY_SLOTS) expect(t).not.toMatch(re);
    expect(verdictSentence(run.card)).toBe("FIRSTENERGY CORP: no verdict is given: gateway unreachable: nothing could be read through Zetaris.");
  });

  it("states a DQ-unknown withholding next to the measured split", () => {
    const run = clone(SAMPLE);
    run.card.verdict = { ...run.card.verdict, verdict: "withheld", withheld_reason: "DQ unknown: no onboarding result at dq/latest.json under the data directory" };
    run.card.dq = { ...run.card.dq, label: "unknown", ranAt: null, elapsedS: null, run: null, rule: null };
    const t = text(renderCard(run));
    expect(t).toContain("revenue rose +14.5% year on year; no verdict is given: DQ unknown");
    expect(t).toContain("DQ unknown");
    expect(t).toContain("none on disk");
    for (const re of EMPTY_SLOTS) expect(t).not.toMatch(re);
  });
});

