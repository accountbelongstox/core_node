# -*- coding: utf-8 -*-
"""
Linux Terminal Argv Builder
Terminal-emulator argv construction + emulator discovery.

This is the emulator-knowledge concern split out of ``linux_terminal_launcher``.
It knows nothing about window positioning or grid geometry -- only about how to
build, per emulator, the right argv to:

  * run a self-titling bash snippet (``build_titled_argv``), optionally with an
    X ``--geometry`` hint (used by the position-by-id X11 path),
  * open a positioned geometry-capable window with a title + geometry hint
    (``build_x11_argv``),
  * run an arbitrary attach command (e.g. ``tmux attach``) with no geometry
    (``build_attach_argv``, used by the single-window fallbacks),

and how to discover which emulator binary is on PATH (``find_x11_emulator`` /
``find_fallback_emulator`` / ``find_fallback_emulator_or_none``). The PATH-binary
discovery loop mirrors ``editor_launcher.EditorLauncher._launch_editor_linux``
(``shutil.which`` over an ordered candidate list) -- referenced, not merged.

Mirrors the precedent of ``linux_screen_manager.LinuxScreenManager``: a sibling
Linux concern, a standalone class, never raises. Unknown emulators yield
``None`` argv (the caller skips them) rather than raising.
"""

import shlex
import shutil


class LinuxTerminalArgv:
    """Build per-emulator terminal argvs and discover emulators on PATH.

    Stateless: the command to run is passed into ``_build_x11_argv`` at call
    time (the only method that needs it), preserving the launcher's live-read
    semantics -- a caller may reassign ``launcher.command`` after construction
    and the next launch picks it up. Mirrors the stateless precedent of
    ``LinuxWindowPlacer`` / ``LinuxScreenManager``.
    """

    # Geometry-capable X11 emulators, in preference order. Used only by the
    # separate-window X11 path. qterminal is absent (no geometry flag); gnome-terminal
    # is ALSO absent because it dropped --geometry in 3.36 (Ubuntu 20.04+, Debian 12,
    # Kali-with-GNOME) -- keeping it here would silently no-op the geometry path.
    # gnome-terminal still works via FALLBACK_EMULATORS + the wmctrl/xdotool positioner.
    X11_EMULATORS = ("xfce4-terminal", "konsole", "xterm")

    # Broad emulator list for the fallback paths (tmux-attach window and the
    # unpositioned last resort), where no geometry is needed -- so qterminal is
    # included. First found on PATH wins; xterm is the universal last resort.
    FALLBACK_EMULATORS = ("xfce4-terminal", "gnome-terminal", "konsole",
                          "qterminal", "xterm")

    # ------------------------------------------------------------------ #
    # Argv construction (per emulator)
    # ------------------------------------------------------------------ #

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

    def _build_x11_argv(self, emulator, title, geometry, command=None):
        """
        Build the argv for one positioned X11 terminal window.

        Args:
            emulator: Emulator name (already known to be on PATH).
            title: Unique window title (used later by wmctrl).
            geometry: X geometry string "<cols>x<rows>+<x>+<y>".
            command: Command string to run inside the terminal (read live from
                the launcher, so a post-construction reassignment takes effect).
                When None the terminal opens the user's login shell.

        Returns:
            list: argv for subprocess.Popen, or None if unsupported.
        """
        cmd = command

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

    # ------------------------------------------------------------------ #
    # Emulator discovery (PATH-binary loop; mirrors editor_launcher pattern)
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
