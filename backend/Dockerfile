FROM python:3.14-slim

COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

WORKDIR /app

COPY requiriments.txt .
RUN uv pip install --system --no-cache -r requiriments.txt

COPY app/ ./app/

RUN useradd --no-create-home --shell /bin/false appuser && \
    chown -R appuser /app
USER appuser

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
