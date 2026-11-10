# Fixture tests (never executed).
import pytest


# @scenario inventory/sale-import :: Successful import
# @case inventory/sale-import :: Import of a file with two rows
def test_successful_import(upload, sales):
    upload(rows=[{"total": "20.00"}, {"total": "30.00"}])
    assert [s.total for s in sales(status="draft")] == ["20.00", "30.00"]


# @scenario inventory/sale-import :: File with a wrong column is rejected
# @case inventory/sale-import :: Import of a file without the total column
def test_missing_total_column(upload, sales):
    response = upload(columns=["student", "quantity"])
    assert response.status_code == 400
    assert response.json()["detail"] == "Missing column: total"
    assert sales() == []
