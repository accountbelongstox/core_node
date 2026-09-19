# Project-managed Dockerfile for the VoxCPM2 class-C TTS server (upstream has
# no official container image - https://github.com/OpenBMB/VoxCPM).
# CPU-only base via the official pytorch CPU wheel index; GPU is layered by
# compose.gpu.yml plus the TORCH_INDEX build arg.
FROM python:3.10-slim

ARG TORCH_INDEX=https://download.pytorch.org/whl/cpu

RUN apt-get update \
    && apt-get install -y --no-install-recommends git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /opt/voxcpm2
RUN pip install --no-cache-dir --index-url "$TORCH_INDEX" --extra-index-url https://pypi.org/simple/ torch \
    && pip install --no-cache-dir voxcpm soundfile fastapi "uvicorn[standard]"

# Build context carries the pycore asset servers (synced by the apply helper).
COPY voxcpm2_api_server.py tts_text_chunking.py tts_audio_assembly.py ./

ENV VOXCPM2_HOST=0.0.0.0 \
    VOXCPM2_PORT=57214 \
    HF_HOME=/data/hf
EXPOSE 57214
CMD ["python", "voxcpm2_api_server.py"]
