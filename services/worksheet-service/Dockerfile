FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY services/worksheet-service/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

COPY scripts /app/scripts
COPY services/worksheet-service /app/services/worksheet-service

ENV WORKSHEET_SERVICE_HOST=0.0.0.0 \
    WORKSHEET_SERVICE_PORT=8765

EXPOSE 8765

CMD ["python3", "/app/services/worksheet-service/app.py"]
