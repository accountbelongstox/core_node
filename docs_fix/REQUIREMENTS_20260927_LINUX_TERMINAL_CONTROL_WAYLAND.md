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

## 5. Design (implemented)

### 5.1 Shared libraries (one per concern)

| Concern | Module | Notes |
|---|---|---|
| Session / distro detection | `pycore/pyfoundations/desktop_session.py` | `current_desktop_session()`, `ensure_session_environment()`, `has_graphical_display()`, `is_headless_linux()`, `LINUX_DISTRO`; profiles `debian 13`, `ubuntu 26`. `system_info`, `third_party/_deps`, `callmodule_config`, `toast_stack`, `system_notification`, `platform_adapter`, `appindicator_thread` and the launcher delegate to it. |
| argv runner with stdin | `Commander.run_args()` / `run_args()` in `pybasecommon/commander.py` | No shell, real stdin, `detach_output` for forking selection owners. `exec_silent` silently ignored `input=` and joined args unquoted. |
| X11 / Xwayland | `pycore/pyutils/common/x11_display.py` (python-xlib) | EWMH client list, `_NET_ACTIVE_WINDOW` activation (verified), `_NET_MOVERESIZE_WINDOW`, frame extents, XTEST click/wheel/keys, per-window `XGetImage` capture. Normalizes mutter Xwayland cookies (empty display number) into `$XDG_RUNTIME_DIR/pycore-xauthority-*` for python-xlib. |
| Session D-Bus | `pycore/pyutils/common/session_dbus.py` (jeepney) | `call_session_method`, `name_has_owner`, `add_match`; errors returned as `DBusReply`, never raised. |
| GNOME bridge + introspect | `pycore/pyutils/common/gnome_shell_dbus.py` | `gnome_shell_bridge` (status/install/enable/disable/list/activate/click/wheel/keys/capture) and `gnome_shell_introspect`. |
| GNOME Shell extension | `pycore/static/gnome_shell_extensions/pycore-window-bridge@core-node/` | GNOME 45–50 ESM. D-Bus `org.corenode.PycoreWindowBridge`: `ListWindows`, `Activate` (`Main.activateWindow`), `PointerClick`/`Scroll`/`KeyCombo` (Clutter virtual devices, keyboard warm-up on first use), `CaptureWindow` (actor `paint_to_content` → PNG). |
| XDG portal | `pycore/pyutils/common/xdg_desktop_portal.py` | RemoteDesktop+ScreenCast session (keyboard keysym, absolute pointer per stream, discrete axis), restore token persisted at `APP_DATA_DIR/desktop_portal/remote_desktop_restore_token`, non-interactive Screenshot portal crop (file removed after read). Serialized owner thread keeps the session connection. |
| Clipboard | `pycore/pyutils/common/clipboard_text.py` | Single primitive: Win32 → xclip → xsel → wl-copy → pyperclip → PowerShell; Linux can also own PRIMARY. `clipboard_manager` and `clipboard_monitor` delegate; duplicate backends removed. |

### 5.2 Terminal backends

- `pyutils/window/terminal_backend.py`: `TerminalWindowBackend` owns the operation flow. That is snapshot, activate/click through raise → click → release, history, Enter, scroll (bottom keys or wheel), paste+submit and capture. Platforms implement only `_list_windows`, `_inventory_meta`, `_raise_window`, `_release_window`, `_click`, `_keys`, `_wheel`, `_scroll_bottom_keys`, `_paste` and `_capture`. The key vocabulary is X keysym names. `UnsupportedTerminalBackend` replaces every `None` check.
- `pyutils/window/terminal_platform.py`: the single platform selector (`terminal_backend`). It is used by `terminal_service` and by the screenshot cache.
- `windows_terminal_backend.py`: the same Win32 behaviour (topmost dance, right-click paste, WT Ctrl+Shift+End) on the base class.
- `linux_terminal_backend.py`: a composite backend.
  - Window ids:
    - `x11:0x…` for X11 and Xwayland windows. `control` is `x11` or `xwayland`.
    - `gnome:<meta id>` for native Wayland windows seen through the bridge. `control` is `gnome_bridge`. Bridge windows that also have an X11 id are dropped, so the X11 path wins.
    - `introspect:<id>` for windows listed only through GNOME introspect. `control` is `none` (view only).
  - Input and capture fall back to the portal on Wayland when the native path fails.
  - Paste sets CLIPBOARD and PRIMARY, then sends `Shift+Insert`.
  - `desktop_integration(action)` accepts `status`, `install_bridge`, `enable_bridge`, `disable_bridge`, `authorize_portal` and `revoke_portal`.
- Snapshot adds `notice_code`, `platform_profile`, `control_modes`, `capabilities.{x11,gnome_bridge,gnome_introspect,portal}`, and per-window `control`/`controllable`.
- `pyctl/terminal/terminal_screenshot_cache.py` captures through `terminal_backend.capture_windows()` and encodes with `screen_capture.encode_capture_png()`. The `callmodule` import (layer violation) and the unused `resource.route` field are removed.
- Launcher: `linux_window_placer` and `launch_guard` use `x11_display` instead of `wmctrl`/`xdotool`/`xprop` subprocesses. The positioner is `x11`.

### 5.3 RPC, relay, UI, installers

- Route `ui/terminal/desktop_integration` (POST `{action}`). It has a relay profile `terminal_integration` (150 s timeout, which covers the portal consent dialog).
- UI:
  - `PcTerminalDesktopIntegration` shows the profile, control paths, the four capabilities, and install/enable/disable bridge and authorize/revoke portal actions.
  - The page shows `notice_code` banners and a per-window control badge.
  - View-only windows disable actions.
  - The seven duplicated `disabled` conditions are collapsed into `selectedActionable`.
  - en/zh i18n: obsolete wmctrl/xdotool/Wayland/right-click messages are removed and all new codes added.
- `119_install_launcher.sh` installs `xclip` and `wl-clipboard` (Debian 13 / Ubuntu 26.04 / Kali). `python-xlib` and `jeepney` are registered in `python_package_policy.DEPENDENCY_MAP` with getters.

### 5.4 Root-cause fix found during testing

`TerminalStateRepository.reconcile_windows` renumbered terminals on every snapshot:
1. A new window with no record, sorted before existing windows, received through `_next_slot_number` the record number of a live window processed later in the same pass.
2. That window then stole the next number, and so on for every following window.

Fix: numbers owned by any live window are reserved before new slots are handed out.

## 6. Verification record (2026-09-27, Debian 13 host)

- Xwayland (real GNOME 48 Wayland session, own probe terminal):
  - snapshot 0.02–0.05 s, `supported=true`, `control=xwayland`, 13 terminals listed;
  - activate, paste+submit (UTF-8), history, Enter, page/bottom scroll, click and per-window capture all pass;
  - through RPC: `ui/terminal/input` (clipboard restored), `scroll` (with screenshot), `click`, and screenshot resource HTTP 200;
  - Screenshot portal (non-interactive) crop matches the X11 geometry.
- GNOME bridge (headless nested GNOME Shell 48 with isolated D-Bus/dconf):
  - install → `relogin_required` → shell restart → `active`;
  - disabled → `enable_bridge` → `active` without restart;
  - native Wayland xfce4-terminal: list, activate, wl-clipboard paste, history, Enter, scroll and capture all pass;
  - Introspect correctly reports `gnome_introspect_denied`.
- Portal: CreateSession → SelectDevices → SelectSources → Start reaches the consent dialog. Completing it needs a user click on the desktop (UI "Authorize portal input"). Without authorization, input returns `portal_authorization_required`.
- Real session: the bridge was installed through RPC and appended to the existing `enabled-extensions`. It becomes active after the next login.
- Ubuntu 26.04.1 LTS container (GNOME Shell 50.1 headless, Python 3.14.4, logind stub):
  - profile `ubuntu 26.04 resolute`, `supported_profile=true`, control modes `gnome_bridge` + `xwayland`;
  - bridge `not_installed` → install → `relogin_required` → restart → `active`;
  - upgrade path v1 → v2 reports `gnome_bridge_outdated`, then reinstall → `relogin_required` → `active`;
  - Ptyxis (native Wayland) is listed as `gnome_bridge` with activate, keys, history, scroll and capture;
  - xterm (Xwayland) via XTEST: activate, xclip paste+submit, history, scroll and capture all pass.
  - Ptyxis cannot spawn its shell inside the container ("Failed"), so text arrival was verified on the GNOME 48 native Wayland terminal instead.
- Fixes from this round:
  - Bridge v2: `Activate` is now async and waits up to 500 ms for focus; the backend retries activation once.
  - `x11_display` falls back to the newest session cookie when the inherited `XAUTHORITY` is stale (after a re-login).
- Test-environment incident (corrected): the first nested-shell run wrote `enabled-extensions` into the user's real dconf database, because the D-Bus-activated dconf-service ignores the client's `XDG_CONFIG_HOME`. The original list was restored (tailscale-gnome-qs, kimpanel, ubuntu-appindicators) before any logout. Nested shells must export `XDG_CONFIG_HOME` before `dbus-run-session`.
- Real Debian 13 session after this work: bridge v2 installed and appended to `enabled-extensions`, state `gnome_bridge_relogin_required`. XDG portal input is not yet authorized; it needs the UI "Authorize portal input" action plus a click on the desktop dialog.
