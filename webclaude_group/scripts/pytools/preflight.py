#!/usr/bin/env python3
"""
WebClaude Group - Preflight Check & Environment Setup

Handles ALL configuration reading, env initialization, and environment
validation. Outputs results as simple KEY=VALUE lines to stdout for
the shell script to source.

Usage:
    eval "$(python3 scripts/pytools/preflight.py [services])"

Output (sourced by shell):
    PREFLIGHT_OK=1              # 1=all checks passed, 0=errors found
    PREFLIGHT_ERRORS=0          # number of errors
    DB_TYPE=sqlite              # resolved database type
    DB_HOST=127.0.0.1
    DB_PORT=3306
    REDIS_HOST=127.0.0.1
    REDIS_PORT=6379
    CENTER_PORT=18100
    GATEWAY_PORT=18200
    HAS_NODEMON=1
    HAS_AIR=0
    HAS_WATCHDOG=1
    PY_CMD=python3
"""

import os
import shutil
import socket
import subprocess
import sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
SCRIPTS_DIR = os.path.dirname(SCRIPT_DIR)
GROUP_ROOT = os.path.dirname(SCRIPTS_DIR)
CORE_NODE = os.path.dirname(GROUP_ROOT)

# Import our env tools
sys.path.insert(0, SCRIPT_DIR)
from init_env import main as init_env_main
from env_reader import read_env, get_env_value

# ── Colors ──────────────────────────────────────────────────
GREEN = "\033[0;32m"
YELLOW = "\033[1;33m"
RED = "\033[0;31m"
GRAY = "\033[0;37m"
CYAN = "\033[0;36m"
NC = "\033[0m"

def ok(msg):   print(f"  {GREEN}[OK]{NC}   {msg}", file=sys.stderr)
def warn(msg): print(f"  {YELLOW}[WARN]{NC} {msg}", file=sys.stderr)
def fail(msg): print(f"  {RED}[FAIL]{NC} {msg}", file=sys.stderr)
def info(msg): print(f"  {GRAY}[INFO]{NC} {msg}", file=sys.stderr)
def header(msg): print(f"\n{CYAN}=== {msg} ==={NC}", file=sys.stderr)


def check_tcp(host, port, timeout=2):
    """Check if TCP port is reachable."""
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.settimeout(timeout)
    result = s.connect_ex((str(host), int(port)))
    s.close()
    return result == 0


def check_command(name):
    """Check if a command exists in PATH."""
    return shutil.which(name) is not None


def get_command_version(cmd, args=None):
    """Get version output of a command."""
    if args is None:
        args = ["--version"]
    full_cmd = [cmd] + args
    try:
        result = subprocess.run(full_cmd, capture_output=True, text=True, timeout=10)
        return result.stdout.strip() or result.stderr.strip()
    except Exception:
        return ""


def emit(key, value):
    """Output a KEY=VALUE line to stdout (for shell to source)."""
    # Shell-safe: quote the value
    safe_val = str(value).replace("'", "'\\''")
    print(f"{key}='{safe_val}'")


def main():
    services = sys.argv[1] if len(sys.argv) > 1 else "all"
    if services == "all":
        selected = {"center", "gateway", "website", "host"}
    else:
        selected = set()
        for s in services.split(","):
            s = s.strip().lower()
            if s in ("center", "server"): selected.add("center")
            elif s in ("gateway", "gw"): selected.add("gateway")
            elif s in ("website", "web"): selected.add("website")
            elif s in ("host", "claude"): selected.add("host")

    errors = 0

    # ── Phase 0: Init environment ───────────────────────────
    init_env_main()

    # ── Fix common issues (CRLF, DB_TYPE, etc.) ─────────────
    from fix_scripts import main as fix_scripts_main
    fix_scripts_main()

    # ── Phase 1: Environment checks ─────────────────────────
    header("Phase 1: Environment Checks")

    # .env paths
    center_env = os.path.join(GROUP_ROOT, "webclaude_center_server", ".env")
    gateway_env = os.path.join(GROUP_ROOT, "webclaude_go-gateway", ".env")
    center_cfg = read_env(center_env) if os.path.isfile(center_env) else {}
    gateway_cfg = read_env(gateway_env) if os.path.isfile(gateway_env) else {}

    # ── Node.js ─────────────────────────────────────────────
    if "center" in selected or "website" in selected:
        if check_command("node"):
            ver = get_command_version("node")
            # Extract major version number
            major = 0
            for part in ver.replace("v", "").split("."):
                if part.isdigit():
                    major = int(part)
                    break
            if major >= 18:
                ok(f"Node.js {ver}")
            else:
                fail(f"Node.js {ver} too old (need >= 18)")
                errors += 1
        else:
            fail("Node.js not found — install: https://nodejs.org/")
            errors += 1

    # ── pnpm ────────────────────────────────────────────────
    if "website" in selected:
        if check_command("pnpm"):
            ok(f"pnpm {get_command_version('pnpm')}")
        else:
            warn("pnpm not found, will try npx pnpm")

    # ── nodemon (optional) ──────────────────────────────────
    has_nodemon = check_command("nodemon")
    if "center" in selected:
        if has_nodemon:
            ok("nodemon found")
        else:
            warn("nodemon not found (will use npx nodemon)")
            info("Install: npm i -g nodemon")
    emit("HAS_NODEMON", "1" if has_nodemon else "0")

    # ── Go ──────────────────────────────────────────────────
    if "gateway" in selected:
        if check_command("go"):
            ok(f"Go: {get_command_version('go', ['version'])}")
        else:
            fail("Go not found — install: https://go.dev/dl/")
            errors += 1

    # ── air (optional) ──────────────────────────────────────
    has_air = check_command("air")
    if "gateway" in selected:
        if has_air:
            ok("air found (hot-reload)")
        else:
            info("Install air for hot reload: go install github.com/air-verse/air@latest")
    emit("HAS_AIR", "1" if has_air else "0")

    # ── Python ──────────────────────────────────────────────
    py_cmd = ""
    for cmd in ["python3", "python"]:
        if check_command(cmd):
            py_cmd = cmd
            break

    has_watchdog = False
    if "host" in selected:
        if py_cmd:
            ok(f"{py_cmd} {get_command_version(py_cmd)}")
            # websockets
            try:
                subprocess.run([py_cmd, "-c", "import websockets"], capture_output=True, timeout=5)
                ok("Python websockets module")
            except Exception:
                warn("websockets not installed")
                info(f"Install: {py_cmd} -m pip install websockets")
            # watchdog
            try:
                r = subprocess.run([py_cmd, "-c", "import watchdog"], capture_output=True, timeout=5)
                has_watchdog = (r.returncode == 0)
                if has_watchdog:
                    ok("Python watchdog module")
                else:
                    info(f"Install watchdog for hot-reload: {py_cmd} -m pip install watchdog")
            except Exception:
                pass
        else:
            fail("Python not found")
            errors += 1
    emit("PY_CMD", py_cmd)
    emit("HAS_WATCHDOG", "1" if has_watchdog else "0")

    # ── Database ────────────────────────────────────────────
    db_type = get_env_value(center_cfg, "DB_TYPE", "sqlite").strip().lower()
    db_host = get_env_value(center_cfg, "DB_HOST", "127.0.0.1")
    db_port = get_env_value(center_cfg, "DB_PORT", "3306")

    if "center" in selected or "gateway" in selected:
        if db_type == "sqlite":
            ok("Database: SQLite mode (no MySQL needed)")
        else:
            port_int = int(db_port) if str(db_port).isdigit() else 3306
            if check_tcp(db_host, port_int):
                ok(f"MySQL reachable at {db_host}:{db_port}")
            else:
                fail(f"MySQL not reachable at {db_host}:{db_port}")
                info("Start MySQL or set DB_TYPE=sqlite in .env")
                errors += 1

    emit("DB_TYPE", db_type)
    emit("DB_HOST", db_host)
    emit("DB_PORT", db_port)

    # ── Redis (optional) ────────────────────────────────────
    redis_host = get_env_value(center_cfg, "REDIS_HOST", "127.0.0.1")
    redis_port = get_env_value(center_cfg, "REDIS_PORT", "6379")

    if "center" in selected or "gateway" in selected:
        port_int = int(redis_port) if str(redis_port).isdigit() else 6379
        if check_tcp(redis_host, port_int):
            ok(f"Redis reachable at {redis_host}:{redis_port}")
        else:
            warn("Redis not reachable (will be installed by start.sh via core_node scripts)")

    emit("REDIS_HOST", redis_host)
    emit("REDIS_PORT", redis_port)

    # ── Ports ───────────────────────────────────────────────
    center_port = get_env_value(center_cfg, "PORT", "18100")
    gateway_port = get_env_value(gateway_cfg, "PORT", "18200")
    emit("CENTER_PORT", center_port)
    emit("GATEWAY_PORT", gateway_port)

    # ── Summary ─────────────────────────────────────────────
    print("", file=sys.stderr)
    if errors > 0:
        fail(f"{errors} error(s) found. Fix above issues then retry.")
    else:
        ok("All checks passed!")
    print("", file=sys.stderr)

    emit("PREFLIGHT_OK", "1" if errors == 0 else "0")
    emit("PREFLIGHT_ERRORS", str(errors))


if __name__ == "__main__":
    main()
