#!/usr/bin/env python3

from __future__ import annotations

import argparse
import ctypes
import json
import os
import shutil
import signal
import socket
import subprocess
import sys
import tempfile
import threading
import time
import urllib.request
import webbrowser
from pathlib import Path
from typing import IO, Optional

PROJECT_ROOT = Path(__file__).resolve().parents[3]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from pycore.pyfoundations.service_contract import port, value as contract_value

APP_MUTEX_NAME = "Local\\CoreNodeMcpChromeServiceSupervisor"
LOCK_FILE_NAME = "core-node-mcp-chrome-supervisor.lock"
RECOVERY_REQUEST_FILE_NAME = "core-node-mcp-chrome-recovery.request"
WATCH_MODE_REQUEST_FILE_NAME = "core-node-mcp-chrome-watch-mode.request"
TAKEOVER_REQUEST_FILE_NAME = "core-node-mcp-chrome-takeover.request"
WAKE_STATE_FILE_NAME = "core-node-mcp-chrome-last-wake.state"
NATIVE_HOST_NAME = f"{contract_value('mcp_chrome.native_host_name')}.json"
BUILD_OUTPUT_DIR_NAME = contract_value("mcp_chrome.build_output_dir")
EXTENSION_DIR_NAME = contract_value("mcp_chrome.extension_dir")
EXTENSION_ID = contract_value("mcp_chrome.extension_id")
NATIVE_RECONNECT_PAGE = contract_value("mcp_chrome.native_reconnect_page")
EXTENSION_RELOAD_PAGE = contract_value("mcp_chrome.extension_reload_page")
MCP_PORT = port("mcp_chrome")
POLL_INTERVAL_SECONDS = 2.0
RESTART_DELAY_SECONDS = 2.0
BUILD_RELOAD_GRACE_SECONDS = 15.0
WAKE_MIN_INTERVAL_SECONDS = 5.0
TAKEOVER_WAIT_SECONDS = 30.0
WINDOWS_ALREADY_EXISTS = 183
WINDOWS_SYNCHRONIZE = 0x00100000
WINDOWS_WAIT_OBJECT_0 = 0
WATCH_MODE_DEV = "dev"
WATCH_MODE_ONCE = "once"
stop_event = threading.Event()
windows_mutex_handle: Optional[int] = None
posix_lock_file: Optional[IO[str]] = None
owner_process_id = 0
owner_process_handle: Optional[int] = None


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    args: Optional[argparse.Namespace] = None

    parser.add_argument("--project-root")
    parser.add_argument("--recover-on-start", action="store_true")
    parser.add_argument("--watch-mode", choices=[WATCH_MODE_DEV, WATCH_MODE_ONCE])
    parser.add_argument("--foreground", action="store_true")
    parser.add_argument("--wake", action="store_true")
    parser.add_argument("--parent-pid", type=int, default=0)
    args = parser.parse_args()
    if not args.wake and not args.project_root:
        parser.error("--project-root is required unless --wake is used")
    return args


def windows_kernel32() -> ctypes.WinDLL:
    kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)

    kernel32.CreateMutexW.argtypes = [ctypes.c_void_p, ctypes.c_bool, ctypes.c_wchar_p]
    kernel32.CreateMutexW.restype = ctypes.c_void_p
    kernel32.OpenProcess.argtypes = [ctypes.c_uint32, ctypes.c_bool, ctypes.c_uint32]
    kernel32.OpenProcess.restype = ctypes.c_void_p
    kernel32.WaitForSingleObject.argtypes = [ctypes.c_void_p, ctypes.c_uint32]
    kernel32.WaitForSingleObject.restype = ctypes.c_uint32
    kernel32.CloseHandle.argtypes = [ctypes.c_void_p]
    kernel32.CloseHandle.restype = ctypes.c_bool
    return kernel32


# An owned supervisor (--parent-pid) exits with its launcher: a stopped Windows
# logon task ends only its PowerShell host, never the processes it started.
def attach_owner_process(parent_pid: int) -> bool:
    global owner_process_id
    global owner_process_handle

    owner_process_id = parent_pid
    if os.name != "nt":
        return owner_process_alive()
    owner_process_handle = windows_kernel32().OpenProcess(WINDOWS_SYNCHRONIZE, False, parent_pid)
    return bool(owner_process_handle)


def owner_process_alive() -> bool:
    if owner_process_id <= 0:
        return True
    if os.name == "nt":
        if not owner_process_handle:
            return False
        return windows_kernel32().WaitForSingleObject(owner_process_handle, 0) != WINDOWS_WAIT_OBJECT_0
    try:
        os.kill(owner_process_id, 0)
    except ProcessLookupError:
        return False
    except PermissionError:
        return True
    return True


def release_owner_process() -> None:
    global owner_process_handle

    if owner_process_handle:
        windows_kernel32().CloseHandle(owner_process_handle)
        owner_process_handle = None


def acquire_singleton() -> bool:
    global windows_mutex_handle
    global posix_lock_file

    if os.name == "nt":
        kernel32 = windows_kernel32()
        handle = kernel32.CreateMutexW(None, False, APP_MUTEX_NAME)
        if not handle:
            raise ctypes.WinError(ctypes.get_last_error())
        if ctypes.get_last_error() == WINDOWS_ALREADY_EXISTS:
            kernel32.CloseHandle(handle)
            return False
        windows_mutex_handle = handle
        return True

    import fcntl

    lock_path = Path(tempfile.gettempdir()) / LOCK_FILE_NAME
    lock_file = lock_path.open("a+", encoding="utf-8")
    try:
        fcntl.flock(lock_file.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        lock_file.close()
        return False
    lock_file.seek(0)
    lock_file.truncate()
    lock_file.write(str(os.getpid()))
    lock_file.flush()
    posix_lock_file = lock_file
    return True


def release_singleton() -> None:
    global windows_mutex_handle
    global posix_lock_file

    if windows_mutex_handle is not None:
        windows_kernel32().CloseHandle(windows_mutex_handle)
        windows_mutex_handle = None
    if posix_lock_file is not None:
        posix_lock_file.close()
        posix_lock_file = None


def handle_stop_signal(_signal_number: int, _frame: object) -> None:
    stop_event.set()


def port_is_listening() -> bool:
    try:
        with socket.create_connection(("127.0.0.1", MCP_PORT), timeout=0.5):
            return True
    except OSError:
        return False


def extension_is_connected() -> bool:
    try:
        with urllib.request.urlopen(
            f"http://127.0.0.1:{MCP_PORT}/health",
            timeout=0.5,
        ) as response:
            payload = json.loads(response.read().decode("utf-8"))
            return payload.get("extensionConnected") is True
    except (OSError, ValueError):
        return False


def recovery_request_path() -> Path:
    return Path(tempfile.gettempdir()) / RECOVERY_REQUEST_FILE_NAME


def request_recovery() -> None:
    recovery_request_path().write_text(str(time.time_ns()), encoding="utf-8")


def recovery_request_signature() -> Optional[int]:
    try:
        return recovery_request_path().stat().st_mtime_ns
    except OSError:
        return None


def watch_mode_request_path() -> Path:
    return Path(tempfile.gettempdir()) / WATCH_MODE_REQUEST_FILE_NAME


def request_watch_mode(watch_mode: str) -> None:
    watch_mode_request_path().write_text(watch_mode, encoding="utf-8")


def read_watch_mode_request() -> tuple[Optional[int], Optional[str]]:
    request_path = watch_mode_request_path()
    try:
        signature = request_path.stat().st_mtime_ns
        watch_mode = request_path.read_text(encoding="utf-8").strip()
    except OSError:
        return None, None
    if watch_mode not in {WATCH_MODE_DEV, WATCH_MODE_ONCE}:
        return signature, None
    return signature, watch_mode


def takeover_request_path() -> Path:
    return Path(tempfile.gettempdir()) / TAKEOVER_REQUEST_FILE_NAME


def request_takeover() -> None:
    takeover_request_path().write_text(str(time.time_ns()), encoding="utf-8")


def takeover_request_signature() -> Optional[int]:
    try:
        return takeover_request_path().stat().st_mtime_ns
    except OSError:
        return None


def manifest_candidates() -> list[Path]:
    home_path = Path.home()
    candidates: list[Path] = []

    if os.name == "nt":
        app_data = os.environ.get("APPDATA")
        if app_data:
            candidates.append(
                Path(app_data) / "Google" / "Chrome" / "NativeMessagingHosts" / NATIVE_HOST_NAME
            )
    elif sys.platform == "darwin":
        candidates.append(
            home_path
            / "Library"
            / "Application Support"
            / "Google"
            / "Chrome"
            / "NativeMessagingHosts"
            / NATIVE_HOST_NAME
        )
    else:
        candidates.extend(
            [
                home_path / ".config" / "google-chrome" / "NativeMessagingHosts" / NATIVE_HOST_NAME,
                Path("/etc/opt/chrome/native-messaging-hosts") / NATIVE_HOST_NAME,
            ]
        )
    return candidates


def extension_page_url(page: str) -> Optional[str]:
    for manifest_path in manifest_candidates():
        try:
            manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            continue
        for origin in manifest.get("allowed_origins", []):
            if isinstance(origin, str) and origin.startswith("chrome-extension://"):
                return f"{origin}{page}"
    return None


def windows_app_executable(executable_name: str) -> Optional[str]:
    if os.name != "nt":
        return None

    import winreg

    registry_roots = [winreg.HKEY_CURRENT_USER, winreg.HKEY_LOCAL_MACHINE]
    registry_paths = [
        rf"Software\Microsoft\Windows\CurrentVersion\App Paths\{executable_name}",
        rf"Software\WOW6432Node\Microsoft\Windows\CurrentVersion\App Paths\{executable_name}",
    ]
    for registry_root in registry_roots:
        for registry_path in registry_paths:
            try:
                with winreg.OpenKey(registry_root, registry_path) as registry_key:
                    executable_path, _value_type = winreg.QueryValueEx(registry_key, None)
            except OSError:
                continue
            candidate = Path(str(executable_path).strip('"'))
            if candidate.is_file():
                return str(candidate)
    return None


def wake_state_path() -> Path:
    return Path(tempfile.gettempdir()) / WAKE_STATE_FILE_NAME


def wake_interval_remaining(now: float) -> float:
    try:
        last_wake_at = float(wake_state_path().read_text(encoding="utf-8").strip())
    except (OSError, ValueError):
        return 0.0
    return max(0.0, WAKE_MIN_INTERVAL_SECONDS - (now - last_wake_at))


def record_wake(now: float) -> None:
    wake_state_path().write_text(str(now), encoding="utf-8")


def chrome_executable() -> Optional[str]:
    command = shutil.which("chrome") or shutil.which("google-chrome") or shutil.which("chromium")
    if command:
        return command
    if os.name != "nt":
        return None

    registered_command = windows_app_executable("chrome.exe")
    if registered_command:
        return registered_command

    candidates = [
        Path(os.environ.get("PROGRAMFILES", "")) / "Google" / "Chrome" / "Application" / "chrome.exe",
        Path(os.environ.get("PROGRAMFILES(X86)", "")) / "Google" / "Chrome" / "Application" / "chrome.exe",
        Path(os.environ.get("LOCALAPPDATA", "")) / "Google" / "Chrome" / "Application" / "chrome.exe",
    ]
    for candidate in candidates:
        if candidate.is_file():
            return str(candidate)
    return None


# Builds reload themselves (WXT dev client, build stamp, native host self-exit);
# waking only asks a disconnected extension to reconnect its native host.
def open_extension_page(page_url: str) -> None:
    chrome_path = chrome_executable()
    if chrome_path:
        subprocess.Popen([chrome_path, page_url], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    else:
        webbrowser.open(page_url, new=0, autoraise=False)


def wake_extension(force: bool = False) -> None:
    recovery_url = extension_page_url(NATIVE_RECONNECT_PAGE)
    now = time.time()
    remaining = wake_interval_remaining(now)

    if not force and remaining > 0:
        print(
            f"[Supervisor] Chrome extension wake deferred for {remaining:.0f}s.",
            flush=True,
        )
        return

    if not recovery_url:
        print("[Supervisor] Native host manifest has no Chrome extension origin.", flush=True)
        return
    try:
        open_extension_page(recovery_url)
        record_wake(now)
        print("[Supervisor] Requested Chrome extension reconnect.", flush=True)
    except OSError as error:
        print(f"[Supervisor] Could not wake the Chrome extension: {error}", flush=True)


def chrome_user_data_dirs() -> list[Path]:
    home_path = Path.home()

    if os.name == "nt":
        local_app_data = os.environ.get("LOCALAPPDATA")
        return [Path(local_app_data) / "Google" / "Chrome" / "User Data"] if local_app_data else []
    if sys.platform == "darwin":
        return [home_path / "Library" / "Application Support" / "Google" / "Chrome"]
    return [home_path / ".config" / "google-chrome", home_path / ".config" / "chromium"]


def registered_extension_paths() -> set[Path]:
    registered: set[Path] = set()

    for user_data_dir in chrome_user_data_dirs():
        for preferences_path in [*user_data_dir.glob("*/Preferences"), *user_data_dir.glob("*/Secure Preferences")]:
            try:
                preferences = json.loads(preferences_path.read_text(encoding="utf-8"))
            except (OSError, ValueError):
                continue
            settings = preferences.get("extensions", {}).get("settings", {}).get(EXTENSION_ID, {})
            extension_path = settings.get("path") if isinstance(settings, dict) else None
            if isinstance(extension_path, str) and Path(extension_path).is_absolute():
                registered.add(Path(extension_path))
    return registered


def link_directory(link_path: Path, target_path: Path) -> None:
    if os.name == "nt":
        subprocess.run(
            ["cmd", "/c", "mklink", "/J", str(link_path), str(target_path)],
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        return
    os.symlink(target_path, link_path, target_is_directory=True)


# A Chrome profile keeps the unpacked-extension folder it was loaded from; when
# that folder is an older repository build output, alias it to the live build so
# WXT dev reloads and build stamps reach the loaded extension.
def align_registered_extension_paths(project_root: Path) -> None:
    build_dir = (project_root / BUILD_OUTPUT_DIR_NAME / EXTENSION_DIR_NAME).resolve()
    stale_path: Optional[Path] = None

    for registered_path in registered_extension_paths():
        if project_root not in registered_path.parents or registered_path.resolve() == build_dir:
            continue
        try:
            if registered_path.is_symlink() or os.path.isjunction(registered_path):
                registered_path.unlink()
            elif registered_path.exists():
                stale_path = registered_path.with_name(f"{registered_path.name}.stale-{time.strftime('%Y%m%d%H%M%S')}")
                registered_path.rename(stale_path)
            registered_path.parent.mkdir(parents=True, exist_ok=True)
            link_directory(registered_path, build_dir)
            print(
                f"[Supervisor] Chrome loads the extension from {registered_path}; linked it to {build_dir}.",
                flush=True,
            )
            reload_url = extension_page_url(EXTENSION_RELOAD_PAGE)
            if reload_url:
                # Chrome keeps the old service worker across restarts until the
                # extension itself reloads.
                open_extension_page(reload_url)
        except (OSError, subprocess.CalledProcessError) as error:
            print(f"[Supervisor] Could not link {registered_path} to {build_dir}: {error}", flush=True)


def artifact_signature(project_root: Path) -> tuple[Optional[int], Optional[int]]:
    native_artifact = project_root / "app" / "native-server" / "dist" / "index.js"
    extension_manifest = project_root / BUILD_OUTPUT_DIR_NAME / EXTENSION_DIR_NAME / "manifest.json"

    def modified_ns(path: Path) -> Optional[int]:
        try:
            return path.stat().st_mtime_ns
        except OSError:
            return None

    return modified_ns(native_artifact), modified_ns(extension_manifest)


def supervise(project_root: Path, recover_on_start: bool, initial_watch_mode: str) -> int:
    signature = artifact_signature(project_root)
    request_signature = recovery_request_signature()
    watch_request_signature, _requested_watch_mode = read_watch_mode_request()
    takeover_signature = takeover_request_signature()
    watch_mode = initial_watch_mode
    pending_recovery_at: Optional[float] = time.monotonic() if recover_on_start else None

    print(f"[Supervisor] Watch mode: {watch_mode}.", flush=True)
    align_registered_extension_paths(project_root)

    while not stop_event.is_set():
        if not owner_process_alive():
            print(f"[Supervisor] Owner process {owner_process_id} exited; stopping.", flush=True)
            break

        current_takeover_signature = takeover_request_signature()
        if current_takeover_signature != takeover_signature:
            print("[Supervisor] Releasing the singleton for a foreground launcher.", flush=True)
            break

        current_watch_signature, current_watch_mode = read_watch_mode_request()
        if current_watch_signature != watch_request_signature:
            watch_request_signature = current_watch_signature
            if current_watch_mode is not None and current_watch_mode != watch_mode:
                watch_mode = current_watch_mode
                print(f"[Supervisor] Watch mode changed to: {watch_mode}.", flush=True)

        now = time.monotonic()
        current_signature = artifact_signature(project_root)
        if current_signature != signature:
            # A fresh build restarts the extension/native host on its own; check
            # once after that hot reload settles.
            signature = current_signature
            pending_recovery_at = now + BUILD_RELOAD_GRACE_SECONDS

        current_request_signature = recovery_request_signature()
        if current_request_signature != request_signature:
            request_signature = current_request_signature
            pending_recovery_at = now

        # Wake only on start, an explicit request or a code change; never poll.
        if pending_recovery_at is not None and now >= pending_recovery_at:
            pending_recovery_at = None
            if not (port_is_listening() and extension_is_connected()):
                wake_extension(force=True)

        stop_event.wait(POLL_INTERVAL_SECONDS)

    return 0


def main() -> int:
    args = parse_args()
    project_root: Optional[Path] = None

    if args.wake:
        if extension_is_connected():
            print("[Supervisor] Chrome extension is connected; no reconnect needed.", flush=True)
        else:
            wake_extension(force=True)
        return 0

    project_root = Path(args.project_root).resolve()
    if args.parent_pid > 0 and not attach_owner_process(args.parent_pid):
        print(f"[Supervisor] Owner process {args.parent_pid} is not running.", flush=True)
        return 0

    if args.recover_on_start:
        request_recovery()
    if args.watch_mode is not None:
        request_watch_mode(args.watch_mode)
    if args.foreground:
        request_takeover()
    singleton_acquired = acquire_singleton()
    if not singleton_acquired and args.foreground:
        print("[Supervisor] Waiting to take over the existing background supervisor.", flush=True)
        takeover_deadline = time.monotonic() + TAKEOVER_WAIT_SECONDS
        while time.monotonic() < takeover_deadline and not singleton_acquired:
            time.sleep(0.2)
            singleton_acquired = acquire_singleton()
    if not singleton_acquired and args.parent_pid > 0:
        # An owned supervisor waits its turn instead of exiting, so its owner
        # does not respawn it (and re-request recovery) every restart pause.
        print("[Supervisor] Waiting for the running supervisor instance to exit.", flush=True)
        while not singleton_acquired and owner_process_alive():
            time.sleep(POLL_INTERVAL_SECONDS)
            singleton_acquired = acquire_singleton()
    if not singleton_acquired:
        print("[Supervisor] An MCP Chrome supervisor instance is already running.", flush=True)
        release_owner_process()
        return 0
    try:
        signal.signal(signal.SIGINT, handle_stop_signal)
        signal.signal(signal.SIGTERM, handle_stop_signal)
        print(f"[Supervisor] Singleton acquired by PID {os.getpid()}.", flush=True)
        return supervise(project_root, args.recover_on_start, args.watch_mode or WATCH_MODE_DEV)
    finally:
        release_singleton()
        release_owner_process()


if __name__ == "__main__":
    raise SystemExit(main())
