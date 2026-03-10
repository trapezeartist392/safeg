FROM python:3.11-slim
WORKDIR /app
RUN pip install fastapi uvicorn httpx --no-cache-dir
COPY main.py .
EXPOSE 5001
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "5001"]
