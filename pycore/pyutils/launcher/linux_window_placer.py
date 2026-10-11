# -*- coding: utf-8 -*-
"""
Linux Window Placer
Grid geometry math plus window placement for the terminal grid launcher.

Window enumeration, EWMH move/resize and frame extents come from the shared
X11/Xwayland library ``pyutils.common.x11_display`` (the same library the
Terminal Control backend uses). This module only adds the pure grid math:
cell pixel size, inter-window gaps, client-rectangle insets, and column-count
estimation. Native Wayland clients cannot be positioned; the launcher's
Wayland path runs X11-backend emulators through Xwayland instead.
"""

import math
import time

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyutils.common.x11_display import x11_display


X11_POSITIONER = "x11"


class LinuxWindowPlacer:
    """Grid geometry math and X11/Xwayland window placement."""

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
        """Window-manager frame extents (left, right, top, bottom) for ``wid``, or zeros."""
        return x11_display.frame_extents(wid)

    # ------------------------------------------------------------------ #
    # Positioner discovery and window-id management (shared X11 library)
    # ------------------------------------------------------------------ #

    @staticmethod
    def _find_positioner():
        """Return 'x11' when the shared X11/Xwayland display can position windows, else None."""
        return X11_POSITIONER if x11_display.probe()["available"] else None

    @staticmethod
    def _list_window_ids():
        """Return the set of managed top-level window ids (ints) from _NET_CLIENT_LIST."""
        return x11_display.window_ids()

    def _resolve_new_window_id(self, snapshot, timeout=3.0, poll=0.05):
        """
        Block up to ``timeout`` seconds until a managed window id appears that is
        not in ``snapshot``; return it (the highest, if several) or None.
        """
        deadline = time.time() + timeout
        while time.time() < deadline:
            new = self._list_window_ids() - snapshot
            if new:
                return max(new)
            time.sleep(poll)
        return None

    @staticmethod
    def _place_by_id(wid, x, y, width=None, height=None):
        """Move (and optionally size) window id ``wid`` to (x, y) through EWMH."""
        if not x11_display.move_resize(wid, x, y, width, height):
            ColorPrint.plain(f"  place: failed to position id {wid:#x}")

    @staticmethod
    def _place_by_title(title, x, y, width=None, height=None):
        """Fallback: move every window whose title equals ``title`` exactly."""
        wids = x11_display.find_by_title(title)
        if not wids:
            ColorPrint.plain(f"  x11: no window found for title {title}")
            return
        for wid in wids:
            x11_display.move_resize(wid, x, y, width, height)
        sized = "" if width is None else f" (size {width}x{height})"
        ColorPrint.plain(f"  x11: placed {title} -> {x},{y}{sized}")
