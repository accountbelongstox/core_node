#!/usr/bin/env python3
from __future__ import annotations

import argparse
import getpass
import os
import re
import shutil
import signal
import socket
import subprocess
import sys
import threading
import time
from datetime import datetime
from pathlib import Path

from adb_connect import (
    ADB_DEFAULT_PORT, NO_WINDOW, adb, connect_authorized, load_json, log, log_lines, pair_device, resolve_device, scan_and_connect,
    show_mdns, switch_usb_devices_to_wifi, timed_yes_no, unique_serials, write_json,
)


SERVICE_CONTRACT = Path("config") / "service_contract.json"
OWNERSHIP_HELPER = Path("scripts") / "shells" / "linux" / "common" / "fs_perm_helpers.sh"
OWNER_RESOLVE_SCRIPT = 'source "$1" >/dev/null 2>&1 && resolve_active_permission_owner'
OWNER_REPAIR_SCRIPT = 'source "$1" >/dev/null 2>&1 && shift && for p; do repair_owned_tree_777 "$p"; done'
RUN_USER_ROOT = Path("/run/user")
DEFAULT_X_DISPLAY = ":0"
LIVE_RELOAD_PORT_KEY = "native_live_reload"
DEVTOOLS_PORT_KEY = "webview_devtools"
LIVE_DIR = Path("artifacts") / "live-reload"
SERVER_STATE = "server.json"
SERVER_LOG = "vite.log"
SESSION_STATE = "session.json"
SESSION_LOG = "current.log"
COLLECTOR_LOG = "collector.log"
SESSION_ARCHIVE_PREFIX = "session-"
SESSION_ARCHIVE_KEEP = 10
DEBUG_ROUTE = "/__debug"
CAPACITOR_CONFIG = "capacitor.config.json"
APK_GLOB = "native/{app}/android/app/build/outputs/apk/*/*.apk"
FLAVOR_MANIFEST = Path("flavors") / "{app}" / "flavor.json"
SIGNATURE_MISMATCH = "INSTALL_FAILED_UPDATE_INCOMPATIBLE"
# Signature-mismatch prompt: uninstall + reinstall is the default after this many seconds.
UNINSTALL_PROMPT_SECONDS = 3
DEVTOOLS_SOCKET = "localabstract:webview_devtools_remote_{pid}"
JS_CONSOLE_TAG = " Capacitor/Console"
ENV_DEBUG_LOG = "CORE_DEBUG_LOG"
ENV_DEBUG_STATE = "CORE_DEBUG_STATE"
ENV_DEBUG_ROUTE = "CORE_DEBUG_ROUTE"
WAIT_TIMEOUT_SECONDS = 90
SESSION_READY_SECONDS = 20
POLL_SECONDS = 2
FOLLOW_POLL_SECONDS = 0.3
LEVEL_PATTERN = re.compile(r" ([VDIWEF]) \S")
LEVEL_COLORS = {"V": "\033[90m", "D": "\033[36m", "I": "\033[32m", "W": "\033[33m", "E": "\033[31m", "F": "\033[1;31m"}
COLOR_RESET = "\033[0m"


def fail(message: str, code: int = 2) -> None:
    log(f"ERROR: {message}")
    raise SystemExit(code)


def contract(root: Path) -> dict:
    document = load_json(root.parents[1] / SERVICE_CONTRACT)
    if not document:
        fail(f"Cannot read {root.parents[1] / SERVICE_CONTRACT}")
    return document


def live_dir(root: Path) -> Path:
    directory = root / LIVE_DIR
    directory.mkdir(parents=True, exist_ok=True)
    return directory


def loopback_url(root: Path, port_key: str) -> str:
    document = contract(root)
    return f"http://{document['hosts']['loopback']}:{int(document['ports'][port_key])}"


def debug_environment(root: Path) -> dict[str, str]:
    directory = live_dir(root)
    return {
        ENV_DEBUG_LOG: str(directory / SESSION_LOG),
        ENV_DEBUG_STATE: str(directory / SESSION_STATE),
        ENV_DEBUG_ROUTE: DEBUG_ROUTE,
    }


def real_user(root: Path) -> str:
    helper = root.parents[1] / OWNERSHIP_HELPER
    result = subprocess.run(["bash", "-c", OWNER_RESOLVE_SCRIPT, "bash", str(helper)], capture_output=True,
                            text=True, check=False)
    lines = result.stdout.strip().splitlines()
    return lines[-1] if lines else ""


def real_user_prefix(root: Path, desktop: bool = False) -> list[str]:
    if os.name == "nt" or os.geteuid() != 0 or not shutil.which("runuser"):
        return []
    import pwd

    owner = real_user(root)
    if not owner or owner == "root":
        return []
    entry = pwd.getpwnam(owner)
    session = [f"HOME={entry.pw_dir}", f"USER={owner}", f"LOGNAME={owner}"]
    if desktop:
        runtime_dir = RUN_USER_ROOT / str(entry.pw_uid)
        session += [
            f"XDG_RUNTIME_DIR={runtime_dir}",
            f"DBUS_SESSION_BUS_ADDRESS=unix:path={runtime_dir / 'bus'}",
            f"DISPLAY={os.environ.get('DISPLAY') or DEFAULT_X_DISPLAY}",
        ]
        wayland = sorted(item.name for item in runtime_dir.glob("wayland-*") if not item.name.endswith(".lock"))
        if wayland:
            session.append(f"WAYLAND_DISPLAY={wayland[0]}")
    return ["runuser", "-u", owner, "--", "env", *session]


def runner_name(root: Path) -> str:
    prefix = real_user_prefix(root)
    return prefix[2] if prefix else getpass.getuser()


def foreign_owned(paths: list[Path]) -> bool:
    uid = os.geteuid()
    if uid == 0:
        return True
    for path in paths:
        if not path.exists():
            continue
        if path.stat().st_uid != uid:
            return True
        for current, directories, files in os.walk(path):
            for name in directories + files:
                entry = Path(current) / name
                if not entry.is_symlink() and entry.stat().st_uid != uid:
                    return True
    return False


def restore_ownership(root: Path, paths: list[Path]) -> None:
    existing = [str(path) for path in paths if path.exists()]
    if os.name == "nt" or not existing or not foreign_owned(paths):
        return
    subprocess.run(["bash", "-c", OWNER_REPAIR_SCRIPT, "bash", str(root.parents[1] / OWNERSHIP_HELPER), *existing],
                   check=False)


def port_open(host: str, port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as probe:
        probe.settimeout(1)
        return probe.connect_ex((host, port)) == 0


def wait_port(host: str, port: int, expected: bool) -> bool:
    deadline = time.monotonic() + WAIT_TIMEOUT_SECONDS
    while time.monotonic() < deadline:
        if port_open(host, port) == expected:
            return True
        time.sleep(1)
    return False


def stop_process_tree(pid: int) -> None:
    try:
        if os.name == "nt":
            subprocess.run(["taskkill", "/T", "/F", "/PID", str(pid)], check=False, capture_output=True, **NO_WINDOW)
        else:
            os.killpg(pid, signal.SIGTERM)
    except (OSError, ProcessLookupError):
        pass


def spawn_detached(root: Path, command: list[str], environment: dict[str, str], output: Path) -> int:
    detach = {"creationflags": subprocess.CREATE_NEW_PROCESS_GROUP | subprocess.DETACHED_PROCESS} if os.name == "nt" \
        else {"start_new_session": True}
    with open(output, "wb") as stream:
        pass
    restore_ownership(root, [output.parent])
    with open(output, "ab") as stream:
        process = subprocess.Popen(real_user_prefix(root) + command, cwd=root, env=environment,
                                   stdin=subprocess.DEVNULL, stdout=stream, stderr=subprocess.STDOUT, **detach)
    return process.pid


def ensure_live_server(root: Path, app: dict, bun: str, environment: dict[str, str]) -> str:
    document = contract(root)
    host = str(document["hosts"]["loopback"])
    port = int(document["ports"][LIVE_RELOAD_PORT_KEY])
    directory = live_dir(root)
    state_path = directory / SERVER_STATE
    state = load_json(state_path)
    debug = debug_environment(root)
    runner = runner_name(root)
    url = f"http://{host}:{port}"
    if port_open(host, port) and state.get("flavor") == app["id"] and state.get("debug") == debug \
            and state.get("runner") == runner:
        log(f"Live-reload dev server already serving {app['id']}: {url}")
        return url
    if state.get("pid"):
        log(f"Restarting the live-reload dev server (pid {state['pid']}, flavor {state.get('flavor')}).")
        stop_process_tree(int(state["pid"]))
        wait_port(host, port, False)
    if port_open(host, port):
        fail(f"Port {port} ({LIVE_RELOAD_PORT_KEY}) is used by another process.")
    pid = spawn_detached(
        root, [bun, "x", "vite", "--port", str(port), "--strictPort", "--host", str(document["hosts"]["any"])],
        {**environment, **debug}, directory / SERVER_LOG,
    )
    write_json(state_path, {"pid": pid, "flavor": app["id"], "url": url, "debug": debug, "runner": runner})
    if not wait_port(host, port, True):
        fail(f"Live-reload dev server did not start; see {directory / SERVER_LOG}")
    log(f"Live-reload dev server started for {app['id']}: {url}")
    return url


def app_id(root: Path, app: str = "") -> str:
    identifier = ""
    if app:
        identifier = load_json(root / str(FLAVOR_MANIFEST).format(app=app)).get("appId")
    identifier = identifier or load_json(root / CAPACITOR_CONFIG).get("appId")
    if not identifier:
        fail(f"appId is missing in {root / CAPACITOR_CONFIG}")
    return str(identifier)


def app_pid(adb_bin: str, serial: str, identifier: str) -> str:
    fields = adb(adb_bin, serial, "shell", "pidof", identifier).split()
    return fields[0] if fields and fields[0].isdigit() else ""


def latest_apk(root: Path, app: str = "") -> str:
    candidates = sorted(root.glob(APK_GLOB.format(app=app or "*")), key=lambda candidate: candidate.stat().st_mtime)
    return str(candidates[-1]) if candidates else ""


def confirm_uninstall(adb_bin: str, serial: str, identifier: str, interactive: bool) -> bool:
    log(f"Install blocked on {serial}: {identifier} is installed but signed with a different keystore "
        f"({SIGNATURE_MISMATCH}). Typical cause: the installed build came from the other OS of this dual-boot "
        "machine (each OS has its own debug keystore) or from a release build.")
    log("Uninstalling erases the app's on-device data (login, local files). Nothing has been uninstalled.")
    if not interactive:
        log(f"Non-interactive run: not uninstalling. To replace it manually: {adb_bin} -s {serial} uninstall {identifier}")
        return False
    return timed_yes_no(f"Uninstall {identifier} from {serial} (erases its data) and reinstall? "
                        f"Default yes in {UNINSTALL_PROMPT_SECONDS}s;", UNINSTALL_PROMPT_SECONDS, True)


def install_one(adb_bin: str, serial: str, apk: str, identifier: str, interactive: bool) -> bool:
    log(f"Installing {apk} to {serial}...")
    output = adb(adb_bin, serial, "install", "-r", apk)
    if "Success" not in output and SIGNATURE_MISMATCH in output:
        if not confirm_uninstall(adb_bin, serial, identifier, interactive):
            return False
        log_lines(adb(adb_bin, serial, "uninstall", identifier))
        output = adb(adb_bin, serial, "install", "-r", apk)
    if "Success" not in output:
        log(f"Install failed on {serial}: {output.strip()}")
        return False
    package = adb(adb_bin, serial, "shell", "dumpsys", "package", identifier)
    details = [line.strip() for line in package.splitlines() if line.strip().startswith(("versionName=", "lastUpdateTime="))]
    log(f"Installed on {serial}: {' '.join(details[:2])}")
    return True


def install(root: Path, adb_bin: str, apk: str, app: str, interactive: bool) -> bool:
    identifier = app_id(root, app)
    serials = unique_serials(adb_bin)
    if not serials:
        log("No online device. Connect one first (one-click debug or a WiFi connect action).")
        return False
    return all([install_one(adb_bin, serial, apk, identifier, interactive) for serial in serials])


def rotate_session_log(directory: Path) -> Path:
    current = directory / SESSION_LOG
    if current.is_file() and current.stat().st_size > 0:
        stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
        os.replace(current, directory / f"{SESSION_ARCHIVE_PREFIX}{stamp}.log")
    archives = sorted(directory.glob(f"{SESSION_ARCHIVE_PREFIX}*.log"))
    for stale in archives[:-SESSION_ARCHIVE_KEEP]:
        stale.unlink(missing_ok=True)
    current.touch()
    return current


def stop_collector(root: Path) -> None:
    state = load_json(live_dir(root) / SESSION_STATE)
    if state.get("collector_pid"):
        stop_process_tree(int(state["collector_pid"]))


def attach(root: Path, adb_bin: str, follow_logs: bool, app: str) -> None:
    directory = live_dir(root)
    identifier = app_id(root, app)
    live_port = int(contract(root)["ports"][LIVE_RELOAD_PORT_KEY])
    stop_collector(root)
    rotate_session_log(directory)
    serials = unique_serials(adb_bin)
    if not serials:
        fail("No online device to attach.")
    for serial in serials:
        adb(adb_bin, serial, "reverse", f"tcp:{live_port}", f"tcp:{live_port}")
        adb(adb_bin, serial, "logcat", "-c")
        adb(adb_bin, serial, "shell", "am", "force-stop", identifier)
        adb(adb_bin, serial, "shell", "monkey", "-p", identifier, "-c", "android.intent.category.LAUNCHER", "1")
        log(f"Live reload attached: {serial} -> tcp:{live_port}, launched {identifier}.")
    state_path = directory / SESSION_STATE
    write_json(state_path, {})
    spawn_detached(
        root, [sys.executable, str(Path(__file__).resolve()), "collect", "--root", str(root), "--adb", adb_bin,
               "--app-id", identifier, "--serials", *serials],
        os.environ.copy(), directory / COLLECTOR_LOG,
    )
    deadline = time.monotonic() + SESSION_READY_SECONDS
    while time.monotonic() < deadline:
        devices = load_json(state_path).get("devices") or []
        if devices and all(device.get("cdp_url") for device in devices):
            break
        time.sleep(1)
    print_info(root)
    if follow_logs and sys.stdin.isatty() and sys.stdout.isatty():
        follow(root)


def watch_app_pid(adb_bin: str, serial: str, identifier: str, pid: str, stream: subprocess.Popen) -> None:
    """Terminates the logcat stream once the app's pid is no longer `pid` (restart, exit, kill)."""
    while stream.poll() is None:
        time.sleep(POLL_SECONDS)
        if app_pid(adb_bin, serial, identifier) != pid:
            stream.terminate()
            return


def collect(root: Path, adb_bin: str, identifier: str, serials: list[str]) -> None:
    directory = live_dir(root)
    state_path = directory / SESSION_STATE
    devtools_base = int(contract(root)["ports"][DEVTOOLS_PORT_KEY])
    host = str(contract(root)["hosts"]["loopback"])
    lock = threading.Lock()
    devices: dict[str, dict] = {}
    sink = open(directory / SESSION_LOG, "a", encoding="utf-8", buffering=1)

    def publish() -> None:
        write_json(state_path, {
            "collector_pid": os.getpid(),
            "app_id": identifier,
            "log_file": str(directory / SESSION_LOG),
            "devices": [devices[serial] for serial in serials if serial in devices],
            "updated": datetime.now().isoformat(timespec="seconds"),
        })

    def device_loop(serial: str, devtools_port: int) -> None:
        while True:
            pid = app_pid(adb_bin, serial, identifier)
            if not pid:
                time.sleep(POLL_SECONDS)
                continue
            adb(adb_bin, serial, "forward", f"tcp:{devtools_port}", DEVTOOLS_SOCKET.format(pid=pid))
            with lock:
                devices[serial] = {"serial": serial, "app_pid": pid, "cdp_port": devtools_port,
                                   "cdp_url": f"http://{host}:{devtools_port}/json"}
                publish()
            stream = subprocess.Popen([adb_bin, "-s", serial, "logcat", "-v", "threadtime", f"--pid={pid}"],
                                      stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, errors="replace",
                                      **NO_WINDOW)
            # `logcat --pid` keeps running after the process dies: stop it when the app restarts or
            # exits, so the loop re-attaches to the new process instead of following a dead pid.
            threading.Thread(target=watch_app_pid, args=(adb_bin, serial, identifier, pid, stream), daemon=True).start()
            with lock:
                sink.write(f"{serial} [collector] attached to {identifier} pid {pid}\n")
            for line in stream.stdout:
                if JS_CONSOLE_TAG in line:
                    continue
                with lock:
                    sink.write(f"{serial} {line.rstrip()}\n")
            stream.wait()
            time.sleep(POLL_SECONDS)

    with lock:
        publish()
    workers = [threading.Thread(target=device_loop, args=(serial, devtools_base + index), daemon=True)
               for index, serial in enumerate(serials)]
    for worker in workers:
        worker.start()
    for worker in workers:
        worker.join()


def print_info(root: Path) -> None:
    directory = live_dir(root)
    state = load_json(directory / SESSION_STATE)
    http_base = f"{loopback_url(root, LIVE_RELOAD_PORT_KEY)}{DEBUG_ROUTE}"
    log("=== AI debug access (live, updated continuously) ===")
    log(f"Log file:      {directory / SESSION_LOG}")
    log(f"HTTP logs:     {http_base}/logs?since=0   (incremental: pass the returned 'next')")
    log(f"HTTP session:  {http_base}/session")
    for device in state.get("devices") or []:
        log(f"DevTools CDP:  {device['cdp_url']}   ({device['serial']}, app pid {device['app_pid']})")
    log("Chrome UI:     chrome://inspect/#devices")
    log(f"Refresh info:  {sys.executable} {Path(__file__).resolve()} info --root {root}")


def colorize(line: str) -> str:
    match = LEVEL_PATTERN.search(line)
    color = LEVEL_COLORS.get(match.group(1)) if match else None
    return f"{color}{line}{COLOR_RESET}" if color else line


def follow(root: Path) -> None:
    path = live_dir(root) / SESSION_LOG
    color = sys.stdout.isatty()
    if color and os.name == "nt":
        os.system("")
    log(f"Following {path} (Ctrl+C stops the view; collection keeps running).")
    position = 0
    pending = ""
    try:
        while True:
            size = path.stat().st_size if path.is_file() else 0
            if size < position:
                position = 0
                pending = ""
            if size > position:
                with open(path, "r", encoding="utf-8", errors="replace") as stream:
                    stream.seek(position)
                    chunk = stream.read()
                    position = stream.tell()
                lines = (pending + chunk).split("\n")
                pending = lines.pop()
                for line in lines:
                    print(colorize(line) if color else line, flush=True)
            time.sleep(FOLLOW_POLL_SECONDS)
    except KeyboardInterrupt:
        print("", flush=True)
        log("Log view stopped; collection continues in the background.")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Device-side native debugging: connect, install, attach, live logs, DevTools.")
    parser.add_argument("action", choices=("latest-apk", "install", "attach", "collect", "follow", "info", "stop",
                                           "connect", "scan", "pair", "tcpip", "mdns"))
    parser.add_argument("--root", required=True, help="UI project root")
    parser.add_argument("--adb", default="adb", help="adb binary")
    parser.add_argument("--apk", default="", help="APK to install (latest build when omitted)")
    parser.add_argument("--app", default="", help="app flavor id (selects its APK and appId)")
    parser.add_argument("--app-id", default="")
    parser.add_argument("--serials", nargs="*", default=[])
    parser.add_argument("--target", default="", help="connect/pair target (connect: IP[:PORT]; pair: IP:PAIR_PORT)")
    parser.add_argument("--code", default="", help="pairing code")
    parser.add_argument("--port", type=int, default=ADB_DEFAULT_PORT, help="adb tcpip port")
    parser.add_argument("--no-follow", action="store_true")
    parser.add_argument("--non-interactive", action="store_true")
    return parser.parse_args()


def device_action(args: argparse.Namespace, root: Path, interactive: bool) -> None:
    state_dir = live_dir(root)
    if args.action == "connect":
        if args.target:
            connect_authorized(args.adb, args.target)
        else:
            resolve_device(args.adb, state_dir, interactive)
    elif args.action == "scan":
        scan_and_connect(args.adb, state_dir)
    elif args.action == "pair":
        pair_device(args.adb, args.target, args.code, interactive)
    elif args.action == "tcpip":
        switch_usb_devices_to_wifi(args.adb, state_dir, args.port)
    elif args.action == "mdns":
        show_mdns(args.adb)


def main() -> int:
    args = parse_args()
    root = Path(args.root).resolve()
    interactive = not args.non_interactive and sys.stdin.isatty() and sys.stdout.isatty()
    if args.action == "latest-apk":
        print(latest_apk(root, args.app))
    elif args.action == "install":
        apk = args.apk or latest_apk(root, args.app)
        if not apk:
            fail("APK not found. Build first.")
        return 0 if install(root, args.adb, apk, args.app, interactive) else 1
    elif args.action == "attach":
        attach(root, args.adb, not args.no_follow, args.app)
    elif args.action == "collect":
        collect(root, args.adb, args.app_id, args.serials)
    elif args.action == "follow":
        follow(root)
    elif args.action == "info":
        print_info(root)
    elif args.action == "stop":
        stop_collector(root)
    else:
        device_action(args, root, interactive)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
