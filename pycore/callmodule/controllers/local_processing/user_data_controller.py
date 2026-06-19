# -*- coding: utf-8 -*-
"""User Data Controller - bridges HTTP requests to the unified user-data store.

Thin layer over pycore.get_user_data_store(): persists system settings and the
Video Extraction history/state, and broadcasts settings changes live to the UI.
"""

import os
import sys
import time
import subprocess
from pathlib import Path

from pycore import get_user_data_store, THREAD_BUS, ColorPrint
from pycore.pyutils.native_ui.step0_i18n import i18n
from ...models.local_processing.user_data_models import (
    SystemSettingsResponse,
    VideoExtractHistoryEntry,
    VideoExtractHistoryResponse,
    ContentHistoryEntry,
    ContentHistoryResponse,
    OkResponse,
    PickPathResponse,
)

# Standalone script run in a short-lived child process to show a native folder/file
# dialog. A subprocess (its own main thread) avoids any conflict with the Qt/PySide6
# UI thread; tkinter ships with CPython so no extra dependency is needed.
_PICK_DIALOG_SCRIPT = r"""
import sys
try:
    import tkinter as tk
    from tkinter import filedialog
    mode = sys.argv[1] if len(sys.argv) > 1 else 'folder'
    initial = sys.argv[2] if len(sys.argv) > 2 else ''
    root = tk.Tk()
    root.withdraw()
    try:
        root.attributes('-topmost', True)
    except Exception:
        pass
    if mode == 'file':
        path = filedialog.askopenfilename(
            initialdir=initial or None, title='Select a video file',
            filetypes=[('Video files',
                        '*.mp4 *.mkv *.mov *.avi *.wmv *.flv *.webm *.m4v *.mpg *.mpeg *.ts *.m2ts *.3gp'),
                       ('All files', '*.*')])
    else:
        path = filedialog.askdirectory(initialdir=initial or None, title='Select a folder', mustexist=True)
    try:
        root.destroy()
    except Exception:
        pass
    sys.stdout.write(path or '')
except Exception as exc:
    sys.stderr.write(str(exc))
    sys.exit(2)
"""

SYSTEM_SETTINGS_SECTION = "system_settings"
VIDEO_EXTRACT_SECTION = "video_extract"


def _default_base_dir() -> str:
    """Default working directory for video-extract sources."""
    if os.name == "nt":
        return r"D:\.tmp"
    return str(Path.home() / ".tmp")


def _norm(path: str) -> str:
    """Normalize a path for dedupe comparison."""
    return os.path.normcase(os.path.abspath((path or "").strip()))


class UserDataController:
    def __init__(self):
        self.store = get_user_data_store()

    # ----- seeding --------------------------------------------------------- #
    def _ensure_seed(self) -> dict:
        """Seed sane defaults into the video_extract section if it is empty."""
        section = self.store.get_section(VIDEO_EXTRACT_SECTION)
        if not section:
            base_dir = _default_base_dir()
            section = {
                "base_dir": base_dir,
                "entries": [{"path": base_dir, "mode": "folder", "added_at": time.time()}],
                "last_options": {},
            }
            self.store.set_section(VIDEO_EXTRACT_SECTION, section)
            ColorPrint.blue(f"[UserData] Seeded video_extract defaults (base_dir={base_dir})")
        return section

    # ----- system settings ------------------------------------------------- #
    def get_system_settings(self) -> SystemSettingsResponse:
        settings = self.store.get_section(SYSTEM_SETTINGS_SECTION)
        return SystemSettingsResponse(success=True, settings=settings or None)

    def set_system_settings(self, settings: dict) -> SystemSettingsResponse:
        self.store.set_section(SYSTEM_SETTINGS_SECTION, settings)
        saved = self.store.get_section(SYSTEM_SETTINGS_SECTION)
        # Broadcast live to any connected UI.
        try:
            THREAD_BUS.trigger_event("system_settings_update", {"settings": saved})
        except Exception as exc:
            ColorPrint.yellow(f"[UserData] settings broadcast failed: {exc}")
        # Keep the Python-side i18n (tray menu, native windows) in the same
        # language as the web UI: applying is idempotent, set_language() no-ops
        # when unchanged and broadcasts ui.i18n.language_changed when it changes.
        lang = (saved or {}).get("lang")
        if lang:
            try:
                i18n.set_language(lang)
            except Exception as exc:
                ColorPrint.yellow(f"[UserData] i18n language sync failed: {exc}")
        return SystemSettingsResponse(success=True, settings=saved)

    # ----- video-extract state -------------------------------------------- #
    def get_video_extract(self) -> VideoExtractHistoryResponse:
        section = self._ensure_seed()
        return VideoExtractHistoryResponse(
            success=True,
            base_dir=section.get("base_dir", ""),
            entries=[VideoExtractHistoryEntry(**e) for e in section.get("entries", [])],
            last_options=section.get("last_options", {}),
        )

    def add_video_extract(self, path: str, mode: str) -> VideoExtractHistoryResponse:
        section = self._ensure_seed()
        entries = list(section.get("entries", []))
        target = _norm(path)
        # Dedupe by normalized path: drop any existing match, then append (stack).
        entries = [e for e in entries if _norm(e.get("path", "")) != target]
        entries.append({"path": path, "mode": mode, "added_at": time.time()})
        section["entries"] = entries
        self.store.set_section(VIDEO_EXTRACT_SECTION, section)
        return VideoExtractHistoryResponse(
            success=True,
            base_dir=section.get("base_dir", ""),
            entries=[VideoExtractHistoryEntry(**e) for e in entries],
            last_options=section.get("last_options", {}),
        )

    def remove_video_extract(self, path: str) -> VideoExtractHistoryResponse:
        section = self._ensure_seed()
        target = _norm(path)
        entries = [e for e in section.get("entries", []) if _norm(e.get("path", "")) != target]
        section["entries"] = entries
        self.store.set_section(VIDEO_EXTRACT_SECTION, section)
        return VideoExtractHistoryResponse(
            success=True,
            base_dir=section.get("base_dir", ""),
            entries=[VideoExtractHistoryEntry(**e) for e in entries],
            last_options=section.get("last_options", {}),
        )

    def set_options(self, options: dict) -> OkResponse:
        self._ensure_seed()
        self.store.set(VIDEO_EXTRACT_SECTION, "last_options", options)
        return OkResponse(success=True)

    # ----- content-ingest history (books / subtitles / documents) --------- #
    def get_content_history(self, limit: int = 200) -> ContentHistoryResponse:
        """Return the cross-feature content-ingest history (newest first)."""
        rows = self.store.get_content_history(limit=limit)
        return ContentHistoryResponse(
            success=True,
            entries=[ContentHistoryEntry(**r) for r in rows],
        )

    def record_content(self, entry: dict) -> OkResponse:
        """Append one content-ingest history entry to the capped ring."""
        try:
            self.store.record_content_history(entry)
            return OkResponse(success=True)
        except Exception as exc:  # best-effort; history never blocks a sync
            ColorPrint.yellow(f"[UserData] record_content failed: {exc}")
            return OkResponse(success=False, error=str(exc))

    # ----- native folder/file picker -------------------------------------- #
    def pick_path(self, mode: str = "folder", initial: str = None) -> PickPathResponse:
        """
        Open a native OS folder/file dialog and return the chosen absolute path.

        Runs in a short-lived subprocess (avoids the Qt UI-thread restriction) so
        webview-hosted UIs - where the browser cannot read a real filesystem path -
        can still pick sources reliably. Returns canceled=True when dismissed, and
        success=False with an error on headless/no-display environments (the UI then
        falls back to manual path entry).
        """
        mode = "file" if (mode or "").lower() == "file" else "folder"
        initial = initial if (initial and os.path.isdir(initial)) else (
            initial and os.path.dirname(initial)) or ""
        env = dict(os.environ)
        env["PYTHONIOENCODING"] = "utf-8"
        env["PYTHONUTF8"] = "1"
        try:
            proc = subprocess.run(
                [sys.executable, "-c", _PICK_DIALOG_SCRIPT, mode, initial],
                capture_output=True, text=True, encoding="utf-8", errors="replace",
                env=env, timeout=300,
            )
        except subprocess.TimeoutExpired:
            return PickPathResponse(success=False, canceled=True, error="picker timed out")
        except Exception as exc:
            return PickPathResponse(success=False, error=f"picker failed: {exc}")
        if proc.returncode != 0:
            return PickPathResponse(
                success=False,
                error=(proc.stderr or "no display / tkinter unavailable").strip())
        path = (proc.stdout or "").strip()
        if not path:
            return PickPathResponse(success=True, path=None, canceled=True)
        return PickPathResponse(success=True, path=path, canceled=False)
