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

# =============================================================================
# Shared idempotent AI CLI provisioning (Linux / bash)
# =============================================================================
# Single implementation used by every generated launcher (claude/codex/kimi) and
# by the standalone claude* launchers. Windows counterpart:
#   scripts/shells/win/win_common/AiCliProvisionCommon.ps1
#
# ai_cli_provision <tool> runs two idempotent steps:
#   1. Install the CLI when the command is missing. Claude Code reuses the
#      canonical dd.sh workflow (scripts/ai_shtools/claude_code_install.sh, the
#      same function the install_shells 171 step calls), so the native installer,
#      the /usr/local/bin all-user install and the claudeteam link stay in one
#      place. Other CLIs use their official native installer, then pnpm/npm.
#   2. Prompt for an upgrade only when the published version is newer, defaulting
#      to N and auto-skipping after AI_CLI_UPGRADE_TIMEOUT_SECONDS.
# Both steps are no-ops when the CLI is present and current.
# =============================================================================

AI_CLI_UPGRADE_TIMEOUT_SECONDS="5"
AI_CLI_KIMI_INSTALLER_URL="https://code.kimi.com/kimi-code/install.sh"
AI_CLI_PROVISION_COMMON_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AI_CLI_CORE_NODE_DIR="$(cd "$AI_CLI_PROVISION_COMMON_DIR/../../../.." && pwd)"
AI_CLI_CLAUDE_INSTALL_LIB="$AI_CLI_CORE_NODE_DIR/scripts/ai_shtools/claude_code_install.sh"

ai_cli_package() {
    case "$1" in
        claude) printf '%s' "@anthropic-ai/claude-code" ;;
        codex) printf '%s' "@openai/codex" ;;
        kimi) printf '%s' "@moonshot-ai/kimi-code" ;;
        *) printf '%s' "" ;;
    esac
}

ai_cli_label() {
    case "$1" in
        claude) printf '%s' "Claude Code" ;;
        codex) printf '%s' "Codex CLI" ;;
        kimi) printf '%s' "Kimi Code CLI" ;;
        *) printf '%s' "$1" ;;
    esac
}

ai_cli_extract_version() {
    printf '%s' "$1" | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' 2>/dev/null | head -n 1 || true
}

ai_cli_installed_version() {
    local tool="$1"
    local raw_output=""
    raw_output="$("$tool" --version 2>/dev/null || true)"
    ai_cli_extract_version "$raw_output"
}

ai_cli_published_version() {
    local package="$1"
    local raw_output=""
    if command -v pnpm >/dev/null 2>&1; then
        raw_output="$(pnpm view "$package" version 2>/dev/null || true)"
    fi
    if [ -z "$(ai_cli_extract_version "$raw_output")" ] && command -v npm >/dev/null 2>&1; then
        raw_output="$(npm view "$package" version 2>/dev/null || true)"
    fi
    ai_cli_extract_version "$raw_output"
}

ai_cli_version_is_newer() {
    local latest="$1"
    local current="$2"
    local highest=""
    if [ -z "$latest" ] || [ -z "$current" ]; then
        return 1
    fi
    if [ "$latest" = "$current" ]; then
        return 1
    fi
    highest="$(printf '%s\n%s\n' "$latest" "$current" | sort -V | tail -n 1)"
    if [ "$highest" = "$latest" ]; then
        return 0
    fi
    return 1
}

ai_cli_native_install() {
    local tool="$1"
    case "$tool" in
        claude)
            # Canonical dd.sh workflow (official native installer + all-user
            # /usr/local/bin install + claudeteam link), idempotent by itself.
            . "$AI_CLI_CLAUDE_INSTALL_LIB"
            claude_code_install
            return 0
            ;;
        kimi)
            if command -v curl >/dev/null 2>&1; then
                if curl -fsSL "$AI_CLI_KIMI_INSTALLER_URL" | bash; then
                    return 0
                fi
            fi
            return 1
            ;;
        *)
            return 1
            ;;
    esac
}

ai_cli_native_upgrade() {
    local tool="$1"
    case "$tool" in
        claude)
            # Official native updater; DISABLE_AUTOUPDATER only blocks the silent
            # background updater, so it is cleared for this explicit upgrade.
            if env -u DISABLE_AUTOUPDATER "$tool" update; then
                return 0
            fi
            return 1
            ;;
        kimi)
            ai_cli_native_install "$tool"
            return $?
            ;;
        *)
            return 1
            ;;
    esac
}

ai_cli_package_manager_install() {
    local package="$1"
    if command -v pnpm >/dev/null 2>&1; then
        if pnpm add --global "$package@latest"; then
            return 0
        fi
    fi
    if command -v npm >/dev/null 2>&1; then
        if npm install --global "$package@latest"; then
            return 0
        fi
    fi
    return 1
}

ai_cli_install_if_missing() {
    local tool="$1"
    local package=""
    local label=""

    if command -v "$tool" >/dev/null 2>&1; then
        return 0
    fi
    package="$(ai_cli_package "$tool")"
    if [ -z "$package" ]; then
        return 0
    fi
    label="$(ai_cli_label "$tool")"

    echo "[INFO] $label is not installed; running the idempotent install..."
    if ! ai_cli_native_install "$tool"; then
        echo "[INFO] Falling back to the global package manager for $label..."
        ai_cli_package_manager_install "$package" || true
    fi
    hash -r 2>/dev/null || true
    if command -v "$tool" >/dev/null 2>&1; then
        echo "[INFO] $label install completed."
    else
        echo "[WARN] $label is still unavailable after the install attempt."
    fi
    return 0
}

ai_cli_upgrade_install() {
    local tool="$1"
    local package="$2"
    local label=""
    label="$(ai_cli_label "$tool")"
    echo "[INFO] Upgrading $label..."
    if ai_cli_native_upgrade "$tool"; then
        hash -r 2>/dev/null || true
        echo "[INFO] $label upgraded with the official native updater."
        return 0
    fi
    echo "[INFO] Falling back to the global package manager for $label..."
    if ai_cli_package_manager_install "$package"; then
        hash -r 2>/dev/null || true
        echo "[INFO] $label upgraded with the global package manager."
        return 0
    fi
    echo "[WARN] $label upgrade failed; keeping the installed version."
    return 1
}

ai_cli_upgrade_prompt() {
    local tool="$1"
    local package=""
    local label=""
    local installed_version=""
    local published_version=""
    local upgrade_choice=""

    package="$(ai_cli_package "$tool")"
    if [ -z "$package" ]; then
        return 0
    fi
    if ! command -v "$tool" >/dev/null 2>&1; then
        return 0
    fi

    label="$(ai_cli_label "$tool")"
    installed_version="$(ai_cli_installed_version "$tool")"
    published_version="$(ai_cli_published_version "$package")"

    if ! ai_cli_version_is_newer "$published_version" "$installed_version"; then
        return 0
    fi
    if [ ! -t 0 ]; then
        echo "[INFO] $label $published_version is available (installed: $installed_version); non-interactive shell, upgrade skipped."
        return 0
    fi

    printf '\033[33mUpgrade %s %s -> %s? [N/y] (auto-skip in %ss): \033[0m' \
        "$label" "$installed_version" "$published_version" "$AI_CLI_UPGRADE_TIMEOUT_SECONDS"
    read -r -t "$AI_CLI_UPGRADE_TIMEOUT_SECONDS" upgrade_choice || upgrade_choice=""
    if [ -z "$upgrade_choice" ]; then
        printf 'N (auto)\n'
    fi

    case "$upgrade_choice" in
        y|Y)
            ai_cli_upgrade_install "$tool" "$package" || true
            ;;
        *)
            echo "[INFO] $label upgrade skipped (default N)."
            ;;
    esac
    return 0
}

ai_cli_provision() {
    local tool="$1"
    ai_cli_install_if_missing "$tool"
    ai_cli_upgrade_prompt "$tool"
    return 0
}
