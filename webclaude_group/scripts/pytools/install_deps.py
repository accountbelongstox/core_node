#!/usr/bin/env python3
"""
WebClaude Group - Dependency Installer

Checks and installs missing system dependencies for all services.
Uses core_node/scripts/shells/linux/ install scripts when available.

Usage:
    python3 scripts/pytools/install_deps.py

Idempotent: safe to run multiple times.
"""

import os
import shutil
import subprocess
import sys
import platform

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
SCRIPTS_DIR = os.path.dirname(SCRIPT_DIR)
GROUP_ROOT = os.path.dirname(SCRIPTS_DIR)
CORE_NODE = os.path.dirname(GROUP_ROOT)

# Relative path to core_node install scripts
LINUX_SCRIPTS = os.path.join(CORE_NODE, "scripts", "shells", "linux")
DEBIAN_INSTALL = os.path.join(LINUX_SCRIPTS, "debian", "install_shells")

GREEN = "\033[0;32m"
YELLOW = "\033[1;33m"
RED = "\033[0;31m"
GRAY = "\033[0;37m"
NC = "\033[0m"

def ok(msg):   print(f"  {GREEN}[OK]{NC}   {msg}", file=sys.stderr)
def warn(msg): print(f"  {YELLOW}[WARN]{NC} {msg}", file=sys.stderr)
def fail(msg): print(f"  {RED}[FAIL]{NC} {msg}", file=sys.stderr)
def info(msg): print(f"  {GRAY}[INFO]{NC} {msg}", file=sys.stderr)


def cmd_exists(name):
    return shutil.which(name) is not None


def run_cmd(cmd, timeout=120):
    """Run a command, return (success, output)."""
    try:
        result = subprocess.run(
            cmd, shell=isinstance(cmd, str),
            capture_output=True, text=True, timeout=timeout
        )
        return result.returncode == 0, result.stdout + result.stderr
    except Exception as e:
        return False, str(e)


def get_distro():
    """Detect Linux distribution."""
    if os.path.isfile("/etc/os-release"):
        with open("/etc/os-release") as f:
            for line in f:
                if line.startswith("ID="):
                    return line.split("=")[1].strip().strip('"').lower()
    return "unknown"


def run_install_script(script_name):
    """Run a core_node install script if it exists."""
    script_path = os.path.join(DEBIAN_INSTALL, script_name)
    if not os.path.isfile(script_path):
        return False
    info(f"Running install script: {script_name}")
    os.chmod(script_path, 0o755)
    success, output = run_cmd(f"bash '{script_path}'", timeout=300)
    if success:
        ok(f"Install script completed: {script_name}")
    else:
        warn(f"Install script had issues: {script_name}")
        # Print last 5 lines of output
        for line in output.strip().split("\n")[-5:]:
            info(f"  {line}")
    return success


def install_node():
    """Install Node.js 24+ if missing."""
    if cmd_exists("node"):
        version = subprocess.run(["node", "--version"], capture_output=True, text=True).stdout.strip()
        major = int(version.lstrip("v").split(".")[0]) if version else 0
        if major >= 18:
            ok(f"Node.js {version} already installed")
            return True
        warn(f"Node.js {version} too old, upgrading...")

    # Try core_node install script first
    if run_install_script("14_install_node_24.sh"):
        return True

    # Fallback: NodeSource
    distro = get_distro()
    if distro in ("debian", "ubuntu"):
        info("Installing Node.js via NodeSource...")
        run_cmd("curl -fsSL https://deb.nodesource.com/setup_24.x | bash -", timeout=60)
        success, _ = run_cmd("apt-get install -y nodejs", timeout=120)
        if success and cmd_exists("node"):
            ok(f"Node.js installed: {subprocess.run(['node', '--version'], capture_output=True, text=True).stdout.strip()}")
            return True

    fail("Could not install Node.js. Install manually: https://nodejs.org/")
    return False


def install_pnpm():
    """Install pnpm if missing."""
    if cmd_exists("pnpm"):
        ok("pnpm already installed")
        return True
    if cmd_exists("npm"):
        info("Installing pnpm via npm...")
        success, _ = run_cmd("npm install -g pnpm")
        if success:
            ok("pnpm installed")
            return True
    fail("Could not install pnpm")
    return False


def install_go():
    """Install Go if missing."""
    if cmd_exists("go"):
        ok(f"Go already installed: {subprocess.run(['go', 'version'], capture_output=True, text=True).stdout.strip()}")
        return True

    info("Installing Go...")
    arch = platform.machine()
    go_arch = "amd64" if arch == "x86_64" else "arm64" if "aarch64" in arch else arch

    # Download and install
    go_ver = "1.24.4"
    url = f"https://go.dev/dl/go{go_ver}.linux-{go_arch}.tar.gz"
    info(f"Downloading {url}...")
    success, _ = run_cmd(f"curl -fsSL '{url}' | tar -C /usr/local -xz", timeout=120)
    if success:
        # Add to PATH
        go_bin = "/usr/local/go/bin"
        if go_bin not in os.environ.get("PATH", ""):
            os.environ["PATH"] = f"{go_bin}:{os.environ.get('PATH', '')}"
            # Persist
            profile_line = f'export PATH="{go_bin}:$PATH"'
            for profile in ["/etc/profile.d/go.sh"]:
                with open(profile, "w") as f:
                    f.write(profile_line + "\n")

        if cmd_exists("go") or os.path.isfile(f"{go_bin}/go"):
            ok(f"Go installed at {go_bin}")
            return True

    fail("Could not install Go. Install manually: https://go.dev/dl/")
    return False


def install_python_deps():
    """Install Python dependencies for claude_host."""
    req_file = os.path.join(CORE_NODE, "pyapps", "claude_host", "requirements.txt")
    if not os.path.isfile(req_file):
        return True

    # Check if websockets is installed
    try:
        subprocess.run([sys.executable, "-c", "import websockets"], capture_output=True, check=True, timeout=10)
        ok("Python websockets module installed")
    except Exception:
        info("Installing Python dependencies...")
        run_cmd(f"{sys.executable} -m pip install -r '{req_file}'", timeout=60)

    # Check watchdog
    try:
        subprocess.run([sys.executable, "-c", "import watchdog"], capture_output=True, check=True, timeout=10)
        ok("Python watchdog module installed")
    except Exception:
        info("Installing watchdog for hot-reload...")
        run_cmd(f"{sys.executable} -m pip install watchdog", timeout=30)

    return True


def install_redis():
    """Install Redis if not available (optional)."""
    if cmd_exists("redis-server"):
        ok("Redis already installed")
        return True

    distro = get_distro()
    if distro in ("debian", "ubuntu"):
        info("Installing Redis (optional, for caching)...")
        success, _ = run_cmd("apt-get install -y redis-server", timeout=60)
        if success:
            run_cmd("systemctl enable redis-server")
            run_cmd("systemctl start redis-server")
            ok("Redis installed and started")
            return True

    warn("Redis not installed (optional, app runs in degraded mode)")
    return False


def main():
    print("", file=sys.stderr)
    print("  WebClaude Group - Dependency Installer", file=sys.stderr)
    print("", file=sys.stderr)

    if os.geteuid() != 0 if hasattr(os, 'geteuid') else False:
        warn("Not running as root. Some installations may fail.")
        info("Run with: sudo python3 scripts/pytools/install_deps.py")

    results = {
        "node": install_node(),
        "pnpm": install_pnpm(),
        "go": install_go(),
        "python_deps": install_python_deps(),
        "redis": install_redis(),
    }

    print("", file=sys.stderr)
    failed = [k for k, v in results.items() if not v]
    if failed:
        warn(f"Some dependencies could not be installed: {', '.join(failed)}")
    else:
        ok("All dependencies installed!")
    print("", file=sys.stderr)


if __name__ == "__main__":
    main()
