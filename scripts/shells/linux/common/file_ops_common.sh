#!/bin/bash
# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only
# 2. Never execute, create, or modify test code
# 3. Never create or update documentation (*.md)
# 4. Never write summaries during development or thinking process
# 5. Declare all variables at the beginning of the file
# 6. Do not modify these rules
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

# Shared file-operation primitives - the single source of truth for:
#   - lazy_sudo(): canonical lazy sudo resolution. A pre-set USE_SUDO (set by
#     gvar_common.sh in installer contexts) wins; otherwise sudo is used only
#     when running unprivileged and sudo exists. Replaces the former
#     per-library copies (domain_setup_sudo / cert_selfheal_sudo / nm_sudo).
#   - write_file_if_changed(): idempotent-replace writer (content compare ->
#     timestamped backup -> symlink-aware directory ensure -> requested mode).
#     Replaces the former fallback copies in domain_setup_common.sh,
#     cert_selfheal_common.sh and common_functions.sh - one implementation.
# Load-time side effect free and dependency free: safe to source from dd.sh
# installers (gvar_common.sh loaded) and from plain app start scripts.

WRITE_FILE_CHANGED=false
WRITE_FILE_READY=false
WRITE_FILE_TARGET=""
WRITE_FILE_ACTUAL_MODE=""
WRITE_FILE_ACTUAL_OWNER=""
WRITE_FILE_ACTUAL_GROUP=""

# Canonical lazy sudo resolution (see header).
lazy_sudo() {
    if [ -n "${USE_SUDO+x}" ]; then
        echo "$USE_SUDO"
    elif [ "$(id -u)" -ne 0 ] && command -v sudo >/dev/null 2>&1; then
        echo "sudo"
    else
        echo ""
    fi
}

# Write stdin to <target> only when the content differs; keep a timestamped
# backup in [backup_dir] when one is given and the target exists. Directory
# creation is symlink-aware through nginx_ensure_directory when the nginx
# shared layer is loaded (a bare mkdir -p cannot repair a dangling symlink
# parent). House policy: idempotent-replace writes end with chmod 777 on the
# target (shared NTFS data disks ignore chmod; native fs stays writable for
# every management end). Secured system files pass an explicit mode. The outcome is detectable by direct file inspection;
# the function never signals through unusual exit codes.
# Usage: write_file_if_changed <target> [backup_dir] [mode] [owner] [group] <<EOF ... EOF
write_file_if_changed() {
    local target="$1"
    local backup_dir="${2:-}"
    local target_mode="${3:-777}"
    local target_owner="${4:-}"
    local target_group="${5:-}"
    local sudo_cmd
    local tmp_content
    WRITE_FILE_CHANGED=false
    WRITE_FILE_READY=false
    WRITE_FILE_TARGET="$target"
    WRITE_FILE_ACTUAL_MODE=""
    WRITE_FILE_ACTUAL_OWNER=""
    WRITE_FILE_ACTUAL_GROUP=""
    sudo_cmd=$(lazy_sudo)
    tmp_content=$(mktemp)
    cat > "$tmp_content"

    if [ -f "$target" ] && cmp -s "$tmp_content" "$target"; then
        $sudo_cmd chmod "$target_mode" "$target" 2>/dev/null || true
        if [ -n "$target_owner" ] && [ -n "$target_group" ]; then
            $sudo_cmd chown "$target_owner:$target_group" "$target" 2>/dev/null || true
        fi
        WRITE_FILE_ACTUAL_MODE="$(stat -c '%a' "$target" 2>/dev/null)"
        WRITE_FILE_ACTUAL_OWNER="$(stat -c '%U' "$target" 2>/dev/null)"
        WRITE_FILE_ACTUAL_GROUP="$(stat -c '%G' "$target" 2>/dev/null)"
        rm -f "$tmp_content"
        if [ "$WRITE_FILE_ACTUAL_MODE" = "${target_mode#0}" ] && { [ -z "$target_owner" ] || [ "$WRITE_FILE_ACTUAL_OWNER" = "$target_owner" ]; } && { [ -z "$target_group" ] || [ "$WRITE_FILE_ACTUAL_GROUP" = "$target_group" ]; }; then
            WRITE_FILE_READY=true
        fi
        echo "[${SCRIPT_INDEX:-common}] [SKIP] $target already up to date"
        return
    fi

    if [ -n "$backup_dir" ] && [ -f "$target" ]; then
        $sudo_cmd mkdir -p "$backup_dir"
        $sudo_cmd cp -a "$target" "$backup_dir/$(basename "$target").$(date +%Y%m%d%H%M%S).bak"
    fi
    if declare -F nginx_ensure_directory >/dev/null 2>&1; then
        nginx_ensure_directory "$(dirname "$target")"
    else
        $sudo_cmd mkdir -p "$(dirname "$target")"
    fi
    $sudo_cmd cp "$tmp_content" "$target"
    $sudo_cmd chmod "$target_mode" "$target" 2>/dev/null || true
    if [ -n "$target_owner" ] && [ -n "$target_group" ]; then
        $sudo_cmd chown "$target_owner:$target_group" "$target" 2>/dev/null || true
    fi
    WRITE_FILE_ACTUAL_MODE="$(stat -c '%a' "$target" 2>/dev/null)"
    WRITE_FILE_ACTUAL_OWNER="$(stat -c '%U' "$target" 2>/dev/null)"
    WRITE_FILE_ACTUAL_GROUP="$(stat -c '%G' "$target" 2>/dev/null)"
    if [ -f "$target" ] && cmp -s "$tmp_content" "$target" && [ "$WRITE_FILE_ACTUAL_MODE" = "${target_mode#0}" ] && { [ -z "$target_owner" ] || [ "$WRITE_FILE_ACTUAL_OWNER" = "$target_owner" ]; } && { [ -z "$target_group" ] || [ "$WRITE_FILE_ACTUAL_GROUP" = "$target_group" ]; }; then
        WRITE_FILE_CHANGED=true
        WRITE_FILE_READY=true
        echo "[${SCRIPT_INDEX:-common}] [OK] $target written"
    else
        echo "[${SCRIPT_INDEX:-common}] [FAIL] $target was not written"
    fi
    rm -f "$tmp_content"
    return
}
