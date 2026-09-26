# Linux Terminal Control — X11, XWayland, GNOME Bridge, Portal Requirements

Date: 2026-09-27
Status: binding requirement list (design and implementation record appended
below as work proceeds)
Scope: `pycore` (terminal control backends, shared Linux desktop primitives,
clipboard, launcher window placement, RPC), `poly_apps/pycore_laravel_wordnew_ui`
(pycore-manager Terminal Control page, API, i18n), `config/pycore_relay_contract.json`,
Linux installers, and `docs_fix`.
Supersedes: the Linux sections of `FIX_20260814_2155.md` (X11-only, `wmctrl`/`xdotool`).

## 1. Measured facts (Debian 13 host, 2026-09-26)

- Debian 13, GNOME Shell 48.7, session `wayland`, Xwayland `:0` rootless without
  `-enable-ei-portal`. `gnome-session-xsession` is installed, so "GNOME on Xorg"
  is selectable at the GDM login screen.
- pycore runs as the desktop user with `DISPLAY`, `WAYLAND_DISPLAY`, `XAUTHORITY`,
  `DBUS_SESSION_BUS_ADDRESS` set.
- `ui/terminal/windows` returns `supported=false`,
  `error_code=wayland_global_control_unavailable`: the Linux backend refuses every
  Wayland session.
- The launcher's terminals (`xfce4-terminal`) run on Xwayland. `wmctrl -l` lists them.
  XTEST input (`xdotool`) reaches them.
- `mss` grabs are all black on Wayland (Xwayland root has no content). A per-window
  `XGetImage` on the X11 client window returns the real terminal content.
- `org.gnome.Shell.Introspect.GetWindows` and `org.gnome.Shell.Screenshot.*` return
  `AccessDenied` for normal callers.
- Linux paste used a right click (`xdotool click 3`). That opens the context menu in
  xfce4-terminal / gnome-terminal. It does not paste. This is a bug.
- The Linux clipboard used pyperclip → Qt. PRIMARY is never set, and `xclip`, `xsel`
  and `wl-clipboard` are not installed.
- The same code is duplicated in several places:
  - display/session detection in 7 modules;
  - X11 window listing, placement and frame extents (`wmctrl`/`xdotool`/`xprop`
    subprocesses) in both `launcher/linux_window_placer.py` and
    `window/linux_terminal_backend.py`;
  - operation flow in the Windows and Linux terminal backends;
  - `None`-backend checks on every method of `terminal_service`.
- A layering violation: `pyctl/terminal/terminal_screenshot_cache.py` imports
  `callmodule.rpc_routes.route_names`.

## 2. Target platforms

- P1 Debian 13 (GNOME 48): Wayland session (default) and GNOME on Xorg session.
- P2 Ubuntu 26.04 (GNOME 50): Wayland only (no Xorg GNOME session). The default
  terminal (Ptyxis) is a native Wayland client. Xwayland still runs X11 clients on
  demand.
- P3 Any other X11 desktop (Kali/XFCE etc.) keeps working through the X11 path.
- Windows behaviour must be unchanged.

## 3. Requirements

- R1 Control paths, all implemented as complete libraries and selected
  automatically per window:
  - `x11`: X11 windows on an Xorg session.
  - `xwayland`: X11 windows running on Xwayland inside a Wayland session.
  - `gnome_bridge`: a pycore GNOME Shell extension that exposes window
    list/activate/input/capture over session D-Bus. It covers native Wayland
    windows on GNOME 45–50.
  - `gnome_introspect`: `org.gnome.Shell.Introspect.GetWindows` listing when GNOME
    permits it. It is list-only.
  - `portal`: `org.freedesktop.portal.RemoteDesktop` + `ScreenCast` input, and the
    `Screenshot` portal capture, as the compositor-neutral Wayland fallback. The
    consent restore token is persisted.
- R2 One shared library per concern, with no duplicate class or constant:
  - desktop session/distro detection (`pyfoundations`);
  - X11 window + XTEST + capture (`pyutils/common`, python-xlib);
  - session D-Bus access (`pyutils/common`, jeepney);
  - GNOME Shell bridge + introspect client (`pyutils/common`);
  - XDG portal client (`pyutils/common`).
  The launcher placer and the terminal backend both use the same X11 library.
- R3 The terminal backends share one base class. It holds the operation flow
  (activate, click, history, enter, scroll, paste+submit, capture). Platforms only
  supply primitives. An unsupported platform uses a null backend instead of `None`
  checks.
- R4 Linux paste sets both CLIPBOARD and PRIMARY, then sends `Shift+Insert`. It
  never uses a right click. The Linux clipboard uses `xclip`/`xsel` (X11/Xwayland)
  or `wl-copy`/`wl-paste` (pure Wayland) before pyperclip.
- R5 Screenshots come from the backend:
  - Windows: screen region.
  - X11/Xwayland: per-window `XGetImage`.
  - GNOME bridge: window actor capture.
  - Portal: screenshot crop.
  The cache no longer imports `callmodule`.
- R6 Snapshot reports:
  - `platform_profile` (distro/version/desktop/session);
  - `control_modes`;
  - `capabilities` (per path: available + reason code);
  - per-window `control` / `controllable`;
  - `notice_code` for actionable guidance (bridge not installed / re-login
    required / Xorg session suggested).
  Every code is translated in the UI (en/zh).
- R7 A GNOME bridge management RPC `ui/terminal/desktop_integration`
  (status / install / enable / disable), with a UI panel. Installing copies the
  extension to the user's extension dir and enables it. A Wayland session reports
  `relogin_required` until the shell loads it.
- R8 Installers add the missing system tools: `xclip`, `wl-clipboard`, `x11-utils`.
  Python dependencies (`python-xlib`, `jeepney`) are registered in the central
  package policy. Ubuntu 26.04 uses the same apt path.
- R9 All display-detection duplicates delegate to the shared desktop session module.
- R10 Functional test on this host:
  - Wayland + Xwayland path: list, activate, input, history, scroll, capture.
  - GNOME bridge in a headless nested GNOME Shell.
  - Portal session negotiation.
  - The RPC end-to-end through pycore.

## 4. Acceptance

- A1 `ui/terminal/windows` on this Debian 13 Wayland host returns `supported=true`
  and lists the Xwayland terminals with `control=xwayland` and live screenshots.
- A2 Input sent from the UI reaches the target terminal. The clipboard is restored.
- A3 With the bridge loaded, native Wayland terminals (gnome-terminal/Ptyxis) are
  listed and controllable with `control=gnome_bridge`.
- A4 No module outside `pyfoundations/desktop_session.py` reads
  `XDG_SESSION_TYPE`/`WAYLAND_DISPLAY` for session detection. No module outside
  `pyutils/common/x11_display.py` shells out to `wmctrl`/`xdotool`/`xprop`.
