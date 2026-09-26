# -*- coding: utf-8 -*-
"""
Desktop-user identity and detached-child environments for Linux spawns.

The desktop launcher runs as ROOT inside pkexec + dbus-run-session, so a child
must neither run a browser as root (Chrome refuses) nor inherit the private
session bus that dies with the launcher window (GLib apps exit with it).
Desktop GUI apps are re-dispatched to the pkexec/sudo caller with that user's
login-session environment; children that stay at the launcher's uid get the
foreign or private bus scrubbed. Every child, grid terminals included, drops
the systemd service markers: under KillMode=process children outlive the
autostart unit, and start.sh scripts read INVOCATION_ID as "running as the
unit body".
"""

import os
import shutil
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional

from pycore.pyfoundations.desktop_session import xauthority_candidates
from pycore.pyfoundations.pygvar import IS_WINDOWS

if not IS_WINDOWS:
    import pwd

ROOT_UID = 0
RUN_USER_ROOT = Path('/run/user')
ROOT_RUNTIME_DIR = str(RUN_USER_ROOT / str(ROOT_UID))
ROOT_BUS_MARKER = ROOT_RUNTIME_DIR + '/'
SESSION_BUS_SOCKET = 'bus'
BUS_ADDRESS_FORMAT = 'unix:path={path}'
BUS_ADDRESS_ENV = 'DBUS_SESSION_BUS_ADDRESS'
RUNTIME_DIR_ENV = 'XDG_RUNTIME_DIR'
DISPLAY_ENV = 'DISPLAY'
WAYLAND_DISPLAY_ENV = 'WAYLAND_DISPLAY'
XAUTHORITY_ENV = 'XAUTHORITY'
DESKTOP_UID_ENV_KEYS = ('PKEXEC_UID', 'SUDO_UID')
SYSTEMD_INVOCATION_ENV = 'INVOCATION_ID'
SERVICE_MARKER_ENV_KEYS = (SYSTEMD_INVOCATION_ENV, 'JOURNAL_STREAM')
IM_ENV_KEYS = frozenset({
    'GTK_IM_MODULE', 'QT_IM_MODULE', 'XMODIFIERS', 'SDL_IM_MODULE',
    'CLUTTER_IM_MODULE', 'INPUT_METHOD',
})
PAM_ENVIRONMENT_FILE = Path('/etc/environment')
ENV_VALUE_QUOTES = '"\''
WAYLAND_SOCKET_GLOB = 'wayland-[0-9]*'
X11_SOCKET_DIR = Path('/tmp/.X11-unix')
DEFAULT_X11_DISPLAY = ':0'
DEFAULT_X11_SOCKET = 'X0'
HOME_XAUTHORITY = '.Xauthority'
RUNUSER_BIN = 'runuser'
SUDO_BIN = 'sudo'
ENV_BIN = 'env'
SUDO_UID_FORMAT = '#{uid}'


@dataclass(frozen=True)
class DesktopUser:
    """Login-session owner a root launcher acts on behalf of."""

    uid: int
    name: str
    home: str

    @property
    def runtime_dir(self) -> str:
        return str(RUN_USER_ROOT / str(self.uid))

    @property
    def bus_address(self) -> str:
        return _bus_address(Path(self.runtime_dir))

    @property
    def working_dir(self) -> Optional[str]:
        return self.home if Path(self.home).is_dir() else None


def is_root() -> bool:
    return not IS_WINDOWS and os.geteuid() == ROOT_UID


def desktop_user() -> Optional[DesktopUser]:
    """The pkexec/sudo caller while this process runs as root, else None."""
    if not is_root():
        return None
    for key in DESKTOP_UID_ENV_KEYS:
        raw_uid = os.environ.get(key, '').strip()
        if not raw_uid.isdigit() or int(raw_uid) == ROOT_UID:
            continue
        entry = _passwd_entry(int(raw_uid))
        if entry is not None:
            return DesktopUser(uid=entry.pw_uid, name=entry.pw_name, home=entry.pw_dir)
    return None


def root_terminal_env(env_extra: Optional[Dict[str, str]] = None) -> Dict[str, str]:
    """Env for terminal emulators: drop the service markers and, as root, the
    desktop user's bus and runtime dir.

    A foreign session bus rejects root at D-Bus auth (xfce4-terminal is wrapped
    in its own dbus-run-session instead) and a foreign XDG_RUNTIME_DIR makes
    gvfs/dbus report permission errors. env_extra is merged last.
    """
    env = dict(os.environ)
    if is_root():
        _scrub_foreign_session_bus(env)
        _scrub_foreign_runtime_dir(env)
    drop_service_markers(env)
    if env_extra:
        env.update(env_extra)
    return env


def terminal_child_env() -> Dict[str, str]:
    """Env for a detached terminal window started outside the grid (e.g. codex)."""
    env = root_terminal_env()
    if not is_root():
        _repoint_private_session_bus(env)
    return env


def gui_child_env() -> Dict[str, str]:
    """Env for a detached GUI app kept at the launcher's uid.

    Root keeps XDG_RUNTIME_DIR (root-mode Electron wrappers locate the Wayland
    socket through it) and only loses the foreign/private bus, which those
    wrappers re-resolve to the login session bus.
    """
    env = dict(os.environ)
    if is_root():
        _scrub_foreign_session_bus(env)
    else:
        _repoint_private_session_bus(env)
    drop_service_markers(env)
    return env


def desktop_user_env(user: DesktopUser) -> Dict[str, str]:
    """Popen env for a child re-dispatched to *user* (see desktop_user_argv)."""
    env = dict(os.environ)
    drop_service_markers(env)
    env.update(_desktop_user_assignments(user))
    return env


def drop_service_markers(env: Dict[str, str]) -> None:
    """Remove the systemd service markers from *env* in place."""
    for key in SERVICE_MARKER_ENV_KEYS:
        env.pop(key, None)


def desktop_user_argv(user: DesktopUser, argv: List[str]) -> List[str]:
    """Wrap *argv* to run as *user* in its login session; [] when no switcher exists."""
    assignments = [f'{key}={value}' for key, value in _desktop_user_assignments(user).items()]
    env_binary = shutil.which(ENV_BIN) or ENV_BIN
    runuser = shutil.which(RUNUSER_BIN)
    if runuser:
        return [runuser, '-u', user.name, '--', env_binary] + assignments + list(argv)
    sudo = shutil.which(SUDO_BIN)
    if sudo:
        return [sudo, '-u', SUDO_UID_FORMAT.format(uid=user.uid), '--', env_binary] \
            + assignments + list(argv)
    return []


def _passwd_entry(uid: int):
    # pwd has no non-raising lookup: KeyError is its only "unknown uid" signal.
    try:
        return pwd.getpwuid(uid)
    except KeyError:
        return None


def _bus_address(runtime_dir: Path) -> str:
    return BUS_ADDRESS_FORMAT.format(path=runtime_dir / SESSION_BUS_SOCKET)


def _scrub_foreign_session_bus(env: Dict[str, str]) -> None:
    address = env.get(BUS_ADDRESS_ENV, '')
    if address and ROOT_BUS_MARKER not in address:
        env.pop(BUS_ADDRESS_ENV, None)


def _scrub_foreign_runtime_dir(env: Dict[str, str]) -> None:
    runtime_dir = env.get(RUNTIME_DIR_ENV, '')
    if runtime_dir and runtime_dir.rstrip('/') != ROOT_RUNTIME_DIR:
        env.pop(RUNTIME_DIR_ENV, None)


def _repoint_private_session_bus(env: Dict[str, str]) -> None:
    """Swap a private (dbus-run-session) bus for this user's login session bus."""
    if IS_WINDOWS:
        return
    own_runtime_dir = RUN_USER_ROOT / str(os.getuid())
    own_bus = own_runtime_dir / SESSION_BUS_SOCKET
    if own_bus.is_socket() and str(own_bus) not in env.get(BUS_ADDRESS_ENV, ''):
        env[BUS_ADDRESS_ENV] = _bus_address(own_runtime_dir)


def _desktop_user_assignments(user: DesktopUser) -> Dict[str, str]:
    """Identity, session and input-method variables of *user*'s desktop session."""
    assignments = _pam_im_environment()
    assignments.update({
        'HOME': user.home,
        'USER': user.name,
        'LOGNAME': user.name,
        RUNTIME_DIR_ENV: user.runtime_dir,
        BUS_ADDRESS_ENV: user.bus_address,
    })
    display = os.environ.get(DISPLAY_ENV, '') or _default_x11_display()
    session_values = (
        (DISPLAY_ENV, display),
        (WAYLAND_DISPLAY_ENV, os.environ.get(WAYLAND_DISPLAY_ENV, '') or _first_wayland_socket(user)),
        (XAUTHORITY_ENV, _user_xauthority(user) if display else ''),
    )
    for key, value in session_values:
        if value:
            assignments[key] = value
    return assignments


def _pam_im_environment() -> Dict[str, str]:
    """Input-method variables from /etc/environment (the pam_env login values).

    The elevated launcher swaps them for XIM, which is wrong for a child that
    runs back inside the user's own session.
    """
    values: Dict[str, str] = {}
    if not PAM_ENVIRONMENT_FILE.is_file():
        return values
    for line in PAM_ENVIRONMENT_FILE.read_text(encoding='utf-8', errors='replace').splitlines():
        key, separator, value = line.strip().partition('=')
        value = value.strip().strip(ENV_VALUE_QUOTES)
        if separator and key in IM_ENV_KEYS and value:
            values[key] = value
    return values


def _default_x11_display() -> str:
    return DEFAULT_X11_DISPLAY if (X11_SOCKET_DIR / DEFAULT_X11_SOCKET).exists() else ''


def _first_wayland_socket(user: DesktopUser) -> str:
    for candidate in sorted(Path(user.runtime_dir).glob(WAYLAND_SOCKET_GLOB)):
        if candidate.is_socket():
            return candidate.name
    return ''


def _user_xauthority(user: DesktopUser) -> str:
    """X cookie readable by *user*: the inherited one when it is theirs."""
    user_roots = (Path(user.runtime_dir), Path(user.home))
    configured = os.environ.get(XAUTHORITY_ENV, '')
    if configured and any(Path(configured).is_relative_to(root) for root in user_roots):
        return configured
    for candidate in xauthority_candidates(user.runtime_dir):
        if Path(candidate).is_relative_to(user_roots[0]):
            return candidate
    home_cookie = Path(user.home) / HOME_XAUTHORITY
    return str(home_cookie) if home_cookie.is_file() else configured
