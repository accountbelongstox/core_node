# Project-managed Dockerfile for Fish Speech v1.5.1 with the fishaudio/fish-speech-1.5
# checkpoint. The official fishaudio/fish-speech images are CUDA builds, and the
# current main (S2) needs S2-Pro weights that do not fit the WSL memory cap, so
# this CPU build clones the v1.5.1 tag. Its 'stable' extra pins torch<=2.4.1; the
# constraint file keeps every later resolve on that CPU torch and on the
# transformers line the tag was released with. GPU is the compose.gpu.yml overlay
# plus a CUDA TORCH_INDEX (model.sh MODEL_TORCH_INDEX_CUDA).
FROM python:3.10-slim

ARG TORCH_INDEX=https://download.pytorch.org/whl/cpu
ARG TORCH_VERSION=2.4.1
ARG FISHSPEECH_REPO=https://github.com/fishaudio/fish-speech.git
ARG FISHSPEECH_REF=v1.5.1

ENV PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PYTHONUNBUFFERED=1

RUN apt-get update \
    && apt-get install -y --no-install-recommends git ffmpeg build-essential portaudio19-dev libsox-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /opt/fish-speech
RUN git clone --branch "$FISHSPEECH_REF" --depth 1 "$FISHSPEECH_REPO" .
RUN printf 'torch==%s\ntorchaudio==%s\ntransformers<4.49\n' "$TORCH_VERSION" "$TORCH_VERSION" > /opt/fish-speech/pycore_constraints.txt \
    && pip install --index-url "$TORCH_INDEX" --extra-index-url https://pypi.org/simple/ \
        "torch==$TORCH_VERSION" "torchaudio==$TORCH_VERSION" \
    && PIP_CONSTRAINT=/opt/fish-speech/pycore_constraints.txt pip install -e .

ENV FISHSPEECH_DEVICE=cpu \
    FISHSPEECH_CHECKPOINT_DIR=/data/checkpoints/fish-speech-1.5
EXPOSE 8080
CMD ["sh", "-c", "exec python -m tools.api_server --listen 0.0.0.0:8080 --device \"$FISHSPEECH_DEVICE\" --llama-checkpoint-path \"$FISHSPEECH_CHECKPOINT_DIR\" --decoder-checkpoint-path \"$FISHSPEECH_CHECKPOINT_DIR/firefly-gan-vq-fsq-8x1024-21hz-generator.pth\" --decoder-config-name firefly_gan_vq"]
