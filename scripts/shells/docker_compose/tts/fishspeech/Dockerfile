# Project-managed Dockerfile for Fish Speech local inference (official hub
# image fishaudio/fish-speech exists; this project build keeps the asset layout
# identical to the other engines and pins the upstream torch ABI 2.8.0).
# CPU-only base; GPU is layered by compose.gpu.yml plus the TORCH_INDEX build
# arg (torch 2.8.0 has no cu130 wheels; use the cu128 index for GPU builds).
FROM python:3.10-slim

ARG TORCH_INDEX=https://download.pytorch.org/whl/cpu

RUN apt-get update \
    && apt-get install -y --no-install-recommends git ffmpeg build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /opt/fish-speech
RUN git clone --depth 1 https://github.com/fishaudio/fish-speech.git .
RUN pip install --no-cache-dir --index-url "$TORCH_INDEX" --extra-index-url https://pypi.org/simple/ torch==2.8.0 torchaudio==2.8.0 \
    && pip install --no-cache-dir -e .

ENV FISHSPEECH_CHECKPOINT=/data/checkpoints/openaudio-s1-mini
EXPOSE 8080
CMD ["python", "tools/api_server.py", "--listen", "0.0.0.0:8080", "--checkpoint-path", "/data/checkpoints/openaudio-s1-mini"]
