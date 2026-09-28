#!/bin/bash
# GPT-SoVITS docker model definition, sourced by tts_docker_compose_common.sh
# and read by DockerWslBridge.ps1 (MODEL_* lines split on the first '='). Keep
# plain KEY=value lines at column 0: no export, no ${} expansion, GB values as
# decimals.
#
# Weights: the official pretrained models (lj1995/GPT-SoVITS on the Hugging
# Face Hub, the same repo the native installers already download) belong
# inside the cloned repo at GPT_SoVITS/pretrained_models, not under the
# staging bind mount this runner's compose_run/hf_flat methods target, so
# wiring that path needs its own compose.yml volume (follow-up).
# MODEL_WEIGHTS_METHOD is "none" here until that volume is added: ensure
# never pre-stages weights, and api_v2.py needs the models supplied into the
# image/staging separately before up/test can serve a real request.
# MODEL_HEALTH_PATH uses FastAPI's default /docs page: api_v2.py (APP =
# FastAPI()) defines no dedicated health route.
MODEL_PORT=9880
MODEL_MEM_LIMIT=4g
MODEL_CPUS=3.0
MODEL_PIDS_LIMIT=512
MODEL_HOST_FREE_RAM_GB=5.0
MODEL_EST_DISK_GB=8
MODEL_TEST_TIMEOUT=900
MODEL_HEALTH_PATH=/docs
MODEL_CONTEXT_ASSETS=""
MODEL_WEIGHTS_METHOD=none
MODEL_IMPORT_CHECK=GPT_SoVITS.TTS_infer_pack.TTS
MODEL_TORCH_INDEX_CUDA=https://download.pytorch.org/whl/cu124
MODEL_DEFAULT_DEVICE=cpu

model_smoke() {
    # Reachability-level smoke check: api_v2.py exposes /tts, /control,
    # /set_gpt_weights, /set_sovits_weights but no dedicated health route, and
    # /tts needs pretrained models this image does not yet stage (see
    # MODEL_WEIGHTS_METHOD above), so this checks the server actually answers
    # HTTP requests instead of a full audio round trip.
    local staging="$1"
    local base_url="http://127.0.0.1:${MODEL_PORT}"
    local code=""
    code="$(curl -s -o /dev/null -m "$MODEL_TEST_TIMEOUT" -w '%{http_code}' "$base_url$MODEL_HEALTH_PATH")"
    [[ "$code" == "200" ]]
}
