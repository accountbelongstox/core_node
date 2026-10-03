#!/bin/bash

# AI Tools (Linux): the single file that owns every AI CLI - catalog, native install,
# legacy-install replacement, /usr/local/bin linking, shared login, status.
#
# Executed:  99_install_ai_tools.sh [--only key[,key...]] [--upgrade] [--list] [--status] [--shared-login]
#            (default = ensure every catalog tool + mcp_chrome + shared login)
# Sourced:   defines the catalog (ai_catalog_*), shared login (ai_shared_login_*) and
#            ai99_ensure_tool / ai99_native_path; nothing runs. AI99_CATALOG_ONLY=1 skips
#            the gvar_common load for callers that only read the catalog.
#
# Per tool (ai99_ensure_tool): native install present -> no download; otherwise the official
# installer runs AS THE REAL USER; outdated npm/pnpm/bun/yarn/pip/uv/pipx copies, stale
# binaries and root-home copies are removed; /usr/local/bin/<cmd> links to the real
# user's binary; the tool's install/config dirs are owned by the real user.

AI99_INDEX="99"
AI99_SELF_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AI99_LINUX_DIR="$(cd "$AI99_SELF_DIR/../.." && pwd)"
AI99_COMMON_DIR="$AI99_LINUX_DIR/common"
AI99_CORE_NODE_ROOT="$(cd "$AI99_LINUX_DIR/../../.." && pwd)"
AI99_SHTOOLS_DIR="$AI99_CORE_NODE_ROOT/scripts/ai_shtools"
AI99_CLAUDE_TEAM_LIB="$AI99_SHTOOLS_DIR/claude_code_install.sh"
AI99_MCP_SYNC_ENGINE_LIB="$AI99_SHTOOLS_DIR/mcp_sync_engine.sh"
AI99_PI_HARNESS_SETTINGS_SCRIPT="$AI99_CORE_NODE_ROOT/scripts/shells/common/pi_harness_settings.js"
AI99_BIN_DIR="/usr/local/bin"
AI99_SYSTEM_PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
AI99_UV_SHARED_TOOL_DIR="/usr/local/uv-tools"
AI99_VERSION_TIMEOUT_SECONDS="10"
AI_SHARED_LOGIN_PROFILE_FILE="/etc/profile.d/core_node_ai_shared_login.sh"
AI_SHARED_LOGIN_SUDOERS_FILE="/etc/sudoers.d/core_node_ai_shared_login"

AI99_MODE="ensure"
AI99_ONLY=()
AI99_KEYS=()
AI99_FAILED=()
AI99_INCLUDE_MCP_CHROME=1
AI99_ONLY_GIVEN=0
AI99_FORCE=0
AI99_CHANGED=0
AI99_INSTALLER_RAN=0
AI99_TARGET_USER=""
AI99_TARGET_HOME=""
AI99_TARGET_PATH=""
AI99_TARGET_GROUP=""
AI99_NODE_DIR=""
AI99_PNPM_LIST_ROOT=""
AI99_PNPM_LIST_USER=""
AI99_PNPM_LIST_LOADED=0

if [ "${AI99_CATALOG_ONLY:-0}" != "1" ] && { [ -z "${USE_SUDO+x}" ] || [ -z "${ACTUAL_DESKTOP_USER_HOME:-}" ]; }; then
    # shellcheck source=/dev/null
    source "$AI99_COMMON_DIR/gvar_common.sh"
fi

# =============================================================================
# Catalog - single source of truth (key -> fields)
# =============================================================================
# install_method: curl (official installer script, run as the real user) | npm (official
# npm -g, per-user prefix ~/.local) | uv_tool | pip (SDK, no CLI).
# native_bin: candidate paths of the native binary ("@HOME@"-relative, or @TOKEN@/absolute).
# legacy_*: other installs of the same tool that are removed once the native install exists.
# Shared-login research (official docs, 2026-09-28): CLAUDE_CONFIG_DIR, CODEX_HOME,
# KIMI_CODE_HOME, CLINE_DATA_DIR, CURSOR_CONFIG_DIR are documented; opencode is partial
# (OPENCODE_CONFIG_DIR covers agents/commands only); Gemini/Qwen/Droid and the rest have
# no official config-dir variable -> not shareable.

declare -gA AI_TOOLS_CATALOG=(
    ["claude_name"]="Anthropic Claude Code"
    ["claude_exec"]="claude"
    ["claude_package_id"]="https://claude.ai/install.sh"
    ["claude_npm_package"]="@anthropic-ai/claude-code"
    ["claude_install_method"]="curl"
    ["claude_installer_shell"]="bash"
    ["claude_installer_env"]="CLAUDE_INSTALL_ALLOW_SUDO=1"
    ["claude_fallback_url"]="https://downloads.claude.ai/claude-code-releases/bootstrap.sh"
    ["claude_native_bin"]=".local/bin/claude"
    ["claude_install_dirs"]=".local/share/claude"
    ["claude_legacy_npm"]="@anthropic-ai/claude-code"
    ["claude_legacy_dirs"]=".claude/local"
    ["claude_link_names"]="claude"
    ["claude_description"]="Anthropic Claude Code - AI-powered coding assistant"
    ["claude_verify_command"]="--version"
    ["claude_config_env"]="CLAUDE_CONFIG_DIR"
    ["claude_config_dir"]="\$HOME/.claude"
    ["claude_config_doc_url"]="https://code.claude.com/docs/en/env-vars"
    ["claude_shareable"]="yes"

    ["codex_name"]="OpenAI Codex"
    ["codex_exec"]="codex"
    ["codex_package_id"]="https://chatgpt.com/codex/install.sh"
    ["codex_npm_package"]="@openai/codex"
    ["codex_install_method"]="curl"
    ["codex_installer_shell"]="sh"
    ["codex_installer_env"]="CODEX_NON_INTERACTIVE=1"
    ["codex_native_bin"]=".local/bin/codex"
    ["codex_install_dirs"]=".codex/packages"
    ["codex_legacy_npm"]="@openai/codex"
    ["codex_link_names"]="codex"
    ["codex_description"]="OpenAI Codex - AI system that translates natural language to code"
    ["codex_verify_command"]="--version"
    ["codex_config_env"]="CODEX_HOME"
    ["codex_config_dir"]="\$HOME/.codex"
    ["codex_config_doc_url"]="https://developers.openai.com/codex/environment-variables"
    ["codex_shareable"]="yes"

    ["gemini_name"]="Google Gemini CLI"
    ["gemini_exec"]="gemini"
    ["gemini_package_id"]="@google/gemini-cli"
    ["gemini_install_method"]="npm"
    ["gemini_native_bin"]=".local/bin/gemini"
    ["gemini_install_dirs"]=".local/lib/node_modules/@google"
    ["gemini_link_names"]="gemini"
    ["gemini_description"]="Google Gemini CLI - Advanced AI assistant with multimodal capabilities"
    ["gemini_verify_command"]="--version"
    ["gemini_config_env"]=""
    ["gemini_config_dir"]="\$HOME/.gemini"
    ["gemini_config_doc_url"]="https://github.com/google-gemini/gemini-cli/issues/2815"
    ["gemini_shareable"]="no"

    ["dsh_name"]="DeepSeek Harness"
    ["dsh_exec"]="dsh"
    ["dsh_package_id"]="@deepseek-ai/dsh"
    ["dsh_install_method"]="npm"
    ["dsh_native_bin"]=".local/bin/dsh"
    ["dsh_install_dirs"]=".local/lib/node_modules/@deepseek-ai"
    ["dsh_link_names"]="dsh"
    ["dsh_description"]="DeepSeek Harness (dsh) - DeepSeek official agent harness CLI"
    ["dsh_verify_command"]="--version"
    ["dsh_config_env"]="DSH_HOME"
    ["dsh_config_dir"]="\$HOME/.dsh"
    ["dsh_config_doc_url"]="https://github.com/deepseek-ai/deepseek-harness/blob/master/apps/cli/reference/README.md"
    ["dsh_shareable"]="no"

    ["qwen_name"]="Qwen Code"
    ["qwen_exec"]="qwen"
    ["qwen_package_id"]="https://qwen-code-assets.oss-cn-hangzhou.aliyuncs.com/installation/install-qwen-standalone.sh"
    ["qwen_install_method"]="curl"
    ["qwen_installer_shell"]="bash"
    ["qwen_installer_args"]="--method standalone"
    ["qwen_server_skip"]="yes"
    ["qwen_native_bin"]=".local/bin/qwen"
    ["qwen_install_dirs"]=".local/lib/qwen-code"
    ["qwen_legacy_npm"]="@qwen-code/qwen-code"
    ["qwen_link_names"]="qwen"
    ["qwen_description"]="Qwen Code - Alibaba/QwenLM official coding agent CLI"
    ["qwen_verify_command"]="--version"
    ["qwen_config_env"]=""
    ["qwen_config_dir"]="\$HOME/.qwen"
    ["qwen_config_doc_url"]="https://qwenlm.github.io/qwen-code-docs/en/users/configuration/settings/"
    ["qwen_shareable"]="no"

    ["cursor_agent_name"]="Cursor Agent"
    ["cursor_agent_exec"]="cursor-agent"
    ["cursor_agent_package_id"]="https://cursor.com/install"
    ["cursor_agent_install_method"]="curl"
    ["cursor_agent_installer_shell"]="bash"
    ["cursor_agent_native_bin"]=".local/bin/cursor-agent .local/bin/agent"
    ["cursor_agent_install_dirs"]=".local/share/cursor-agent"
    ["cursor_agent_link_names"]="cursor-agent agent"
    ["cursor_agent_description"]="Cursor Agent - Cursor's terminal coding agent"
    ["cursor_agent_verify_command"]="--version"
    ["cursor_agent_config_env"]="CURSOR_CONFIG_DIR"
    ["cursor_agent_config_dir"]="\$HOME/.cursor"
    ["cursor_agent_config_doc_url"]="https://cursor.com/docs/cli/reference/configuration"
    ["cursor_agent_shareable"]="yes"

    ["kimi_name"]="Kimi Code CLI"
    ["kimi_exec"]="kimi"
    ["kimi_package_id"]="https://code.kimi.com/kimi-code/install.sh"
    ["kimi_npm_package"]="@moonshot-ai/kimi-code"
    ["kimi_install_method"]="curl"
    ["kimi_installer_shell"]="bash"
    ["kimi_native_bin"]=".kimi-code/bin/kimi"
    ["kimi_install_dirs"]=".kimi-code/bin"
    ["kimi_legacy_npm"]="@moonshot-ai/kimi-code"
    ["kimi_legacy_pip"]="kimi-cli"
    ["kimi_link_names"]="kimi"
    ["kimi_description"]="Kimi Code CLI - AI coding agent for the terminal by Moonshot AI"
    ["kimi_verify_command"]="--version"
    ["kimi_config_env"]="KIMI_CODE_HOME"
    ["kimi_config_dir"]="\$HOME/.kimi-code"
    ["kimi_config_doc_url"]="https://www.kimi.com/code/docs/en/kimi-code-cli/configuration/env-vars.html"
    ["kimi_shareable"]="yes"

    ["cline_name"]="Cline CLI"
    ["cline_exec"]="cline"
    ["cline_package_id"]="cline"
    ["cline_install_method"]="npm"
    ["cline_native_bin"]=".local/bin/cline"
    ["cline_install_dirs"]=".local/lib/node_modules/cline"
    ["cline_link_names"]="cline"
    ["cline_description"]="Cline CLI - AI coding agent for terminal workflows"
    ["cline_verify_command"]="--version"
    ["cline_config_env"]="CLINE_DATA_DIR"
    ["cline_config_dir"]="\$HOME/.cline/data"
    ["cline_config_doc_url"]="https://docs.cline.bot/getting-started/config"
    ["cline_shareable"]="yes"

    ["arkcli_name"]="Volcano Ark CLI"
    ["arkcli_exec"]="arkcli"
    ["arkcli_package_id"]="@volcengine/ark-cli"
    ["arkcli_install_method"]="npm"
    ["arkcli_native_bin"]=".local/bin/arkcli"
    ["arkcli_install_dirs"]=".local/lib/node_modules/@volcengine"
    ["arkcli_link_names"]="arkcli"
    ["arkcli_description"]="Volcano Engine Ark CLI - Ark MaaS toolbox for agents"
    ["arkcli_verify_command"]="--version"
    ["arkcli_config_env"]=""
    ["arkcli_config_dir"]=""
    ["arkcli_config_doc_url"]=""
    ["arkcli_shareable"]="no"

    ["superclaude_name"]="SuperClaude Framework"
    ["superclaude_exec"]="superclaude"
    ["superclaude_package_id"]="superclaude"
    ["superclaude_install_method"]="uv_tool"
    ["superclaude_native_bin"]=".local/bin/superclaude"
    ["superclaude_install_dirs"]=".local/share/uv/tools/superclaude"
    ["superclaude_legacy_npm"]="@bifrost_inc/superclaude"
    ["superclaude_legacy_pip"]="superclaude SuperClaude"
    ["superclaude_link_names"]="superclaude"
    ["superclaude_description"]="SuperClaude Framework - Extended Claude Code with specialized commands"
    ["superclaude_verify_command"]="--version"
    ["superclaude_config_env"]=""
    ["superclaude_config_dir"]=""
    ["superclaude_config_doc_url"]=""
    ["superclaude_shareable"]="no"

    ["opencode_name"]="OpenCode AI"
    ["opencode_exec"]="opencode"
    ["opencode_package_id"]="https://opencode.ai/install"
    ["opencode_install_method"]="curl"
    ["opencode_installer_shell"]="bash"
    ["opencode_native_bin"]=".opencode/bin/opencode"
    ["opencode_install_dirs"]=".opencode"
    ["opencode_legacy_npm"]="opencode-ai"
    ["opencode_link_names"]="opencode"
    ["opencode_description"]="OpenCode AI - AI-powered code generation and development assistant"
    ["opencode_verify_command"]="--version"
    ["opencode_config_env"]="OPENCODE_CONFIG_DIR"
    ["opencode_config_dir"]="\$HOME/.config/opencode"
    ["opencode_config_doc_url"]="https://opencode.ai/docs/config/"
    ["opencode_shareable"]="partial"

    ["auggie_name"]="Augment Code Auggie"
    ["auggie_exec"]="auggie"
    ["auggie_package_id"]="@augmentcode/auggie"
    ["auggie_install_method"]="npm"
    ["auggie_native_bin"]=".local/bin/auggie"
    ["auggie_install_dirs"]=".local/lib/node_modules/@augmentcode"
    ["auggie_link_names"]="auggie"
    ["auggie_description"]="Augment Code Auggie - AI-powered code enhancement assistant"
    ["auggie_verify_command"]="--version"
    ["auggie_config_env"]=""
    ["auggie_config_dir"]=""
    ["auggie_config_doc_url"]=""
    ["auggie_shareable"]="no"

    ["droid_name"]="Droid AI Assistant"
    ["droid_exec"]="droid"
    ["droid_package_id"]="https://app.factory.ai/cli"
    ["droid_install_method"]="curl"
    ["droid_installer_shell"]="sh"
    ["droid_native_bin"]=".local/bin/droid"
    ["droid_legacy_npm"]="droid"
    ["droid_link_names"]="droid"
    ["droid_description"]="Droid AI Assistant - AI-powered development assistant from Factory.ai"
    ["droid_verify_command"]="--version"
    ["droid_config_env"]=""
    ["droid_config_dir"]="\$HOME/.factory"
    ["droid_config_doc_url"]="https://docs.factory.ai/droid-cli/settings"
    ["droid_shareable"]="no"

    ["zhipuai_name"]="Zhipu AI SDK"
    ["zhipuai_exec"]=""
    ["zhipuai_package_id"]="zai-sdk"
    ["zhipuai_install_method"]="pip"
    ["zhipuai_link_names"]=""
    ["zhipuai_description"]="Zhipu/Z.ai official Python SDK zai-sdk (no CLI binary)"
    ["zhipuai_verify_command"]=""
    ["zhipuai_config_env"]=""
    ["zhipuai_config_dir"]=""
    ["zhipuai_config_doc_url"]=""
    ["zhipuai_shareable"]="no"

    ["bun_name"]="Bun"
    ["bun_exec"]="bun"
    ["bun_package_id"]="https://bun.com/install"
    ["bun_install_method"]="curl"
    ["bun_installer_shell"]="bash"
    ["bun_installer_env"]="BUN_INSTALL=@BUN_INSTALL_DIR@"
    ["bun_native_bin"]="@BUN_BIN@"
    ["bun_install_dirs"]="@BUN_INSTALL_DIR@"
    ["bun_legacy_npm"]="bun"
    ["bun_link_names"]="bun"
    ["bun_description"]="Bun JavaScript runtime (optional prerequisite for bun-mode omp)"
    ["bun_verify_command"]="--version"
    ["bun_config_env"]=""
    ["bun_config_dir"]=""
    ["bun_config_doc_url"]=""
    ["bun_shareable"]="no"

    ["pi_name"]="Pi Coding Agent"
    ["pi_exec"]="pi"
    ["pi_package_id"]="https://pi.dev/install.sh"
    ["pi_install_method"]="curl"
    ["pi_installer_shell"]="sh"
    ["pi_native_bin"]=".pi/agent/bin/pi .local/bin/pi"
    ["pi_install_dirs"]=".pi/agent/install .pi/agent/bin"
    ["pi_legacy_npm"]="@earendil-works/pi-coding-agent @mariozechner/pi-coding-agent"
    ["pi_link_names"]="pi"
    ["pi_description"]="Pi coding agent (managed installer)"
    ["pi_verify_command"]="--version"
    ["pi_config_env"]=""
    ["pi_config_dir"]=""
    ["pi_config_doc_url"]=""
    ["pi_shareable"]="no"

    ["omp_name"]="Oh My Pi (omp)"
    ["omp_exec"]="omp"
    ["omp_package_id"]="https://omp.sh/install"
    ["omp_install_method"]="curl"
    ["omp_installer_shell"]="sh"
    ["omp_installer_args"]="--binary"
    ["omp_native_bin"]=".local/bin/omp"
    ["omp_legacy_npm"]="@oh-my-pi/pi-coding-agent"
    ["omp_legacy_abs_dirs"]="@COMPILE_DIR@/omp"
    ["omp_link_names"]="omp"
    ["omp_description"]="Oh My Pi (omp) - standalone Pi coding agent fork (prebuilt binary)"
    ["omp_verify_command"]="--version"
    ["omp_config_env"]=""
    ["omp_config_dir"]=""
    ["omp_config_doc_url"]=""
    ["omp_shareable"]="no"

    ["agy_name"]="Antigravity CLI"
    ["agy_exec"]="agy"
    ["agy_package_id"]="https://antigravity.google/cli/install.sh"
    ["agy_install_method"]="curl"
    ["agy_installer_shell"]="bash"
    ["agy_native_bin"]=".local/bin/agy"
    ["agy_link_names"]="agy"
    ["agy_description"]="Antigravity CLI (agy) - Google Antigravity terminal agent"
    ["agy_verify_command"]="--version"
    ["agy_config_env"]=""
    ["agy_config_dir"]=""
    ["agy_config_doc_url"]=""
    ["agy_shareable"]="no"
)

AI_TOOLS_CATALOG_KEYS=(
    claude codex gemini dsh qwen cursor_agent kimi cline arkcli superclaude
    opencode auggie droid zhipuai bun pi omp agy
)

ai_catalog_get() {
    local key="$1" field="$2"
    printf '%s' "${AI_TOOLS_CATALOG["${key}_${field}"]:-}"
}

ai_catalog_has() {
    local key="$1"
    [ -n "${AI_TOOLS_CATALOG["${key}_name"]:-}" ]
}

ai_catalog_keys() {
    printf '%s\n' "${AI_TOOLS_CATALOG_KEYS[@]}"
}

ai_catalog_expand_config_dir() {
    local key="$1" real_home="$2" template=""
    template="$(ai_catalog_get "$key" "config_dir")"
    [ -n "$template" ] || return 0
    printf '%s' "${template/\$HOME/$real_home}"
}

# =============================================================================
# Shared login (root <-> real desktop user) for AI CLI config directories
# =============================================================================
# Catalog tools with an OFFICIAL config-dir variable (shareable yes/partial) get one config
# dir under the real user's home, exported for every shell via /etc/profile.d and kept
# across sudo via `Defaults env_keep` (validated with visudo -c); ownership is repaired
# back to the real user after root runs.

ai_shared_login_real_user() {
    if [ -n "${ACTUAL_DESKTOP_USER:-}" ]; then
        printf '%s' "$ACTUAL_DESKTOP_USER"
        return 0
    fi
    if command -v detect_system_user >/dev/null 2>&1; then
        detect_system_user
        return 0
    fi
    printf '%s' "${SUDO_USER:-$(id -un)}"
}

ai_shared_login_real_home() {
    local user=""
    if [ -n "${ACTUAL_DESKTOP_USER_HOME:-}" ]; then
        printf '%s' "$ACTUAL_DESKTOP_USER_HOME"
        return 0
    fi
    user="$(ai_shared_login_real_user)"
    getent passwd "$user" 2>/dev/null | cut -d: -f6
}

ai_shared_login_shareable_keys() {
    local key shareable
    while IFS= read -r key; do
        shareable="$(ai_catalog_get "$key" "shareable")"
        case "$shareable" in
            yes|partial) printf '%s\n' "$key" ;;
        esac
    done < <(ai_catalog_keys)
}

ai_shared_login_ensure_dir() {
    local key="$1" real_user="$2" real_home="$3" config_dir="" ancestor=""
    config_dir="$(ai_catalog_expand_config_dir "$key" "$real_home")"
    [ -n "$config_dir" ] || return 0
    $USE_SUDO mkdir -p "$config_dir"
    $USE_SUDO chown -R "$real_user:$real_user" "$config_dir" 2>/dev/null || true
    ancestor="$(dirname "$config_dir")"
    while [ "$ancestor" != "$real_home" ] && [ "$ancestor" != "/" ] && [ "${#ancestor}" -gt "${#real_home}" ]; do
        $USE_SUDO chown "$real_user:$real_user" "$ancestor" 2>/dev/null || true
        ancestor="$(dirname "$ancestor")"
    done
    printf '%s' "$config_dir"
}

ai_shared_login_repair_ownership() {
    local real_user real_home key config_dir
    real_user="$(ai_shared_login_real_user)"
    real_home="$(ai_shared_login_real_home)"
    [ -n "$real_user" ] && [ -n "$real_home" ] || return 0
    while IFS= read -r key; do
        config_dir="$(ai_catalog_expand_config_dir "$key" "$real_home")"
        [ -n "$config_dir" ] && [ -d "$config_dir" ] || continue
        $USE_SUDO chown -R "$real_user:$real_user" "$config_dir" 2>/dev/null || true
    done < <(ai_shared_login_shareable_keys)
}

ai_shared_login_setup() {
    local real_user real_home key var config_dir
    local -a env_vars=()
    local profile_tmp sudoers_tmp

    real_user="$(ai_shared_login_real_user)"
    real_home="$(ai_shared_login_real_home)"
    if [ -z "$real_user" ] || [ -z "$real_home" ] || [ ! -d "$real_home" ]; then
        echo "[WARN] Could not resolve the real desktop user/home; skipping AI shared-login setup."
        return 1
    fi

    profile_tmp="$(mktemp)"
    {
        echo "#!/bin/sh"
        echo "# Managed by scripts/shells/linux/debian/install_shells/99_install_ai_tools.sh - do not edit by hand."
        echo "# Shares AI CLI config directories between root and the real desktop user ($real_user)."
    } > "$profile_tmp"

    while IFS= read -r key; do
        var="$(ai_catalog_get "$key" "config_env")"
        [ -n "$var" ] || continue
        config_dir="$(ai_shared_login_ensure_dir "$key" "$real_user" "$real_home")"
        [ -n "$config_dir" ] || continue
        printf 'export %s=%s\n' "$var" "$(printf '%q' "$config_dir")" >> "$profile_tmp"
        env_vars+=("$var")
    done < <(ai_shared_login_shareable_keys)

    if [ ${#env_vars[@]} -eq 0 ]; then
        echo "[INFO] No shareable AI CLI config-dir variables to configure."
        rm -f "$profile_tmp"
        return 0
    fi

    $USE_SUDO install -m 0644 "$profile_tmp" "$AI_SHARED_LOGIN_PROFILE_FILE"
    rm -f "$profile_tmp"
    echo "[OK] Wrote $AI_SHARED_LOGIN_PROFILE_FILE (${env_vars[*]})"

    sudoers_tmp="$(mktemp)"
    {
        echo "# Managed by scripts/shells/linux/debian/install_shells/99_install_ai_tools.sh - do not edit by hand."
        printf 'Defaults env_keep += "%s"\n' "${env_vars[*]}"
    } > "$sudoers_tmp"

    if visudo -c -f "$sudoers_tmp" >/dev/null 2>&1; then
        $USE_SUDO install -m 0440 "$sudoers_tmp" "$AI_SHARED_LOGIN_SUDOERS_FILE"
        echo "[OK] Wrote $AI_SHARED_LOGIN_SUDOERS_FILE (validated with visudo -c)"
    else
        echo "[WARN] Generated sudoers snippet failed visudo -c; not installed."
    fi
    rm -f "$sudoers_tmp"

    ai_shared_login_repair_ownership
    return 0
}

ai_shared_login_status() {
    local real_home key var shareable config_dir exported
    real_home="$(ai_shared_login_real_home)"
    printf '%-14s %-9s %-20s %-30s %s\n' "TOOL" "SHAREABLE" "ENV VAR" "CONFIG DIR" "EXPORTED"
    while IFS= read -r key; do
        shareable="$(ai_catalog_get "$key" "shareable")"
        var="$(ai_catalog_get "$key" "config_env")"
        config_dir="$(ai_catalog_expand_config_dir "$key" "${real_home:-$HOME}")"
        exported="no"
        if [ -n "$var" ] && [ -f "$AI_SHARED_LOGIN_PROFILE_FILE" ] && grep -q "export $var=" "$AI_SHARED_LOGIN_PROFILE_FILE" 2>/dev/null; then
            exported="yes"
        fi
        [ "$shareable" = "no" ] && [ -z "$var" ] && continue
        printf '%-14s %-9s %-20s %-30s %s\n' "$key" "${shareable:-no}" "${var:-(none)}" "${config_dir:--}" "$exported"
    done < <(ai_catalog_keys)
}

# =============================================================================
# Real user, toolchain and path helpers
# =============================================================================

ai99_log() { echo "[$AI99_INDEX] $*"; }

ai99_resolve_target() {
    [ -z "$AI99_TARGET_USER" ] || return 0
    local node_bin=""
    AI99_TARGET_USER="$(ai_shared_login_real_user)"
    [ -n "$AI99_TARGET_USER" ] || AI99_TARGET_USER="$(id -un)"
    AI99_TARGET_HOME="$(getent passwd "$AI99_TARGET_USER" 2>/dev/null | cut -d: -f6)"
    [ -n "$AI99_TARGET_HOME" ] || AI99_TARGET_HOME="$(ai_shared_login_real_home)"
    if [ -z "$AI99_TARGET_HOME" ] || [ ! -d "$AI99_TARGET_HOME" ]; then
        AI99_TARGET_USER="$(id -un)"
        AI99_TARGET_HOME="$HOME"
    fi
    AI99_TARGET_GROUP="$(id -gn "$AI99_TARGET_USER" 2>/dev/null || echo "$AI99_TARGET_USER")"
    node_bin="$(resolve_tool_bin node 2>/dev/null || true)"
    if [ -n "$node_bin" ]; then
        AI99_NODE_DIR="$(dirname "$node_bin")"
    fi
    AI99_TARGET_PATH="$AI99_TARGET_HOME/.local/bin"
    [ -z "$AI99_NODE_DIR" ] || AI99_TARGET_PATH="$AI99_TARGET_PATH:$AI99_NODE_DIR"
    AI99_TARGET_PATH="$AI99_TARGET_PATH:$AI99_SYSTEM_PATH"
}

ai99_target_is_other_user() {
    [ "$(id -un)" != "$AI99_TARGET_USER" ]
}

# Run a command as the real user (runuser as root, sudo otherwise), from their home.
ai99_run_as_target() {
    ai99_resolve_target
    local -a env_args=(HOME="$AI99_TARGET_HOME" USER="$AI99_TARGET_USER" LOGNAME="$AI99_TARGET_USER" PATH="$AI99_TARGET_PATH")
    local shim='cd "$HOME" 2>/dev/null || cd /; exec "$@"'
    if ai99_target_is_other_user; then
        if [ "$(id -u)" -eq 0 ] && command -v runuser >/dev/null 2>&1; then
            runuser -u "$AI99_TARGET_USER" -- env "${env_args[@]}" bash -c "$shim" ai99 "$@"
        elif [ -n "$USE_SUDO" ]; then
            $USE_SUDO -u "$AI99_TARGET_USER" env "${env_args[@]}" bash -c "$shim" ai99 "$@"
        else
            su -s /bin/bash "$AI99_TARGET_USER" -c "$(printf '%q ' env "${env_args[@]}" bash -c "$shim" ai99 "$@")"
        fi
    else
        env "${env_args[@]}" bash -c "$shim" ai99 "$@"
    fi
}

ai99_expand_tokens() {
    local value="$1"
    value="${value//@HOME@/$AI99_TARGET_HOME}"
    value="${value//@BUN_BIN@/${BUN_BIN:-}}"
    value="${value//@BUN_INSTALL_DIR@/${BUN_INSTALL_DIR:-}}"
    value="${value//@COMPILE_DIR@/${COMPILE_DIR:-}}"
    printf '%s' "$value"
}

# Expand a catalog path list: "@TOKEN@..." and absolute stay, others are home-relative.
ai99_expand_paths() {
    local key="$1" field="$2" entry expanded
    ai99_resolve_target
    for entry in $(ai_catalog_get "$key" "$field"); do
        expanded="$(ai99_expand_tokens "$entry")"
        [ -n "$expanded" ] || continue
        case "$expanded" in
            /*) printf '%s\n' "$expanded" ;;
            *) printf '%s\n' "$AI99_TARGET_HOME/$expanded" ;;
        esac
    done
}

# A candidate counts as native only if it is an executable file that does not resolve into a
# legacy npm package (npm shims in ~/.local/bin would be removed together with that package).
ai99_native_candidate_ok() {
    local key="$1" candidate="$2" resolved pkg
    [ -n "$candidate" ] && [ -x "$candidate" ] && [ ! -d "$candidate" ] || return 1
    [ "$(ai_catalog_get "$key" "install_method")" != "npm" ] || return 0
    resolved="$(readlink -f "$candidate" 2>/dev/null || true)"
    for pkg in $(ai_catalog_get "$key" "legacy_npm"); do
        case "$resolved" in
            */node_modules/"$pkg"/*) return 1 ;;
        esac
    done
    return 0
}

ai99_native_path() {
    local key="$1" candidate
    ai99_resolve_target
    while IFS= read -r candidate; do
        ai99_native_candidate_ok "$key" "$candidate" || continue
        printf '%s' "$candidate"
        return 0
    done < <(ai99_expand_paths "$key" "native_bin")
    return 1
}

ai99_native_for_link() {
    local key="$1" link_name="$2" candidate
    while IFS= read -r candidate; do
        ai99_native_candidate_ok "$key" "$candidate" || continue
        if [ "$(basename "$candidate")" = "$link_name" ]; then
            printf '%s' "$candidate"
            return 0
        fi
    done < <(ai99_expand_paths "$key" "native_bin")
    ai99_native_path "$key"
}

ai99_native_version() {
    timeout "$AI99_VERSION_TIMEOUT_SECONDS" "$1" --version 2>/dev/null | head -n 1 | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -n 1
}

ai99_dir_has_other_exec() {
    local perms
    perms="$(stat -c '%A' "$1" 2>/dev/null || true)"
    case "${perms:9:1}" in
        x|t) return 0 ;;
        *) return 1 ;;
    esac
}

ai99_others_can_access() {
    local resolved dir
    resolved="$(readlink -f "$1" 2>/dev/null || true)"
    [ -e "$resolved" ] || return 1
    dir="$resolved"
    while [ "$dir" != "/" ]; do
        dir="$(dirname "$dir")"
        ai99_dir_has_other_exec "$dir" || return 1
    done
    ai99_dir_has_other_exec "$resolved"
}

# Make the binary and the directories leading to it (only those inside the real user's
# home, never recursive) executable/traversable for other users. Runs as the real user.
ai99_open_path_for_all() {
    local path="$1" chain dir resolved
    ai99_resolve_target
    resolved="$(readlink -f "$path" 2>/dev/null || true)"
    [ -n "$resolved" ] || return 0
    if [ -f "$resolved" ] && ! ai99_dir_has_other_exec "$resolved"; then
        ai99_run_as_target chmod 0755 "$resolved" 2>/dev/null && AI99_CHANGED=1
    fi
    [ "$AI99_TARGET_HOME" != "/root" ] || return 0
    for chain in "$path" "$resolved"; do
        dir="$(dirname "$chain")"
        while [ "$dir" != "/" ] && [ -n "$dir" ]; do
            case "$dir/" in
                "$AI99_TARGET_HOME"/*) ;;
                *) break ;;
            esac
            if [ -d "$dir" ] && ! ai99_dir_has_other_exec "$dir"; then
                ai99_run_as_target chmod o+x "$dir" 2>/dev/null && AI99_CHANGED=1
            fi
            dir="$(dirname "$dir")"
        done
    done
}

# =============================================================================
# Links (/usr/local/bin), ownership, legacy removal
# =============================================================================

ai99_is_elf() {
    [ -f "$1" ] && [ "$(head -c 4 "$1" 2>/dev/null | od -An -tx1 | tr -d ' \n')" = "7f454c46" ]
}

# link: symlink into the bin dir; copy: self-contained ELF copied because other users cannot
# reach the source; skip: unreachable and not safely copyable. A root-owned non-ELF source
# stays symlinked (root is then the only user that can reach it, and sibling files stay intact).
ai99_link_mode() {
    local src="$1" resolved
    if ai99_others_can_access "$src"; then
        printf 'link'
        return 0
    fi
    resolved="$(readlink -f "$src" 2>/dev/null || true)"
    if ai99_is_elf "$resolved"; then
        printf 'copy'
    elif [ "$AI99_TARGET_USER" = "root" ]; then
        printf 'link'
    else
        printf 'skip'
    fi
}

ai99_link_is_current() {
    local dest="$1" src="$2" resolved mode
    resolved="$(readlink -f "$src" 2>/dev/null || true)"
    mode="$(ai99_link_mode "$src")"
    if [ -L "$dest" ]; then
        [ "$mode" = "link" ] && [ "$(readlink -f "$dest" 2>/dev/null || true)" = "$resolved" ]
        return $?
    fi
    if [ -f "$dest" ] && [ "$mode" = "copy" ]; then
        cmp -s "$resolved" "$dest"
        return $?
    fi
    return 1
}

ai99_publish_link() {
    local key="$1" link_names link_name src dest resolved mode tmp primary="" failed=0
    link_names="$(ai_catalog_get "$key" "link_names")"
    [ -n "$link_names" ] || return 0
    primary="${link_names%% *}"
    for link_name in $link_names; do
        src="$(ai99_native_for_link "$key" "$link_name")"
        if [ -z "$src" ]; then
            [ "$link_name" = "$primary" ] && failed=1
            continue
        fi
        dest="$AI99_BIN_DIR/$link_name"
        if [ "$link_name" != "$primary" ] && { [ -e "$dest" ] || [ -L "$dest" ]; } && [ ! -L "$dest" ]; then
            continue
        fi
        ai99_open_path_for_all "$src"
        if ai99_link_is_current "$dest" "$src"; then
            continue
        fi
        resolved="$(readlink -f "$src" 2>/dev/null || true)"
        mode="$(ai99_link_mode "$src")"
        if [ "$mode" = "skip" ]; then
            ai99_log "[WARN] $src is not reachable by other users and is not a self-contained binary; $dest not created."
            continue
        fi
        if ! $USE_SUDO mkdir -p "$AI99_BIN_DIR"; then
            ai99_log "[ERROR] Cannot create $AI99_BIN_DIR."
            failed=1
            continue
        fi
        tmp="$dest.ai99.$$"
        $USE_SUDO rm -f "$tmp"
        if [ "$mode" = "link" ]; then
            if $USE_SUDO ln -s "$src" "$tmp" && $USE_SUDO mv -Tf "$tmp" "$dest"; then
                ai99_log "[LINK] $dest -> $src"
            else
                $USE_SUDO rm -f "$tmp"
                ai99_log "[ERROR] Could not link $dest -> $src."
                failed=1
                continue
            fi
        elif $USE_SUDO cp -f "$resolved" "$tmp" && $USE_SUDO chmod 0755 "$tmp" && $USE_SUDO mv -Tf "$tmp" "$dest"; then
            ai99_log "[COPY] $dest <- $resolved (source is not reachable by other users)"
        else
            $USE_SUDO rm -f "$tmp"
            ai99_log "[ERROR] Could not copy $resolved to $dest."
            failed=1
            continue
        fi
        AI99_CHANGED=1
    done
    return "$failed"
}

ai99_links_current() {
    local key="$1" link_names link_name src primary=""
    link_names="$(ai_catalog_get "$key" "link_names")"
    [ -n "$link_names" ] || return 0
    primary="${link_names%% *}"
    for link_name in $link_names; do
        src="$(ai99_native_for_link "$key" "$link_name")"
        if [ -z "$src" ]; then
            [ "$link_name" = "$primary" ] && return 1
            continue
        fi
        ai99_link_is_current "$AI99_BIN_DIR/$link_name" "$src" || return 1
    done
    return 0
}

ai99_repair_ownership() {
    local key="$1" dir group
    ai99_resolve_target
    [ "$AI99_TARGET_USER" != "root" ] || return 0
    group="$AI99_TARGET_GROUP"
    while IFS= read -r dir; do
        [ -n "$dir" ] && { [ -e "$dir" ] || [ -L "$dir" ]; } || continue
        if [ -n "$(find "$dir" -xdev ! -user "$AI99_TARGET_USER" -print -quit 2>/dev/null)" ]; then
            $USE_SUDO find "$dir" -xdev ! -user "$AI99_TARGET_USER" -exec chown -h "$AI99_TARGET_USER:$group" {} + 2>/dev/null || true
            ai99_log "[FIX] Ownership of $dir set to $AI99_TARGET_USER:$group"
            AI99_CHANGED=1
        fi
    done < <(
        ai99_expand_paths "$key" "install_dirs"
        ai99_expand_paths "$key" "native_bin"
        ai_catalog_expand_config_dir "$key" "$AI99_TARGET_HOME"
    )
}

# Non-recursive chown of the real user's ~/.local skeleton when an earlier root run left it root-owned.
ai99_repair_home_local_dirs() {
    local dir owner
    ai99_resolve_target
    [ "$AI99_TARGET_USER" != "root" ] || return 0
    for dir in "$AI99_TARGET_HOME/.local" "$AI99_TARGET_HOME/.local/bin" "$AI99_TARGET_HOME/.local/lib" "$AI99_TARGET_HOME/.local/share"; do
        [ -d "$dir" ] || continue
        owner="$(stat -L -c '%U' "$dir" 2>/dev/null || true)"
        [ -n "$owner" ] && [ "$owner" != "$AI99_TARGET_USER" ] || continue
        if $USE_SUDO chown "$AI99_TARGET_USER:$AI99_TARGET_GROUP" "$dir" 2>/dev/null; then
            ai99_log "[FIX] Ownership of $dir set to $AI99_TARGET_USER:$AI99_TARGET_GROUP"
            AI99_CHANGED=1
        fi
    done
}

ai99_prepare_shared_install_dirs() {
    local key="$1" dir
    ai99_resolve_target
    [ "$AI99_TARGET_USER" != "root" ] || return 0
    while IFS= read -r dir; do
        case "$dir" in
            "$AI99_TARGET_HOME"/*|"") continue ;;
        esac
        $USE_SUDO mkdir -p "$dir"
        $USE_SUDO chown "$AI99_TARGET_USER:$AI99_TARGET_GROUP" "$dir"
    done < <(ai99_expand_paths "$key" "install_dirs")
}

ai99_pnpm_lists_load() {
    local pnpm_bin="${PNPM_BIN:-}"
    [ "$AI99_PNPM_LIST_LOADED" = "0" ] || return 0
    AI99_PNPM_LIST_LOADED=1
    [ -x "$pnpm_bin" ] || pnpm_bin="$(resolve_tool_bin pnpm 2>/dev/null || true)"
    [ -x "$pnpm_bin" ] || return 0
    AI99_PNPM_LIST_ROOT="$(env "PATH=${AI99_NODE_DIR:+$AI99_NODE_DIR:}${PNPM_GLOBAL_BIN_DIR:-}:$AI99_SYSTEM_PATH" "$pnpm_bin" list -g --depth=0 2>/dev/null || true)"
    if [ -d "$AI99_TARGET_HOME/.local/share/pnpm" ]; then
        AI99_PNPM_LIST_USER="$(ai99_run_as_target "$pnpm_bin" list -g --depth=0 2>/dev/null || true)"
    fi
}

ai99_list_has_package() {
    printf '%s\n' "$1" | awk -v p="$2" '$1==p {found=1} END {exit !found}'
}

# Remove one npm-registry package from every JS manager (npm prefixes, pnpm, bun, yarn).
# keep_user=1 spares the real user's own npm prefix (~/.local), the native npm install.
ai99_purge_npm_package() {
    local pkg="$1" keep_user="$2" npm_bin pnpm_bin bun_bin yarn_bin prefix bun_root yarn_dir
    local -a prefixes=()
    ai99_resolve_target
    npm_bin="$(resolve_tool_bin npm 2>/dev/null || true)"
    if [ -x "$npm_bin" ]; then
        prefixes+=("$(env "PATH=${AI99_NODE_DIR:+$AI99_NODE_DIR:}$AI99_SYSTEM_PATH" "$npm_bin" prefix -g 2>/dev/null)")
    fi
    prefixes+=(/usr/local /usr "$AI99_TARGET_HOME/.npm-global")
    [ "$keep_user" = "1" ] || prefixes+=("$AI99_TARGET_HOME/.local")
    if [ -x "$npm_bin" ]; then
        for prefix in "${prefixes[@]}"; do
            [ -n "$prefix" ] && { [ -e "$prefix/lib/node_modules/$pkg" ] || [ -L "$prefix/lib/node_modules/$pkg" ]; } || continue
            ai99_log "[LEGACY] Removing npm global $pkg (prefix $prefix)"
            case "$prefix" in
                "$AI99_TARGET_HOME"/*) ai99_run_as_target env "npm_config_prefix=$prefix" "$npm_bin" uninstall -g "$pkg" >/dev/null 2>&1 || true ;;
                *) $USE_SUDO env "PATH=${AI99_NODE_DIR:+$AI99_NODE_DIR:}$AI99_SYSTEM_PATH" "$npm_bin" uninstall -g --prefix "$prefix" "$pkg" >/dev/null 2>&1 || true ;;
            esac
            AI99_CHANGED=1
        done
    fi

    ai99_pnpm_lists_load
    pnpm_bin="${PNPM_BIN:-}"
    [ -x "$pnpm_bin" ] || pnpm_bin="$(resolve_tool_bin pnpm 2>/dev/null || true)"
    if [ -x "$pnpm_bin" ]; then
        if ai99_list_has_package "$AI99_PNPM_LIST_ROOT" "$pkg"; then
            ai99_log "[LEGACY] Removing pnpm global $pkg"
            $USE_SUDO env "PATH=${AI99_NODE_DIR:+$AI99_NODE_DIR:}${PNPM_GLOBAL_BIN_DIR:-}:$AI99_SYSTEM_PATH" "$pnpm_bin" remove -g "$pkg" >/dev/null 2>&1 || true
            AI99_CHANGED=1
        fi
        if ai99_list_has_package "$AI99_PNPM_LIST_USER" "$pkg"; then
            ai99_log "[LEGACY] Removing pnpm global $pkg (user $AI99_TARGET_USER)"
            ai99_run_as_target "$pnpm_bin" remove -g "$pkg" >/dev/null 2>&1 || true
            AI99_CHANGED=1
        fi
    fi

    bun_bin="${BUN_BIN:-}"
    [ -x "$bun_bin" ] || bun_bin="$AI99_TARGET_HOME/.bun/bin/bun"
    for bun_root in "${BUN_INSTALL_DIR:-}" "$AI99_TARGET_HOME/.bun"; do
        [ -n "$bun_root" ] && [ -e "$bun_root/install/global/node_modules/$pkg" ] || continue
        ai99_log "[LEGACY] Removing bun global $pkg ($bun_root)"
        if [ -x "$bun_bin" ]; then
            ai99_run_as_target env "BUN_INSTALL=$bun_root" "$bun_bin" remove -g "$pkg" >/dev/null 2>&1 || true
        fi
        AI99_CHANGED=1
    done

    yarn_bin="${YARN_BIN:-}"
    [ -x "$yarn_bin" ] || yarn_bin="$(resolve_tool_bin yarn 2>/dev/null || true)"
    for yarn_dir in "$AI99_TARGET_HOME/.config/yarn/global/node_modules" "/usr/local/share/.config/yarn/global/node_modules"; do
        [ -e "$yarn_dir/$pkg" ] && [ -x "$yarn_bin" ] || continue
        ai99_log "[LEGACY] Removing yarn global $pkg"
        case "$yarn_dir" in
            "$AI99_TARGET_HOME"/*) ai99_run_as_target "$yarn_bin" global remove "$pkg" >/dev/null 2>&1 || true ;;
            *) $USE_SUDO "$yarn_bin" global remove "$pkg" >/dev/null 2>&1 || true ;;
        esac
        AI99_CHANGED=1
    done
}

# Remove one Python package installed via shared/root uv tools, pipx, or pip.
# keep_user=1 spares the real user's own uv tool / pipx venv (the native install).
ai99_purge_python_package() {
    local pkg="$1" keep_user="$2" lower uv_bin pipx_bin python_bin root_home
    lower="$(printf '%s' "$pkg" | tr 'A-Z' 'a-z')"
    ai99_resolve_target
    uv_bin="$(resolve_tool_bin uv 2>/dev/null || true)"
    pipx_bin="$(command -v pipx 2>/dev/null || true)"

    if [ -x "$uv_bin" ] && [ -d "$AI99_UV_SHARED_TOOL_DIR/$lower" ]; then
        ai99_log "[LEGACY] Removing shared uv tool $lower"
        $USE_SUDO env "UV_TOOL_DIR=$AI99_UV_SHARED_TOOL_DIR" "UV_TOOL_BIN_DIR=$AI99_BIN_DIR" "$uv_bin" tool uninstall "$lower" >/dev/null 2>&1 || true
        AI99_CHANGED=1
    fi
    root_home="/root"
    if [ "$AI99_TARGET_USER" != "root" ] && [ -x "$uv_bin" ] && [ -d "$root_home/.local/share/uv/tools/$lower" ]; then
        ai99_log "[LEGACY] Removing root uv tool $lower"
        $USE_SUDO env HOME="$root_home" "$uv_bin" tool uninstall "$lower" >/dev/null 2>&1 || true
        AI99_CHANGED=1
    fi
    if [ "$keep_user" != "1" ] && [ -x "$uv_bin" ] && [ -d "$AI99_TARGET_HOME/.local/share/uv/tools/$lower" ]; then
        ai99_log "[LEGACY] Removing user uv tool $lower"
        ai99_run_as_target "$uv_bin" tool uninstall "$lower" >/dev/null 2>&1 || true
        AI99_CHANGED=1
    fi
    if [ "$keep_user" != "1" ] && [ -x "$pipx_bin" ] && [ -d "$AI99_TARGET_HOME/.local/share/pipx/venvs/$lower" ]; then
        ai99_log "[LEGACY] Removing user pipx package $lower"
        ai99_run_as_target "$pipx_bin" uninstall "$lower" >/dev/null 2>&1 || true
        AI99_CHANGED=1
    fi
    python_bin="$(ai99_resolve_python_bin)"
    if [ -n "$python_bin" ] && "$python_bin" -m pip show "$pkg" >/dev/null 2>&1; then
        ai99_log "[LEGACY] Removing pip package $pkg"
        "$python_bin" -m pip uninstall -y --break-system-packages "$pkg" >/dev/null 2>&1 \
            || "$python_bin" -m pip uninstall -y "$pkg" >/dev/null 2>&1 || true
        AI99_CHANGED=1
    fi
}

ai99_purge_stale_bins() {
    local key="$1" link_name path link_names
    link_names="$(ai_catalog_get "$key" "link_names")"
    for link_name in ${link_names%% *}; do
        path="/usr/bin/$link_name"
        if [ -e "$path" ] || [ -L "$path" ]; then
            if dpkg -S "$path" >/dev/null 2>&1; then
                ai99_log "[WARN] $path belongs to an apt package; remove it with apt if it is outdated."
            else
                ai99_log "[LEGACY] Removing stale non-apt binary $path"
                $USE_SUDO rm -f "$path"
                AI99_CHANGED=1
            fi
        fi
        if [ "$AI99_TARGET_USER" != "root" ] && { [ -e "/root/.local/bin/$link_name" ] || [ -L "/root/.local/bin/$link_name" ]; }; then
            ai99_log "[LEGACY] Removing root-home binary /root/.local/bin/$link_name"
            $USE_SUDO rm -f "/root/.local/bin/$link_name"
            AI99_CHANGED=1
        fi
        if [ -n "${PNPM_GLOBAL_BIN_DIR:-}" ] && [ -e "$PNPM_GLOBAL_BIN_DIR/$link_name" ] && [ -f "$PNPM_GLOBAL_BIN_DIR/$link_name" ]; then
            ai99_log "[LEGACY] Removing stale pnpm shim $PNPM_GLOBAL_BIN_DIR/$link_name"
            $USE_SUDO rm -f "$PNPM_GLOBAL_BIN_DIR/$link_name"
            AI99_CHANGED=1
        fi
    done
    if [ "$AI99_TARGET_USER" != "root" ]; then
        local rel
        for rel in $(ai_catalog_get "$key" "install_dirs"); do
            case "$rel" in
                @*|/*) continue ;;
            esac
            if [ -e "/root/$rel" ]; then
                ai99_log "[LEGACY] Removing root-home install /root/$rel"
                $USE_SUDO rm -rf "/root/$rel"
                AI99_CHANGED=1
            fi
        done
    fi
}

ai99_purge_legacy() {
    local key="$1" method pkg rel abs rc
    method="$(ai_catalog_get "$key" "install_method")"
    ai99_resolve_target
    for pkg in $(ai_catalog_get "$key" "legacy_npm"); do
        ai99_purge_npm_package "$pkg" 0
    done
    if [ "$method" = "npm" ]; then
        ai99_purge_npm_package "$(ai_catalog_get "$key" "package_id")" 1
    fi
    for pkg in $(ai_catalog_get "$key" "legacy_pip"); do
        if [ "$method" = "uv_tool" ] && [ "$(printf '%s' "$pkg" | tr 'A-Z' 'a-z')" = "$(ai_catalog_get "$key" "package_id")" ]; then
            ai99_purge_python_package "$pkg" 1
        else
            ai99_purge_python_package "$pkg" 0
        fi
    done
    for rel in $(ai_catalog_get "$key" "legacy_dirs"); do
        if [ -e "$AI99_TARGET_HOME/$rel" ]; then
            ai99_log "[LEGACY] Removing $AI99_TARGET_HOME/$rel"
            ai99_run_as_target rm -rf "$AI99_TARGET_HOME/$rel"
            AI99_CHANGED=1
        fi
    done
    for rel in $(ai_catalog_get "$key" "legacy_abs_dirs"); do
        abs="$(ai99_expand_tokens "$rel")"
        if [ -n "$abs" ] && [ -e "$abs" ]; then
            ai99_log "[LEGACY] Removing outdated install $abs"
            $USE_SUDO rm -rf "$abs"
            AI99_CHANGED=1
        fi
    done
    if [ "$key" = "claude" ]; then
        for rc in .bashrc .zshrc .profile .bash_aliases; do
            if [ -f "$AI99_TARGET_HOME/$rc" ] && grep -qE '^alias claude=.*\.claude/local' "$AI99_TARGET_HOME/$rc" 2>/dev/null; then
                ai99_log "[LEGACY] Removing legacy claude alias from $AI99_TARGET_HOME/$rc"
                ai99_run_as_target sed -i '/^alias claude=.*\.claude\/local/d' "$AI99_TARGET_HOME/$rc" || true
                AI99_CHANGED=1
            fi
        done
    fi
    ai99_purge_stale_bins "$key"
}

# =============================================================================
# Prerequisites (idempotent: only what is missing)
# =============================================================================

ai99_run_prereq_if_missing() {
    local ready_check="$1" script_name="$2" label="$3"
    shift 3
    if eval "$ready_check"; then
        return 0
    fi
    local script_path="$AI99_SELF_DIR/$script_name"
    if [ ! -s "$script_path" ]; then
        ai99_log "WARNING: prerequisite $label missing and $script_path not found; continuing anyway."
        return 1
    fi
    ai99_log "Prerequisite $label not ready; running $script_name ..."
    bash "$script_path" "$@" || ai99_log "WARNING: $script_name reported errors (continuing)."
}

ai99_keys_need() {
    local wanted="$1" key
    for key in "${AI99_KEYS[@]}"; do
        case "$wanted" in
            node) case "$(ai_catalog_get "$key" install_method):$key" in npm:*|*:pi|*:omp) return 0 ;; esac ;;
            uv) [ "$(ai_catalog_get "$key" install_method)" = "uv_tool" ] && return 0 ;;
        esac
    done
    return 1
}

ai99_ensure_prerequisites() {
    local full_run=0
    [ "$AI99_ONLY_GIVEN" = "0" ] && full_run=1
    if [ "$full_run" = "1" ] || [ "$AI99_INCLUDE_MCP_CHROME" = "1" ] || ai99_keys_need node; then
        ai99_run_prereq_if_missing 'command -v node >/dev/null 2>&1 && command -v pnpm >/dev/null 2>&1' \
            "17_install_node_toolchain_26.sh" "Node/pnpm/bun toolchain"
    fi
    if [ "$full_run" = "1" ] || ai99_keys_need uv; then
        ai99_run_prereq_if_missing 'command -v uv >/dev/null 2>&1' \
            "25_install_uv.sh" "uv"
    fi
    if [ "$full_run" = "1" ] || [ "$AI99_INCLUDE_MCP_CHROME" = "1" ]; then
        ai99_run_prereq_if_missing 'command -v git >/dev/null 2>&1' \
            "27_install_git_ssh.sh" "git/ssh"
        ai99_run_prereq_if_missing '[ -n "${PNPM_GLOBAL_BIN_DIR:-}" ] && [ -d "${PNPM_GLOBAL_BIN_DIR:-/nonexistent}" ]' \
            "37_ensure_pnpm_packages.sh" "pnpm global packages"
    fi
    if [ "$AI99_INCLUDE_MCP_CHROME" = "1" ]; then
        ai99_run_prereq_if_missing 'command -v google-chrome >/dev/null 2>&1 || command -v google-chrome-stable >/dev/null 2>&1' \
            "41_install_browsers.sh" "Chrome" --only chrome
    fi
}

ai99_ensure_download_tools() {
    local missing=()
    command -v apt-get >/dev/null 2>&1 || return 0
    command -v curl >/dev/null 2>&1 || missing+=(curl)
    [ -s /etc/ssl/certs/ca-certificates.crt ] || missing+=(ca-certificates)
    command -v unzip >/dev/null 2>&1 || missing+=(unzip)
    [ ${#missing[@]} -gt 0 ] || return 0
    ai99_log "Installing missing download tools: ${missing[*]}"
    $USE_SUDO env DEBIAN_FRONTEND=noninteractive apt-get install -y "${missing[@]}" >/dev/null 2>&1 \
        || { $USE_SUDO apt-get update -qq; $USE_SUDO env DEBIAN_FRONTEND=noninteractive apt-get install -y "${missing[@]}"; } || true
}

# =============================================================================
# Official installers (run as the real user)
# =============================================================================

ai99_fetch_installer() {
    local url="$1" dest="$2"
    if command -v curl >/dev/null 2>&1; then
        curl -fsSL --retry 2 -o "$dest" "$url" || return 1
    elif command -v wget >/dev/null 2>&1; then
        wget -q -O "$dest" "$url" || return 1
    else
        return 1
    fi
    [ -s "$dest" ] && ! head -c 1 "$dest" | grep -q '<'
}

ai99_install_curl() {
    local key="$1" shell_bin args env_words url installer rc=1
    local -a env_list=() urls=()
    shell_bin="$(ai_catalog_get "$key" "installer_shell")"
    [ -n "$shell_bin" ] || shell_bin="bash"
    args="$(ai_catalog_get "$key" "installer_args")"
    env_words="$(ai99_expand_tokens "$(ai_catalog_get "$key" "installer_env")")"
    # shellcheck disable=SC2206
    env_list=($env_words)
    urls=("$(ai_catalog_get "$key" "package_id")")
    [ -z "$(ai_catalog_get "$key" "fallback_url")" ] || urls+=("$(ai_catalog_get "$key" "fallback_url")")

    ai99_ensure_download_tools
    ai99_prepare_shared_install_dirs "$key"
    AI99_INSTALLER_RAN=0
    installer="$(mktemp)"
    for url in "${urls[@]}"; do
        ai99_log "[INSTALL] Fetching official installer: $url"
        if ai99_fetch_installer "$url" "$installer"; then
            chmod 0644 "$installer"
            ai99_log "[INSTALL] Running it as $AI99_TARGET_USER ($AI99_TARGET_HOME)"
            AI99_INSTALLER_RAN=1
            # shellcheck disable=SC2086
            if ai99_run_as_target env "${env_list[@]}" "$shell_bin" "$installer" $args </dev/null; then
                rc=0
                break
            fi
        fi
        ai99_log "[WARN] Official installer failed from $url"
    done
    rm -f "$installer"
    return "$rc"
}

ai99_install_npm() {
    local key="$1" pkg npm_bin prefix
    pkg="$(ai_catalog_get "$key" "package_id")"
    ai99_resolve_target
    npm_bin="$(resolve_tool_bin npm 2>/dev/null || true)"
    if [ -z "$npm_bin" ]; then
        ai99_log "[ERROR] npm not found. Run 17_install_node_toolchain_26.sh first."
        return 1
    fi
    prefix="$AI99_TARGET_HOME/.local"
    ai99_run_as_target mkdir -p "$prefix/bin" "$prefix/lib" || return 1
    ai99_log "[INSTALL] npm install -g $pkg (prefix $prefix, user $AI99_TARGET_USER)"
    ai99_run_as_target env "npm_config_prefix=$prefix" "$npm_bin" install -g "$pkg@latest" </dev/null
}

ai99_install_uv_tool() {
    local key="$1" pkg uv_bin
    pkg="$(ai_catalog_get "$key" "package_id")"
    ai99_resolve_target
    uv_bin="$(resolve_tool_bin uv 2>/dev/null || true)"
    if [ -z "$uv_bin" ]; then
        ai99_log "[ERROR] uv not found. Run 25_install_uv.sh first."
        return 1
    fi
    ai99_log "[INSTALL] uv tool install $pkg (user $AI99_TARGET_USER)"
    ai99_run_as_target env "UV_TOOL_BIN_DIR=$AI99_TARGET_HOME/.local/bin" "$uv_bin" tool install --force "$pkg" </dev/null
}

ai99_resolve_python_bin() {
    if [ -n "${PYTHON_BIN:-}" ] && [ -x "$PYTHON_BIN" ]; then
        printf '%s' "$PYTHON_BIN"
    elif command -v python3 >/dev/null 2>&1; then
        command -v python3
    elif command -v python >/dev/null 2>&1; then
        command -v python
    fi
}

ai99_ensure_pip_tool() {
    local key="$1" pkg python_bin
    pkg="$(ai_catalog_get "$key" "package_id")"
    python_bin="$(ai99_resolve_python_bin)"
    if [ -z "$python_bin" ]; then
        ai99_log "[WARN] Python unavailable; $pkg install will retry next run."
        return 1
    fi
    if [ "$AI99_FORCE" != "1" ] && "$python_bin" -m pip show "$pkg" >/dev/null 2>&1; then
        ai99_log "[SKIP] $pkg SDK already installed."
        return 0
    fi
    ai99_log "[INSTALL] pip install -U $pkg"
    "$python_bin" -m pip install -U "$pkg" || true
    if "$python_bin" -m pip show "$pkg" >/dev/null 2>&1; then
        ai99_log "[OK] $pkg is ready."
        return 0
    fi
    ai99_log "[WARN] $pkg is still missing; retrying next run."
    return 1
}

# =============================================================================
# Per-tool ensure
# =============================================================================

ai99_post_install() {
    local key="$1" fresh="$2" kimi_home omp_cmd
    case "$key" in
        superclaude)
            if [ "$fresh" = "1" ]; then
                ai99_run_as_target "$(ai99_native_path superclaude)" install </dev/null >/dev/null 2>&1 || true
            fi
            ;;
        omp)
            kimi_home="${KIMI_CODE_HOME:-$AI99_TARGET_HOME/.kimi-code}"
            omp_cmd="$(ai99_native_path omp)"
            if [ -x "$omp_cmd" ] && [ -x "${NODE_BIN:-}" ] && [ -d "$kimi_home" ] && [ -s "$AI99_PI_HARNESS_SETTINGS_SCRIPT" ]; then
                ai99_run_as_target "$NODE_BIN" "$AI99_PI_HARNESS_SETTINGS_SCRIPT" omp "$omp_cmd" "$kimi_home/skills"
                ai99_log "[OK] OMP Kimi skill compatibility settings merged."
            fi
            ;;
    esac
}

ai99_run_install() {
    local key="$1" method
    method="$(ai_catalog_get "$key" "install_method")"
    case "$method" in
        curl) ai99_install_curl "$key" || true ;;
        npm) ai99_install_npm "$key" || true ;;
        uv_tool) ai99_install_uv_tool "$key" || true ;;
        *) ai99_log "[WARN] Unknown install method '$method' for $key" ;;
    esac
    hash -r 2>/dev/null || true
}

# Remove only the legacy npm copies of a tool (they can make an official installer refuse to run).
ai99_purge_legacy_npm_only() {
    local key="$1" pkg
    for pkg in $(ai_catalog_get "$key" "legacy_npm"); do
        ai99_purge_npm_package "$pkg" 0
    done
}

# Native install (no team setup): used by ai99_ensure_tool and by claude_code_install.
ai99_ensure_native() {
    local key="$1" name method fresh=0 native
    name="$(ai_catalog_get "$key" "name")"
    method="$(ai_catalog_get "$key" "install_method")"
    ai99_resolve_target
    AI99_CHANGED=0

    if [ "$method" = "pip" ]; then
        ai99_ensure_pip_tool "$key"
        return $?
    fi

    ai99_repair_home_local_dirs
    native="$(ai99_native_path "$key" || true)"
    if [ -z "$native" ] || [ "$AI99_FORCE" = "1" ]; then
        if [ "$(ai_catalog_get "$key" "server_skip")" = "yes" ] \
            && [ "$(get_global_var "SKIP_LARGE_MODELS" "false" 2>/dev/null)" = "true" ] && [ -z "$native" ]; then
            ai99_log "[SKIP] Server environment without desktop/GPU; skipping $name."
            return 0
        fi
        ai99_repair_ownership "$key"
        ai99_log "[INSTALL] $name (official $method install for $AI99_TARGET_USER)"
        AI99_INSTALLER_RAN=0
        ai99_run_install "$key"
        fresh=1
        AI99_CHANGED=1
        native="$(ai99_native_path "$key" || true)"
        if [ -z "$native" ] && [ "$method" = "curl" ] && [ "$AI99_INSTALLER_RAN" = "1" ] \
            && [ -n "$(ai_catalog_get "$key" "legacy_npm")" ]; then
            ai99_log "[WARN] $name installer failed; removing legacy npm copies and retrying once."
            ai99_purge_legacy_npm_only "$key"
            ai99_repair_ownership "$key"
            ai99_run_install "$key"
            native="$(ai99_native_path "$key" || true)"
        fi
    fi

    if [ -z "$native" ]; then
        ai99_log "[WARN] $name native binary not found after the install attempt (expected: $(ai99_expand_paths "$key" native_bin | tr '\n' ' '))."
        return 1
    fi

    ai99_purge_legacy "$key"
    native="$(ai99_native_path "$key" || true)"
    if [ -z "$native" ]; then
        ai99_log "[WARN] $name native binary vanished after the legacy cleanup; reinstalling."
        ai99_repair_ownership "$key"
        ai99_run_install "$key"
        fresh=1
        native="$(ai99_native_path "$key" || true)"
        if [ -z "$native" ]; then
            ai99_log "[WARN] $name native binary not found after the reinstall."
            return 1
        fi
    fi
    ai99_repair_ownership "$key"
    ai99_publish_link "$key" || { ai99_log "[WARN] $name could not be linked into $AI99_BIN_DIR."; return 1; }
    ai99_post_install "$key" "$fresh"
    if [ "$AI99_CHANGED" = "1" ]; then
        ai99_log "[OK] $name ready: $native (version $(ai99_native_version "$native"))"
    else
        ai99_log "[SKIP] $name already installed natively and linked: $native"
    fi
    return 0
}

ai99_ensure_claude_team() {
    if [ -s "$AI99_CLAUDE_TEAM_LIB" ]; then
        # shellcheck source=/dev/null
        source "$AI99_CLAUDE_TEAM_LIB"
        if command -v claude_team_install >/dev/null 2>&1; then
            claude_team_install
            return 0
        fi
    fi
    ai99_log "[WARN] claude team setup library not found at $AI99_CLAUDE_TEAM_LIB"
    return 1
}

ai99_ensure_mcp_chrome() {
    if [ ! -s "$AI99_MCP_SYNC_ENGINE_LIB" ]; then
        ai99_log "WARNING: MCP sync engine not found at $AI99_MCP_SYNC_ENGINE_LIB; skipping mcp-chrome."
        return 1
    fi
    # shellcheck source=/dev/null
    source "$AI99_MCP_SYNC_ENGINE_LIB"
    ai99_log "Building + registering Chrome MCP as the ncore-mcp-chrome service ..."
    export MCP_CHROME_AS_SERVICE="yes"
    export MCP_CHROME_BUILD_DONE=0
    mcp_install_chrome || ai99_log "WARNING: Chrome MCP install reported errors (continuing)."
    ai99_log "Syncing the chrome MCP entry to every installed AI tool (context7 stays opt-in, not part of this default flow) ..."
    mcp_sync_all || ai99_log "WARNING: MCP sync reported errors (continuing)."
}

ai99_ensure_tool() {
    local key="$1" result=0
    if [ "$key" = "mcp_chrome" ]; then
        ai99_ensure_mcp_chrome
        return $?
    fi
    if ! ai_catalog_has "$key"; then
        ai99_log "WARNING: unknown AI tool key '$key' (see --list); skipping."
        return 1
    fi
    ai99_ensure_native "$key" || result=1
    if [ "$key" = "claude" ] && [ "$result" = "0" ] && [ "${AI99_SKIP_TEAM:-0}" != "1" ]; then
        ai99_ensure_claude_team || true
    fi
    return "$result"
}

# =============================================================================
# --list / --status
# =============================================================================

ai99_print_list() {
    printf '%-14s %-14s %-8s %-52s %-18s\n' "KEY" "EXEC" "METHOD" "PACKAGE/URL" "LINK NAMES"
    local key
    for key in "${AI_TOOLS_CATALOG_KEYS[@]}"; do
        printf '%-14s %-14s %-8s %-52s %-18s\n' \
            "$key" \
            "$(ai_catalog_get "$key" exec)" \
            "$(ai_catalog_get "$key" install_method)" \
            "$(ai_catalog_get "$key" package_id)" \
            "$(ai_catalog_get "$key" link_names)"
    done
    echo ""
    echo "Plus: mcp_chrome (apps/mcp-chrome, built + registered as the ncore-mcp-chrome service)"
}

ai99_print_status() {
    ai99_resolve_target
    printf '%-14s %-11s %-9s %-16s %-8s %s\n' "KEY" "INSTALLED" "NATIVE" "VERSION" "LINKED" "LOGIN SHARED"
    local key exec_name native installed nativeflag version linked shareable python_bin
    for key in "${AI_TOOLS_CATALOG_KEYS[@]}"; do
        exec_name="$(ai_catalog_get "$key" exec)"
        installed="no"; nativeflag="-"; version="-"; linked="no"
        if [ "$(ai_catalog_get "$key" install_method)" = "pip" ]; then
            python_bin="$(ai99_resolve_python_bin)"
            if [ -n "$python_bin" ] && "$python_bin" -m pip show "$(ai_catalog_get "$key" package_id)" >/dev/null 2>&1; then installed="yes"; fi
            linked="n/a"; nativeflag="n/a"
        else
            native="$(ai99_native_path "$key" || true)"
            if [ -n "$native" ]; then
                installed="yes"; nativeflag="yes"
                version="$(ai99_native_version "$native")"
                [ -n "$version" ] || version="-"
                if ai99_links_current "$key"; then linked="yes"; fi
            elif [ -n "$exec_name" ] && command -v "$exec_name" >/dev/null 2>&1; then
                installed="yes"; nativeflag="legacy"
            fi
        fi
        shareable="$(ai_catalog_get "$key" shareable)"
        [ -n "$shareable" ] && [ "$shareable" != "no" ] || shareable="no"
        printf '%-14s %-11s %-9s %-16s %-8s %s\n' "$key" "$installed" "$nativeflag" "$version" "$linked" "$shareable"
    done
    echo ""
    echo "-- Shared login matrix -----------------------------------------------"
    ai_shared_login_status
    echo ""
    echo "-- mcp-chrome (ncore-mcp-chrome service) -------------------------------"
    if command -v systemctl >/dev/null 2>&1; then
        local mcp_svc_status=""
        mcp_svc_status="$(systemctl is-active ncore-mcp-chrome 2>/dev/null)"
        [ -n "$mcp_svc_status" ] || mcp_svc_status="not-installed"
        echo "  systemd: $mcp_svc_status"
    fi
}

# =============================================================================
# Main (only when executed, never when sourced)
# =============================================================================

ai99_main() {
    local raw_keys raw_key key
    while [ $# -gt 0 ]; do
        case "$1" in
            --only)
                shift
                AI99_ONLY_GIVEN=1
                AI99_INCLUDE_MCP_CHROME=0
                IFS=',' read -ra raw_keys <<< "${1:-}"
                for raw_key in "${raw_keys[@]}"; do
                    [ -n "$raw_key" ] || continue
                    if [ "$raw_key" = "mcp_chrome" ]; then
                        AI99_INCLUDE_MCP_CHROME=1
                    else
                        AI99_ONLY+=("$raw_key")
                    fi
                done
                ;;
            --upgrade) AI99_FORCE=1 ;;
            --list) AI99_MODE="list" ;;
            --status) AI99_MODE="status" ;;
            --shared-login) AI99_MODE="shared_login" ;;
            -h|--help)
                echo "Usage: $0 [--only key[,key...]] [--upgrade] [--list] [--status] [--shared-login]"
                return 0
                ;;
            *)
                echo "[$AI99_INDEX] WARNING: unrecognized argument '$1' ignored." >&2
                ;;
        esac
        shift
    done

    case "$AI99_MODE" in
        list) ai99_print_list; return 0 ;;
        status) ai99_print_status; return 0 ;;
        shared_login) ai_shared_login_setup; return 0 ;;
    esac

    if [ "$AI99_ONLY_GIVEN" = "0" ]; then
        AI99_KEYS=("${AI_TOOLS_CATALOG_KEYS[@]}")
    else
        AI99_KEYS=("${AI99_ONLY[@]}")
    fi

    ai99_resolve_target
    ai99_log "============================================================"
    ai99_log "AI Tools install for $AI99_TARGET_USER ($AI99_TARGET_HOME): ${AI99_KEYS[*]}$([ "$AI99_INCLUDE_MCP_CHROME" = "1" ] && echo " mcp_chrome")"
    ai99_log "============================================================"

    ai99_ensure_prerequisites

    for key in "${AI99_KEYS[@]}"; do
        ai99_ensure_tool "$key" || AI99_FAILED+=("$key")
    done

    if [ "$AI99_INCLUDE_MCP_CHROME" = "1" ]; then
        ai99_ensure_mcp_chrome || AI99_FAILED+=("mcp_chrome")
    fi

    ai99_log "Configuring shared login (root <-> $AI99_TARGET_USER) for shareable AI CLI config dirs ..."
    ai_shared_login_setup || true

    ai99_log "============================================================"
    if [ ${#AI99_FAILED[@]} -eq 0 ]; then
        ai99_log "AI Tools install completed: all requested tools ready."
    else
        ai99_log "AI Tools install completed with warnings: ${AI99_FAILED[*]}"
    fi
    ai99_log "============================================================"
    return 0
}

if [ "${BASH_SOURCE[0]}" = "$0" ]; then
    ai99_main "$@"
    exit 0
fi
