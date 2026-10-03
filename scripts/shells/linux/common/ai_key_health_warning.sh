#!/usr/bin/env bash
# ai_key_health_warning.sh - shared startup helper (pyservice_entry.sh, dd.sh), sourced: warns about AI
# provider keys the last pycore probe rejected (401/403). Never blocks or fails the caller.
# Windows counterpart: scripts/shells/win/win_common/AiKeyHealthWarning.ps1

AI_KEY_HEALTH_MODULE="pycore.pyctl.ai.key_health"
AI_KEY_HEALTH_COMMAND="key-status"
AI_KEY_HEALTH_TIMEOUT_SECONDS=8
AI_KEY_HEALTH_RAW_KEY_DIR=".secret_keys/.secret_ignore"
AI_KEY_HEALTH_REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"

# ai_key_health_warning [repo_root] [python]
ai_key_health_warning() {
    local repo_root="${1:-$AI_KEY_HEALTH_REPO_ROOT}"
    local python_bin="${2:-}"
    local output=""
    local provider=""
    local secret_name=""
    local status=""
    local checked_at=""
    local candidate=""
    local timeout_prefix=()

    if [ -z "$python_bin" ]; then
        for candidate in "${VENV_PYTHON3:-}" python3 python; do
            if [ -n "$candidate" ] && command -v "$candidate" >/dev/null 2>&1; then
                python_bin="$candidate"
                break
            fi
        done
    fi
    if [ -z "$python_bin" ] || [ ! -d "$repo_root/pycore" ]; then
        return 0
    fi
    if command -v timeout >/dev/null 2>&1; then
        timeout_prefix=(timeout "$AI_KEY_HEALTH_TIMEOUT_SECONDS")
    fi

    output="$(cd "$repo_root" 2>/dev/null && PYCORE_SKIP_DEP_CHECK=1 ${timeout_prefix[@]+"${timeout_prefix[@]}"} "$python_bin" -m "$AI_KEY_HEALTH_MODULE" "$AI_KEY_HEALTH_COMMAND" 2>/dev/null)" || return 0
    if [ -z "$output" ]; then
        return 0
    fi

    echo ""
    echo -e "\033[33m[AI KEYS] WARNING: the last probe rejected these AI provider keys (expired or invalid):\033[0m"
    while IFS=$'\t' read -r provider secret_name status checked_at; do
        if [ -n "$provider" ]; then
            echo -e "\033[33m  - $provider: secret $secret_name -> $status (checked $checked_at)\033[0m"
        fi
    done <<< "$output"
    echo -e "\033[33m[AI KEYS] To fix: put the new key in $repo_root/$AI_KEY_HEALTH_RAW_KEY_DIR/<SECRET_NAME> (pycore UI Settings > AI keys), then restart pycore.\033[0m"
    echo -e "\033[33m[AI KEYS] The warning stops as soon as that key value changes.\033[0m"
    echo ""
    return 0
}

if [ "${BASH_SOURCE[0]}" = "$0" ]; then
    ai_key_health_warning "$@"
fi
