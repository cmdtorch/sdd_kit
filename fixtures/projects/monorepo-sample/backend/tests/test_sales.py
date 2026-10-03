from decimal import Decimal

import pytest
from rest_framework.test import APIClient

from shop.models import Sale

pytestmark = pytest.mark.django_db


@pytest.mark.scenario("sales/sales-list", "Sales are listed newest first")
def test_sales_listed_newest_first():
    Sale.objects.create(student="Aysel", quantity=2, unit_price=Decimal("50.00"))
    Sale.objects.create(student="Murad", quantity=1, unit_price=Decimal("30.00"))
    response = APIClient().get("/api/sales/")
    assert response.status_code == 200
    rows = [(r["student"], r["quantity"], r["unit_price"], r["total"]) for r in response.json()]
    assert rows == [("Murad", 1, "30.00", "30.00"), ("Aysel", 2, "50.00", "100.00")]


@pytest.mark.scenario("sales/sales-list", "Empty list")
def test_empty_list():
    response = APIClient().get("/api/sales/")
    assert response.status_code == 200
    assert response.json() == []
