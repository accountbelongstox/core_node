# Project-managed Dockerfile for CosyVoice (official repo installs natively via
# conda python=3.10; no official image - https://github.com/FunAudioLLM/CosyVoice).
# CPU-only base; GPU is layered by compose.gpu.yml plus the TORCH_INDEX build arg.
FROM python:3.10-slim

ARG TORCH_INDEX=https://download.pytorch.org/whl/cpu

RUN apt-get update \
    && apt-get install -y --no-install-recommends git git-lfs ffmpeg sox libsox-dev libsndfile1 build-essential pkg-config \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /opt/cosyvoice
RUN git clone --depth 1 https://github.com/FunAudioLLM/CosyVoice.git . \
    && git submodule update --init --recursive
RUN pip install --no-cache-dir --index-url "$TORCH_INDEX" torch torchaudio \
    && pip install --no-cache-dir -r requirements.txt \
    && pip install --no-cache-dir fastapi "uvicorn[standard]" modelscope huggingface_hub onnxruntime

ENV MODELSCOPE_CACHE=/data/modelscope
EXPOSE 50000
CMD ["python", "runtime/python/fastapi/server.py", "--port", "50000", "--model_dir", "iic/CosyVoice2-0.5B"]
