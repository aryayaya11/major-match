FROM python:3.10-slim

WORKDIR /app

# Copy requirements.txt dari folder backend
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy seluruh isi folder backend ke dalam WORKDIR (/app)
COPY backend/ .

# Environment variables dasar
ENV FLASK_APP=run.py
ENV FLASK_ENV=production
ENV PYTHONUNBUFFERED=1

EXPOSE 5000

# Entry point untuk menjalankan Flask dan migrasi database otomatis
CMD flask db upgrade && python run.py
