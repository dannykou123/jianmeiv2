FROM python:3.11-slim

# Pillow 需要 libfreetype；安裝 Noto CJK 字型做中文 rasterize、openssl 產生自簽憑證
RUN apt-get update && apt-get install -y --no-install-recommends \
    fonts-noto-cjk \
    libfreetype6 \
    openssl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app


COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY main.py .

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]