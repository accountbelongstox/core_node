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
#     timestamped backup -> symlink-aware directory ensure -> mode 777).
#     Replaces the former fallback copies in domain_setup_common.sh,
#     cert_selfheal_common.sh and common_functions.sh - one implementation.
# Load-time side effect free and dependency free: safe to source from dd.sh
# installers (gvar_common.sh loaded) and from plain app start scripts.

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
# every management end). The outcome is detectable by direct file inspection;
# the function never signals through unusual exit codes.
# Usage: write_file_if_changed <target> [backup_dir] <<EOF ... EOF
write_file_if_changed() {
    local target="$1"
    local backup_dir="${2:-}"
    local sudo_cmd
    local tmp_content
    sudo_cmd=$(lazy_sudo)
    tmp_content=$(mktemp)
    cat > "$tmp_content"

    if [ -f "$target" ] && cmp -s "$tmp_content" "$target"; then
        rm -f "$tmp_content"
        echo "[${SCRIPT_INDEX:-common}] [SKIP] $target already up to date"
        return 0
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
    rm -f "$tmp_content"
    $sudo_cmd chmod 777 "$target" 2>/dev/null || true
    echo "[${SCRIPT_INDEX:-common}] [OK] $target written"
    return 0
}
