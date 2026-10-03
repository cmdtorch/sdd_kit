# Fixture tests (not executed).
import pytest


class TestRecording:
    pass


@pytest.mark.scenario("inventory/student-sales", "Teacher cannot record a sale")
def test_teacher_cannot_record(api_client, teacher, student):
    response = api_client(teacher).post("/api/v1/sales/", {"student": student.id, "quantity": 1})
    assert response.status_code == 403
    assert response.json()["detail"] == "Only accountants and administrators can record sales"


def test_unrelated():
    assert 1 + 1 == 2
