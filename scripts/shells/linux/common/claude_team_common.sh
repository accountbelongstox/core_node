#!/bin/bash

# =============================================================================
# Shared idempotent Claude multi-role orchestration (Linux / bash)
# =============================================================================
# Used by scripts/linuxenvs/claudeagents.sh (mode "team"), claudeteamup.sh (mode
# "sessions") and claudeteam.sh (role argv, kickoff, session_env, PID file).
# Windows counterpart: scripts/shells/win/win_common/ClaudeTeamCommon.ps1
# Roles: .claude/agents/*.md frontmatter (name, model, effort). The catalog
# config/claude_team_roles.json holds launcher-only data; its roles[] rows are
# overrides only (enabled, remote), and an agent file without a row is enabled.
# Both modes start every enabled role as its own claude session (--agent <role>
# --name <prefix><role> --effort <frontmatter>) in one tmux session
# layout.tmux_session on the mode's socket: one window (tab) per packed group of
# layout.tab_groups at layout.min_lead / layout.min_role cells, an explicit -l %
# grid, role titles on the pane borders and session hooks that re-apply the grid.
# The grid is chosen from the attached tmux client size. Only the lead kickoff
# differs: team.kickoff (claudeagents) or sessions.kickoff_lead (claudeteamup).
# A role whose PID is alive is skipped; a live pane without its claude is
# respawned in place; a role without a pane opens in a new tab.
# Executed directly with --regrid <socket> <session> <lead> <lead cols>, it
# re-applies the grid (the tmux hooks call it).
# =============================================================================

CLAUDE_TEAM_COMMON_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLAUDE_TEAM_COMMON_PATH="$CLAUDE_TEAM_COMMON_DIR/$(basename "${BASH_SOURCE[0]}")"
CLAUDE_TEAM_ROOT_DIR="$(cd "$CLAUDE_TEAM_COMMON_DIR/../../../.." && pwd)"
CLAUDE_TEAM_CATALOG_PATH="$CLAUDE_TEAM_ROOT_DIR/config/claude_team_roles.json"
CLAUDE_TEAM_LAUNCHER_PATH="$CLAUDE_TEAM_ROOT_DIR/scripts/linuxenvs/claudeteam.sh"
CLAUDE_TEAM_AI_CLI_LIB="$CLAUDE_TEAM_COMMON_DIR/ai_cli_provision_common.sh"
CLAUDE_TEAM_CLAUDE_INSTALL_LIB="$CLAUDE_TEAM_ROOT_DIR/scripts/ai_shtools/claude_code_install.sh"
. "$CLAUDE_TEAM_CLAUDE_INSTALL_LIB"
CLAUDE_TEAM_BIN_DIR="/usr/local/bin"
CLAUDE_TEAM_STATE_DIR="$CCI_TEAM_STATE_DIR"
CLAUDE_TEAM_TOTAL_STEPS="9"
CLAUDE_TEAM_ATTACH_WAIT_SECONDS="10"
CLAUDE_TEAM_PID_WAIT_SECONDS="10"
CLAUDE_TEAM_LEAD_ROLE="orchestrator"
CLAUDE_TEAM_GIT_GUARD_ENV="CLAUDE_AGENTS_SESSION=1"
CLAUDE_TEAM_USER_TEAMS_DIR="$HOME/.claude/teams"
CLAUDE_TEAM_USER_TASKS_DIR="$HOME/.claude/tasks"
CLAUDE_TEAM_SECRET_READER="$CLAUDE_TEAM_ROOT_DIR/scripts/pytools/special_software_env_manager/secret_read.py"
CLAUDE_TEAM_SSH_OPTIONS=("-t" "-o" "ServerAliveInterval=30" "-o" "ServerAliveCountMax=4")
# claudeteam.sh pane options (same names as claudeteam.ps1): --team-pane <team|sessions>
# marks a role pane of this launcher; the other two are launcher-only, never passed on.
CLAUDE_TEAM_PANE_FLAG="--team-pane"
CLAUDE_TEAM_PANE_NO_KICKOFF_FLAG="--team-no-kickoff"
CLAUDE_TEAM_PANE_ROLES_FLAG="--team-roles"
# Cell budget when no client is attached and no tty size is known: about a maximized
# 1920x1080 terminal at 9x19 px cells, minus the tmux status line.
CLAUDE_TEAM_FALLBACK_COLS="213"
CLAUDE_TEAM_FALLBACK_ROWS="52"
CLAUDE_TEAM_STATUS_LINES="1"
CLAUDE_TEAM_PANE_ROLE_OPTION="@claude_role"
CLAUDE_TEAM_PANE_SESSION_OPTION="@claude_session"
CLAUDE_TEAM_PANE_BORDER_FORMAT=' #{?#{@claude_role},#{@claude_role} (#{@claude_session}),#{pane_title}} '
CLAUDE_TEAM_REGRID_HOOKS=("after-split-window" "after-select-layout" "after-kill-pane")
CLAUDE_TEAM_SAFE_ARG_PATTERN='^[A-Za-z0-9_./:=%@+,-]+$'

CLAUDE_TEAM_MODE="sessions"
CLAUDE_TEAM_ENTRY_PATH=""
CLAUDE_TEAM_ENTRY_COMMAND=""
CLAUDE_TEAM_OPT_STATUS="0"
CLAUDE_TEAM_OPT_NO_WINDOWS="0"
CLAUDE_TEAM_OPT_NO_KICKOFF="0"
CLAUDE_TEAM_OPT_ROLES=""
CLAUDE_TEAM_DRY_RUN="0"

CLAUDE_TEAM_OS_ID=""
CLAUDE_TEAM_OS_VERSION=""
CLAUDE_TEAM_OS_NAME=""
CLAUDE_TEAM_SESSION_TYPE=""
CLAUDE_TEAM_GRAPHICAL="0"
CLAUDE_TEAM_IS_WAYLAND="0"
CLAUDE_TEAM_IS_WSL="0"

CLAUDE_TEAM_GUIDE_DOC=""
CLAUDE_TEAM_RECORD_DIR=""
CLAUDE_TEAM_AGENTS_DIR=""
CLAUDE_TEAM_SHARED_DIR=""
CLAUDE_TEAM_SESSION_PREFIX="ct-"
CLAUDE_TEAM_SESSIONS_SOCKET="claudeteam"
CLAUDE_TEAM_SESSIONS_KICKOFF_LEAD=""
CLAUDE_TEAM_SESSIONS_KICKOFF=""
CLAUDE_TEAM_TEAM_SESSION_NAME="ca-orchestrator"
CLAUDE_TEAM_TEAM_SOCKET="claudeagents"
CLAUDE_TEAM_TEAM_TEAMMATE_MODE="tmux"
CLAUDE_TEAM_TEAM_KICKOFF=""
CLAUDE_TEAM_REMOTE_KICKOFF=""
CLAUDE_TEAM_REMOTE_RECONNECT_SECONDS="5"
CLAUDE_TEAM_LAYOUT_SESSION="core-node-team"
CLAUDE_TEAM_MIN_LEAD_COLS="100"
CLAUDE_TEAM_MIN_LEAD_ROWS="30"
CLAUDE_TEAM_MIN_ROLE_COLS="60"
CLAUDE_TEAM_MIN_ROLE_ROWS="15"
CLAUDE_TEAM_MERGE_GROUPS="1"
CLAUDE_TEAM_TASK_LIST=""
CLAUDE_TEAM_TMUX_SOCKET=""
CLAUDE_TEAM_OTHER_SOCKET=""
CLAUDE_TEAM_REMOTE_ANY="0"

CLAUDE_TEAM_ROLE_NAMES=()
CLAUDE_TEAM_ROLE_ENABLED=()
CLAUDE_TEAM_ROLE_HAS_AGENT=()
CLAUDE_TEAM_ROLE_MODEL=()
CLAUDE_TEAM_ROLE_EFFORT=()
CLAUDE_TEAM_ROLE_AGENT_PATH=()
CLAUDE_TEAM_ROLE_REMOTE_SECRET=()
CLAUDE_TEAM_ROLE_REMOTE_ROOT=()
CLAUDE_TEAM_ROLE_SOURCE=()
CLAUDE_TEAM_ROW_STATE=()
CLAUDE_TEAM_ROW_ACTION=()
CLAUDE_TEAM_ROW_PID=()
CLAUDE_TEAM_ROW_TAB=()
CLAUDE_TEAM_ROW_PANE=()
CLAUDE_TEAM_ROW_CELLS=()
CLAUDE_TEAM_ROW_PANE_ID=()
CLAUDE_TEAM_ENV_SCOPE=()
CLAUDE_TEAM_ENV_NAME=()
CLAUDE_TEAM_ENV_VALUE=()
CLAUDE_TEAM_GROUP_INDEX=()
CLAUDE_TEAM_GROUP_ROLE=()

CLAUDE_TEAM_SPEC_ENV=()
CLAUDE_TEAM_SPEC_UNSET=()
CLAUDE_TEAM_SPEC_ARGS=()
CLAUDE_TEAM_SPEC_KICKOFF=""

CLAUDE_TEAM_TERMINAL=""
CLAUDE_TEAM_TERMINAL_ARGV=()
CLAUDE_TEAM_SESSION_EXISTS="0"
CLAUDE_TEAM_SESSION_READY="0"
CLAUDE_TEAM_CLIENTS="0"
CLAUDE_TEAM_CLIENT_COLS=""
CLAUDE_TEAM_CLIENT_ROWS=""
CLAUDE_TEAM_BUDGET_COLS=""
CLAUDE_TEAM_BUDGET_ROWS=""
CLAUDE_TEAM_BUDGET_SOURCE=""
CLAUDE_TEAM_TERMINAL_OPENED="0"
CLAUDE_TEAM_FIRST_PANE_ID=""
CLAUDE_TEAM_LAST_PANE_ID=""
CLAUDE_TEAM_LAST_ERROR=""
CLAUDE_TEAM_LEAD_PANE_ID=""
CLAUDE_TEAM_PLAN_PANE_SEQ="0"
CLAUDE_TEAM_TAB_BASE="0"
CLAUDE_TEAM_PANE_ROLES=()
CLAUDE_TEAM_PANE_IDS=()
CLAUDE_TEAM_PANE_WINDOWS=()

CLAUDE_TEAM_PLACE_ORDER=()
CLAUDE_TEAM_PACK_GROUPS=()
CLAUDE_TEAM_GRID_MAX_COLS="1"
CLAUDE_TEAM_GRID_MAX_ROWS="1"
CLAUDE_TEAM_TAB_COUNT="0"
CLAUDE_TEAM_TAB_LEAD=()
CLAUDE_TEAM_TAB_CAP=()
CLAUDE_TEAM_TAB_MAX_COLS=()
CLAUDE_TEAM_TAB_ROLES=()
CLAUDE_TEAM_TAB_SPEC=()
CLAUDE_TEAM_TAB_COLUMNS=()
CLAUDE_TEAM_TAB_LEAD_COLS=()
CLAUDE_TEAM_TAB_NAME=()

claude_team_step() {
    printf '\n\033[36m[STEP %s/%s] %s\033[0m\n' "$1" "$CLAUDE_TEAM_TOTAL_STEPS" "$2"
}

claude_team_log() {
    local level="$1"
    local color="0"
    shift
    case "$level" in
        OK|SKIP) color="32" ;;
        INSTALL|START|OPEN|LINK|PLAN) color="33" ;;
        WARN) color="35" ;;
        ERROR) color="31" ;;
        *) color="0" ;;
    esac
    printf '  \033[%sm[%s]\033[0m %s\n' "$color" "$level" "$*"
}

claude_team_start_level() {
    if [ "$CLAUDE_TEAM_DRY_RUN" = "1" ]; then
        printf 'PLAN'
        return 0
    fi
    printf 'START'
}

claude_team_quote_args() {
    local argument=""
    local quoted=""
    local output=""
    for argument in "$@"; do
        if [[ "$argument" =~ $CLAUDE_TEAM_SAFE_ARG_PATTERN ]]; then
            quoted="$argument"
        else
            quoted="'${argument//\'/\'\\\'\'}'"
        fi
        output="${output:+$output }$quoted"
    done
    printf '%s' "$output"
}

claude_team_tmux() {
    tmux -L "$CLAUDE_TEAM_TMUX_SOCKET" "$@"
}

# A tmux change: printed as a plan line under --status, run otherwise.
claude_team_tmux_do() {
    if [ "$CLAUDE_TEAM_DRY_RUN" = "1" ]; then
        claude_team_log PLAN "tmux -L $CLAUDE_TEAM_TMUX_SOCKET $(claude_team_quote_args "$@")"
        return 0
    fi
    claude_team_tmux "$@" >/dev/null 2>&1 </dev/null
}

# A tmux command that creates a pane (-P -F '#{pane_id}'): sets CLAUDE_TEAM_LAST_PANE_ID.
claude_team_tmux_pane() {
    local output=""
    CLAUDE_TEAM_LAST_PANE_ID=""
    CLAUDE_TEAM_LAST_ERROR=""
    if [ "$CLAUDE_TEAM_DRY_RUN" = "1" ]; then
        CLAUDE_TEAM_PLAN_PANE_SEQ=$((CLAUDE_TEAM_PLAN_PANE_SEQ + 1))
        claude_team_log PLAN "tmux -L $CLAUDE_TEAM_TMUX_SOCKET $(claude_team_quote_args "$@")"
        CLAUDE_TEAM_LAST_PANE_ID="%plan$CLAUDE_TEAM_PLAN_PANE_SEQ"
        return 0
    fi
    if ! output="$(claude_team_tmux "$@" 2>&1 </dev/null)"; then
        CLAUDE_TEAM_LAST_ERROR="$output"
        return 1
    fi
    CLAUDE_TEAM_LAST_PANE_ID="${output%%$'\n'*}"
    [ -n "$CLAUDE_TEAM_LAST_PANE_ID" ]
}

claude_team_lead_session() {
    if [ "$CLAUDE_TEAM_MODE" = "team" ]; then
        printf '%s' "$CLAUDE_TEAM_TEAM_SESSION_NAME"
        return 0
    fi
    printf '%s%s' "$CLAUDE_TEAM_SESSION_PREFIX" "$CLAUDE_TEAM_LEAD_ROLE"
}

claude_team_session_name() {
    if [ "$1" = "$CLAUDE_TEAM_LEAD_ROLE" ]; then
        claude_team_lead_session
        return 0
    fi
    printf '%s%s' "$CLAUDE_TEAM_SESSION_PREFIX" "$1"
}

claude_team_role_index() {
    local index=""
    for index in "${!CLAUDE_TEAM_ROLE_NAMES[@]}"; do
        if [ "${CLAUDE_TEAM_ROLE_NAMES[$index]}" = "$1" ]; then
            printf '%s' "$index"
            return 0
        fi
    done
    return 1
}

claude_team_role_is_remote() {
    local index=""
    index="$(claude_team_role_index "$1")" || return 1
    [ -n "${CLAUDE_TEAM_ROLE_REMOTE_SECRET[$index]:-}" ]
}

claude_team_attach_command() {
    printf 'tmux -L %s attach-session -t %s' "$CLAUDE_TEAM_TMUX_SOCKET" "$CLAUDE_TEAM_LAYOUT_SESSION"
}

claude_team_detect_platform() {
    local os_release="/etc/os-release"
    local os_id=""
    local os_version=""
    local os_name=""
    if [ -r "$os_release" ]; then
        os_id="$(. "$os_release" && printf '%s' "${ID:-}")"
        os_version="$(. "$os_release" && printf '%s' "${VERSION_ID:-}")"
        os_name="$(. "$os_release" && printf '%s' "${PRETTY_NAME:-}")"
    fi
    CLAUDE_TEAM_OS_ID="${os_id:-unknown}"
    CLAUDE_TEAM_OS_VERSION="${os_version:-unknown}"
    CLAUDE_TEAM_OS_NAME="${os_name:-unknown}"
    CLAUDE_TEAM_SESSION_TYPE="${XDG_SESSION_TYPE:-}"
    if [ -n "${WAYLAND_DISPLAY:-}" ] || [ "$CLAUDE_TEAM_SESSION_TYPE" = "wayland" ]; then
        CLAUDE_TEAM_IS_WAYLAND="1"
        CLAUDE_TEAM_SESSION_TYPE="wayland"
    elif [ -n "${DISPLAY:-}" ]; then
        CLAUDE_TEAM_SESSION_TYPE="${CLAUDE_TEAM_SESSION_TYPE:-x11}"
    else
        CLAUDE_TEAM_SESSION_TYPE="${CLAUDE_TEAM_SESSION_TYPE:-tty}"
    fi
    if [ -n "${DISPLAY:-}" ] || [ -n "${WAYLAND_DISPLAY:-}" ]; then
        CLAUDE_TEAM_GRAPHICAL="1"
    fi
    if grep -qi microsoft /proc/sys/kernel/osrelease 2>/dev/null; then
        CLAUDE_TEAM_IS_WSL="1"
    fi
    case "$CLAUDE_TEAM_OS_ID" in
        debian|ubuntu|kali) claude_team_log OK "Supported distro profile: $CLAUDE_TEAM_OS_ID $CLAUDE_TEAM_OS_VERSION" ;;
        *) claude_team_log WARN "Untested distro profile: $CLAUDE_TEAM_OS_ID $CLAUDE_TEAM_OS_VERSION (apt path assumed)" ;;
    esac
    claude_team_log OK "OS: $CLAUDE_TEAM_OS_NAME$([ "$CLAUDE_TEAM_IS_WSL" = "1" ] && printf ' (WSL2)')"
    claude_team_log OK "User: $(id -un) (uid $(id -u)); session: $CLAUDE_TEAM_SESSION_TYPE; DISPLAY=${DISPLAY:-<none>}; WAYLAND_DISPLAY=${WAYLAND_DISPLAY:-<none>}"
    claude_team_log OK "Mode: $CLAUDE_TEAM_MODE; project root: $CLAUDE_TEAM_ROOT_DIR; state dir: $CLAUDE_TEAM_STATE_DIR"
    if [ "$CLAUDE_TEAM_IS_WAYLAND" = "1" ]; then
        claude_team_log OK "Wayland: windows cannot be positioned; one maximized terminal holds the tmux grid"
    fi
}

claude_team_install_items() {
    if [ "$CLAUDE_TEAM_OPT_STATUS" = "1" ]; then
        CCI_CHECK_ONLY="1"
    fi
    claude_team_install
    CCI_CHECK_ONLY="0"
}

claude_team_ensure_claude() {
    local resolved=""
    if [ "$CLAUDE_TEAM_OPT_STATUS" = "0" ]; then
        . "$CLAUDE_TEAM_AI_CLI_LIB"
        ai_cli_provision "claude"
    fi
    resolved="$(command -v claude 2>/dev/null || true)"
    if [ -n "$resolved" ]; then
        claude_team_log OK "claude: $resolved ($(claude --version 2>/dev/null | head -n 1))"
    else
        claude_team_log WARN "claude missing; run without --status to install"
    fi
    claude_team_log OK "Role launcher: $CLAUDE_TEAM_LAUNCHER_PATH (--permission-mode auto, --effort from the agent frontmatter, session_env, git guard on)"
}

# Roles come from the .claude/agents frontmatter (name, model, effort); catalog
# roles[] rows override enabled/remote. Catalog order first, then agent files
# without a row, by name.
claude_team_load_catalog() {
    local parsed=""
    local kind=""
    local field_a=""
    local field_b=""
    local field_c=""
    local field_d=""
    local field_e=""
    local field_f=""
    local field_g=""
    local field_h=""
    local field_i=""
    local index=""
    if [ ! -f "$CLAUDE_TEAM_CATALOG_PATH" ]; then
        claude_team_log ERROR "Role catalog missing: $CLAUDE_TEAM_CATALOG_PATH"
        return 1
    fi
    parsed="$(python3 - "$CLAUDE_TEAM_CATALOG_PATH" "$CLAUDE_TEAM_ROOT_DIR" <<'PY'
import json
import os
import sys

catalog_path, root_dir = sys.argv[1:3]
with open(catalog_path, encoding="utf-8") as handle:
    data = json.load(handle)


def text(value):
    if isinstance(value, bool):
        value = "1" if value else "0"
    value = str(value).replace("\t", " ").replace("\r", " ").replace("\n", " ")
    return value if value else "-"


def emit(*fields):
    print("\t".join(text(field) for field in fields))


for key, value in data.items():
    if isinstance(value, dict):
        for sub_key, sub_value in value.items():
            if not isinstance(sub_value, (dict, list)):
                emit("G", "%s_%s" % (key, sub_key), sub_value)
    elif not isinstance(value, list):
        emit("G", key, value)
layout = data.get("layout") or {}
for size_key in ("min_lead", "min_role"):
    size = layout.get(size_key) or {}
    for axis in ("cols", "rows"):
        if axis in size:
            emit("G", "layout_%s_%s" % (size_key, axis), size[axis])
for group_index, group in enumerate(layout.get("tab_groups") or []):
    for name in group:
        emit("T", group_index, name)
for scope, pairs in (data.get("session_env") or {}).items():
    for name, value in (pairs or {}).items():
        emit("E", scope, name, value)

agents_dir = os.path.join(root_dir, data.get("agents_dir") or ".claude/agents")
agents = {}
if os.path.isdir(agents_dir):
    for file_name in sorted(os.listdir(agents_dir)):
        if not file_name.endswith(".md"):
            continue
        path = os.path.join(agents_dir, file_name)
        meta = {}
        with open(path, encoding="utf-8") as handle:
            lines = handle.read().splitlines()
        if lines and lines[0].strip() == "---":
            for line in lines[1:]:
                if line.strip() == "---":
                    break
                if ":" in line and not line[:1].isspace():
                    key, _, value = line.partition(":")
                    meta[key.strip()] = value.strip().strip("\"'")
        if not meta.get("name"):
            emit("W", path)
            continue
        agents[meta["name"]] = (meta.get("model", ""), meta.get("effort", ""), path)
overrides = {}
order = []
for role in data.get("roles") or []:
    name = role.get("name") or ""
    if name and name not in overrides:
        overrides[name] = role
        order.append(name)
order.extend(sorted(name for name in agents if name not in overrides))
for name in order:
    role = overrides.get(name, {})
    remote = role.get("remote") or {}
    model, effort, path = agents.get(name, ("", "", ""))
    emit("R", name, role.get("enabled", True) is not False, name in agents, model, effort, path,
         remote.get("ssh_secret", ""), remote.get("root", ""), "catalog" if name in overrides else "agent-file")
PY
)" || return 1

    CLAUDE_TEAM_ROLE_NAMES=()
    CLAUDE_TEAM_ROLE_ENABLED=()
    CLAUDE_TEAM_ROLE_HAS_AGENT=()
    CLAUDE_TEAM_ROLE_MODEL=()
    CLAUDE_TEAM_ROLE_EFFORT=()
    CLAUDE_TEAM_ROLE_AGENT_PATH=()
    CLAUDE_TEAM_ROLE_REMOTE_SECRET=()
    CLAUDE_TEAM_ROLE_REMOTE_ROOT=()
    CLAUDE_TEAM_ROLE_SOURCE=()
    CLAUDE_TEAM_ENV_SCOPE=()
    CLAUDE_TEAM_ENV_NAME=()
    CLAUDE_TEAM_ENV_VALUE=()
    CLAUDE_TEAM_GROUP_INDEX=()
    CLAUDE_TEAM_GROUP_ROLE=()
    while IFS=$'\t' read -r kind field_a field_b field_c field_d field_e field_f field_g field_h field_i; do
        case "$kind" in
            R)
                CLAUDE_TEAM_ROLE_NAMES+=("$field_a")
                CLAUDE_TEAM_ROLE_ENABLED+=("$field_b")
                CLAUDE_TEAM_ROLE_HAS_AGENT+=("$field_c")
                CLAUDE_TEAM_ROLE_MODEL+=("${field_d#-}")
                CLAUDE_TEAM_ROLE_EFFORT+=("${field_e#-}")
                CLAUDE_TEAM_ROLE_AGENT_PATH+=("${field_f#-}")
                CLAUDE_TEAM_ROLE_REMOTE_SECRET+=("${field_g#-}")
                CLAUDE_TEAM_ROLE_REMOTE_ROOT+=("${field_h#-}")
                CLAUDE_TEAM_ROLE_SOURCE+=("$field_i")
                ;;
            T)
                CLAUDE_TEAM_GROUP_INDEX+=("$field_a")
                CLAUDE_TEAM_GROUP_ROLE+=("$field_b")
                ;;
            E)
                CLAUDE_TEAM_ENV_SCOPE+=("$field_a")
                CLAUDE_TEAM_ENV_NAME+=("$field_b")
                CLAUDE_TEAM_ENV_VALUE+=("$field_c")
                ;;
            W) claude_team_log WARN "Agent file without a frontmatter name ignored: $field_a" ;;
            G)
                case "$field_a" in
                    guide_doc) CLAUDE_TEAM_GUIDE_DOC="$field_b" ;;
                    record_dir) CLAUDE_TEAM_RECORD_DIR="$field_b" ;;
                    agents_dir) CLAUDE_TEAM_AGENTS_DIR="$field_b" ;;
                    shared_dir) CLAUDE_TEAM_SHARED_DIR="$field_b" ;;
                    sessions_session_prefix) CLAUDE_TEAM_SESSION_PREFIX="$field_b" ;;
                    sessions_tmux_socket) CLAUDE_TEAM_SESSIONS_SOCKET="$field_b" ;;
                    sessions_kickoff_lead) CLAUDE_TEAM_SESSIONS_KICKOFF_LEAD="$field_b" ;;
                    sessions_kickoff) CLAUDE_TEAM_SESSIONS_KICKOFF="$field_b" ;;
                    team_session_name) CLAUDE_TEAM_TEAM_SESSION_NAME="$field_b" ;;
                    team_tmux_socket) CLAUDE_TEAM_TEAM_SOCKET="$field_b" ;;
                    team_teammate_mode_linux) CLAUDE_TEAM_TEAM_TEAMMATE_MODE="$field_b" ;;
                    team_kickoff) CLAUDE_TEAM_TEAM_KICKOFF="$field_b" ;;
                    remote_kickoff) CLAUDE_TEAM_REMOTE_KICKOFF="$field_b" ;;
                    remote_reconnect_seconds) CLAUDE_TEAM_REMOTE_RECONNECT_SECONDS="$field_b" ;;
                    layout_tmux_session) CLAUDE_TEAM_LAYOUT_SESSION="$field_b" ;;
                    layout_min_lead_cols) CLAUDE_TEAM_MIN_LEAD_COLS="$field_b" ;;
                    layout_min_lead_rows) CLAUDE_TEAM_MIN_LEAD_ROWS="$field_b" ;;
                    layout_min_role_cols) CLAUDE_TEAM_MIN_ROLE_COLS="$field_b" ;;
                    layout_min_role_rows) CLAUDE_TEAM_MIN_ROLE_ROWS="$field_b" ;;
                    layout_merge_groups_when_room) CLAUDE_TEAM_MERGE_GROUPS="$field_b" ;;
                    *) ;;
                esac
                ;;
            *) ;;
        esac
    done <<< "$parsed"
    for index in "${!CLAUDE_TEAM_ENV_NAME[@]}"; do
        if [ "${CLAUDE_TEAM_ENV_SCOPE[$index]}" = "all" ] && [ "${CLAUDE_TEAM_ENV_NAME[$index]}" = "CLAUDE_CODE_TASK_LIST_ID" ]; then
            CLAUDE_TEAM_TASK_LIST="${CLAUDE_TEAM_ENV_VALUE[$index]}"
        fi
    done
    if [ "$CLAUDE_TEAM_MODE" = "team" ]; then
        CLAUDE_TEAM_TMUX_SOCKET="$CLAUDE_TEAM_TEAM_SOCKET"
        CLAUDE_TEAM_OTHER_SOCKET="$CLAUDE_TEAM_SESSIONS_SOCKET"
    else
        CLAUDE_TEAM_TMUX_SOCKET="$CLAUDE_TEAM_SESSIONS_SOCKET"
        CLAUDE_TEAM_OTHER_SOCKET="$CLAUDE_TEAM_TEAM_SOCKET"
    fi
    claude_team_log OK "Catalog: $CLAUDE_TEAM_CATALOG_PATH (${#CLAUDE_TEAM_ROLE_NAMES[@]} roles from $CLAUDE_TEAM_AGENTS_DIR + catalog overrides; tmux socket $CLAUDE_TEAM_TMUX_SOCKET, session $CLAUDE_TEAM_LAYOUT_SESSION; min lead ${CLAUDE_TEAM_MIN_LEAD_COLS}x${CLAUDE_TEAM_MIN_LEAD_ROWS}, min role ${CLAUDE_TEAM_MIN_ROLE_COLS}x${CLAUDE_TEAM_MIN_ROLE_ROWS})"
    return 0
}

claude_team_role_selected() {
    local role="$1"
    if [ -z "$CLAUDE_TEAM_OPT_ROLES" ]; then
        return 0
    fi
    case ",$CLAUDE_TEAM_OPT_ROLES," in
        *",$role,"*) return 0 ;;
        *) return 1 ;;
    esac
}

# Enabled, has an agent file and is selected (the lead always is in team mode).
claude_team_role_active() {
    local index="$1"
    local role="${CLAUDE_TEAM_ROLE_NAMES[$index]}"
    [ "${CLAUDE_TEAM_ROLE_ENABLED[$index]}" = "1" ] || return 1
    [ "${CLAUDE_TEAM_ROLE_HAS_AGENT[$index]}" = "1" ] || return 1
    if claude_team_role_selected "$role"; then
        return 0
    fi
    [ "$role" = "$CLAUDE_TEAM_LEAD_ROLE" ] && [ "$CLAUDE_TEAM_MODE" = "team" ]
}

claude_team_validate_roles() {
    local index=""
    local role=""
    if [ -f "$CLAUDE_TEAM_ROOT_DIR/$CLAUDE_TEAM_GUIDE_DOC" ]; then
        claude_team_log OK "Orchestration guide (binding): $CLAUDE_TEAM_ROOT_DIR/$CLAUDE_TEAM_GUIDE_DOC"
    else
        claude_team_log WARN "Orchestration guide missing: $CLAUDE_TEAM_ROOT_DIR/$CLAUDE_TEAM_GUIDE_DOC"
    fi
    claude_team_log OK "Living record (non-binding): $CLAUDE_TEAM_ROOT_DIR/$CLAUDE_TEAM_RECORD_DIR"
    CLAUDE_TEAM_REMOTE_ANY="0"
    for index in "${!CLAUDE_TEAM_ROLE_NAMES[@]}"; do
        role="${CLAUDE_TEAM_ROLE_NAMES[$index]}"
        CLAUDE_TEAM_ROW_STATE[$index]="-"
        CLAUDE_TEAM_ROW_ACTION[$index]=""
        CLAUDE_TEAM_ROW_PID[$index]="-"
        CLAUDE_TEAM_ROW_TAB[$index]="-"
        CLAUDE_TEAM_ROW_PANE[$index]="-"
        CLAUDE_TEAM_ROW_CELLS[$index]="-"
        CLAUDE_TEAM_ROW_PANE_ID[$index]=""
        if [ "${CLAUDE_TEAM_ROLE_ENABLED[$index]}" != "1" ]; then
            CLAUDE_TEAM_ROW_STATE[$index]="disabled"
            claude_team_log SKIP "Role $role disabled in catalog"
            continue
        fi
        if [ "${CLAUDE_TEAM_ROLE_HAS_AGENT[$index]}" != "1" ]; then
            CLAUDE_TEAM_ROW_STATE[$index]="no-agent-file"
            claude_team_log WARN "Role $role skipped: no agent file with frontmatter name $role in $CLAUDE_TEAM_AGENTS_DIR"
            continue
        fi
        if ! claude_team_role_active "$index"; then
            CLAUDE_TEAM_ROW_STATE[$index]="not-selected"
            claude_team_log SKIP "Role $role not in --roles"
            continue
        fi
        if [ -n "${CLAUDE_TEAM_ROLE_REMOTE_SECRET[$index]}" ]; then
            CLAUDE_TEAM_ROW_STATE[$index]="remote"
            CLAUDE_TEAM_REMOTE_ANY="1"
            claude_team_log OK "Remote role $role (model ${CLAUDE_TEAM_ROLE_MODEL[$index]:-default}, effort ${CLAUDE_TEAM_ROLE_EFFORT[$index]:-default}): ssh <secret ${CLAUDE_TEAM_ROLE_REMOTE_SECRET[$index]}> -> tmux ${CLAUDE_TEAM_SESSIONS_SOCKET}/$(claude_team_session_name "$role") in ${CLAUDE_TEAM_ROLE_REMOTE_ROOT[$index]} (Remote Control on)"
            continue
        fi
        CLAUDE_TEAM_ROW_STATE[$index]="session"
        claude_team_log OK "Role $role: session $(claude_team_session_name "$role"), model ${CLAUDE_TEAM_ROLE_MODEL[$index]:-default}, effort ${CLAUDE_TEAM_ROLE_EFFORT[$index]:-default} (${CLAUDE_TEAM_ROLE_AGENT_PATH[$index]}; ${CLAUDE_TEAM_ROLE_SOURCE[$index]})"
    done
}

claude_team_other_roles() {
    local index=""
    local names=""
    for index in "${!CLAUDE_TEAM_ROLE_NAMES[@]}"; do
        if [ "${CLAUDE_TEAM_ROLE_NAMES[$index]}" = "$CLAUDE_TEAM_LEAD_ROLE" ] || ! claude_team_role_active "$index"; then
            continue
        fi
        names="${names:+$names, }${CLAUDE_TEAM_ROLE_NAMES[$index]}"
    done
    printf '%s' "$names"
}

claude_team_kickoff_for() {
    local role="$1"
    local session="${2:-}"
    local text=""
    if [ -z "$session" ]; then
        session="$(claude_team_session_name "$role")"
    fi
    if claude_team_role_is_remote "$role"; then
        text="$CLAUDE_TEAM_REMOTE_KICKOFF"
    elif [ "$role" = "$CLAUDE_TEAM_LEAD_ROLE" ] && [ "$CLAUDE_TEAM_MODE" = "team" ]; then
        text="$CLAUDE_TEAM_TEAM_KICKOFF"
    elif [ "$role" = "$CLAUDE_TEAM_LEAD_ROLE" ]; then
        text="$CLAUDE_TEAM_SESSIONS_KICKOFF_LEAD"
    else
        text="$CLAUDE_TEAM_SESSIONS_KICKOFF"
    fi
    text="${text//\{role\}/$role}"
    text="${text//\{session\}/$session}"
    text="${text//\{guide\}/$CLAUDE_TEAM_GUIDE_DOC}"
    text="${text//\{record\}/$CLAUDE_TEAM_RECORD_DIR}"
    text="${text//\{prefix\}/$CLAUDE_TEAM_SESSION_PREFIX}"
    text="${text//\{shared\}/$CLAUDE_TEAM_SHARED_DIR}"
    text="${text//\{agents_dir\}/$CLAUDE_TEAM_AGENTS_DIR}"
    text="${text//\{task_list\}/$CLAUDE_TEAM_TASK_LIST}"
    text="${text//\{roles\}/$(claude_team_other_roles)}"
    text="${text//\{lead\}/$(claude_team_lead_session)}"
    printf '%s' "$text"
}

claude_team_spec_env_add() {
    local index=""
    for index in "${!CLAUDE_TEAM_ENV_NAME[@]}"; do
        if [ "${CLAUDE_TEAM_ENV_SCOPE[$index]}" = "$1" ]; then
            CLAUDE_TEAM_SPEC_ENV+=("${CLAUDE_TEAM_ENV_NAME[$index]}=${CLAUDE_TEAM_ENV_VALUE[$index]}")
        fi
    done
}

claude_team_spec_env_unset() {
    local index=""
    for index in "${!CLAUDE_TEAM_ENV_NAME[@]}"; do
        if [ "${CLAUDE_TEAM_ENV_SCOPE[$index]}" = "$1" ]; then
            CLAUDE_TEAM_SPEC_UNSET+=("${CLAUDE_TEAM_ENV_NAME[$index]}")
        fi
    done
}

# What claudeteam.sh applies for a role (empty role = standalone lead):
#   CLAUDE_TEAM_SPEC_ENV   NAME=VALUE pairs to export (session_env all/lead/remote)
#   CLAUDE_TEAM_SPEC_UNSET names to remove (session_env.lead for every other role)
#   CLAUDE_TEAM_SPEC_ARGS  --effort <frontmatter> (unless given), --teammate-mode (lead)
#   CLAUDE_TEAM_SPEC_KICKOFF the expanded catalog kickoff when requested
claude_team_role_spec() {
    local role="$1"
    local with_kickoff="$2"
    local effort_given="$3"
    local session="${4:-}"
    local index=""
    CLAUDE_TEAM_SPEC_ENV=()
    CLAUDE_TEAM_SPEC_UNSET=()
    CLAUDE_TEAM_SPEC_ARGS=()
    CLAUDE_TEAM_SPEC_KICKOFF=""
    if [ -z "$role" ]; then
        claude_team_spec_env_add all
        claude_team_spec_env_add lead
        return 0
    fi
    index="$(claude_team_role_index "$role")" || index=""
    if claude_team_role_is_remote "$role"; then
        claude_team_spec_env_add remote
        claude_team_spec_env_unset lead
    elif [ "$role" = "$CLAUDE_TEAM_LEAD_ROLE" ]; then
        claude_team_spec_env_add all
        claude_team_spec_env_add lead
        CLAUDE_TEAM_SPEC_ARGS+=(--teammate-mode "$CLAUDE_TEAM_TEAM_TEAMMATE_MODE")
    else
        claude_team_spec_env_add all
        claude_team_spec_env_unset lead
    fi
    if [ "$effort_given" = "0" ] && [ -n "$index" ] && [ -n "${CLAUDE_TEAM_ROLE_EFFORT[$index]}" ]; then
        CLAUDE_TEAM_SPEC_ARGS=(--effort "${CLAUDE_TEAM_ROLE_EFFORT[$index]}" "${CLAUDE_TEAM_SPEC_ARGS[@]}")
    fi
    if [ "$with_kickoff" = "1" ]; then
        CLAUDE_TEAM_SPEC_KICKOFF="$(claude_team_kickoff_for "$role" "$session")"
    fi
}

# The pane command: claudeteam.sh --team-pane expands the kickoff and session_env
# itself, and runs the ssh loop for a remote role.
claude_team_role_command() {
    local index="$1"
    local role="${CLAUDE_TEAM_ROLE_NAMES[$index]}"
    local session=""
    local command=""
    session="$(claude_team_session_name "$role")"
    printf -v command '%q %s %q --agent %q --name %q' "$CLAUDE_TEAM_LAUNCHER_PATH" "$CLAUDE_TEAM_PANE_FLAG" "$CLAUDE_TEAM_MODE" "$role" "$session"
    if [ "$role" = "$CLAUDE_TEAM_LEAD_ROLE" ] && [ "$CLAUDE_TEAM_REMOTE_ANY" = "1" ]; then
        printf -v command '%s --remote-control %q' "$command" "$session"
    fi
    if [ -n "$CLAUDE_TEAM_OPT_ROLES" ]; then
        printf -v command '%s %s %q' "$command" "$CLAUDE_TEAM_PANE_ROLES_FLAG" "$CLAUDE_TEAM_OPT_ROLES"
    fi
    if [ "$CLAUDE_TEAM_OPT_NO_KICKOFF" = "1" ]; then
        command="$command $CLAUDE_TEAM_PANE_NO_KICKOFF_FLAG"
    fi
    printf '%s; exec bash -l' "$command"
}

# Human-readable claude line that claudeteam.sh builds for a role (plan output).
claude_team_describe_role() {
    local index="$1"
    local role="${CLAUDE_TEAM_ROLE_NAMES[$index]}"
    local session=""
    local line=""
    local with_kickoff="1"
    session="$(claude_team_session_name "$role")"
    if [ "$CLAUDE_TEAM_OPT_NO_KICKOFF" = "1" ]; then
        with_kickoff="0"
    fi
    claude_team_role_spec "$role" "$with_kickoff" "0" "$session"
    line="claude --permission-mode auto ${CLAUDE_TEAM_SPEC_ARGS[*]} --agent $role --name $session"
    if [ -n "${CLAUDE_TEAM_ROLE_REMOTE_SECRET[$index]}" ]; then
        line="ssh ${CLAUDE_TEAM_SSH_OPTIONS[*]} <secret ${CLAUDE_TEAM_ROLE_REMOTE_SECRET[$index]}> -> tmux -L $CLAUDE_TEAM_SESSIONS_SOCKET new-session -A -s $session -> $line --remote-control $session (server)"
    elif [ "$role" = "$CLAUDE_TEAM_LEAD_ROLE" ] && [ "$CLAUDE_TEAM_REMOTE_ANY" = "1" ]; then
        line="$line --remote-control $session"
    fi
    if [ -n "$CLAUDE_TEAM_SPEC_KICKOFF" ]; then
        line="$line <kickoff ${#CLAUDE_TEAM_SPEC_KICKOFF} chars>"
    fi
    printf '%s; env %s; unset %s' "$line" "${CLAUDE_TEAM_SPEC_ENV[*]:-none}" "${CLAUDE_TEAM_SPEC_UNSET[*]:-none}"
}

# Remote role, server side: the server locates core_node, runs the shared idempotent
# claude_team_install, then attaches or creates (-A: idempotent) the role's tmux
# session running claudeteam with Remote Control on, --effort and the
# session_env.remote variables, so cross-machine SendMessage reaches it (official:
# both ends need Remote Control).
claude_team_remote_command() {
    local index="$1"
    local session="$2"
    local role="${CLAUDE_TEAM_ROLE_NAMES[$index]}"
    local fallback_root="${CLAUDE_TEAM_ROLE_REMOTE_ROOT[$index]}"
    local effort="${CLAUDE_TEAM_ROLE_EFFORT[$index]}"
    local inner=""
    local quoted_kickoff=""
    local env_flags=""
    local pair=""
    local remote_cmd=""
    printf -v inner 'claudeteam --agent %q --name %q --remote-control %q' "$role" "$session" "$session"
    if [ -n "$effort" ]; then
        printf -v inner '%s --effort %q' "$inner" "$effort"
    fi
    if [ "$CLAUDE_TEAM_OPT_NO_KICKOFF" = "0" ]; then
        printf -v quoted_kickoff '%q' "$(claude_team_kickoff_for "$role" "$session")"
        inner="$inner $quoted_kickoff"
    fi
    inner="$inner; exec bash -l"
    CLAUDE_TEAM_SPEC_ENV=()
    claude_team_spec_env_add remote
    for pair in "${CLAUDE_TEAM_SPEC_ENV[@]}" "$CLAUDE_TEAM_GIT_GUARD_ENV"; do
        printf -v env_flags '%s -e %q' "$env_flags" "$pair"
    done
    # On the server: locate core_node through the linked claudeteam command (falls back
    # to the catalog root on a first run), run the shared idempotent install, then
    # attach or create the role's tmux session running claudeteam.
    printf -v remote_cmd '%s ROOT=%q; %s . "$ROOT/scripts/ai_shtools/claude_code_install.sh" && claude_team_install; tmux -L %q new-session -A -s %q -c "$ROOT"%s bash -lc %q' \
        'R="$(readlink -f "$(command -v claudeteam 2>/dev/null)" 2>/dev/null)";' "$fallback_root" \
        'if [ -n "$R" ]; then ROOT="$(cd "$(dirname "$R")/../.." && pwd)"; fi;' \
        "$CLAUDE_TEAM_SESSIONS_SOCKET" "$session" "$env_flags" "$inner"
    printf '%s' "$remote_cmd"
}

# Remote role pane (claudeteam.sh --team-pane): resolves the ssh target from the
# secret store (never printed) and keeps an ssh -t connection to the server's tmux
# session, reconnecting every remote.reconnect_seconds (Ctrl-C stops it).
claude_team_remote_loop() {
    local index="$1"
    local session="$2"
    local secret="${CLAUDE_TEAM_ROLE_REMOTE_SECRET[$index]}"
    local target=""
    local remote_argument=""
    target="$(python3 "$CLAUDE_TEAM_SECRET_READER" "$secret" 2>/dev/null | tail -n 1)"
    if [ -z "$target" ]; then
        claude_team_log ERROR "Secret $secret is empty or unreadable ($CLAUDE_TEAM_SECRET_READER); the ssh target is unknown"
        return 0
    fi
    printf -v remote_argument 'bash -lc %q' "$(claude_team_remote_command "$index" "$session")"
    while :; do
        ssh "${CLAUDE_TEAM_SSH_OPTIONS[@]}" "$target" "$remote_argument"
        echo "[remote] $session disconnected; reconnecting in ${CLAUDE_TEAM_REMOTE_RECONNECT_SECONDS}s (Ctrl-C to stop)"
        sleep "$CLAUDE_TEAM_REMOTE_RECONNECT_SECONDS"
    done
}

# Written by claudeteam.sh --team-pane before anything else (exec keeps the PID).
claude_team_pid_path() {
    printf '%s/%s.pid' "$CLAUDE_TEAM_STATE_DIR" "$1"
}

# PID of a live claude started with --name <session> by this user (any launcher):
# a live name makes a new session get a variant, so such a role is skipped.
claude_team_named_pid() {
    local session="$1"
    local pid=""
    command -v pgrep >/dev/null 2>&1 || return 1
    for pid in $(pgrep -u "$(id -u)" -f -- "--name $session" 2>/dev/null); do
        if [ -r "/proc/$pid/cmdline" ] && tr '\0' '\n' < "/proc/$pid/cmdline" | awk -v s="$session" 'prev == "--name" && $0 == s { found = 1 } { prev = $0 } END { exit !found }'; then
            printf '%s' "$pid"
            return 0
        fi
    done
    return 1
}

# A role is alive when its PID file names a live process that started before the
# file was written (a reused PID starts later), or a process runs with its --name.
claude_team_role_pid() {
    local session="$2"
    local pid_path=""
    local pid=""
    local written=""
    local elapsed=""
    local started=""
    pid_path="$(claude_team_pid_path "$session")"
    if [ -f "$pid_path" ]; then
        pid="$(head -n 1 "$pid_path" 2>/dev/null)"
        case "$pid" in
            ''|*[!0-9]*) pid="" ;;
        esac
        if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
            written="$(stat -c %Y "$pid_path" 2>/dev/null)"
            elapsed="$(ps -o etimes= -p "$pid" 2>/dev/null | tr -d ' ')"
            if [ -n "$written" ] && [ -n "$elapsed" ]; then
                started=$(($(date +%s) - elapsed))
                if [ "$started" -le $((written + 1)) ]; then
                    printf '%s' "$pid"
                    return 0
                fi
            fi
        fi
    fi
    claude_team_named_pid "$session" && return 0
    return 1
}

claude_team_pane_of_role() {
    local index=""
    for index in "${!CLAUDE_TEAM_PANE_ROLES[@]}"; do
        if [ "${CLAUDE_TEAM_PANE_ROLES[$index]}" = "$1" ]; then
            printf '%s %s' "${CLAUDE_TEAM_PANE_IDS[$index]}" "${CLAUDE_TEAM_PANE_WINDOWS[$index]}"
            return 0
        fi
    done
    return 1
}

claude_team_select_terminal() {
    CLAUDE_TEAM_TERMINAL=""
    if [ "$CLAUDE_TEAM_OPT_NO_WINDOWS" = "1" ]; then
        claude_team_log SKIP "--no-windows: no terminal is opened (attach later: $(claude_team_attach_command))"
        return 0
    fi
    cci_detect_team_terminal
    CLAUDE_TEAM_TERMINAL="$CCI_TEAM_TERMINAL"
    if [ -n "$CLAUDE_TEAM_TERMINAL" ]; then
        claude_team_log OK "Terminal: $(command -v "$CLAUDE_TEAM_TERMINAL") (one maximized window attached to tmux session $CLAUDE_TEAM_LAYOUT_SESSION)"
    elif [ "$CLAUDE_TEAM_GRAPHICAL" = "1" ]; then
        claude_team_log WARN "No supported terminal (${CCI_TEAM_TERMINALS[*]}): headless, tmux attaches in the current tty"
    else
        claude_team_log OK "Headless: tmux attaches in the current tty"
    fi
}

# Live state per role: running (PID alive, in the layout or elsewhere),
# legacy-session (a per-role tmux session of the previous launcher), idle-pane
# (its pane exists but claude is gone: respawned in place) or stopped (placed).
claude_team_scan_live() {
    local index=""
    local role=""
    local session=""
    local pid=""
    local pane_line=""
    local pane_role=""
    local pane_id=""
    local pane_window=""
    CLAUDE_TEAM_SESSION_EXISTS="0"
    CLAUDE_TEAM_SESSION_READY="0"
    CLAUDE_TEAM_CLIENTS="0"
    CLAUDE_TEAM_TAB_BASE="0"
    CLAUDE_TEAM_PANE_ROLES=()
    CLAUDE_TEAM_PANE_IDS=()
    CLAUDE_TEAM_PANE_WINDOWS=()
    if claude_team_tmux has-session -t "=$CLAUDE_TEAM_LAYOUT_SESSION" 2>/dev/null; then
        CLAUDE_TEAM_SESSION_EXISTS="1"
        CLAUDE_TEAM_SESSION_READY="1"
        CLAUDE_TEAM_CLIENTS="$(claude_team_tmux list-clients -t "=$CLAUDE_TEAM_LAYOUT_SESSION" -F '#{client_name}' 2>/dev/null | grep -c . || true)"
        CLAUDE_TEAM_TAB_BASE="$(claude_team_tmux list-windows -t "=$CLAUDE_TEAM_LAYOUT_SESSION" -F '#{window_index}' 2>/dev/null | grep -c . || true)"
        while read -r pane_role pane_id pane_window; do
            [ -n "$pane_role" ] && [ -n "$pane_window" ] || continue
            CLAUDE_TEAM_PANE_ROLES+=("$pane_role")
            CLAUDE_TEAM_PANE_IDS+=("$pane_id")
            CLAUDE_TEAM_PANE_WINDOWS+=("$pane_window")
        done < <(claude_team_tmux list-panes -s -t "=$CLAUDE_TEAM_LAYOUT_SESSION" -F "#{$CLAUDE_TEAM_PANE_ROLE_OPTION} #{pane_id} #{window_name}" 2>/dev/null)
        claude_team_log OK "tmux session $CLAUDE_TEAM_LAYOUT_SESSION (socket $CLAUDE_TEAM_TMUX_SOCKET): $CLAUDE_TEAM_TAB_BASE window(s), ${#CLAUDE_TEAM_PANE_ROLES[@]} role pane(s), $CLAUDE_TEAM_CLIENTS client(s)"
    else
        claude_team_log OK "tmux session $CLAUDE_TEAM_LAYOUT_SESSION (socket $CLAUDE_TEAM_TMUX_SOCKET): not running"
    fi
    if tmux -L "$CLAUDE_TEAM_OTHER_SOCKET" has-session -t "=$CLAUDE_TEAM_LAYOUT_SESSION" 2>/dev/null; then
        claude_team_log WARN "The other launcher's session $CLAUDE_TEAM_LAYOUT_SESSION runs on socket $CLAUDE_TEAM_OTHER_SOCKET: roles live there keep their names and are skipped here"
    fi
    for index in "${!CLAUDE_TEAM_ROLE_NAMES[@]}"; do
        case "${CLAUDE_TEAM_ROW_STATE[$index]}" in
            session|remote) ;;
            *) continue ;;
        esac
        role="${CLAUDE_TEAM_ROLE_NAMES[$index]}"
        session="$(claude_team_session_name "$role")"
        pane_line="$(claude_team_pane_of_role "$role" || true)"
        pane_id="${pane_line%% *}"
        pane_window="${pane_line#* }"
        if pid="$(claude_team_role_pid "$role" "$session")"; then
            CLAUDE_TEAM_ROW_STATE[$index]="running"
            CLAUDE_TEAM_ROW_PID[$index]="$pid"
            if [ -n "$pane_line" ]; then
                CLAUDE_TEAM_ROW_TAB[$index]="$pane_window"
                CLAUDE_TEAM_ROW_PANE[$index]="$pane_id"
                CLAUDE_TEAM_ROW_PANE_ID[$index]="$pane_id"
            else
                CLAUDE_TEAM_ROW_TAB[$index]="elsewhere"
            fi
            claude_team_log SKIP "Role $role running (PID $pid, ${CLAUDE_TEAM_ROW_TAB[$index]})"
        elif claude_team_tmux has-session -t "=$session" 2>/dev/null; then
            CLAUDE_TEAM_ROW_STATE[$index]="legacy-session"
            CLAUDE_TEAM_ROW_TAB[$index]="session $session"
            claude_team_log SKIP "Role $role runs in the per-role tmux session $session of the previous launcher; stop it to move the role into $CLAUDE_TEAM_LAYOUT_SESSION"
        elif [ -n "$pane_line" ]; then
            CLAUDE_TEAM_ROW_STATE[$index]="idle-pane"
            CLAUDE_TEAM_ROW_ACTION[$index]="respawn"
            CLAUDE_TEAM_ROW_TAB[$index]="$pane_window"
            CLAUDE_TEAM_ROW_PANE[$index]="$pane_id"
            CLAUDE_TEAM_ROW_PANE_ID[$index]="$pane_id"
            claude_team_log OK "Role $role: pane $pane_id in $pane_window has no live session; respawned in place"
        else
            CLAUDE_TEAM_ROW_STATE[$index]="stopped"
            CLAUDE_TEAM_ROW_ACTION[$index]="place"
        fi
    done
}

claude_team_client_size() {
    local line=""
    CLAUDE_TEAM_CLIENT_COLS=""
    CLAUDE_TEAM_CLIENT_ROWS=""
    [ "$CLAUDE_TEAM_SESSION_EXISTS" = "1" ] || return 1
    line="$(claude_team_tmux list-clients -t "=$CLAUDE_TEAM_LAYOUT_SESSION" -F '#{client_width} #{client_height}' 2>/dev/null | head -n 1)"
    [ -n "$line" ] || return 1
    CLAUDE_TEAM_CLIENT_COLS="${line%% *}"
    CLAUDE_TEAM_CLIENT_ROWS="${line##* }"
    [ -n "$CLAUDE_TEAM_CLIENT_COLS" ] && [ -n "$CLAUDE_TEAM_CLIENT_ROWS" ]
}

# Cell budget of one tmux window: the attached client (after attach), else the
# current tty when tmux attaches there (headless / --no-windows), else the fallback.
claude_team_measure() {
    local tty_size=""
    if claude_team_client_size; then
        CLAUDE_TEAM_BUDGET_COLS="$CLAUDE_TEAM_CLIENT_COLS"
        CLAUDE_TEAM_BUDGET_ROWS=$((CLAUDE_TEAM_CLIENT_ROWS - CLAUDE_TEAM_STATUS_LINES))
        CLAUDE_TEAM_BUDGET_SOURCE="tmux client_width x client_height ${CLAUDE_TEAM_CLIENT_COLS}x${CLAUDE_TEAM_CLIENT_ROWS}"
    elif [ -z "$CLAUDE_TEAM_TERMINAL" ] && tty_size="$(stty size < /dev/tty 2>/dev/null)" && [ -n "$tty_size" ]; then
        CLAUDE_TEAM_BUDGET_COLS="${tty_size##* }"
        CLAUDE_TEAM_BUDGET_ROWS=$((${tty_size%% *} - CLAUDE_TEAM_STATUS_LINES))
        CLAUDE_TEAM_BUDGET_SOURCE="current tty ${tty_size##* }x${tty_size%% *} (tmux attaches here)"
    else
        CLAUDE_TEAM_BUDGET_COLS="$CLAUDE_TEAM_FALLBACK_COLS"
        CLAUDE_TEAM_BUDGET_ROWS="$CLAUDE_TEAM_FALLBACK_ROWS"
        CLAUDE_TEAM_BUDGET_SOURCE="fallback estimate (no client attached yet; the real grid is chosen after attach)"
    fi
    claude_team_log OK "Cell budget per tab: ${CLAUDE_TEAM_BUDGET_COLS}x${CLAUDE_TEAM_BUDGET_ROWS} ($CLAUDE_TEAM_BUDGET_SOURCE)"
}

claude_team_terminal_argv() {
    local attach=(tmux -L "$CLAUDE_TEAM_TMUX_SOCKET" attach-session -t "=$CLAUDE_TEAM_LAYOUT_SESSION")
    CLAUDE_TEAM_TERMINAL_ARGV=()
    case "$CLAUDE_TEAM_TERMINAL" in
        ptyxis) CLAUDE_TEAM_TERMINAL_ARGV=(ptyxis --new-window --maximize -- "${attach[@]}") ;;
        gnome-terminal) CLAUDE_TEAM_TERMINAL_ARGV=(gnome-terminal --window --maximize -- "${attach[@]}") ;;
        konsole) CLAUDE_TEAM_TERMINAL_ARGV=(konsole --separate --fullscreen -e "${attach[@]}") ;;
        xterm) CLAUDE_TEAM_TERMINAL_ARGV=(xterm -maximized -title "$CLAUDE_TEAM_LAYOUT_SESSION" -e "${attach[@]}") ;;
        xfce4-terminal) CLAUDE_TEAM_TERMINAL_ARGV=(xfce4-terminal --disable-server --maximize "--title=$CLAUDE_TEAM_LAYOUT_SESSION" -x "${attach[@]}") ;;
        qterminal) CLAUDE_TEAM_TERMINAL_ARGV=(qterminal -e "${attach[*]}") ;;
        *) CLAUDE_TEAM_TERMINAL_ARGV=("$CLAUDE_TEAM_TERMINAL" -e "${attach[@]}") ;;
    esac
}

# Opens the one maximized terminal and waits until its client size is stable.
claude_team_open_terminal() {
    local waited="0"
    local previous=""
    local current=""
    local stable="0"
    claude_team_terminal_argv
    if [ "$CLAUDE_TEAM_DRY_RUN" = "1" ]; then
        claude_team_log PLAN "$(claude_team_quote_args "${CLAUDE_TEAM_TERMINAL_ARGV[@]}")"
        return 0
    fi
    env -u TMUX setsid "${CLAUDE_TEAM_TERMINAL_ARGV[@]}" >/dev/null 2>&1 < /dev/null &
    disown 2>/dev/null || true
    CLAUDE_TEAM_TERMINAL_OPENED="1"
    claude_team_log OPEN "$(claude_team_quote_args "${CLAUDE_TEAM_TERMINAL_ARGV[@]}")"
    while [ "$waited" -lt $((CLAUDE_TEAM_ATTACH_WAIT_SECONDS * 2)) ]; do
        sleep 0.5
        waited=$((waited + 1))
        if claude_team_client_size; then
            current="${CLAUDE_TEAM_CLIENT_COLS}x${CLAUDE_TEAM_CLIENT_ROWS}"
            if [ "$current" = "$previous" ]; then
                stable=$((stable + 1))
                if [ "$stable" -ge 2 ]; then
                    claude_team_log OK "Terminal attached: client ${current}"
                    return 0
                fi
            else
                stable="0"
            fi
            previous="$current"
        fi
    done
    if [ -n "$previous" ]; then
        claude_team_log OK "Terminal attached: client ${previous}"
        return 0
    fi
    claude_team_log WARN "No client attached within ${CLAUDE_TEAM_ATTACH_WAIT_SECONDS}s; attach manually: $(claude_team_attach_command)"
    return 1
}

# Placement order: the lead first, then layout.tab_groups in order; roles in no
# group are appended to the last group.
claude_team_place_order() {
    local index=""
    local group=""
    local group_count="0"
    local position=""
    local role=""
    local members=""
    local listed=" "
    CLAUDE_TEAM_PLACE_ORDER=()
    CLAUDE_TEAM_PACK_GROUPS=()
    index="$(claude_team_role_index "$CLAUDE_TEAM_LEAD_ROLE")" || index=""
    if [ -n "$index" ] && [ "${CLAUDE_TEAM_ROW_ACTION[$index]}" = "place" ]; then
        CLAUDE_TEAM_PLACE_ORDER+=("$CLAUDE_TEAM_LEAD_ROLE")
    fi
    for position in "${!CLAUDE_TEAM_GROUP_INDEX[@]}"; do
        if [ "${CLAUDE_TEAM_GROUP_INDEX[$position]}" -ge "$group_count" ]; then
            group_count=$((CLAUDE_TEAM_GROUP_INDEX[$position] + 1))
        fi
    done
    for ((group = 0; group < group_count; group++)); do
        members=""
        for position in "${!CLAUDE_TEAM_GROUP_INDEX[@]}"; do
            [ "${CLAUDE_TEAM_GROUP_INDEX[$position]}" = "$group" ] || continue
            role="${CLAUDE_TEAM_GROUP_ROLE[$position]}"
            listed="$listed$role "
            [ "$role" != "$CLAUDE_TEAM_LEAD_ROLE" ] || continue
            index="$(claude_team_role_index "$role")" || continue
            [ "${CLAUDE_TEAM_ROW_ACTION[$index]}" = "place" ] || continue
            members="${members:+$members }$role"
        done
        CLAUDE_TEAM_PACK_GROUPS+=("$members")
    done
    if [ "${#CLAUDE_TEAM_PACK_GROUPS[@]}" -eq 0 ]; then
        CLAUDE_TEAM_PACK_GROUPS+=("")
    fi
    members=""
    for index in "${!CLAUDE_TEAM_ROLE_NAMES[@]}"; do
        role="${CLAUDE_TEAM_ROLE_NAMES[$index]}"
        [ "$role" != "$CLAUDE_TEAM_LEAD_ROLE" ] || continue
        [ "${CLAUDE_TEAM_ROW_ACTION[$index]}" = "place" ] || continue
        case "$listed" in
            *" $role "*) continue ;;
        esac
        members="${members:+$members }$role"
    done
    if [ -n "$members" ]; then
        group=$((${#CLAUDE_TEAM_PACK_GROUPS[@]} - 1))
        CLAUDE_TEAM_PACK_GROUPS[$group]="${CLAUDE_TEAM_PACK_GROUPS[$group]:+${CLAUDE_TEAM_PACK_GROUPS[$group]} }$members"
        claude_team_log OK "Roles in no tab group, appended to the last group: $members"
    fi
    for group in "${CLAUDE_TEAM_PACK_GROUPS[@]}"; do
        for role in $group; do
            CLAUDE_TEAM_PLACE_ORDER+=("$role")
        done
    done
}

claude_team_new_tab() {
    local lead="$1"
    local cap="$2"
    local max_cols="$3"
    CLAUDE_TEAM_TAB_LEAD[$CLAUDE_TEAM_TAB_COUNT]="$lead"
    CLAUDE_TEAM_TAB_CAP[$CLAUDE_TEAM_TAB_COUNT]="$cap"
    CLAUDE_TEAM_TAB_MAX_COLS[$CLAUDE_TEAM_TAB_COUNT]="$max_cols"
    CLAUDE_TEAM_TAB_ROLES[$CLAUDE_TEAM_TAB_COUNT]=""
    CLAUDE_TEAM_TAB_COUNT=$((CLAUDE_TEAM_TAB_COUNT + 1))
}

claude_team_word_count() {
    local words=()
    read -r -a words <<< "$1"
    printf '%s' "${#words[@]}"
}

# Packs the groups into tabs: each tab holds as many consecutive groups as fit at
# the minimum sizes (merge_groups_when_room); a group larger than a tab is split
# over more tabs. The lead's tab gives the lead a full-height left column.
claude_team_pack() {
    local cols="$CLAUDE_TEAM_BUDGET_COLS"
    local rows="$CLAUDE_TEAM_BUDGET_ROWS"
    local cap_plain="0"
    local lead_cols_max="0"
    local cap_lead="0"
    local group=""
    local role=""
    local count="0"
    local used="0"
    local room="0"
    local tab="0"
    CLAUDE_TEAM_TAB_COUNT="0"
    CLAUDE_TEAM_TAB_LEAD=()
    CLAUDE_TEAM_TAB_CAP=()
    CLAUDE_TEAM_TAB_MAX_COLS=()
    CLAUDE_TEAM_TAB_ROLES=()
    CLAUDE_TEAM_GRID_MAX_COLS=$(((cols + 1) / (CLAUDE_TEAM_MIN_ROLE_COLS + 1)))
    CLAUDE_TEAM_GRID_MAX_ROWS=$((rows / (CLAUDE_TEAM_MIN_ROLE_ROWS + 1)))
    [ "$CLAUDE_TEAM_GRID_MAX_COLS" -ge 1 ] || CLAUDE_TEAM_GRID_MAX_COLS="1"
    [ "$CLAUDE_TEAM_GRID_MAX_ROWS" -ge 1 ] || CLAUDE_TEAM_GRID_MAX_ROWS="1"
    cap_plain=$((CLAUDE_TEAM_GRID_MAX_COLS * CLAUDE_TEAM_GRID_MAX_ROWS))
    if [ "$cols" -ge $((CLAUDE_TEAM_MIN_LEAD_COLS + 1 + CLAUDE_TEAM_MIN_ROLE_COLS)) ] && [ "$rows" -ge $((CLAUDE_TEAM_MIN_LEAD_ROWS + 1)) ]; then
        lead_cols_max=$(((cols - CLAUDE_TEAM_MIN_LEAD_COLS) / (CLAUDE_TEAM_MIN_ROLE_COLS + 1)))
        cap_lead=$((lead_cols_max * CLAUDE_TEAM_GRID_MAX_ROWS))
    fi
    if [ "${#CLAUDE_TEAM_PLACE_ORDER[@]}" -gt 0 ] && [ "${CLAUDE_TEAM_PLACE_ORDER[0]}" = "$CLAUDE_TEAM_LEAD_ROLE" ]; then
        claude_team_new_tab "1" "$cap_lead" "$lead_cols_max"
        if [ "$cols" -lt "$CLAUDE_TEAM_MIN_LEAD_COLS" ] || [ "$rows" -lt $((CLAUDE_TEAM_MIN_LEAD_ROWS + 1)) ]; then
            claude_team_log WARN "Budget ${cols}x${rows} is below min_lead ${CLAUDE_TEAM_MIN_LEAD_COLS}x${CLAUDE_TEAM_MIN_LEAD_ROWS}: the lead gets its tab alone"
        fi
    fi
    for group in "${CLAUDE_TEAM_PACK_GROUPS[@]}"; do
        count="$(claude_team_word_count "$group")"
        [ "$count" -gt 0 ] || continue
        tab=$((CLAUDE_TEAM_TAB_COUNT - 1))
        if [ "$tab" -ge 0 ]; then
            used="$(claude_team_word_count "${CLAUDE_TEAM_TAB_ROLES[$tab]}")"
            room=$((CLAUDE_TEAM_TAB_CAP[$tab] - used))
            if [ "$used" -gt 0 ] && { [ "$CLAUDE_TEAM_MERGE_GROUPS" != "1" ] || [ "$count" -gt "$room" ]; }; then
                claude_team_new_tab "0" "$cap_plain" "$CLAUDE_TEAM_GRID_MAX_COLS"
            fi
        fi
        for role in $group; do
            tab=$((CLAUDE_TEAM_TAB_COUNT - 1))
            if [ "$tab" -lt 0 ] || [ "$(claude_team_word_count "${CLAUDE_TEAM_TAB_ROLES[$tab]}")" -ge "${CLAUDE_TEAM_TAB_CAP[$tab]}" ]; then
                claude_team_new_tab "0" "$cap_plain" "$CLAUDE_TEAM_GRID_MAX_COLS"
                tab=$((CLAUDE_TEAM_TAB_COUNT - 1))
            fi
            CLAUDE_TEAM_TAB_ROLES[$tab]="${CLAUDE_TEAM_TAB_ROLES[$tab]:+${CLAUDE_TEAM_TAB_ROLES[$tab]} }$role"
        done
    done
    claude_team_log OK "Packing at min role ${CLAUDE_TEAM_MIN_ROLE_COLS}x${CLAUDE_TEAM_MIN_ROLE_ROWS}: up to ${CLAUDE_TEAM_GRID_MAX_COLS}x${CLAUDE_TEAM_GRID_MAX_ROWS} roles per tab, ${lead_cols_max}x${CLAUDE_TEAM_GRID_MAX_ROWS} beside the lead; merge groups: $CLAUDE_TEAM_MERGE_GROUPS; ${CLAUDE_TEAM_TAB_COUNT} tab(s)"
}

# Width of column j of k equal columns over <total> cells (one border between columns).
claude_team_share() {
    local total="$1"
    local parts="$2"
    local position="$3"
    local usable=$((total - (parts - 1)))
    local base=$((usable / parts))
    local extra=$((usable % parts))
    if [ "$position" -lt "$extra" ]; then
        base=$((base + 1))
    fi
    printf '%s' "$base"
}

# Content height of pane i of m stacked panes over <rows> (a title line above each).
claude_team_row_share() {
    local rows="$1"
    local parts="$2"
    local position="$3"
    local usable=$((rows - parts))
    local base=$((usable / parts))
    local extra=$((usable % parts))
    if [ "$position" -lt "$extra" ]; then
        base=$((base + 1))
    fi
    printf '%s' "$base"
}

# Chooses the equal grid of one tab: the column count that maximizes the pane area
# at no less than the minimum sizes, filled column by column.
claude_team_tab_grid() {
    local tab="$1"
    local cols="$CLAUDE_TEAM_BUDGET_COLS"
    local rows="$CLAUDE_TEAM_BUDGET_ROWS"
    local roles=()
    local count="0"
    local max_cols="${CLAUDE_TEAM_TAB_MAX_COLS[$tab]}"
    local max_rows="$CLAUDE_TEAM_GRID_MAX_ROWS"
    local columns="0"
    local grid_rows="0"
    local lead_cols="0"
    local area="0"
    local pane_cols="0"
    local pane_rows="0"
    local score="0"
    local best_score="-1"
    local best_columns="1"
    local best_lead_cols="0"
    local column="0"
    local row="0"
    local per_column="0"
    local extra="0"
    local take="0"
    local cursor="0"
    local spec=""
    local members=""
    local role=""
    local index=""
    local width="0"
    read -r -a roles <<< "${CLAUDE_TEAM_TAB_ROLES[$tab]}"
    count="${#roles[@]}"
    if [ "${CLAUDE_TEAM_TAB_LEAD[$tab]}" = "1" ]; then
        CLAUDE_TEAM_TAB_NAME[$tab]="t$((CLAUDE_TEAM_TAB_BASE + tab + 1))-$CLAUDE_TEAM_LEAD_ROLE"
    else
        CLAUDE_TEAM_TAB_NAME[$tab]="t$((CLAUDE_TEAM_TAB_BASE + tab + 1))-${roles[0]}"
    fi
    CLAUDE_TEAM_TAB_SPEC[$tab]=""
    CLAUDE_TEAM_TAB_COLUMNS[$tab]="0"
    CLAUDE_TEAM_TAB_LEAD_COLS[$tab]="$cols"
    if [ "$count" -gt 0 ]; then
        [ "$max_cols" -ge 1 ] || max_cols="1"
        for ((columns = (count + max_rows - 1) / max_rows; columns <= max_cols && columns <= count; columns++)); do
            grid_rows=$(((count + columns - 1) / columns))
            lead_cols="0"
            area="$cols"
            if [ "${CLAUDE_TEAM_TAB_LEAD[$tab]}" = "1" ]; then
                lead_cols=$(((cols - columns) / (columns + 1)))
                [ "$lead_cols" -ge "$CLAUDE_TEAM_MIN_LEAD_COLS" ] || lead_cols="$CLAUDE_TEAM_MIN_LEAD_COLS"
                area=$((cols - lead_cols - 1))
            fi
            pane_cols=$(((area + 1) / columns - 1))
            pane_rows=$((rows / grid_rows - 1))
            score=$((pane_cols * pane_rows))
            if [ "$score" -gt "$best_score" ]; then
                best_score="$score"
                best_columns="$columns"
                best_lead_cols="$lead_cols"
            fi
        done
        per_column=$((count / best_columns))
        extra=$((count % best_columns))
        cursor="0"
        area="$cols"
        if [ "${CLAUDE_TEAM_TAB_LEAD[$tab]}" = "1" ]; then
            area=$((cols - best_lead_cols - 1))
            CLAUDE_TEAM_TAB_LEAD_COLS[$tab]="$best_lead_cols"
        fi
        for ((column = 0; column < best_columns; column++)); do
            take="$per_column"
            if [ "$column" -lt "$extra" ]; then
                take=$((take + 1))
            fi
            members=""
            width="$(claude_team_share "$area" "$best_columns" "$column")"
            for ((row = 0; row < take; row++)); do
                role="${roles[$cursor]}"
                cursor=$((cursor + 1))
                members="${members:+$members,}$role"
                index="$(claude_team_role_index "$role")" || continue
                CLAUDE_TEAM_ROW_TAB[$index]="${CLAUDE_TEAM_TAB_NAME[$tab]}"
                CLAUDE_TEAM_ROW_PANE[$index]="c$((column + 1))r$((row + 1))"
                CLAUDE_TEAM_ROW_CELLS[$index]="${width}x$(claude_team_row_share "$rows" "$take" "$row")"
            done
            spec="${spec:+$spec|}$members"
        done
        CLAUDE_TEAM_TAB_SPEC[$tab]="$spec"
        CLAUDE_TEAM_TAB_COLUMNS[$tab]="$best_columns"
    fi
    if [ "${CLAUDE_TEAM_TAB_LEAD[$tab]}" = "1" ]; then
        index="$(claude_team_role_index "$CLAUDE_TEAM_LEAD_ROLE")" || index=""
        if [ -n "$index" ]; then
            CLAUDE_TEAM_ROW_TAB[$index]="${CLAUDE_TEAM_TAB_NAME[$tab]}"
            CLAUDE_TEAM_ROW_PANE[$index]="lead"
            CLAUDE_TEAM_ROW_CELLS[$index]="${CLAUDE_TEAM_TAB_LEAD_COLS[$tab]}x$((rows - 1))"
        fi
        claude_team_log OK "Tab ${CLAUDE_TEAM_TAB_NAME[$tab]}: lead $CLAUDE_TEAM_LEAD_ROLE ${CLAUDE_TEAM_TAB_LEAD_COLS[$tab]} cols full height; ${CLAUDE_TEAM_TAB_COLUMNS[$tab]} column(s): ${CLAUDE_TEAM_TAB_SPEC[$tab]:-none}"
    else
        claude_team_log OK "Tab ${CLAUDE_TEAM_TAB_NAME[$tab]}: ${CLAUDE_TEAM_TAB_COLUMNS[$tab]} column(s): ${CLAUDE_TEAM_TAB_SPEC[$tab]}"
    fi
}

# Split percentage that leaves 1/k of the target and gives the new pane (k-1)/k.
claude_team_split_percent() {
    local parts="$1"
    printf '%s' $(((200 * (parts - 1) / parts + 1) / 2))
}

claude_team_tag_pane() {
    local pane="$1"
    local role="$2"
    local index=""
    index="$(claude_team_role_index "$role")" || return 0
    CLAUDE_TEAM_ROW_PANE_ID[$index]="$pane"
    if [ "$CLAUDE_TEAM_DRY_RUN" = "1" ]; then
        CLAUDE_TEAM_ROW_STATE[$index]="planned"
        return 0
    fi
    CLAUDE_TEAM_ROW_STATE[$index]="started"
    claude_team_tmux set-option -p -t "$pane" "$CLAUDE_TEAM_PANE_ROLE_OPTION" "$role" >/dev/null 2>&1 </dev/null
    claude_team_tmux set-option -p -t "$pane" "$CLAUDE_TEAM_PANE_SESSION_OPTION" "$(claude_team_session_name "$role")" >/dev/null 2>&1 </dev/null
    if [ "$role" = "$CLAUDE_TEAM_LEAD_ROLE" ]; then
        CLAUDE_TEAM_LEAD_PANE_ID="$pane"
    fi
}

claude_team_mark_failed() {
    local role="$1"
    local index=""
    index="$(claude_team_role_index "$role")" || return 0
    CLAUDE_TEAM_ROW_STATE[$index]="split-failed"
    claude_team_log WARN "Pane for $role not created: ${CLAUDE_TEAM_LAST_ERROR:-no room}; reopened in a new tab after the build"
}

# First pane of a tab: the session itself on the first build, else a new window.
claude_team_new_role_window() {
    local name="$1"
    local role="$2"
    local index=""
    local command=""
    index="$(claude_team_role_index "$role")" || return 1
    command="$(claude_team_role_command "$index")"
    if [ "$CLAUDE_TEAM_SESSION_READY" = "0" ]; then
        claude_team_tmux_pane new-session -d -s "$CLAUDE_TEAM_LAYOUT_SESSION" -n "$name" -c "$CLAUDE_TEAM_ROOT_DIR" \
            -x "$CLAUDE_TEAM_BUDGET_COLS" -y "$CLAUDE_TEAM_BUDGET_ROWS" -P -F '#{pane_id}' bash -lc "$command" || return 1
        CLAUDE_TEAM_SESSION_READY="1"
        if [ "$CLAUDE_TEAM_DRY_RUN" = "0" ]; then
            CLAUDE_TEAM_SESSION_EXISTS="1"
        fi
    else
        claude_team_tmux_pane new-window -d -t "=$CLAUDE_TEAM_LAYOUT_SESSION:" -n "$name" -c "$CLAUDE_TEAM_ROOT_DIR" \
            -P -F '#{pane_id}' bash -lc "$command" || return 1
    fi
    claude_team_tag_pane "$CLAUDE_TEAM_LAST_PANE_ID" "$role"
    claude_team_log "$(claude_team_start_level)" "Role $role -> $name: $(claude_team_describe_role "$index")"
    return 0
}

claude_team_split_role_pane() {
    local target="$1"
    local direction="$2"
    local percent="$3"
    local role="$4"
    local index=""
    local command=""
    index="$(claude_team_role_index "$role")" || return 1
    command="$(claude_team_role_command "$index")"
    claude_team_tmux_pane split-window "$direction" -d -t "$target" -l "${percent}%" -c "$CLAUDE_TEAM_ROOT_DIR" \
        -P -F '#{pane_id}' bash -lc "$command" || return 1
    claude_team_tag_pane "$CLAUDE_TEAM_LAST_PANE_ID" "$role"
    claude_team_log "$(claude_team_start_level)" "Role $role -> split $direction ${percent}% of $target: $(claude_team_describe_role "$index")"
    return 0
}

# Builds one tab with split-window -l <pct>% (version-independent): the lead column,
# then equal columns left to right, then equal rows top to bottom in each column.
claude_team_build_tab() {
    local tab="$1"
    local name="${CLAUDE_TEAM_TAB_NAME[$tab]}"
    local columns=()
    local tops=()
    local rows=()
    local first_role=""
    local first_pane=""
    local current=""
    local column="0"
    local row="0"
    local parts="0"
    local percent="0"
    local cols="$CLAUDE_TEAM_BUDGET_COLS"
    local lead_cols="${CLAUDE_TEAM_TAB_LEAD_COLS[$tab]}"
    local role=""
    if [ -n "${CLAUDE_TEAM_TAB_SPEC[$tab]}" ]; then
        IFS='|' read -r -a columns <<< "${CLAUDE_TEAM_TAB_SPEC[$tab]}"
    fi
    if [ "${CLAUDE_TEAM_TAB_LEAD[$tab]}" = "1" ]; then
        first_role="$CLAUDE_TEAM_LEAD_ROLE"
    else
        first_role="${columns[0]%%,*}"
    fi
    if [ "$tab" = "0" ] && [ -n "$CLAUDE_TEAM_FIRST_PANE_ID" ]; then
        first_pane="$CLAUDE_TEAM_FIRST_PANE_ID"
    elif claude_team_new_role_window "$name" "$first_role"; then
        first_pane="$CLAUDE_TEAM_LAST_PANE_ID"
    else
        claude_team_log WARN "Tab $name not created: $CLAUDE_TEAM_LAST_ERROR"
        return 0
    fi
    [ "${#columns[@]}" -gt 0 ] || return 0
    if [ "${CLAUDE_TEAM_TAB_LEAD[$tab]}" = "1" ]; then
        role="${columns[0]%%,*}"
        percent=$((((cols - lead_cols - 1) * 100 + cols / 2) / cols))
        [ "$percent" -ge 1 ] || percent="1"
        [ "$percent" -le 99 ] || percent="99"
        if claude_team_split_role_pane "$first_pane" -h "$percent" "$role"; then
            tops[0]="$CLAUDE_TEAM_LAST_PANE_ID"
        else
            claude_team_mark_failed "$role"
            tops[0]=""
        fi
    else
        tops[0]="$first_pane"
    fi
    current="${tops[0]}"
    parts="${#columns[@]}"
    for ((column = 1; column < ${#columns[@]}; column++)); do
        role="${columns[$column]%%,*}"
        percent="$(claude_team_split_percent "$parts")"
        if [ -n "$current" ] && claude_team_split_role_pane "$current" -h "$percent" "$role"; then
            tops[$column]="$CLAUDE_TEAM_LAST_PANE_ID"
            current="$CLAUDE_TEAM_LAST_PANE_ID"
        else
            claude_team_mark_failed "$role"
            tops[$column]=""
        fi
        parts=$((parts - 1))
    done
    for ((column = 0; column < ${#columns[@]}; column++)); do
        IFS=',' read -r -a rows <<< "${columns[$column]}"
        current="${tops[$column]}"
        for ((row = 1; row < ${#rows[@]}; row++)); do
            parts=$((${#rows[@]} - row + 1))
            percent="$(claude_team_split_percent "$parts")"
            if [ -n "$current" ] && claude_team_split_role_pane "$current" -v "$percent" "${rows[$row]}"; then
                current="$CLAUDE_TEAM_LAST_PANE_ID"
            else
                claude_team_mark_failed "${rows[$row]}"
                current=""
            fi
        done
    done
}

claude_team_respawn_roles() {
    local index=""
    local role=""
    local command=""
    for index in "${!CLAUDE_TEAM_ROLE_NAMES[@]}"; do
        [ "${CLAUDE_TEAM_ROW_ACTION[$index]}" = "respawn" ] || continue
        role="${CLAUDE_TEAM_ROLE_NAMES[$index]}"
        command="$(claude_team_role_command "$index")"
        claude_team_tmux_do respawn-pane -k -t "${CLAUDE_TEAM_ROW_PANE_ID[$index]}" -c "$CLAUDE_TEAM_ROOT_DIR" bash -lc "$command"
        if [ "$CLAUDE_TEAM_DRY_RUN" = "1" ]; then
            CLAUDE_TEAM_ROW_STATE[$index]="planned-respawn"
        else
            CLAUDE_TEAM_ROW_STATE[$index]="respawned"
        fi
        claude_team_log "$(claude_team_start_level)" "Role $role respawned in pane ${CLAUDE_TEAM_ROW_PANE_ID[$index]}: $(claude_team_describe_role "$index")"
    done
}

claude_team_regrid_hook_command() {
    printf "run-shell -b \"bash '%s' --regrid '%s' '%s' '%s' '%s'\"" \
        "$CLAUDE_TEAM_COMMON_PATH" "$CLAUDE_TEAM_TMUX_SOCKET" "$CLAUDE_TEAM_LAYOUT_SESSION" "$CLAUDE_TEAM_LEAD_ROLE" "$CLAUDE_TEAM_MIN_LEAD_COLS"
}

# Server options per the Claude Code terminal docs (passthrough for notifications
# and progress, extended keys for Shift+Enter, mouse for wheel scrolling), role
# titles on the pane borders, and the session-scoped hooks that re-apply the grid
# (after-* hooks are session hooks; -w is ignored for them).
claude_team_apply_tmux_options() {
    local features=""
    local hook=""
    local hook_command=""
    claude_team_tmux_do set-option -s extended-keys on
    if [ "$CLAUDE_TEAM_DRY_RUN" = "0" ]; then
        features="$(claude_team_tmux show-options -sv terminal-features 2>/dev/null)"
    fi
    case "$features" in
        *extkeys*) ;;
        *) claude_team_tmux_do set-option -as terminal-features 'xterm*:extkeys' ;;
    esac
    if ! claude_team_tmux_do set-option -g allow-passthrough all; then
        claude_team_tmux_do set-option -g allow-passthrough on
    fi
    claude_team_tmux_do set-option -g mouse on
    claude_team_tmux_do set-option -g set-titles on
    claude_team_tmux_do set-option -g set-titles-string '#S: #W'
    claude_team_tmux_do set-option -g automatic-rename off
    claude_team_tmux_do set-option -g allow-rename off
    claude_team_tmux_do set-option -g pane-border-status top
    claude_team_tmux_do set-option -g pane-border-format "$CLAUDE_TEAM_PANE_BORDER_FORMAT"
    hook_command="$(claude_team_regrid_hook_command)"
    for hook in "${CLAUDE_TEAM_REGRID_HOOKS[@]}"; do
        claude_team_tmux_do set-hook -t "=$CLAUDE_TEAM_LAYOUT_SESSION" "$hook" "$hook_command"
    done
    if [ "$CLAUDE_TEAM_DRY_RUN" = "0" ]; then
        claude_team_log OK "tmux: extended-keys, terminal-features extkeys, allow-passthrough all, mouse, pane-border-status top (role titles), hooks ${CLAUDE_TEAM_REGRID_HOOKS[*]} -> regrid"
    fi
}

# Re-applies the equal grid of every window of <session>: panes are grouped into
# columns by pane_left; a single full-height lead pane in the first column keeps
# max(min lead cols, an equal share); then equal columns and equal rows through
# resize-pane (never select-layout, so the after-select-layout hook cannot loop).
claude_team_regrid() {
    local session="$1"
    local lead_role="$2"
    local lead_min="$3"
    local window=""
    local size=""
    local width="0"
    local height="0"
    local left=""
    local top=""
    local pane=""
    local role=""
    local previous_left=""
    local column="-1"
    local count="0"
    local start="0"
    local role_columns="0"
    local lead_cols="0"
    local area="0"
    local position="0"
    local target="0"
    local column_panes=()
    local column_counts=()
    local column_roles=()
    local panes=()
    while read -r window; do
        [ -n "$window" ] || continue
        size="$(claude_team_tmux display-message -p -t "$window" '#{window_width} #{window_height}' 2>/dev/null </dev/null)"
        width="${size%% *}"
        height="${size##* }"
        [ -n "$width" ] && [ -n "$height" ] || continue
        column_panes=()
        column_counts=()
        column_roles=()
        previous_left=""
        column="-1"
        while read -r left top pane role; do
            if [ "$left" != "$previous_left" ]; then
                column=$((column + 1))
                column_panes[$column]=""
                column_counts[$column]="0"
                column_roles[$column]="$role"
                previous_left="$left"
            fi
            column_panes[$column]="${column_panes[$column]:+${column_panes[$column]} }$pane"
            column_counts[$column]=$((column_counts[column] + 1))
        done < <(claude_team_tmux list-panes -t "$window" -F "#{pane_left} #{pane_top} #{pane_id} #{$CLAUDE_TEAM_PANE_ROLE_OPTION}" 2>/dev/null </dev/null | sort -k1,1n -k2,2n)
        count=$((column + 1))
        [ "$count" -ge 1 ] || continue
        start="0"
        area="$width"
        if [ "$count" -gt 1 ] && [ "${column_counts[0]}" = "1" ] && [ "${column_roles[0]}" = "$lead_role" ]; then
            role_columns=$((count - 1))
            lead_cols=$(((width - role_columns) / (role_columns + 1)))
            [ "$lead_cols" -ge "$lead_min" ] || lead_cols="$lead_min"
            [ "$lead_cols" -le $((width - 2 * role_columns)) ] || lead_cols=$((width - 2 * role_columns))
            claude_team_tmux resize-pane -t "${column_panes[0]}" -x "$lead_cols" >/dev/null 2>&1 </dev/null
            start="1"
            area=$((width - lead_cols - 1))
        fi
        for ((column = start; column < count - 1; column++)); do
            target="$(claude_team_share "$area" $((count - start)) $((column - start)))"
            [ "$target" -ge 2 ] || continue
            claude_team_tmux resize-pane -t "${column_panes[$column]%% *}" -x "$target" >/dev/null 2>&1 </dev/null
        done
        for ((column = 0; column < count; column++)); do
            read -r -a panes <<< "${column_panes[$column]}"
            [ "${#panes[@]}" -gt 1 ] || continue
            for ((position = 0; position < ${#panes[@]} - 1; position++)); do
                target="$(claude_team_row_share "$height" "${#panes[@]}" "$position")"
                if [ "$position" = "0" ]; then
                    target=$((target + 1))
                fi
                [ "$target" -ge 2 ] || continue
                claude_team_tmux resize-pane -t "${panes[$position]}" -y "$target" >/dev/null 2>&1 </dev/null
            done
        done
    done < <(claude_team_tmux list-windows -t "=$session" -F '#{window_id}' 2>/dev/null </dev/null)
}

# After the build: a placed role without a pane (a split without room) is reopened
# in a new tab; then every placed role's PID file is awaited.
claude_team_verify_roles() {
    local index=""
    local role=""
    local present=""
    local waited="0"
    local pending="1"
    local pid=""
    present="$(claude_team_tmux list-panes -s -t "=$CLAUDE_TEAM_LAYOUT_SESSION" -F "#{$CLAUDE_TEAM_PANE_ROLE_OPTION}" 2>/dev/null)"
    for index in "${!CLAUDE_TEAM_ROLE_NAMES[@]}"; do
        [ "${CLAUDE_TEAM_ROW_ACTION[$index]}" = "place" ] || continue
        role="${CLAUDE_TEAM_ROLE_NAMES[$index]}"
        if grep -qx -- "$role" <<< "$present"; then
            continue
        fi
        CLAUDE_TEAM_TAB_BASE="$(claude_team_tmux list-windows -t "=$CLAUDE_TEAM_LAYOUT_SESSION" -F '#{window_index}' 2>/dev/null | grep -c . || true)"
        if claude_team_new_role_window "t$((CLAUDE_TEAM_TAB_BASE + 1))-$role" "$role"; then
            CLAUDE_TEAM_ROW_STATE[$index]="reopened"
            CLAUDE_TEAM_ROW_TAB[$index]="t$((CLAUDE_TEAM_TAB_BASE + 1))-$role"
            CLAUDE_TEAM_ROW_PANE[$index]="c1r1"
            claude_team_log OPEN "Role $role reopened in a new tab"
        else
            CLAUDE_TEAM_ROW_STATE[$index]="failed"
            claude_team_log ERROR "Role $role could not be opened: $CLAUDE_TEAM_LAST_ERROR"
        fi
    done
    while [ "$pending" = "1" ] && [ "$waited" -le "$CLAUDE_TEAM_PID_WAIT_SECONDS" ]; do
        pending="0"
        for index in "${!CLAUDE_TEAM_ROLE_NAMES[@]}"; do
            case "${CLAUDE_TEAM_ROW_ACTION[$index]}" in
                place|respawn) ;;
                *) continue ;;
            esac
            [ "${CLAUDE_TEAM_ROW_PID[$index]}" = "-" ] || continue
            [ "${CLAUDE_TEAM_ROW_STATE[$index]}" != "failed" ] || continue
            role="${CLAUDE_TEAM_ROLE_NAMES[$index]}"
            if pid="$(claude_team_role_pid "$role" "$(claude_team_session_name "$role")")"; then
                CLAUDE_TEAM_ROW_PID[$index]="$pid"
            else
                pending="1"
            fi
        done
        if [ "$pending" = "1" ]; then
            sleep 1
            waited=$((waited + 1))
        fi
    done
    for index in "${!CLAUDE_TEAM_ROLE_NAMES[@]}"; do
        case "${CLAUDE_TEAM_ROW_ACTION[$index]}" in
            place|respawn) ;;
            *) continue ;;
        esac
        if [ "${CLAUDE_TEAM_ROW_PID[$index]}" = "-" ] && [ "${CLAUDE_TEAM_ROW_STATE[$index]}" != "failed" ]; then
            CLAUDE_TEAM_ROW_STATE[$index]="unconfirmed"
            claude_team_log WARN "Role ${CLAUDE_TEAM_ROLE_NAMES[$index]}: no PID file after ${CLAUDE_TEAM_PID_WAIT_SECONDS}s ($CLAUDE_TEAM_STATE_DIR); check pane ${CLAUDE_TEAM_ROW_PANE_ID[$index]}"
        fi
    done
}

# A remote role reaches the lead only while the lead runs with Remote Control
# (both ends need it). A lead started before any remote role was enabled lacks
# it and needs /remote-control once.
claude_team_remote_control_hint() {
    local index=""
    local pid=""
    [ "$CLAUDE_TEAM_REMOTE_ANY" = "1" ] || return 0
    index="$(claude_team_role_index "$CLAUDE_TEAM_LEAD_ROLE")" || return 0
    pid="${CLAUDE_TEAM_ROW_PID[$index]}"
    [ "$pid" != "-" ] && [ -r "/proc/$pid/cmdline" ] || return 0
    if tr '\0' '\n' < "/proc/$pid/cmdline" | grep -qx -- "--remote-control"; then
        return 0
    fi
    claude_team_log WARN "Lead $(claude_team_lead_session) runs without Remote Control, so remote roles cannot reach it: run /remote-control $(claude_team_lead_session) in the lead once"
}

claude_team_layout() {
    local index=""
    local tab="0"
    local place_count="0"
    local respawn_count="0"
    for index in "${!CLAUDE_TEAM_ROLE_NAMES[@]}"; do
        case "${CLAUDE_TEAM_ROW_ACTION[$index]}" in
            place) place_count=$((place_count + 1)) ;;
            respawn) respawn_count=$((respawn_count + 1)) ;;
            *) ;;
        esac
    done
    if [ "$CLAUDE_TEAM_OPT_STATUS" = "1" ]; then
        CLAUDE_TEAM_DRY_RUN="1"
        claude_team_log OK "--status: dry run; the plan below changes nothing"
    fi
    claude_team_place_order
    claude_team_log OK "Roles to start: $place_count (${CLAUDE_TEAM_PLACE_ORDER[*]:-none}); to respawn in place: $respawn_count"
    # Graphical: the session starts with the first role's pane, the maximized terminal
    # attaches, and the grid is chosen from the attached client's size.
    if [ -n "$CLAUDE_TEAM_TERMINAL" ] && [ "$CLAUDE_TEAM_CLIENTS" = "0" ] && [ "$CLAUDE_TEAM_DRY_RUN" = "0" ]; then
        if [ "$CLAUDE_TEAM_SESSION_EXISTS" = "0" ] && [ "$place_count" -gt 0 ]; then
            claude_team_measure
            if claude_team_new_role_window "t$((CLAUDE_TEAM_TAB_BASE + 1))-${CLAUDE_TEAM_PLACE_ORDER[0]}" "${CLAUDE_TEAM_PLACE_ORDER[0]}"; then
                CLAUDE_TEAM_FIRST_PANE_ID="$CLAUDE_TEAM_LAST_PANE_ID"
            else
                claude_team_log ERROR "tmux session $CLAUDE_TEAM_LAYOUT_SESSION not created: $CLAUDE_TEAM_LAST_ERROR"
                return 0
            fi
        fi
        if [ "$CLAUDE_TEAM_SESSION_EXISTS" = "1" ]; then
            claude_team_open_terminal || true
        fi
    fi
    if [ "$place_count" -gt 0 ]; then
        claude_team_measure
        claude_team_pack
        for ((tab = 0; tab < CLAUDE_TEAM_TAB_COUNT; tab++)); do
            claude_team_tab_grid "$tab"
        done
        for ((tab = 0; tab < CLAUDE_TEAM_TAB_COUNT; tab++)); do
            claude_team_build_tab "$tab"
        done
    elif [ "$respawn_count" = "0" ]; then
        claude_team_log SKIP "Every selected role is running; nothing to start"
    fi
    claude_team_respawn_roles
    if [ "$CLAUDE_TEAM_DRY_RUN" = "1" ] && [ -n "$CLAUDE_TEAM_TERMINAL" ] && [ "$CLAUDE_TEAM_CLIENTS" = "0" ] && \
        { [ "$CLAUDE_TEAM_SESSION_EXISTS" = "1" ] || [ "$place_count" -gt 0 ]; }; then
        claude_team_open_terminal
    fi
}

claude_team_finish() {
    if [ "$CLAUDE_TEAM_DRY_RUN" = "1" ]; then
        claude_team_apply_tmux_options
        claude_team_log PLAN "regrid: bash $CLAUDE_TEAM_COMMON_PATH --regrid $CLAUDE_TEAM_TMUX_SOCKET $CLAUDE_TEAM_LAYOUT_SESSION $CLAUDE_TEAM_LEAD_ROLE $CLAUDE_TEAM_MIN_LEAD_COLS (resize-pane per column and row)"
        return 0
    fi
    if [ "$CLAUDE_TEAM_SESSION_EXISTS" = "0" ]; then
        return 0
    fi
    claude_team_apply_tmux_options
    claude_team_verify_roles
    claude_team_regrid "$CLAUDE_TEAM_LAYOUT_SESSION" "$CLAUDE_TEAM_LEAD_ROLE" "$CLAUDE_TEAM_MIN_LEAD_COLS"
    claude_team_log OK "Grid applied (resize-pane per column and row)"
    if [ -n "$CLAUDE_TEAM_LEAD_PANE_ID" ]; then
        claude_team_tmux select-window -t "$CLAUDE_TEAM_LEAD_PANE_ID" >/dev/null 2>&1 </dev/null
        claude_team_tmux select-pane -t "$CLAUDE_TEAM_LEAD_PANE_ID" >/dev/null 2>&1 </dev/null
    fi
    claude_team_remote_control_hint
}

claude_team_print_shared_data() {
    local team_dir=""
    claude_team_log OK "Shared project data: $CLAUDE_TEAM_ROOT_DIR/$CLAUDE_TEAM_SHARED_DIR (files by path; git grant file git_grant.json)"
    claude_team_log OK "Handoff reports: $CLAUDE_TEAM_ROOT_DIR/$CLAUDE_TEAM_SHARED_DIR/reports ; reviewer verdicts: $CLAUDE_TEAM_ROOT_DIR/$CLAUDE_TEAM_SHARED_DIR/reviews ; role memory: $CLAUDE_TEAM_ROOT_DIR/.claude/agent-memory"
    claude_team_log OK "Shared task list: $CLAUDE_TEAM_TASK_LIST ($CLAUDE_TEAM_USER_TASKS_DIR/$CLAUDE_TEAM_TASK_LIST); ad-hoc agent teams of the lead: $CLAUDE_TEAM_USER_TEAMS_DIR/<team>/"
    for team_dir in $(ls -1dt "$CLAUDE_TEAM_USER_TEAMS_DIR"/session-* 2>/dev/null | head -n 3); do
        claude_team_log OK "  live team dir: $team_dir"
    done
    claude_team_log OK "Messaging: sessions discover each other with ListAgents and talk with SendMessage by --name (/list-agents shows the roster)"
    claude_team_log OK "Dispatch: type one task in the $(claude_team_lead_session) pane; it dispatches to ${CLAUDE_TEAM_SESSION_PREFIX}<role> sessions; ad-hoc teammates split the lead's tab (--teammate-mode $CLAUDE_TEAM_TEAM_TEAMMATE_MODE)"
    claude_team_log OK "Git: read-only git/gh always allowed; other git/gh commands need a user prompt asking for git work (120 min grant; deny-git revokes)"
}

claude_team_print_report() {
    local index=""
    local role=""
    local row_format="  %-19s %-21s %-24s %-9s %-8s %-8s %s\n"
    printf '\n'
    printf "$row_format" "ROLE" "SESSION" "TAB" "PANE" "PID" "CELLS" "STATE"
    for index in "${!CLAUDE_TEAM_ROLE_NAMES[@]}"; do
        role="${CLAUDE_TEAM_ROLE_NAMES[$index]}"
        printf "$row_format" "$role" "$(claude_team_session_name "$role")" \
            "${CLAUDE_TEAM_ROW_TAB[$index]}" "${CLAUDE_TEAM_ROW_PANE[$index]}" \
            "${CLAUDE_TEAM_ROW_PID[$index]}" "${CLAUDE_TEAM_ROW_CELLS[$index]}" \
            "${CLAUDE_TEAM_ROW_STATE[$index]}"
    done
    printf '\n'
    claude_team_log OK "Cell budget: ${CLAUDE_TEAM_BUDGET_COLS:-?}x${CLAUDE_TEAM_BUDGET_ROWS:-?} (${CLAUDE_TEAM_BUDGET_SOURCE:-not measured}); PID files: $CLAUDE_TEAM_STATE_DIR"
    claude_team_log OK "Attach: $(claude_team_attach_command) ; list: tmux -L $CLAUDE_TEAM_TMUX_SOCKET list-panes -s -t $CLAUDE_TEAM_LAYOUT_SESSION"
    claude_team_print_shared_data
    claude_team_log OK "Re-run is idempotent: live roles are skipped, idle role panes respawn in place, missing roles open in a new tab"
}

# Headless: tmux attaches in the current tty once the summary is printed.
claude_team_attach_here() {
    if [ "$CLAUDE_TEAM_DRY_RUN" = "1" ] || [ "$CLAUDE_TEAM_OPT_NO_WINDOWS" = "1" ] || [ -n "$CLAUDE_TEAM_TERMINAL" ]; then
        return 0
    fi
    [ "$CLAUDE_TEAM_SESSION_EXISTS" = "1" ] || return 0
    if [ -n "${TMUX:-}" ] || [ ! -t 0 ] || [ ! -t 1 ]; then
        claude_team_log OK "Attach from a terminal outside tmux: $(claude_team_attach_command)"
        return 0
    fi
    claude_team_log OPEN "Attaching in the current tty: $(claude_team_attach_command)"
    exec tmux -L "$CLAUDE_TEAM_TMUX_SOCKET" attach-session -t "=$CLAUDE_TEAM_LAYOUT_SESSION"
}

claude_team_run() {
    claude_team_step 1 "Platform profile"
    claude_team_detect_platform
    claude_team_step 2 "Team setup, item by item (shared claude_team_install, same as dd.sh step 171)"
    claude_team_install_items
    claude_team_step 3 "Claude Code CLI (shared ai_cli_provision)"
    claude_team_ensure_claude
    claude_team_step 4 "Roles (.claude/agents frontmatter + catalog overrides), orchestration docs"
    claude_team_load_catalog || return 0
    claude_team_validate_roles
    claude_team_step 5 "Entry command"
    claude_team_log OK "$CLAUDE_TEAM_ENTRY_COMMAND -> $(readlink -f "$CLAUDE_TEAM_BIN_DIR/$CLAUDE_TEAM_ENTRY_COMMAND" 2>/dev/null || printf 'not linked')"
    claude_team_step 6 "Terminal and live roles (PID files, tmux session $CLAUDE_TEAM_LAYOUT_SESSION)"
    claude_team_select_terminal
    claude_team_scan_live
    claude_team_step 7 "Layout (tabs packed from layout.tab_groups, explicit -l % grid, mode $CLAUDE_TEAM_MODE)"
    claude_team_layout
    claude_team_step 8 "tmux options, regrid hooks, verification"
    claude_team_finish
    claude_team_step 9 "Summary"
    claude_team_print_report
    claude_team_attach_here
}

if [ "${BASH_SOURCE[0]}" = "$0" ] && [ "${1:-}" = "--regrid" ]; then
    CLAUDE_TEAM_TMUX_SOCKET="${2:-$CLAUDE_TEAM_SESSIONS_SOCKET}"
    claude_team_regrid "${3:-$CLAUDE_TEAM_LAYOUT_SESSION}" "${4:-$CLAUDE_TEAM_LEAD_ROLE}" "${5:-$CLAUDE_TEAM_MIN_LEAD_COLS}"
fi
