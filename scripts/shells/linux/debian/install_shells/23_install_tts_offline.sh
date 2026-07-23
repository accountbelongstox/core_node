#!/bin/bash
# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only.
# 2. Never execute, create, or modify test code.
# 3. Never create or update documentation (*.md).
# 4. Never write summaries during development or thinking process.
# 5. Declare all variables at the beginning of the file.
# 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
# 7. Do not modify these rules.
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

# Sherpa-ONNX offline TTS (Kokoro zh/en model) — self-contained, no sibling installers.
# Other TTS/STT engines are separate numbered scripts; the caller (dd.sh sweep or
# prepare_pycore_prerequisites.sh) runs them in order.
#
# Invocation:
#   23_install_tts_offline.sh [--python <py>] [--force]
#   Legacy flags (--core-only, --melotts, --parallel, …) are ignored with a hint.

PYTHON="python3"
FORCE=0
SCRIPT_DIR="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}" 2>/dev/null || echo "${BASH_SOURCE[0]}")")" && pwd)"
COMMON_DIR="$SCRIPT_DIR/../../common"
SHERPA_GUARD="$COMMON_DIR/sherpa_onnx_cpu_guard.sh"
PIPLOCK_LIB="$COMMON_DIR/base_libs/pip_lock.sh"
MODEL_DIR="${CORE_NODE_CACHE_DIR:-/var/_core_node/cache}/tts/sherpa"
MODEL_URL=""
MODEL_ARCHIVE=""
MODEL_SENTINEL=""
MODEL_OK=0
TMP_EXTRACT=""
PIP_ARGS=()

source "$COMMON_DIR/gvar_common.sh"
source "$COMMON_DIR/venv_python_common.sh"
. "$COMMON_DIR/base_libs/lib_gpu.sh" 2>/dev/null || true
. "$COMMON_DIR/tts_install_assets_common.sh"
set -uo pipefail

[ -f "$PIPLOCK_LIB" ] && . "$PIPLOCK_LIB"
command -v vpip >/dev/null 2>&1 || vpip() { "$@"; }

while [[ $# -gt 0 ]]; do
    case "$1" in
        --python)    PYTHON="$2"; shift 2 ;;
        --force)     FORCE=1;     shift   ;;
        --core-only|--melotts|--gptsovits|--chattts|--cosyvoice|--f5tts|--parallel)
            echo "[23_install_tts_offline] [i] $1 is deprecated; this script installs sherpa only. Run sibling scripts or prepare_pycore_prerequisites.sh."
            shift ;;
        *) echo "[!] Unknown argument: $1" >&2; shift ;;
    esac
done

resolve_python() {
    if [[ -x "$VENV_PYTHON3" ]]; then
        echo "$VENV_PYTHON3"; return 0
    fi
    local preferred="$1" name
    if [[ -n "$preferred" ]] && command -v "$preferred" >/dev/null 2>&1 \
        && "$preferred" -c 'import sys; sys.exit(0 if sys.version_info[0]==3 else 1)' >/dev/null 2>&1; then
        command -v "$preferred"; return 0
    fi
    for name in python3 python; do
        if command -v "$name" >/dev/null 2>&1 \
            && "$name" -c 'import sys; sys.exit(0 if sys.version_info[0]==3 else 1)' >/dev/null 2>&1; then
            command -v "$name"; return 0
        fi
    done
    return 1
}

py_has_module() {
    "$PYTHON" -c "import importlib.util,sys; sys.exit(0 if importlib.util.find_spec('$1') else 1)" >/dev/null 2>&1
}

pip_install() {
    PIP_ARGS=("$@")
    if [[ "$(uname -s)" != "Darwin" ]] && ! venv_is_venv_from_common "$PYTHON"; then
        PIP_ARGS=(--break-system-packages "${PIP_ARGS[@]}")
    fi
    vpip "$PYTHON" -m pip install "${PIP_ARGS[@]}" || vpip "$PYTHON" -m pip install "$@"
}

install_sherpa_model() {
    local archive="$1" tmp="$2" mdir="$3" sentinel="$4" url="$5"
    [[ -f "$archive" ]] || return 1
    rm -rf "$tmp"; mkdir -p "$tmp"
    if ! "$PYTHON" -c "import tarfile, sys
t = tarfile.open(sys.argv[1], 'r:bz2')
try:
    t.extractall(sys.argv[2], filter='data')
except TypeError:
    t.extractall(sys.argv[2])
t.close()" "$archive" "$tmp"; then
        rm -rf "$tmp"; return 1
    fi
    local inner src
    inner="$(find "$tmp" -mindepth 1 -maxdepth 1 -type d | head -n1)"
    src="${inner:-$tmp}"
    cp -rf "$src"/* "$mdir"/ 2>/dev/null || true
    if find "$mdir" -name '*.onnx' -type f 2>/dev/null | grep -q .; then
        echo "$url" > "$sentinel"
        rm -rf "$tmp"; return 0
    fi
    rm -rf "$tmp"; return 1
}

echo "============================================================"
echo " Installing offline TTS (Sherpa-ONNX + Kokoro model)"
echo "============================================================"

if ! PYTHON="$(resolve_python "$PYTHON")"; then
    echo "[X] Python 3 was NOT found. Run 13_ensure_python.sh first." >&2
    exit 1
fi
echo "  python : $PYTHON"
_gpu_flag="--cpu"
if command -v gpu_present >/dev/null 2>&1 && gpu_present; then _gpu_flag="--gpu"; fi
MODEL_URL="$(tts_model_tier "$PYTHON" "$SCRIPT_DIR" kokoro_url "$_gpu_flag")"
tts_official_env_line "$PYTHON" "$SCRIPT_DIR" sherpa | while read -r _line; do
    echo "  official env (sherpa): $_line"
done
echo "  model url: $MODEL_URL ($(echo "$_gpu_flag" | tr -d '-'))"

if [[ -f "$SHERPA_GUARD" ]]; then
    SOG_PYTHON="$PYTHON" bash "$SHERPA_GUARD" --python "$PYTHON"
elif ! py_has_module sherpa_onnx; then
    pip_install --upgrade sherpa-onnx || true
fi
if py_has_module sherpa_onnx; then
    echo "[OK] sherpa-onnx present."
else
    echo "[!] sherpa-onnx not importable; retrying next run." >&2
    fail_prereq_step "$PYTHON" "[install_tts_offline] " sherpa_onnx
fi

MODEL_SENTINEL="$MODEL_DIR/.model_installed"
MODEL_ARCHIVE="$MODEL_DIR/.download.tar.bz2"
echo "  model dir : $MODEL_DIR"

if [[ -f "$MODEL_SENTINEL" ]] && find "$MODEL_DIR" -name '*.onnx' -type f 2>/dev/null | grep -q . && [[ "$FORCE" -eq 0 ]]; then
    tts_idempotent_msg "$PYTHON" "$SCRIPT_DIR" "Kokoro model present at $MODEL_DIR"
    complete_prereq_step "$PYTHON" "[install_tts_offline] " sherpa_onnx
fi

mkdir -p "$MODEL_DIR"
TMP_EXTRACT="$(mktemp -d)"
MODEL_OK=0
if [[ -f "$MODEL_ARCHIVE" ]]; then
    install_sherpa_model "$MODEL_ARCHIVE" "$TMP_EXTRACT" "$MODEL_DIR" "$MODEL_SENTINEL" "$MODEL_URL" && MODEL_OK=1
fi
if [[ "$MODEL_OK" -eq 0 ]]; then
    if curl -fL -C - --retry 3 --connect-timeout 30 "$MODEL_URL" -o "$MODEL_ARCHIVE" \
        || wget -c -q "$MODEL_URL" -O "$MODEL_ARCHIVE"; then
        install_sherpa_model "$MODEL_ARCHIVE" "$TMP_EXTRACT" "$MODEL_DIR" "$MODEL_SENTINEL" "$MODEL_URL" \
            && MODEL_OK=1 \
            || echo "[!] Archive incomplete after download; KEPT to RESUME next boot."
    else
        echo "[!] Download incomplete; partial archive KEPT. edge/ai TTS still work."
    fi
fi
rm -rf "$TMP_EXTRACT" 2>/dev/null || true
if [[ "$MODEL_OK" -ne 1 ]] || [[ ! -f "$MODEL_SENTINEL" ]] \
    || ! find "$MODEL_DIR" -name '*.onnx' -type f 2>/dev/null | grep -q .; then
    echo "[!] Kokoro model is incomplete; retrying next run." >&2
    fail_prereq_step "$PYTHON" "[install_tts_offline] " sherpa_onnx
fi
complete_prereq_step "$PYTHON" "[install_tts_offline] " sherpa_onnx
