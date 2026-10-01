# -*- coding: utf-8 -*-
"""The TTS engine registry: one instance per manifest engine, plus the boot
checks every engine derives from its manifest readiness requirements."""

from typing import Tuple

from pycore.pyutils.common.engine_registry import EngineRegistry
from pycore.pyutils.common.model_boot import model_boot
from pycore.pyutils.common.model_manifest import CATEGORY_TTS
from pycore.pyutils.tts.azure_engine import azure_engine
from pycore.pyutils.tts.bark_engine import bark_engine
from pycore.pyutils.tts.chattts_engine import chattts_engine
from pycore.pyutils.tts.cosyvoice_engine import cosyvoice_engine
from pycore.pyutils.tts.edge_engine import edge_engine
from pycore.pyutils.tts.f5tts_engine import f5tts_engine
from pycore.pyutils.tts.fishspeech_engine import fishspeech_engine
from pycore.pyutils.tts.gptsovits_engine import gptsovits_engine
from pycore.pyutils.tts.gtts_web_engine import gtts_web_engine
from pycore.pyutils.tts.kokoro_engine import kokoro_engine
from pycore.pyutils.tts.memory_gate import memory_gate_allows
from pycore.pyutils.tts.melotts_engine import melotts_engine
from pycore.pyutils.tts.parler_engine import parler_engine
from pycore.pyutils.tts.qwen.engine import qwen_engine
from pycore.pyutils.tts.sherpa_engine import sherpa_engine
from pycore.pyutils.tts.streamelements_engine import streamelements_engine
from pycore.pyutils.tts.tts_engine import TTSEngine
import pycore.pyutils.tts.tts_manifest as tts_manifest
from pycore.pyutils.tts.voxcpm2_engine import voxcpm2_engine


class TTSEngineRegistry(EngineRegistry[TTSEngine]):
    def load_gate(self, name: str) -> Tuple[bool, str]:
        """The engine's RAM/VRAM load gate; a name outside the registry goes
        through the memory gate alone."""
        engine = self.get(name)
        return engine.load_gate() if engine is not None else memory_gate_allows(name)


_ENGINES = {
    engine.name: engine
    for engine in (
        azure_engine,
        bark_engine,
        chattts_engine,
        cosyvoice_engine,
        edge_engine,
        f5tts_engine,
        fishspeech_engine,
        gptsovits_engine,
        gtts_web_engine,
        kokoro_engine,
        melotts_engine,
        parler_engine,
        qwen_engine,
        sherpa_engine,
        streamelements_engine,
        voxcpm2_engine,
    )
}

# Manifest declaration order (the default priority tail).
tts_engine_registry = TTSEngineRegistry(_ENGINES[entry.id] for entry in tts_manifest.TTS_ENTRIES)
model_boot.register_checks(
    CATEGORY_TTS, tuple((engine.name, engine.boot_verdict) for engine in tts_engine_registry.values()),
)


__all__ = ["TTSEngineRegistry", "tts_engine_registry"]
