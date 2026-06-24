# -*- coding: utf-8 -*-
"""
Linux Terminal Launcher
Launches a positioned grid of native terminals on Linux (X11 / Wayland).

This is the Linux counterpart of ``wt_launcher.WindowsTerminalLauncher`` and
exposes the same public surface (``launch_windows``). It picks one of two
strategies based on the session type:

  * X11 -- we launch N separate, individually-positioned windows. The robust
    path needs only a positioner (``wmctrl`` or ``xdotool``) plus ANY emulator:
    each window self-sets a unique title (OSC escape) and the positioner
    moves/sizes it by title, so it works even with qterminal (no geometry flag).
    A geometry-capable emulator (xfce4-terminal / gnome-terminal / konsole /
    xterm), when present, additionally gets an ``--geometry`` hint for a head
    start. With a geometry emulator but no positioner we fall back to the
    geometry hint alone (best-effort -- the WM may ignore it).

  * Wayland -- a real client-positioned multi-window grid is IMPOSSIBLE by
    design: the xdg-shell protocol deliberately forbids a client from setting
    its own window's screen coordinates (the compositor owns placement). So we
    fall back to a SINGLE window whose internal PANES form the grid, using
    ``kitty`` (session file) or ``tmux`` (split panes), or, failing those, N
    plain unpositioned terminals that the compositor tiles on its own.

Note: ``qterminal`` (Kali's default) has no geometry flag, so it is excluded
from the geometry-emulator list used by the separate-window X11 path. It IS,
however, used for the tmux-attach and unpositioned fallbacks (it can run a
command via ``-e``). Every launch is wrapped in try/except; this class never
raises and returns a best-effort list of launched PIDs.
"""

import math
import os
import shlex
import shutil
import subprocess
import tempfile
import time


class LinuxTerminalLauncher:
    """Launch a positioned grid of native Linux terminals (X11 / Wayland)."""

    # Geometry-capable X11 emulators, in preference order. Used only by the
    # separate-window X11 path. qterminal is intentionally absent -- it has no
    # geometry flag, so it cannot self-position individual windows.
    X11_EMULATORS = ("xfce4-terminal", "gnome-terminal", "konsole", "xterm")

    # Broad emulator list for the fallback paths (tmux-attach window and the
    # unpositioned last resort), where no geometry is needed -- so qterminal is
    # included. First found on PATH wins; xterm is the universal last resort.
    FALLBACK_EMULATORS = ("xfce4-terminal", "gnome-terminal", "konsole",
                          "qterminal", "xterm")

    def __init__(self, command=None, prefer_paned=False):
        """
        Initialize the Linux terminal launcher.

        Args:
            command: Command string to run inside each terminal. When None the
                terminal opens the user's interactive login shell.
            prefer_paned: When True, force the single-window tmux/kitty paned
                grid even on X11 where separate positioned windows are possible.
                Default False -- prefer real separate windows (the user asked
                for "12 windows").
        """
        self.command = command
        self.prefer_paned = prefer_paned

    # ------------------------------------------------------------------ #
    # Public surface (mirrors WindowsTerminalLauncher.launch_windows)
    # ------------------------------------------------------------------ #

    def launch_windows(self, windows_config, delay=0.2, ubuntu_count=0):
        """
        Launch the terminal grid described by ``windows_config``.

        Args:
            windows_config: List of tuples ``(x, y, term_cols, term_rows[, ...])``.
                4- or 6-tuples are accepted; only the first four fields are used.
            delay: Delay between launches in seconds.
            ubuntu_count: Windows/WSL split count. IGNORED on Linux -- every
                entry is launched as a native terminal.

        Returns:
            list: Best-effort list of launched PIDs.
        """
        # Normalise to 4-tuples up front so both strategies share the shape.
        configs = [tuple(entry[:4]) for entry in windows_config]
        count = len(configs)
        if count == 0:
            print("No windows to launch.")
            return []

        is_wayland = os.environ.get("XDG_SESSION_TYPE", "").lower() == "wayland"
        positioner = self._find_positioner()              # wmctrl > xdotool > None
        geom_emu = self._find_x11_emulator()              # geometry-capable, no qterminal
        any_emu = self._find_fallback_emulator_or_none()  # broad list incl. qterminal

        # Strategy selection. Separate real windows are the DEFAULT on X11 (the
        # user asked for "12 windows"); the paned grid is the automatic fallback.
        #   1. X11 + a positioner (wmctrl/xdotool) + ANY emulator, and the caller
        #      did not force paned -> N separate windows positioned BY TITLE.
        #      Title-matching is the only thing that works with qterminal (no
        #      geometry flag) and sidesteps its shared-server-PID problem. Prefer
        #      a geometry-capable emulator when present (its --geometry hint gets
        #      the window close before we enforce), else use qterminal/any.
        #   2. X11 + a geometry-capable emulator but no positioner -> geometry
        #      hint only (best-effort; the WM may ignore it).
        #   3. Otherwise (Wayland, no emulator, or prefer_paned) -> paned window.
        if (not is_wayland and positioner and any_emu
                and not getattr(self, "prefer_paned", False)):
            return self._launch_x11_positioned(
                configs, geom_emu or any_emu, positioner, delay)

        if not is_wayland and geom_emu is not None:
            return self._launch_x11_grid(configs, geom_emu, delay)

        if is_wayland:
            print("Wayland session detected: clients cannot position their own "
                  "windows (xdg-shell), falling back to a single paned window.")
        elif getattr(self, "prefer_paned", False):
            print("prefer_paned set: using a single paned window.")
        else:
            print("No terminal emulator/positioner available, falling back "
                  "to a single paned window.")
        return self._launch_paned_grid(configs, delay)

    # ------------------------------------------------------------------ #
    # X11 strategy A: N separate windows positioned BY TITLE (any emulator)
    # ------------------------------------------------------------------ #

    def _launch_x11_positioned(self, configs, emulator, positioner, delay):
        """
        Launch N separate windows and position each by its STABLE X window id.

        Each window is launched one at a time; immediately after spawning, its
        new window id is found by diffing the managed-window list (before vs
        after), then the window is moved/sized by that id. This deliberately does
        NOT match by window title, because on a default desktop two real effects
        break title matching:
          * the interactive shell's prompt rewrites the OSC title to
            "user@host: cwd" (Kali/Debian bash sets it via PROMPT_COMMAND) before
            any delayed placement runs, so a launcher-set title no longer exists;
          * with >=10 windows the titles "pylauncher-1".."pylauncher-12" collide
            under wmctrl's case-insensitive SUBSTRING match and xdotool's
            unanchored regex ("pylauncher-1" also matches "-10/-11/-12").
        A window id never changes, so neither effect can misplace the grid. This
        is also what lets qterminal (no --geometry flag, shared server PID) form
        a real grid of separate windows. Title matching remains a fallback only.

        Args:
            configs: List of 4-tuples (x, y, cols, rows).
            emulator: Emulator to launch (geometry-capable preferred, else any).
            positioner: 'wmctrl' or 'xdotool'.
            delay: Delay between launches in seconds.

        Returns:
            list: Launched PIDs.
        """
        geom_capable = emulator in self.X11_EMULATORS
        cell_w, cell_h = self._cell_pixel_size(configs)
        col_gap, row_gap = self._grid_gaps(cell_w, cell_h)
        frame = None  # WM frame extents, measured once from the first window
        width = len(str(len(configs)))  # zero-pad index so titles never collide
        print(f"X11 session: launching {len(configs)} separate '{emulator}' "
              f"window(s), positioned by captured window id via {positioner}"
              + (f" (cell {cell_w}x{cell_h}px, gaps {col_gap}/{row_gap}px)" if cell_w else "") + ".")

        pids = []
        snapshot = self._list_window_ids()  # baseline before we add any window

        for i, (x, y, cols, rows) in enumerate(configs, 1):
            title = f"pylauncher-{i:0{width}d}"
            # Inner command: self-set a (cosmetic, fallback-only) unique title,
            # then run the target command or login shell. The shell is free to
            # rewrite the title afterwards -- placement matches by id, not title.
            target = self.command or "${SHELL:-bash}"
            inner = "printf '\\033]0;%s\\007'; exec %s" % (title, target)
            # A geometry hint gets the window roughly placed up front (harmless on
            # emulators that ignore it); the id-based move then snaps it exactly.
            geometry = f"{cols}x{rows}+{x}+{y}" if geom_capable else None
            argv = self._build_titled_argv(emulator, inner, geometry)
            if argv is None:
                continue
            try:
                proc = subprocess.Popen(argv, start_new_session=True)
                pids.append(proc.pid)
            except Exception as e:
                print(f"  Window {i}: failed to launch ({e})")
                continue
            # Identify the window we just created (one launch -> one new id).
            wid = self._resolve_new_window_id(snapshot)
            if wid is not None:
                snapshot.add(wid)
                if frame is None:
                    frame = self._frame_extents(wid)
                px, py, w, h = self._gap_geometry(x, y, cell_w, cell_h, frame, col_gap, row_gap)
                self._place_by_id(positioner, wid, px, py, w, h)
                print(f"  Window {i}: {emulator} -> id {wid:#010x} @ {px},{py}"
                      + (f" ({w}x{h}px)" if cell_w else "")
                      + f" (pid {proc.pid})")
            else:
                # Id capture timed out: fall back to (hardened, exact) title match.
                px, py, w, h = self._gap_geometry(x, y, cell_w, cell_h, frame, col_gap, row_gap)
                print(f"  Window {i}: id capture timed out; title-matching "
                      f"{title}")
                if positioner == "wmctrl":
                    self._place_by_title_wmctrl(title, px, py, w, h)
                else:
                    self._place_by_title_xdotool(title, px, py, w, h)
            time.sleep(delay)

        return pids

    def _build_titled_argv(self, emulator, inner, geometry=None):
        """
        Build argv that runs ``inner`` (a bash -lc snippet that self-titles the
        window) inside ``emulator``, optionally passing an X ``--geometry`` hint.

        Args:
            emulator: Emulator name (on PATH).
            inner: Shell snippet to run via ``bash -lc``.
            geometry: Optional X geometry hint "<cols>x<rows>+<x>+<y>".

        Returns:
            list: argv for subprocess.Popen, or None if unsupported.
        """
        if emulator == "xfce4-terminal":
            argv = [emulator]
            if geometry:
                argv.append(f"--geometry={geometry}")
            # xfce4-terminal takes a single command string; shlex.quote keeps the
            # inner snippet intact through that extra shell-word parse.
            argv.append("--command=bash -lc {}".format(shlex.quote(inner)))
            return argv

        if emulator == "gnome-terminal":
            argv = [emulator]
            if geometry:
                argv.append(f"--geometry={geometry}")
            argv += ["--", "bash", "-lc", inner]
            return argv

        # konsole, qterminal, xterm and any other emulator: shared -e convention.
        # (qterminal: `qterminal -e bash -lc '<inner>'`.)
        argv = [emulator]
        if geometry and emulator == "xterm":
            argv += ["-geometry", geometry]
        elif geometry and emulator == "konsole":
            argv += ["--geometry", geometry]
        argv += ["-e", "bash", "-lc", inner]
        return argv

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
            print(f"  wmctrl: placed {title} -> {x},{y}{sized}")
        except Exception as e:
            print(f"  wmctrl: failed to place {title} ({e})")

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
                print(f"  xdotool: no window found for title {title}")
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
            print(f"  xdotool: placed {title} -> {x},{y}{sized}")
        except Exception as e:
            print(f"  xdotool: failed to place {title} ({e})")

    # ------------------------------------------------------------------ #
    # X11 strategy B: N separate windows positioned via geometry hint only
    # ------------------------------------------------------------------ #

    def _launch_x11_grid(self, configs, emulator, delay):
        """
        Launch N separate geometry-capable windows (each gets an X ``--geometry``
        hint up front), then enforce the exact position/size by captured window
        id. The geometry hint places each window roughly the instant it maps; the
        id-based move then snaps it precisely. Matching by id (not title) is
        immune to the shell rewriting the title and to the >=10 title-substring
        collision (see ``_launch_x11_positioned``).

        Args:
            configs: List of 4-tuples (x, y, cols, rows).
            emulator: Name of the chosen X11 emulator (in X11_EMULATORS).
            delay: Delay between launches in seconds.

        Returns:
            list: Launched PIDs.
        """
        cell_w, cell_h = self._cell_pixel_size(configs)
        col_gap, row_gap = self._grid_gaps(cell_w, cell_h)
        frame = None  # WM frame extents, measured once from the first window
        width = len(str(len(configs)))
        positioner = self._find_positioner()
        print(f"X11 session: launching {len(configs)} positioned "
              f"'{emulator}' window(s)"
              + (f", snapped by id via {positioner} (gaps {col_gap}/{row_gap}px)" if positioner else "") + ".")
        pids = []
        snapshot = self._list_window_ids()

        for i, (x, y, cols, rows) in enumerate(configs, 1):
            title = f"pylauncher-{i:0{width}d}"
            # X geometry: character cells + pixel offset, e.g. "80x24+100+200".
            geometry = f"{cols}x{rows}+{x}+{y}"
            argv = self._build_x11_argv(emulator, title, geometry)
            if argv is None:
                continue
            try:
                proc = subprocess.Popen(argv, start_new_session=True)
                pids.append(proc.pid)
            except Exception as e:
                print(f"  Window {i}: failed to launch ({e})")
                continue
            wid = self._resolve_new_window_id(snapshot) if positioner else None
            if wid is not None:
                snapshot.add(wid)
                if frame is None:
                    frame = self._frame_extents(wid)
                px, py, w, h = self._gap_geometry(x, y, cell_w, cell_h, frame, col_gap, row_gap)
                self._place_by_id(positioner, wid, px, py, w, h)
                print(f"  Window {i}: {emulator} geometry={geometry} -> "
                      f"id {wid:#010x} @ {px},{py} (pid {proc.pid})")
            else:
                # No positioner / id capture failed: rely on the geometry hint.
                print(f"  Window {i}: {emulator} geometry={geometry} "
                      f"(pid {proc.pid}; geometry hint only)")
            time.sleep(delay)

        return pids

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
            print(f"  place: failed to position id {wid:#x} ({e})")

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

    def _build_x11_argv(self, emulator, title, geometry):
        """
        Build the argv for one positioned X11 terminal window.

        Args:
            emulator: Emulator name (already known to be on PATH).
            title: Unique window title (used later by wmctrl).
            geometry: X geometry string "<cols>x<rows>+<x>+<y>".

        Returns:
            list: argv for subprocess.Popen, or None if unsupported.
        """
        cmd = self.command

        if emulator == "xfce4-terminal":
            argv = [emulator, f"--title={title}", f"--geometry={geometry}"]
            if cmd:
                argv.append(f"--command={cmd}")
            return argv

        if emulator == "gnome-terminal":
            argv = [emulator, f"--title={title}", f"--geometry={geometry}"]
            if cmd:
                argv += ["--", "bash", "-lc", cmd]
            return argv

        if emulator == "konsole":
            argv = [emulator, "-p", f"tabtitle={title}", "--geometry", geometry]
            if cmd:
                argv += ["-e", "bash", "-lc", cmd]
            return argv

        if emulator == "xterm":
            argv = [emulator, "-title", title, "-geometry", geometry]
            if cmd:
                argv += ["-e", "bash", "-lc", cmd]
            return argv

        return None

    # ------------------------------------------------------------------ #
    # Wayland / fallback strategy: single window, internal panes
    # ------------------------------------------------------------------ #

    def _launch_paned_grid(self, configs, delay):
        """
        Launch a single window whose internal panes form the grid.

        Tries kitty (session file), then tmux (split panes inside an emulator),
        then a last-resort spray of plain unpositioned terminals.

        Args:
            configs: List of 4-tuples (x, y, cols, rows).
            delay: Delay between launches in seconds.

        Returns:
            list: Launched PIDs.
        """
        count = len(configs)
        columns = self._grid_columns(configs)

        if shutil.which("kitty"):
            return self._launch_kitty(count)

        if shutil.which("tmux"):
            return self._launch_tmux(count, columns)

        print("Neither kitty nor tmux found; launching plain unpositioned "
              "terminals (the compositor will tile them). Install 'kitty' or "
              "'tmux' for a proper single-window grid.")
        return self._launch_plain(count, delay)

    def _launch_kitty(self, count):
        """
        Launch a single kitty window with ``count`` panes in a grid layout,
        driven by a temporary session file.

        Args:
            count: Number of panes to open.

        Returns:
            list: Launched PIDs.
        """
        shell = self.command or os.environ.get("SHELL", "bash")
        # kitty session file: a 'grid' layout then one 'launch' per pane.
        lines = ["layout grid"]
        for _ in range(count):
            lines.append(f"launch {shell}")
        session_text = "\n".join(lines) + "\n"

        try:
            fd, path = tempfile.mkstemp(prefix="pylauncher-kitty-", suffix=".conf")
            with os.fdopen(fd, "w") as fh:
                fh.write(session_text)
        except Exception as e:
            print(f"  kitty: failed to write session file ({e})")
            return []

        try:
            proc = subprocess.Popen(
                ["kitty", "--session", path], start_new_session=True,
            )
            print(f"  kitty: single window, {count} panes (grid layout) "
                  f"(pid {proc.pid})")
            return [proc.pid]
        except Exception as e:
            print(f"  kitty: failed to launch ({e})")
            return []

    def _launch_tmux(self, count, columns):
        """
        Build a tmux session with ``count`` tiled panes, then open it inside a
        terminal emulator attached to that session.

        Args:
            count: Number of panes to create.
            columns: Grid column count (for logging only -- 'tiled' layout
                handles the actual arrangement).

        Returns:
            list: Launched PIDs.
        """
        shell = self.command or os.environ.get("SHELL", "bash")
        session = "pylauncher"

        # Best-effort: tear down any stale session of the same name first.
        try:
            subprocess.run(["tmux", "kill-session", "-t", session],
                           capture_output=True, text=True, timeout=5)
        except Exception:
            pass

        try:
            subprocess.run(["tmux", "new-session", "-d", "-s", session, shell],
                           capture_output=True, text=True, timeout=5)
            # Add the remaining panes, re-tiling after each split so we never
            # run out of room for the next one.
            for _ in range(count - 1):
                subprocess.run(
                    ["tmux", "split-window", "-t", session, shell],
                    capture_output=True, text=True, timeout=5,
                )
                subprocess.run(
                    ["tmux", "select-layout", "-t", session, "tiled"],
                    capture_output=True, text=True, timeout=5,
                )
            subprocess.run(["tmux", "select-layout", "-t", session, "tiled"],
                           capture_output=True, text=True, timeout=5)
        except Exception as e:
            print(f"  tmux: failed to build session ({e})")
            return []

        # Open a terminal attached to the session. No geometry needed -- it is a
        # single window -- so use the broad list (qterminal is fine here).
        emulator = self._find_fallback_emulator()
        attach = ["tmux", "attach", "-t", session]
        argv = self._build_attach_argv(emulator, attach)

        try:
            proc = subprocess.Popen(argv, start_new_session=True)
            print(f"  tmux: single window, {count} tiled panes "
                  f"(~{columns} cols) via {emulator} (pid {proc.pid})")
            return [proc.pid]
        except Exception as e:
            print(f"  tmux: failed to open attaching terminal ({e})")
            return []

    def _build_attach_argv(self, emulator, attach_cmd):
        """
        Build argv that runs ``attach_cmd`` inside ``emulator`` (no geometry).

        Args:
            emulator: Emulator name.
            attach_cmd: List form of the command to run (e.g. tmux attach).

        Returns:
            list: argv for subprocess.Popen.
        """
        if emulator == "xfce4-terminal":
            return [emulator, "--command=" + " ".join(attach_cmd)]
        if emulator == "gnome-terminal":
            return [emulator, "--"] + attach_cmd
        # konsole, qterminal, xterm and any fallback share the -e convention.
        # (qterminal: `qterminal -e <cmd...>`.)
        return [emulator, "-e"] + attach_cmd

    def _launch_plain(self, count, delay):
        """
        Last resort: launch ``count`` plain, unpositioned terminals and let the
        compositor/WM place them.

        Args:
            count: Number of terminals to launch.
            delay: Delay between launches in seconds.

        Returns:
            list: Launched PIDs.
        """
        emulator = self._find_fallback_emulator()
        pids = []
        for i in range(1, count + 1):
            if self.command:
                argv = self._build_attach_argv(
                    emulator, ["bash", "-lc", self.command],
                )
            else:
                argv = [emulator]
            try:
                proc = subprocess.Popen(argv, start_new_session=True)
                pids.append(proc.pid)
                print(f"  Plain terminal {i}: {emulator} (pid {proc.pid})")
            except Exception as e:
                print(f"  Plain terminal {i}: failed to launch ({e})")
            time.sleep(delay)
        return pids

    # ------------------------------------------------------------------ #
    # Helpers
    # ------------------------------------------------------------------ #

    def _find_x11_emulator(self):
        """
        Return the first geometry-capable X11 emulator on PATH, or None.

        Used by the separate-window X11 path, which needs an emulator that can
        self-position via geometry. qterminal is therefore excluded.

        Returns:
            str or None: Emulator name from X11_EMULATORS.
        """
        for emulator in self.X11_EMULATORS:
            if shutil.which(emulator):
                return emulator
        return None

    def _find_fallback_emulator(self):
        """
        Return the first emulator from the broad fallback list on PATH.

        Used by the single-window fallbacks (tmux-attach, unpositioned), where
        no geometry is required -- so qterminal is eligible. Defaults to
        ``xterm`` as a universal last resort even if nothing is found, so the
        caller always has something to try.

        Returns:
            str: Emulator name (from FALLBACK_EMULATORS, or "xterm").
        """
        for emulator in self.FALLBACK_EMULATORS:
            if shutil.which(emulator):
                return emulator
        return "xterm"

    def _find_fallback_emulator_or_none(self):
        """
        Like ``_find_fallback_emulator`` but returns None when nothing is found.

        Used by ``launch_windows`` to decide whether ANY emulator (including
        qterminal) exists for the position-by-title path, without the "xterm"
        default masking a truly empty PATH.

        Returns:
            str or None: Emulator name from FALLBACK_EMULATORS, or None.
        """
        for emulator in self.FALLBACK_EMULATORS:
            if shutil.which(emulator):
                return emulator
        return None

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
