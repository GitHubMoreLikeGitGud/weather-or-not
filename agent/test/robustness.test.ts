// Offline checks on the committed sample run: the robustness check (src/eval/robustness.ts)
// reproduces the saved card from the full peer set and its committed output is what the script
// computes today; every cited Lightning SQL statement re-hashes to the sha256 stored with it.

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { robustness, SAMPLE_RUN, type SavedRun } from "../src/eval/robustness.ts";

const run = JSON.parse(readFileSync(SAMPLE_RUN, "utf8")) as SavedRun;
const committed = JSON.parse(readFileSync(new URL("../../docs/eval/robustness-sample-run.json", import.meta.url), "utf8"));

describe("robustness of the sample run's card", () => {
  const res = robustness(run);

  it("reproduces the saved card from the saved peers, and recomputes its degree-day change", () => {
    expect(res.full.equals_saved_card).toBe(true);
    expect(res.full.verdict).toBe(run.card.attribution.claim.verdict);
    expect(res.degree_days_over_the_utility_stations.hdd_plus_cdd_change).toBe(res.degree_days_over_the_utility_stations.card_delta_w);
    expect(res.leave_one_out.runs).toBe(run.card.peers.list.length);
  });

  it("matches the committed docs/eval/robustness-sample-run.json", () => {
    expect(JSON.parse(JSON.stringify(res))).toEqual(committed);
  });
});

describe("the sample run's SQL citations", () => {
  it("re-hash to their stored sha256 (13 of 13)", () => {
    const cited = (run.evidence as { sql?: string; sql_sha256?: string }[]).filter((e) => e.sql && e.sql_sha256);
    const ok = cited.filter((e) => createHash("sha256").update(e.sql!, "utf8").digest("hex") === e.sql_sha256);
    expect([ok.length, cited.length]).toEqual([13, 13]);
  });
});
