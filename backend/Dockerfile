FROM python:3.10-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Menyalin seluruh kode (kecuali yang ada di .dockerignore)
COPY . .

# Environment variables dasar
ENV FLASK_APP=run.py
ENV FLASK_ENV=production
ENV PYTHONUNBUFFERED=1

# Create a non-root user
RUN adduser --disabled-password --gecos '' appuser && \
    chown -R appuser:appuser /app

USER appuser

ENV PORT=5000
EXPOSE $PORT

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD python -c "import urllib.request; import os; port = os.environ.get('PORT', '5000'); urllib.request.urlopen(f'http://localhost:{port}/api/health')" || exit 1

# Entry point: run migrations then start Gunicorn production server
CMD sh -c "flask db upgrade && gunicorn --bind 0.0.0.0:${PORT:-5000} --workers 4 --timeout 120 --access-logfile - run:app"
