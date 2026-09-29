#!/bin/bash

# =============================================================================
# AI Tools Catalog (Linux) - single source of truth
# =============================================================================
# One entry per AI CLI / helper binary: display name, executable, package id
# (npm package, URL, or pip package), install method, /usr/local/bin link
# name(s), and shared-login metadata (the tool's OFFICIAL config-dir
# environment variable, when one is documented).
#
# Consumers (must read this file instead of keeping their own package table):
#   - install_shells/99_install_ai_tools.sh   (the installer that owns every
#     AI CLI install/link/status)
#   - common/linux_applications_list.sh       (builds AI_PACKAGES/AI_PACKAGE_LIST
#     from this catalog for the desktop-apps reporting/get_app_property API)
#   - common/ai_cli_provision_common.sh       (launcher-time lazy install/upgrade
#     for claude/codex/kimi)
#   - common/ai_shared_login.sh               (root <-> real-user config sharing)
#
# Install methods (dispatched by 99_install_ai_tools.sh):
#   pnpm    -> install_via_pnpm (installation_methods.sh), global package
#   npm     -> install_via_npm  (installation_methods.sh), global package
#   uv_tool -> install_via_uv_tool (installation_methods.sh), shared uv tool dirs
#   curl    -> official curl|bash / curl-downloaded installer (per-tool function)
#   pip     -> pip install of an SDK (no CLI binary)
#   native  -> delegates entirely to a dedicated shared script (claude)
#
# Shared-login research (official docs, cited per tool below; 2026-09-28):
#   Claude Code : CLAUDE_CONFIG_DIR   - https://code.claude.com/docs/en/env-vars
#                                       https://code.claude.com/docs/en/claude-directory
#   Codex       : CODEX_HOME          - https://developers.openai.com/codex/environment-variables
#   Kimi Code   : KIMI_CODE_HOME      - https://www.kimi.com/code/docs/en/kimi-code-cli/configuration/env-vars.html
#   Cline       : CLINE_DATA_DIR      - https://docs.cline.bot/getting-started/config
#   Cursor CLI  : CURSOR_CONFIG_DIR   - https://cursor.com/docs/cli/reference/configuration
#   opencode    : OPENCODE_CONFIG_DIR (agents/commands/modes/plugins only) and
#                 XDG_CONFIG_HOME (full opencode.json, but shared with every
#                 other XDG-respecting app) - https://opencode.ai/docs/config/
#                 Marked "partial": no single variable cleanly owns the whole
#                 config the way CLAUDE_CONFIG_DIR/CODEX_HOME do.
#   Gemini CLI  : GEMINI_CONFIG_DIR exists only as an open feature request, not
#                 a documented/stable variable - https://github.com/google-gemini/gemini-cli/issues/2815
#                 (default ~/.gemini is hard-coded) -> not shareable.
#   Qwen Code   : no documented environment variable; only a per-invocation
#                 `--config-dir` CLI flag - https://qwenlm.github.io/qwen-code-docs/en/users/configuration/settings/
#                 -> not shareable via env var.
#   Droid (Factory): no documented config-dir variable found - https://docs.factory.ai/droid-cli/settings
#                 -> not shareable.
#   arkcli, superclaude, auggie, zhipuai, pi, omp, bun, agy: no official
#                 config-dir variable found in a focused search -> not
#                 shareable (re-check upstream docs before relying on this).
# =============================================================================

AI_TOOLS_CATALOG_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

declare -gA AI_TOOLS_CATALOG=(
    # --- Claude Code (native installer; single source of truth is
    # scripts/ai_shtools/claude_code_install.sh, reused as-is) ---
    ["claude_name"]="Anthropic Claude Code"
    ["claude_exec"]="claude"
    ["claude_package_id"]="@anthropic-ai/claude-code"
    ["claude_install_method"]="native"
    ["claude_link_names"]="claude"
    ["claude_description"]="Anthropic Claude Code - AI-powered coding assistant"
    ["claude_verify_command"]="--version"
    ["claude_config_env"]="CLAUDE_CONFIG_DIR"
    ["claude_config_dir"]="\$HOME/.claude"
    ["claude_config_doc_url"]="https://code.claude.com/docs/en/env-vars"
    ["claude_shareable"]="yes"

    # --- OpenAI Codex ---
    ["codex_name"]="OpenAI Codex"
    ["codex_exec"]="codex"
    ["codex_package_id"]="@openai/codex"
    ["codex_install_method"]="pnpm"
    ["codex_link_names"]="codex"
    ["codex_description"]="OpenAI Codex - AI system that translates natural language to code"
    ["codex_verify_command"]="--version"
    ["codex_config_env"]="CODEX_HOME"
    ["codex_config_dir"]="\$HOME/.codex"
    ["codex_config_doc_url"]="https://developers.openai.com/codex/environment-variables"
    ["codex_shareable"]="yes"

    # --- Google Gemini CLI ---
    ["gemini_name"]="Google Gemini CLI"
    ["gemini_exec"]="gemini"
    ["gemini_package_id"]="@google/gemini-cli"
    ["gemini_install_method"]="pnpm"
    ["gemini_link_names"]="gemini"
    ["gemini_description"]="Google Gemini CLI - Advanced AI assistant with multimodal capabilities"
    ["gemini_verify_command"]="--version"
    ["gemini_config_env"]=""
    ["gemini_config_dir"]="\$HOME/.gemini"
    ["gemini_config_doc_url"]="https://github.com/google-gemini/gemini-cli/issues/2815"
    ["gemini_shareable"]="no"

    # --- Qwen Code CLI ---
    ["qwen_name"]="Qwen Code"
    ["qwen_exec"]="qwen"
    ["qwen_package_id"]="@qwen-code/qwen-code"
    ["qwen_install_method"]="npm"
    ["qwen_link_names"]="qwen"
    ["qwen_description"]="Qwen Code - Alibaba/QwenLM official coding agent CLI"
    ["qwen_verify_command"]="--version"
    ["qwen_config_env"]=""
    ["qwen_config_dir"]="\$HOME/.qwen"
    ["qwen_config_doc_url"]="https://qwenlm.github.io/qwen-code-docs/en/users/configuration/settings/"
    ["qwen_shareable"]="no"

    # --- Cursor Agent (CLI) ---
    ["cursor_agent_name"]="Cursor Agent"
    ["cursor_agent_exec"]="cursor-agent"
    ["cursor_agent_package_id"]="https://cursor.com/install"
    ["cursor_agent_install_method"]="curl"
    ["cursor_agent_link_names"]="cursor-agent"
    ["cursor_agent_description"]="Cursor Agent - Cursor's terminal coding agent"
    ["cursor_agent_verify_command"]="--version"
    ["cursor_agent_config_env"]="CURSOR_CONFIG_DIR"
    ["cursor_agent_config_dir"]="\$HOME/.cursor"
    ["cursor_agent_config_doc_url"]="https://cursor.com/docs/cli/reference/configuration"
    ["cursor_agent_shareable"]="yes"

    # --- Kimi Code CLI (Moonshot AI) ---
    ["kimi_name"]="Kimi Code CLI"
    ["kimi_exec"]="kimi"
    ["kimi_package_id"]="https://code.kimi.com/kimi-code/install.sh"
    ["kimi_install_method"]="curl"
    ["kimi_link_names"]="kimi"
    ["kimi_description"]="Kimi Code CLI - AI coding agent for the terminal by Moonshot AI"
    ["kimi_verify_command"]="--version"
    ["kimi_config_env"]="KIMI_CODE_HOME"
    ["kimi_config_dir"]="\$HOME/.kimi-code"
    ["kimi_config_doc_url"]="https://www.kimi.com/code/docs/en/kimi-code-cli/configuration/env-vars.html"
    ["kimi_shareable"]="yes"

    # --- Cline CLI ---
    ["cline_name"]="Cline CLI"
    ["cline_exec"]="cline"
    ["cline_package_id"]="cline"
    ["cline_install_method"]="pnpm"
    ["cline_link_names"]="cline"
    ["cline_description"]="Cline CLI - AI coding agent for terminal workflows"
    ["cline_verify_command"]="--version"
    ["cline_config_env"]="CLINE_DATA_DIR"
    ["cline_config_dir"]="\$HOME/.cline/data"
    ["cline_config_doc_url"]="https://docs.cline.bot/getting-started/config"
    ["cline_shareable"]="yes"

    # --- Volcano Engine Ark CLI ---
    ["arkcli_name"]="Volcano Ark CLI"
    ["arkcli_exec"]="arkcli"
    ["arkcli_package_id"]="@volcengine/ark-cli"
    ["arkcli_install_method"]="pnpm"
    ["arkcli_link_names"]="arkcli"
    ["arkcli_description"]="Volcano Engine Ark CLI - Ark MaaS toolbox for agents"
    ["arkcli_verify_command"]="--version"
    ["arkcli_config_env"]=""
    ["arkcli_config_dir"]=""
    ["arkcli_config_doc_url"]=""
    ["arkcli_shareable"]="no"

    # --- SuperClaude Framework ---
    ["superclaude_name"]="SuperClaude Framework"
    ["superclaude_exec"]="superclaude"
    ["superclaude_package_id"]="SuperClaude"
    ["superclaude_install_method"]="uv_tool"
    ["superclaude_link_names"]="superclaude"
    ["superclaude_description"]="SuperClaude Framework - Extended Claude Code with specialized commands"
    ["superclaude_verify_command"]="--version"
    ["superclaude_config_env"]=""
    ["superclaude_config_dir"]=""
    ["superclaude_config_doc_url"]=""
    ["superclaude_shareable"]="no"

    # --- OpenCode AI ---
    ["opencode_name"]="OpenCode AI"
    ["opencode_exec"]="opencode"
    ["opencode_package_id"]="https://opencode.ai/install"
    ["opencode_install_method"]="curl"
    ["opencode_link_names"]="opencode"
    ["opencode_description"]="OpenCode AI - AI-powered code generation and development assistant"
    ["opencode_verify_command"]="--version"
    ["opencode_config_env"]="OPENCODE_CONFIG_DIR"
    ["opencode_config_dir"]="\$HOME/.config/opencode"
    ["opencode_config_doc_url"]="https://opencode.ai/docs/config/"
    ["opencode_shareable"]="partial"

    # --- Augment Code Auggie ---
    ["auggie_name"]="Augment Code Auggie"
    ["auggie_exec"]="auggie"
    ["auggie_package_id"]="@augmentcode/auggie"
    ["auggie_install_method"]="pnpm"
    ["auggie_link_names"]="auggie"
    ["auggie_description"]="Augment Code Auggie - AI-powered code enhancement assistant"
    ["auggie_verify_command"]="--version"
    ["auggie_config_env"]=""
    ["auggie_config_dir"]=""
    ["auggie_config_doc_url"]=""
    ["auggie_shareable"]="no"

    # --- Droid AI Assistant (Factory.ai) ---
    ["droid_name"]="Droid AI Assistant"
    ["droid_exec"]="droid"
    ["droid_package_id"]="https://app.factory.ai/cli"
    ["droid_install_method"]="curl"
    ["droid_link_names"]="droid"
    ["droid_description"]="Droid AI Assistant - AI-powered development assistant from Factory.ai"
    ["droid_verify_command"]="--version"
    ["droid_config_env"]=""
    ["droid_config_dir"]="\$HOME/.factory"
    ["droid_config_doc_url"]="https://docs.factory.ai/droid-cli/settings"
    ["droid_shareable"]="no"

    # --- Zhipu AI Python SDK (no first-party CLI binary) ---
    ["zhipuai_name"]="Zhipu AI SDK"
    ["zhipuai_exec"]=""
    ["zhipuai_package_id"]="zhipuai"
    ["zhipuai_install_method"]="pip"
    ["zhipuai_link_names"]=""
    ["zhipuai_description"]="Zhipu AI official Python SDK (no CLI binary)"
    ["zhipuai_verify_command"]=""
    ["zhipuai_config_env"]=""
    ["zhipuai_config_dir"]=""
    ["zhipuai_config_doc_url"]=""
    ["zhipuai_shareable"]="no"

    # --- Pi coding agent harness ---
    ["pi_name"]="Pi Coding Agent"
    ["pi_exec"]="pi"
    ["pi_package_id"]="@earendil-works/pi-coding-agent"
    ["pi_install_method"]="pnpm"
    ["pi_link_names"]="pi"
    ["pi_description"]="Pi coding agent harness (pnpm global, --ignore-scripts)"
    ["pi_verify_command"]="--version"
    ["pi_config_env"]=""
    ["pi_config_dir"]=""
    ["pi_config_doc_url"]=""
    ["pi_shareable"]="no"

    # --- OMP prompt/harness worker ---
    ["omp_name"]="OMP"
    ["omp_exec"]="omp"
    ["omp_package_id"]="https://omp.sh/install"
    ["omp_install_method"]="curl"
    ["omp_link_names"]="omp"
    ["omp_description"]="OMP - JavaScript worker used by the Pi harness"
    ["omp_verify_command"]="--version"
    ["omp_config_env"]=""
    ["omp_config_dir"]=""
    ["omp_config_doc_url"]=""
    ["omp_shareable"]="no"

    # --- Bun runtime (prerequisite for OMP) ---
    ["bun_name"]="Bun"
    ["bun_exec"]="bun"
    ["bun_package_id"]="https://bun.com/install"
    ["bun_install_method"]="curl"
    ["bun_link_names"]="bun"
    ["bun_description"]="Bun JavaScript runtime (prerequisite for the OMP worker)"
    ["bun_verify_command"]="--version"
    ["bun_config_env"]=""
    ["bun_config_dir"]=""
    ["bun_config_doc_url"]=""
    ["bun_shareable"]="no"

    # --- Antigravity CLI (agy) ---
    ["agy_name"]="Antigravity CLI"
    ["agy_exec"]="agy"
    ["agy_package_id"]="https://antigravity.google/cli/install.sh"
    ["agy_install_method"]="curl"
    ["agy_link_names"]="agy"
    ["agy_description"]="Antigravity CLI (agy) - Google Antigravity terminal agent"
    ["agy_verify_command"]="--version"
    ["agy_config_env"]=""
    ["agy_config_dir"]=""
    ["agy_config_doc_url"]=""
    ["agy_shareable"]="no"
)

# Ordered key list (installation/report order). Keep claude first (native,
# other tools' MCP sync depends on nothing here) and dependency helpers
# (bun before omp) last.
AI_TOOLS_CATALOG_KEYS=(
    claude codex gemini qwen cursor_agent kimi cline arkcli superclaude
    opencode auggie droid zhipuai bun pi omp agy
)

# ai_catalog_get <key> <field> -> prints the field value (empty if unknown).
ai_catalog_get() {
    local key="$1" field="$2"
    printf '%s' "${AI_TOOLS_CATALOG["${key}_${field}"]:-}"
}

# ai_catalog_has <key> -> success if the key exists in the catalog.
ai_catalog_has() {
    local key="$1"
    [ -n "${AI_TOOLS_CATALOG["${key}_name"]:-}" ]
}

# ai_catalog_keys -> prints every catalog key, one per line.
ai_catalog_keys() {
    printf '%s\n' "${AI_TOOLS_CATALOG_KEYS[@]}"
}

# ai_catalog_expand_config_dir <key> <real_home> -> prints the tool's config
# dir with the literal "$HOME" token substituted for the real user's home.
ai_catalog_expand_config_dir() {
    local key="$1" real_home="$2" template=""
    template="$(ai_catalog_get "$key" "config_dir")"
    [ -n "$template" ] || return 0
    printf '%s' "${template/\$HOME/$real_home}"
}

export -f ai_catalog_get ai_catalog_has ai_catalog_keys ai_catalog_expand_config_dir 2>/dev/null || true
