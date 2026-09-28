#!/usr/bin/env bash

# Canonical Claude Code install workflow (Linux). Single source of truth shared by
# the dd.sh "AI Tools & MCP" menu, install_shells/99_install_ai_tools.sh (and the
# 171 delegate step) and every claude*
# launcher (via ai_cli_provision). Source this file, then call claude_code_install:
#   1. Idempotently install missing prerequisites, then Claude Code itself through the
#      OFFICIAL NATIVE installer, run as the real user (get_real_user) so the per-user
#      install lands in that user's home. claude.ai/install.sh is tried first; its
#      official CDN target (downloads.claude.ai bootstrap.sh) is the fallback when the
#      claude.ai front door refuses the request (e.g. HTTP 403).
#   2. Make claude usable by EVERY user through /usr/local/bin: symlink when the newest
#      working binary is world-reachable, otherwise copy the self-contained binary (0755).
#   3. claude_team_install (also called by claudeteamup/claudeagents on every run):
#      each team item is checked and repaired on its own - python3, tmux (distro,
#      version reported), node, curl, ca-certificates, bubblewrap, socat; the terminal
#      the launchers will open is reported (nothing installed); the state, shared
#      and agent-memory dirs; the catalog user_settings_merge keys
#      (added only when absent); and each launcher link (claudeteam, claudeteamup,
#      claudeagents + .sh aliases). CCI_CHECK_ONLY=1 reports without changing.
# "Installed" means a claude binary that actually answers --version (dangling launcher
# symlinks left behind by pruned native versions do not count).

# scripts/ai_shtools/claude_code_install.sh -> core_node root is two levels up.
CCI_SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CCI_CORE_NODE_DIR="$(cd "$CCI_SCRIPT_DIR/../.." && pwd)"
CCI_LINUXENVS_DIR="$CCI_CORE_NODE_DIR/scripts/linuxenvs"
CCI_REAL_USER_LIB="$CCI_CORE_NODE_DIR/scripts/shells/linux/common/get_real_user.sh"
CCI_BIN_DIR="/usr/local/bin"
CCI_EXEC="claude"
CCI_INSTALLER_URLS=(
    "https://claude.ai/install.sh"
    "https://downloads.claude.ai/claude-code-releases/bootstrap.sh"
)
CCI_VERSION_TIMEOUT_SECONDS="10"
CCI_TEAM_SRC="$CCI_LINUXENVS_DIR/claudeteam.sh"
CCI_TEAM_UP_SRC="$CCI_LINUXENVS_DIR/claudeteamup.sh"
CCI_AGENTS_SRC="$CCI_LINUXENVS_DIR/claudeagents.sh"
CCI_SHARED_DIR="$CCI_CORE_NODE_DIR/.claude/agents_shared"
CCI_AGENT_MEMORY_DIR="$CCI_CORE_NODE_DIR/.claude/agent-memory"
CCI_TEAM_CATALOG_PATH="$CCI_CORE_NODE_DIR/config/claude_team_roles.json"
# Role PID files (Windows: %LOCALAPPDATA%\core_node\claude_team).
CCI_TEAM_STATE_DIR="${XDG_STATE_HOME:-$HOME/.local/state}/core_node/claude_team"
# User settings of the account that runs the role sessions (root included).
CCI_USER_SETTINGS_PATH="$HOME/.claude/settings.json"
CCI_CA_BUNDLE_PATH="/etc/ssl/certs/ca-certificates.crt"
# Distro tmux on Debian 13 (3.5a) and Ubuntu 26.04 (3.6): -l % splits, allow-passthrough
# all, extended-keys. Older versions are reported, never replaced.
CCI_TMUX_MIN_VERSION="3.5"
# One maximized terminal attached to the team tmux session, detected in this order
# (Wayland-safe flags only; nothing is installed): ptyxis (Ubuntu 26.04 default),
# gnome-terminal, konsole, xterm, then the Kali/XFCE terminals and the Debian
# alternative. None found or no display: headless (tmux attach in the current tty).
CCI_TEAM_TERMINALS=("ptyxis" "gnome-terminal" "konsole" "xterm" "xfce4-terminal" "qterminal" "x-terminal-emulator")
CCI_TEAM_TERMINAL=""
# 1 = only report each team item ([OK]/[MISSING]); never install or link.
CCI_CHECK_ONLY="${CCI_CHECK_ONLY:-0}"
CCI_REAL_USER=""
CCI_REAL_HOME=""

# Fallback print_color when run standalone (the main menu provides the real one).
if ! command -v print_color >/dev/null 2>&1; then
    print_color() {
        # Args: message [level]; level is informational only in the fallback.
        printf '%s\n' "$1"
    }
fi

# Run a privileged command directly as root, otherwise through sudo.
cci_sudo() {
    if [ "$(id -u)" -eq 0 ]; then
        "$@"
    elif command -v sudo >/dev/null 2>&1; then
        sudo "$@"
    else
        "$@"
    fi
}

# Run a /usr/local/bin write with sudo only when the bin dir is not writable.
cci_bin_sudo() {
    if [ -w "$CCI_BIN_DIR" ]; then
        "$@"
    else
        cci_sudo "$@"
    fi
}

# Resolve the real (interactive) user through the shared get_real_user helper when
# running as root; a regular user installs for themselves.
cci_resolve_real_user() {
    if [ -n "$CCI_REAL_USER" ]; then
        return 0
    fi
    if [ "$(id -u)" -eq 0 ]; then
        . "$CCI_REAL_USER_LIB" >/dev/null 2>&1
        CCI_REAL_USER="$(get_real_user 2>/dev/null | tail -n 1)"
        CCI_REAL_HOME="$(get_real_user_home 2>/dev/null | tail -n 1)"
    fi
    if [ -z "$CCI_REAL_USER" ] || [ -z "$CCI_REAL_HOME" ] || [ ! -d "$CCI_REAL_HOME" ]; then
        CCI_REAL_USER="$(id -un)"
        CCI_REAL_HOME="$HOME"
    fi
}

# Run a command as the real user (root -> regular user), otherwise as the current
# user. Root installing for itself is allowed explicitly by the official installer.
cci_run_as_real_user() {
    if [ "$(id -u)" -eq 0 ] && [ "$CCI_REAL_USER" != "root" ] && [ "$CCI_REAL_USER" != "$(id -un)" ]; then
        if command -v runuser >/dev/null 2>&1; then
            runuser -u "$CCI_REAL_USER" -- env HOME="$CCI_REAL_HOME" USER="$CCI_REAL_USER" LOGNAME="$CCI_REAL_USER" "$@"
        else
            su -s /bin/bash "$CCI_REAL_USER" -c "$(printf '%q ' env HOME="$CCI_REAL_HOME" USER="$CCI_REAL_USER" LOGNAME="$CCI_REAL_USER" "$@")"
        fi
    else
        env CLAUDE_INSTALL_ALLOW_SUDO=1 "$@"
    fi
}

# Install packages with whichever system package manager is present.
cci_pkg_install() {
    if command -v apt-get >/dev/null 2>&1; then
        cci_sudo env DEBIAN_FRONTEND=noninteractive apt-get install -y "$@" || {
            cci_sudo apt-get update -y
            cci_sudo env DEBIAN_FRONTEND=noninteractive apt-get install -y "$@"
        }
    elif command -v dnf >/dev/null 2>&1; then
        cci_sudo dnf install -y "$@"
    elif command -v yum >/dev/null 2>&1; then
        cci_sudo yum install -y "$@"
    elif command -v apk >/dev/null 2>&1; then
        cci_sudo apk add --no-cache "$@"
    elif command -v pacman >/dev/null 2>&1; then
        cci_sudo pacman -S --noconfirm --needed "$@"
    elif command -v zypper >/dev/null 2>&1; then
        cci_sudo zypper --non-interactive install "$@"
    else
        echo "[WARN] No supported package manager found to install: $*"
        return 1
    fi
}

# Idempotently install only the tools the official native installer needs and lacks
# (downloader, sha256sum, CA bundle; Alpine additionally needs libgcc/libstdc++/ripgrep).
cci_ensure_prereqs() {
    local missing=()
    if ! command -v curl >/dev/null 2>&1 && ! command -v wget >/dev/null 2>&1; then
        missing+=(curl)
    fi
    command -v sha256sum >/dev/null 2>&1 || missing+=(coreutils)
    if [ ! -s /etc/ssl/certs/ca-certificates.crt ] && [ ! -s /etc/pki/tls/certs/ca-bundle.crt ]; then
        missing+=(ca-certificates)
    fi
    if [ -f /etc/alpine-release ]; then
        command -v rg >/dev/null 2>&1 || missing+=(ripgrep)
        [ -e /usr/lib/libstdc++.so.6 ] || missing+=(libstdc++ libgcc)
    fi
    if [ "${#missing[@]}" -eq 0 ]; then
        return 0
    fi
    echo "[PREREQ] Installing missing tools: ${missing[*]}"
    cci_pkg_install "${missing[@]}" || true
}

# Download a URL to a file with curl or wget.
cci_download() {
    local url="$1" dest="$2"
    if command -v curl >/dev/null 2>&1; then
        curl -fsSL --retry 2 -o "$dest" "$url"
    else
        wget -q -O "$dest" "$url"
    fi
}

# Print the "x.y.z" version a claude binary reports, or nothing when it does not run.
cci_claude_version() {
    timeout "$CCI_VERSION_TIMEOUT_SECONDS" "$1" --version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -n 1
}

# Symlink a source script/binary into /usr/local/bin as <name> (and make it
# executable). Mode "keep" leaves an existing identical symlink untouched.
cci_link_into_bin() {
    local src="$1" name="$2" mode="$3"
    local dest="$CCI_BIN_DIR/$name"
    if [ ! -e "$src" ]; then
        echo "[WARN] Link source not found: $src"
        return 1
    fi
    # Never self-link: when the source resolves to the destination (e.g. claude was located
    # as the already-shared /usr/local/bin/claude), a symlink-to-self would break the binary.
    if [ -e "$dest" ] && \
       [ "$(readlink -f "$src" 2>/dev/null)" = "$(readlink -f "$dest" 2>/dev/null)" ]; then
        echo "[SKIP] $name -> $src"
        return 0
    fi
    if [ "$CCI_CHECK_ONLY" = "1" ]; then
        echo "[MISSING] link $dest -> $src"
        return 0
    fi
    # Idempotent: nothing to do when the symlink already points at src.
    if [ "$mode" = "keep" ] && [ -L "$dest" ] && \
       [ "$(readlink "$dest" 2>/dev/null)" = "$src" ]; then
        return 0
    fi
    cci_bin_sudo mkdir -p "$CCI_BIN_DIR"
    cci_bin_sudo chmod +x "$src" 2>/dev/null || true
    cci_bin_sudo ln -sfn "$src" "$dest"
    echo "[LINK] $name -> $src"
}

# True when every user can traverse to and execute the given path (i.e. it is not
# trapped under a mode-700 home such as /root or /home/<user>). Walks each parent
# directory checking the world-execute bit, then the world-execute bit on the file.
cci_others_can_access() {
    local path="$1"
    local p
    p="$(readlink -f "$path" 2>/dev/null || echo "$path")"
    [ -e "$p" ] || return 1
    # Every ancestor directory must be world-executable (traversable).
    local dir="$p"
    while [ "$dir" != "/" ] && [ -n "$dir" ]; do
        dir="$(dirname "$dir")"
        if [ -d "$dir" ]; then
            local perms
            perms="$(stat -c '%A' "$dir" 2>/dev/null || echo "")"
            case "$perms" in
                ?????????x*) ;;          # world-execute set
                "")          ;;          # stat failed; don't block on it
                *) return 1 ;;
            esac
        fi
        [ "$dir" = "/" ] && break
    done
    # The target itself must be world-executable.
    local fperms
    fperms="$(stat -c '%A' "$p" 2>/dev/null || echo "")"
    case "$fperms" in
        ????????x*|?????????x) return 0 ;;
        "")                    return 0 ;;
        *)                     return 1 ;;
    esac
}

# Locate the newest WORKING claude binary on this machine: the real user's and the
# current user's native launchers, root and every /home user, the PATH hit, the shared
# /usr/local/bin copy and the apt/dnf package. Candidates that fail --version (e.g. a
# launcher whose version directory was pruned) are ignored.
cci_find_claude() {
    local candidate="" version="" best="" best_version=""
    cci_resolve_real_user
    for candidate in \
        "$CCI_REAL_HOME/.local/bin/claude" \
        "$HOME/.local/bin/claude" \
        "/root/.local/bin/claude" \
        /home/*/.local/bin/claude \
        "$(command -v claude 2>/dev/null)" \
        "$CCI_BIN_DIR/$CCI_EXEC" \
        "/usr/bin/claude" \
        "$CCI_REAL_HOME/.claude/local/claude" \
        "$HOME/.claude/local/claude"; do
        [ -n "$candidate" ] && [ -x "$candidate" ] || continue
        version="$(cci_claude_version "$candidate")"
        [ -n "$version" ] || continue
        if [ -z "$best" ] || [ "$(printf '%s\n%s\n' "$best_version" "$version" | sort -V | tail -n 1)" != "$best_version" ]; then
            best="$candidate"
            best_version="$version"
        fi
    done
    if [ -n "$best" ]; then
        printf '%s' "$best"
        return 0
    fi
    return 1
}

# Run the official native installer as the real user, unless a working claude already
# exists anywhere (idempotent). Falls back to the official CDN bootstrap URL when the
# claude.ai front door fails; the installer is saved to a file first so an HTTP error
# never pipes an empty or HTML body into bash.
cci_install_native() {
    local existing="" installer="" url="" rc=1
    existing="$(cci_find_claude 2>/dev/null || true)"
    if [ -n "$existing" ]; then
        echo "[SKIP] claude already installed ($existing); skipping native install (bin still synced to all users below)."
        return 0
    fi
    cci_ensure_prereqs
    installer="$(mktemp)"
    for url in "${CCI_INSTALLER_URLS[@]}"; do
        echo "[INSTALL] Fetching official native installer: $url"
        if cci_download "$url" "$installer" && head -n 1 "$installer" | grep -q '^#!'; then
            chmod 0644 "$installer"
            echo "[INSTALL] Running official native installer as $CCI_REAL_USER ($CCI_REAL_HOME)"
            if cci_run_as_real_user bash -c 'cd "$HOME" && bash "$1"' _ "$installer"; then
                rc=0
                break
            fi
        fi
        echo "[WARN] Official native installer failed from $url"
    done
    rm -f "$installer"
    return "$rc"
}

# Make claude usable by EVERY user (regular users + root). Per-user native installs
# live under mode-700 homes, so a /usr/local/bin symlink would be unreachable by
# anyone but the owner. The native build is a single self-contained executable, so
# when the resolved target is not world-reachable it is COPIED into /usr/local/bin
# (0755); when it IS world-reachable a symlink is kept so native updates are tracked.
# Idempotent: skips when the shared copy is already identical.
cci_install_claude_all_users() {
    local src="$1"
    local resolved=""
    local dest="$CCI_BIN_DIR/$CCI_EXEC"

    resolved="$(readlink -f "$src" 2>/dev/null || echo "$src")"

    if cci_others_can_access "$resolved"; then
        cci_link_into_bin "$src" "$CCI_EXEC" "keep"
        echo "[OK] claude reachable by all users via: $dest -> $resolved"
        return 0
    fi

    if [ ! -f "$resolved" ]; then
        echo "[ERROR] Resolved claude is not a regular file: $resolved"
        return 1
    fi

    if [ -f "$dest" ] && [ ! -L "$dest" ] && cmp -s "$resolved" "$dest"; then
        echo "[OK] Shared claude already up to date: $dest"
        return 0
    fi

    echo "[FIX] $resolved is under a non-world-readable home; copying it into $CCI_BIN_DIR for all users."
    cci_bin_sudo mkdir -p "$CCI_BIN_DIR"
    cci_bin_sudo rm -f "$dest"
    if cci_bin_sudo cp -f "$resolved" "$dest" && cci_bin_sudo chmod 0755 "$dest"; then
        echo "[COPY] Installed shared claude for all users: $dest"
        return 0
    fi
    echo "[ERROR] Failed to install shared claude at $dest"
    return 1
}

# Finest-grained idempotent unit: one binary. Present -> [SKIP]; missing -> install
# only its package, re-check, and report [OK]/[WARN]. CCI_CHECK_ONLY=1 reports only.
cci_ensure_binary() {
    local binary="$1" package="$2" purpose="$3"
    local resolved=""
    resolved="$(command -v "$binary" 2>/dev/null || true)"
    if [ -n "$resolved" ]; then
        echo "[SKIP] $binary present: $resolved ($purpose)"
        return 0
    fi
    if [ "$CCI_CHECK_ONLY" = "1" ]; then
        echo "[MISSING] $binary (package $package; $purpose)"
        return 0
    fi
    echo "[INSTALL] $binary missing; installing package $package ($purpose)"
    cci_pkg_install "$package" || true
    hash -r 2>/dev/null || true
    resolved="$(command -v "$binary" 2>/dev/null || true)"
    if [ -n "$resolved" ]; then
        echo "[OK] $binary installed: $resolved"
    else
        echo "[WARN] $binary still missing after installing $package"
    fi
}

# Finest-grained idempotent unit: one directory.
cci_ensure_dir() {
    local dir_path="$1" purpose="$2"
    if [ -d "$dir_path" ]; then
        echo "[SKIP] dir present: $dir_path ($purpose)"
        return 0
    fi
    if [ "$CCI_CHECK_ONLY" = "1" ]; then
        echo "[MISSING] dir $dir_path ($purpose)"
        return 0
    fi
    mkdir -p "$dir_path" && echo "[OK] dir created: $dir_path ($purpose)"
}

# Finest-grained idempotent unit: one file owned by a package (detected by existence).
cci_ensure_package_file() {
    local file_path="$1" package="$2" purpose="$3"
    if [ -s "$file_path" ]; then
        echo "[SKIP] $package present: $file_path ($purpose)"
        return 0
    fi
    if [ "$CCI_CHECK_ONLY" = "1" ]; then
        echo "[MISSING] $file_path (package $package; $purpose)"
        return 0
    fi
    echo "[INSTALL] $file_path missing; installing package $package ($purpose)"
    cci_pkg_install "$package" || true
    if [ -s "$file_path" ]; then
        echo "[OK] $package installed: $file_path"
    else
        echo "[WARN] $file_path still missing after installing $package"
    fi
}

# Report-only: the distro tmux version against the layout's feature floor.
cci_report_tmux_version() {
    local version=""
    command -v tmux >/dev/null 2>&1 || return 0
    version="$(tmux -V 2>/dev/null)"
    version="${version#tmux }"
    if [ "$(printf '%s\n%s\n' "$CCI_TMUX_MIN_VERSION" "$version" | sort -V | head -n 1)" = "$CCI_TMUX_MIN_VERSION" ]; then
        echo "[SKIP] tmux $version (>= $CCI_TMUX_MIN_VERSION: -l % grid, allow-passthrough all, extended-keys)"
    else
        echo "[WARN] tmux $version is older than $CCI_TMUX_MIN_VERSION (the Debian 13 / Ubuntu 26.04 distro version); missing options are skipped"
    fi
}

# Owner uid of the "unix:path=..." socket in DBUS_SESSION_BUS_ADDRESS, or empty
# when unset/unreadable. Used to tell a real root session bus from one leaked
# from another user's session (e.g. plain `su` instead of `su -`).
cci_session_bus_owner_uid() {
    local socket_path=""
    socket_path="${DBUS_SESSION_BUS_ADDRESS#*unix:path=}"
    socket_path="${socket_path%%,*}"
    [ -n "$socket_path" ] && [ -S "$socket_path" ] || return 0
    stat -c '%u' "$socket_path" 2>/dev/null
}

# A D-Bus factory terminal (gnome-terminal, ptyxis) is only a client: the
# already-running server for that display owns the actual window and spawns the
# attach command as ITS OWN user, not the caller's. Running as root through a
# leaked desktop DBUS_SESSION_BUS_ADDRESS (uid mismatch) would silently open the
# window, and the tmux attach, as the desktop user instead of root.
cci_terminal_is_foreign_factory() {
    local terminal="$1"
    local bus_uid=""
    [ "$(id -u)" = "0" ] || return 1
    case "$terminal" in
        gnome-terminal|ptyxis|kgx) ;;
        x-terminal-emulator)
            case "$(readlink -f "$(command -v x-terminal-emulator 2>/dev/null)" 2>/dev/null)" in
                *gnome-terminal*|*ptyxis*|*kgx*) ;;
                *) return 1 ;;
            esac
            ;;
        *) return 1 ;;
    esac
    bus_uid="$(cci_session_bus_owner_uid)"
    [ -n "$bus_uid" ] && [ "$bus_uid" != "0" ]
}

# Sets CCI_TEAM_TERMINAL to the first terminal of CCI_TEAM_TERMINALS on PATH, or
# leaves it empty (headless) when there is no graphical display or no terminal.
cci_detect_team_terminal() {
    local terminal=""
    CCI_TEAM_TERMINAL=""
    if [ -z "${DISPLAY:-}" ] && [ -z "${WAYLAND_DISPLAY:-}" ]; then
        return 0
    fi
    for terminal in "${CCI_TEAM_TERMINALS[@]}"; do
        if command -v "$terminal" >/dev/null 2>&1; then
            if cci_terminal_is_foreign_factory "$terminal"; then
                echo "[SKIP] $terminal: its server belongs to uid $(cci_session_bus_owner_uid), not root (DBUS_SESSION_BUS_ADDRESS points at that user's session bus); the window and tmux attach would run as that user" >&2
                continue
            fi
            CCI_TEAM_TERMINAL="$terminal"
            return 0
        fi
    done
    return 0
}

# Report-only: the terminal claudeagents/claudeteamup will open (nothing installed).
cci_report_team_terminal() {
    cci_detect_team_terminal
    if [ -z "${DISPLAY:-}" ] && [ -z "${WAYLAND_DISPLAY:-}" ]; then
        echo "[SKIP] no graphical display: the team session attaches in the current tty (headless)"
    elif [ -n "$CCI_TEAM_TERMINAL" ]; then
        echo "[SKIP] team terminal: $(command -v "$CCI_TEAM_TERMINAL") (one maximized window attached to tmux; nothing installed)"
    else
        echo "[WARN] no supported terminal (${CCI_TEAM_TERMINALS[*]}): the team session attaches in the current tty; nothing installed"
    fi
}

# Team prerequisites, one item at a time: python3 (catalog and agent frontmatter),
# tmux (the team layout and ad-hoc split-pane teammates), node (project hooks),
# curl and ca-certificates (official native installer), bubblewrap and socat
# (official Bash sandbox), and the terminal report.
cci_ensure_team_prereqs() {
    cci_ensure_binary python3 python3 "role catalog and agent frontmatter parsing"
    cci_ensure_binary tmux tmux "team layout session and ad-hoc split-pane teammates"
    cci_report_tmux_version
    cci_ensure_binary node nodejs "project hooks .claude/hooks/*.mjs"
    cci_ensure_binary curl curl "official native installer download"
    cci_ensure_package_file "$CCI_CA_BUNDLE_PATH" ca-certificates "TLS for the official native installer"
    cci_ensure_binary bwrap bubblewrap "official Bash sandbox (filesystem isolation)"
    cci_ensure_binary socat socat "official Bash sandbox (network proxy relay)"
    cci_report_team_terminal
}

# Link the claudeteam, claudeteamup and claudeagents launchers (and .sh aliases) for
# all users, one link at a time.
cci_setup_claudeteam() {
    cci_link_into_bin "$CCI_TEAM_SRC" "claudeteam"
    cci_link_into_bin "$CCI_TEAM_SRC" "claudeteam.sh"
    cci_link_into_bin "$CCI_TEAM_UP_SRC" "claudeteamup"
    cci_link_into_bin "$CCI_TEAM_UP_SRC" "claudeteamup.sh"
    cci_link_into_bin "$CCI_AGENTS_SRC" "claudeagents"
    cci_link_into_bin "$CCI_AGENTS_SRC" "claudeagents.sh"
}

# Report-only: one Claude Code user setting that would block cross-machine teamwork
# when it currently equals the given value.
cci_ensure_claude_user_setting() {
    local key="$1" value_json="$2" purpose="$3"
    local result=""
    result="$(python3 - "$CCI_USER_SETTINGS_PATH" "$key" "$value_json" <<'PY'
import json
import sys

path, key, value_json = sys.argv[1:4]
value = json.loads(value_json)
try:
    with open(path, encoding="utf-8") as handle:
        data = json.load(handle)
except FileNotFoundError:
    data = {}
except ValueError:
    print("INVALID")
    sys.exit(0)
if not isinstance(data, dict):
    print("INVALID")
    sys.exit(0)
print("CONFLICT" if data.get(key, None) == value else "SKIP")
PY
)"
    case "$result" in
        SKIP) echo "[SKIP] Claude user setting $key is not $value_json ($purpose)" ;;
        CONFLICT) echo "[WARN] Claude user setting $key=$value_json in $CCI_USER_SETTINGS_PATH blocks $purpose; remove it" ;;
        *) echo "[WARN] $CCI_USER_SETTINGS_PATH is not valid JSON; $key not checked" ;;
    esac
}

# Finest-grained idempotent unit: one key of the catalog user_settings_merge block,
# added to the Claude Code user settings (~/.claude/settings.json) only when absent.
# A present key is never overwritten; a value that differs is reported. Other keys
# are preserved and the file is written once, through a temp file.
cci_merge_team_user_settings() {
    local status=""
    local key=""
    local wanted=""
    local current=""
    local merged="0"
    while IFS=$'\t' read -r status key wanted current; do
        merged="1"
        case "$status" in
            SKIP) echo "[SKIP] Claude user setting $key=$wanted present" ;;
            OK) echo "[OK] Claude user setting $key=$wanted added to $CCI_USER_SETTINGS_PATH" ;;
            MISSING) echo "[MISSING] Claude user setting $key=$wanted (would be added to $CCI_USER_SETTINGS_PATH)" ;;
            KEEP) echo "[WARN] Claude user setting $key=$current kept (never overwritten); the team expects $wanted" ;;
            CATALOG) echo "[WARN] $CCI_TEAM_CATALOG_PATH unreadable; user_settings_merge skipped" ;;
            *) echo "[WARN] $CCI_USER_SETTINGS_PATH is not valid JSON; user_settings_merge skipped" ;;
        esac
    done < <(python3 - "$CCI_TEAM_CATALOG_PATH" "$CCI_USER_SETTINGS_PATH" "$CCI_CHECK_ONLY" <<'PY'
import json
import os
import sys

catalog_path, settings_path, check_only = sys.argv[1:4]
try:
    with open(catalog_path, encoding="utf-8") as handle:
        merge = json.load(handle).get("user_settings_merge") or {}
except (OSError, ValueError):
    print("CATALOG\t-\t-\t-")
    sys.exit(0)
try:
    with open(settings_path, encoding="utf-8") as handle:
        data = json.load(handle)
except FileNotFoundError:
    data = {}
except ValueError:
    print("INVALID\t-\t-\t-")
    sys.exit(0)
if not isinstance(data, dict):
    print("INVALID\t-\t-\t-")
    sys.exit(0)
changed = False
for key, value in merge.items():
    wanted = json.dumps(value, ensure_ascii=False)
    if key not in data:
        if check_only == "1":
            print("MISSING\t%s\t%s\t-" % (key, wanted))
        else:
            data[key] = value
            changed = True
            print("OK\t%s\t%s\t-" % (key, wanted))
    elif data[key] == value:
        print("SKIP\t%s\t%s\t-" % (key, wanted))
    else:
        print("KEEP\t%s\t%s\t%s" % (key, wanted, json.dumps(data[key], ensure_ascii=False)))
if changed:
    os.makedirs(os.path.dirname(settings_path), exist_ok=True)
    temp_path = "%s.tmp" % settings_path
    with open(temp_path, "w", encoding="utf-8") as handle:
        json.dump(data, handle, indent=2, ensure_ascii=False)
        handle.write("\n")
    os.replace(temp_path, settings_path)
PY
)
    if [ "$merged" = "0" ]; then
        echo "[SKIP] catalog user_settings_merge is empty"
    fi
}

# Report-only: variables that disable Remote Control (official requirements), so
# cross-machine SendMessage between role sessions cannot work.
cci_check_remote_control_env() {
    local name=""
    local blocked="0"
    for name in CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC DISABLE_GROWTHBOOK CLAUDE_CODE_USE_BEDROCK CLAUDE_CODE_USE_VERTEX CLAUDE_CODE_USE_FOUNDRY; do
        if [ -n "${!name:-}" ]; then
            echo "[WARN] $name is set in this environment: Remote Control (cross-machine messaging) is unavailable"
            blocked="1"
        fi
    done
    if [ -n "${ANTHROPIC_BASE_URL:-}" ] && [ "${ANTHROPIC_BASE_URL%/}" != "https://api.anthropic.com" ]; then
        echo "[WARN] ANTHROPIC_BASE_URL points away from api.anthropic.com: Remote Control is unavailable"
        blocked="1"
    fi
    if [ "$blocked" = "0" ]; then
        echo "[SKIP] no variable blocks Remote Control"
    fi
}

# Claude Code settings the role sessions need on every machine (local and server):
# the catalog user_settings_merge keys (crossSessionInbound, push notifications,
# preferredNotifChannel), then report-only checks of what blocks Remote Control.
cci_ensure_team_settings() {
    cci_merge_team_user_settings
    cci_ensure_claude_user_setting isolatePeerMachines 'true' "cross-machine SendMessage without per-message approval"
    cci_ensure_claude_user_setting disableRemoteControl 'true' "Remote Control for cross-machine role sessions"
    cci_check_remote_control_env
}

# Report-only: this account must be past first-run onboarding and logged in before
# a team lead is spawned, or its session stalls on the theme/login
# screen instead of running its kickoff (each pane's PID stays alive, so a
# liveness check alone reports "running" for a session that never started work).
cci_check_claude_login() {
    local exec_path=""
    local status_json=""
    local logged_in=""

    exec_path="$(command -v "$CCI_EXEC" 2>/dev/null || true)"
    if [ -z "$exec_path" ]; then
        exec_path="$CCI_BIN_DIR/$CCI_EXEC"
    fi
    if [ ! -x "$exec_path" ]; then
        echo "[SKIP] claude login check: $exec_path not installed yet"
        return 0
    fi

    status_json="$(timeout "$CCI_VERSION_TIMEOUT_SECONDS" "$exec_path" auth status --json 2>/dev/null || true)"
    logged_in="$(python3 - "$status_json" <<'PY'
import json
import sys

raw = sys.argv[1]
try:
    data = json.loads(raw) if raw else {}
except ValueError:
    print("UNKNOWN")
    sys.exit(0)
if not isinstance(data, dict):
    print("UNKNOWN")
    sys.exit(0)
print("YES" if data.get("loggedIn") else "NO")
PY
)"
    case "$logged_in" in
        YES) echo "[OK] Claude Code is logged in: the team lead can run its kickoff" ;;
        NO) echo "[WARN] Claude Code is not logged in: the team lead will stall on first-run setup. Run 'claude' once interactively (or 'claude setup-token'), then re-run this launcher." ;;
        *) echo "[WARN] Could not read claude auth status ($exec_path auth status --json); the team lead may stall on first-run setup" ;;
    esac
}

# Shared team setup used by claude_code_install (dd.sh step 171), by the
# claudeteamup/claudeagents launchers and on the server of a remote role:
# prerequisites, directories, user settings, launcher links.
claude_team_install() {
    cci_ensure_team_prereqs
    cci_ensure_dir "$CCI_TEAM_STATE_DIR" "role PID files"
    cci_ensure_dir "$CCI_SHARED_DIR" "shared data between roles"
    cci_ensure_dir "$CCI_AGENT_MEMORY_DIR" "per-role agent memory (memory: project)"
    cci_ensure_team_settings
    cci_check_claude_login
    cci_setup_claudeteam || true
}

# Main entry: install (native, idempotent) -> make claude usable by all users ->
# team prerequisites -> link the team launchers. Returns non-zero when the shared claude is still not runnable.
claude_code_install() {
    local bin_path=""

    cci_resolve_real_user

    print_color "[STEP 1/3] Install Claude Code (official native installer, user: $CCI_REAL_USER)" "Info"
    cci_install_native || echo "[ERROR] Every official native installer source failed."
    echo ""

    print_color "[STEP 2/3] Install claude into $CCI_BIN_DIR for all users" "Info"
    bin_path="$(cci_find_claude || true)"
    if [ -z "$bin_path" ]; then
        echo "[ERROR] Could not locate a working claude binary after installation."
    else
        echo "[FOUND] claude binary: $bin_path"
        cci_install_claude_all_users "$bin_path" || true
    fi
    echo ""

    print_color "[STEP 3/3] Team setup: prerequisites, directories, user settings, claudeteam/claudeteamup/claudeagents links" "Info"
    claude_team_install
    echo ""

    hash -r 2>/dev/null || true
    if [ -n "$(cci_claude_version "$CCI_BIN_DIR/$CCI_EXEC")" ]; then
        echo "[OK] claude is installed and runnable from $CCI_BIN_DIR/$CCI_EXEC."
        return 0
    fi
    echo "[WARN] claude did not report a version from $CCI_BIN_DIR/$CCI_EXEC."
    return 1
}

# Allow direct execution (./claude_code_install.sh) in addition to sourcing.
if [ "${BASH_SOURCE[0]}" = "$0" ]; then
    claude_code_install "$@"
fi
