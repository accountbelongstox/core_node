#!/bin/bash

INSTALL_ITEM_RUNNER_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INSTALL_ITEM_SHELLS_DIR="$(dirname "$INSTALL_ITEM_RUNNER_DIR")"
INSTALL_ITEM_REPO_DIR="$(cd "$INSTALL_ITEM_RUNNER_DIR/../../../.." && pwd)"
TOOL_CACHE_ENV_VARS="COREPACK_HOME,PIP_CACHE_DIR,npm_config_cache,UV_CACHE_DIR,COMPOSER_CACHE_DIR,BUN_INSTALL_CACHE_DIR"
INSTALL_SHELLS_DIR="${INSTALL_ITEM_SHELLS_DIR}/debian/install_shells"
MENU_ITEMS_DIR="${INSTALL_ITEM_SHELLS_DIR}/debian/menu_items"
RUN_ITEM_VAR="DD_RUN_ITEM"
FULL_CHAIN_ITEM_KEY="INSTALL_MODE"
ITEM_KEY=""
ITEM_TITLE=""
declare -a ITEM_STEPS=()

source "${INSTALL_ITEM_RUNNER_DIR}/install_order.sh"

# Print the numbered installation scripts (full paths) sorted by numeric prefix, one per line
get_numbered_installation_scripts() {
    local file=""
    local filename=""

    [ -d "$INSTALL_SHELLS_DIR" ] || return 0
    while IFS= read -r -d $'\0' file; do
        filename="$(basename "$file")"
        if [[ $filename =~ ^([0-9]+)_ ]]; then
            printf '%s:%s\n' "${BASH_REMATCH[1]}" "$file"
        fi
    done < <(find "$INSTALL_SHELLS_DIR" -maxdepth 1 -name "*.sh" -print0) | sort -n -t: -k1,1 | cut -d: -f2-
}

# Print installation scripts (full paths) in INSTALL_ORDER (install_order.sh), then any numbered
# script not listed there in numeric order, one per line
get_installation_scripts() {
    local name=""
    local script=""
    local -A listed=()

    [ -d "$INSTALL_SHELLS_DIR" ] || return 0
    for name in "${INSTALL_ORDER[@]}"; do
        script="${INSTALL_SHELLS_DIR}/${name}.sh"
        listed["$script"]=1
        [ -f "$script" ] && echo "$script"
    done
    while IFS= read -r script; do
        [ -n "${listed[$script]:-}" ] || echo "$script"
    done < <(get_numbered_installation_scripts)
}

# Print the item file whose ITEM_KEY equals the given MENU_CONFIG key
find_item_file() {
    local key="$1"
    local file=""

    for file in "$MENU_ITEMS_DIR"/item_*.sh; do
        [ -f "$file" ] || continue
        if grep -qx "ITEM_KEY=\"${key}\"" "$file"; then
            echo "$file"
            return 0
        fi
    done
    return 1
}

# Resolve ITEM_STEPS into script paths; the full-chain item has no explicit steps
resolve_item_scripts() {
    local step=""

    if [ "${#ITEM_STEPS[@]}" -eq 0 ]; then
        get_installation_scripts
        return 0
    fi
    for step in "${ITEM_STEPS[@]}"; do
        echo "${INSTALL_SHELLS_DIR}/${step}.sh"
    done
}

# Permission gateway after a root install step: hands every entry the step
# created in user-facing paths back to the real user (no-op for non-root).
run_install_permission_gateway() {
    [ "${EUID:-$(id -u)}" -eq 0 ] || return 0
    bash "$INSTALL_ITEM_RUNNER_DIR/pyservice_www_permissions.sh" || true
}

# Drops old package-manager caches after a step (contract paths.drive_layout.cache_prune);
# under sudo it runs as the invoking user so the tool caches keep their owner.
run_tool_cache_prune() {
    local prune_script=""

    [ -n "${CN_CACHE_ROOT:-}" ] || source "$INSTALL_ITEM_RUNNER_DIR/shared_cache_env.sh"
    prune_script="$(sc_get paths.drive_layout.cache_prune.script 2>/dev/null)" || return 0
    prune_script="$INSTALL_ITEM_REPO_DIR/$prune_script"
    if [ "${EUID:-$(id -u)}" -eq 0 ] && [ -n "${SUDO_USER:-}" ]; then
        sudo -u "$SUDO_USER" -H --preserve-env="$TOOL_CACHE_ENV_VARS" env PATH="$PATH" python3 "$prune_script" "$CN_CACHE_ROOT" || true
    else
        python3 "$prune_script" "$CN_CACHE_ROOT" || true
    fi
}

run_install_script() {
    local script="$1"
    local status=0

    echo
    echo "Executing: $(basename "$script")"
    if [ ! -x "$script" ]; then
        chmod +x "$script"
    fi
    "$script" || status=$?
    run_tool_cache_prune
    run_install_permission_gateway
    return "$status"
}

execute_installation_scripts() {
    local -a scripts=()
    local -a failed=()
    local script=""

    mapfile -t scripts < <(resolve_item_scripts)
    echo "INSTALL_SHELLS_DIR : $INSTALL_SHELLS_DIR"
    if [ "${#scripts[@]}" -eq 0 ]; then
        echo "No installation scripts found in $INSTALL_SHELLS_DIR"
        return 0
    fi

    echo "The following installation scripts will be executed in order:"
    for script in "${scripts[@]}"; do
        echo "  - $(basename "$script")"
    done
    echo

    for script in "${scripts[@]}"; do
        if ! run_install_script "$script"; then
            failed+=("$(basename "$script" .sh)")
        fi
    done

    if [ "${#failed[@]}" -gt 0 ]; then
        echo
        echo "Failed steps (${#failed[@]}): ${failed[*]}" >&2
        return 1
    fi
    return 0
}

list_item_steps() {
    local script=""

    while IFS= read -r script; do
        basename "$script" .sh
    done < <(resolve_item_scripts)
}

check_item_steps() {
    local script=""
    local missing=0

    while IFS= read -r script; do
        if [ -f "$script" ]; then
            echo "OK       $(basename "$script")"
        else
            echo "MISSING  $(basename "$script")"
            missing=1
        fi
    done < <(resolve_item_scripts)
    return "$missing"
}

run_item_step() {
    local step="${1%.sh}"
    local script=""

    while IFS= read -r script; do
        if [ "$(basename "$script" .sh)" = "$step" ]; then
            run_install_script "$script"
            return $?
        fi
    done < <(resolve_item_scripts)
    echo "Unknown step for item ${ITEM_KEY}: $step" >&2
    return 1
}

# Entry point used by every item file: install_item_main "$@"
install_item_main() {
    local rc=0

    case "${1:-}" in
        --list-steps) list_item_steps ;;
        --check) check_item_steps ;;
        --step)
            run_item_step "${2:-}"
            ;;
        "")
            export DD_AUTO_CONTINUE=true
            export DEBIAN_FRONTEND=noninteractive NEEDRESTART_MODE=a APT_LISTCHANGES_FRONTEND=none
            execute_installation_scripts
            rc=$?
            if [ "$rc" -eq 0 ]; then
                echo
                echo "Item ${ITEM_TITLE} completed"
            fi
            return "$rc"
            ;;
        *)
            echo "Usage: $(basename "$0") [--list-steps|--check|--step <name>]" >&2
            return 2
            ;;
    esac
}
