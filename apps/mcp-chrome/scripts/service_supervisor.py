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
import webbrowser
from pathlib import Path
from typing import IO, Optional


APP_MUTEX_NAME = "Local\\CoreNodeMcpChromeServiceSupervisor"
LOCK_FILE_NAME = "core-node-mcp-chrome-supervisor.lock"
RECOVERY_REQUEST_FILE_NAME = "core-node-mcp-chrome-recovery.request"
WATCH_MODE_REQUEST_FILE_NAME = "core-node-mcp-chrome-watch-mode.request"
TAKEOVER_REQUEST_FILE_NAME = "core-node-mcp-chrome-takeover.request"
NATIVE_HOST_NAME = "com.chromemcp.nativehost.json"
MCP_PORT = 12306
POLL_INTERVAL_SECONDS = 2.0
RESTART_DELAY_SECONDS = 2.0
RECOVERY_DEBOUNCE_SECONDS = 2.0
RECOVERY_COOLDOWN_SECONDS = 20.0
RECOVERY_MAX_ATTEMPTS = 5
TAKEOVER_WAIT_SECONDS = 30.0
WINDOWS_ALREADY_EXISTS = 183
WATCH_MODE_DEV = "dev"
WATCH_MODE_ONCE = "once"
stop_event = threading.Event()
windows_mutex_handle: Optional[int] = None
posix_lock_file: Optional[IO[str]] = None


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    args: Optional[argparse.Namespace] = None

    parser.add_argument("--project-root")
    parser.add_argument("--recover-on-start", action="store_true")
    parser.add_argument("--watch-mode", choices=[WATCH_MODE_DEV, WATCH_MODE_ONCE])
    parser.add_argument("--foreground", action="store_true")
    parser.add_argument("--wake", action="store_true")
    args = parser.parse_args()
    if not args.wake and not args.project_root:
        parser.error("--project-root is required unless --wake is used")
    return args


def acquire_singleton() -> bool:
    global windows_mutex_handle
    global posix_lock_file

    if os.name == "nt":
        kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
        kernel32.CreateMutexW.argtypes = [ctypes.c_void_p, ctypes.c_bool, ctypes.c_wchar_p]
        kernel32.CreateMutexW.restype = ctypes.c_void_p
        kernel32.CloseHandle.argtypes = [ctypes.c_void_p]
        kernel32.CloseHandle.restype = ctypes.c_bool
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
        kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
        kernel32.CloseHandle.argtypes = [ctypes.c_void_p]
        kernel32.CloseHandle.restype = ctypes.c_bool
        kernel32.CloseHandle(windows_mutex_handle)
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


def extension_recovery_url() -> Optional[str]:
    for manifest_path in manifest_candidates():
        try:
            manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            continue
        for origin in manifest.get("allowed_origins", []):
            if isinstance(origin, str) and origin.startswith("chrome-extension://"):
                return f"{origin}popup.html"
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


def wake_extension(reload_extension: bool = True) -> None:
    recovery_url = extension_recovery_url()
    chrome_path = chrome_executable()
    reload_url: Optional[str] = None
    reconnect_url: Optional[str] = None

    if not recovery_url:
        print("[Supervisor] Native host manifest has no Chrome extension origin.", flush=True)
        return
    reload_url = f"{recovery_url}?reloadExtension=1"
    reconnect_url = f"{recovery_url}?reconnectNative=1"
    try:
        if chrome_path:
            if reload_extension:
                subprocess.Popen(
                    [chrome_path, reload_url],
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                )
                time.sleep(1.5)
            subprocess.Popen(
                [chrome_path, reconnect_url],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
        else:
            if reload_extension:
                webbrowser.open(reload_url, new=0, autoraise=False)
                time.sleep(1.5)
            webbrowser.open(reconnect_url, new=0, autoraise=False)
        recovery_mode = "reload and reconnect" if reload_extension else "reconnect"
        print(f"[Supervisor] Requested Chrome extension {recovery_mode}.", flush=True)
    except OSError as error:
        print(f"[Supervisor] Could not wake the Chrome extension: {error}", flush=True)


def artifact_signature(project_root: Path) -> tuple[Optional[int], Optional[int]]:
    native_artifact = project_root / "app" / "native-server" / "dist" / "index.js"
    extension_manifest = project_root / ".output" / "build_extension" / "manifest.json"

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
    last_recovery_at = 0.0
    consecutive_down_recoveries = 0
    auto_recovery_suspended_logged = False

    print(f"[Supervisor] Watch mode: {watch_mode}.", flush=True)

    while not stop_event.is_set():
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
            signature = current_signature
            pending_recovery_at = now + RECOVERY_DEBOUNCE_SECONDS
            consecutive_down_recoveries = 0
            auto_recovery_suspended_logged = False

        current_request_signature = recovery_request_signature()
        if current_request_signature != request_signature:
            request_signature = current_request_signature
            pending_recovery_at = now
            consecutive_down_recoveries = 0
            auto_recovery_suspended_logged = False

        service_up = port_is_listening()
        if service_up:
            consecutive_down_recoveries = 0
            auto_recovery_suspended_logged = False
        recovery_due = pending_recovery_at is not None and now >= pending_recovery_at
        cooldown_elapsed = now - last_recovery_at >= RECOVERY_COOLDOWN_SECONDS
        if recovery_due or (
            cooldown_elapsed
            and not service_up
            and consecutive_down_recoveries < RECOVERY_MAX_ATTEMPTS
        ):
            wake_extension(reload_extension=recovery_due)
            last_recovery_at = now
            if recovery_due:
                pending_recovery_at = None
            else:
                consecutive_down_recoveries += 1
        elif (
            not service_up
            and consecutive_down_recoveries >= RECOVERY_MAX_ATTEMPTS
            and not auto_recovery_suspended_logged
        ):
            auto_recovery_suspended_logged = True
            print(
                "[Supervisor] MCP service is still not listening after "
                f"{RECOVERY_MAX_ATTEMPTS} recovery attempts; pausing automatic "
                "recovery until the next build or explicit request.",
                flush=True,
            )

        stop_event.wait(POLL_INTERVAL_SECONDS)

    return 0


def main() -> int:
    args = parse_args()
    project_root: Optional[Path] = None

    if args.wake:
        wake_extension()
        return 0

    project_root = Path(args.project_root).resolve()

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
    if not singleton_acquired:
        print("[Supervisor] An MCP Chrome supervisor instance is already running.", flush=True)
        return 0
    try:
        signal.signal(signal.SIGINT, handle_stop_signal)
        signal.signal(signal.SIGTERM, handle_stop_signal)
        print(f"[Supervisor] Singleton acquired by PID {os.getpid()}.", flush=True)
        return supervise(project_root, args.recover_on_start, args.watch_mode or WATCH_MODE_DEV)
    finally:
        release_singleton()


if __name__ == "__main__":
    raise SystemExit(main())
