# -*- coding: utf-8 -*-
"""
CharSizeMeasurer - measure the real per-column / per-row pixel size of Windows
Terminal so the grid layout uses the correct char_height for the installed font
and DPI, instead of the fixed config calibration (which was ~10x too small and
made every window overflow the screen vertically).

Method: open two calibration WT windows with known --size values (cols, rows),
measure each window's outer pixel rect via Win32 GetWindowRect, and subtract.
The unknown window chrome (title bar + frame + profile padding) is constant
across both windows, so it cancels out:

    char_width  = (rect_w_B - rect_w_A) / (cols_B - cols_A)
    char_height = (rect_h_B - rect_h_A) / (rows_B - rows_A)

The result is cached to ~/.core_node/launch_multiple/char_size_cache.json keyed
by system DPI + a cache-version constant. Dynamic measurement is OPT-IN: by
default measure() never flashes calibration windows -- it returns a cached result
if one exists, otherwise None so the caller falls back to config-derived ratios
(identical to the Linux path). Set PYCORE_LAUNCHER_RECALIBRATE=1 to actively
measure (two windows flash briefly) and cache the result; later launches then
reuse the cache with no flash.

Windows-only: on any other platform measure() returns None and the caller falls
back to config-derived ratios. The Win32 ctypes bindings are touched only inside
Windows-only code paths, so importing this module on Linux is safe.
"""

import ctypes
import json
import os
import platform
import subprocess
import time
from datetime import datetime
from pathlib import Path

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.system_paths import get_system_cache_dir
from pycore.pyutils.common.terminal_identifiers import WINDOWS_TERMINAL_HOST_CLASS

# Win32 API constants
_WM_CLOSE = 0x0010
# Two calibration sizes; far enough apart that the per-cell delta dominates any
# 1px rounding error. Both must be valid Windows Terminal --size values.
_CALIB_SIZE_A = (80, 25)
_CALIB_SIZE_B = (120, 40)
# Calibration windows flash at this top-left corner (WT clamps to the work area).
_CALIB_POS = (40, 40)
# Polling cadence + bounds while waiting for each calibration window to appear.
_POLL_INTERVAL = 0.3
_APPEAR_TIMEOUT = 8.0
_SETTLE_SECONDS = 1.5

# Cache lives next to the launcher's other state under the centralized per-user
# state dir (see system_paths.get_system_cache_dir).
_CACHE_DIR = get_system_cache_dir() / 'launch_multiple'
_CACHE_FILE = _CACHE_DIR / 'char_size_cache.json'
# Bump when the measurement method changes; forces a re-measure on existing caches.
_CACHE_VERSION = 1


class _RECT(ctypes.Structure):
    _fields_ = [("left", ctypes.c_long),
                ("top", ctypes.c_long),
                ("right", ctypes.c_long),
                ("bottom", ctypes.c_long)]


# EnumWindows callback type: BOOL CALLBACK EnumWindowsProc(HWND, LPARAM).
# HWND is pointer-sized on 64-bit Windows, so c_void_p (not c_int) avoids the
# handle-truncation bug the old launch_multiple_terminals.py had.
_WNDENUMPROC = ctypes.WINFUNCTYPE(ctypes.c_bool, ctypes.c_void_p, ctypes.c_void_p)


def _is_windows():
    return platform.system() == "Windows"


def _user32():
    return ctypes.windll.user32


def count_wt_windows():
    """Return the number of open Windows Terminal top-level windows."""
    if not _is_windows():
        return 0
    return len(_enum_wt_hwnds())


def _enum_wt_hwnds():
    """Return the current list of Windows Terminal top-level window handles."""
    user32 = _user32()
    found = []

    def _cb(hwnd, _lparam):
        buf = ctypes.create_unicode_buffer(256)
        if user32.GetClassNameW(hwnd, buf, 256) > 0 and buf.value == WINDOWS_TERMINAL_HOST_CLASS:
            found.append(hwnd)
        return True

    # Keep a reference to the callback so ctypes does not GC it mid-enumeration.
    proc = _WNDENUMPROC(_cb)
    user32.EnumWindows.argtypes = [_WNDENUMPROC, ctypes.c_void_p]
    user32.EnumWindows.restype = ctypes.c_bool
    user32.EnumWindows(proc, 0)
    return found


def _window_rect(hwnd):
    """Return (width, height) of a window's outer rect, or None."""
    user32 = _user32()
    rect = _RECT()
    user32.GetWindowRect.argtypes = [ctypes.c_void_p, ctypes.POINTER(_RECT)]
    user32.GetWindowRect.restype = ctypes.c_bool
    if user32.GetWindowRect(hwnd, ctypes.byref(rect)):
        return (rect.right - rect.left, rect.bottom - rect.top)
    return None


def _close_window(hwnd):
    """Ask a window to close (WM_CLOSE). Best-effort; never raises."""
    try:
        user32 = _user32()
        user32.PostMessageW.argtypes = [ctypes.c_void_p, ctypes.c_uint,
                                        ctypes.c_void_p, ctypes.c_void_p]
        user32.PostMessageW.restype = ctypes.c_bool
        user32.PostMessageW(hwnd, _WM_CLOSE, 0, 0)
    except Exception:
        pass


def _system_dpi():
    """System DPI (96 = 100%). Falls back to 96 on older Windows / errors."""
    if not _is_windows():
        return 96
    try:
        return int(_user32().GetDpiForSystem())
    except Exception:
        return 96


def _launch_calib_window(cols, rows):
    """Launch one calibration WT window, detached so it outlives this process."""
    x, y = _CALIB_POS
    cmd = f'wt.exe -w -1 --pos "{x},{y}" --size "{cols},{rows}"'
    subprocess.Popen(
        ['cmd', '/c', cmd],
        creationflags=subprocess.DETACHED_PROCESS | subprocess.CREATE_NEW_PROCESS_GROUP,
        close_fds=True,
    )


def _launch_and_measure(cols, rows):
    """Launch a calibration window, wait for it, measure its rect, close it.

    Returns (width_px, height_px) or None on timeout.
    """
    before = set(_enum_wt_hwnds())
    _launch_calib_window(cols, rows)

    hwnd = None
    deadline = time.monotonic() + _APPEAR_TIMEOUT
    while time.monotonic() < deadline:
        time.sleep(_POLL_INTERVAL)
        new_hwnds = [h for h in _enum_wt_hwnds() if h not in before]
        if new_hwnds:
            hwnd = new_hwnds[0]
            break
    if hwnd is None:
        return None

    # Let WT finish sizing the window before sampling its rect.
    time.sleep(_SETTLE_SECONDS)
    rect = _window_rect(hwnd)
    _close_window(hwnd)
    if not rect:
        return None
    return rect


def _load_cache():
    try:
        if _CACHE_FILE.exists():
            with open(_CACHE_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
    except Exception:
        return None
    return None


def _save_cache(char_width, char_height, dpi):
    try:
        _CACHE_DIR.mkdir(parents=True, exist_ok=True)
        payload = {
            'version': _CACHE_VERSION,
            'dpi': dpi,
            'char_width': char_width,
            'char_height': char_height,
            'measured_at': datetime.now().isoformat(timespec='seconds'),
        }
        with open(_CACHE_FILE, 'w', encoding='utf-8') as f:
            json.dump(payload, f, indent=2)
    except Exception:
        pass


class CharSizeMeasurer:
    """Measure real Windows Terminal per-cell pixel size via two-point calibration."""

    @staticmethod
    def measure(force=None):
        """Return (char_width, char_height, source_str), or None to use config ratios.

        Measurement is opt-in: without force it returns a cached result if present,
        else None (no calibration windows flash). Only force actively measures.

        Args:
            force: If True, ignore the cache and actively re-measure (flashing two
                calibration windows). Defaults to the PYCORE_LAUNCHER_RECALIBRATE
                env var (1 = force).
        """
        if not _is_windows():
            return None
        if force is None:
            force = os.environ.get('PYCORE_LAUNCHER_RECALIBRATE', '') == '1'
        dpi = _system_dpi()

        if not force:
            cached = _load_cache()
            if (cached
                    and cached.get('version') == _CACHE_VERSION
                    and cached.get('dpi') == dpi
                    and cached.get('char_width', 0) > 0
                    and cached.get('char_height', 0) > 0):
                src = (f"cached measurement (DPI {dpi}, "
                       f"{cached.get('char_width'):.3f}x{cached.get('char_height'):.3f}px/cell)")
                return (float(cached['char_width']), float(cached['char_height']), src)
            # Opt-in only: with no valid cache and no explicit recalibrate request,
            # do NOT flash two calibration windows on every launch. Return None so
            # the caller falls back to the config-ratio path (identical to Linux).
            # Set PYCORE_LAUNCHER_RECALIBRATE=1 to measure once and cache the result;
            # later launches then reuse the cache with no flash.
            return None

        ColorPrint.plain("[char-size] Measuring Windows Terminal cell size "
              "(two calibration windows will flash briefly)...")
        rect_a = _launch_and_measure(*_CALIB_SIZE_A)
        rect_b = _launch_and_measure(*_CALIB_SIZE_B)
        if not rect_a or not rect_b:
            ColorPrint.plain("[char-size] Calibration failed (window not detected in time); "
                  "falling back to config ratios.")
            return None

        cols_a, rows_a = _CALIB_SIZE_A
        cols_b, rows_b = _CALIB_SIZE_B
        wa, ha = rect_a
        wb, hb = rect_b
        char_width = (wb - wa) / (cols_b - cols_a)
        char_height = (hb - ha) / (rows_b - rows_a)

        if char_width <= 0 or char_height <= 0:
            ColorPrint.plain(f"[char-size] Calibration yielded non-positive cell size "
                  f"({char_width:.3f}x{char_height:.3f}); discarding.")
            return None

        _save_cache(char_width, char_height, dpi)
        ColorPrint.plain(f"[char-size] Measured: {char_width:.3f}px/col, {char_height:.3f}px/row "
              f"(DPI {dpi}); cached for future launches.")
        return (char_width, char_height,
                f"dynamic measurement (DPI {dpi}, two-point)")
