# -*- coding: utf-8 -*-
"""
Antigravity extractor (~/.gemini/antigravity).

NOTE: raw conversation blobs (``conversations/*.pb``) are ENCRYPTED on disk,
so prompts cannot be recovered from them. Only the plaintext agent-work
artifacts under ``brain/<conversation-uuid>/*.md`` (task.md,
implementation_plan.md, ...) are extracted: each conversation-uuid dir becomes
one session and every markdown artifact is stored as a "user" fragment (the
closest available to a prompt). ``*.metadata.json`` and ``*.resolved``
variants are skipped.
"""

from __future__ import annotations

import os
from glob import glob
from typing import Any, Dict, List, Optional

from .base_extractor import BaseExtractor, MAX_TURNS


class AntigravityExtractor(BaseExtractor):
    def tool(self) -> str:
        return "antigravity"

    def _artifacts(self, cdir: str) -> List[str]:
        files: List[str] = []
        for f in sorted(glob(os.path.join(cdir, "*.md"))):
            name = os.path.basename(f)
            if ".resolved" in name or name.endswith(".metadata.json"):
                continue
            files.append(f)
        return files

    def discover(self, home: str, user: str) -> List[Dict[str, Any]]:
        brain = os.path.join(home, ".gemini", "antigravity", "brain")
        if not os.path.isdir(brain):
            return []
        out: List[Dict[str, Any]] = []
        for cdir in glob(os.path.join(brain, "*")):
            if not os.path.isdir(cdir):
                continue
            desc = self._dir_descriptor(cdir)
            if desc:
                out.append(desc)
        return out

    def _dir_descriptor(self, cdir: str) -> Optional[Dict[str, Any]]:
        files = self._artifacts(cdir)
        if not files:
            return None
        mtime = 0
        nbytes = 0
        for f in files:
            try:
                st = os.stat(f)
            except OSError:
                continue
            mtime = max(mtime, int(st.st_mtime))
            nbytes += int(st.st_size)
        return {"path": cdir, "mtime": mtime, "bytes": nbytes}

    def parse_source(self, path: str, user: str) -> List[Dict[str, Any]]:
        if not os.path.isdir(path):
            return []
        files = self._artifacts(path)
        if not files:
            return []
        conv_id = os.path.basename(path)

        turns: List[Dict[str, Any]] = []
        prompts: List[Dict[str, Any]] = []
        first_ts = 0
        last_ts = 0
        for f in files:
            try:
                mtime = int(os.stat(f).st_mtime)
                with open(f, "r", encoding="utf-8", errors="replace") as fh:
                    text = fh.read().strip()
            except OSError:
                continue
            if not text:
                continue
            if mtime > 0:
                last_ts = mtime
                if first_ts == 0:
                    first_ts = mtime
            name = os.path.basename(f)
            prompts.append({"ts": mtime, "text": self.truncate(text)})
            turns.append(self.turn(mtime, "user", text, False, None, name))
            if len(turns) > MAX_TURNS:
                break

        if not turns:
            return []
        return [self.session("antigravity", user, conv_id, {
            "project": "",
            "title": self._title(files, conv_id),
            "firstTs": first_ts,
            "lastTs": last_ts,
            "source": path,
            "prompts": prompts,
            "turns": turns,
        })]

    @staticmethod
    def _title(files: List[str], fallback: str) -> str:
        for f in files:
            if os.path.basename(f) != "task.md":
                continue
            try:
                with open(f, "r", encoding="utf-8", errors="replace") as fh:
                    for line in fh:
                        line = line.strip()
                        if line.startswith("#"):
                            return line.lstrip("#").strip() or fallback
                        if line:
                            break
            except OSError:
                pass
        return fallback
