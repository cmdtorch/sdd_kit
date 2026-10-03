# Preset: django (pytest)

Installs `openspec/tooling/pytest/sdd_kit_pytest.py` and the `unit` level of `openspec/tooling/verify.yaml`.

Register the marker so plain test runs (without the plugin) accept it, e.g. in `pyproject.toml`:

```toml
[tool.pytest.ini_options]
markers = ["scenario(capability, name): links the test to an OpenSpec spec scenario (sdd-kit)"]
```

Mark tests:

```python
@pytest.mark.scenario("inventory/sale-export", "Successful export")
def test_successful_export(api_client, accountant): ...
```
