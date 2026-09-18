# -*- coding: utf-8 -*-
"""
Linux Terminal Launcher (facade)
Launches a positioned grid of native terminals on Linux (X11 / Wayland).

This is the Linux counterpart of ``wt_launcher.WindowsTerminalLauncher`` and
exposes the same public surface (``launch_windows``). It is a thin facade that
composes two sibling concerns, each a standalone never-raising class mirroring
the precedent of ``linux_screen_manager.LinuxScreenManager``:

  * ``linux_window_placer.LinuxWindowPlacer`` -- X11 window-id management and
    grid geometry math (list/resolve window ids, place by id or title, gaps,
    frame extents, cell/column math).
  * ``linux_terminal_argv.LinuxTerminalArgv`` -- per-emulator argv construction
    and PATH-based emulator discovery.

The facade itself owns only the strategy: it picks one of two strategies based
on the session type:

  * X11 -- we launch N separate, individually-positioned windows. The robust
    path needs only a positioner (``wmctrl`` or ``xdotool``) plus ANY emulator:
    each window self-sets a unique title (OSC escape) and the positioner
    moves/sizes it by captured window id, so it works even with qterminal (no
    geometry flag). A geometry-capable emulator (xfce4-terminal / gnome-terminal
    / konsole / xterm), when present, additionally gets an ``--geometry`` hint
    for a head start. With a geometry emulator but no positioner we fall back to
    the geometry hint alone (best-effort -- the WM may ignore it).

  * Wayland -- native Wayland clients cannot position their own windows (the
    xdg-shell protocol deliberately leaves placement to the compositor), but N
    separate positioned windows ARE still possible through XWayland: a
    single-process emulator launched with its X11 backend (GTK ``GDK_BACKEND``
    / Qt ``QT_QPA_PLATFORM``, per the official GTK/Qt docs) creates X11 windows
    that ``wmctrl``/``xdotool`` place exactly as on X11. That path is used
    whenever a positioner and a suitable emulator exist. Only when it does not
    apply do we fall back to a SINGLE window whose internal PANES form the grid
    (``kitty`` session file or ``tmux`` split panes), or, failing those, N plain
    unpositioned terminals that the compositor tiles on its own.
    gnome-terminal cannot use the XWayland path: it is a D-Bus client of the
    already-running gnome-terminal-server, so its windows always carry the
    server's Wayland backend.

Note: ``qterminal`` (Kali's default) has no geometry flag, so it is excluded
from the geometry-emulator list used by the separate-window X11 path. It IS,
however, used for the tmux-attach and unpositioned fallbacks (it can run a
command via ``-e``). Every launch is wrapped in try/except; this class never
raises and returns a best-effort list of launched PIDs.
"""

import os
import shutil
import subprocess
import tempfile
import time

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.pygvar import TMP_DIR
from pycore.pyutils.launcher.linux_window_placer import LinuxWindowPlacer
from pycore.pyutils.launcher.linux_terminal_argv import LinuxTerminalArgv


class LinuxTerminalLauncher:
    """Launch a positioned grid of native Linux terminals (X11 / Wayland)."""

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
        # Composed sibling concerns (standalone, never-raising). LinuxTerminalArgv
        # is stateless; the command is passed into _build_x11_argv at call time so a
        # post-construction reassignment of self.command still takes effect.
        self._placer = LinuxWindowPlacer()
        self._argv = LinuxTerminalArgv()

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
            ColorPrint.plain("No windows to launch.")
            return []

        # WAYLAND_DISPLAY is set by every Wayland compositor and is the canonical
        # signal; XDG_SESSION_TYPE is absent/wrong when a compositor starts outside a
        # display manager (e.g. sway from a VT, mutter-wayland) -- without this a
        # Wayland session is misread as X11 and wmctrl/xdotool fail silently.
        is_wayland = (os.environ.get("XDG_SESSION_TYPE", "").lower() == "wayland"
                      or bool(os.environ.get("WAYLAND_DISPLAY")))
        positioner = self._placer._find_positioner()              # wmctrl > xdotool > None
        geom_emu = self._argv._find_x11_emulator()                # geometry-capable, no qterminal
        any_emu = self._argv._find_fallback_emulator_or_none()    # broad list incl. qterminal

        # Strategy selection. Separate real windows are the DEFAULT (the user
        # asked for "12 windows"); the paned grid is the automatic fallback.
        #   1. X11 + a positioner (wmctrl/xdotool) + ANY emulator, and the caller
        #      did not force paned -> N separate windows positioned BY TITLE.
        #      Title-matching is the only thing that works with qterminal (no
        #      geometry flag) and sidesteps its shared-server-PID problem. Prefer
        #      a geometry-capable emulator when present (its --geometry hint gets
        #      the window close before we enforce), else use qterminal/any.
        #   2. Wayland + a positioner + an X11-backend-capable emulator -> the
        #      same separate-windows path through XWayland (backend-forcing env).
        #   3. X11 + a geometry-capable emulator but no positioner -> geometry
        #      hint only (best-effort; the WM may ignore it).
        #   4. Otherwise (no emulator/positioner/backend path, or prefer_paned)
        #      -> paned window.
        if (not is_wayland and positioner and any_emu
                and not getattr(self, "prefer_paned", False)):
            return self._launch_x11_positioned(
                configs, geom_emu or any_emu, positioner, delay)

        if is_wayland and not getattr(self, "prefer_paned", False):
            wayland_emu = self._argv._find_wayland_x11_emulator()
            if positioner and wayland_emu:
                ColorPrint.plain("Wayland session detected: launching separate windows on the "
                      "X11 backend (XWayland) so they can be positioned like on X11.")
                return self._launch_x11_positioned(
                    configs, wayland_emu, positioner, delay,
                    env_extra=self._argv._x11_backend_env(wayland_emu))

        if not is_wayland and geom_emu is not None:
            return self._launch_x11_grid(configs, geom_emu, delay)

        if is_wayland:
            ColorPrint.plain("Wayland session without a usable X11-backend emulator/positioner: "
                  "falling back to a single paned window.")
        elif getattr(self, "prefer_paned", False):
            ColorPrint.plain("prefer_paned set: using a single paned window.")
        else:
            ColorPrint.plain("No terminal emulator/positioner available, falling back "
                  "to a single paned window.")
        return self._launch_paned_grid(configs, delay)

    # ------------------------------------------------------------------ #
    # X11 strategy A: N separate windows positioned BY TITLE (any emulator)
    # ------------------------------------------------------------------ #

    def _launch_x11_positioned(self, configs, emulator, positioner, delay, env_extra=None):
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

        XWayland note: under GNOME/Wayland the compositor applies its own
        map-time placement a moment AFTER the window appears in the client list,
        which can overwrite the launcher's first move. Every captured window is
        therefore moved once more in a short re-assert pass after the loop.

        Args:
            configs: List of 4-tuples (x, y, cols, rows).
            emulator: Emulator to launch (geometry-capable preferred, else any).
            positioner: 'wmctrl' or 'xdotool'.
            delay: Delay between launches in seconds.
            env_extra: Optional env overrides merged over os.environ for the
                spawned emulator (e.g. the X11-backend-forcing vars used on
                Wayland/XWayland).

        Returns:
            list: Launched PIDs.
        """
        geom_capable = emulator in self._argv.X11_EMULATORS
        cell_w, cell_h = self._placer._cell_pixel_size(configs)
        col_gap, row_gap = self._placer._grid_gaps(cell_w, cell_h)
        frame = None  # WM frame extents, measured once from the first window
        width = len(str(len(configs)))  # zero-pad index so titles never collide
        popen_env = None
        if env_extra:
            popen_env = dict(os.environ)
            popen_env.update(env_extra)
        ColorPrint.plain(f"X11 session: launching {len(configs)} separate '{emulator}' "
              f"window(s), positioned by captured window id via {positioner}"
              + (f" (cell {cell_w}x{cell_h}px, gaps {col_gap}/{row_gap}px)" if cell_w else "") + ".")

        pids = []
        placed = []  # (wid, px, py, w, h) captured ids, re-asserted after the loop
        snapshot = self._placer._list_window_ids()  # baseline before we add any window

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
            argv = self._argv._build_titled_argv(emulator, inner, geometry)
            if argv is None:
                continue
            try:
                proc = subprocess.Popen(argv, start_new_session=True, env=popen_env)
                pids.append(proc.pid)
            except Exception as e:
                ColorPrint.plain(f"  Window {i}: failed to launch ({e})")
                continue
            # Identify the window we just created (one launch -> one new id).
            wid = self._placer._resolve_new_window_id(snapshot)
            if wid is not None:
                snapshot.add(wid)
                if frame is None:
                    frame = self._placer._frame_extents(wid)
                px, py, w, h = self._placer._gap_geometry(x, y, cell_w, cell_h, frame, col_gap, row_gap)
                self._placer._place_by_id(positioner, wid, px, py, w, h)
                placed.append((wid, px, py, w, h))
                ColorPrint.plain(f"  Window {i}: {emulator} -> id {wid:#010x} @ {px},{py}"
                      + (f" ({w}x{h}px)" if cell_w else "")
                      + f" (pid {proc.pid})")
            else:
                # Id capture timed out: fall back to (hardened, exact) title match.
                px, py, w, h = self._placer._gap_geometry(x, y, cell_w, cell_h, frame, col_gap, row_gap)
                ColorPrint.plain(f"  Window {i}: id capture timed out; title-matching "
                      f"{title}")
                if positioner == "wmctrl":
                    self._placer._place_by_title_wmctrl(title, px, py, w, h)
                else:
                    self._placer._place_by_title_xdotool(title, px, py, w, h)
            time.sleep(delay)

        # Re-assert pass: on XWayland the compositor can apply its own map-time
        # placement after our first move; move every captured window once more
        # now that all of them are fully mapped and decorated.
        if placed:
            time.sleep(0.5)
            for wid, px, py, w, h in placed:
                self._placer._place_by_id(positioner, wid, px, py, w, h)

        return pids

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
        cell_w, cell_h = self._placer._cell_pixel_size(configs)
        col_gap, row_gap = self._placer._grid_gaps(cell_w, cell_h)
        frame = None  # WM frame extents, measured once from the first window
        width = len(str(len(configs)))
        positioner = self._placer._find_positioner()
        ColorPrint.plain(f"X11 session: launching {len(configs)} positioned "
              f"'{emulator}' window(s)"
              + (f", snapped by id via {positioner} (gaps {col_gap}/{row_gap}px)" if positioner else "") + ".")
        pids = []
        snapshot = self._placer._list_window_ids()

        for i, (x, y, cols, rows) in enumerate(configs, 1):
            title = f"pylauncher-{i:0{width}d}"
            # X geometry: character cells + pixel offset, e.g. "80x24+100+200".
            geometry = f"{cols}x{rows}+{x}+{y}"
            argv = self._argv._build_x11_argv(emulator, title, geometry, self.command)
            if argv is None:
                continue
            try:
                proc = subprocess.Popen(argv, start_new_session=True)
                pids.append(proc.pid)
            except Exception as e:
                ColorPrint.plain(f"  Window {i}: failed to launch ({e})")
                continue
            wid = self._placer._resolve_new_window_id(snapshot) if positioner else None
            if wid is not None:
                snapshot.add(wid)
                if frame is None:
                    frame = self._placer._frame_extents(wid)
                px, py, w, h = self._placer._gap_geometry(x, y, cell_w, cell_h, frame, col_gap, row_gap)
                self._placer._place_by_id(positioner, wid, px, py, w, h)
                ColorPrint.plain(f"  Window {i}: {emulator} geometry={geometry} -> "
                      f"id {wid:#010x} @ {px},{py} (pid {proc.pid})")
            else:
                # No positioner / id capture failed: rely on the geometry hint.
                ColorPrint.plain(f"  Window {i}: {emulator} geometry={geometry} "
                      f"(pid {proc.pid}; geometry hint only)")
            time.sleep(delay)

        return pids

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
        columns = self._placer._grid_columns(configs)

        if shutil.which("kitty"):
            return self._launch_kitty(count)

        if shutil.which("tmux"):
            return self._launch_tmux(count, columns)

        ColorPrint.plain("Neither kitty nor tmux found; launching plain unpositioned "
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
            fd, path = tempfile.mkstemp(
                prefix="pylauncher-kitty-", suffix=".conf", dir=str(TMP_DIR)
            )
            with os.fdopen(fd, "w") as fh:
                fh.write(session_text)
        except Exception as e:
            ColorPrint.plain(f"  kitty: failed to write session file ({e})")
            return []

        try:
            proc = subprocess.Popen(
                ["kitty", "--session", path], start_new_session=True,
            )
            ColorPrint.plain(f"  kitty: single window, {count} panes (grid layout) "
                  f"(pid {proc.pid})")
            return [proc.pid]
        except Exception as e:
            ColorPrint.plain(f"  kitty: failed to launch ({e})")
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
            ColorPrint.plain(f"  tmux: failed to build session ({e})")
            return []

        # Open a terminal attached to the session. No geometry needed -- it is a
        # single window -- so use the broad list (qterminal is fine here).
        emulator = self._argv._find_fallback_emulator()
        attach = ["tmux", "attach", "-t", session]
        argv = self._argv._build_attach_argv(emulator, attach)

        try:
            proc = subprocess.Popen(argv, start_new_session=True)
            ColorPrint.plain(f"  tmux: single window, {count} tiled panes "
                  f"(~{columns} cols) via {emulator} (pid {proc.pid})")
            return [proc.pid]
        except Exception as e:
            ColorPrint.plain(f"  tmux: failed to open attaching terminal ({e})")
            return []

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
        emulator = self._argv._find_fallback_emulator()
        pids = []
        for i in range(1, count + 1):
            if self.command:
                argv = self._argv._build_attach_argv(
                    emulator, ["bash", "-lc", self.command],
                )
            else:
                argv = [emulator]
            try:
                proc = subprocess.Popen(argv, start_new_session=True)
                pids.append(proc.pid)
                ColorPrint.plain(f"  Plain terminal {i}: {emulator} (pid {proc.pid})")
            except Exception as e:
                ColorPrint.plain(f"  Plain terminal {i}: failed to launch ({e})")
            time.sleep(delay)
        return pids
