# -*- coding: utf-8 -*-
"""
Notification sound playback — fire-and-forget, cross-platform, no deps.

Linux follows the freedesktop Sound Theme / Sound Naming specifications:
try ``canberra-gtk-play -i <sound-id>`` (themed event sound), then ``paplay``
/ ``pw-play`` against the freedesktop theme file, finally the terminal bell.
All three players are shell-outs present by default on Debian 13 GNOME and
Ubuntu 26.04 (pipewire-bin / pulseaudio-utils; gnome-session-canberra on
Ubuntu). Windows uses the system asterisk alias via winsound.

Usage:
    from pycore.pyutils.audio_utils.notification_sound import play_notification_sound
    play_notification_sound()  # non-blocking
"""

import shutil
import subprocess
import sys
from pathlib import Path
from typing import List

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint

DEFAULT_SOUND_ID = "message-new-instant"

FREEDESKTOP_SOUND_CANDIDATES: List[str] = [
    "/usr/share/sounds/freedesktop/stereo/message-new-instant.oga",
    "/usr/share/sounds/freedesktop/stereo/message.oga",
    "/usr/share/sounds/freedesktop/stereo/bell.oga",
]


def _play_windows() -> bool:
    import winsound
    winsound.PlaySound("SystemAsterisk", winsound.SND_ALIAS | winsound.SND_ASYNC)
    return True


def _spawn(argv: List[str]) -> bool:
    subprocess.Popen(
        argv,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        start_new_session=True,
    )
    return True


def _play_linux(sound_id: str) -> bool:
    canberra = shutil.which("canberra-gtk-play")
    if canberra:
        return _spawn([canberra, "-i", sound_id])
    sound_file = next((p for p in FREEDESKTOP_SOUND_CANDIDATES if Path(p).exists()), None)
    if sound_file:
        for player in ("paplay", "pw-play"):
            binary = shutil.which(player)
            if binary:
                return _spawn([binary, sound_file])
    # Last resort: terminal bell.
    sys.stdout.write("\a")
    sys.stdout.flush()
    return True


def play_notification_sound(sound_id: str = DEFAULT_SOUND_ID) -> bool:
    """
    Play a short notification sound without blocking the caller.

    Args:
        sound_id: freedesktop sound-naming id (Linux canberra path).

    Returns:
        True when a playback path was triggered, False on failure.
    """
    try:
        if sys.platform == "win32":
            return _play_windows()
        if sys.platform.startswith("linux"):
            return _play_linux(sound_id)
    except Exception as exc:
        ColorPrint.yellow(f"[NotificationSound] playback failed: {exc}")
    return False


__all__ = ["play_notification_sound", "DEFAULT_SOUND_ID"]
