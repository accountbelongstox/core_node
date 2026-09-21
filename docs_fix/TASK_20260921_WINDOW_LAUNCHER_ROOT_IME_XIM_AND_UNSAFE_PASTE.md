# TASK 2026-09-21 Window Launcher root terminal: fcitx5 wubi input + unsafe-paste dialog fix

## Task scope (user, 2026-09-21)

1. The "Window Launcher" desktop icon (installed by
   `scripts/shells/linux/debian/install_shells/193_install_window_launcher_shortcut.sh`)
   opens a terminal in which fcitx5 wubi cannot type Chinese. Fix it, consult
   official docs, fix through the install script (no direct system-file edits),
   and re-run the script.
2. The same terminal pops "Warning: Potentially Unsafe Paste" on every paste;
   disable the dialog so paste is direct.
3. Follow-up report: "still no wubi-input" after the first (env-restore only)
   attempt.

## Field scan log (2026-09-21)

- Session: GNOME on **Wayland**, user `debian` (uid 1000); fcitx5 running as
  `debian`; helper `/usr/local/bin/devlauncher` already contained the IM-env
  restore logic (installed 14:11).
- `/etc/environment` carries the managed block from 173
  (`GTK_IM_MODULE=fcitx`, `QT_IM_MODULE=fcitx`, `XMODIFIERS=@im=fcitx`,
  `SDL_IM_MODULE=fcitx`, `CLUTTER_IM_MODULE=xim`).
- Clicking the icon elevates through **pkexec**, so the menu terminal (and the
  whole terminal grid) runs as **root**.
- As root, `DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/1000/bus dbus-send
  --session ... org.freedesktop.DBus.ListNames` FAILS: the session bus rejects
  non-owner uids at D-Bus auth (EXTERNAL). The socket connects at the
  transport level; the daemon refuses the reply.
- `/root/.config/xfce4/terminal/terminalrc` did NOT exist; the user's file
  `/home/debian/.config/xfce4/terminal/terminalrc` already had
  `MiscShowUnsafePasteDialog=FALSE`.
- `xprop -root XIM_SERVERS` on Xwayland (`:0`) shows
  `@server=ibus, @server=fcitx` — fcitx5's XIM server is live.
- GTK3 ships `im-xim.so`; Qt5/Qt6 `platforminputcontexts/` has only
  compose/fcitx5/ibus plugins (no xim plugin to point QT_IM_MODULE at).

## Root-cause chain

1. **No wubi**: pkexec re-spawns the terminal as root. The restored
   `GTK_IM_MODULE=fcitx` / `QT_IM_MODULE=fcitx` modules talk to fcitx5 over
   the user session bus, which rejects uid 0 -> the modules stay silent and no
   IME attaches. XIM instead travels over the X connection itself
   (uid-independent; root reaches Xwayland with the re-injected XAUTHORITY),
   which is why XIM is the only IM path that survives pkexec elevation.
2. **Unsafe-paste dialog**: a root xfce4-terminal reads root's terminalrc, not
   the real user's; the script only wrote the real user's file, so the
   elevated window kept the stock default (`MiscShowUnsafePasteDialog=TRUE`).

## Official-doc references

- ArchWiki Fcitx5 (https://wiki.archlinux.org/title/Fcitx5): XIM for generic
  X11/Xwayland applications is enabled via `XMODIFIERS=@im=fcitx`;
  `GTK_IM_MODULE=xim` exists for cases where the fcitx module cannot be used.
- Qt xcb platform: when `QT_IM_MODULE` is unset, the xcb plugin falls back to
  XIM (there is no xim platforminputcontext plugin to name).
- xfce4-terminal `terminalrc` key `MiscShowUnsafePasteDialog` (default TRUE),
  terminal-preferences.c `PROP_MISC_SHOW_UNSAFE_PASTE_DIALOG`.

## Fix (all inside 193_install_window_launcher_shortcut.sh; script re-run)

1. Helper body (`/usr/local/bin/devlauncher` regenerated): the pkexec env list
   now swaps the dbus-based IM modules for XIM on the elevated side only —
   `GTK_IM_MODULE=xim` is injected and `QT_IM_MODULE` is dropped (xcb XIM
   fallback). `XMODIFIERS=@im=fcitx` and the display variables
   (DISPLAY/WAYLAND_DISPLAY/XDG_RUNTIME_DIR/XAUTHORITY) are re-injected as
   before; the unelevated path is untouched and keeps the dbus modules.
2. `configure_terminal_mouse_functions` refactored: a shared
   `write_terminalrc_for_home` writes copy-on-select + right-click-paste +
   `MiscShowUnsafePasteDialog=FALSE` for BOTH the real user and `/root`,
   because the pkexec menu terminal only reads root's config.

## Verification (2026-09-21)

- `bash -n` syntax OK; installer re-run wrote both terminalrc files and
  regenerated `/usr/local/bin/devlauncher` (grep confirms the
  `GTK_IM_MODULE=xim` / `QT_IM_MODULE) continue` logic at lines 99-102).
- As root with the re-injected env: `xdpyinfo` connects to the X server,
  `XIM_SERVERS` lists `@server=fcitx`, and
  `GTK_IM_MODULE=xim XMODIFIERS=@im=fcitx xterm` launches cleanly.
- Operator action required: close previously opened launcher terminals (they
  carry the old environment) and re-click the "Window Launcher" icon; toggle
  the IME with Ctrl+Space.
