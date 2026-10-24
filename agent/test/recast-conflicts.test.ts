import { describe, expect, it } from "vitest";
import { HMEM, provenanceOf, type WonProvenance } from "../src/memory/hmemFacade.ts";
import { ruleR1 } from "../src/memory/recastConflicts.ts";
import type { EvidenceRecord } from "../src/evidence/store.ts";

let t = 1_700_000_000_000;
const clock = () => (t += 1000);

function memory(): HMEM {
  return new HMEM({ actor: "won-agent", clock });
}

const prov: WonProvenance = {
  zetaris_object: "won.concept_0000000001_Revenues",
  sql_sha256: "abc",
  endpoint: "https://data.sec.gov/api/xbrl/companyconcept/CIK0000000001/us-gaap/Revenues.json",
  accn: "0000000001-24-000001",
  filed: "2024-05-01",
  licence: "SEC",
  retrieved_at: "2026-10-24T20:00:00+08:00",
  latency_ms: 180,
  cache_state: "hit",
  evidence_id: "ev-1",
  template_id: "concept_window",
  run_id: "r1",
};

const own = { val: 1_000_000_000, accn: "0000000001-24-000001", filed: "2024-05-01", fy: 2024, fp: "Q1", form: "10-Q" };
const later = { val: 980_000_000, accn: "0000000001-25-000001", filed: "2025-05-01", fy: 2025, fp: "Q1", form: "10-Q" };

describe("rule R1", () => {
  it("uses the later filing's comparative for the previous quarter and the own filing for the current quarter", () => {
    expect(ruleR1("previous_period", 2025).chosen).toBe("later_filing");
    expect(ruleR1("current_period", 2025).chosen).toBe("own_filing");
    expect(ruleR1("previous_period", 2025).text).toContain("fy2025");
  });
});

describe("recast conflicts in H-MEM", () => {
  it("records both values as facts, resolves by R1, supersedes the loser and logs it in the ledger", () => {
    const h = memory();
    const a = h.addFact({ content: "Revenues CY2024Q1: 1000000000 in 0000000001-24-000001", source: "zetaris:won.concept_0000000001_Revenues", label: "fact", provenance: prov, refs: ["ev-1"], key: "a" });
    const b = h.addFact({ content: "Revenues CY2024Q1: 980000000 as the comparative in 0000000001-25-000001", source: "zetaris:won.concept_0000000001_Revenues", label: "fact", provenance: { ...prov, accn: later.accn, filed: later.filed }, refs: ["ev-1"], key: "b" });
    const { conflict, created } = h.recasts.record({ cik: "0000000001", tag: "Revenues", period: "CY2024Q1", scope: "previous_period", currentYear: 2025, ownFilingMemory: a.memory.id, laterFilingMemory: b.memory.id, ownFiling: own, laterFiling: later, runId: "r1", evidenceIds: ["ev-1"] });
    expect(created).toBe(true);
    expect(conflict.kind).toBe("recast_comparative");
    expect(conflict.rule).toBe("R1");
    expect(conflict.chosen).toBe("later_filing");
    expect(conflict.chosen_val).toBe(980_000_000);
    expect(conflict.status).toBe("resolved_by_rule");
    expect(h.store.get(a.memory.id)!.supersededBy).toBe(b.memory.id);
    expect(h.store.get(b.memory.id)!.supersededBy).toBeUndefined();
    const actions = h.ledger.history(a.memory.id).map((e) => e.action);
    expect(actions).toContain("conflict_detected");
    expect(actions).toContain("conflict_resolved");
    const resolved = h.ledger.history(a.memory.id).find((e) => e.action === "conflict_resolved")!;
    expect(resolved.actor).toBe("won-agent");
    expect(resolved.details).toMatchObject({ conflictId: conflict.id, rule: "R1", winner: b.memory.id });
    // Idempotent: the same pair is one record.
    const again = h.recasts.record({ cik: "0000000001", tag: "Revenues", period: "CY2024Q1", scope: "previous_period", currentYear: 2025, ownFilingMemory: a.memory.id, laterFilingMemory: b.memory.id, ownFiling: own, laterFiling: later, evidenceIds: ["ev-2"] });
    expect(again.created).toBe(false);
    expect(again.conflict.evidence_ids).toEqual(["ev-1", "ev-2"]);
    expect(h.recasts.all()).toHaveLength(1);
    // why() shows the provenance, the conflict and the ledger.
    const why = h.why(a.memory.id);
    expect(why.provenance?.sql_sha256).toBe("abc");
    expect(why.conflicts).toHaveLength(1);
    expect(why.lines.join("\n")).toMatch(/R1/u);
    expect(why.lines.join("\n")).toMatch(/Superseded by/u);
  });

  it("keeps the current quarter's own value when a later filing restates it", () => {
    const h = memory();
    const a = h.addFact({ content: "cur own", source: "zetaris:x", label: "f", provenance: prov, refs: [], key: "c1" });
    const b = h.addFact({ content: "cur later", source: "zetaris:x", label: "f", provenance: prov, refs: [], key: "c2" });
    const { conflict } = h.recasts.record({ cik: "0000000001", tag: "Revenues", period: "CY2025Q1", scope: "current_period", currentYear: 2025, ownFilingMemory: a.memory.id, laterFilingMemory: b.memory.id, ownFiling: { ...own, val: 5_463_400_000 }, laterFiling: { ...later, val: 5_463_000_000 } });
    expect(conflict.chosen).toBe("own_filing");
    expect(conflict.chosen_val).toBe(5_463_400_000);
    expect(h.store.get(b.memory.id)!.supersededBy).toBe(a.memory.id);
  });

  it("lets the analyst override the resolution with a reason, logged as the analyst", () => {
    const h = memory();
    const a = h.addFact({ content: "own", source: "zetaris:x", label: "f", provenance: prov, refs: [], key: "o1" });
    const b = h.addFact({ content: "later", source: "zetaris:x", label: "f", provenance: prov, refs: [], key: "o2" });
    const { conflict } = h.recasts.record({ cik: "0000000001", tag: "Revenues", period: "CY2024Q1", scope: "previous_period", currentYear: 2025, ownFilingMemory: a.memory.id, laterFilingMemory: b.memory.id, ownFiling: own, laterFiling: later });
    expect(() => h.recasts.override(conflict.id, { chosen: "own_filing", reason: "  " })).toThrow(/reason/u);
    const o = h.recasts.override(conflict.id, { chosen: "own_filing", reason: "the restatement reclassified a pass-through item" });
    expect(o.status).toBe("overridden");
    expect(o.chosen).toBe("own_filing");
    expect(o.chosen_val).toBe(own.val);
    expect(o.override?.by).toBe("analyst");
    expect(h.store.get(b.memory.id)!.supersededBy).toBe(a.memory.id);
    expect(h.store.get(a.memory.id)!.supersededBy).toBeUndefined();
    const last = h.ledger.history(b.memory.id).filter((e) => e.action === "conflict_resolved").pop()!;
    expect(last.actor).toBe("analyst");
    expect(last.details).toMatchObject({ override: true, reason: "the restatement reclassified a pass-through item" });
    expect(() => h.recasts.override("rc-nope", { chosen: "own_filing", reason: "x" })).toThrow(/no recast conflict/u);
  });

  it("remembers the tag and station choices and logs their reads", () => {
    const h = memory();
    expect(h.tagChoice("0000000001", "CY2025Q1")).toBeNull();
    const r = h.rememberTagChoice("0000000001", "CY2025Q1", "Revenues", prov, ["ev-1"]);
    expect(r.created).toBe(true);
    const again = h.rememberTagChoice("0000000001", "CY2025Q1", "Revenues", prov, ["ev-1"]);
    expect(again.created).toBe(false);
    const got = h.tagChoice("0000000001", "CY2025Q1")!;
    expect(got.tag).toBe("Revenues");
    expect(h.ledger.history(got.memory.id).some((e) => e.action === "read")).toBe(true);
    h.rememberStationChoice("0000000001", ["USW00000002", "USW00000001"], null, []);
    expect(h.stationChoice("0000000001")!.stations).toEqual(["USW00000001", "USW00000002"]);
    expect(h.memoryContext({ cik: "0000000001", period: "CY2025Q1" })).toContain("REMEMBERED FROM EARLIER RUNS");
  });

  it("builds provenance from an evidence record", () => {
    const ev = { id: "ev-9", run_id: "r", kind: "zetaris_sql", claim: "c", queried_at: "t", zetaris_object: "won.x", sql_sha256: "s", source_url: "u", licence: "l", elapsed_ms: 5, cache_state: "hit", template_id: "frames_fact" } as EvidenceRecord;
    expect(provenanceOf(ev, { accn: "a", filed: "f" })).toEqual({ zetaris_object: "won.x", sql_sha256: "s", endpoint: "u", accn: "a", filed: "f", licence: "l", retrieved_at: "t", latency_ms: 5, cache_state: "hit", evidence_id: "ev-9", template_id: "frames_fact", run_id: "r" });
  });
});
