#!/bin/bash

# AI Tools installer (Linux) - single script that owns every AI CLI install.
#
# Usage:
#   ./99_install_ai_tools.sh                 # Ensure ALL catalog tools + mcp-chrome
#   ./99_install_ai_tools.sh --only claude,codex   # Ensure only the given keys
#   ./99_install_ai_tools.sh --list           # Print the catalog (no changes)
#   ./99_install_ai_tools.sh --status         # Print install/link/login status
#
# Catalog: common/ai_tools_catalog.sh (key, command, method, package/URL, link
# name). This script is the single source of truth for AI CLI installation;
# install_shells/153 (AI group), 155 (cursor_agent), 165 (agy), 171 (claude),
# 177 (qwen), 179 (zhipuai), 185 (pi/omp/bun) all delegate here via --only.
#
# Every tool is installed as root into a shared location (pnpm global dir,
# /usr/local/lib/<app>, /usr/local/uv-tools) and linked into /usr/local/bin so
# every user can run it. Per-tool idempotent: installed + linked -> skip, no
# network. Ordering: numbered 99 so the install_test_menu.sh chain runs this
# after its prerequisites (17, 25, 27, 37, 51) and before the now-thin legacy
# steps (153+). When run standalone, prerequisites are (re)run only when
# missing.
#
# Shared login (root <-> real desktop user): see common/ai_shared_login.sh.

SCRIPT_INDEX="99"
SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR_LEVEL_1="$(dirname "$SCRIPT_CURRENT_DIR")"    # .../debian
PARENT_DIR_LEVEL_2="$(dirname "$PARENT_DIR_LEVEL_1")"    # .../linux
CORE_NODE_ROOT="$(cd "$PARENT_DIR_LEVEL_2/../../.." && pwd)"
COMMON_DIR="$PARENT_DIR_LEVEL_2/common"
INSTALL_SHELLS_DIR="$SCRIPT_CURRENT_DIR"
AI_SHTOOLS_DIR="$CORE_NODE_ROOT/scripts/ai_shtools"
CLAUDE_CODE_INSTALL_LIB="$AI_SHTOOLS_DIR/claude_code_install.sh"
MCP_SYNC_ENGINE_LIB="$AI_SHTOOLS_DIR/mcp_sync_engine.sh"
MCP_CHROME_START_SH="$CORE_NODE_ROOT/apps/mcp-chrome/scripts/start.sh"
PI_HARNESS_SETTINGS_SCRIPT="$CORE_NODE_ROOT/scripts/shells/common/pi_harness_settings.js"

# shellcheck source=/dev/null
source "$COMMON_DIR/gvar_common.sh"
# shellcheck source=/dev/null
source "$COMMON_DIR/common_functions.sh"
# shellcheck source=/dev/null
source "$COMMON_DIR/ai_tools_catalog.sh"
# shellcheck source=/dev/null
source "$COMMON_DIR/ai_shared_login.sh"
# shellcheck source=/dev/null
source "$COMMON_DIR/installation_methods.sh"

AI99_MODE="ensure"          # ensure | list | status
AI99_ONLY=()                # explicit --only keys (empty = every catalog key)
AI99_INCLUDE_MCP_CHROME=1   # 0 when --only was given and did not name mcp_chrome
AI99_TARGET_USER="${ACTUAL_DESKTOP_USER:-$(ai_shared_login_real_user)}"
AI99_TARGET_HOME="${ACTUAL_DESKTOP_USER_HOME:-$(ai_shared_login_real_home)}"

ai99_log() { echo "[$SCRIPT_INDEX] $*"; }

# --- Argument parsing -------------------------------------------------------
while [ $# -gt 0 ]; do
    case "$1" in
        --only)
            shift
            AI99_INCLUDE_MCP_CHROME=0
            IFS=',' read -ra _ai99_only_raw <<< "${1:-}"
            for _ai99_k in "${_ai99_only_raw[@]}"; do
                [ -n "$_ai99_k" ] || continue
                if [ "$_ai99_k" = "mcp_chrome" ]; then
                    AI99_INCLUDE_MCP_CHROME=1
                else
                    AI99_ONLY+=("$_ai99_k")
                fi
            done
            ;;
        --list) AI99_MODE="list" ;;
        --status) AI99_MODE="status" ;;
        -h|--help)
            echo "Usage: $0 [--only key[,key...]] [--list] [--status]"
            exit 0
            ;;
        *)
            echo "[$SCRIPT_INDEX] WARNING: unrecognized argument '$1' ignored." >&2
            ;;
    esac
    shift
done

if [ ${#AI99_ONLY[@]} -eq 0 ]; then
    AI99_KEYS=("${AI_TOOLS_CATALOG_KEYS[@]}")
else
    AI99_KEYS=("${AI99_ONLY[@]}")
fi

# --- Prerequisites (idempotent: detect readiness, only run what's missing) -
ai99_run_prereq_if_missing() {
    local ready_check="$1" script_name="$2" label="$3"
    if eval "$ready_check"; then
        return 0
    fi
    local script_path="$INSTALL_SHELLS_DIR/$script_name"
    if [ ! -s "$script_path" ]; then
        ai99_log "WARNING: prerequisite $label missing and $script_path not found; continuing anyway."
        return 1
    fi
    ai99_log "Prerequisite $label not ready; running $script_name ..."
    bash "$script_path" || ai99_log "WARNING: $script_name reported errors (continuing)."
}

ai99_ensure_prerequisites() {
    ai99_run_prereq_if_missing 'command -v node >/dev/null 2>&1 && command -v pnpm >/dev/null 2>&1' \
        "17_install_node_toolchain_26.sh" "Node/pnpm/bun toolchain"
    ai99_run_prereq_if_missing 'command -v uv >/dev/null 2>&1' \
        "25_install_uv.sh" "uv"
    ai99_run_prereq_if_missing 'command -v git >/dev/null 2>&1' \
        "27_install_git_ssh.sh" "git/ssh"
    ai99_run_prereq_if_missing '[ -n "${PNPM_GLOBAL_BIN_DIR:-}" ] && [ -d "${PNPM_GLOBAL_BIN_DIR:-/nonexistent}" ]' \
        "37_ensure_pnpm_packages.sh" "pnpm global packages"
    if [ "$AI99_INCLUDE_MCP_CHROME" = "1" ]; then
        ai99_run_prereq_if_missing 'command -v google-chrome >/dev/null 2>&1 || command -v google-chrome-stable >/dev/null 2>&1' \
            "51_install_chrome.sh" "Chrome"
    fi
}

# --- Generic post-install publish: link the resolved binary into
# /usr/local/bin for every catalog link_name. Idempotent. -------------------
ai99_locate_binary() {
    local exec_name="$1" candidate
    local -a candidates=(
        "${PNPM_GLOBAL_BIN_DIR:-}/$exec_name"
        "/root/.local/bin/$exec_name"
        "${AI99_TARGET_HOME:-}/.local/bin/$exec_name"
        "$HOME/.local/bin/$exec_name"
        "/usr/local/bin/$exec_name"
    )
    if command -v "$exec_name" >/dev/null 2>&1; then
        command -v "$exec_name"
        return 0
    fi
    for candidate in "${candidates[@]}"; do
        [ -n "$candidate" ] || continue
        if [ -x "$candidate" ]; then
            printf '%s' "$candidate"
            return 0
        fi
    done
    return 1
}

ai99_publish_link() {
    local key="$1" exec_name link_names found dest link_name
    exec_name="$(ai_catalog_get "$key" "exec")"
    link_names="$(ai_catalog_get "$key" "link_names")"
    [ -n "$exec_name" ] && [ -n "$link_names" ] || return 0

    found="$(ai99_locate_binary "$exec_name")" || return 1

    for link_name in $link_names; do
        dest="/usr/local/bin/$link_name"
        if [ -L "$dest" ] && [ "$(readlink -f "$dest" 2>/dev/null)" = "$(readlink -f "$found" 2>/dev/null)" ]; then
            continue
        fi
        if [ -e "$dest" ] && [ ! -L "$dest" ] && [[ "$found" != /root/* ]]; then
            # A real file already at the destination (e.g. a prior copy) and the
            # source is not root-private: prefer a symlink, replace the copy.
            $USE_SUDO rm -f "$dest"
        fi
        if [[ "$found" == /root/* ]]; then
            # /root is mode 0700; copy so non-root users can execute it.
            $USE_SUDO cp -f "$found" "$dest"
        else
            $USE_SUDO ln -sf "$found" "$dest"
        fi
        $USE_SUDO chmod 0755 "$dest" 2>/dev/null || true
    done
    printf '%s' "$found"
}

ai99_is_ready() {
    local key="$1" exec_name link_names link_name
    exec_name="$(ai_catalog_get "$key" "exec")"
    [ -n "$exec_name" ] || return 1
    command -v "$exec_name" >/dev/null 2>&1 || return 1
    link_names="$(ai_catalog_get "$key" "link_names")"
    for link_name in $link_names; do
        [ -x "/usr/local/bin/$link_name" ] || return 1
    done
    return 0
}

# --- Special-cased tools -----------------------------------------------------
ai99_ensure_claude() {
    if [ -s "$CLAUDE_CODE_INSTALL_LIB" ]; then
        # shellcheck source=/dev/null
        source "$CLAUDE_CODE_INSTALL_LIB"
        if command -v claude_code_install >/dev/null 2>&1; then
            claude_code_install
            return $?
        fi
    fi
    ai99_log "ERROR: claude_code_install workflow not found at $CLAUDE_CODE_INSTALL_LIB"
    return 1
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

ai99_ensure_qwen() {
    local pkg npm_bin
    pkg="$(ai_catalog_get qwen package_id)"
    if ai99_is_ready qwen; then
        ai99_log "[SKIP] Qwen Code already installed and linked."
        return 0
    fi
    if [ "$(get_global_var "SKIP_LARGE_MODELS" "false" 2>/dev/null)" = "true" ]; then
        ai99_log "[SKIP] Server environment without desktop/GPU; skipping Qwen Code."
        return 0
    fi
    npm_bin="$(resolve_tool_bin npm 2>/dev/null || true)"
    if [ -z "$npm_bin" ]; then
        ai99_log "[ERROR] npm not found. Run 17_install_node_toolchain_26.sh first."
        return 1
    fi
    ai99_log "Installing $pkg (global) via npm ..."
    if ! "$npm_bin" install -g "$pkg"; then
        ai99_log "[ERROR] npm install failed for $pkg."
        return 1
    fi
    hash -r 2>/dev/null || true
    ai99_publish_link qwen >/dev/null
    if command -v qwen >/dev/null 2>&1; then
        ai99_log "[OK] qwen ready: $(command -v qwen)"
        return 0
    fi
    ai99_log "[WARN] qwen not on PATH yet; restart your shell or source /etc/environment."
    return 1
}

ai99_ensure_zhipuai() {
    local python_bin pkg="zhipuai" metadata
    python_bin="$(ai99_resolve_python_bin)"
    if [ -z "$python_bin" ]; then
        ai99_log "[WARN] Python unavailable; zhipuai SDK install will retry next run."
        return 1
    fi
    metadata="$("$python_bin" -m pip show "$pkg" 2>/dev/null || true)"
    if [[ "$metadata" == *"Name:"* ]]; then
        ai99_log "[SKIP] zhipuai SDK metadata present; preserving the installed package."
        return 0
    fi
    ai99_log "Installing missing $pkg SDK via pip ..."
    "$python_bin" -m pip install "$pkg" || true
    metadata="$("$python_bin" -m pip show "$pkg" 2>/dev/null || true)"
    if [[ "$metadata" == *"Name:"* ]]; then
        ai99_log "[OK] $pkg metadata is ready."
        return 0
    fi
    ai99_log "[WARN] $pkg metadata is still missing; retrying next run."
    return 1
}

ai99_run_as_target_user() {
    if [ "$(id -u)" -eq 0 ] && [ -n "$AI99_TARGET_USER" ] && [ "$AI99_TARGET_USER" != "root" ]; then
        $USE_SUDO -u "$AI99_TARGET_USER" env HOME="$AI99_TARGET_HOME" "$@"
    else
        HOME="${AI99_TARGET_HOME:-$HOME}" "$@"
    fi
}

ai99_ensure_bun() {
    local bun_link="/usr/local/bin/bun" bun_cmd="${BUN_BIN:-}"
    if [ -x "$bun_cmd" ] || [ -x "$bun_link" ]; then
        ai99_log "[SKIP] Bun already installed."
    else
        ai99_log "Installing Bun (prerequisite for the OMP worker) ..."
        $USE_SUDO mkdir -p "$BUN_INSTALL_DIR"
        command -v curl >/dev/null 2>&1 || { $USE_SUDO apt-get update -qq; $USE_SUDO apt-get install -y curl; }
        command -v unzip >/dev/null 2>&1 || { $USE_SUDO apt-get update -qq; $USE_SUDO apt-get install -y unzip; }
        local installer="$BUN_INSTALL_DIR/install.sh"
        if $USE_SUDO curl -fsSL "https://bun.com/install" -o "$installer" && [ -s "$installer" ]; then
            $USE_SUDO env HOME="$BUN_INSTALL_DIR" BUN_INSTALL="$BUN_INSTALL_DIR" bash "$installer"
        fi
    fi
    if [ -x "$BUN_BIN" ]; then
        $USE_SUDO ln -sf "$BUN_BIN" "$bun_link"
        $USE_SUDO chmod 0755 "$bun_link" 2>/dev/null || true
        ai99_log "[OK] Bun linked at $bun_link."
    elif [ ! -x "$bun_link" ]; then
        ai99_log "[WARN] Bun binary still missing; will retry next run."
        return 1
    fi
    return 0
}

ai99_ensure_pi() {
    local pi_bin="$PNPM_GLOBAL_BIN_DIR/pi" pi_link="/usr/local/bin/pi" pkg
    pkg="$(ai_catalog_get pi package_id)"
    if [ -x "$pi_bin" ] || [ -x "$pi_link" ]; then
        ai99_log "[SKIP] Pi already installed."
    elif [ ! -x "$PNPM_BIN" ]; then
        ai99_log "[WARN] pnpm unavailable; run 17_install_node_toolchain_26.sh first."
        return 1
    else
        ai99_log "Installing Pi ($pkg) via pnpm ..."
        $USE_SUDO env PATH="$PNPM_GLOBAL_BIN_DIR:$PATH" "$PNPM_BIN" add --global --ignore-scripts "$pkg"
    fi
    if [ -x "$pi_bin" ]; then
        $USE_SUDO ln -sf "$pi_bin" "$pi_link"
        $USE_SUDO chmod 0755 "$pi_link" 2>/dev/null || true
        ai99_log "[OK] Pi linked at $pi_link."
    elif [ ! -x "$pi_link" ]; then
        ai99_log "[WARN] Pi binary still missing; will retry next run."
        return 1
    fi
    return 0
}

ai99_ensure_omp() {
    local omp_dir="$COMPILE_DIR/omp" omp_bin="$COMPILE_DIR/omp/omp" omp_link="/usr/local/bin/omp"
    if [ -x "$omp_bin" ] || [ -x "$omp_link" ]; then
        ai99_log "[SKIP] OMP already installed."
    else
        ai99_log "Installing OMP from the official binary installer ..."
        $USE_SUDO mkdir -p "$omp_dir"
        local installer="$omp_dir/install.sh"
        if $USE_SUDO curl -fsSL "https://omp.sh/install" -o "$installer" && [ -s "$installer" ]; then
            $USE_SUDO env PI_INSTALL_DIR="$omp_dir" BUN_INSTALL="$BUN_INSTALL_DIR" sh "$installer" --binary
        fi
    fi
    if [ -x "$omp_bin" ]; then
        $USE_SUDO ln -sf "$omp_bin" "$omp_link"
        $USE_SUDO chmod 0755 "$omp_link" 2>/dev/null || true
        ai99_log "[OK] OMP linked at $omp_link."
    elif [ ! -x "$omp_link" ]; then
        ai99_log "[WARN] OMP binary still missing; will retry next run."
        return 1
    fi

    # Kimi skill compatibility settings merge (uses the FIXED path: the real
    # settings helper lives under scripts/shells/common, not scripts/shells/linux/common).
    local kimi_home="${KIMI_CODE_HOME:-$AI99_TARGET_HOME/.kimi-code}" omp_cmd="$omp_bin"
    [ -x "$omp_cmd" ] || omp_cmd="$omp_link"
    if [ -x "$omp_cmd" ] && [ -x "$NODE_BIN" ] && [ -d "$kimi_home" ] && [ -s "$PI_HARNESS_SETTINGS_SCRIPT" ]; then
        ai99_run_as_target_user "$NODE_BIN" "$PI_HARNESS_SETTINGS_SCRIPT" omp "$omp_cmd" "$kimi_home/skills"
        ai99_log "[OK] OMP Kimi skill compatibility settings merged."
    fi
    return 0
}

ai99_ensure_agy() {
    local exec="agy" shared_bin="/usr/local/bin" install_url="https://antigravity.google/cli/install.sh"
    local profile_file="/etc/profile.d/agy.sh" target_home="${AI99_TARGET_HOME:-$HOME}"
    local agy_bin="" candidate
    local -a candidates=(
        "$shared_bin/$exec" "$HOME/.local/bin/$exec" "/root/.local/bin/$exec" "$target_home/.local/bin/$exec"
    )
    if command -v "$exec" >/dev/null 2>&1; then
        agy_bin="$(command -v "$exec")"
    else
        for candidate in "${candidates[@]}"; do
            [ -x "$candidate" ] && { agy_bin="$candidate"; break; }
        done
    fi
    if [ -z "$agy_bin" ]; then
        ai99_log "Installing $exec via official fast-path installer ..."
        if command -v curl >/dev/null 2>&1; then
            curl -fsSL "$install_url" | bash
        elif command -v wget >/dev/null 2>&1; then
            wget -qO- "$install_url" | bash
        else
            ai99_log "[ERROR] curl or wget required to install $exec."
            return 1
        fi
        for candidate in "${candidates[@]}"; do
            [ -x "$candidate" ] && { agy_bin="$candidate"; break; }
        done
    else
        ai99_log "[SKIP] $exec already installed at $agy_bin"
    fi
    [ -n "$agy_bin" ] && [ -x "$agy_bin" ] || { ai99_log "[WARN] Could not verify $exec binary."; return 1; }

    local dest_shared="$shared_bin/$exec"
    if [ "$agy_bin" != "$dest_shared" ]; then
        $USE_SUDO mkdir -p "$shared_bin"
        if [[ "$agy_bin" == /root/* ]]; then
            $USE_SUDO cp -f "$agy_bin" "$dest_shared"
        else
            $USE_SUDO ln -sf "$agy_bin" "$dest_shared"
        fi
        $USE_SUDO chmod 0755 "$dest_shared" 2>/dev/null || true
    fi
    if [ -n "$target_home" ] && [ -d "$target_home" ] && [ "$target_home" != "/root" ]; then
        local user_local_bin="$target_home/.local/bin"
        local owner="$(stat -c '%U:%G' "$target_home" 2>/dev/null || echo "")"
        [ -d "$user_local_bin" ] || { $USE_SUDO mkdir -p "$user_local_bin"; [ -n "$owner" ] && $USE_SUDO chown -R "$owner" "$target_home/.local" 2>/dev/null; }
        if [ ! -e "$user_local_bin/$exec" ] && [ -x "$dest_shared" ]; then
            $USE_SUDO ln -sf "$dest_shared" "$user_local_bin/$exec"
            [ -n "$owner" ] && $USE_SUDO chown -h "$owner" "$user_local_bin/$exec" 2>/dev/null
        fi
    fi
    if [ ! -f "$profile_file" ]; then
        echo 'export PATH="$HOME/.local/bin:/usr/local/bin:$PATH"' | $USE_SUDO tee "$profile_file" >/dev/null
        $USE_SUDO chmod 0644 "$profile_file"
    fi
    ai99_log "[OK] $exec ready: $(command -v "$exec" 2>/dev/null || echo "$dest_shared")"
    return 0
}

# --- Generic dispatch --------------------------------------------------------
ai99_ensure_tool() {
    local key="$1" name method package_id
    if ! ai_catalog_has "$key"; then
        ai99_log "WARNING: unknown AI tool key '$key' (see --list); skipping."
        return 1
    fi
    name="$(ai_catalog_get "$key" "name")"

    case "$key" in
        claude) ai99_ensure_claude; return $? ;;
        qwen) ai99_ensure_qwen; return $? ;;
        zhipuai) ai99_ensure_zhipuai; return $? ;;
        bun) ai99_ensure_bun; return $? ;;
        pi) ai99_ensure_pi; return $? ;;
        omp) ai99_ensure_omp; return $? ;;
        agy) ai99_ensure_agy; return $? ;;
    esac

    if ai99_is_ready "$key"; then
        ai99_log "[SKIP] $name already installed and linked."
        return 0
    fi

    method="$(ai_catalog_get "$key" "install_method")"
    package_id="$(ai_catalog_get "$key" "package_id")"

    case "$method" in
        pnpm) install_via_pnpm "$package_id" "$name" || true ;;
        npm) install_via_npm "$package_id" "$name" || true ;;
        uv_tool) install_via_uv_tool "$package_id" "$name" || true ;;
        curl) install_via_curl "$package_id" "$name" || true ;;
        *) ai99_log "[WARN] Unknown install method '$method' for $key" ;;
    esac

    hash -r 2>/dev/null || true
    local linked=""
    linked="$(ai99_publish_link "$key")" || true
    if [ -n "$linked" ]; then
        ai99_log "[OK] $name ready ($linked)"
        return 0
    fi
    ai99_log "[WARN] $name still unavailable after the install attempt."
    return 1
}

# --- mcp-chrome ---------------------------------------------------------------
ai99_ensure_mcp_chrome() {
    if [ ! -s "$MCP_SYNC_ENGINE_LIB" ]; then
        ai99_log "WARNING: MCP sync engine not found at $MCP_SYNC_ENGINE_LIB; skipping mcp-chrome."
        return 1
    fi
    # shellcheck source=/dev/null
    source "$MCP_SYNC_ENGINE_LIB"
    ai99_log "Building + registering Chrome MCP as the ncore-mcp-chrome service ..."
    export MCP_CHROME_AS_SERVICE="yes"
    export MCP_CHROME_BUILD_DONE=0
    mcp_install_chrome || ai99_log "WARNING: Chrome MCP install reported errors (continuing)."
    ai99_log "Syncing the chrome MCP entry to every installed AI tool (context7 stays opt-in, not part of this default flow) ..."
    mcp_sync_all || ai99_log "WARNING: MCP sync reported errors (continuing)."
}

# --- --list / --status --------------------------------------------------------
ai99_print_list() {
    printf '%-14s %-14s %-9s %-38s %-16s\n' "KEY" "EXEC" "METHOD" "PACKAGE/URL" "LINK NAMES"
    local key
    for key in "${AI_TOOLS_CATALOG_KEYS[@]}"; do
        printf '%-14s %-14s %-9s %-38s %-16s\n' \
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
    printf '%-14s %-11s %-16s %-8s %s\n' "KEY" "INSTALLED" "VERSION" "LINKED" "LOGIN SHARED"
    local key exec_name installed version linked shareable
    for key in "${AI_TOOLS_CATALOG_KEYS[@]}"; do
        exec_name="$(ai_catalog_get "$key" exec)"
        installed="no"; version="-"; linked="no"
        if [ "$key" = "zhipuai" ]; then
            local py; py="$(ai99_resolve_python_bin)"
            if [ -n "$py" ] && "$py" -m pip show zhipuai >/dev/null 2>&1; then installed="yes"; fi
            linked="n/a"
        elif [ -n "$exec_name" ] && command -v "$exec_name" >/dev/null 2>&1; then
            installed="yes"
            version="$("$exec_name" --version 2>/dev/null | head -1 | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1)"
            [ -n "$version" ] || version="-"
            if ai99_is_ready "$key"; then linked="yes"; fi
        fi
        shareable="$(ai_catalog_get "$key" shareable)"
        [ -n "$shareable" ] && [ "$shareable" != "no" ] || shareable="no"
        printf '%-14s %-11s %-16s %-8s %s\n' "$key" "$installed" "$version" "$linked" "$shareable"
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

# --- Main ---------------------------------------------------------------------
case "$AI99_MODE" in
    list) ai99_print_list; exit 0 ;;
    status) ai99_print_status; exit 0 ;;
esac

ai99_log "============================================================"
ai99_log "AI Tools install: ${AI99_KEYS[*]}"
ai99_log "============================================================"

ai99_ensure_prerequisites

AI99_FAILED=()
for AI99_KEY in "${AI99_KEYS[@]}"; do
    ai99_ensure_tool "$AI99_KEY" || AI99_FAILED+=("$AI99_KEY")
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
exit 0
