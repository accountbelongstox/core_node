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
        Launch N separate windows and position each by its window TITLE.

        Unlike ``_launch_x11_grid`` this does not depend on the emulator having a
        ``--geometry`` flag: each window self-sets a unique title via an OSC
        escape sequence, then a positioner (wmctrl or xdotool) moves/sizes the
        window matched by that title. This is what lets qterminal (Kali's only
        emulator, no geometry flag) form a real grid of separate windows.

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
        print(f"X11 session: launching {len(configs)} separate '{emulator}' "
              f"window(s), positioned by title via {positioner}"
              + (f" (cell {cell_w}x{cell_h}px)" if cell_w else "") + ".")

        pids = []
        placements = []  # (title, x, y) -- matched later by title

        for i, (x, y, cols, rows) in enumerate(configs, 1):
            title = f"pylauncher-{i}"
            # Inner command: self-set the window title (OSC 0) so the positioner
            # can find this window, then run the target command (or login shell).
            target = self.command or "${SHELL:-bash}"
            inner = "printf '\\033]0;%s\\007'; exec %s" % (title, target)
            # A geometry hint gets the window roughly placed before we enforce;
            # harmless on emulators that ignore it.
            geometry = f"{cols}x{rows}+{x}+{y}" if geom_capable else None
            argv = self._build_titled_argv(emulator, inner, geometry)
            if argv is None:
                continue
            try:
                proc = subprocess.Popen(argv, start_new_session=True)
                pids.append(proc.pid)
                placements.append((title, x, y))
                hint = f" geometry={geometry}" if geometry else ""
                print(f"  Window {i}: {emulator} title={title}{hint} "
                      f"(pid {proc.pid})")
            except Exception as e:
                print(f"  Window {i}: failed to launch ({e})")
            time.sleep(delay)

        # Let the windows map, then enforce placement by title.
        time.sleep(0.5)
        for title, x, y in placements:
            if positioner == "wmctrl":
                self._place_by_title_wmctrl(title, x, y, cell_w, cell_h)
            else:
                self._place_by_title_xdotool(title, x, y, cell_w, cell_h)

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

        Args:
            title: Window title to match.
            x, y: Target top-left position in pixels.
            width, height: Optional target size in pixels (else size unchanged).
        """
        w = width if width else -1
        h = height if height else -1
        try:
            # -e <gravity>,<x>,<y>,<w>,<h>; -1 leaves that dimension unchanged.
            subprocess.run(
                ["wmctrl", "-r", title, "-e", f"0,{x},{y},{w},{h}"],
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

        Resolves the window id from the title (``search --sync --name``), then
        moves and optionally resizes each matched id. Title matching works with
        any emulator that honoured the OSC title escape -- including qterminal,
        and avoids its shared-server-PID ambiguity.

        Args:
            title: Window title to match.
            x, y: Target top-left position in pixels.
            width, height: Optional target size in pixels.
        """
        try:
            search = subprocess.run(
                ["xdotool", "search", "--sync", "--name", title],
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
        Launch N separate windows, each positioned via X11 geometry, then
        best-effort enforce the position with wmctrl.

        Args:
            configs: List of 4-tuples (x, y, cols, rows).
            emulator: Name of the chosen X11 emulator (in X11_EMULATORS).
            delay: Delay between launches in seconds.

        Returns:
            list: Launched PIDs.
        """
        print(f"X11 session: launching {len(configs)} positioned "
              f"'{emulator}' window(s).")
        pids = []
        # Track everything we need to enforce position later: title (for wmctrl),
        # pid (for xdotool's --pid search) and the target rectangle.
        placements = []

        for i, (x, y, cols, rows) in enumerate(configs, 1):
            title = f"pylauncher-{i}"
            # X geometry: character cells + pixel offset, e.g. "80x24+100+200".
            geometry = f"{cols}x{rows}+{x}+{y}"
            argv = self._build_x11_argv(emulator, title, geometry)
            if argv is None:
                continue
            try:
                proc = subprocess.Popen(argv, start_new_session=True)
                pids.append(proc.pid)
                placements.append((title, proc.pid, x, y))
                print(f"  Window {i}: {emulator} title={title} "
                      f"geometry={geometry} (pid {proc.pid})")
            except Exception as e:
                print(f"  Window {i}: failed to launch ({e})")
            time.sleep(delay)

        # Geometry is only a WM hint; enforce the real positions afterwards.
        # Prefer wmctrl (matches by title) and fall back to xdotool (matches by
        # pid). Give the windows a moment to map first.
        self._enforce_positions(placements)
        return pids

    def _enforce_positions(self, placements):
        """
        Best-effort move each launched window to its target position on X11.

        Prefers ``wmctrl`` (match by window title) and falls back to
        ``xdotool`` (match by process id). With neither tool present we simply
        leave the windows where the WM placed them. Never raises.

        Args:
            placements: List of (title, pid, x, y) for each launched window.
        """
        if not placements:
            return

        use_wmctrl = bool(shutil.which("wmctrl"))
        use_xdotool = bool(shutil.which("xdotool"))
        if not (use_wmctrl or use_xdotool):
            print("  Note: neither wmctrl nor xdotool found; cannot enforce "
                  "window positions (relying on the emulator geometry hint).")
            return

        # Let the windows map before we try to address them.
        time.sleep(0.4)
        for title, pid, x, y in placements:
            if use_wmctrl:
                self._move_with_wmctrl(title, x, y)
            else:
                self._move_with_xdotool(pid, x, y)

    @staticmethod
    def _move_with_wmctrl(title, x, y):
        """Move the window titled ``title`` to (x, y) via wmctrl (move only)."""
        try:
            # -e <gravity>,<x>,<y>,<w>,<h>; -1 keeps the current size.
            subprocess.run(
                ["wmctrl", "-r", title, "-e", f"0,{x},{y},-1,-1"],
                capture_output=True, text=True, timeout=5,
            )
            print(f"  wmctrl: moved {title} -> {x},{y}")
        except Exception as e:
            print(f"  wmctrl: failed to move {title} ({e})")

    @staticmethod
    def _move_with_xdotool(pid, x, y, width=None, height=None):
        """
        Move (and optionally resize) the window owned by ``pid`` via xdotool.

        ``xdotool search --sync --pid <pid>`` blocks until a matching window
        exists, then we move it; if a pixel size is known we also resize it,
        otherwise we move only.

        Args:
            pid: Process id of the launched terminal.
            x, y: Target top-left position in pixels.
            width, height: Optional target size in pixels.
        """
        try:
            search = subprocess.run(
                ["xdotool", "search", "--sync", "--pid", str(pid)],
                capture_output=True, text=True, timeout=5,
            )
            wids = [w for w in search.stdout.split() if w]
            if not wids:
                print(f"  xdotool: no window found for pid {pid}")
                return
            # A process may own several X windows; the last id is typically the
            # top-level frame. Address them all to be safe.
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
            print(f"  xdotool: moved pid {pid} -> {x},{y}{sized}")
        except Exception as e:
            print(f"  xdotool: failed to move pid {pid} ({e})")

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
