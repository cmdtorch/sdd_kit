# The commands the sdd-kit django preset expects (openspec/tooling/verify.yaml).
test:
	uv run pytest $(FILE)

lint:
	uv run python -m compileall -q config shop tests

typecheck:
	uv run python manage.py check --fail-level WARNING
