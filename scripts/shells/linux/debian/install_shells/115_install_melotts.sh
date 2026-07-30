#!/bin/bash
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

while [[ $# -gt 0 ]]; do
    case "$1" in
        --python) PYTHON="$2"; shift 2 ;;
        --force) FORCE=1; shift ;;
        --full) DO_FULL=1; shift ;;
        *) shift ;;
    esac
done

[[ "${MELOTTS_INSTALL:-0}" == "1" ]] && DO_FULL=1

. "$SCRIPT_DIR/../../common/base_libs/lib_gpu.sh"
. "$SCRIPT_DIR/../../common/tts_install_assets_common.sh"

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

if [[ "${MELOTTS_SKIP:-0}" == "1" ]]; then
    echo "${PREFIX}[i] MELOTTS_SKIP=1 -> skipping."
    complete_prereq_step "$PYTHON" "$PREFIX" --absent-ok "explicitly skipped"
fi

if ! PYTHON="$(resolve_python)"; then
    echo "${PREFIX}[!] Python 3 not found." >&2
    fail_prereq_step "$PYTHON" "$PREFIX"
fi
if ! tts_engine_compatible "$PYTHON" "melotts" "$PREFIX"; then
    complete_prereq_step "$PYTHON" "$PREFIX" --absent-ok "incompatible Python"
fi

if gpu_present; then
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
install_pycore_torch_stack "$PYTHON" "$PREFIX"
echo "${PREFIX}[..] building/verifying isolated MeloTTS venv ..."
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
