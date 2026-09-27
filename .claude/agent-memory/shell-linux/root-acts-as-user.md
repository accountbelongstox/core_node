---
name: root-acts-as-user
description: Root code that writes, moves or replays manifests inside other users' homes must run as that user; how to sandbox root multi-user runs in WSL
metadata:
  type: feedback
---

Root must never mv/cp/tee/chown paths inside another user's home: a planted symlink (a category dir pointing at /etc/xdg/autostart, a launcher linked to /etc/passwd) or a user-written manifest turns it into root file writes. `chown user:user <path>` follows symlinks too.

**Why:** found in the desktop organizer and `_dsm_write_desktop_icon` (shell-linux-2, 2026-09-27); fixed with `_dsm_as_user` (runuser as root, sudo -u otherwise) and `_dsm_org_run_as_user` (the library fed on stdin to `runuser -u <user> -- bash -s`, since the repo may be unreadable to the user; end the generated call with `</dev/null`).

**How to apply:**
- Any new per-user step in desktop_shortcut_manager.sh goes through those helpers.
- Sandbox a root multi-user run in WSL: `unshare -m --propagation private`, then bind-mount a fake /etc/passwd whose homes sit in a mktemp dir.
- chmod 755 that mktemp dir: the default 0700 blocks the user's child, and the child skips silently.
