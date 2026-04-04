#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# WebClaude Group - Unified Debug Launcher (Linux/macOS)
#
# All configuration, env parsing, and checks are handled by Python
# (scripts/pytools/). This shell script only starts services.
#
# Usage:
#   ./start.sh                    # Resolve role (cached under .data), then start
#   ./start.sh center,web         # Override services for this run (also saved to cache)
#   ./start.sh --skip-checks      # Skip environment checks
#   ./start.sh all --build-only   # Only build, don't start
#
# Data dir: WEBCLAUDE_DATA_DIR (default: webclaude_group/.data). Role cache: deploy_role.json
# Non-interactive: WEBCLAUDE_NON_INTERACTIVE=1
# ═══════════════════════════════════════════════════════════════

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
GROUP_ROOT="$(dirname "$SCRIPT_DIR")"
CORE_NODE="$(dirname "$GROUP_ROOT")"

SKIP_CHECKS=false
BUILD_ONLY=false
SERVICES_CLI=""
for arg in "$@"; do
    case "$arg" in
        --skip-checks) SKIP_CHECKS=true ;;
        --build-only)  BUILD_ONLY=true ;;
        *)
            if [ -z "$SERVICES_CLI" ] && [[ "$arg" != --* ]]; then
                SERVICES_CLI="$arg"
            fi
            ;;
    esac
done

# ── Colors (only used for service start messages) ───────────
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'
CYAN='\033[0;36m'; GRAY='\033[0;37m'; MAGENTA='\033[0;35m'; NC='\033[0m'
ok()     { echo -e "  ${GREEN}[OK]${NC}   $1"; }
warn()   { echo -e "  ${YELLOW}[WARN]${NC} $1"; }
fail()   { echo -e "  ${RED}[FAIL]${NC} $1"; }
info()   { echo -e "  ${GRAY}[INFO]${NC} $1"; }
header() { echo -e "\n${CYAN}=== $1 ===${NC}"; }

# ── Find Python ─────────────────────────────────────────────
PY=""
for cmd in python3 python; do
    command -v "$cmd" >/dev/null 2>&1 && PY="$cmd" && break
done

if [ -z "$PY" ]; then
    warn "Python not found. Preflight checks will be skipped."
    warn "Install Python 3: https://python.org/"
    SKIP_CHECKS=true
fi

# ═══════════════════════════════════════════════════════════════
# Deploy role (data dir + cache). Emits SERVICES, WEBCLAUDE_DATA_DIR, WEBCLAUDE_LOG_DIR
# ═══════════════════════════════════════════════════════════════

DEPLOY_ROLE_PY="$SCRIPT_DIR/pytools/deploy_role.py"
chmod +x "$DEPLOY_ROLE_PY" 2>/dev/null || true
DATA_DIR_DEFAULT="${WEBCLAUDE_DATA_DIR:-$GROUP_ROOT/.data}"
DEPLOY_ENV_FILE="$(mktemp 2>/dev/null || mktemp -t wcdeploy 2>/dev/null || echo "${TMPDIR:-/tmp}/wc-deploy-role-$$.env")"
cleanup_deploy_env() { rm -f "$DEPLOY_ENV_FILE"; }
trap cleanup_deploy_env EXIT
if [ -n "$PY" ] && [ -f "$DEPLOY_ROLE_PY" ]; then
    if [ -n "$SERVICES_CLI" ]; then
        PYTHONWARNINGS=ignore "$PY" "$DEPLOY_ROLE_PY" --shell --data-dir "$DATA_DIR_DEFAULT" --cli-services "$SERVICES_CLI" >"$DEPLOY_ENV_FILE" 2>/dev/null || true
    else
        PYTHONWARNINGS=ignore "$PY" "$DEPLOY_ROLE_PY" --shell --data-dir "$DATA_DIR_DEFAULT" >"$DEPLOY_ENV_FILE" 2>/dev/null || true
    fi
    if [ -s "$DEPLOY_ENV_FILE" ]; then
        set -a
        # shellcheck disable=SC1090
        . "$DEPLOY_ENV_FILE" 2>/dev/null || warn "Failed to source deploy role env (continuing with defaults)"
        set +a
    else
        warn "deploy_role.py produced no output (using defaults: all services)"
    fi
else
    warn "deploy_role.py not available (using defaults: all services)"
fi
cleanup_deploy_env
trap - EXIT
SERVICES="${SERVICES:-all}"

echo ""
echo -e "  ${MAGENTA}WebClaude Group - Unified Debug Launcher${NC}"
echo -e "  ${MAGENTA}Data: ${WEBCLAUDE_DATA_DIR}${NC}"
echo -e "  ${MAGENTA}Services: ${SERVICES}${NC}"
echo ""

# ═══════════════════════════════════════════════════════════════
# PHASE 0 + 1: Python handles EVERYTHING
#   - init .env files (merge missing keys, force sqlite if no MySQL)
#   - init config files, data dirs, script permissions
#   - check Node.js, Go, Python, pnpm, nodemon, air, watchdog
#   - check database (sqlite/mysql) and redis
#   - output KEY=VALUE lines to stdout (sourced via temp file, not eval)
# ═══════════════════════════════════════════════════════════════

PREFLIGHT="$SCRIPT_DIR/pytools/preflight.py"
chmod +x "$SCRIPT_DIR/pytools/"*.py 2>/dev/null || true

if [ "$SKIP_CHECKS" = false ] && [ -f "$PREFLIGHT" ]; then
    # preflight.py prints checks to stderr (visible), KEY=VALUE to stdout (captured)
    PREFLIGHT_OUTPUT="$($PY "$PREFLIGHT" "$SERVICES")"
    eval "$PREFLIGHT_OUTPUT"
else
    # Defaults when skipping
    PREFLIGHT_OK=1
    CENTER_PORT=18100
    PY_CMD="$PY"
    HAS_WATCHDOG=0
fi

# If preflight found errors, don't start services
if [ "${PREFLIGHT_OK:-1}" = "0" ]; then
    BUILD_ONLY=true
fi

# ── Auto-install Redis if not running (uses core_node install scripts) ──
REDIS_INSTALL_SCRIPT="$CORE_NODE/scripts/shells/linux/debian/install_shells/45_install_redis.sh"
if [ -f "$REDIS_INSTALL_SCRIPT" ]; then
    REDIS_PORT="${REDIS_PORT:-6379}"
    REDIS_HOST="${REDIS_HOST:-127.0.0.1}"
    # Check if Redis is reachable using Python (no bash TCP, no exit codes)
    REDIS_UP="$($PY -c "
import socket; s=socket.socket(); s.settimeout(2)
print('yes' if s.connect_ex(('$REDIS_HOST',$REDIS_PORT))==0 else 'no')
s.close()
" 2>/dev/null)"
    if [ "$REDIS_UP" != "yes" ]; then
        info "Redis not running. Attempting install..."
        chmod +x "$REDIS_INSTALL_SCRIPT"

        # Set START_REDIS=true via the global variable system used by 45_install_redis.sh
        GVAR_COMMON="$CORE_NODE/scripts/shells/linux/common/gvar_common.sh"
        COMMON_FUNC="$CORE_NODE/scripts/shells/linux/common/common_functions.sh"
        if [ -f "$GVAR_COMMON" ] && [ -f "$COMMON_FUNC" ]; then
            # Source the common scripts to get set_var/get_var
            source "$GVAR_COMMON" 2>/dev/null || true
            source "$COMMON_FUNC" 2>/dev/null || true
            # Set the global variable that 45_install_redis.sh reads
            set_var "START_REDIS" "true" 2>/dev/null || true
            info "Set global var START_REDIS=true"
        fi

        # Also export as env var for belt-and-suspenders
        export START_REDIS=true
        bash "$REDIS_INSTALL_SCRIPT" 2>&1 | tail -15

        # If script failed (deps issue), try simple apt install as fallback
        REDIS_UP2="$($PY -c "
import socket; s=socket.socket(); s.settimeout(2)
print('yes' if s.connect_ex(('$REDIS_HOST',$REDIS_PORT))==0 else 'no'); s.close()
" 2>/dev/null)"
        if [ "$REDIS_UP2" != "yes" ]; then
            info "Core script didn't start Redis, trying direct apt install..."
            apt-get install -y -qq redis-server 2>/dev/null || true
            systemctl enable redis-server 2>/dev/null || true
            systemctl start redis-server 2>/dev/null || redis-server --daemonize yes 2>/dev/null || true
        fi
        # Verify
        REDIS_UP="$($PY -c "
import socket,time; time.sleep(2); s=socket.socket(); s.settimeout(2)
print('yes' if s.connect_ex(('$REDIS_HOST',$REDIS_PORT))==0 else 'no')
s.close()
" 2>/dev/null)"
        if [ "$REDIS_UP" = "yes" ]; then
            ok "Redis installed and running"
        else
            warn "Redis install attempted but not yet running (app will use degraded mode)"
        fi
    fi
fi

# ═══════════════════════════════════════════════════════════════
# PHASE 2: Build / Install (shell handles — simple commands)
# ═══════════════════════════════════════════════════════════════

header "Phase 2: Build & Install"

has_service() {
    [ "$SERVICES" = "all" ] && return 0
    echo "$SERVICES" | tr ',' '\n' | grep -qiE "^(${1}|$(echo "$1" | head -c3))$"
}

if has_service center; then
    DIR="$GROUP_ROOT/webclaude_center_server"
    if [ -d "$DIR/node_modules" ]; then
        ok "center_server: node_modules exists"
    else
        info "center_server: npm install..."
        cd "$DIR" && npm install --no-audit --no-fund 2>&1 | tail -3
        ok "center_server: installed"
    fi
fi

if has_service gateway; then
    DIR="$GROUP_ROOT/webclaude_go-gateway"
    info "go-gateway: building..."
    cd "$DIR" && go build -trimpath -ldflags "-s -w" -o relay-api ./cmd/relay-api 2>&1 | tail -3
    if [ -f "$DIR/relay-api" ]; then
        ok "go-gateway: built"
    else
        fail "go-gateway: build failed"
    fi
fi

if has_service website; then
    DIR="$GROUP_ROOT/webclaude_website"
    if [ -d "$DIR/node_modules" ]; then
        ok "website: node_modules exists"
    else
        info "website: pnpm install..."
        cd "$DIR" && pnpm install --no-frozen-lockfile 2>&1 | tail -3
        ok "website: installed"
    fi
fi

if [ "$BUILD_ONLY" = true ]; then
    echo ""
    ok "Build complete."
    echo ""
else

# ═══════════════════════════════════════════════════════════════
# PHASE 3: Start Services
# ═══════════════════════════════════════════════════════════════

header "Phase 3: Starting Services"

# ── Kill old processes on our ports ─────────────────────
CENTER_P="${CENTER_PORT:-18100}"
GATEWAY_P="${GATEWAY_PORT:-18200}"
WEBSITE_P="18300"

info "Cleaning up old processes on ports $CENTER_P, $GATEWAY_P, $WEBSITE_P..."
for port in $CENTER_P $GATEWAY_P $WEBSITE_P; do
    # Find PIDs listening on this port and kill them
    OLD_PIDS=$($PY -c "
import subprocess, re
try:
    out = subprocess.check_output(['ss', '-tlnp'], text=True, timeout=5)
    for line in out.split('\n'):
        if ':$port ' in line:
            m = re.search(r'pid=(\d+)', line)
            if m: print(m.group(1))
except: pass
" 2>/dev/null)
    for old_pid in $OLD_PIDS; do
        kill "$old_pid" 2>/dev/null && info "Killed old process PID $old_pid on port $port" || true
    done
done
sleep 1

PIDS=()
NAMES=()
PORTS=()
URLS=()
LOG_DIR="${WEBCLAUDE_LOG_DIR:-$SCRIPT_DIR/.logs}"
mkdir -p "$LOG_DIR"

cleanup() {
    echo ""
    header "Stopping all services..."
    for pid in "${PIDS[@]}"; do
        kill "$pid" 2>/dev/null || true
    done
}
trap cleanup SIGINT SIGTERM

# Script paths
CENTER_SH="$GROUP_ROOT/webclaude_center_server/scripts/start.sh"
GATEWAY_SH="$GROUP_ROOT/webclaude_go-gateway/scripts/start.sh"
WEBSITE_SH="$GROUP_ROOT/webclaude_website/scripts/start.sh"
HOST_SH="$CORE_NODE/pyapps/claude_host/scripts/start.sh"

# Sub-scripts run in the background with logs redirected; skip systemd prompts there.
export WEBCLAUDE_SKIP_SERVICE_PROMPT=1

# ── Print all sub-script commands for manual debugging ──
echo ""
echo -e "  ${GRAY}Sub-scripts (copy to debug individually):${NC}"
echo ""
has_service center  && echo -e "  ${CYAN}[center]${NC}   chmod +x $CENTER_SH && $CENTER_SH"
has_service gateway && echo -e "  ${CYAN}[gateway]${NC}  chmod +x $GATEWAY_SH && $GATEWAY_SH"
has_service website && echo -e "  ${CYAN}[website]${NC}  chmod +x $WEBSITE_SH && $WEBSITE_SH"
has_service host    && echo -e "  ${CYAN}[host]${NC}     chmod +x $HOST_SH && $HOST_SH"
echo ""

# ── 1. Center Server ────────────────────────────────────
if has_service center; then
    if [ -f "$CENTER_SH" ]; then
        bash "$CENTER_SH" --skip-deps --no-build > "$LOG_DIR/center.log" 2>&1 &
    else
        cd "$GROUP_ROOT/webclaude_center_server" && node src/control/app.js > "$LOG_DIR/center.log" 2>&1 &
    fi
    PIDS+=($!)
    NAMES+=("Center Server")
    PORTS+=("$CENTER_P")
    URLS+=("http://0.0.0.0:$CENTER_P")
    ok "Started: Center Server (PID $!) on port $CENTER_P"

    info "Waiting for Center Server..."
    $PY -c "
import socket, time
for i in range(30):
    s = socket.socket(); s.settimeout(1)
    if s.connect_ex(('127.0.0.1', $CENTER_P)) == 0: s.close(); break
    s.close(); time.sleep(1)
" 2>/dev/null
    ok "Center Server ready on port $CENTER_P"
fi

# ── 2. Go Gateway ───────────────────────────────────────
if has_service gateway; then
    if [ -f "$GATEWAY_SH" ]; then
        bash "$GATEWAY_SH" --skip-deps --no-build > "$LOG_DIR/gateway.log" 2>&1 &
    else
        cd "$GROUP_ROOT/webclaude_go-gateway" && ./relay-api > "$LOG_DIR/gateway.log" 2>&1 &
    fi
    PIDS+=($!)
    NAMES+=("Go Gateway")
    PORTS+=("$GATEWAY_P")
    URLS+=("http://0.0.0.0:$GATEWAY_P")
    ok "Started: Go Gateway (PID $!) on port $GATEWAY_P"
fi

# ── 3. Website ──────────────────────────────────────────
if has_service website; then
    if [ -f "$WEBSITE_SH" ]; then
        bash "$WEBSITE_SH" --skip-deps > "$LOG_DIR/website.log" 2>&1 &
    else
        cd "$GROUP_ROOT/webclaude_website" && pnpm run dev > "$LOG_DIR/website.log" 2>&1 &
    fi
    PIDS+=($!)
    NAMES+=("Website (Vite)")
    PORTS+=("$WEBSITE_P")
    URLS+=("http://0.0.0.0:$WEBSITE_P")
    ok "Started: Website (PID $!) on port $WEBSITE_P"
fi

# ── 4. Claude Host ──────────────────────────────────────
if has_service host; then
    if [ -f "$HOST_SH" ]; then
        bash "$HOST_SH" > "$LOG_DIR/host.log" 2>&1 &
    else
        cd "$CORE_NODE" && ${PY_CMD:-python3} -u pymain.py app=claude_host > "$LOG_DIR/host.log" 2>&1 &
    fi
    PIDS+=($!)
    NAMES+=("Claude Host")
    PORTS+=("WS")
    URLS+=("ws://gateway:$GATEWAY_P/ws/client")
    ok "Started: Claude Host (PID $!) -> gateway:$GATEWAY_P"
fi

# ── Get local IP for display ────────────────────────────
LOCAL_IP=$($PY -c "
import socket
s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
try: s.connect(('8.8.8.8', 80)); print(s.getsockname()[0])
except: print('127.0.0.1')
finally: s.close()
" 2>/dev/null)

# ── Wait a moment then check if services are alive ──────
sleep 3
echo ""
header "Service Health Check"
for i in "${!PIDS[@]}"; do
    if kill -0 "${PIDS[$i]}" 2>/dev/null; then
        ok "${NAMES[$i]} (PID ${PIDS[$i]}) is running"
    else
        fail "${NAMES[$i]} (PID ${PIDS[$i]}) has EXITED"
        # Show last 15 lines of log
        LOG_NAME=$(echo "${NAMES[$i]}" | tr '[:upper:]' '[:lower:]' | tr ' ' '_' | tr -cd 'a-z_')
        for logfile in "$LOG_DIR"/*.log; do
            case "$logfile" in
                *center*) [ "${NAMES[$i]}" = "Center Server" ] && echo -e "  ${RED}--- Last 15 lines of $(basename $logfile) ---${NC}" && tail -15 "$logfile" ;;
                *gateway*) [ "${NAMES[$i]}" = "Go Gateway" ] && echo -e "  ${RED}--- Last 15 lines of $(basename $logfile) ---${NC}" && tail -15 "$logfile" ;;
                *website*) echo "${NAMES[$i]}" | grep -qi "website" && echo -e "  ${RED}--- Last 15 lines of $(basename $logfile) ---${NC}" && tail -15 "$logfile" ;;
                *host*) [ "${NAMES[$i]}" = "Claude Host" ] && echo -e "  ${RED}--- Last 15 lines of $(basename $logfile) ---${NC}" && tail -15 "$logfile" ;;
            esac
        done
    fi
done

# ── Check ports are actually listening ──────────────────
echo ""
header "Port Listening Check"
for i in "${!PORTS[@]}"; do
    P="${PORTS[$i]}"
    [ "$P" = "WS" ] && continue
    PORT_UP=$($PY -c "
import socket; s=socket.socket(); s.settimeout(2)
print('yes' if s.connect_ex(('127.0.0.1',$P))==0 else 'no'); s.close()
" 2>/dev/null)
    if [ "$PORT_UP" = "yes" ]; then
        ok "Port $P is listening (${NAMES[$i]})"
    else
        fail "Port $P is NOT listening (${NAMES[$i]})"
        info "Check log: tail -30 $LOG_DIR/*.log"
    fi
done

# ── Summary ─────────────────────────────────────────────
echo ""
header "All Services Running"
echo ""
echo -e "  ${CYAN}┌──────────────────────────────────────────────────────────────┐${NC}"
echo -e "  ${CYAN}│${NC}  Service            Port     URL                              ${CYAN}│${NC}"
echo -e "  ${CYAN}├──────────────────────────────────────────────────────────────┤${NC}"
for i in "${!NAMES[@]}"; do
    printf "  ${CYAN}│${NC}  %-18s %-8s %-33s ${CYAN}│${NC}\n" "${NAMES[$i]}" "${PORTS[$i]}" "${URLS[$i]}"
done
echo -e "  ${CYAN}└──────────────────────────────────────────────────────────────┘${NC}"
echo ""
echo -e "  ${GREEN}Local access:${NC}"
echo -e "    Website:  ${GREEN}http://localhost:$WEBSITE_P${NC}"
echo -e "    Admin:    ${GREEN}http://localhost:$WEBSITE_P/#/admin-login${NC}"
echo ""
echo -e "  ${GREEN}LAN/VPN access:${NC}"
echo -e "    Website:  ${GREEN}http://$LOCAL_IP:$WEBSITE_P${NC}"
echo -e "    Admin:    ${GREEN}http://$LOCAL_IP:$WEBSITE_P/#/admin-login${NC}"
echo -e "    API:      ${GREEN}http://$LOCAL_IP:$CENTER_P${NC}"
echo -e "    Gateway:  ${GREEN}http://$LOCAL_IP:$GATEWAY_P${NC}"
echo ""
echo -e "  ${GRAY}Database:  ${DB_TYPE:-sqlite}${NC}"
echo -e "  ${GRAY}Logs:      $LOG_DIR/${NC}"
echo -e "  ${GRAY}Tail all:  tail -f $LOG_DIR/*.log${NC}"
echo ""
echo -e "  ${YELLOW}Press Ctrl+C to stop all services.${NC}"
echo ""

# Wait
while true; do
    ALIVE=false
    for pid in "${PIDS[@]}"; do
        kill -0 "$pid" 2>/dev/null && ALIVE=true
    done
    [ "$ALIVE" = false ] && warn "All services exited" && break
    sleep 2
done

fi  # end BUILD_ONLY
