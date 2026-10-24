"""Named templates. The agent sends a template id and parameters, never SQL.

Adapted from ClearShelf (same author, Apache-2.0).

Parameters are validated by regex before they are substituted, so a value can only ever be
a 10-digit CIK, one of three revenue tags, a CY frame period, a year, a quarter number, a
GHCN station id or a GHCN element. Reader templates run through POST /sql/template. A
registrar plan (REGISTRAR_PLANS) is a short ordered list of registrar templates that
POST /registrar/<action> runs under an execution contract (gateway/registrar.py), for
example the frames table + view + cache of a period the agent has not registered yet.

TEMPLATES holds the two connectivity templates only; the Zetaris lane adds the reader
templates and registrar plans as the WON_* objects come to exist.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

PARAM_PATTERNS = {
    "cik10": re.compile(r"^\d{10}$"),
    "tag": re.compile(r"^(Revenues|RevenueFromContractWithCustomerExcludingAssessedTax|RegulatedAndUnregulatedOperatingRevenue)$"),
    "period": re.compile(r"^CY\d{4}Q[1-3]$"),
    "year": re.compile(r"^20\d{2}$"),
    "quarter": re.compile(r"^[1-3]$"),
    "station": re.compile(r"^US[A-Z0-9]{9}$"),
    "element": re.compile(r"^(TMAX|TMIN)$"),
}


class BadParams(ValueError):
    pass


@dataclass(frozen=True)
class Template:
    id: str
    sql: str
    params: dict[str, str]  # parameter name -> PARAM_PATTERNS kind
    objects: tuple[str, ...]  # what the statement reads or creates (USL tables, views), for the evidence drawer
    raw_objects: tuple[str, ...]  # cached raw tables or views behind it; "{name}" takes the validated parameter
    description: str = ""
    role: str = "reader"  # reader templates run via /sql/template; registrar templates only inside a plan


@dataclass(frozen=True)
class Step:
    template_id: str
    skip_exists: bool = False  # Zetaris's "already exists" counts as done
    timeout_s: float = 120.0


@dataclass(frozen=True)
class Plan:
    action: str
    params: dict[str, str]  # parameter name -> PARAM_PATTERNS kind; every step's params are a subset
    steps: tuple[Step, ...]
    description: str = ""


def _t(id: str, sql: str, params: dict[str, str], objects: tuple[str, ...], raw: tuple[str, ...],
       description: str, role: str = "reader") -> Template:
    return Template(id, " ".join(sql.split()), params, objects, raw, description, role)


TEMPLATES: dict[str, Template] = {
    t.id: t
    for t in [
        _t("select1", "SELECT 1 AS ok", {}, (), (), "Connectivity check."),
        _t("show_databases", "SHOW LIGHTNING DATABASES", {}, (), (), "The Lightning databases the instance holds."),
    ]
}

REGISTRAR_PLANS: dict[str, Plan] = {}


def validate_param(kind: str, value: object) -> str:
    if kind not in PARAM_PATTERNS:
        raise BadParams(f"unknown parameter kind: {kind}")
    if not isinstance(value, str):
        raise BadParams(f"{kind} must be a string")
    if not PARAM_PATTERNS[kind].match(value):
        raise BadParams(f"invalid {kind}: {value[:40]!r}")
    return value


def render(template_id: str, params: dict | None) -> tuple[Template, str]:
    """The template and its SQL with validated parameters substituted."""
    t = TEMPLATES.get(template_id)
    if t is None:
        raise BadParams(f"unknown template: {template_id}")
    params = params or {}
    extra = set(params) - set(t.params)
    missing = set(t.params) - set(params)
    if extra or missing:
        raise BadParams(f"template {template_id} takes {sorted(t.params)}; missing {sorted(missing)}, unexpected {sorted(extra)}")
    values = {name: validate_param(kind, params[name]) for name, kind in t.params.items()}
    sql = t.sql
    for name, value in values.items():
        sql = sql.replace("{" + name + "}", value)
    return t, sql


def plan_params(plan: Plan, body: dict) -> dict[str, str]:
    """The plan's parameters taken from a request body and validated; BadParams otherwise."""
    return {name: validate_param(kind, body.get(name)) for name, kind in plan.params.items()}
