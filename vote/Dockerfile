# Start from the official Python 3.11 slim image (small size, just what we need)
FROM python:3.11-slim AS base

# Install curl — we need it for Docker's health check to ping our app
RUN apt-get update && \
    apt-get install -y --no-install-recommends curl && \
    rm -rf /var/lib/apt/lists/*

# Set the working directory inside the container
WORKDIR /usr/local/app

# Copy requirements first and install them
# (Docker caches this layer — if requirements don't change, it won't reinstall)
COPY requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# ---- Development stage ----
FROM base AS dev
ENV FLASK_ENV=development
COPY . .
CMD ["gunicorn", "app:app", "-b", "0.0.0.0:80", "--log-file", "-", "--access-logfile", "-", "--workers", "4", "--keep-alive", "0"]