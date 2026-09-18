# Project-managed Dockerfile for GPT-SoVITS (official tested env is conda
# python 3.9-3.11; no official image - https://github.com/RVC-Boss/GPT-SoVITS).
# CPU-only base; GPU is layered by compose.gpu.yml plus the TORCH_INDEX build arg.
FROM python:3.10-slim

ARG TORCH_INDEX=https://download.pytorch.org/whl/cpu

RUN apt-get update \
    && apt-get install -y --no-install-recommends git ffmpeg build-essential pkg-config \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /opt/gpt-sovits
RUN git clone --depth 1 https://github.com/RVC-Boss/GPT-SoVITS.git .
COPY gptsovits_build_constraints.txt ./
RUN export PIP_CONSTRAINT=/opt/gpt-sovits/gptsovits_build_constraints.txt \
        PIP_BUILD_CONSTRAINT=/opt/gpt-sovits/gptsovits_build_constraints.txt \
    && pip install --no-cache-dir -r gptsovits_build_constraints.txt \
    && pip install --no-cache-dir --index-url "$TORCH_INDEX" torch torchaudio \
    && pip install --no-cache-dir -r requirements.txt

EXPOSE 9880
CMD ["python", "api_v2.py", "-a", "0.0.0.0", "-p", "9880"]
