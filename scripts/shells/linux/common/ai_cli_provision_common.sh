#!/bin/bash

# =============================================================================
# Shared idempotent AI CLI provisioning (Linux / bash)
# =============================================================================
# Single implementation used by every generated launcher (claude/codex/kimi) and
# by the standalone claude* launchers. Windows counterpart:
#   scripts/shells/win/win_common/AiCliProvisionCommon.ps1
#
# ai_cli_provision <tool> runs two idempotent steps:
#   1. Install the CLI when the command is missing, through
#      install_shells/99_install_ai_tools.sh --only <tool> (the single owner of the
#      official native install, /usr/local/bin link and ownership of every AI CLI).
#   2. Prompt for an upgrade only when the published version is newer, defaulting
#      to N and auto-skipping after AI_CLI_UPGRADE_TIMEOUT_SECONDS; the upgrade is
#      99_install_ai_tools.sh --only <tool> --upgrade. Claude Code compares against
#      the official native release channel.
# Both steps are no-ops when the CLI is present and current. The launcher stops
# with an error when the CLI is still missing, instead of exec'ing a missing command.
# For claude, a third idempotent step (ai_cli_chrome_mcp_ensure) makes sure
# ~/.claude.json carries the chrome MCP entry.
#
# ai_cli_ultracode_prompt asks whether to enable Claude Code ultracode, defaulting
# to Y and auto-accepting after AI_CLI_ULTRACODE_TIMEOUT_SECONDS; the resulting
# claude arguments are left in AI_CLI_ULTRACODE_ARGS.
# =============================================================================

AI_CLI_UPGRADE_TIMEOUT_SECONDS="5"
AI_CLI_ULTRACODE_TIMEOUT_SECONDS="2"
AI_CLI_ULTRACODE_SETTINGS_JSON='{"ultracode":true}'
AI_CLI_ULTRACODE_ARGS=()
AI_CLI_CLAUDE_LATEST_URL="https://downloads.claude.ai/claude-code-releases/latest"
AI_CLI_PROVISION_COMMON_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AI_CLI_CORE_NODE_DIR="$(cd "$AI_CLI_PROVISION_COMMON_DIR/../../../.." && pwd)"
AI_CLI_AI_TOOLS_INSTALLER="$AI_CLI_CORE_NODE_DIR/scripts/shells/linux/debian/install_shells/99_install_ai_tools.sh"

# Single catalog (install_shells/99_install_ai_tools.sh, sourced in library mode):
# read instead of keeping a second package table here.
if [ -z "${AI_TOOLS_CATALOG_KEYS[*]:-}" ]; then
    AI99_CATALOG_ONLY=1
    . "$AI_CLI_AI_TOOLS_INSTALLER"
    unset AI99_CATALOG_ONLY
fi

# Launcher-provisioned tools (lazily installed through 99_install_ai_tools.sh,
# upgrade offered from the npm package = the published-version source).
AI_CLI_LAUNCHER_TOOLS="claude codex kimi gemini dsh"

ai_cli_package() {
    case " $AI_CLI_LAUNCHER_TOOLS " in
        *" $1 "*) ;;
        *) printf '%s' ""; return 0 ;;
    esac
    if [ "$(ai_catalog_get "$1" "install_method")" = "npm" ]; then
        ai_catalog_get "$1" "package_id"
    else
        ai_catalog_get "$1" "npm_package"
    fi
}

ai_cli_label() {
    local label=""
    label="$(ai_catalog_get "$1" "name")"
    printf '%s' "${label:-$1}"
}

# Masked form of a secret for launcher summaries (at most 4 chars kept per end).
ai_cli_mask_secret() {
    local value="$1"
    local length=0
    local keep=4
    local middle=""

    if [ -z "$value" ]; then
        echo "[empty]"
        return
    fi
    length=${#value}
    if [ "$length" -le 4 ]; then
        printf '%*s\n' "$length" '' | tr ' ' '*'
        return
    fi
    if [ "$length" -le 8 ]; then
        keep=1
    fi
    middle="$(printf '%*s' "$((length - 2 * keep))" '' | tr ' ' '*')"
    printf '%s%s%s\n' "${value:0:keep}" "$middle" "${value: -keep}"
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
    local tool="$1"
    local package="$2"
    local raw_output=""
    if [ "$tool" = "claude" ] && command -v curl >/dev/null 2>&1; then
        raw_output="$(curl -fsSL --max-time 10 "$AI_CLI_CLAUDE_LATEST_URL" 2>/dev/null || true)"
        ai_cli_extract_version "$raw_output"
        return 0
    fi
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

ai_cli_run_installer() {
    bash "$AI_CLI_AI_TOOLS_INSTALLER" --only "$@"
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
    ai_cli_run_installer "$tool" || true
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
    local label=""
    label="$(ai_cli_label "$tool")"
    echo "[INFO] Upgrading $label..."
    if ai_cli_run_installer "$tool" --upgrade; then
        hash -r 2>/dev/null || true
        echo "[INFO] $label upgrade finished."
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
    published_version="$(ai_cli_published_version "$tool" "$package")"

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
            ai_cli_upgrade_install "$tool" || true
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
    if ! command -v "$tool" >/dev/null 2>&1; then
        echo "[ERROR] $(ai_cli_label "$tool") is unavailable; fix the install errors above and re-run."
        exit 1
    fi
    ai_cli_upgrade_prompt "$tool"
    if [ "$tool" = "claude" ]; then
        ai_cli_chrome_mcp_ensure
    fi
    return 0
}

# Idempotent "Claude can reach Chrome" step (Windows counterpart:
# Invoke-AiCliChromeMcpEnsure). Desktop hosts only; headless hosts skip silently.
# Fast path: ~/.claude.json already holds the chrome http entry and the mcp-chrome
# endpoint answers -> one line. Otherwise the entry is merged (mcp_sync_engine.sh)
# and a missing service prints the single install command; no build runs here.
ai_cli_chrome_mcp_ensure() {
    local engine="$AI_CLI_CORE_NODE_DIR/scripts/ai_shtools/mcp_sync_engine.sh"
    local start_script="$AI_CLI_CORE_NODE_DIR/apps/mcp-chrome/scripts/start.sh"
    local service_name=""
    local entry_state=""
    local endpoint_ready=0

    if [ -z "${DISPLAY:-}${WAYLAND_DISPLAY:-}" ] && [ "$(systemctl get-default 2>/dev/null || true)" != "graphical.target" ]; then
        return 0
    fi
    if [ ! -f "$start_script" ] || [ ! -f "$engine" ]; then
        return 0
    fi
    . "$engine"
    service_name="$(sc_require mcp_chrome.service_name)"
    entry_state="$(mcp_ensure_claude_chrome)"
    case "$entry_state" in
        written) echo "[INFO] Chrome MCP entry written to $(mcp_config_path_for claude)" ;;
        failed) echo "[WARN] Chrome MCP: writing $(mcp_config_path_for claude) failed." ;;
        *) ;;
    esac
    if timeout 1 bash -c ': < "/dev/tcp/$1/$2"' _ "$(sc_require hosts.loopback)" "$(sc_require ports.mcp_chrome)" 2>/dev/null; then
        endpoint_ready=1
    fi
    if [ "$entry_state" != "failed" ] && [ "$endpoint_ready" = "1" ]; then
        echo "[INFO] Chrome MCP ready: $MCP_CHROME_URL"
    elif systemctl cat "$service_name" >/dev/null 2>&1; then
        echo "[WARN] Chrome MCP endpoint $MCP_CHROME_URL is not answering; run: sudo systemctl restart $service_name"
    else
        echo "[INFO] Chrome MCP service is not installed; install it once with:"
        echo "       MCP_CHROME_AS_SERVICE=yes bash \"$start_script\""
    fi
    return 0
}

ai_cli_ultracode_prompt() {
    local ultracode_choice=""
    AI_CLI_ULTRACODE_ARGS=()
    if [ -t 0 ]; then
        printf '\033[33mEnable ultracode? [Y/n] (auto-Y in %ss): \033[0m' "$AI_CLI_ULTRACODE_TIMEOUT_SECONDS"
        read -r -t "$AI_CLI_ULTRACODE_TIMEOUT_SECONDS" ultracode_choice || ultracode_choice=""
        if [ -z "$ultracode_choice" ]; then
            printf 'Y (auto)\n'
        fi
    fi
    case "$ultracode_choice" in
        n|N)
            echo "[INFO] Ultracode: off"
            ;;
        *)
            AI_CLI_ULTRACODE_ARGS=(--settings "$AI_CLI_ULTRACODE_SETTINGS_JSON")
            echo "[INFO] Ultracode: on"
            ;;
    esac
    return 0
}
