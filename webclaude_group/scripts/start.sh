#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# WebClaude Group - Unified Debug Launcher (Linux/macOS)
#
# Usage:
#   ./start.sh                    # Start all services
#   ./start.sh center,web         # Start only center_server and website
#   ./start.sh all --skip-checks  # Skip environment checks
#   ./start.sh all --build-only   # Only build, don't start
# ═══════════════════════════════════════════════════════════════

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
GROUP_ROOT="$(dirname "$SCRIPT_DIR")"
CORE_NODE="$(dirname "$GROUP_ROOT")"  # webclaude_group is inside core_node

# ── Colors ──────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; GRAY='\033[0;37m'; MAGENTA='\033[0;35m'; NC='\033[0m'

header() { echo -e "\n${CYAN}=== $1 ===${NC}"; }
ok()     { echo -e "  ${GREEN}[OK]${NC}   $1"; }
warn()   { echo -e "  ${YELLOW}[WARN]${NC} $1"; }
fail()   { echo -e "  ${RED}[FAIL]${NC} $1"; }
info()   { echo -e "  ${GRAY}[INFO]${NC} $1"; }

# ── Parse arguments ─────────────────────────────────────────
SERVICES="${1:-all}"
SKIP_CHECKS=false
BUILD_ONLY=false
for arg in "$@"; do
    case "$arg" in
        --skip-checks) SKIP_CHECKS=true ;;
        --build-only)  BUILD_ONLY=true ;;
    esac
done

# ── Resolve service list ────────────────────────────────────
if [ "$SERVICES" = "all" ]; then
    SELECTED=(center gateway website host)
else
    IFS=',' read -ra PARTS <<< "$SERVICES"
    SELECTED=()
    for s in "${PARTS[@]}"; do
        case "$(echo "$s" | tr '[:upper:]' '[:lower:]' | xargs)" in
            center|server) SELECTED+=(center) ;;
            gateway|gw)    SELECTED+=(gateway) ;;
            website|web)   SELECTED+=(website) ;;
            host|claude)   SELECTED+=(host) ;;
            *) warn "Unknown service: $s" ;;
        esac
    done
fi

echo ""
echo -e "  ${MAGENTA}WebClaude Group - Unified Debug Launcher${NC}"
echo -e "  ${MAGENTA}Services: ${SELECTED[*]}${NC}"
echo ""

# ── Helper: check if service in selected ────────────────────
has_service() { printf '%s\n' "${SELECTED[@]}" | grep -qx "$1"; }

# ── Helper: load .env file ──────────────────────────────────
load_env() {
    local envfile="$1"
    if [ -f "$envfile" ]; then
        set -a
        # shellcheck disable=SC1090
        source <(grep -v '^\s*#' "$envfile" | grep -v '^\s*$' | sed 's/\r$//')
        set +a
    fi
}

# ── Helper: check TCP port ──────────────────────────────────
check_port() {
    local host="$1" port="$2"
    (echo > /dev/tcp/"$host"/"$port") 2>/dev/null && return 0 || return 1
}

# ══════════════════════════════════════════════════════════════
# PHASE 1: Environment Checks
# ══════════════════════════════════════════════════════════════

if [ "$SKIP_CHECKS" = false ]; then
    header "Phase 1: Environment Checks"

    # ── Node.js ─────────────────────────────────────────────
    if has_service center || has_service website; then
        if command -v node &>/dev/null; then
            NODE_VER=$(node --version)
            MAJOR=$(echo "$NODE_VER" | sed 's/v\([0-9]*\).*/\1/')
            if [ "$MAJOR" -ge 18 ]; then
                ok "Node.js $NODE_VER"
            else
                fail "Node.js $NODE_VER too old (need >= 18)"
                exit 1
            fi
        else
            fail "Node.js not found"
            info "Install: https://nodejs.org/ or use nvm"
            exit 1
        fi
    fi

    # ── pnpm ────────────────────────────────────────────────
    if has_service website; then
        if command -v pnpm &>/dev/null; then
            ok "pnpm $(pnpm --version)"
        else
            warn "pnpm not found, installing..."
            npm install -g pnpm
            ok "pnpm installed"
        fi
    fi

    # ── Hot-Reload Tools (optional) ────────────────────────
    if has_service center; then
        if command -v nodemon &>/dev/null; then
            ok "nodemon found (center_server hot-reload)"
        else
            warn "nodemon not found (will use npx nodemon, slower first start)"
            info "Install nodemon: npm i -g nodemon"
        fi
    fi

    # ── Go ──────────────────────────────────────────────────
    if has_service gateway; then
        if command -v go &>/dev/null; then
            GO_VER=$(go version | grep -oP 'go(\d+\.\d+)' | head -1 | sed 's/go//')
            if [ "$(echo "$GO_VER >= 1.24" | bc 2>/dev/null || echo 0)" = "1" ]; then
                ok "Go $GO_VER"
            else
                # Fallback comparison
                ok "Go $GO_VER (check >= 1.24 manually)"
            fi
        else
            fail "Go not found"
            info "Install: https://go.dev/dl/"
            exit 1
        fi

        # ── air (hot reload) ──────────────────────────────────
        if command -v air &>/dev/null; then
            ok "air found (go-gateway hot-reload)"
        else
            info "Install air for hot reload: go install github.com/air-verse/air@latest"
        fi
    fi

    # ── Python ──────────────────────────────────────────────
    if has_service host; then
        PY_CMD=""
        for cmd in python3 python; do
            if command -v "$cmd" &>/dev/null; then
                PY_CMD="$cmd"
                ok "$cmd $($cmd --version 2>&1)"
                break
            fi
        done
        if [ -z "$PY_CMD" ]; then
            fail "Python not found"
            exit 1
        fi

        # Check websockets
        if $PY_CMD -c "import websockets" 2>/dev/null; then
            ok "Python websockets module"
        else
            warn "websockets not installed, installing..."
            $PY_CMD -m pip install -r "$CORE_NODE/pyapps/claude_host/requirements.txt"
            ok "websockets installed"
        fi

        # Check watchdog (hot-reload)
        if $PY_CMD -c "import watchdog" 2>/dev/null; then
            ok "Python watchdog module (claude_host hot-reload)"
        else
            warn "Python watchdog not found (claude_host will run without hot-reload)"
            info "Install: $PY_CMD -m pip install watchdog"
        fi
    fi

    # ── MySQL ───────────────────────────────────────────────
    if has_service center || has_service gateway; then
        DB_HOST="${DB_HOST:-127.0.0.1}"
        DB_PORT="${DB_PORT:-3306}"
        DB_TYPE="${DB_TYPE:-mysql}"

        ENV_FILE="$GROUP_ROOT/webclaude_center_server/.env"
        if [ -f "$ENV_FILE" ]; then
            DB_TYPE=$(grep -E '^\s*DB_TYPE\s*=' "$ENV_FILE" 2>/dev/null | tail -1 | cut -d= -f2 | xargs || echo "mysql")
            DB_HOST=$(grep -E '^\s*DB_HOST\s*=' "$ENV_FILE" 2>/dev/null | tail -1 | cut -d= -f2 | xargs || echo "127.0.0.1")
            DB_PORT=$(grep -E '^\s*DB_PORT\s*=' "$ENV_FILE" 2>/dev/null | tail -1 | cut -d= -f2 | xargs || echo "3306")
        fi

        if [ "$DB_TYPE" = "sqlite" ]; then
            ok "Database: SQLite mode (no MySQL needed)"
        else
            if check_port "$DB_HOST" "$DB_PORT" 2>/dev/null; then
                ok "MySQL reachable at ${DB_HOST}:${DB_PORT}"
            else
                fail "MySQL not reachable at ${DB_HOST}:${DB_PORT}"
                info "Start MySQL or set DB_TYPE=sqlite in .env"
                exit 1
            fi
        fi
    fi

    # ── Redis ───────────────────────────────────────────────
    if has_service center || has_service gateway; then
        REDIS_HOST="${REDIS_HOST:-127.0.0.1}"
        REDIS_PORT="${REDIS_PORT:-6379}"

        if [ -f "$ENV_FILE" ]; then
            REDIS_HOST=$(grep -E '^\s*REDIS_HOST\s*=' "$ENV_FILE" 2>/dev/null | tail -1 | cut -d= -f2 | xargs || echo "127.0.0.1")
            REDIS_PORT=$(grep -E '^\s*REDIS_PORT\s*=' "$ENV_FILE" 2>/dev/null | tail -1 | cut -d= -f2 | xargs || echo "6379")
        fi

        if check_port "$REDIS_HOST" "$REDIS_PORT" 2>/dev/null; then
            ok "Redis reachable at ${REDIS_HOST}:${REDIS_PORT}"
        else
            fail "Redis not reachable at ${REDIS_HOST}:${REDIS_PORT}"
            info "Start Redis: sudo systemctl start redis-server"
            exit 1
        fi
    fi

    echo ""
    ok "All environment checks passed!"
fi

# ══════════════════════════════════════════════════════════════
# PHASE 2: Build / Install Dependencies
# ══════════════════════════════════════════════════════════════

header "Phase 2: Build & Install"

# ── Center Server ───────────────────────────────────────────
if has_service center; then
    CENTER_DIR="$GROUP_ROOT/webclaude_center_server"
    if [ ! -f "$CENTER_DIR/.env" ] && [ -f "$CENTER_DIR/.env.example" ]; then
        cp "$CENTER_DIR/.env.example" "$CENTER_DIR/.env"
        info "center_server: .env created from .env.example"
    fi
    # Ensure config/config.js exists
    if [ ! -f "$CENTER_DIR/config/config.js" ] && [ -f "$CENTER_DIR/config/config.example.js" ]; then
        cp "$CENTER_DIR/config/config.example.js" "$CENTER_DIR/config/config.js"
        info "center_server: config.js created from config.example.js"
    fi
    info "center_server: npm install..."
    (cd "$CENTER_DIR" && npm install --no-audit --no-fund 2>&1 | tail -1)
    ok "center_server: dependencies installed"
fi

# ── Go Gateway ──────────────────────────────────────────────
if has_service gateway; then
    GW_DIR="$GROUP_ROOT/webclaude_go-gateway"
    if [ ! -f "$GW_DIR/.env" ] && [ -f "$GW_DIR/.env.example" ]; then
        cp "$GW_DIR/.env.example" "$GW_DIR/.env"
        info "go-gateway: .env created from .env.example"
    fi
    info "go-gateway: building..."
    (cd "$GW_DIR" && go build -trimpath -ldflags "-s -w" -o relay-api ./cmd/relay-api)
    ok "go-gateway: built relay-api"
fi

# ── Website ─────────────────────────────────────────────────
if has_service website; then
    WEB_DIR="$GROUP_ROOT/webclaude_website"
    info "website: pnpm install..."
    (cd "$WEB_DIR" && pnpm install --no-frozen-lockfile 2>&1 | tail -1)
    ok "website: dependencies installed"
fi

if [ "$BUILD_ONLY" = true ]; then
    echo ""
    ok "Build complete."
    exit 0
fi

# ══════════════════════════════════════════════════════════════
# PHASE 3: Start All Services (Background Processes)
# ══════════════════════════════════════════════════════════════

header "Phase 3: Starting Services [Hot-Reload Mode]"

PIDS=()
NAMES=()
LOG_DIR="$GROUP_ROOT/scripts/.logs"
mkdir -p "$LOG_DIR"

cleanup() {
    echo ""
    header "Stopping all services..."
    for i in "${!PIDS[@]}"; do
        if kill -0 "${PIDS[$i]}" 2>/dev/null; then
            kill "${PIDS[$i]}" 2>/dev/null
            info "Stopped: ${NAMES[$i]} (PID ${PIDS[$i]})"
        fi
    done
    exit 0
}
trap cleanup SIGINT SIGTERM

# ── Center Server [nodemon] ────────────────────────────────
# Hot-reload: npx nodemon watches .js/.json files and auto-restarts
if has_service center; then
    CENTER_DIR="$GROUP_ROOT/webclaude_center_server"
    load_env "$CENTER_DIR/.env"
    (cd "$CENTER_DIR" && npx nodemon src/control/app.js) > "$LOG_DIR/center.log" 2>&1 &
    PIDS+=($!)
    NAMES+=("Center Server [nodemon]")
    ok "Started: Center Server [nodemon] (PID $!) → $LOG_DIR/center.log"
fi

# ── Go Gateway [air / static] ──────────────────────────────
# Hot-reload: air (if installed) watches .go files and auto-rebuilds
# Fallback: run static binary (no hot-reload)
if has_service gateway; then
    GW_DIR="$GROUP_ROOT/webclaude_go-gateway"
    load_env "$GW_DIR/.env"
    if command -v air &>/dev/null; then
        (cd "$GW_DIR" && air) > "$LOG_DIR/gateway.log" 2>&1 &
        PIDS+=($!)
        NAMES+=("Go Gateway [air]")
        ok "Started: Go Gateway [air] (PID $!) → $LOG_DIR/gateway.log"
    else
        (cd "$GW_DIR" && ./relay-api) > "$LOG_DIR/gateway.log" 2>&1 &
        PIDS+=($!)
        NAMES+=("Go Gateway [static]")
        ok "Started: Go Gateway [static] (PID $!) → $LOG_DIR/gateway.log"
    fi
fi

# ── Website [Vite HMR] ─────────────────────────────────────
# Hot-reload: Vite HMR (built-in, instant browser updates)
if has_service website; then
    WEB_DIR="$GROUP_ROOT/webclaude_website"
    (cd "$WEB_DIR" && pnpm run dev) > "$LOG_DIR/website.log" 2>&1 &
    PIDS+=($!)
    NAMES+=("Website [Vite HMR]")
    ok "Started: Website [Vite HMR] (PID $!) → $LOG_DIR/website.log"
fi

# ── Claude Host [watchdog / direct] ────────────────────────
# Hot-reload: dev_reload.py (watchdog-based) if available
# Fallback: direct python execution (no hot-reload)
if has_service host; then
    PY_CMD="${PY_CMD:-python3}"
    DEV_RELOAD="$CORE_NODE/pyapps/claude_host/scripts/dev_reload.py"
    HAS_WATCHDOG=false
    if $PY_CMD -c "import watchdog" 2>/dev/null && [ -f "$DEV_RELOAD" ]; then
        HAS_WATCHDOG=true
    fi

    if [ "$HAS_WATCHDOG" = true ]; then
        (cd "$CORE_NODE" && $PY_CMD -u "$DEV_RELOAD") > "$LOG_DIR/host.log" 2>&1 &
        PIDS+=($!)
        NAMES+=("Claude Host [watchdog]")
        ok "Started: Claude Host [watchdog] (PID $!) → $LOG_DIR/host.log"
    else
        (cd "$CORE_NODE" && $PY_CMD -u scripts/pycore/pymain.py app=claude_host) > "$LOG_DIR/host.log" 2>&1 &
        PIDS+=($!)
        NAMES+=("Claude Host")
        ok "Started: Claude Host (PID $!) → $LOG_DIR/host.log"
    fi
fi

# ══════════════════════════════════════════════════════════════
# Summary & Wait
# ══════════════════════════════════════════════════════════════

echo ""
header "All Services Running"
echo ""
echo -e "  ${GRAY}Ports:${NC}"
echo -e "    Center Server : http://localhost:18100 (nodemon hot-reload)"
echo -e "    Go Gateway    : http://localhost:18200 (air hot-reload if installed)"
echo -e "    Website       : http://localhost:18300 (Vite HMR)"
echo -e "    Claude Host   : WebSocket to gateway (watchdog hot-reload if available)"
echo ""
echo -e "  ${GREEN}All services run in hot-reload mode: edit code and changes apply automatically.${NC}"
echo ""
echo -e "  ${GRAY}Logs:${NC} $LOG_DIR/"
echo -e "  ${GRAY}Tail:${NC} tail -f $LOG_DIR/*.log"
echo ""
echo -e "  ${YELLOW}Press Ctrl+C to stop all services.${NC}"
echo ""

# Wait for any process to exit
wait -n "${PIDS[@]}" 2>/dev/null || true

# Check which died
for i in "${!PIDS[@]}"; do
    if ! kill -0 "${PIDS[$i]}" 2>/dev/null; then
        warn "${NAMES[$i]} (PID ${PIDS[$i]}) exited"
    fi
done

# Keep waiting
wait "${PIDS[@]}" 2>/dev/null || true
