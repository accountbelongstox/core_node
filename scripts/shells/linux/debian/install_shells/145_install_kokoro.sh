#!/bin/bash
# Kokoro-82M prerequisite (Linux) — sherpa-onnx + multi-lang Kokoro model.
# Complements 31_install_tts_offline.sh with a dedicated KOKORO_TTS_MODEL_DIR cache.
#
# Official: https://k2-fsa.github.io/sherpa/onnx/tts/all/Chinese-English/kokoro-multi-lang-v1_1.html
#
# Invocation: 145_install_kokoro.sh [--python <py>]
# No parameters required: idempotently installs (skips when complete, downloads/repairs when incomplete).
# Env: KOKORO_SKIP=1, KOKORO_TTS_MODEL_DIR
set -uo pipefail

PYTHON="python3"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMMON_DIR="$SCRIPT_DIR/../../common"
MODEL_URL=""
MODEL_DIR="${KOKORO_TTS_MODEL_DIR:-${CORE_NODE_CACHE_DIR:-$HOME/.core_node/cache}/tts/kokoro}"
MODEL_SENTINEL="$MODEL_DIR/.model_done"
FORCE=0
LOCAL_MODEL_BYTES=0

while [[ $# -gt 0 ]]; do
    case "$1" in
        --python) PYTHON="$2"; shift 2 ;;
        --force)  FORCE=1; shift ;;
        *) shift ;;
    esac
done

source "$COMMON_DIR/gvar_common.sh"
source "$COMMON_DIR/venv_python_common.sh"
. "$COMMON_DIR/base_libs/lib_gpu.sh"
. "$COMMON_DIR/tts_install_assets_common.sh"
PIPLOCK_LIB="$COMMON_DIR/base_libs/pip_lock.sh"
. "$PIPLOCK_LIB"
source "$COMMON_DIR/common_functions.sh"

resolve_python() {
    local p
    for p in "$PYTHON" python3 python; do
        if command -v "$p" >/dev/null 2>&1; then
            command -v "$p"; return 0
        fi
    done
    return 1
}

pip_install() {
    if [[ "$(uname -s)" != "Darwin" ]] && type venv_is_venv_from_common >/dev/null 2>&1 && ! venv_is_venv_from_common "$PYTHON"; then
        vpip "$PYTHON" -m pip install --break-system-packages "$@" || vpip "$PYTHON" -m pip install "$@"
    else
        vpip "$PYTHON" -m pip install "$@"
    fi
}

model_files_complete() {
    # Multi-lang Kokoro needs model.onnx + tokens.txt + voices.bin + BOTH lexicons
    # (lexicon-us-en.txt, lexicon-zh.txt). Missing lexicon-zh.txt causes the
    # "unknown Chinese token" runtime error, so it is a required completeness gate.
    [[ -n "$(find "$MODEL_DIR" -name '*.onnx' -size +0c -print -quit 2>/dev/null)" ]] || return 1
    [[ -n "$(find "$MODEL_DIR" -name 'tokens.txt' -size +0c -print -quit 2>/dev/null)" ]] || return 1
    [[ -n "$(find "$MODEL_DIR" -name 'voices.bin' -size +0c -print -quit 2>/dev/null)" ]] || return 1
    [[ -n "$(find "$MODEL_DIR" -name 'lexicon-zh.txt' -size +0c -print -quit 2>/dev/null)" ]] || return 1
    [[ -n "$(find "$MODEL_DIR" -name 'lexicon-us-en.txt' -size +0c -print -quit 2>/dev/null)" ]] || return 1
    return 0
}

model_ok() {
    [[ -f "$MODEL_SENTINEL" ]] && model_files_complete
}

download_model() {
    local archive tmp inner src expected have
    archive="$MODEL_DIR/.download.tar.bz2"
    tmp="${MODEL_DIR}/.extract"
    mkdir -p "$MODEL_DIR"
    expected="$(curl -fsI --connect-timeout 30 "$MODEL_URL" 2>/dev/null | awk 'tolower($1)=="content-length:" {print $2}' | tr -d '\r' | tail -n1)"
    if [[ -f "$archive" ]]; then
        have="$(wc -c < "$archive" 2>/dev/null | tr -d ' ')"
        echo "[install_kokoro] [resume] archive ${have:-0} / ${expected:-0} bytes"
    else
        echo "[install_kokoro] [..] downloading Kokoro model ..."
    fi
    if command -v curl >/dev/null 2>&1; then
        curl -fL -C - --retry 3 --connect-timeout 30 --progress-bar -o "$archive" "$MODEL_URL" || true
    elif command -v wget >/dev/null 2>&1; then
        wget -c -O "$archive" "$MODEL_URL" || true
    else
        echo "[install_kokoro] [!] curl/wget not found."
    fi
    if ! _hf_file_complete "$archive" "${expected:-0}"; then
        echo "[install_kokoro] [!] download incomplete; archive kept to resume next run."
        return 1
    fi
    if [[ -e "$tmp" ]]; then
        _backup_install_asset_path "$tmp" "[install_kokoro] "
    fi
    mkdir -p "$tmp"
    "$PYTHON" -c "import tarfile,sys
t=tarfile.open(sys.argv[1],'r:bz2')
try:
 t.extractall(sys.argv[2], filter='data')
except TypeError:
 t.extractall(sys.argv[2])
t.close()" "$archive" "$tmp"
    inner="$(find "$tmp" -mindepth 1 -maxdepth 1 -type d | head -n1)"
    src="${inner:-$tmp}"
    cp -rf "$src"/* "$MODEL_DIR"/ 2>/dev/null || true
    _backup_install_asset_path "$tmp" "[install_kokoro] " >/dev/null
    if model_files_complete; then
        date -u +%Y-%m-%dT%H:%M:%SZ > "$MODEL_SENTINEL"
        return 0
    fi
    echo "[install_kokoro] [!] multi-lang model incomplete (need lexicon-zh.txt + lexicon-us-en.txt)."
    return 1
}

echo "============================================================"
echo " [install_kokoro] Kokoro-82M (sherpa-onnx)"
echo "============================================================"

echo "============================================================"

if [ "$(get_global_var "SKIP_LARGE_MODELS" "false")" = "true" ]; then
    echo "[install_kokoro] [skip] Server environment without desktop and GPU detected. Skipping Kokoro installation."
    complete_prereq_step "$PYTHON" "[install_kokoro] " --absent-ok "server CPU host" sherpa_onnx soundfile
    exit 0
fi

[[ "${KOKORO_SKIP:-0}" == "1" ]] && { echo "[install_kokoro] [i] KOKORO_SKIP=1 -> skipping."; complete_prereq_step "$PYTHON" "[install_kokoro] " --absent-ok "KOKORO_SKIP=1" sherpa_onnx soundfile; }

if ! PYTHON="$(resolve_python)"; then
    echo "[install_kokoro] [!] Python 3 not found."
    fail_prereq_step "$PYTHON" "[install_kokoro] " sherpa_onnx soundfile
fi

if model_files_complete; then
    LOCAL_MODEL_BYTES="$(find "$MODEL_DIR" -type f -printf '%s\n' 2>/dev/null | awk '{sum += $1} END {print sum + 0}')"
    [[ -f "$MODEL_SENTINEL" ]] || printf '%s\n' "$MODEL_DIR" > "$MODEL_SENTINEL"
    echo "[install_kokoro] [idempotent] local model found: $MODEL_DIR (${LOCAL_MODEL_BYTES} bytes); remote lookup skipped"
fi

if model_ok && "$PYTHON" -m pip show sherpa-onnx soundfile 2>/dev/null | grep -qi '^Name: soundfile$'; then
    tts_idempotent_msg "$PYTHON" "$SCRIPT_DIR" "Kokoro multi-lang model present at $MODEL_DIR"
    complete_prereq_step "$PYTHON" "[install_kokoro] " sherpa_onnx soundfile
fi
if model_ok; then
    echo "[install_kokoro] [repair] model is complete; repairing Python dependencies without downloading it again."
fi

echo "[install_kokoro]  model dir : $MODEL_DIR"
_gpu_flag="--cpu"
if command -v gpu_present >/dev/null 2>&1 && gpu_present; then _gpu_flag="--gpu"; fi
MODEL_URL="$(tts_model_tier "$PYTHON" "$SCRIPT_DIR" kokoro_url "$_gpu_flag")"
tts_official_env_line "$PYTHON" "$SCRIPT_DIR" kokoro | while read -r _line; do
    echo "[install_kokoro]  official env (kokoro): $_line"
done
echo "[install_kokoro]  compute   : $(command -v gpu_present >/dev/null 2>&1 && gpu_present && echo 'CUDA -> full Kokoro model' || echo 'CPU -> int8 Kokoro model')"
echo "[install_kokoro]  model url : $MODEL_URL"

if ! "$PYTHON" -m pip show sherpa-onnx soundfile 2>/dev/null | grep -qi '^Name: soundfile$'; then
    echo "[install_kokoro] [..] pip install sherpa-onnx soundfile ..."
    pip_install sherpa-onnx soundfile
fi

if model_ok; then
    tts_idempotent_msg "$PYTHON" "$SCRIPT_DIR" "Kokoro multi-lang model already downloaded"
else
    if ! download_model; then
        echo "[install_kokoro] [!] model download failed; retrying next run." >&2
        fail_prereq_step "$PYTHON" "[install_kokoro] " sherpa_onnx soundfile
    fi
fi

if ! model_ok; then
    echo "[install_kokoro] [!] model verification failed; retrying next run." >&2
    fail_prereq_step "$PYTHON" "[install_kokoro] " sherpa_onnx soundfile
fi

echo "[install_kokoro] [OK] Kokoro ready. Export KOKORO_TTS_MODEL_DIR=$MODEL_DIR if needed."
complete_prereq_step "$PYTHON" "[install_kokoro] " sherpa_onnx soundfile
