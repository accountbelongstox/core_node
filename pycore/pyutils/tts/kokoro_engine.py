"""
Kokoro-82M offline TTS via sherpa-onnx (dedicated priority slot).

Uses sherpa-onnx with the Kokoro-82M multi-lang model (zh/en). Installed by
117_install_kokoro.sh; falls back to the sherpa offline prerequisite cache.

Official perfect-support environment (see pycore/tts_install_assets/tts_model_tiers.py):
  sherpa-onnx pip package; GPU hosts may install kokoro-multi-lang-v1_1 and
  CPU-only hosts kokoro-int8-multi-lang-v1_1. Runtime inference is pinned to
  the CPU provider on both host types.
  Model dir: KOKORO_TTS_MODEL_DIR or sherpa cache fallback.

Official: https://k2-fsa.github.io/sherpa/onnx/tts/all/Chinese-English/kokoro-multi-lang-v1_1.html

Config:
  KOKORO_TTS_MODEL_DIR  - model root (default: <cache>/tts/kokoro, else sherpa dir)
  KOKORO_TTS_SID        - speaker id (default 0)
"""

import os
from pathlib import Path

from pycore.pyfoundations.system_paths import get_shared_download_cache_dir
from pycore.pyutils.tts.sherpa_engine import SherpaEngine, find_model_file, sherpa_engine


class KokoroEngine(SherpaEngine):
    sid_env = "KOKORO_TTS_SID"

    def model_dir(self) -> Path:
        env = (os.environ.get("KOKORO_TTS_MODEL_DIR") or "").strip()
        if env:
            return Path(env)
        dedicated = get_shared_download_cache_dir() / "tts" / "kokoro"
        if dedicated.is_dir() and find_model_file(dedicated, "*.onnx"):
            return dedicated
        return sherpa_engine.model_dir()

    def is_kokoro(self) -> bool:
        return True


kokoro_engine = KokoroEngine("kokoro")


__all__ = ["KokoroEngine", "kokoro_engine"]
