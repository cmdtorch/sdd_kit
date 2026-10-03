# Fixture for the sdd-kit pytest plugin (tests/verify.test.mjs runs it with real pytest).
import pytest


@pytest.mark.scenario("inventory/sales-export", "Successful export")
def test_successful_export():
    assert sorted([2, 1]) == [1, 2]


@pytest.mark.scenario("inventory/sales-export", "Empty period")
def test_empty_period_fails():
    assert [] == ["header"]


@pytest.mark.scenario("inventory/sales-export", "Teacher cannot export")
@pytest.mark.skip(reason="not ready")
def test_teacher_skipped():
    pass


@pytest.mark.scenario("inventory/sales-export", "Successful export")
@pytest.mark.parametrize("n", [1, 2])
def test_export_param(n):
    assert n > 0


@pytest.mark.scenario("inventory/student-sales", "Teacher cannot record a sale")
class TestRecording:
    def test_teacher_forbidden(self):
        assert 403 == 403


@pytest.fixture
def broken():
    raise RuntimeError("setup failed")


@pytest.mark.scenario("inventory/student-sales", "Accountant records a sale")
def test_setup_error(broken):
    pass


def test_unmarked_helper():
    assert True
