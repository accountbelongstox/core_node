#!/bin/bash
# docker_prereq_common.sh - START_DOCKER linkage and docker-chain dispatch for
# model installers that selected the docker backend.
#
# Contract (plan steps 16/18):
#   * A model install choosing docker force-enables the existing
#     START_DOCKER=true switch (the [^] Start Docker After Installation menu
#     toggle) and dispatches the numbered docker ensure chain. It never warns
#     "docker is off" and then silently falls back to native, and never tells
#     the user to re-run the top-level menu instead of converging here.
#   * Model steps call ONLY docker_prereq_ensure_for_engine; they never invoke
#     numbered step scripts directly - this dispatcher owns that coupling.
#   * Every write is content-compared first (idempotent per minimal operation):
#     no file is rewritten when its value already matches.
#
# Requires gvar_common.sh (set_var/get_var) sourced by the caller.

_docker_prereq_set_var_if_changed() {
    local key="$1" value="$2" current
    current="$(get_var "$key" "")"
    [[ "$current" == "$value" ]] && return 0
    set_var "$key" "$value"
}

# Force-enable START_DOCKER for <engine> and register the engine in the docker
# backend set (deduped). Prints exactly what changed (or that nothing did).
docker_prereq_force_enable() {
    local engine="${1:-}" current engines
    [[ -z "$engine" ]] && { echo "[docker-prereq] engine name is required" >&2; return 1; }

    current="$(get_var "START_DOCKER" "false")"
    if [[ "$current" == "true" ]]; then
        echo "[docker-prereq] START_DOCKER already true; no write needed."
    else
        echo "[docker-prereq] model '$engine' selected the docker backend -> forcing START_DOCKER=true (was: ${current:-unset})."
        set_var "START_DOCKER" "true"
    fi

    engines="$(get_var "TTS_DOCKER_BACKEND_ENGINES" "")"
    case " $engines " in
        *" $engine "*)
            echo "[docker-prereq] engine '$engine' already registered in TTS_DOCKER_BACKEND_ENGINES."
            ;;
        *)
            _docker_prereq_set_var_if_changed "TTS_DOCKER_BACKEND_ENGINES" "${engines:+$engines }$engine"
            echo "[docker-prereq] registered '$engine' in TTS_DOCKER_BACKEND_ENGINES."
            ;;
    esac
    _docker_prereq_set_var_if_changed "TTS_DOCKER_TRIGGER" "model_install"
    return 0
}

# Dispatch the numbered docker ensure chain (79_install_docker.sh) from the
# caller's install_shells directory, then probe the compose plugin separately.
docker_prereq_dispatch_ensure() {
    local install_shells_dir="${1:-}"
    local step_script=""
    [[ -z "$install_shells_dir" ]] && { echo "[docker-prereq] install_shells dir is required" >&2; return 1; }
    step_script="$install_shells_dir/79_install_docker.sh"
    if [[ ! -f "$step_script" ]]; then
        echo "[docker-prereq][!] numbered step missing: $step_script" >&2
        return 1
    fi
    echo "[docker-prereq] dispatching docker ensure chain: $step_script"
    if ! bash "$step_script"; then
        echo "[docker-prereq][!] docker ensure chain reported a failure (phase above); docker backend is not ready." >&2
        _docker_prereq_set_var_if_changed "DOCKER_COMPOSE_AVAILABLE" "false"
        return 1
    fi
    # Compose plugin is a separate ensure surface from the engine itself.
    if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
        _docker_prereq_set_var_if_changed "DOCKER_COMPOSE_AVAILABLE" "true"
        echo "[docker-prereq] docker compose plugin available: $(docker compose version --short 2>/dev/null || echo 'version unknown')"
    else
        _docker_prereq_set_var_if_changed "DOCKER_COMPOSE_AVAILABLE" "false"
        echo "[docker-prereq][!] docker compose plugin is not available after the ensure chain." >&2
        return 1
    fi
    return 0
}

# Single entry used by model steps: force-enable + dispatch. <install_shells_dir>
# is the caller's own scripts/shells/linux/<flavor>/install_shells directory.
docker_prereq_ensure_for_engine() {
    local engine="${1:-}" install_shells_dir="${2:-}"
    docker_prereq_force_enable "$engine" || return 1
    docker_prereq_dispatch_ensure "$install_shells_dir" || return 1
    return 0
}
