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
# Shared idempotent Claude multi-role orchestration (Linux / bash)
# =============================================================================
# Used by scripts/linuxenvs/claudeteamup.sh (mode "sessions") and
# scripts/linuxenvs/claudeagents.sh (mode "team"). Windows counterpart:
#   scripts/shells/win/win_common/ClaudeTeamCommon.ps1
# Catalog: config/claude_team_roles.json. Role prompts: .claude/agents/*.md.
#   sessions: one tmux session <prefix><role> per role (socket -L <sessions.tmux_socket>);
#             roles coordinate through cross-session messaging (ListAgents/SendMessage).
#   team:     one lead session <team.session_name> (socket -L <team.tmux_socket>) in
#             agent-teams mode; the lead spawns the other roles as teammates in tmux
#             split panes and coordinates them through the shared task list and mailbox.
# Every session runs scripts/linuxenvs/claudeteam.sh (auto permission mode, git guard).
# An existing session is skipped; a window opens only for a session without a client.
# =============================================================================

CLAUDE_TEAM_COMMON_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLAUDE_TEAM_ROOT_DIR="$(cd "$CLAUDE_TEAM_COMMON_DIR/../../../.." && pwd)"
CLAUDE_TEAM_CATALOG_PATH="$CLAUDE_TEAM_ROOT_DIR/config/claude_team_roles.json"
CLAUDE_TEAM_LAUNCHER_PATH="$CLAUDE_TEAM_ROOT_DIR/scripts/linuxenvs/claudeteam.sh"
CLAUDE_TEAM_AI_CLI_LIB="$CLAUDE_TEAM_COMMON_DIR/ai_cli_provision_common.sh"
CLAUDE_TEAM_CLAUDE_INSTALL_LIB="$CLAUDE_TEAM_ROOT_DIR/scripts/ai_shtools/claude_code_install.sh"
. "$CLAUDE_TEAM_CLAUDE_INSTALL_LIB"
CLAUDE_TEAM_BIN_DIR="/usr/local/bin"
CLAUDE_TEAM_TOTAL_STEPS="9"
CLAUDE_TEAM_ATTACH_WAIT_SECONDS="6"
CLAUDE_TEAM_LEAD_ROLE="orchestrator"
CLAUDE_TEAM_GIT_GUARD_ENV="CLAUDE_AGENTS_GIT_GUARD=1"
CLAUDE_TEAM_AGENT_TEAMS_ENV="CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1"
CLAUDE_TEAM_USER_TEAMS_DIR="$HOME/.claude/teams"
CLAUDE_TEAM_USER_TASKS_DIR="$HOME/.claude/tasks"
CLAUDE_TEAM_GEOMETRY_EMULATORS=("${CCI_GEOMETRY_EMULATORS[@]}")
CLAUDE_TEAM_UNPOSITIONED_EMULATORS=("gnome-terminal" "ptyxis" "qterminal" "x-terminal-emulator")

CLAUDE_TEAM_MODE="sessions"
CLAUDE_TEAM_ENTRY_PATH=""
CLAUDE_TEAM_ENTRY_COMMAND=""
CLAUDE_TEAM_OPT_STATUS="0"
CLAUDE_TEAM_OPT_NO_WINDOWS="0"
CLAUDE_TEAM_OPT_NO_KICKOFF="0"
CLAUDE_TEAM_OPT_ROLES=""
CLAUDE_TEAM_ROLE_LAUNCH_FOR_REPORT="1"

CLAUDE_TEAM_OS_ID=""
CLAUDE_TEAM_OS_VERSION=""
CLAUDE_TEAM_OS_NAME=""
CLAUDE_TEAM_SESSION_TYPE=""
CLAUDE_TEAM_GRAPHICAL="0"
CLAUDE_TEAM_IS_WAYLAND="0"

CLAUDE_TEAM_PERMISSION_MODE="auto"
CLAUDE_TEAM_REQUIREMENTS_DOC=""
CLAUDE_TEAM_TASK_BOARD=""
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
CLAUDE_TEAM_TMUX_SOCKET=""
CLAUDE_TEAM_GRID_COLUMNS="4"
CLAUDE_TEAM_GRID_ROWS="2"
CLAUDE_TEAM_GRID_TOP_OFFSET="32"
CLAUDE_TEAM_GRID_CHROME_W="16"
CLAUDE_TEAM_GRID_CHROME_H="60"
CLAUDE_TEAM_GRID_CHAR_W="9"
CLAUDE_TEAM_GRID_CHAR_H="19"
CLAUDE_TEAM_FALLBACK_SCREEN_W="1920"
CLAUDE_TEAM_FALLBACK_SCREEN_H="1080"

CLAUDE_TEAM_SCREEN_X="0"
CLAUDE_TEAM_SCREEN_Y="0"
CLAUDE_TEAM_SCREEN_W=""
CLAUDE_TEAM_SCREEN_H=""
CLAUDE_TEAM_SCREEN_SOURCE=""
CLAUDE_TEAM_EMULATOR=""
CLAUDE_TEAM_EMULATOR_POSITIONED="0"
CLAUDE_TEAM_EMULATOR_ENV=()
CLAUDE_TEAM_WINDOW_ARGV=()

CLAUDE_TEAM_ROLE_NAMES=()
CLAUDE_TEAM_ROLE_SLOTS=()
CLAUDE_TEAM_ROLE_ENABLED=()
CLAUDE_TEAM_ROLE_LAUNCH=()
CLAUDE_TEAM_ROW_SESSION_STATE=()
CLAUDE_TEAM_ROW_WINDOW_STATE=()
CLAUDE_TEAM_ROW_PIXELS=()
CLAUDE_TEAM_ROW_TERMINAL=()

CLAUDE_TEAM_CELL_X="0"
CLAUDE_TEAM_CELL_Y="0"
CLAUDE_TEAM_CELL_W="0"
CLAUDE_TEAM_CELL_H="0"
CLAUDE_TEAM_CELL_COLS="0"
CLAUDE_TEAM_CELL_ROWS="0"

claude_team_step() {
    printf '\n\033[36m[STEP %s/%s] %s\033[0m\n' "$1" "$CLAUDE_TEAM_TOTAL_STEPS" "$2"
}

claude_team_log() {
    local level="$1"
    local color="0"
    shift
    case "$level" in
        OK|SKIP) color="32" ;;
        INSTALL|START|OPEN|LINK) color="33" ;;
        WARN) color="35" ;;
        ERROR) color="31" ;;
        *) color="0" ;;
    esac
    printf '  \033[%sm[%s]\033[0m %s\n' "$color" "$level" "$*"
}

claude_team_tmux() {
    tmux -L "$CLAUDE_TEAM_TMUX_SOCKET" "$@"
}

claude_team_session_name() {
    if [ "$CLAUDE_TEAM_MODE" = "team" ]; then
        if [ "$1" = "$CLAUDE_TEAM_LEAD_ROLE" ]; then
            printf '%s' "$CLAUDE_TEAM_TEAM_SESSION_NAME"
        else
            printf 'teammate:%s' "$1"
        fi
        return 0
    fi
    printf '%s%s' "$CLAUDE_TEAM_SESSION_PREFIX" "$1"
}

claude_team_attach_command() {
    if [ "${CLAUDE_TEAM_ROLE_LAUNCH_FOR_REPORT:-1}" = "0" ]; then
        printf 'pane in %s window' "$CLAUDE_TEAM_TEAM_SESSION_NAME"
        return 0
    fi
    printf 'tmux -L %s attach-session -t %s' "$CLAUDE_TEAM_TMUX_SOCKET" "$(claude_team_session_name "$1")"
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
    case "$CLAUDE_TEAM_OS_ID" in
        debian|ubuntu|kali) claude_team_log OK "Supported distro profile: $CLAUDE_TEAM_OS_ID $CLAUDE_TEAM_OS_VERSION" ;;
        *) claude_team_log WARN "Untested distro profile: $CLAUDE_TEAM_OS_ID $CLAUDE_TEAM_OS_VERSION (apt path assumed)" ;;
    esac
    claude_team_log OK "OS: $CLAUDE_TEAM_OS_NAME"
    claude_team_log OK "User: $(id -un) (uid $(id -u)); session: $CLAUDE_TEAM_SESSION_TYPE; DISPLAY=${DISPLAY:-<none>}; WAYLAND_DISPLAY=${WAYLAND_DISPLAY:-<none>}"
    claude_team_log OK "Mode: $CLAUDE_TEAM_MODE; project root: $CLAUDE_TEAM_ROOT_DIR"
    if [ "$CLAUDE_TEAM_GRAPHICAL" = "0" ]; then
        claude_team_log WARN "No graphical display: windows are skipped, attach commands are printed instead"
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
    claude_team_log OK "Role launcher: $CLAUDE_TEAM_LAUNCHER_PATH (--permission-mode auto, git guard on)"
}

claude_team_load_catalog() {
    local parsed=""
    local kind=""
    local field_a=""
    local field_b=""
    local field_c=""
    if [ ! -f "$CLAUDE_TEAM_CATALOG_PATH" ]; then
        claude_team_log ERROR "Role catalog missing: $CLAUDE_TEAM_CATALOG_PATH"
        return 1
    fi
    parsed="$(python3 - "$CLAUDE_TEAM_CATALOG_PATH" <<'PY'
import json
import sys

with open(sys.argv[1], encoding="utf-8") as handle:
    data = json.load(handle)


def emit(key, value):
    text = str(value).replace("\t", " ").replace("\n", " ")
    print("G\t%s\t%s\t" % (key, text))


for key, value in data.items():
    if isinstance(value, dict):
        for sub_key, sub_value in value.items():
            emit("%s_%s" % (key, sub_key), sub_value)
    elif not isinstance(value, list):
        emit(key, value)
for index, role in enumerate(data.get("roles", [])):
    print("R\t%d\t%s\t%s" % (index, role.get("name", ""), "1" if role.get("enabled", True) else "0"))
PY
)" || return 1

    CLAUDE_TEAM_ROLE_NAMES=()
    CLAUDE_TEAM_ROLE_SLOTS=()
    CLAUDE_TEAM_ROLE_ENABLED=()
    while IFS=$'\t' read -r kind field_a field_b field_c; do
        if [ "$kind" = "R" ]; then
            CLAUDE_TEAM_ROLE_SLOTS+=("$field_a")
            CLAUDE_TEAM_ROLE_NAMES+=("$field_b")
            CLAUDE_TEAM_ROLE_ENABLED+=("$field_c")
            continue
        fi
        case "$field_a" in
            permission_mode) CLAUDE_TEAM_PERMISSION_MODE="$field_b" ;;
            requirements_doc) CLAUDE_TEAM_REQUIREMENTS_DOC="$field_b" ;;
            task_board) CLAUDE_TEAM_TASK_BOARD="$field_b" ;;
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
            grid_columns) CLAUDE_TEAM_GRID_COLUMNS="$field_b" ;;
            grid_rows) CLAUDE_TEAM_GRID_ROWS="$field_b" ;;
            grid_top_offset_px) CLAUDE_TEAM_GRID_TOP_OFFSET="$field_b" ;;
            grid_chrome_width_px) CLAUDE_TEAM_GRID_CHROME_W="$field_b" ;;
            grid_chrome_height_px) CLAUDE_TEAM_GRID_CHROME_H="$field_b" ;;
            grid_char_width_px) CLAUDE_TEAM_GRID_CHAR_W="$field_b" ;;
            grid_char_height_px) CLAUDE_TEAM_GRID_CHAR_H="$field_b" ;;
            grid_fallback_screen_width) CLAUDE_TEAM_FALLBACK_SCREEN_W="$field_b" ;;
            grid_fallback_screen_height) CLAUDE_TEAM_FALLBACK_SCREEN_H="$field_b" ;;
            *) ;;
        esac
    done <<< "$parsed"
    if [ "$CLAUDE_TEAM_MODE" = "team" ]; then
        CLAUDE_TEAM_TMUX_SOCKET="$CLAUDE_TEAM_TEAM_SOCKET"
        CLAUDE_TEAM_GRID_COLUMNS="1"
        CLAUDE_TEAM_GRID_ROWS="1"
    else
        CLAUDE_TEAM_TMUX_SOCKET="$CLAUDE_TEAM_SESSIONS_SOCKET"
    fi
    claude_team_log OK "Catalog: $CLAUDE_TEAM_CATALOG_PATH (${#CLAUDE_TEAM_ROLE_NAMES[@]} roles, permission mode $CLAUDE_TEAM_PERMISSION_MODE, tmux socket $CLAUDE_TEAM_TMUX_SOCKET, grid ${CLAUDE_TEAM_GRID_COLUMNS}x${CLAUDE_TEAM_GRID_ROWS})"
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

claude_team_validate_roles() {
    local index=""
    local role=""
    local agent_path=""
    local doc_path=""
    for doc_path in "$CLAUDE_TEAM_REQUIREMENTS_DOC" "$CLAUDE_TEAM_TASK_BOARD"; do
        if [ -f "$CLAUDE_TEAM_ROOT_DIR/$doc_path" ]; then
            claude_team_log OK "Orchestration doc: $CLAUDE_TEAM_ROOT_DIR/$doc_path"
        else
            claude_team_log WARN "Orchestration doc missing: $CLAUDE_TEAM_ROOT_DIR/$doc_path"
        fi
    done
    for index in "${!CLAUDE_TEAM_ROLE_NAMES[@]}"; do
        role="${CLAUDE_TEAM_ROLE_NAMES[$index]}"
        agent_path="$CLAUDE_TEAM_ROOT_DIR/$CLAUDE_TEAM_AGENTS_DIR/$role.md"
        CLAUDE_TEAM_ROLE_LAUNCH[$index]="0"
        CLAUDE_TEAM_ROW_SESSION_STATE[$index]="-"
        CLAUDE_TEAM_ROW_WINDOW_STATE[$index]="-"
        CLAUDE_TEAM_ROW_PIXELS[$index]="-"
        CLAUDE_TEAM_ROW_TERMINAL[$index]="-"
        if [ "${CLAUDE_TEAM_ROLE_ENABLED[$index]}" != "1" ]; then
            CLAUDE_TEAM_ROW_SESSION_STATE[$index]="disabled"
            claude_team_log SKIP "Role $role disabled in catalog"
            continue
        fi
        if ! claude_team_role_selected "$role" && [ "$role" != "$CLAUDE_TEAM_LEAD_ROLE" -o "$CLAUDE_TEAM_MODE" = "sessions" ]; then
            CLAUDE_TEAM_ROLE_ENABLED[$index]="0"
            CLAUDE_TEAM_ROW_SESSION_STATE[$index]="not-selected"
            claude_team_log SKIP "Role $role not in --roles"
            continue
        fi
        if [ ! -f "$agent_path" ]; then
            CLAUDE_TEAM_ROLE_ENABLED[$index]="0"
            CLAUDE_TEAM_ROW_SESSION_STATE[$index]="no-agent-file"
            claude_team_log WARN "Role $role disabled: agent file missing $agent_path"
            continue
        fi
        if [ "$CLAUDE_TEAM_MODE" = "team" ] && [ "$role" != "$CLAUDE_TEAM_LEAD_ROLE" ]; then
            CLAUDE_TEAM_ROW_SESSION_STATE[$index]="teammate"
            CLAUDE_TEAM_ROW_WINDOW_STATE[$index]="lead-pane"
            claude_team_log OK "Teammate type $role (spawned by the lead on demand): $agent_path"
            continue
        fi
        CLAUDE_TEAM_ROLE_LAUNCH[$index]="1"
        claude_team_log OK "Session role $role (slot $((CLAUDE_TEAM_ROLE_SLOTS[$index] + 1))): $agent_path"
    done
}

claude_team_detect_screen() {
    local geometry=""
    CLAUDE_TEAM_SCREEN_W="$CLAUDE_TEAM_FALLBACK_SCREEN_W"
    CLAUDE_TEAM_SCREEN_H="$CLAUDE_TEAM_FALLBACK_SCREEN_H"
    CLAUDE_TEAM_SCREEN_SOURCE="catalog fallback"
    if [ "$CLAUDE_TEAM_GRAPHICAL" = "1" ] && command -v xrandr >/dev/null 2>&1; then
        geometry="$(xrandr --current 2>/dev/null | awk '/ connected primary [0-9]+x[0-9]+\+/ { for (i = 1; i <= NF; i++) if ($i ~ /^[0-9]+x[0-9]+\+[0-9]+\+[0-9]+$/) { print $i; exit } }')"
        if [ -z "$geometry" ]; then
            geometry="$(xrandr --current 2>/dev/null | awk '/ connected / { for (i = 1; i <= NF; i++) if ($i ~ /^[0-9]+x[0-9]+\+[0-9]+\+[0-9]+$/) { print $i; exit } }')"
        fi
    fi
    if [[ "$geometry" =~ ^([0-9]+)x([0-9]+)\+([0-9]+)\+([0-9]+)$ ]]; then
        CLAUDE_TEAM_SCREEN_W="${BASH_REMATCH[1]}"
        CLAUDE_TEAM_SCREEN_H="${BASH_REMATCH[2]}"
        CLAUDE_TEAM_SCREEN_X="${BASH_REMATCH[3]}"
        CLAUDE_TEAM_SCREEN_Y="${BASH_REMATCH[4]}"
        CLAUDE_TEAM_SCREEN_SOURCE="xrandr primary output"
    fi
    claude_team_log OK "Screen: ${CLAUDE_TEAM_SCREEN_W}x${CLAUDE_TEAM_SCREEN_H}+${CLAUDE_TEAM_SCREEN_X}+${CLAUDE_TEAM_SCREEN_Y} ($CLAUDE_TEAM_SCREEN_SOURCE)"
}

claude_team_select_emulator() {
    local emulator=""
    CLAUDE_TEAM_EMULATOR=""
    CLAUDE_TEAM_EMULATOR_POSITIONED="0"
    CLAUDE_TEAM_EMULATOR_ENV=()
    if [ "$CLAUDE_TEAM_GRAPHICAL" = "0" ] || [ "$CLAUDE_TEAM_OPT_NO_WINDOWS" = "1" ]; then
        claude_team_log SKIP "Windows disabled (no display or --no-windows)"
        return 0
    fi
    for emulator in "${CLAUDE_TEAM_GEOMETRY_EMULATORS[@]}"; do
        if command -v "$emulator" >/dev/null 2>&1; then
            CLAUDE_TEAM_EMULATOR="$emulator"
            CLAUDE_TEAM_EMULATOR_POSITIONED="1"
            break
        fi
    done
    if [ -z "$CLAUDE_TEAM_EMULATOR" ]; then
        for emulator in "${CLAUDE_TEAM_UNPOSITIONED_EMULATORS[@]}"; do
            if command -v "$emulator" >/dev/null 2>&1; then
                CLAUDE_TEAM_EMULATOR="$emulator"
                break
            fi
        done
    fi
    if [ -z "$CLAUDE_TEAM_EMULATOR" ]; then
        claude_team_log WARN "No terminal emulator found; attach commands are printed instead"
        return 0
    fi
    if [ "$CLAUDE_TEAM_IS_WAYLAND" = "1" ]; then
        case "$CLAUDE_TEAM_EMULATOR" in
            xfce4-terminal) CLAUDE_TEAM_EMULATOR_ENV=("GDK_BACKEND=x11") ;;
            konsole) CLAUDE_TEAM_EMULATOR_ENV=("QT_QPA_PLATFORM=xcb") ;;
            *) ;;
        esac
    fi
    if [ "$CLAUDE_TEAM_EMULATOR_POSITIONED" = "1" ]; then
        claude_team_log OK "Terminal: $(command -v "$CLAUDE_TEAM_EMULATOR") (positioned via --geometry; env: ${CLAUDE_TEAM_EMULATOR_ENV[*]:-none})"
    else
        claude_team_log WARN "Terminal: $(command -v "$CLAUDE_TEAM_EMULATOR") (native Wayland/no geometry flag: windows open unpositioned)"
    fi
}

claude_team_cell_geometry() {
    local slot="$1"
    local column=0
    local row=0
    local usable_h=0
    column=$((slot % CLAUDE_TEAM_GRID_COLUMNS))
    row=$(((slot / CLAUDE_TEAM_GRID_COLUMNS) % CLAUDE_TEAM_GRID_ROWS))
    usable_h=$((CLAUDE_TEAM_SCREEN_H - CLAUDE_TEAM_GRID_TOP_OFFSET))
    CLAUDE_TEAM_CELL_W=$((CLAUDE_TEAM_SCREEN_W / CLAUDE_TEAM_GRID_COLUMNS))
    CLAUDE_TEAM_CELL_H=$((usable_h / CLAUDE_TEAM_GRID_ROWS))
    CLAUDE_TEAM_CELL_X=$((CLAUDE_TEAM_SCREEN_X + column * CLAUDE_TEAM_CELL_W))
    CLAUDE_TEAM_CELL_Y=$((CLAUDE_TEAM_SCREEN_Y + CLAUDE_TEAM_GRID_TOP_OFFSET + row * CLAUDE_TEAM_CELL_H))
    CLAUDE_TEAM_CELL_COLS=$(((CLAUDE_TEAM_CELL_W - CLAUDE_TEAM_GRID_CHROME_W) / CLAUDE_TEAM_GRID_CHAR_W))
    CLAUDE_TEAM_CELL_ROWS=$(((CLAUDE_TEAM_CELL_H - CLAUDE_TEAM_GRID_CHROME_H) / CLAUDE_TEAM_GRID_CHAR_H))
    if [ "$CLAUDE_TEAM_CELL_COLS" -lt 40 ]; then
        CLAUDE_TEAM_CELL_COLS=40
    fi
    if [ "$CLAUDE_TEAM_CELL_ROWS" -lt 10 ]; then
        CLAUDE_TEAM_CELL_ROWS=10
    fi
}

claude_team_other_roles() {
    local index=""
    local names=""
    for index in "${!CLAUDE_TEAM_ROLE_NAMES[@]}"; do
        if [ "${CLAUDE_TEAM_ROLE_NAMES[$index]}" = "$CLAUDE_TEAM_LEAD_ROLE" ] || [ "${CLAUDE_TEAM_ROLE_ENABLED[$index]}" != "1" ]; then
            continue
        fi
        names="${names:+$names, }${CLAUDE_TEAM_ROLE_NAMES[$index]}"
    done
    printf '%s' "$names"
}

claude_team_kickoff_for() {
    local role="$1"
    local text=""
    if [ "$CLAUDE_TEAM_MODE" = "team" ]; then
        text="$CLAUDE_TEAM_TEAM_KICKOFF"
    elif [ "$role" = "$CLAUDE_TEAM_LEAD_ROLE" ]; then
        text="$CLAUDE_TEAM_SESSIONS_KICKOFF_LEAD"
    else
        text="$CLAUDE_TEAM_SESSIONS_KICKOFF"
    fi
    text="${text//\{role\}/$role}"
    text="${text//\{session\}/$(claude_team_session_name "$role")}"
    text="${text//\{requirements\}/$CLAUDE_TEAM_REQUIREMENTS_DOC}"
    text="${text//\{board\}/$CLAUDE_TEAM_TASK_BOARD}"
    text="${text//\{prefix\}/$CLAUDE_TEAM_SESSION_PREFIX}"
    text="${text//\{shared\}/$CLAUDE_TEAM_SHARED_DIR}"
    text="${text//\{agents_dir\}/$CLAUDE_TEAM_AGENTS_DIR}"
    text="${text//\{roles\}/$(claude_team_other_roles)}"
    printf '%s' "$text"
}

claude_team_start_sessions() {
    local index=""
    local role=""
    local session=""
    local role_command=""
    local quoted_kickoff=""
    local started="0"
    for index in "${!CLAUDE_TEAM_ROLE_NAMES[@]}"; do
        if [ "${CLAUDE_TEAM_ROLE_LAUNCH[$index]}" != "1" ]; then
            continue
        fi
        role="${CLAUDE_TEAM_ROLE_NAMES[$index]}"
        session="$(claude_team_session_name "$role")"
        claude_team_cell_geometry "${CLAUDE_TEAM_ROLE_SLOTS[$index]}"
        CLAUDE_TEAM_ROW_PIXELS[$index]="${CLAUDE_TEAM_CELL_W}x${CLAUDE_TEAM_CELL_H}+${CLAUDE_TEAM_CELL_X}+${CLAUDE_TEAM_CELL_Y}"
        CLAUDE_TEAM_ROW_TERMINAL[$index]="${CLAUDE_TEAM_CELL_COLS}x${CLAUDE_TEAM_CELL_ROWS}"
        if claude_team_tmux has-session -t "=$session" 2>/dev/null; then
            CLAUDE_TEAM_ROW_SESSION_STATE[$index]="running"
            claude_team_log SKIP "Session $session already running"
            continue
        fi
        if [ "$CLAUDE_TEAM_OPT_STATUS" = "1" ]; then
            CLAUDE_TEAM_ROW_SESSION_STATE[$index]="stopped"
            continue
        fi
        printf -v role_command '%q --agent %q --name %q' "$CLAUDE_TEAM_LAUNCHER_PATH" "$role" "$session"
        if [ "$CLAUDE_TEAM_MODE" = "team" ]; then
            role_command="$role_command --teammate-mode $CLAUDE_TEAM_TEAM_TEAMMATE_MODE"
        fi
        if [ "$CLAUDE_TEAM_OPT_NO_KICKOFF" = "0" ]; then
            printf -v quoted_kickoff '%q' "$(claude_team_kickoff_for "$role")"
            role_command="$role_command $quoted_kickoff"
        fi
        if claude_team_tmux new-session -d -s "$session" -c "$CLAUDE_TEAM_ROOT_DIR" \
            -x "$CLAUDE_TEAM_CELL_COLS" -y "$CLAUDE_TEAM_CELL_ROWS" \
            -e "$CLAUDE_TEAM_AGENT_TEAMS_ENV" -e "$CLAUDE_TEAM_GIT_GUARD_ENV" \
            bash -lc "$role_command; exec bash -l"; then
            CLAUDE_TEAM_ROW_SESSION_STATE[$index]="started"
            started="1"
            claude_team_log START "Session $session: cwd=$CLAUDE_TEAM_ROOT_DIR size=${CLAUDE_TEAM_CELL_COLS}x${CLAUDE_TEAM_CELL_ROWS} env=$CLAUDE_TEAM_AGENT_TEAMS_ENV,$CLAUDE_TEAM_GIT_GUARD_ENV"
            claude_team_log START "  command: claudeteam.sh --agent $role --name $session$([ "$CLAUDE_TEAM_MODE" = "team" ] && printf ' --teammate-mode %s' "$CLAUDE_TEAM_TEAM_TEAMMATE_MODE")$([ "$CLAUDE_TEAM_OPT_NO_KICKOFF" = "0" ] && printf ' <kickoff>') (permission mode $CLAUDE_TEAM_PERMISSION_MODE)"
        else
            CLAUDE_TEAM_ROW_SESSION_STATE[$index]="failed"
            claude_team_log ERROR "Session $session failed to start"
        fi
    done
    if [ "$started" = "1" ]; then
        claude_team_tmux set-option -g set-titles on >/dev/null 2>&1 || true
        claude_team_tmux set-option -g set-titles-string '#S' >/dev/null 2>&1 || true
        claude_team_tmux set-option -g mouse on >/dev/null 2>&1 || true
        claude_team_log OK "tmux socket $CLAUDE_TEAM_TMUX_SOCKET: set-titles on (#S), mouse on"
    fi
}

claude_team_client_count() {
    claude_team_tmux list-clients -t "=$1" -F '#{client_name}' 2>/dev/null | grep -c . || true
}

claude_team_window_argv() {
    local session="$1"
    local attach=(tmux -L "$CLAUDE_TEAM_TMUX_SOCKET" attach-session -t "=$session")
    local terminal_geometry="${CLAUDE_TEAM_CELL_COLS}x${CLAUDE_TEAM_CELL_ROWS}+${CLAUDE_TEAM_CELL_X}+${CLAUDE_TEAM_CELL_Y}"
    local pixel_geometry="$((CLAUDE_TEAM_CELL_W - CLAUDE_TEAM_GRID_CHROME_W))x$((CLAUDE_TEAM_CELL_H - CLAUDE_TEAM_GRID_CHROME_H))+${CLAUDE_TEAM_CELL_X}+${CLAUDE_TEAM_CELL_Y}"
    CLAUDE_TEAM_WINDOW_ARGV=()
    case "$CLAUDE_TEAM_EMULATOR" in
        xfce4-terminal) CLAUDE_TEAM_WINDOW_ARGV=(xfce4-terminal --disable-server "--title=$session" "--geometry=$terminal_geometry" -x "${attach[@]}") ;;
        konsole) CLAUDE_TEAM_WINDOW_ARGV=(konsole --separate -p "tabtitle=$session" --geometry "$pixel_geometry" -e "${attach[@]}") ;;
        xterm) CLAUDE_TEAM_WINDOW_ARGV=(xterm -title "$session" -geometry "$terminal_geometry" -e "${attach[@]}") ;;
        gnome-terminal) CLAUDE_TEAM_WINDOW_ARGV=(gnome-terminal --window "--title=$session" -- "${attach[@]}") ;;
        ptyxis) CLAUDE_TEAM_WINDOW_ARGV=(ptyxis --new-window -- "${attach[@]}") ;;
        qterminal) CLAUDE_TEAM_WINDOW_ARGV=(qterminal -e "${attach[*]}") ;;
        *) CLAUDE_TEAM_WINDOW_ARGV=("$CLAUDE_TEAM_EMULATOR" -e "${attach[@]}") ;;
    esac
}

claude_team_open_windows() {
    local index=""
    local role=""
    local session=""
    local clients="0"
    local waited="0"
    local position_note=""
    for index in "${!CLAUDE_TEAM_ROLE_NAMES[@]}"; do
        if [ "${CLAUDE_TEAM_ROLE_LAUNCH[$index]}" != "1" ]; then
            continue
        fi
        role="${CLAUDE_TEAM_ROLE_NAMES[$index]}"
        session="$(claude_team_session_name "$role")"
        if ! claude_team_tmux has-session -t "=$session" 2>/dev/null; then
            CLAUDE_TEAM_ROW_WINDOW_STATE[$index]="no-session"
            continue
        fi
        clients="$(claude_team_client_count "$session")"
        if [ "${clients:-0}" -gt 0 ]; then
            CLAUDE_TEAM_ROW_WINDOW_STATE[$index]="attached($clients)"
            claude_team_log SKIP "Window for $session already attached ($clients client)"
            continue
        fi
        if [ "$CLAUDE_TEAM_OPT_STATUS" = "1" ] || [ -z "$CLAUDE_TEAM_EMULATOR" ]; then
            CLAUDE_TEAM_ROW_WINDOW_STATE[$index]="detached"
            continue
        fi
        claude_team_cell_geometry "${CLAUDE_TEAM_ROLE_SLOTS[$index]}"
        claude_team_window_argv "$session"
        env -u TMUX "${CLAUDE_TEAM_EMULATOR_ENV[@]}" setsid "${CLAUDE_TEAM_WINDOW_ARGV[@]}" >/dev/null 2>&1 < /dev/null &
        disown 2>/dev/null || true
        if [ "$CLAUDE_TEAM_EMULATOR_POSITIONED" = "1" ]; then
            position_note="at ${CLAUDE_TEAM_CELL_X},${CLAUDE_TEAM_CELL_Y} size ${CLAUDE_TEAM_CELL_COLS}x${CLAUDE_TEAM_CELL_ROWS} chars"
        else
            position_note="unpositioned (compositor places it)"
        fi
        claude_team_log OPEN "Window $session: $CLAUDE_TEAM_EMULATOR $position_note"
        claude_team_log OPEN "  argv: ${CLAUDE_TEAM_WINDOW_ARGV[*]}"
        waited="0"
        clients="0"
        while [ "$waited" -lt "$CLAUDE_TEAM_ATTACH_WAIT_SECONDS" ]; do
            sleep 1
            waited=$((waited + 1))
            clients="$(claude_team_client_count "$session")"
            if [ "${clients:-0}" -gt 0 ]; then
                break
            fi
        done
        if [ "${clients:-0}" -gt 0 ]; then
            CLAUDE_TEAM_ROW_WINDOW_STATE[$index]="opened"
            claude_team_log OK "Window $session attached after ${waited}s"
        else
            CLAUDE_TEAM_ROW_WINDOW_STATE[$index]="unconfirmed"
            claude_team_log WARN "Window $session not attached after ${waited}s; attach manually: $(claude_team_attach_command "$role")"
        fi
    done
}

claude_team_print_shared_data() {
    local team_dir=""
    claude_team_log OK "Shared project data: $CLAUDE_TEAM_ROOT_DIR/$CLAUDE_TEAM_SHARED_DIR (files by path; git grant file git_grant.json)"
    claude_team_log OK "Durable task record: $CLAUDE_TEAM_ROOT_DIR/$CLAUDE_TEAM_TASK_BOARD"
    if [ "$CLAUDE_TEAM_MODE" = "team" ]; then
        claude_team_log OK "Agent-team task lists: $CLAUDE_TEAM_USER_TASKS_DIR/<team>/ ; mailboxes and members: $CLAUDE_TEAM_USER_TEAMS_DIR/<team>/{inboxes,config.json}"
        for team_dir in $(ls -1dt "$CLAUDE_TEAM_USER_TEAMS_DIR"/session-* 2>/dev/null | head -n 3); do
            claude_team_log OK "  live team dir: $team_dir"
        done
        claude_team_log OK "Dispatch: type one task in the $CLAUDE_TEAM_TEAM_SESSION_NAME window; the lead spawns teammates as tmux panes (Shift+Up/Down or click to switch)"
    else
        claude_team_log OK "Messaging: sessions discover each other with ListAgents and talk with SendMessage by --name (/list-agents shows the roster)"
        claude_team_log OK "Dispatch: type one task in the ${CLAUDE_TEAM_SESSION_PREFIX}${CLAUDE_TEAM_LEAD_ROLE} window; it dispatches to ${CLAUDE_TEAM_SESSION_PREFIX}<role> sessions and gets idle notices"
    fi
    claude_team_log OK "Git: blocked for every role; a user prompt containing allow-git (or 允许git) grants it for 120 min, deny-git revokes"
}

claude_team_print_report() {
    local index=""
    local role=""
    local row_format="  %-16s %-24s %-13s %-13s %-22s %-9s %s\n"
    printf '\n'
    printf "$row_format" "ROLE" "SESSION" "SESSION" "WINDOW" "PIXELS WxH+X+Y" "TERM" "ATTACH"
    for index in "${!CLAUDE_TEAM_ROLE_NAMES[@]}"; do
        role="${CLAUDE_TEAM_ROLE_NAMES[$index]}"
        CLAUDE_TEAM_ROLE_LAUNCH_FOR_REPORT="${CLAUDE_TEAM_ROLE_LAUNCH[$index]}"
        if [ "$CLAUDE_TEAM_MODE" = "sessions" ]; then
            CLAUDE_TEAM_ROLE_LAUNCH_FOR_REPORT="1"
        fi
        printf "$row_format" "$role" "$(claude_team_session_name "$role")" \
            "${CLAUDE_TEAM_ROW_SESSION_STATE[$index]}" "${CLAUDE_TEAM_ROW_WINDOW_STATE[$index]}" \
            "${CLAUDE_TEAM_ROW_PIXELS[$index]}" "${CLAUDE_TEAM_ROW_TERMINAL[$index]}" \
            "$(claude_team_attach_command "$role")"
    done
    CLAUDE_TEAM_ROLE_LAUNCH_FOR_REPORT="1"
    printf '\n'
    claude_team_log OK "List sessions: tmux -L $CLAUDE_TEAM_TMUX_SOCKET ls"
    claude_team_print_shared_data
    claude_team_log OK "Re-run is idempotent: running sessions and attached windows are skipped"
}

claude_team_run() {
    claude_team_step 1 "Platform profile"
    claude_team_detect_platform
    claude_team_step 2 "Team setup, item by item (shared claude_team_install, same as dd.sh step 171)"
    claude_team_install_items
    claude_team_step 3 "Claude Code CLI (shared ai_cli_provision)"
    claude_team_ensure_claude
    claude_team_step 4 "Role catalog, agent files, orchestration docs"
    claude_team_load_catalog || return 0
    claude_team_validate_roles
    claude_team_step 5 "Entry command"
    claude_team_log OK "$CLAUDE_TEAM_ENTRY_COMMAND -> $(readlink -f "$CLAUDE_TEAM_BIN_DIR/$CLAUDE_TEAM_ENTRY_COMMAND" 2>/dev/null || printf 'not linked')"
    claude_team_step 6 "Screen and terminal emulator"
    claude_team_detect_screen
    claude_team_select_emulator
    claude_team_step 7 "Sessions (tmux -L $CLAUDE_TEAM_TMUX_SOCKET, mode $CLAUDE_TEAM_MODE)"
    claude_team_start_sessions
    claude_team_step 8 "Windows (grid ${CLAUDE_TEAM_GRID_COLUMNS}x${CLAUDE_TEAM_GRID_ROWS})"
    claude_team_open_windows
    claude_team_step 9 "Summary"
    claude_team_print_report
}
