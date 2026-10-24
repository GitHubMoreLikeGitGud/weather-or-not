import pytest

from gateway import allowlist, templates
from gateway.templates import BadParams, Plan, Step, Template, render

SAMPLES = {"cik10": "0001326160", "tag": "Revenues", "period": "CY2025Q1", "year": "2025", "quarter": "1",
           "station": "USW00013740", "element": "TMAX"}

FRAMES_CREATE = Template(
    "registrar_frames_table",
    'CREATE LIGHTNING REST TABLE frames_{tag}_{period} FROM WON_SEC REQUEST( '
    'endpoint "https://data.sec.gov/api/xbrl/frames/us-gaap/{tag}/USD/{period}.json", method "get", '
    'response_type "json", http_encoding "URLENCODED" ) HEADER ( user-agent "YOUR_APP_NAME YOUR_CONTACT_EMAIL" ) BODY ()',
    {"tag": "tag", "period": "period"}, ("WON_SEC.frames_{tag}_{period}",), (), "One SEC frames period as a raw REST table.", "registrar")


def test_sample_params_cover_every_kind():
    assert set(SAMPLES) == set(templates.PARAM_PATTERNS)


@pytest.mark.parametrize("tid", sorted(templates.TEMPLATES))
def test_every_template_renders_and_passes_its_role(tid):
    t = templates.TEMPLATES[tid]
    params = {name: SAMPLES[kind] for name, kind in t.params.items()}
    _, sql = render(tid, params)
    assert "{" not in sql
    assert t.role in ("reader", "registrar")
    assert allowlist.check(sql, t.role) == ("read" if t.role == "reader" else "register")


@pytest.mark.parametrize("action", sorted(templates.REGISTRAR_PLANS))
def test_every_plan_step_is_a_known_template_the_plan_parameters_cover(action):
    plan = templates.REGISTRAR_PLANS[action]
    assert plan.action == action and plan.steps
    for step in plan.steps:
        t = templates.TEMPLATES[step.template_id]
        assert all(plan.params.get(name) == kind for name, kind in t.params.items())


def test_connectivity_templates():
    assert render("select1", {})[1] == "SELECT 1 AS ok"
    assert render("show_databases", None)[1] == "SHOW LIGHTNING DATABASES"


@pytest.mark.parametrize("kind,value,ok", [
    ("cik10", "0001326160", True), ("cik10", "1326160", False), ("cik10", "CIK0001326160", False), ("cik10", "0001326160 ", False),
    ("tag", "Revenues", True), ("tag", "RevenueFromContractWithCustomerExcludingAssessedTax", True),
    ("tag", "RegulatedAndUnregulatedOperatingRevenue", True), ("tag", "revenues", False), ("tag", "Revenues'", False),
    ("tag", "NetIncomeLoss", False),
    ("period", "CY2025Q1", True), ("period", "CY2024Q3", True), ("period", "CY2025Q4", False), ("period", "CY2025", False),
    ("period", "cy2025q1", False), ("period", "CY2025Q1I", False),
    ("year", "2025", True), ("year", "2099", True), ("year", "1999", False), ("year", "20251", False),
    ("quarter", "1", True), ("quarter", "3", True), ("quarter", "4", False), ("quarter", "Q1", False),
    ("station", "USW00013740", True), ("station", "USC00011084", True), ("station", "usw00013740", False),
    ("station", "USW0001374", False), ("station", "CA001012345", False), ("station", "USW00013740'", False),
    ("element", "TMAX", True), ("element", "TMIN", True), ("element", "PRCP", False), ("element", "tmax", False),
])
def test_param_patterns(kind, value, ok):
    if ok:
        assert templates.validate_param(kind, value) == value
    else:
        with pytest.raises(BadParams):
            templates.validate_param(kind, value)


def test_non_string_and_unknown_kind_are_refused():
    with pytest.raises(BadParams):
        templates.validate_param("year", 2025)
    with pytest.raises(BadParams):
        templates.validate_param("gtin", "0816929000119")


@pytest.mark.parametrize("tid,params", [
    ("select1", {"extra": "x"}),
    ("nope", {}),
    ("registrar_frames_table", {"tag": "Revenues"}),
    ("registrar_frames_table", {"tag": "Revenues", "period": "CY2025Q4"}),
    ("registrar_frames_table", {"tag": "Revenues", "period": "CY2025Q1", "x": "1"}),
    ("registrar_frames_table", {"tag": "Revenues'; DROP TABLE t", "period": "CY2025Q1"}),
])
def test_bad_params(monkeypatch, tid, params):
    monkeypatch.setitem(templates.TEMPLATES, FRAMES_CREATE.id, FRAMES_CREATE)
    with pytest.raises(BadParams):
        render(tid, params)


def test_a_registrar_template_substitutes_only_validated_values(monkeypatch):
    monkeypatch.setitem(templates.TEMPLATES, FRAMES_CREATE.id, FRAMES_CREATE)
    t, sql = render("registrar_frames_table", {"tag": "RevenueFromContractWithCustomerExcludingAssessedTax", "period": "CY2024Q2"})
    assert t.role == "registrar" and "{" not in sql
    assert "frames_RevenueFromContractWithCustomerExcludingAssessedTax_CY2024Q2 FROM WON_SEC" in sql
    assert 'endpoint "https://data.sec.gov/api/xbrl/frames/us-gaap/RevenueFromContractWithCustomerExcludingAssessedTax/USD/CY2024Q2.json"' in sql
    assert allowlist.check(sql, "registrar") == "register"
    with pytest.raises(allowlist.Refused):
        allowlist.check(sql, "reader")


def test_plan_params_take_the_plan_parameters_from_a_request_body():
    plan = Plan("register_frames", {"tag": "tag", "period": "period"}, (Step("registrar_frames_table", skip_exists=True),))
    body = {"tag": "Revenues", "period": "CY2025Q1", "contract": {"contractId": "c-1"}}
    assert templates.plan_params(plan, body) == {"tag": "Revenues", "period": "CY2025Q1"}
    for bad in ({"tag": "Revenues"}, {"tag": "Revenues", "period": "CY2025Q4"}, {"tag": 1, "period": "CY2025Q1"}):
        with pytest.raises(BadParams):
            templates.plan_params(plan, bad)
