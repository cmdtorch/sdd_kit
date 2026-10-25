# Fixture tests (never executed). Used by the traceability check and the archive gate.
import pytest


# @scenario inventory/sale-export :: Successful export
# @case inventory/sale-export :: Export of a month with two paid sales
def test_successful_export(api_client, accountant, sale_factory):
    sale_factory(status="paid", total="100.00", month="2026-03")
    sale_factory(status="paid", total="50.00", month="2026-03")
    sale_factory(status="draft", total="999.00", month="2026-03")
    response = api_client(accountant).get("/api/v1/sales/export/?month=2026-03")
    assert [row["total"] for row in response.json()["results"]] == ["100.00", "50.00"]


# @case inventory/sale-export :: Draft sale is left out
def test_draft_left_out(export, sale_factory):
    sale_factory(status="draft", total="999.00", month="2026-03")
    assert [row.total for row in export("2026-03").rows] == []


# @scenario inventory/sale-export :: Empty period
# @case inventory/sale-export :: Export of an empty period
def test_empty_period(export):
    assert export("2020-01").rows == []


# @scenario inventory/sale-export :: Totals are rounded
# @case inventory/sale-export :: Amount 0.005 rounds up
# @case inventory/sale-export :: Amount 0.015 rounds up
@pytest.mark.parametrize("total,shown", [("10.005", "10.01"), ("10.015", "10.02")])
def test_totals_rounded(export, sale_factory, total, shown):
    sale_factory(status="paid", total=total, month="2026-03")
    assert export("2026-03").rows[0].total == shown


# @scenario inventory/sale-export :: Teacher cannot export
# @case inventory/sale-export :: Teacher gets 403
def test_teacher_forbidden(api_client, teacher):
    response = api_client(teacher).get("/api/v1/sales/export/?month=2026-03")
    assert response.status_code == 403
