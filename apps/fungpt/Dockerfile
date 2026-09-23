# BanterBot OpenAI-compatible sidecar. Mount weights at /app/weights (see BANTERBOT_WEIGHTS_DIR).
# Prefer a GPU host. CPU works but is slow for 1.8B InternLM.
#
# For CUDA hosts, rebuild FROM pytorch/pytorch:2.4.1-cuda12.1-cudnn9-runtime and
# install transformers without the CPU torch index.
FROM python:3.11-slim-bookworm

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends build-essential git \
  && rm -rf /var/lib/apt/lists/*

COPY apps/fungpt/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt \
  && pip install --no-cache-dir "torch==2.4.1" \
    --index-url https://download.pytorch.org/whl/cpu \
  && pip install --no-cache-dir \
    "transformers==4.41.2" \
    "accelerate>=0.33" \
    "einops>=0.7" \
    "sentencepiece>=0.2" \
    "protobuf>=4"

COPY apps/fungpt/ /app/

ENV BANTERBOT_WEIGHTS_DIR=/app/weights/BanterBot_1_8b-chat
ENV FUNGPT_HOST=0.0.0.0
ENV FUNGPT_PORT=8000
ENV PYTHONUNBUFFERED=1

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health')"

CMD ["sh", "-c", "python -m uvicorn server:app --host ${FUNGPT_HOST:-0.0.0.0} --port ${FUNGPT_PORT:-8000}"]
