"""Draws docs/architecture.svg (standard library only).

    python docs/architecture.py

docs/architecture.png is a 2x render of the SVG.
"""

from __future__ import annotations

from pathlib import Path
from xml.sax.saxutils import escape

W, H = 1500, 1070
FONT = "Segoe UI, Helvetica Neue, Arial, sans-serif"
INK, MUTED = "#1F2933", "#52606D"

# stroke, fill, tag colour
ZETARIS = ("#0E7C86", "#E7F4F5", "#0B6670")
METERLESS = ("#6B4FBB", "#F1EDFA", "#5A3FA8")
NVIDIA = ("#76B900", "#F2F8E6", "#4B7700")
CORE = ("#3B5B85", "#EAF0F7", "#2F4A6E")
ANALYST = ("#B26A00", "#FFF4E2", "#8A5200")
SOURCE = ("#8A8F98", "#F5F6F8", "#5F6670")

out: list[str] = []


def text(x, y, s, size=14, weight="normal", fill=INK, anchor="start", style="normal", spacing=0.0):
    ls = f' letter-spacing="{spacing}"' if spacing else ""
    out.append(
        f'<text x="{x}" y="{y}" font-size="{size}" font-weight="{weight}" font-style="{style}" '
        f'fill="{fill}" text-anchor="{anchor}"{ls}>{escape(s)}</text>'
    )


def rect(x, y, w, h, stroke, fill, dash=False, r=10, sw=2.0):
    d = ' stroke-dasharray="7 5"' if dash else ""
    out.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{r}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}"{d}/>')


def box(x, y, w, h, colours, title, lines, tag=None):
    stroke, fill, tagc = colours
    rect(x, y, w, h, stroke, fill)
    ty = y + 30
    if tag:
        text(x + 14, y + 22, tag, size=11, weight="bold", fill=tagc, spacing=1.2)
        ty = y + 45
    text(x + 14, ty, title, size=17, weight="bold")
    for i, line in enumerate(lines):
        strong = line.startswith("!")
        text(x + 14, ty + 23 + 19 * i, line.lstrip("!"), size=14, fill=INK if strong else MUTED,
             weight="bold" if strong else "normal")


def arrow(points, label=None, at=None, both=False, colour="#4A5563", anchor="start", lsize=12.5):
    pts = " ".join(f"{x},{y}" for x, y in points)
    start = ' marker-start="url(#arrow-start)"' if both else ""
    out.append(f'<polyline points="{pts}" fill="none" stroke="{colour}" stroke-width="2"{start} marker-end="url(#arrow)"/>')
    if label and at:
        text(at[0], at[1], label, size=lsize, fill=MUTED, anchor=anchor)


out.append(
    f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}" '
    f'font-family="{FONT}" role="img" aria-labelledby="t d">'
)
out.append('<title id="t">Weather-or-Not architecture</title>')
out.append(
    '<desc id="d">SEC EDGAR, NOAA GHCN-Daily and the company_dns SIC list are read only through Zetaris Lightning: REST tables, '
    'a parquet filestore, cached SchemaStore views and the weather_or_not_usl Unified Semantic Layer with key and coverage '
    'data-quality rules. A gateway exposes 28 named SQL templates behind an allowlist to the agent server, where a Markovian '
    'question chain planned by Nemotron 3 Nano 4B on local Ollama runs ten deterministic tools, H-MEM keeps facts with Zetaris '
    'provenance and recast conflicts, the World Model keeps the utility graph with dated edges, every number cites an evidence '
    'record with its SQL text, and the analyst reviews the answer card, overrides a recast resolution under a signed contract, '
    'and reads the why trace in the UI.</desc>'
)
out.append(
    '<defs>'
    '<marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">'
    '<path d="M0,0 L10,5 L0,10 z" fill="#4A5563"/></marker>'
    '<marker id="arrow-start" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">'
    '<path d="M0,0 L10,5 L0,10 z" fill="#4A5563"/></marker>'
    '</defs>'
)
out.append(f'<rect width="{W}" height="{H}" fill="#FFFFFF"/>')

text(30, 46, "Weather-or-Not: from public data to a cited split of a utility's revenue change", size=26, weight="bold")
text(30, 74, "One machine: Zetaris Lightning in local Docker, the gateway and the agent server on 127.0.0.1, Nemotron in local Ollama. No cloud model calls.",
     size=15, fill=MUTED)

# Containers first, so arrows and labels sit on top of them
rect(280, 110, 390, 640, ZETARIS[0], "#F6FBFB", dash=True, r=14)
rect(990, 110, 480, 710, "#9AA3AF", "#FAFAFC", dash=True, r=14)

# Public sources
text(30, 150, "PUBLIC SOURCES", size=11, weight="bold", fill=SOURCE[2], spacing=1.2)
box(30, 165, 200, 122, SOURCE, "SEC EDGAR", ["XBRL frames, companyconcept,", "submissions (data.sec.gov)", "US government work; declared", "User-Agent; queried live"])
box(30, 303, 200, 104, SOURCE, "NOAA GHCN-Daily", ["daily TMAX and TMIN, parquet", "on the AWS Open Data bucket", "US government work"])
box(30, 423, 200, 104, SOURCE, "company_dns", ["US SIC code list, 1,005 codes", "service under Apache-2.0", "identifying User-Agent"])
text(30, 560, "Zetaris is the only", size=13, fill=MUTED, style="italic")
text(30, 578, "runtime path to them.", size=13, fill=MUTED, style="italic")

# Zetaris
text(300, 138, "ZETARIS", size=11, weight="bold", fill=ZETARIS[2], spacing=1.2)
text(300, 160, "Lightning 2.4.3.1, local Docker", size=17, weight="bold")
box(300, 175, 350, 128, ZETARIS, "REST tables, views cached",
    ["WON_SEC.frames_<tag>_<period>: 6 + run-time", "WON_SEC.concept_<cik10>_<tag>: 10", "WON_SEC.submissions_<cik10>: 43 seeds",
     "WON_DNS.sic_codes_v4_raw; views in container won"])
box(300, 322, 350, 118, ZETARIS, "FILESTORE parquet, views cached",
    ["WON_GHCN.ghcn_<yyyy>_<tmax|tmin> (2024, 2025)", "9 files per partition, every station worldwide",
     "won.ghcn_* filtered to the 56 seed stations", "!degree days computed here, in Lightning SQL"])
box(300, 460, 350, 150, ZETARIS, "weather_or_not_usl",
    ["Unified Semantic Layer, 5 tables:", "utility, sic_code, station,", "weather_quarter, revenue_quarter",
     "!PK/FK rules + custom DQ rule coverage_ok", "!RUN DQ at onboarding gates the verdict"])
text(300, 640, "Every statement is Lightning SQL over JDBC.", size=13, fill=MUTED, style="italic")
text(300, 658, "The agent never writes SQL; the gateway's", size=13, fill=MUTED, style="italic")
text(300, 676, "named templates do, and the SQL text is", size=13, fill=MUTED, style="italic")
text(300, 694, "the citation behind every number.", size=13, fill=MUTED, style="italic")
for y in (226, 355, 475):
    out.append(f'<line x1="230" y1="{y}" x2="256" y2="{y}" stroke="#4A5563" stroke-width="2"/>')
out.append('<line x1="256" y1="226" x2="256" y2="475" stroke="#4A5563" stroke-width="2"/>')
arrow([(256, 239), (300, 239)])
arrow([(256, 381), (300, 381)])
arrow([(475, 303), (475, 322)])
arrow([(475, 440), (475, 460)], "ACTIVATE USL TABLE", (490, 454))

# Gateway
box(720, 330, 210, 190, CORE, "Zetaris gateway",
    ["FastAPI + JDBC, 127.0.0.1:8793", "28 named SQL templates", "reader allowlist; registrar", "plans under a signed", "medium-risk contract",
     "!every statement logged", "!with its sha256"])
arrow([(650, 420), (720, 420)], "JDBC", (685, 410), both=True, anchor="middle")
arrow([(930, 420), (1010, 420)], "template id", (970, 392), both=True, anchor="middle")
text(970, 408, "+ parameters", size=12.5, fill=MUTED, anchor="middle")
text(970, 444, "rows + SQL", size=12.5, fill=MUTED, anchor="middle")

# Agent server
text(1010, 138, "AGENT SERVER", size=11, weight="bold", fill="#5F6670", spacing=1.2)
text(1010, 160, "Node 22 + TypeScript, 127.0.0.1:8794", size=17, weight="bold")
box(1010, 175, 220, 130, METERLESS, "H-MEM", ["facts with Zetaris provenance", "recast conflicts, rule R1", "tag and station choices", "why trace per fact"],
    tag="METERLESS")
box(1240, 175, 220, 130, METERLESS, "World Model", ["utility, state, station, SIC,", "filing, quarter", "serves, peer_of, reported_in", "edges dated by source time"],
    tag="METERLESS")
box(1010, 345, 450, 150, METERLESS, "Markovian question chain",
    ["bounded chunks: carried state at most 800 tokens, at most 10 chunks", "planner: Nemotron chooses the next tool; one repair round",
     "NEEDS_TOOL executor runs the ten host tools", "deterministic fallback: the next open checklist item"],
    tag="METERLESS  +  NVIDIA")
box(1010, 530, 220, 128, NVIDIA, "Nemotron 3 Nano 4B", ["local Ollama, loopback only", "plans steps, writes the memo", "!never computes a number", "!0 cloud model calls"],
    tag="NVIDIA")
box(1240, 530, 220, 128, CORE, "Deterministic tools", ["degree days (Lightning SQL)", "like-for-like revenue, rule R1", "peers over three XBRL tags", "!slope, bootstrap, verdict"],
    tag="DETERMINISTIC")
box(1010, 690, 450, 115, METERLESS, "Evidence store and signed override",
    ["every number cites SQL text, rows, Zetaris object, endpoint, licence,", "retrieval time, latency and cache state",
     "!override_recast: analyst-signed, single-use HMAC contract"],
    tag="SCOUT INTENT SUBSET, REIMPLEMENTED")
arrow([(1120, 305), (1120, 345)], both=True)
arrow([(1350, 305), (1350, 345)], both=True)
arrow([(1120, 495), (1120, 530)], both=True)
arrow([(1350, 495), (1350, 530)], both=True)
arrow([(1235, 658), (1235, 690)])

# Analyst
box(1010, 880, 450, 100, ANALYST, "Analyst UI",
    ["ask with a live timeline (SSE), answer card with ranges and confidence,", "evidence drawer (the SQL is the citation), memory and why, graph"],
    tag="ANALYST")
arrow([(1235, 880), (1235, 805)], both=True)
text(1247, 850, "override with a reason, re-run", size=12.5, fill=MUTED)

# Legend
lx, ly = 30, 1040
for label, (stroke, fill, _) in [("Zetaris", ZETARIS), ("Meterless", METERLESS), ("NVIDIA", NVIDIA),
                                 ("Weather-or-Not code, deterministic", CORE), ("Analyst", ANALYST), ("Public source", SOURCE)]:
    rect(lx, ly - 13, 16, 16, stroke, fill, r=4)
    text(lx + 24, ly, label, size=13, fill=MUTED)
    lx += 24 + int(len(label) * 5.9) + 34

out.append("</svg>")

if __name__ == "__main__":
    target = Path(__file__).with_name("architecture.svg")
    target.write_text("\n".join(out) + "\n", encoding="utf-8")
    print(f"wrote {target} ({W}x{H})")
