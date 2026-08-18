# -*- coding: utf-8 -*-
"""
Linux Window Placer
X11 window-management primitives + grid geometry math for the terminal grid.

This is the window-positioning concern split out of ``linux_terminal_launcher``.
It knows nothing about terminal emulators (no argv construction, no emulator
discovery) -- only about:

  * enumerating managed top-level window ids (``wmctrl -l`` / ``xdotool``),
  * resolving the id of a freshly-mapped window by diffing that set,
  * moving/sizing a window by id OR by title (wmctrl / xdotool),
  * measuring the window-manager frame extents (``xprop``),
  * the pure geometry math of a grid: cell pixel size, inter-window gaps,
    client-rectangle insets, and column-count estimation.

Mirrors the precedent of ``linux_screen_manager.LinuxScreenManager``: a sibling
Linux X11/Wayland concern, a standalone class, never raises. Every external
command is guarded by ``shutil.which`` and wrapped in try/except so a missing
tool or malformed output degrades to a no-op / sane default instead of raising.
Under Wayland ``wmctrl``/``xdotool``/``xprop`` are unavailable, so the methods
return empty sets / zero extents / None; the launcher's Wayland path never
calls them (it uses the single-window paned grid instead).
"""

import math
import shutil
import subprocess
import time
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint


class LinuxWindowPlacer:
    """X11 window-id management and grid geometry math (never raises)."""

    # ------------------------------------------------------------------ #
    # Grid geometry math (pure; no external commands)
    # ------------------------------------------------------------------ #

    @staticmethod
    def _cell_pixel_size(configs):
        """
        Derive a per-cell PIXEL size from the grid's pixel offsets.

        The grid spacing between adjacent column origins is the cell width, and
        between adjacent row origins the cell height. We sort the distinct
        x-offsets (and y-offsets) and take the first gap. Needs at least two
        distinct values per axis; otherwise that dimension is None (size left
        unchanged when positioning).

        Args:
            configs: List of 4-tuples (x, y, cols, rows) with PIXEL offsets.

        Returns:
            tuple: (cell_w, cell_h), each an int or None.
        """
        xs = sorted({entry[0] for entry in configs})
        ys = sorted({entry[1] for entry in configs})
        cell_w = (xs[1] - xs[0]) if len(xs) >= 2 else None
        cell_h = (ys[1] - ys[0]) if len(ys) >= 2 else None
        return cell_w, cell_h

    @staticmethod
    def _grid_columns(configs):
        """
        Estimate the grid column count from the layout.

        Uses the number of distinct x-offsets when available (that is exactly
        the column count of a real grid); otherwise falls back to
        ceil(sqrt(N)).

        Args:
            configs: List of 4-tuples (x, y, cols, rows).

        Returns:
            int: Column count (at least 1).
        """
        distinct_x = {entry[0] for entry in configs}
        if len(distinct_x) > 1:
            return len(distinct_x)
        return max(1, math.ceil(math.sqrt(len(configs))))

    @staticmethod
    def _grid_gaps(cell_w, cell_h):
        """
        Auto-compute inter-window gaps from the cell size: a SLIGHT gap between
        columns and a LARGER gap between rows, each scaled to the cell with a
        sensible minimum. Returns (col_gap_px, row_gap_px).
        """
        col_gap = max(10, int((cell_w or 0) * 0.02))   # slight, between columns
        row_gap = max(28, int((cell_h or 0) * 0.06))   # more, between rows
        return col_gap, row_gap

    @staticmethod
    def _gap_geometry(x, y, cell_w, cell_h, frame, col_gap, row_gap):
        """
        Inset a grid cell into a CLIENT rectangle (px, py, w, h) that leaves
        ``col_gap`` between columns and ``row_gap`` between rows.

        The client size is reduced by the frame extents AND the gap, so adjacent
        window FRAMES (not just clients) are separated by exactly the gap. The
        window-manager applies a uniform position offset to every window, which
        cancels out between neighbours, so the realized gap equals the requested
        gap regardless of that offset. Falls back to the full cell when the cell
        pixel size is unknown (single row/column grids).
        """
        if not cell_w or not cell_h:
            return (x, y, cell_w, cell_h)
        fl, fr, ft, fb = frame if frame else (0, 0, 0, 0)
        w = max(160, cell_w - (fl + fr) - col_gap)
        h = max(90, cell_h - (ft + fb) - row_gap)
        px = x + col_gap // 2
        py = y + row_gap // 2
        return (px, py, w, h)

    @staticmethod
    def _frame_extents(wid):
        """
        Return the window-manager frame extents (left, right, top, bottom) in px
        for window id ``wid`` via ``_NET_FRAME_EXTENTS`` (xprop), or (0,0,0,0)
        when unknown/undecorated. Used so the gap is measured between window
        FRAMES (title bar + borders), not just client rectangles.
        """
        if not shutil.which("xprop"):
            return (0, 0, 0, 0)
        try:
            out = subprocess.run(
                ["xprop", "-id", f"0x{wid:x}", "_NET_FRAME_EXTENTS"],
                capture_output=True, text=True, timeout=5,
            )
            if "=" in out.stdout:
                nums = [int(t) for t in out.stdout.split("=", 1)[1].replace(" ", "").split(",")
                        if t.strip().lstrip("-").isdigit()]
                if len(nums) == 4:
                    return (nums[0], nums[1], nums[2], nums[3])
        except Exception:
            pass
        return (0, 0, 0, 0)

    # ------------------------------------------------------------------ #
    # Positioner discovery
    # ------------------------------------------------------------------ #

    @staticmethod
    def _find_positioner():
        """
        Return the preferred window positioner available on PATH.

        Prefers ``wmctrl`` (clean title-based move/resize), then ``xdotool``
        (works headlessly with --sync), else None.

        Returns:
            str or None: 'wmctrl', 'xdotool', or None.
        """
        if shutil.which("wmctrl"):
            return "wmctrl"
        if shutil.which("xdotool"):
            return "xdotool"
        return None

    # ------------------------------------------------------------------ #
    # Window-id management
    # ------------------------------------------------------------------ #

    @staticmethod
    def _list_window_ids():
        """
        Return the set of currently-managed top-level window ids (as ints).

        Prefers ``wmctrl -l`` (first column, hex), falling back to ``xdotool``.
        Diffing this set before vs after a launch identifies the new window
        without relying on its title or pid -- robust for shells that rewrite
        their title and for shared-server emulators (qterminal) whose windows
        do not map to the launching pid. Never raises.
        """
        ids = set()
        if shutil.which("wmctrl"):
            try:
                out = subprocess.run(["wmctrl", "-l"], capture_output=True,
                                     text=True, timeout=5)
                for line in out.stdout.splitlines():
                    parts = line.split(None, 1)
                    if parts:
                        try:
                            ids.add(int(parts[0], 16))
                        except ValueError:
                            pass
                return ids
            except Exception:
                pass
        if shutil.which("xdotool"):
            try:
                out = subprocess.run(
                    ["xdotool", "search", "--onlyvisible", "--name", "."],
                    capture_output=True, text=True, timeout=5,
                )
                for tok in out.stdout.split():
                    try:
                        ids.add(int(tok))
                    except ValueError:
                        pass
            except Exception:
                pass
        return ids

    def _resolve_new_window_id(self, snapshot, timeout=3.0, poll=0.05):
        """
        Block up to ``timeout`` seconds until a managed window id appears that is
        not in ``snapshot``; return it (the highest, if several) or None.

        Args:
            snapshot: Set of window ids (ints) observed before the launch.
            timeout: Maximum seconds to wait for the new window to map.
            poll: Polling interval in seconds.

        Returns:
            int or None: The new window id, or None on timeout.
        """
        deadline = time.time() + timeout
        while time.time() < deadline:
            new = self._list_window_ids() - snapshot
            if new:
                return max(new)
            time.sleep(poll)
        return None

    # ------------------------------------------------------------------ #
    # Placement: by id (primary) and by title (fallback)
    # ------------------------------------------------------------------ #

    @staticmethod
    def _place_by_id(positioner, wid, x, y, width=None, height=None):
        """
        Move (and optionally size) the window id ``wid`` (int) to (x, y).

        Uses ``wmctrl -i -r <id> -e`` (id is exact, no title needed) or
        ``xdotool windowmove``/``windowsize``. The id is stable, so this is
        immune to later title changes. Never raises.

        Args:
            positioner: 'wmctrl' or 'xdotool'.
            wid: Target window id (int).
            x, y: Target top-left position in pixels (window-manager frame).
            width, height: Optional target size in pixels (else size unchanged).
        """
        try:
            if positioner == "wmctrl":
                w = width if width else -1
                h = height if height else -1
                # -i: interpret -r argument as a numeric window id; -1 keeps a dim.
                subprocess.run(
                    ["wmctrl", "-i", "-r", f"0x{wid:08x}", "-e",
                     f"0,{x},{y},{w},{h}"],
                    capture_output=True, text=True, timeout=5,
                )
            else:
                subprocess.run(
                    ["xdotool", "windowmove", str(wid), str(x), str(y)],
                    capture_output=True, text=True, timeout=5,
                )
                if width and height:
                    subprocess.run(
                        ["xdotool", "windowsize", str(wid), str(width),
                         str(height)],
                        capture_output=True, text=True, timeout=5,
                    )
        except Exception as e:
            ColorPrint.plain(f"  place: failed to position id {wid:#x} ({e})")

    @staticmethod
    def _place_by_title_wmctrl(title, x, y, width=None, height=None):
        """
        Move (and optionally size) the window matched by ``title`` via wmctrl.

        Uses ``-F`` for an EXACT, case-sensitive full-title match; without it
        wmctrl matches the title as a case-insensitive substring, so "pylauncher-1"
        would also match "pylauncher-10/11/12". Fallback path only (id-based
        placement is primary and is immune to the shell rewriting the title).

        Args:
            title: Window title to match (exactly).
            x, y: Target top-left position in pixels.
            width, height: Optional target size in pixels (else size unchanged).
        """
        w = width if width else -1
        h = height if height else -1
        try:
            # -F exact match; -e <gravity>,<x>,<y>,<w>,<h>; -1 leaves a dim unchanged.
            subprocess.run(
                ["wmctrl", "-F", "-r", title, "-e", f"0,{x},{y},{w},{h}"],
                capture_output=True, text=True, timeout=5,
            )
            sized = "" if width is None else f" (size {width}x{height})"
            ColorPrint.plain(f"  wmctrl: placed {title} -> {x},{y}{sized}")
        except Exception as e:
            ColorPrint.plain(f"  wmctrl: failed to place {title} ({e})")

    @staticmethod
    def _place_by_title_xdotool(title, x, y, width=None, height=None):
        """
        Move (and optionally size) the window matched by ``title`` via xdotool.

        Resolves the window id from the title (``search --sync --name``) with an
        anchored ``^title$`` regex so "pylauncher-1" does not also match
        "pylauncher-10/11/12" (xdotool's --name is an unanchored regex). Fallback
        path only -- id-based placement is primary and is immune to the shell
        rewriting the title before this runs.

        Args:
            title: Window title to match (exactly, anchored).
            x, y: Target top-left position in pixels.
            width, height: Optional target size in pixels.
        """
        try:
            search = subprocess.run(
                ["xdotool", "search", "--sync", "--name", f"^{title}$"],
                capture_output=True, text=True, timeout=5,
            )
            wids = [w for w in search.stdout.split() if w]
            if not wids:
                ColorPrint.plain(f"  xdotool: no window found for title {title}")
                return
            for wid in wids:
                subprocess.run(
                    ["xdotool", "windowmove", wid, str(x), str(y)],
                    capture_output=True, text=True, timeout=5,
                )
                if width is not None and height is not None:
                    subprocess.run(
                        ["xdotool", "windowsize", wid, str(width), str(height)],
                        capture_output=True, text=True, timeout=5,
                    )
            sized = "" if width is None else f" (size {width}x{height})"
            ColorPrint.plain(f"  xdotool: placed {title} -> {x},{y}{sized}")
        except Exception as e:
            ColorPrint.plain(f"  xdotool: failed to place {title} ({e})")
