#!/bin/bash
# Fish Speech docker model definition (v1.5.1 code + fishaudio/fish-speech-1.5),
# sourced by tts_docker_compose_common.sh and read by DockerWslBridge.ps1
# (MODEL_* lines split on the first '='). Keep plain KEY=value lines at column 0:
# no export, no ${} expansion, GB values as decimals.
MODEL_PORT=8080
MODEL_MEM_LIMIT=4608m
MODEL_CPUS=3.0
MODEL_PIDS_LIMIT=512
MODEL_HOST_FREE_RAM_GB=6.0
MODEL_EST_DISK_GB=7
MODEL_TEST_TIMEOUT=1200
MODEL_HEALTH_PATH=/v1/health
MODEL_CONTEXT_ASSETS=""
MODEL_WEIGHTS_METHOD=hf_flat
MODEL_WEIGHTS_REPO=fishaudio/fish-speech-1.5
MODEL_WEIGHTS_SUBDIR=checkpoints/fish-speech-1.5
MODEL_WEIGHTS_ALLOW="*.json,*.pth,*.safetensors,*.txt,*.tiktoken,*.model"
MODEL_IMPORT_CHECK=tools.api_server
MODEL_TORCH_INDEX_CUDA=https://download.pytorch.org/whl/cu124
MODEL_DEFAULT_DEVICE=cpu

model_smoke() {
    local staging="$1"
    local out="$staging/smoke/fish_smoke.wav"

    mkdir -p "$staging/smoke"
    rm -f "$out"
    docker exec "$TTS_DOCKER_CONTAINER" python tools/api_client.py \
        --url "http://127.0.0.1:8080/v1/tts" --text "Hello from Fish Speech" \
        --output /data/smoke/fish_smoke --format wav --no-play || return 1
    tts_docker_wav_ok "$out"
}
