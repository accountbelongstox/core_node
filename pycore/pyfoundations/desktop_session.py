# -*- coding: utf-8 -*-
from __future__ import annotations

import glob
import os
import platform
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, Optional, Tuple


PLATFORM_NAME = platform.system()
OS_RELEASE_PATH = Path("/etc/os-release")
RUNTIME_ROOT = Path("/run/user")
SESSION_X11 = "x11"
SESSION_WAYLAND = "wayland"
SESSION_TTY = "tty"
SESSION_WIN32 = "win32"
SESSION_UNKNOWN = "unknown"
DESKTOP_GNOME = "gnome"
DESKTOP_KDE = "kde"
DESKTOP_UNKNOWN = "unknown"
XWAYLAND_AUTH_PATTERNS = (".mutter-Xwaylandauth.*", "xauth_*", ".Xauthority")
SESSION_BUS_SOCKET = "bus"
FORCE_GUI_ENV = "PYCORE_FORCE_GUI"
FORCE_HEADLESS_ENV = "PYCORE_HEADLESS"
SUPPORTED_DESKTOP_PROFILES = frozenset({
    ("debian", "13"),
    ("ubuntu", "26"),
})


@dataclass(frozen=True)
class LinuxDistro:
    distro_id: str = "linux"
    version_id: str = ""
    version_major: str = ""
    id_like: Tuple[str, ...] = ()
    codename: str = ""

    def is_like(self, family: str) -> bool:
        return self.distro_id == family or family in self.id_like


@dataclass(frozen=True)
class DesktopSession:
    platform: str
    session_type: str
    desktop: str
    desktop_names: Tuple[str, ...]
    display: str
    wayland_display: str
    xauthority: str
    runtime_dir: str
    dbus_address: str
    distro: LinuxDistro = field(default_factory=LinuxDistro)

    @property
    def is_linux(self) -> bool:
        return self.platform == "Linux"

    @property
    def is_wayland(self) -> bool:
        return self.session_type == SESSION_WAYLAND

    @property
    def is_x11(self) -> bool:
        return self.session_type == SESSION_X11

    @property
    def is_gnome(self) -> bool:
        return self.desktop == DESKTOP_GNOME

    @property
    def has_x11_display(self) -> bool:
        return bool(self.display)

    @property
    def has_xwayland(self) -> bool:
        return self.is_wayland and bool(self.display)

    @property
    def has_display(self) -> bool:
        return bool(self.display or self.wayland_display)

    @property
    def has_session_bus(self) -> bool:
        return bool(self.dbus_address)

    @property
    def supported_profile(self) -> bool:
        return (
            self.distro.distro_id,
            self.distro.version_major,
        ) in SUPPORTED_DESKTOP_PROFILES

    def profile(self) -> Dict[str, object]:
        return {
            "platform": self.platform.lower(),
            "distro": self.distro.distro_id,
            "version": self.distro.version_id,
            "codename": self.distro.codename,
            "desktop": self.desktop,
            "session": self.session_type,
            "xwayland": self.has_xwayland,
            "supported_profile": self.supported_profile,
        }


def _parse_os_release(path: Path = OS_RELEASE_PATH) -> LinuxDistro:
    if not path.is_file():
        return LinuxDistro()
    values: Dict[str, str] = {}
    for line in path.read_text(encoding="utf-8", errors="replace").splitlines():
        key, separator, value = line.partition("=")
        if separator:
            values[key.strip()] = value.strip().strip('"').strip("'")
    version_id = values.get("VERSION_ID", "")
    return LinuxDistro(
        distro_id=values.get("ID", "linux").lower() or "linux",
        version_id=version_id,
        version_major=version_id.split(".", 1)[0],
        id_like=tuple(values.get("ID_LIKE", "").lower().split()),
        codename=values.get("VERSION_CODENAME", "").lower(),
    )


LINUX_DISTRO = _parse_os_release() if PLATFORM_NAME == "Linux" else LinuxDistro()


def _user_runtime_dir() -> str:
    configured = os.environ.get("XDG_RUNTIME_DIR", "")
    if configured:
        return configured
    if PLATFORM_NAME != "Linux":
        return ""
    candidate = RUNTIME_ROOT / str(os.getuid())
    return str(candidate) if candidate.is_dir() else ""


def xauthority_candidates(runtime_dir: str) -> Tuple[str, ...]:
    """Session cookie files, newest first; a re-login leaves the inherited XAUTHORITY stale."""
    search_roots = [runtime_dir] if runtime_dir else []
    search_roots.append(str(Path.home()))
    candidates = []
    for root in search_roots:
        for pattern in XWAYLAND_AUTH_PATTERNS:
            candidates.extend(glob.glob(os.path.join(root, pattern)))
    return tuple(sorted(set(candidates), key=os.path.getmtime, reverse=True))


def _resolve_xauthority(runtime_dir: str) -> str:
    configured = os.environ.get("XAUTHORITY", "")
    if configured:
        return configured
    candidates = xauthority_candidates(runtime_dir)
    return candidates[0] if candidates else ""


def _resolve_dbus_address(runtime_dir: str) -> str:
    configured = os.environ.get("DBUS_SESSION_BUS_ADDRESS", "")
    if configured:
        return configured
    if runtime_dir and (Path(runtime_dir) / SESSION_BUS_SOCKET).exists():
        return f"unix:path={Path(runtime_dir) / SESSION_BUS_SOCKET}"
    return ""


def _resolve_session_type(display: str, wayland_display: str) -> str:
    if PLATFORM_NAME == "Windows":
        return SESSION_WIN32
    configured = os.environ.get("XDG_SESSION_TYPE", "").strip().lower()
    if wayland_display:
        return SESSION_WAYLAND
    if configured in (SESSION_X11, SESSION_WAYLAND, SESSION_TTY):
        return configured
    if display:
        return SESSION_X11
    return SESSION_TTY if PLATFORM_NAME == "Linux" else SESSION_UNKNOWN


def _resolve_desktop() -> Tuple[str, Tuple[str, ...]]:
    raw = os.environ.get("XDG_CURRENT_DESKTOP", "") or os.environ.get(
        "DESKTOP_SESSION",
        "",
    )
    names = tuple(part.strip().lower() for part in raw.split(":") if part.strip())
    if any(DESKTOP_GNOME in name for name in names):
        return DESKTOP_GNOME, names
    if any(DESKTOP_KDE in name or "plasma" in name for name in names):
        return DESKTOP_KDE, names
    return (names[-1] if names else DESKTOP_UNKNOWN), names


def current_desktop_session() -> DesktopSession:
    runtime_dir = _user_runtime_dir()
    display = os.environ.get("DISPLAY", "")
    wayland_display = os.environ.get("WAYLAND_DISPLAY", "")
    desktop, desktop_names = _resolve_desktop()
    return DesktopSession(
        platform=PLATFORM_NAME,
        session_type=_resolve_session_type(display, wayland_display),
        desktop=desktop,
        desktop_names=desktop_names,
        display=display,
        wayland_display=wayland_display,
        xauthority=_resolve_xauthority(runtime_dir) if display else "",
        runtime_dir=runtime_dir,
        dbus_address=_resolve_dbus_address(runtime_dir),
        distro=LINUX_DISTRO,
    )


def ensure_session_environment(session: Optional[DesktopSession] = None) -> DesktopSession:
    resolved = session or current_desktop_session()
    if resolved.xauthority and not os.environ.get("XAUTHORITY"):
        os.environ["XAUTHORITY"] = resolved.xauthority
    if resolved.dbus_address and not os.environ.get("DBUS_SESSION_BUS_ADDRESS"):
        os.environ["DBUS_SESSION_BUS_ADDRESS"] = resolved.dbus_address
    if resolved.runtime_dir and not os.environ.get("XDG_RUNTIME_DIR"):
        os.environ["XDG_RUNTIME_DIR"] = resolved.runtime_dir
    return resolved


def has_graphical_display() -> bool:
    if os.environ.get(FORCE_GUI_ENV) == "1":
        return True
    if os.environ.get(FORCE_HEADLESS_ENV) == "1":
        return False
    if PLATFORM_NAME != "Linux":
        return True
    return current_desktop_session().has_display


def is_headless_linux() -> bool:
    return PLATFORM_NAME == "Linux" and not has_graphical_display()


__all__ = [
    "DESKTOP_GNOME",
    "DESKTOP_KDE",
    "DesktopSession",
    "LINUX_DISTRO",
    "LinuxDistro",
    "SESSION_TTY",
    "SESSION_UNKNOWN",
    "SESSION_WAYLAND",
    "SESSION_WIN32",
    "SESSION_X11",
    "current_desktop_session",
    "xauthority_candidates",
    "ensure_session_environment",
    "has_graphical_display",
    "is_headless_linux",
]
