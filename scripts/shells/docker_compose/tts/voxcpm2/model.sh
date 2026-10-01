#!/bin/bash
# VoxCPM2 docker model definition, sourced by tts_docker_compose_common.sh and
# read by DockerWslBridge.ps1 (MODEL_* lines split on the first '='). Keep plain
# KEY=value lines at column 0: no export, no ${} expansion, GB values as decimals.
#
# Weights: openbmb/VoxCPM2 (https://huggingface.co/openbmb/VoxCPM2: model.safetensors,
# audiovae.pth, config.json, tokenizer files, tokenization_voxcpm2.py) are staged into
# the HF hub cache under the staging bind mount (HF_HOME=/data/hf); the server loads
# them with local_files_only, so runtime never downloads.
MODEL_PORT=57214
MODEL_MEM_LIMIT=12g
MODEL_CPUS=4.0
MODEL_PIDS_LIMIT=512
MODEL_HOST_FREE_RAM_GB=13.0
MODEL_EST_DISK_GB=14
MODEL_TEST_TIMEOUT=900
MODEL_HEALTH_PATH=/health
MODEL_CONTEXT_ASSETS="voxcpm2_api_server.py tts_text_chunking.py tts_audio_assembly.py tts_server_common.py"
MODEL_WEIGHTS_METHOD=compose_run
MODEL_WEIGHTS_REPO="openbmb/VoxCPM2"
MODEL_WEIGHTS_SUBDIR=hf
MODEL_WEIGHTS_ALLOW="*.pth,*.json,*.safetensors,tokenization_voxcpm2.py"
MODEL_IMPORT_CHECK=voxcpm
MODEL_TORCH_INDEX_CUDA=https://download.pytorch.org/whl/cu124
MODEL_DEFAULT_DEVICE=cpu

model_smoke() {
    local staging="$1"
    local base_url="http://127.0.0.1:${MODEL_PORT}"
    local out="$staging/smoke/voxcpm2_smoke.wav"
    local payload='{"text":"Hello from VoxCPM2."}'

    mkdir -p "$staging/smoke"
    rm -f "$out"
    curl -fsS -m "$MODEL_TEST_TIMEOUT" -o /dev/null "$base_url/load" || return 1
    curl -fsS -m "$MODEL_TEST_TIMEOUT" -X POST "$base_url/synthesize" \
        -H 'Content-Type: application/json' -d "$payload" -o "$out" || return 1
    tts_docker_wav_ok "$out"
}
