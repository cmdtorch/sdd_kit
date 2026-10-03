FROM python:3.13-slim
COPY --from=ghcr.io/astral-sh/uv:0.12 /uv /bin/uv
WORKDIR /app
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev
COPY . .
EXPOSE 8000
CMD ["sh", "-c", "uv run --no-dev python manage.py migrate --noinput && uv run --no-dev python manage.py runserver 0.0.0.0:8000"]
