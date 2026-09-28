#!/bin/bash
# CosyVoice docker model definition, sourced by tts_docker_compose_common.sh and
# read by DockerWslBridge.ps1 (MODEL_* lines split on the first '='). Keep plain
# KEY=value lines at column 0: no export, no ${} expansion, GB values as decimals.
#
# Weights: the official fastapi server loads iic/CosyVoice2-0.5B from
# ModelScope (Dockerfile sets MODELSCOPE_CACHE=/data/modelscope), not the
# Hugging Face Hub this runner's compose_run/hf_flat methods stage from, so
# MODEL_WEIGHTS_METHOD is "none": ensure never pre-stages weights, and the
# first up/test pays the ModelScope download on container start (cached under
# the staging bind mount afterwards). MODEL_HEALTH_PATH uses FastAPI's default
# /docs page: server.py defines no dedicated health route.
MODEL_PORT=50000
MODEL_MEM_LIMIT=4g
MODEL_CPUS=3.0
MODEL_PIDS_LIMIT=512
MODEL_HOST_FREE_RAM_GB=5.0
MODEL_EST_DISK_GB=8
MODEL_TEST_TIMEOUT=900
MODEL_HEALTH_PATH=/docs
MODEL_CONTEXT_ASSETS=""
MODEL_WEIGHTS_METHOD=none
MODEL_IMPORT_CHECK=cosyvoice.cli.cosyvoice
MODEL_TORCH_INDEX_CUDA=https://download.pytorch.org/whl/cu124
MODEL_DEFAULT_DEVICE=cpu

model_smoke() {
    # Reachability-level smoke check: server.py exposes /inference_sft etc. but
    # no dedicated health route, and its spk_id contract is not yet confirmed
    # against the CosyVoice2-0.5B zero-shot model this image runs (follow-up),
    # so this checks the server actually answers HTTP requests after weights
    # finish loading, instead of a full audio round trip.
    local staging="$1"
    local base_url="http://127.0.0.1:${MODEL_PORT}"
    local code=""
    code="$(curl -s -o /dev/null -m "$MODEL_TEST_TIMEOUT" -w '%{http_code}' "$base_url$MODEL_HEALTH_PATH")"
    [[ "$code" == "200" ]]
}
