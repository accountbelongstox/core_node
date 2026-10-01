#!/bin/bash
# MeloTTS docker model definition, sourced by tts_docker_compose_common.sh and
# read by DockerWslBridge.ps1 (MODEL_* lines split on the first '='). Keep plain
# KEY=value lines at column 0: no export, no ${} expansion, GB values as decimals.
MODEL_PORT=57212
MODEL_MEM_LIMIT=3g
MODEL_CPUS=3.0
MODEL_PIDS_LIMIT=512
MODEL_HOST_FREE_RAM_GB=4.5
MODEL_EST_DISK_GB=7
MODEL_TEST_TIMEOUT=600
MODEL_HEALTH_PATH=/health
MODEL_CONTEXT_ASSETS="melotts_api_server.py tts_text_chunking.py tts_server_common.py"
MODEL_WEIGHTS_METHOD=compose_run
MODEL_WEIGHTS_REPO="myshell-ai/MeloTTS-English myshell-ai/MeloTTS-Chinese bert-base-uncased bert-base-multilingual-uncased tohoku-nlp/bert-base-japanese-v3 kykim/bert-kor-base dccuchile/bert-base-spanish-wwm-uncased dbmdz/bert-base-french-europeana-cased"
MODEL_WEIGHTS_SUBDIR=hf_cache
MODEL_WEIGHTS_ALLOW="*.json,*.txt,*.pth,*.model,*.vocab,model.safetensors"
MODEL_IMPORT_CHECK=melo.api
MODEL_TORCH_INDEX_CUDA=https://download.pytorch.org/whl/cu124
MODEL_DEFAULT_DEVICE=cpu

model_smoke() {
    local staging="$1"
    local base_url="http://127.0.0.1:${MODEL_PORT}"
    local out="$staging/smoke/melo_smoke.wav"
    local payload='{"text":"Hello from MeloTTS.","language":"en","format":"wav"}'

    mkdir -p "$staging/smoke"
    rm -f "$out"
    curl -fsS -m "$MODEL_TEST_TIMEOUT" -o /dev/null "$base_url/load" || return 1
    curl -fsS -m "$MODEL_TEST_TIMEOUT" -X POST "$base_url/synthesize" \
        -H 'Content-Type: application/json' -d "$payload" -o "$out" || return 1
    tts_docker_wav_ok "$out"
}
