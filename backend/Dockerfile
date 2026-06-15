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

EXPOSE 5000

# Entry point (Gunicorn disarankan untuk production, namun ini untuk mempermudah dockerize MVP)
CMD ["python", "run.py"]
