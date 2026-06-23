# -*- coding: utf-8 -*-
"""
Linux Screen Manager
Detects primary-monitor geometry on native Linux (X11 / Wayland).

This is the Linux counterpart of ``screen_manager.ScreenManager``. It probes a
short, ordered list of display tools and returns the first successful answer:

    1. ``xrandr --current`` (X11)        -- authoritative primary-monitor rect
    2. ``wlr-randr``        (Wayland)    -- wlroots compositors (sway, etc.)
    3. ``xdpyinfo``         (X11)        -- coarse fallback, origin assumed 0,0

Every probe is guarded by ``shutil.which`` and wrapped in try/except so a
missing tool or malformed output simply advances to the next strategy. If
nothing works a sane default is returned. This class never raises.
"""

import re
import shutil
import subprocess


class LinuxScreenManager:
    """Detect the primary monitor geometry on Linux (X11 and Wayland)."""

    # Returned when every detection strategy fails -- a common 1080p desktop.
    DEFAULT_DIMENSIONS = (0, 0, 1920, 1080)

    def get_screen_dimensions(self):
        """
        Get the primary monitor geometry in pixels.

        Tries xrandr, then wlr-randr, then xdpyinfo, in order. The first
        strategy that yields a valid rectangle wins.

        Returns:
            tuple: (x, y, width, height) in pixels of the primary monitor.
        """
        for probe in (self._detect_xrandr,
                      self._detect_wlr_randr,
                      self._detect_xdpyinfo):
            try:
                result = probe()
            except Exception as e:
                # Defensive: a probe should never bubble up, but if it does we
                # log it and move on to the next strategy.
                print(f"Warning: {probe.__name__} failed: {e}")
                result = None

            if result is not None:
                x, y, width, height = result
                print(f"Screen dimensions: {width}x{height}")
                print(f"Screen position: {x}, {y}")
                return result

        # Nothing worked -- fall back to a reasonable default.
        x, y, width, height = self.DEFAULT_DIMENSIONS
        print("Warning: Could not detect screen dimensions, using default")
        print(f"Screen dimensions: {width}x{height}")
        print(f"Screen position: {x}, {y}")
        return self.DEFAULT_DIMENSIONS

    # ------------------------------------------------------------------ #
    # Detection strategies
    # ------------------------------------------------------------------ #

    def _detect_xrandr(self):
        """
        Parse ``xrandr --current`` output (X11).

        Each connected output reports a line such as::

            HDMI-1 connected primary 1920x1080+0+0 (normal ...) 521mm x 293mm

        We prefer the line containing ' primary'; if no output is flagged
        primary we take the first connected output that carries a geometry.

        Returns:
            tuple (x, y, w, h) or None if unavailable.
        """
        if not shutil.which("xrandr"):
            return None

        proc = subprocess.run(
            ["xrandr", "--current"],
            capture_output=True, text=True, timeout=5,
        )
        if proc.returncode != 0 or not proc.stdout:
            return None

        # Geometry token: <w>x<h>+<x>+<y>
        geom_re = re.compile(r"(\d+)x(\d+)\+(\d+)\+(\d+)")

        primary = None
        first = None
        for line in proc.stdout.splitlines():
            if " connected" not in line:
                continue
            match = geom_re.search(line)
            if not match:
                continue
            w, h, gx, gy = (int(match.group(i)) for i in (1, 2, 3, 4))
            rect = (gx, gy, w, h)
            if first is None:
                first = rect
            if " primary" in line:
                primary = rect
                break  # primary is authoritative; stop looking

        chosen = primary or first
        if chosen is not None:
            print("Using xrandr (X11) for screen dimensions")
        return chosen

    def _detect_wlr_randr(self):
        """
        Parse ``wlr-randr`` output (Wayland / wlroots compositors).

        Best-effort parse of a block such as::

            HDMI-A-1 "..."
              Position: 0,0
              Modes:
                1920x1080 px, 60.000 Hz (current)

        We capture the first mode tagged 'current' for width/height and the
        nearest preceding 'Position:' line for the origin.

        Returns:
            tuple (x, y, w, h) or None if unavailable.
        """
        if not shutil.which("wlr-randr"):
            return None

        proc = subprocess.run(
            ["wlr-randr"],
            capture_output=True, text=True, timeout=5,
        )
        if proc.returncode != 0 or not proc.stdout:
            return None

        pos_re = re.compile(r"Position:\s*(\d+),(\d+)")
        # "1920x1080 px ... current"
        mode_re = re.compile(r"(\d+)x(\d+)\s*px")

        pos = (0, 0)
        for line in proc.stdout.splitlines():
            pos_match = pos_re.search(line)
            if pos_match:
                pos = (int(pos_match.group(1)), int(pos_match.group(2)))
                continue
            if "current" in line:
                mode_match = mode_re.search(line)
                if mode_match:
                    w, h = int(mode_match.group(1)), int(mode_match.group(2))
                    print("Using wlr-randr (Wayland) for screen dimensions")
                    return (pos[0], pos[1], w, h)

        return None

    def _detect_xdpyinfo(self):
        """
        Parse ``xdpyinfo`` output (X11 fallback).

        Reads the overall display size from a line such as::

            dimensions:    1920x1080 pixels (508x285 millimeters)

        This reports the whole X screen, so the origin is assumed to be (0, 0).

        Returns:
            tuple (0, 0, w, h) or None if unavailable.
        """
        if not shutil.which("xdpyinfo"):
            return None

        proc = subprocess.run(
            ["xdpyinfo"],
            capture_output=True, text=True, timeout=5,
        )
        if proc.returncode != 0 or not proc.stdout:
            return None

        match = re.search(r"dimensions:\s*(\d+)x(\d+)", proc.stdout)
        if match:
            w, h = int(match.group(1)), int(match.group(2))
            print("Using xdpyinfo (X11) for screen dimensions")
            return (0, 0, w, h)

        return None
