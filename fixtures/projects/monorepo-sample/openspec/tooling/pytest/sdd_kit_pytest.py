# sdd-kit: managed file. Do not edit; local changes are overwritten on kit update.
"""sdd-kit pytest plugin: links tests to OpenSpec spec scenarios.

Mark a test:

    @pytest.mark.scenario("inventory/sale-export", "Successful export")
    def test_successful_export(...): ...

Load the plugin and ask for the JSON report (openspec/tooling/verify.yaml does this):

    PYTHONPATH=openspec/tooling/pytest pytest -p sdd_kit_pytest --sdd-out=out.json [--collect-only]

Output: a JSON array, one entry per (test, scenario):
    {"level": "unit", "capability": "...", "scenario": "...", "test": "<node id>", "outcome": "passed|failed|skipped|error"}
`outcome` is absent with --collect-only. Works with pytest-xdist: workers attach the markers to their
reports (user_properties) and only the controller writes the file.
"""
import json

_PROP = "sdd_scenarios"
_state = {"tests": {}}


def pytest_addoption(parser):
    parser.addoption("--sdd-out", default=None, help="sdd-kit: write scenario markers (and results) as JSON to this file")


def pytest_configure(config):
    config.addinivalue_line("markers", "scenario(capability, name): links the test to an OpenSpec spec scenario (sdd-kit)")
    _state["tests"] = {}


def _scenarios(item):
    found = []
    for mark in item.iter_markers(name="scenario"):
        if len(mark.args) != 2 or not all(isinstance(a, str) and a.strip() for a in mark.args):
            raise ValueError(f'{item.nodeid}: use @pytest.mark.scenario("<capability-path>", "<Scenario name>")')
        found.append([mark.args[0].strip(), mark.args[1].strip()])
    return found


def pytest_collection_modifyitems(session, config, items):
    for item in items:
        scenarios = _scenarios(item)
        if scenarios:
            item.user_properties.append((_PROP, json.dumps(scenarios)))
            _state["tests"][item.nodeid] = {"scenarios": scenarios, "outcome": None}


_RANK = {None: 0, "passed": 1, "skipped": 2, "failed": 3, "error": 4}


def pytest_runtest_logreport(report):
    props = dict(report.user_properties)
    if _PROP not in props:
        return
    entry = _state["tests"].setdefault(report.nodeid, {"scenarios": json.loads(props[_PROP]), "outcome": None})
    if report.when == "call":
        outcome = "skipped" if report.skipped else ("passed" if report.passed else "failed")
    elif report.failed:
        outcome = "error"
    elif report.skipped:
        outcome = "skipped"
    else:
        return
    if _RANK[outcome] > _RANK[entry["outcome"]]:
        entry["outcome"] = outcome


def pytest_sessionfinish(session, exitstatus):
    config = session.config
    path = config.getoption("--sdd-out")
    if not path or hasattr(config, "workerinput"):  # xdist workers report to the controller
        return
    rows = []
    for nodeid, entry in sorted(_state["tests"].items()):
        for capability, scenario in entry["scenarios"]:
            row = {"level": "unit", "capability": capability, "scenario": scenario, "test": nodeid}
            if entry["outcome"] is not None:
                row["outcome"] = entry["outcome"]
            rows.append(row)
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(rows, fh, indent=1)
