# -*- coding: utf-8 -*-
"""
Edge-TTS recovery probe.

When edge-tts enters cooldown (recent synthesis failure), other engines keep
producing audio on their own threads. In PARALLEL, one daemon probe thread
re-tests edge with a minimal synthesis every few seconds; the first success
clears the cooldown immediately so the next synthesis request resumes the edge
priority instead of waiting out the full cooldown window.
"""

import tempfile
import threading
import time
from pathlib import Path

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.pygvar import TMP_DIR
from pycore.pyutils.tts.edge.client import edge_tts_client
from pycore.pyutils.tts.edge.config import TTSConfig
from pycore.pyutils.tts.engine_policy import (
    clear_edge_cooldown,
    edge_in_cooldown,
    tts_locale,
)

_PROBE_INTERVAL_SECONDS = 15.0
_PROBE_LOCK = threading.Lock()
_PROBE_RUNNING = False


def _probe_edge_once() -> bool:
    """One minimal edge synthesis; True when edge produced audio again."""
    voice = TTSConfig.resolve_voice(tts_locale("en"), "us", "female")
    if not voice:
        return False
    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(
            suffix=".mp3", delete=False, dir=str(TMP_DIR)
        ) as tmp:
            tmp_path = Path(tmp.name)
        ok = edge_tts_client.synthesize("ping", voice, tmp_path)
        return bool(ok and tmp_path.exists() and tmp_path.stat().st_size > 0)
    except Exception:  # noqa: BLE001 - a failed probe just keeps the cooldown
        return False
    finally:
        if tmp_path is not None:
            try:
                tmp_path.unlink()
            except OSError:
                pass


def _probe_loop() -> None:
    global _PROBE_RUNNING
    try:
        while edge_in_cooldown():
            time.sleep(_PROBE_INTERVAL_SECONDS)
            if not edge_in_cooldown():
                break
            if _probe_edge_once():
                clear_edge_cooldown()
                ColorPrint.green(
                    "[tts] edge-tts recovered (probe); resuming edge priority"
                )
                break
    finally:
        with _PROBE_LOCK:
            _PROBE_RUNNING = False


def start_edge_recovery_probe() -> None:
    """Start the background edge availability probe (idempotent)."""
    global _PROBE_RUNNING
    with _PROBE_LOCK:
        if _PROBE_RUNNING:
            return
        _PROBE_RUNNING = True
    threading.Thread(
        target=_probe_loop,
        name="edge-tts-recovery-probe",
        daemon=True,
    ).start()


__all__ = ["start_edge_recovery_probe"]
