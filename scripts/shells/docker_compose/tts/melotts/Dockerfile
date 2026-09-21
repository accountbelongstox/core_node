# Project-managed Dockerfile for the MeloTTS class-C TTS server (no official
# image; MeloTTS officially RECOMMENDS docker on Windows - install.md).
# CPU-only base: torch comes from the official pytorch CPU wheel index; the GPU
# variant is layered by compose.gpu.yml (device reservation) plus the wheel
# index build arg.
FROM python:3.10-slim

ARG TORCH_INDEX=https://download.pytorch.org/whl/cpu

RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg git build-essential pkg-config \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /opt/melotts
RUN pip install --no-cache-dir --index-url "$TORCH_INDEX" --extra-index-url https://pypi.org/simple/ torch \
    && pip install --no-cache-dir melotts unidic-lite fastapi "uvicorn[standard]" soundfile pydub \
    && python -c "import nltk; nltk.download('averaged_perceptron_tagger_eng', quiet=True)"

# Build context carries the pycore asset servers (synced by the apply helper).
COPY melotts_api_server.py tts_text_chunking.py ./

ENV MELOTTS_HOST=0.0.0.0 \
    MELOTTS_PORT=57212
EXPOSE 57212
CMD ["python", "melotts_api_server.py"]
