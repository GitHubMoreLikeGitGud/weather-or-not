import { describe, expect, it } from "vitest";
import { numberTokens, templateMemo, unknownNumbers, writeMemo, type MemoInput } from "../src/llm/memo.ts";
import { OllamaClient } from "../src/llm/ollama.ts";

const input: MemoInput = {
  utility: "Target Electric Corp",
  cik: "0000000001",
  period: "CY2025Q1",
  claim: "colder weather",
  verdict: "supported",
  confidence: "high",
  dq: "pass",
  findings: ["Revenue rose from 1,000.0 million to 1,150.0 million, a like-for-like change of +15.0%.", "The weather part is +9.0% [+2.0%, +14.0%]."],
  notTested: ["Fuel-cost pass-through inside revenue", "Rate cases"],
  allowed: [
    { label: "year", text: "2025" },
    { label: "previous year", text: "2024" },
    { label: "quarter", text: "1" },
    { label: "revenue current", text: "1,150.0" },
    { label: "revenue previous", text: "1,000.0" },
    { label: "g", text: "+15.0%" },
    { label: "weather", text: "+9.0%" },
    { label: "weather lo", text: "+2.0%" },
    { label: "weather hi", text: "+14.0%" },
  ],
};

const reply = (content: string) => ({ message: { role: "assistant", content }, done_reason: "stop", prompt_eval_count: 500, prompt_eval_duration: 100_000_000, eval_count: 200, eval_duration: 2_000_000_000, total_duration: 2_200_000_000 });

function ollamaWith(contents: string[]): OllamaClient {
  let i = 0;
  const fetchImpl = (async (url: string | URL | Request) => {
    if (String(url).endsWith("/api/ps")) return new Response(JSON.stringify({ models: [] }), { status: 200 });
    return new Response(JSON.stringify(reply(contents[Math.min(i++, contents.length - 1)]!)), { status: 200 });
  }) as typeof fetch;
  return new OllamaClient({ baseUrl: "http://127.0.0.1:11434", model: "m", ramGuard: false, fetchImpl });
}

const words = (n: number, lead: string) => `${lead} ${Array.from({ length: n }, (_, i) => String.fromCharCode(97 + (i % 26)).repeat(3 + (i % 4))).join(" ")}.`;

describe("memo number check", () => {
  it("finds every number-like token, with sign and percent sign", () => {
    expect(numberTokens("Revenue rose +15.0% to 1,150.0 million in Q1 2025 (−2.6%).")).toEqual(["+15.0%", "1,150.0", "1", "2025", "-2.6%"]);
  });

  it("accepts only the allowed numbers, ignoring a leading plus sign but not the percent sign", () => {
    expect(unknownNumbers("In Q1 2025 revenue rose 15.0% to 1,150.0 million; weather +9.0% [+2.0%, +14.0%].", input.allowed)).toEqual([]);
    expect(unknownNumbers("Revenue rose 15.0 percent, about 14.5% of 3,765 million.", input.allowed)).toEqual(["15.0", "14.5%", "3,765"]);
    expect(unknownNumbers("A 10-Q filing.", input.allowed)).toEqual(["10"]);
  });

  it("writes the template memo from the findings with the allowed numbers only", () => {
    const t = templateMemo(input);
    expect(unknownNumbers(t, input.allowed)).toEqual([]);
    expect(t).toContain("supported");
    expect(t).toContain("Not tested");
  });
});

describe("writeMemo", () => {
  it("keeps a first draft whose numbers all match", async () => {
    const memo = words(160, "Weather accounts for roughly +9.0% [+2.0%, +14.0%] of the +15.0% change in Q1 2025 versus 2024 from 1,000.0 million to 1,150.0 million, consistent with the claim.");
    const r = await writeMemo(ollamaWith([JSON.stringify({ memo })]), input);
    expect(r.source).toBe("model");
    expect(r.attempts).toHaveLength(1);
    expect(r.attempts[0]!.ok).toBe(true);
    expect(r.attempts[0]!.metrics?.tokensPerSecond).toBeCloseTo(100, 5);
  });

  it("rejects a draft with a number that is not a tool output, retries once with the rejected numbers named, then keeps the retry", async () => {
    const bad = words(160, "Revenue rose 14.5% from 3,287 million, consistent with the claim.");
    const good = words(160, "Revenue rose +15.0% from 1,000.0 million to 1,150.0 million; weather +9.0% [+2.0%, +14.0%].");
    const r = await writeMemo(ollamaWith([JSON.stringify({ memo: bad }), JSON.stringify({ memo: good })]), input);
    expect(r.source).toBe("model");
    expect(r.attempts).toHaveLength(2);
    expect(r.attempts[0]!.ok).toBe(false);
    expect(r.attempts[0]!.unknownNumbers).toEqual(["14.5%", "3,287"]);
    expect(r.attempts[1]!.ok).toBe(true);
  });

  it("falls back to the template memo after two rejected drafts, recording both", async () => {
    const bad = words(160, "Revenue rose 14.5% last year.");
    const r = await writeMemo(ollamaWith([JSON.stringify({ memo: bad }), "not json at all"]), input);
    expect(r.source).toBe("template");
    expect(r.attempts).toHaveLength(2);
    expect(r.attempts[0]!.unknownNumbers).toEqual(["14.5%"]);
    expect(r.attempts[1]!.parseError).toMatch(/JSON/u);
    expect(unknownNumbers(r.text, input.allowed)).toEqual([]);
  });

  it("rejects a draft far outside the word budget", async () => {
    const r = await writeMemo(ollamaWith([JSON.stringify({ memo: words(400, "Long memo at +15.0%.") })]), input, { maxAttempts: 1 });
    expect(r.source).toBe("template");
    expect(r.attempts[0]!.schemaErrors[0]).toMatch(/words/u);
  });

  it("uses the template when no model is wired", async () => {
    const r = await writeMemo(null, input);
    expect(r.source).toBe("template");
    expect(r.attempts).toHaveLength(0);
  });
});
