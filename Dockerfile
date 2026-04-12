FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# Install dependencies first for better caching
COPY backend/requirements.txt /app/backend/requirements.txt
RUN pip install --no-cache-dir -r /app/backend/requirements.txt

# Copy only backend code
COPY backend /app/backend

EXPOSE 7860

CMD ["uvicorn", "backend.hf_api:app", "--host", "0.0.0.0", "--port", "7860"]
