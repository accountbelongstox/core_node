#!/usr/bin/env bash

# Claude Code team workflow (Linux). Source this file, then call claude_code_install
# (or claude_team_install alone, as claudeteamup/claudeagents do on every run):
#   1. Claude Code itself is installed by install_shells/99_install_ai_tools.sh (the single
#      owner of every AI CLI): official native installer as the real user, outdated
#      copies replaced, /usr/local/bin link, ownership.
#   2. claude_team_install: each team item is checked and repaired on its own - python3,
#      tmux (distro, version reported), node, curl, ca-certificates, bubblewrap, socat;
#      the terminal the launchers will open is reported (nothing installed); the state,
#      shared and agent-memory dirs; the catalog user_settings_merge keys (added only
#      when absent); each launcher link (claudeteam, claudeteamup, claudeagents + .sh
#      aliases); and the Claude account of the session user (sign-in, first-run setup,
#      repo trust; report only). CCI_CHECK_ONLY=1 reports without changing.

# scripts/ai_shtools/claude_code_install.sh -> core_node root is two levels up.
CCI_SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CCI_CORE_NODE_DIR="$(cd "$CCI_SCRIPT_DIR/../.." && pwd)"
CCI_LINUXENVS_DIR="$CCI_CORE_NODE_DIR/scripts/linuxenvs"
CCI_AI_TOOLS_INSTALLER_LIB="$CCI_CORE_NODE_DIR/scripts/shells/linux/debian/install_shells/99_install_ai_tools.sh"
CCI_BIN_DIR="/usr/local/bin"
CCI_EXEC="claude"
CCI_TEAM_SRC="$CCI_LINUXENVS_DIR/claudeteam.sh"
CCI_TEAM_UP_SRC="$CCI_LINUXENVS_DIR/claudeteamup.sh"
CCI_AGENTS_SRC="$CCI_LINUXENVS_DIR/claudeagents.sh"
CCI_SHARED_DIR="$CCI_CORE_NODE_DIR/.claude/agents_shared"
CCI_AGENT_MEMORY_DIR="$CCI_CORE_NODE_DIR/.claude/agent-memory"
CCI_TEAM_CATALOG_PATH="$CCI_CORE_NODE_DIR/config/claude_team_roles.json"
CCI_USER_CLAUDE_DIR="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
# Global Claude Code state (first-run setup, account, per-project trust); it sits
# next to ~/.claude, not inside it, unless CLAUDE_CONFIG_DIR is set.
CCI_CLAUDE_GLOBAL_CONFIG_PATH="${CLAUDE_CONFIG_DIR:-$HOME}/.claude.json"
CCI_CLAUDE_CREDENTIALS_PATH="$CCI_USER_CLAUDE_DIR/.credentials.json"
# Environment credentials that replace a claude.ai sign-in (names only, never values).
CCI_CLAUDE_ENV_CREDENTIAL_NAMES=(ANTHROPIC_API_KEY ANTHROPIC_AUTH_TOKEN CLAUDE_CODE_OAUTH_TOKEN CLAUDE_CODE_USE_BEDROCK CLAUDE_CODE_USE_VERTEX CLAUDE_CODE_USE_FOUNDRY)
# Result of cci_report_claude_account: ready|login|onboarding|trust|missing.
CCI_CLAUDE_ACCOUNT_STATE=""
# Role PID files (Windows: %LOCALAPPDATA%\core_node\claude_team).
CCI_TEAM_STATE_DIR="${XDG_STATE_HOME:-$HOME/.local/state}/core_node/claude_team"
# User settings of the account that runs the role sessions (root included).
# CLAUDE_CONFIG_DIR is the official override for settings and credentials.
CCI_USER_SETTINGS_PATH="$CCI_USER_CLAUDE_DIR/settings.json"
CCI_CA_BUNDLE_PATH="/etc/ssl/certs/ca-certificates.crt"
# Distro tmux on Debian 13 (3.5a) and Ubuntu 26.04 (3.6): -l % splits, allow-passthrough
# all, extended-keys. Older versions are reported, never replaced.
CCI_TMUX_MIN_VERSION="3.5"
# One terminal attached to the team tmux session (nothing is installed). The system
# default comes first: the Debian/Ubuntu/Kali x-terminal-emulator alternative
# (resolved to its real terminal so its own flags apply), then the freedesktop
# xdg-terminal-exec; then the known terminals. None found or no display: headless.
CCI_TEAM_DEFAULT_TERMINALS=("x-terminal-emulator" "xdg-terminal-exec")
CCI_TEAM_TERMINALS=("ptyxis" "gnome-terminal" "konsole" "xterm" "xfce4-terminal" "qterminal")
CCI_TEAM_TERMINAL=""
CCI_TEAM_TERMINAL_SKIP_REASON=""
# 1 = only report each team item ([OK]/[MISSING]); never install or link.
CCI_CHECK_ONLY="${CCI_CHECK_ONLY:-0}"

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
# window, and the tmux attach, as the desktop user instead of root. Without a
# running root server, root's own bus would activate one that has no display.
# The reason is left in CCI_TEAM_TERMINAL_SKIP_REASON.
cci_terminal_is_foreign_factory() {
    local terminal="$1"
    local bus_uid=""
    local server_pattern=""
    CCI_TEAM_TERMINAL_SKIP_REASON=""
    [ "$(id -u)" = "0" ] || return 1
    case "$terminal" in
        gnome-terminal) server_pattern="gnome-terminal-server" ;;
        ptyxis) server_pattern="ptyxis" ;;
        kgx) server_pattern="kgx" ;;
        x-terminal-emulator)
            case "$(readlink -f "$(command -v x-terminal-emulator 2>/dev/null)" 2>/dev/null)" in
                *gnome-terminal*) server_pattern="gnome-terminal-server" ;;
                *ptyxis*) server_pattern="ptyxis" ;;
                *kgx*) server_pattern="kgx" ;;
                *) return 1 ;;
            esac
            ;;
        *) return 1 ;;
    esac
    bus_uid="$(cci_session_bus_owner_uid)"
    if [ -n "$bus_uid" ] && [ "$bus_uid" != "0" ]; then
        CCI_TEAM_TERMINAL_SKIP_REASON="its server belongs to uid $bus_uid, not root (DBUS_SESSION_BUS_ADDRESS points at that user's session bus); the window and tmux attach would run as that user"
        return 0
    fi
    if ! pgrep -u 0 -f "(^|/)$server_pattern( |$)" >/dev/null 2>&1; then
        CCI_TEAM_TERMINAL_SKIP_REASON="no root $server_pattern is running; root's session bus would activate one without DISPLAY or WAYLAND_DISPLAY, so the window would never appear"
        return 0
    fi
    return 1
}

# Prints the known terminal an x-terminal-emulator alternative points to, else the
# alternative itself (launched with the generic -e form).
cci_resolve_default_terminal() {
    local terminal="$1"
    local target=""
    local known=""
    [ "$terminal" = "x-terminal-emulator" ] || { printf '%s' "$terminal"; return 0; }
    target="$(basename "$(readlink -f "$(command -v "$terminal")" 2>/dev/null)" 2>/dev/null)"
    target="${target%.wrapper}"
    for known in "${CCI_TEAM_TERMINALS[@]}"; do
        if [ "$target" = "$known" ] && command -v "$known" >/dev/null 2>&1; then
            printf '%s' "$known"
            return 0
        fi
    done
    printf '%s' "$terminal"
}

# Sets CCI_TEAM_TERMINAL to the system default terminal, else the first of
# CCI_TEAM_TERMINALS on PATH, or leaves it empty (headless) when there is no
# graphical display or no terminal.
cci_detect_team_terminal() {
    local terminal=""
    local tried=" "
    CCI_TEAM_TERMINAL=""
    if [ -z "${DISPLAY:-}" ] && [ -z "${WAYLAND_DISPLAY:-}" ]; then
        return 0
    fi
    for terminal in "${CCI_TEAM_DEFAULT_TERMINALS[@]}" "${CCI_TEAM_TERMINALS[@]}"; do
        if command -v "$terminal" >/dev/null 2>&1; then
            terminal="$(cci_resolve_default_terminal "$terminal")"
            case "$tried" in
                *" $terminal "*) continue ;;
            esac
            tried="$tried$terminal "
            if cci_terminal_is_foreign_factory "$terminal"; then
                echo "[SKIP] $terminal: $CCI_TEAM_TERMINAL_SKIP_REASON" >&2
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
        echo "[SKIP] team terminal: $(command -v "$CCI_TEAM_TERMINAL") (one window attached to tmux; nothing installed)"
    else
        echo "[WARN] no supported terminal (${CCI_TEAM_DEFAULT_TERMINALS[*]} ${CCI_TEAM_TERMINALS[*]}): the team session attaches in the current tty; nothing installed"
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

# Report-only: a plain su/sudo keeps the original user's LOGNAME/USER (and sudo -E
# or su -m its HOME), while claude reads the effective user's global config.
cci_report_switched_user() {
    local run_user=""
    local origin_user=""
    local origin_home=""
    local run_home=""
    run_user="$(id -un)"
    origin_user="${SUDO_USER:-${LOGNAME:-${USER:-$run_user}}}"
    origin_home="$(getent passwd "$origin_user" 2>/dev/null | cut -d: -f6)"
    run_home="$(getent passwd "$run_user" 2>/dev/null | cut -d: -f6)"
    if [ "$origin_user" != "$run_user" ]; then
        echo "[WARN] This shell switched from $origin_user to $run_user (plain su or sudo): Claude sessions run as $run_user and read $CCI_CLAUDE_GLOBAL_CONFIG_PATH; sign-in and first-run setup done as $origin_user (${origin_home:-its home}) do not apply. Run the launcher as $origin_user, or run 'claude' once as $run_user."
    fi
    if [ -n "$run_home" ] && [ "$run_home" != "$HOME" ]; then
        echo "[WARN] HOME=$HOME is not $run_user's home ($run_home) (sudo -E or su -m): Claude reads and writes $CCI_CLAUDE_GLOBAL_CONFIG_PATH as $run_user"
    fi
}

# Report-only: whether a new claude session of this user would reach its prompt
# (sign-in, first-run setup, workspace trust of the repo). claude itself is not run:
# the state is read from its files. The result is left in CCI_CLAUDE_ACCOUNT_STATE.
cci_report_claude_account() {
    local name=""
    local has_env="0"
    cci_report_switched_user
    if [ -z "$(command -v claude 2>/dev/null)" ]; then
        CCI_CLAUDE_ACCOUNT_STATE="missing"
        echo "[SKIP] claude not installed yet; Claude account not checked"
        return 0
    fi
    for name in "${CCI_CLAUDE_ENV_CREDENTIAL_NAMES[@]}"; do
        if [ -n "${!name:-}" ]; then
            has_env="1"
        fi
    done
    CCI_CLAUDE_ACCOUNT_STATE="$(python3 - "$CCI_CLAUDE_GLOBAL_CONFIG_PATH" "$CCI_CLAUDE_CREDENTIALS_PATH" "$has_env" \
        "$CCI_CORE_NODE_DIR" "$(cd "$CCI_CORE_NODE_DIR" && pwd -P)" <<'PY'
import json
import os
import sys

config_path, credentials_path, has_env = sys.argv[1:4]
try:
    with open(config_path, encoding="utf-8") as handle:
        data = json.load(handle)
except (OSError, ValueError):
    data = {}
if not isinstance(data, dict):
    data = {}
projects = data.get("projects")
if not isinstance(projects, dict):
    projects = {}


def trusted(path):
    # Claude also honours the trust of a parent directory.
    while True:
        entry = projects.get(path)
        if isinstance(entry, dict) and entry.get("hasTrustDialogAccepted") is True:
            return True
        parent = os.path.dirname(path)
        if parent == path:
            return False
        path = parent


if not os.path.isfile(credentials_path) and "oauthAccount" not in data and has_env == "0":
    print("login")
elif data.get("hasCompletedOnboarding") is not True:
    print("onboarding")
elif not any(trusted(path) for path in sys.argv[4:6]):
    print("trust")
else:
    print("ready")
PY
)"
    echo "[OK] Claude account: $(id -un) (uid $(id -u)), HOME=$HOME, config $CCI_CLAUDE_GLOBAL_CONFIG_PATH, credentials dir $CCI_USER_CLAUDE_DIR"
    case "$CCI_CLAUDE_ACCOUNT_STATE" in
        ready) echo "[SKIP] Claude account signed in, first-run setup done, $CCI_CORE_NODE_DIR trusted" ;;
        login) echo "[MISSING] Claude sign-in for $(id -un): run 'claude' once in $CCI_CORE_NODE_DIR as $(id -un) and sign in" ;;
        onboarding) echo "[MISSING] Claude first-run setup in $CCI_CLAUDE_GLOBAL_CONFIG_PATH: run 'claude' once as $(id -un) and finish the setup screens (sessions read it only at startup)" ;;
        trust) echo "[MISSING] Workspace trust for $CCI_CORE_NODE_DIR: run 'claude' there once as $(id -un) and accept the trust prompt" ;;
        *)
            CCI_CLAUDE_ACCOUNT_STATE="missing"
            echo "[WARN] python3 could not read $CCI_CLAUDE_GLOBAL_CONFIG_PATH; Claude account not checked"
            ;;
    esac
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

# Shared team setup used by claude_code_install, by the
# claudeteamup/claudeagents launchers and on the server of a remote role:
# prerequisites, directories, user settings, launcher links, then the report-only
# Claude account check of the user the role sessions run as.
claude_team_install() {
    cci_ensure_team_prereqs
    cci_ensure_dir "$CCI_TEAM_STATE_DIR" "role PID files"
    cci_ensure_dir "$CCI_SHARED_DIR" "shared data between roles"
    cci_ensure_dir "$CCI_AGENT_MEMORY_DIR" "per-role agent memory (memory: project)"
    cci_ensure_team_settings
    cci_setup_claudeteam || true
    cci_report_claude_account
}

# Main entry: native install as the real user + /usr/local/bin link (both owned by
# 99_install_ai_tools.sh) -> team prerequisites -> team launcher links. Returns non-zero
# when the shared claude is still not runnable.
claude_code_install() {
    local claude_bin=""

    if ! command -v ai99_ensure_native >/dev/null 2>&1; then
        # shellcheck source=/dev/null
        source "$CCI_AI_TOOLS_INSTALLER_LIB"
    fi

    print_color "[STEP 1/2] Install Claude Code (official native installer via 99_install_ai_tools.sh, linked into $CCI_BIN_DIR)" "Info"
    ai99_ensure_native "$CCI_EXEC" || echo "[ERROR] Claude Code native install did not complete."
    echo ""

    print_color "[STEP 2/2] Team setup: prerequisites, directories, user settings, claudeteam/claudeteamup/claudeagents links" "Info"
    claude_team_install
    echo ""

    hash -r 2>/dev/null || true
    claude_bin="$CCI_BIN_DIR/$CCI_EXEC"
    if [ -x "$claude_bin" ] && timeout 10 "$claude_bin" --version >/dev/null 2>&1; then
        echo "[OK] claude is installed and runnable from $claude_bin."
        return 0
    fi
    echo "[WARN] claude did not report a version from $claude_bin."
    return 1
}

# Allow direct execution (./claude_code_install.sh) in addition to sourcing.
if [ "${BASH_SOURCE[0]}" = "$0" ]; then
    claude_code_install "$@"
fi
