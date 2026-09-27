#!/bin/bash
SCRIPT_INDEX="139"
# MeloTTS installer. Its old transformers pin stays inside a dedicated venv.

set -uo pipefail

PYTHON="python3"
FORCE=0
DO_FULL=0
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CORE_NODE_ROOT="$(cd "$SCRIPT_DIR/../../../../.." && pwd)"
CACHE_ROOT="${CORE_NODE_CACHE_DIR:-$CORE_NODE_ROOT/.cache}"
TARGET_DIR="${MELOTTS_DIR:-$CACHE_ROOT/pycore/melotts}"
DEPS_SENTINEL="$TARGET_DIR/.deps_done"
DEVICE="cpu"
LANGUAGES="EN,ZH"
VENV_PYTHON=""
PREFIX="[install_melotts] "
DOCKER_MODEL="melotts"
DOCKER_RUNNER="$SCRIPT_DIR/docker_model_runner.sh"
DOCKER_MODEL_TEST="${DOCKER_MODEL_TEST:-0}"

while [[ $# -gt 0 ]]; do
    case "$1" in
        --python) PYTHON="$2"; shift 2 ;;
        --force) FORCE=1; shift ;;
        --full) DO_FULL=1; shift ;;
        *) shift ;;
    esac
done

[[ "${MELOTTS_INSTALL:-0}" == "1" ]] && DO_FULL=1

# Docker backend: opt-in only (--full or MELOTTS_INSTALL=1), so an unattended
# boot never spends minutes on the runner unrequested. Then runner ensure (no
# container left running), then an optional bounded test (DOCKER_MODEL_TEST=1).
# Failures print a message and return.
melotts_docker_backend() {
    if [[ "$DO_FULL" -eq 0 && "$FORCE" -eq 0 ]]; then
        echo "${PREFIX}saved backend: $(get_var "$(_install_method_key "$DOCKER_MODEL" BACKEND)" "none")"
        echo "${PREFIX}[i] opt-in only -> NOT ensuring the docker backend (no runner call). Pass --full or MELOTTS_INSTALL=1."
        return 0
    fi
    if ! bash "$DOCKER_RUNNER" ensure "$DOCKER_MODEL" "$TARGET_DIR"; then
        echo "${PREFIX}[!] docker backend is not ready; the RESULT line above names the phase." >&2
        return 1
    fi
    install_method_record_backend "$DOCKER_MODEL" docker
    if [[ "$DOCKER_MODEL_TEST" == "1" ]] && ! bash "$DOCKER_RUNNER" test "$DOCKER_MODEL" "$TARGET_DIR"; then
        echo "${PREFIX}[!] docker test did not pass (RESULT line above); the image and staging data are kept." >&2
        return 1
    fi
    echo "${PREFIX}[OK] docker backend ensured (image pycore-tts-${DOCKER_MODEL}:local; no container left running)."
    return 0
}

# --- Install method selection (native/docker), plan steps 16-17 ---
# Per-engine choice; a saved valid choice is reused verbatim with no countdown.
if [[ "${MELOTTS_SKIP:-0}" != "1" ]]; then
    . "$SCRIPT_DIR/../../common/install_method_common.sh"
    INSTALL_METHOD="$(install_method_select melotts \
        --supported "native docker" \
        --recommended native \
        --recommendation-source "MeloTTS official install.md: \"To avoid compatibility issues, for Windows users and some macOS users, we suggest to run via Docker.\" Linux installs natively - https://github.com/myshell-ai/MeloTTS/blob/main/docs/install.md" \
        --default native --method "${TTS_METHOD:-}" ${TTS_METHOD_RESELECT:+--reselect})" || {
        _method_rc=$?
        if [[ $_method_rc -eq 10 ]]; then
            echo "[melotts] install method selection cancelled; nothing changed."
            exit 0
        fi
        exit "$_method_rc"
    }
    if [[ "$INSTALL_METHOD" == "docker" ]]; then
        melotts_docker_backend
        exit $?
    fi
    install_method_record_backend melotts native
fi

. "$SCRIPT_DIR/../../common/base_libs/lib_gpu.sh"
. "$SCRIPT_DIR/../../common/tts_install_assets_common.sh"
source "$SCRIPT_DIR/../../common/common_functions.sh"

resolve_python() {
    local candidate=""

    for candidate in "$PYTHON" python3 python; do
        if command -v "$candidate" >/dev/null 2>&1; then
            command -v "$candidate"
            return 0
        fi
    done
    return 1
}

prepare_melotts_nltk() {
    local venv_python="$1"

    [[ -n "$venv_python" ]] || return 0
    "$venv_python" -c 'import nltk; nltk.download("averaged_perceptron_tagger_eng", quiet=True)' >/dev/null 2>&1 || true
}

echo "============================================================"
echo " [install_melotts] MeloTTS (isolated venv)"
echo "============================================================"

echo "============================================================"

if [ "$(get_global_var "SKIP_LARGE_MODELS" "false")" = "true" ] && ! tts_engine_cpu_supported "$PYTHON" "melotts"; then
    echo "${PREFIX}[skip] Server environment without desktop and GPU detected. Skipping MeloTTS installation."
    complete_prereq_step "$PYTHON" "$PREFIX" --absent-ok "server CPU host"
    exit 0
fi

if [[ "${MELOTTS_SKIP:-0}" == "1" ]]; then
    echo "${PREFIX}[i] MELOTTS_SKIP=1 -> skipping."
    complete_prereq_step "$PYTHON" "$PREFIX" --absent-ok "explicitly skipped"
fi

if ! PYTHON="$(resolve_python)"; then
    echo "${PREFIX}[!] Python 3 not found." >&2
    fail_prereq_step "$PYTHON" "$PREFIX"
fi

if gpu_hardware_present; then
    DEVICE="cuda:0"
    LANGUAGES="EN,ZH,JP,KR,ES,FR"
fi

echo "${PREFIX}python  : $PYTHON"
echo "${PREFIX}staging : $TARGET_DIR"
echo "${PREFIX}compute : $DEVICE"
tts_official_env_line "$PYTHON" "$SCRIPT_DIR" melotts | while read -r line; do
    echo "${PREFIX}official env (melotts): $line"
done

if [[ "$FORCE" -eq 0 ]] && tts_dependency_stamp_matches "$PYTHON" "melotts" "$DEPS_SENTINEL"; then
    tts_probe_isolated_venv_provisioned "$PYTHON" "melotts"
    if [[ "$TTS_ISOLATED_VENV_READY" -eq 1 ]]; then
        tts_idempotent_msg "$PYTHON" "$SCRIPT_DIR" "MeloTTS isolated venv verified"
        complete_prereq_step "$PYTHON" "$PREFIX"
    fi
    echo "${PREFIX}[..] stale MeloTTS venv detected; repairing."
fi

if [[ "$DO_FULL" -eq 0 && "$FORCE" -eq 0 ]]; then
    echo "${PREFIX}[i] opt-in only; pass --full or MELOTTS_INSTALL=1."
    complete_prereq_step "$PYTHON" "$PREFIX" --absent-ok "opt-in"
fi

mkdir -p "$TARGET_DIR"
tts_ensure_engine_base_runtime "$PYTHON" "melotts"
if ! tts_engine_compatible "$PYTHON" "melotts" "$PREFIX"; then
    complete_prereq_step "$PYTHON" "$PREFIX" --absent-ok "incompatible Python"
fi
echo "${PREFIX}[..] building/verifying isolated MeloTTS venv (self-contained; the venv carries its own torch stack) ..."
tts_provision_isolated_venv "$PYTHON" "melotts" "$FORCE"
if [[ "$TTS_ISOLATED_VENV_READY" -ne 1 ]]; then
    echo "${PREFIX}[!] venv build incomplete; main interpreter was left untouched." >&2
    fail_prereq_step "$PYTHON" "$PREFIX"
fi
if ! tts_write_dependency_stamp "$PYTHON" "melotts" "$DEPS_SENTINEL"; then
    echo "${PREFIX}[!] could not write the dependency policy stamp." >&2
    fail_prereq_step "$PYTHON" "$PREFIX"
fi

VENV_PYTHON="$(tts_resolve_isolated_python "$PYTHON" "melotts")"
if [[ -z "$VENV_PYTHON" ]]; then
    echo "${PREFIX}[!] isolated interpreter could not be resolved after provisioning." >&2
    fail_prereq_step "$PYTHON" "$PREFIX"
fi

prepare_melotts_nltk "$VENV_PYTHON"
echo "${PREFIX}[OK] MeloTTS ready; runtime uses $VENV_PYTHON."
complete_prereq_step "$PYTHON" "$PREFIX"
