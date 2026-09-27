# Project-managed Dockerfile for the MeloTTS class-C TTS server. MeloTTS has no
# registry image; its install.md recommends Docker for Windows users.
# CPU torch comes from TORCH_INDEX (pytorch CPU wheels); the GPU variant is the
# compose.gpu.yml overlay plus a CUDA TORCH_INDEX (model.sh MODEL_TORCH_INDEX_CUDA).
# torch stays below 2.6 because MeloTTS calls torch.load with default arguments,
# and numpy stays 1.x for its librosa 0.9.1 pin. The constraint file keeps every
# later resolve on that torch. unidic (full dictionary, over 500 MB) is removed
# so MeCab falls back to the bundled unidic-lite; `python -m unidic download`
# and melo/init_downloads.py (6-language preload) are intentionally not run.
FROM python:3.10-slim

ARG TORCH_INDEX=https://download.pytorch.org/whl/cpu
ARG TORCH_VERSION=2.5.1
ARG MELOTTS_REPO=https://github.com/myshell-ai/MeloTTS.git
ARG MELOTTS_REF=209145371cff8fc3bd60d7be902ea69cbdb7965a

ENV PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PYTHONUNBUFFERED=1

RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg git build-essential pkg-config libsndfile1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /opt/melotts
RUN printf 'torch==%s\ntorchaudio==%s\nnumpy<2\n' "$TORCH_VERSION" "$TORCH_VERSION" > /opt/melotts/pycore_constraints.txt \
    && pip install --index-url "$TORCH_INDEX" --extra-index-url https://pypi.org/simple/ \
        "torch==$TORCH_VERSION" "torchaudio==$TORCH_VERSION" \
    && PIP_CONSTRAINT=/opt/melotts/pycore_constraints.txt pip install \
        "melotts @ git+${MELOTTS_REPO}@${MELOTTS_REF}" \
        unidic-lite fastapi "uvicorn[standard]" soundfile pydub huggingface_hub safetensors \
    && pip uninstall -y unidic \
    && python -c "import MeCab; MeCab.Tagger()" \
    && python -c "import nltk; [nltk.download(p, quiet=True, raise_on_error=True) for p in ('averaged_perceptron_tagger', 'averaged_perceptron_tagger_eng', 'cmudict')]"

# Build context carries the pycore asset servers (synced by the docker model runner).
COPY melotts_api_server.py tts_text_chunking.py tts_server_common.py ./

ENV MELOTTS_HOST=0.0.0.0 \
    MELOTTS_PORT=57212 \
    PYCORE_PROJECT_ROOT=/opt/core_node
EXPOSE 57212
CMD ["python", "melotts_api_server.py"]
