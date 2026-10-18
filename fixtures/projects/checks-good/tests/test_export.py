# Fixture tests (never executed). Used by the traceability check and the test-review input.
import pytest


# @scenario inventory/sales-export :: Successful export
def test_successful_export(api_client, accountant, sale_factory):
    sale_factory(status="paid", total="100.00")
    sale_factory(status="paid", total="50.00")
    sale_factory(status="draft", total="999.00")
    response = api_client(accountant).get("/api/v1/sales/export/?date_from=2026-09-01&date_to=2026-09-30")
    assert response.status_code == 200
    assert [row["total"] for row in response.json()["results"]] == ["100.00", "50.00"]


# @scenario inventory/sales-export :: Empty period
def test_empty_period(api_client, accountant):
    response = api_client(accountant).get("/api/v1/sales/export/?date_from=2020-01-01&date_to=2020-01-31")
    assert response.json() == {"count": 0, "next": None, "previous": None, "results": []}


# @scenario inventory/sales-export :: Teacher cannot export
def test_teacher_forbidden(api_client, teacher):
    response = api_client(teacher).get("/api/v1/sales/export/?date_from=2026-09-01&date_to=2026-09-30")
    assert response.status_code == 403
    assert response.json()["detail"] == "You do not have permission to perform this action."
