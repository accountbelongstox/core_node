#!/bin/bash
# Local AI translation runtime: Ollama (official install.sh) plus the translation
# model from config/service_contract.json local_ai.translate_model (TranslateGemma).
# Serves GPU and CPU alike (Ollama picks CUDA when present).
#
# Opt-in prerequisite of prepare_pycore_prerequisites.sh (install mode local_ai):
# runs when PYCORE_LOCAL_AI_INSTALL=1 (default on Colab/Kaggle) or --include ollama.
# Idempotent: an installed binary and an already pulled model are kept; only the
# missing piece is repaired.
#
# Invocation contracts:
#   - pyservice flow: 117_install_ollama.sh --python <py> [--force]
set -uo pipefail

SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR_LEVEL_1="$(dirname "$SCRIPT_CURRENT_DIR")"
PARENT_DIR_LEVEL_2="$(dirname "$PARENT_DIR_LEVEL_1")"

source "$PARENT_DIR_LEVEL_2/common/gvar_common.sh"
source "$PARENT_DIR_LEVEL_2/common/shared_cache_env.sh"
source "$PARENT_DIR_LEVEL_2/common/service_contract_common.sh"
source "$PARENT_DIR_LEVEL_2/common/base_libs/lib_gpu.sh"

SCRIPT_NAME="[117_install_ollama]"
OLLAMA_INSTALL_URL="https://ollama.com/install.sh"
OLLAMA_HOST_ADDRESS="127.0.0.1"
OLLAMA_READY_ATTEMPTS=30
FORCE=0
OLLAMA_BIN=""
OLLAMA_PORT=""
TRANSLATE_MODEL=""
MODELS_SUBDIR=""
SERVE_PID=""

while [[ $# -gt 0 ]]; do
    case "$1" in
        --python) shift 2 ;;
        --force)  FORCE=1; shift ;;
        *) echo "$SCRIPT_NAME [!] Unknown argument: $1" >&2; shift ;;
    esac
done

print_info()    { echo -e "\033[0;36m$SCRIPT_NAME $1\033[0m"; }
print_success() { echo -e "\033[0;32m$SCRIPT_NAME $1\033[0m"; }
print_warning() { echo -e "\033[0;33m$SCRIPT_NAME $1\033[0m"; }

ollama_binary() {
    command -v ollama 2>/dev/null || { [ -x /usr/local/bin/ollama ] && echo /usr/local/bin/ollama; } || true
}

ollama_api_ready() {
    curl -fsS --max-time 3 "http://$OLLAMA_HOST_ADDRESS:$OLLAMA_PORT/api/version" >/dev/null 2>&1
}

# install.sh unpacks a .tar.zst release and needs curl + zstd.
ensure_archive_tools() {
    local missing=()
    command -v curl >/dev/null 2>&1 || missing+=(curl)
    command -v zstd >/dev/null 2>&1 || missing+=(zstd)
    [ "${#missing[@]}" -eq 0 ] && return 0
    print_info "installing ${missing[*]} ..."
    $USE_SUDO apt-get update -qq
    $USE_SUDO env DEBIAN_FRONTEND=noninteractive apt-get install -y -qq "${missing[@]}"
}

install_ollama_binary() {
    OLLAMA_BIN="$(ollama_binary)"
    if [ -n "$OLLAMA_BIN" ] && [ "$FORCE" -eq 0 ]; then
        print_success "ollama present: $OLLAMA_BIN ($("$OLLAMA_BIN" --version 2>/dev/null | tail -1))"
        return 0
    fi
    ensure_archive_tools
    print_info "installing ollama via $OLLAMA_INSTALL_URL ..."
    curl -fsSL "$OLLAMA_INSTALL_URL" | $USE_SUDO sh
    OLLAMA_BIN="$(ollama_binary)"
    if [ -z "$OLLAMA_BIN" ]; then
        print_warning "ollama install did not produce a binary; retried on the next run."
        return 1
    fi
    print_success "ollama installed: $OLLAMA_BIN"
}

# Pulls go to the server on the contract port: an already running server (system
# service) keeps its own store; otherwise a temporary server stores models in the
# shared cache, the same directory pycore's managed `ollama serve` uses.
# OLLAMA_NUM_PARALLEL from the contract (local_ai.ollama_num_parallel: gpu / cpu value);
# an already exported value is never overridden.
export_ollama_num_parallel() {
    local env_name="" mode=cpu
    env_name="$(sc_get local_ai.ollama_num_parallel_env)"
    [ -n "$env_name" ] || return 0
    [ -n "${!env_name:-}" ] && return 0
    gpu_hardware_present && mode=gpu
    printf -v "$env_name" '%s' "$(sc_get "local_ai.ollama_num_parallel.$mode")"
    export "${env_name?}"
}

start_temporary_server() {
    ollama_api_ready && return 0
    mkdir -p "$OLLAMA_MODELS"
    export_ollama_num_parallel
    print_info "starting a temporary ollama server (models: $OLLAMA_MODELS) ..."
    OLLAMA_HOST="$OLLAMA_HOST_ADDRESS:$OLLAMA_PORT" OLLAMA_MODELS="$OLLAMA_MODELS" "$OLLAMA_BIN" serve >/dev/null 2>&1 &
    SERVE_PID=$!
    local attempt=0
    while [ "$attempt" -lt "$OLLAMA_READY_ATTEMPTS" ]; do
        ollama_api_ready && return 0
        sleep 1
        attempt=$((attempt + 1))
    done
    print_warning "ollama server did not answer on port $OLLAMA_PORT."
    return 1
}

stop_temporary_server() {
    [ -n "$SERVE_PID" ] || return 0
    kill "$SERVE_PID" 2>/dev/null || true
    wait "$SERVE_PID" 2>/dev/null || true
}

pull_translate_model() {
    if OLLAMA_HOST="$OLLAMA_HOST_ADDRESS:$OLLAMA_PORT" "$OLLAMA_BIN" list 2>/dev/null | awk 'NR>1 {print $1}' | grep -qx "$TRANSLATE_MODEL"; then
        print_success "model present: $TRANSLATE_MODEL"
        return 0
    fi
    print_info "pulling $TRANSLATE_MODEL (resumable) ..."
    OLLAMA_HOST="$OLLAMA_HOST_ADDRESS:$OLLAMA_PORT" "$OLLAMA_BIN" pull "$TRANSLATE_MODEL"
}

main() {
    local rc=0
    OLLAMA_PORT="$(sc_get local_ai.ollama_port)"
    TRANSLATE_MODEL="$(sc_get local_ai.translate_model)"
    MODELS_SUBDIR="$(sc_get local_ai.ollama_models_subdir)"
    if [ -z "$OLLAMA_PORT" ] || [ -z "$TRANSLATE_MODEL" ] || [ -z "$MODELS_SUBDIR" ]; then
        print_warning "service contract local_ai is unreadable ($SERVICE_CONTRACT_FILE)."
        return 1
    fi
    : "${OLLAMA_MODELS:=${CORE_NODE_CACHE_DIR:?CORE_NODE_CACHE_DIR is not set; the shared cache is not writable}/$MODELS_SUBDIR}"
    export OLLAMA_MODELS

    print_info "model: $TRANSLATE_MODEL | port: $OLLAMA_PORT | store: $OLLAMA_MODELS"
    install_ollama_binary || return 1
    start_temporary_server || { stop_temporary_server; return 1; }
    pull_translate_model || rc=1
    stop_temporary_server
    if [ "$rc" -eq 0 ]; then
        print_success "local AI translation runtime ready."
    else
        print_warning "model pull not finished; resumed on the next run."
    fi
    return "$rc"
}

main
exit $?
