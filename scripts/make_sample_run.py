"""Writes the committed sample run (docs/sample-run/<run_id>.json) from one saved run.

Dev-time only, not part of the agent. The sample lets a fresh clone open a real answer card and
its evidence drawer without Zetaris or a GPU (the agent server lists docs/sample-run/ read-only).

What is masked: every revenue level. The `val` column of the frames and companyconcept rows,
the peers' current and previous revenue in the peer-set record, the card's two revenue levels,
the memo's allowed-number list entries for them, and any "<n,nnn.n> million", "<n,nnn.n>M" or
raw level in a text field (the memo, the findings, the tool facts, the evidence claims) become
null or "[masked]". Growth rates, degree days, the SQL text and
its sha256, accession numbers, the attribution and the weather rows are kept as recorded.
Local paths are reduced to their data-directory-relative form.

Usage (from the repository root):
    python scripts/make_sample_run.py <data>/runs/<run_id>/run.json docs/sample-run/
The script refuses to write if any masked level survives anywhere in the output text.
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

REVENUE_TEMPLATES = {"frames_fact", "concept_window", "frames_seeds"}
MILLION = re.compile(r"\d{1,3}(?:,\d{3})*\.\d\s?million")
MILLION_M = re.compile(r"\d{1,3}(?:,\d{3})*\.\dM(?![A-Za-z])")
BIG_INT = re.compile(r"(?<![\d.-])\d{7,13}(?![\d-])")
NOTE = (
    "A real run of 24 Oct 2026 (FirstEnergy, CY2025Q1 against CY2024Q1, claim \"colder weather\"; "
    "97.5 s, 5 Markovian chunks, 9 planner calls, all valid on the first reply), committed so the card "
    "and the evidence drawer open without Zetaris or a GPU. Every revenue level is masked (the val "
    "column of the SEC rows, the peers' levels, the two levels on the card and in the memo); growth "
    "rates, degree days, the attribution, the SQL text and its sha256, the accession numbers and the "
    "NOAA weather rows are as recorded. Memory and Graph stay empty: H-MEM and the World Model are "
    "not committed."
)


def fmt_levels(v: float) -> set[str]:
    m = v / 1e6
    return {f"{m:,.1f}", f"{m:.1f}", str(int(v))}


def scrub_text(s: str, levels: set[str]) -> str:
    s = MILLION.sub("[masked] million", s)
    s = MILLION_M.sub("[masked]M", s)
    s = BIG_INT.sub(lambda m: "[masked]" if m.group(0) in levels else m.group(0), s)
    s = re.sub(r"[A-Za-z]:\\[^\"]*?data\\dq\\latest\.json", "dq/latest.json", s)
    return s


def walk(o, fn):
    if isinstance(o, dict):
        return {k: walk(v, fn) for k, v in o.items()}
    if isinstance(o, list):
        return [walk(v, fn) for v in o]
    if isinstance(o, str):
        return fn(o)
    return o


def main() -> int:
    src = Path(sys.argv[1])
    out_dir = Path(sys.argv[2])
    run = json.loads(src.read_text(encoding="utf8"))
    levels: set[float] = set()

    for e in run.get("evidence", []):
        if e.get("template_id") in REVENUE_TEMPLATES and "val" in e.get("columns", []):
            i = e["columns"].index("val")
            for row in e.get("rows", []):
                if isinstance(row[i], (int, float)):
                    levels.add(float(row[i]))
                row[i] = None
            e["masked"] = ["rows.val"]
        details = e.get("details") or {}
        for p in details.get("peers", []) or []:
            for k in ("rev_current", "rev_previous"):
                if isinstance(p.get(k), (int, float)):
                    levels.add(float(p[k]))
                    p[k] = None
        for a in details.get("allowed", []) or []:
            if str(a.get("label", "")).startswith("revenue "):
                a["text"] = "[masked]"
        if isinstance(details.get("file"), str):
            details["file"] = "dq/latest.json"

    g = run["card"].get("growth") or {}
    for k in ("rev_current", "rev_previous"):
        if isinstance(g.get(k), (int, float)):
            levels.add(float(g[k]))
            g[k] = None
    g["levels_masked"] = True

    run["evidence_file"] = None
    level_ints = {str(int(v)) for v in levels}
    run = walk(run, lambda t: scrub_text(t, level_ints))
    run["sample"] = {"note": NOTE, "masked": "every revenue level", "source": "scripts/make_sample_run.py"}

    text = json.dumps(run, indent=1, ensure_ascii=False) + "\n"
    leaks = sorted(f for v in levels for f in fmt_levels(v) if re.search(rf"(?<![\d.]){re.escape(f)}(?![\d])", text) and len(f) >= 5)
    if leaks or re.search(r"[A-Za-z]:\\\\|/Users/", text):
        print(f"refusing to write: {len(leaks)} level string(s) or a local path survive, e.g. {leaks[:5]}", file=sys.stderr)
        return 1
    out_dir.mkdir(parents=True, exist_ok=True)
    out = out_dir / f"{run['run_id']}.json"
    out.write_text(text, encoding="utf8", newline="\n")
    print(f"wrote {out}: {len(levels)} revenue levels masked, {len(text):,} bytes")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
