// The offline label-number binding check (src/eval/memoBinding.ts) on the committed sample run's
// memo, and on the same memo with two figures swapped between their labels.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { checkBinding } from "../src/eval/memoBinding.ts";

const run = JSON.parse(readFileSync(new URL("../../docs/sample-run/r20261024T213805fb4e.json", import.meta.url), "utf8")) as { card: Record<string, any> };
const memo = String(run.card.memo.text);

describe("memo label-number binding", () => {
  it("binds every label of the sample run's model memo to the card's own value", () => {
    const res = checkBinding(memo, run.card);
    expect(res.map((r) => [r.label, r.status])).toEqual([
      ["like-for-like change", "match"],
      ["degree-day change", "match"],
      ["peer sensitivity (beta)", "match"],
      ["weather part", "match"],
      ["industry part", "match"],
      ["remainder", "match"],
    ]);
  });

  it("rejects a memo whose industry and remainder figures are swapped (each number is still a tool output)", () => {
    const swapped = memo.replace("part +2.9% [-1.8%, +8.7%]", "part +3.5% [-1.8%, +8.7%]").replace("remainder +3.5% [-8.2%, +14.7%]", "remainder +2.9% [-8.2%, +14.7%]");
    expect(swapped).not.toBe(memo);
    const bad = checkBinding(swapped, run.card).filter((r) => r.status === "mismatch");
    expect(bad.map((r) => [r.label, r.found])).toEqual([
      ["industry part", "+3.5%"],
      ["remainder", "+2.9%"],
    ]);
  });

  it("counts a label the memo does not name as absent, not as a failure", () => {
    const res = checkBinding("Weather accounts for +8.2% of the change.", run.card);
    expect(res.find((r) => r.label === "weather part")!.status).toBe("absent");
    expect(res.every((r) => r.status !== "mismatch")).toBe(true);
  });
});
