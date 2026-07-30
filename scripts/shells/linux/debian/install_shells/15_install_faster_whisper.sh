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

# Single source of truth for the faster-whisper prerequisite (DEFAULT STT engine
# for the pycore "Video Extraction" feature) on Linux/macOS. Prefix 15 sorts right
# AFTER 13_ensure_python.sh and 14_install_python_prereq_packages.sh in install.sh's
# numeric-ordered run, so pip and ML prereqs are ready.
# Also invoked by prepare_pycore_prerequisites.sh (pyservice).
# (the pyservice prerequisite reference) to keep one copy of the logic.
#
# Invocation contracts:
#   - install.sh flow:  16_install_faster_whisper.sh           (no args; resolves python)
#   - pyservice flow:   16_install_faster_whisper.sh --python <py> [--model <m>] [--force]
set -uo pipefail

# Declare all variables at the beginning
SCRIPT_CURRENT_DIR=""
PARENT_DIR_LEVEL_1=""
PARENT_DIR_LEVEL_2=""
PYTHON="python3"
MODEL=""
FORCE=0
MIN_RAM_GB=1
MIN_DISK_GB=100
RAM_GB=""
DISK_GB=""
reasons=()
PIP_ARGS=()
CUDA_INDEX_LIB=""
CUDA_POLICY_TAG=""
CUDA_POLICY_MAJOR=""
CTRANSLATE_CUDA_MAJOR="12"
CTRANSLATE_GPU_PACKAGE_CSV=""
CTRANSLATE_DEPS_READY=1
CTRANSLATE_GPU_PACKAGES=()
MISSING_CTRANSLATE_PACKAGES=()
package_spec=""
package_metadata=""
USE_CTRANSLATE_CUDA=0
FASTER_WHISPER_METADATA=""
FASTER_WHISPER_READY=0
FASTER_WHISPER_MODEL_READY=0
LOCAL_MODEL_PATH=""
LOCAL_MODEL_BYTES=0

# Resolve the common dir the same way sibling install scripts do.
SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "$SCRIPT_CURRENT_DIR/../../common/tts_install_assets_common.sh"
PARENT_DIR_LEVEL_1="$(dirname "$SCRIPT_CURRENT_DIR")"
PARENT_DIR_LEVEL_2="$(dirname "$PARENT_DIR_LEVEL_1")"

# Source global variables (exports COMPILE_DIR), then the shared venv resolution
# (exports VENV_DIR / VENV_PYTHON3 / VENV_PIP3 and helpers) so package installs
# target the shared venv built by 13_ensure_python.sh, not the system python.
source "$PARENT_DIR_LEVEL_2/common/gvar_common.sh"
source "$PARENT_DIR_LEVEL_2/common/venv_python_common.sh"
# Serialize pip into the shared venv.
PIPLOCK_LIB="$PARENT_DIR_LEVEL_2/common/base_libs/pip_lock.sh"
. "$PIPLOCK_LIB"
CUDA_INDEX_LIB="$PARENT_DIR_LEVEL_2/common/base_libs/cuda_index.sh"
. "$CUDA_INDEX_LIB"
. "$PARENT_DIR_LEVEL_2/common/base_libs/lib_gpu.sh"
CTRANSLATE_CUDA_MAJOR="${AI_CTRANSLATE2_CUDA_MAJOR:-12}"

find_faster_whisper_local_model() {
    local model_name="$1"
    local cache_root="" candidate="" weight_file="" config_file="" bytes=0
    local -a cache_roots=()
    LOCAL_MODEL_PATH=""
    LOCAL_MODEL_BYTES=0
    [[ -n "${HUGGINGFACE_HUB_CACHE:-}" ]] && cache_roots+=("$HUGGINGFACE_HUB_CACHE")
    [[ -n "${HF_HOME:-}" ]] && cache_roots+=("${HF_HOME%/}/hub")
    cache_roots+=("${CORE_NODE_CACHE_DIR:-/var/_core_node/cache}/huggingface/hub")
    if [[ -d "$model_name" ]]; then
        config_file="$(find "$model_name" -type f -name 'config.json' -size +0c -print -quit 2>/dev/null)"
        weight_file="$(find "$model_name" -type f \( -name 'model.bin' -o -name 'model.safetensors' \) -size +0c -print -quit 2>/dev/null)"
        if [[ -n "$config_file" && -n "$weight_file" ]]; then
            bytes="$(find "$model_name" -type f \( -name 'model.bin' -o -name 'model.safetensors' \) -printf '%s\n' 2>/dev/null | awk '{sum += $1} END {print sum + 0}')"
            if [[ "$bytes" -gt 0 ]]; then
                LOCAL_MODEL_PATH="$model_name"
                LOCAL_MODEL_BYTES="$bytes"
                return
            fi
        fi
    fi
    for cache_root in "${cache_roots[@]}"; do
        [[ -d "$cache_root" ]] || continue
        while IFS= read -r candidate; do
            config_file="$(find "$candidate" -type f -name 'config.json' -size +0c -print -quit 2>/dev/null)"
            weight_file="$(find "$candidate" -type f \( -name 'model.bin' -o -name 'model.safetensors' \) -size +0c -print -quit 2>/dev/null)"
            if [[ -n "$config_file" && -n "$weight_file" ]]; then
                bytes="$(find "$candidate" -type f \( -name 'model.bin' -o -name 'model.safetensors' \) -printf '%s\n' 2>/dev/null | awk '{sum += $1} END {print sum + 0}')"
                if [[ "$bytes" -gt 0 ]]; then
                    LOCAL_MODEL_PATH="$candidate"
                    LOCAL_MODEL_BYTES="$bytes"
                    return
                fi
            fi
        done < <(find "$cache_root" -maxdepth 1 -type d -name "models--*--faster-whisper-${model_name}" -print 2>/dev/null)
    done
    :
}
CTRANSLATE_GPU_PACKAGE_CSV="${AI_CTRANSLATE2_GPU_PACKAGES:-}"
IFS=',' read -ra CTRANSLATE_GPU_PACKAGES <<< "$CTRANSLATE_GPU_PACKAGE_CSV"

while [[ $# -gt 0 ]]; do
    case "$1" in
        --python) PYTHON="$2"; shift 2 ;;
        --model)  MODEL="$2";  shift 2 ;;
        --force)  FORCE=1;     shift   ;;
        *) echo "[!] Unknown argument: $1" >&2; shift ;;
    esac
done

get_ram_gb() {
    if [[ -r /proc/meminfo ]]; then
        awk '/^MemTotal:/{ printf "%d", $2/1024/1024 }' /proc/meminfo && return 0
    fi
    if command -v sysctl >/dev/null 2>&1; then
        local b; b="$(sysctl -n hw.memsize 2>/dev/null)"
        [[ -n "$b" ]] && echo $(( b / 1024 / 1024 / 1024 )) && return 0
    fi
    echo ""
}
get_free_disk_gb() {
    df -k -P 2>/dev/null | awk '
        NR>1 && $1 !~ /^(tmpfs|devtmpfs|overlay|squashfs|none|udev|devfs|map.*)$/ { sum += $4 }
        END { if (sum > 0) printf "%d", sum/1024/1024 }'
}
is_server() {
    [[ "$(uname -s)" == "Darwin" ]] && return 1
    if command -v systemctl >/dev/null 2>&1; then
        case "$(systemctl get-default 2>/dev/null)" in graphical.target) return 1 ;; esac
    fi
    if [[ -n "${DISPLAY:-}" || -n "${WAYLAND_DISPLAY:-}" || -n "${XDG_CURRENT_DESKTOP:-}" ]]; then return 1; fi
    return 0
}
# GPU detection from the canonical shared helper.
has_cuda() {
    gpu_present
}

ctranslate_cuda_usable() {
    local output=""
    output="$("$PYTHON" -c "import ctranslate2; print('__CUDA_READY__' if ctranslate2.get_cuda_device_count() > 0 else '__CUDA_UNAVAILABLE__')" 2>/dev/null || true)"
    [[ "$output" == *"__CUDA_READY__"* ]]
}

pip_package_present() {
    local package_name="$1"
    local metadata=""
    metadata="$("$PYTHON" -m pip show "$package_name" 2>/dev/null || true)"
    [[ "$metadata" == *"Name:"* ]]
}

echo "============================================================"
echo " Installing faster-whisper (default STT for Video Extraction)"
echo "============================================================"

# --- 0) resolve python (13_ensure_python.sh has already run in install flow) --- #
# Prefer the shared venv built by 13_ensure_python.sh so packages install INTO the
# venv (not the externally-managed system python). An explicit --python still wins.
if [[ "$PYTHON" == "python3" ]]; then
    PYTHON="$(venv_python_from_common)"
fi
echo "  python : $PYTHON"

# --- 1) capacity / environment guard ------------------------------------- #
RAM_GB="$(get_ram_gb)"; DISK_GB="$(get_free_disk_gb)"
echo "  ram    : ${RAM_GB:-?} GB"
echo "  disk   : ${DISK_GB:-?} GB free (all filesystems)"
if [[ "$FORCE" -eq 0 ]]; then
    [[ -n "$RAM_GB"  && "$RAM_GB"  -lt "$MIN_RAM_GB"  ]] && reasons+=("RAM ${RAM_GB} GB < ${MIN_RAM_GB} GB")
    [[ -n "$DISK_GB" && "$DISK_GB" -lt "$MIN_DISK_GB" ]] && reasons+=("free disk ${DISK_GB} GB < ${MIN_DISK_GB} GB")
    if [[ ${#reasons[@]} -gt 0 ]]; then
        echo "[skip] System too small for faster-whisper (${reasons[*]}); skipping. Use --force to override."
        complete_prereq_step "$PYTHON" "[faster_whisper] " --absent-ok "resource policy" faster_whisper
    fi
    if is_server && ! has_cuda; then
        echo "[skip] Headless server (non-desktop) with no CUDA GPU; skipping. Use --force to override."
        complete_prereq_step "$PYTHON" "[faster_whisper] " --absent-ok "headless CPU host" faster_whisper
    fi
fi

# --- 2) faster-whisper (pip metadata idempotency) ------------------------ #
FASTER_WHISPER_METADATA="$("$PYTHON" -m pip show faster-whisper 2>/dev/null || true)"
if [[ "$FASTER_WHISPER_METADATA" == *"Name:"* ]]; then
    FASTER_WHISPER_READY=1
    tts_idempotent_msg "$PYTHON" "$SCRIPT_CURRENT_DIR" "faster-whisper metadata is present"
else
    echo "[..] pip install faster-whisper ..."
    PIP_ARGS=(faster-whisper)
    echo "[run] $PYTHON -m pip install ${PIP_ARGS[*]}"
    vpip "$PYTHON" -m pip install "${PIP_ARGS[@]}" || true
    FASTER_WHISPER_METADATA="$("$PYTHON" -m pip show faster-whisper 2>/dev/null || true)"
    if [[ "$FASTER_WHISPER_METADATA" == *"Name:"* ]]; then
        FASTER_WHISPER_READY=1
        echo "[OK] faster-whisper installed."
    else
        echo "[!] faster-whisper metadata is still missing; retrying next run."
    fi
fi

# --- 3) Runtime mode: preserve the one canonical CUDA major -------------- #
CUDA_POLICY_TAG="$(cuda_policy_tag)"
CUDA_POLICY_MAJOR="$(cuda_policy_field major "$CUDA_POLICY_TAG" 2>/dev/null || true)"
if has_cuda && [[ "$CUDA_POLICY_MAJOR" == "$CTRANSLATE_CUDA_MAJOR" ]]; then
    CTRANSLATE_DEPS_READY=1
    MISSING_CTRANSLATE_PACKAGES=()
    for package_spec in "${CTRANSLATE_GPU_PACKAGES[@]}"; do
        if [[ -n "$package_spec" ]] && ! pip_package_present "$package_spec"; then
            CTRANSLATE_DEPS_READY=0
            MISSING_CTRANSLATE_PACKAGES+=("$package_spec")
        fi
    done
    if [[ ${#MISSING_CTRANSLATE_PACKAGES[@]} -gt 0 ]]; then
        echo "[..] installing missing CTranslate2 GPU dependencies: ${MISSING_CTRANSLATE_PACKAGES[*]}"
        vpip "$PYTHON" -m pip install "${MISSING_CTRANSLATE_PACKAGES[@]}" || true
        CTRANSLATE_DEPS_READY=1
        for package_spec in "${CTRANSLATE_GPU_PACKAGES[@]}"; do
            if [[ -n "$package_spec" ]] && ! pip_package_present "$package_spec"; then
                CTRANSLATE_DEPS_READY=0
            fi
        done
    fi
fi
if has_cuda && [[ "$CUDA_POLICY_MAJOR" == "$CTRANSLATE_CUDA_MAJOR" ]] && [[ "$CTRANSLATE_DEPS_READY" -eq 1 ]] && ctranslate_cuda_usable; then
    USE_CTRANSLATE_CUDA=1
    echo "[OK] CTranslate2 CUDA $CTRANSLATE_CUDA_MAJOR is usable."
elif has_cuda; then
    echo "[i] GPU host uses canonical ${CUDA_POLICY_TAG:-CPU policy}; CTranslate2 requires CUDA $CTRANSLATE_CUDA_MAJOR."
    echo "[i] faster-whisper uses CPU int8; no second CUDA runtime is installed."
else
    echo "[i] No NVIDIA GPU detected -> CPU int8 inference."
fi

# --- 4) model pre-download (GPU large-v3 / CPU medium when --model omitted) #
_gpu_flag="--cpu"
if [[ "$USE_CTRANSLATE_CUDA" -eq 1 ]]; then _gpu_flag="--gpu"; fi
tts_official_env_line "$PYTHON" "$SCRIPT_CURRENT_DIR" faster_whisper | while read -r _line; do
    echo "  official env (faster_whisper): $_line"
done
if [[ "$FASTER_WHISPER_READY" -eq 1 && ( -z "$MODEL" || "$MODEL" == "auto" ) ]]; then
    MODEL="$(tts_model_tier "$PYTHON" "$SCRIPT_CURRENT_DIR" faster_whisper_model "$_gpu_flag")"
    echo "[..] auto model tier ($(echo "$_gpu_flag" | tr -d '-')): '$MODEL'"
fi
if [[ "$FASTER_WHISPER_READY" -eq 1 && -n "$MODEL" && "$MODEL" != "auto" ]]; then
    find_faster_whisper_local_model "$MODEL"
    if [[ -n "$LOCAL_MODEL_PATH" ]]; then
        echo "[idempotent] local faster-whisper model found: $LOCAL_MODEL_PATH (${LOCAL_MODEL_BYTES} bytes); remote lookup skipped"
        FASTER_WHISPER_MODEL_READY=1
    else
        echo "[..] Pre-downloading faster-whisper model '$MODEL' ..."
        echo "[run] $PYTHON -c \"from faster_whisper import download_model; download_model('$MODEL'); print('cached')\""
        FASTER_WHISPER_MODEL_READY=0
        if "$PYTHON" -c "from faster_whisper import download_model; download_model('$MODEL'); print('cached')"; then
            FASTER_WHISPER_MODEL_READY=1
        fi
    fi
    if [[ "$FASTER_WHISPER_MODEL_READY" -eq 1 ]]; then
        echo "[OK] model '$MODEL' ready."
        repo_root="$(pycore_repo_root_from_install_shells "$SCRIPT_CURRENT_DIR")"
        PYTHONPATH="$repo_root" "$PYTHON" -c "from pycore.pyutils.common.model_tiers import persist_stt_models; persist_stt_models(faster_whisper='$MODEL')" 2>/dev/null || true
    else
        echo "[!] model download did not complete; it will download on first use."
    fi
fi
