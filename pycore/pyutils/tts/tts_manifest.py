# -*- coding: utf-8 -*-
"""TTS engine declarations: the ONE place engine facts live.

Declaration order is the default engine priority tail (front-of-chain
placement is policy and stays in ``engine_policy``).
"""

from pycore.pyutils.common.model_manifest import (
    CATEGORY_TTS,
    LIVE_QWEN_QUEUE,
    LIVE_WORD_BATCH,
    RUNTIME_CLOUD,
    RUNTIME_MODEL,
    RUNTIME_SERVER,
    ModelEntry,
    model_manifest,
)

TTS_LOCALE_BY_LANG = {
    "en": "en-US",
    "zh": "zh-CN",
    "ja": "ja-JP",
    "ko": "ko-KR",
    "es": "es-ES",
    "fr": "fr-FR",
    "de": "de-DE",
    "it": "it-IT",
    "pt": "pt-PT",
    "ru": "ru-RU",
    "ar": "ar-SA",
    "hi": "hi-IN",
    "th": "th-TH",
    "vi": "vi-VN",
    "lo": "lo-LA",
}
_LOCALES = frozenset(TTS_LOCALE_BY_LANG)
_EN_ZH = frozenset({"en", "zh"})
_MULTI_CJK = frozenset({"en", "zh", "ja", "ko", "yue"})
_SHERPA_ONNX = ("sherpa_onnx", "sherpa-onnx")

TTS_ENTRIES = (
    ModelEntry(
        "gptsovits", CATEGORY_TTS, RUNTIME_SERVER,
        note="GPT-SoVITS local api server (voice clone)",
        managed_kind="server", concurrency="server", tier_engine="gptsovits", tiered=True,
        health_paths=("/",), languages=_MULTI_CJK, chunk_capable=True, library_kind="api",
    ),
    ModelEntry(
        "streamelements", CATEGORY_TTS, RUNTIME_CLOUD,
        note="StreamElements speech (online; API key; en only)",
        concurrency="cloud", languages=frozenset({"en"}), accent_aware=True, cloud=True,
    ),
    ModelEntry(
        "sherpa", CATEGORY_TTS, RUNTIME_MODEL,
        note="Sherpa-ONNX Kokoro offline (CPU)",
        managed_kind="model", concurrency="in_process", distribution="sherpa-onnx",
        tier_engine="sherpa", tiered=True, pip=_SHERPA_ONNX, library_name="sherpa_onnx",
        library_kind="pip", languages=_EN_ZH, chunk_capable=True,
    ),
    ModelEntry(
        "melotts", CATEGORY_TTS, RUNTIME_SERVER,
        note="MeloTTS offline (torch GPU->CPU auto)",
        managed_kind="server", concurrency="server", tier_engine="melotts",
        health_paths=("/health", "/"),
        languages=frozenset({"en", "zh", "ja", "ko", "es", "fr"}),
        chunk_capable=True, library_kind="api",
    ),
    ModelEntry(
        "edge", CATEGORY_TTS, RUNTIME_CLOUD,
        note="Microsoft Edge TTS (online; serialized)",
        concurrency="serial", pip=("edge_tts", "edge-tts"), library_name="edge_tts",
        library_kind="pip", languages=_LOCALES, accent_aware=True, cloud=True,
    ),
    ModelEntry(
        "gtts_web", CATEGORY_TTS, RUNTIME_CLOUD,
        note="Google Translate web TTS (online, keyless; short text)",
        concurrency="cloud", languages=frozenset({"en", "zh", "ja", "ko", "es", "fr"}),
        cloud=True,
    ),
    ModelEntry(
        "azure", CATEGORY_TTS, RUNTIME_CLOUD,
        note="Azure Speech cloud (free F0; API fallback)",
        concurrency="cloud", languages=_LOCALES, cloud=True,
    ),
    ModelEntry(
        "chattts", CATEGORY_TTS, RUNTIME_SERVER,
        note="ChatTTS local api (dialogue; laughs/sighs; CHATTTS_URL)",
        managed_kind="server", concurrency="server", health_paths=("/health", "/"),
        languages=_EN_ZH, library_kind="api",
    ),
    ModelEntry(
        "cosyvoice", CATEGORY_TTS, RUNTIME_SERVER,
        note="CosyVoice local api (multilingual clone; COSYVOICE_URL)",
        managed_kind="server", concurrency="server", tier_engine="cosyvoice", tiered=True,
        health_paths=("/docs", "/"), languages=_MULTI_CJK, chunk_capable=True,
        library_kind="api",
    ),
    ModelEntry(
        "fishspeech", CATEGORY_TTS, RUNTIME_SERVER,
        note="Fish Speech / Fish Audio (FISHSPEECH_URL or FISH_API_KEY)",
        managed_kind="server", concurrency="server", tier_engine="fishspeech", tiered=True,
        health_paths=("/v1/health", "/health", "/"), languages=frozenset({"en", "zh", "ja"}),
        chunk_capable=True, library_kind="api",
    ),
    ModelEntry(
        "qwen3tts", CATEGORY_TTS, RUNTIME_SERVER,
        note="Qwen3-TTS class-C HTTP server (isolated venv; managed lifecycle)",
        managed_kind="server", concurrency="server", tier_engine="qwen3tts", tiered=True,
        health_paths=("/health", "/"), languages=frozenset({"en", "zh", "ja", "ko"}),
        chunk_capable=True, live=LIVE_QWEN_QUEUE, library_kind="api",
    ),
    ModelEntry(
        "bark", CATEGORY_TTS, RUNTIME_MODEL,
        note="Bark via transformers (suno/bark; expressive; Python 3.13 native)",
        managed_kind="model", concurrency="in_process", tier_engine="bark", tiered=True,
        languages=frozenset({
            "en", "de", "es", "fr", "hi", "it", "ja", "ko", "pl", "pt", "ru", "tr", "zh",
        }),
        chunk_capable=True, library_kind="api",
    ),
    ModelEntry(
        "parler", CATEGORY_TTS, RUNTIME_MODEL,
        note="Parler-TTS in-process (HF; voice-description steering)",
        concurrency="in_process", tier_engine="parler", languages=frozenset({"en"}),
        library_kind="api",
    ),
    ModelEntry(
        "voxcpm2", CATEGORY_TTS, RUNTIME_SERVER,
        note="VoxCPM2 class-C HTTP server (self-contained 3.10 venv; managed lifecycle)",
        managed_kind="server", concurrency="server", tier_engine="voxcpm2", tiered=True,
        pip=("voxcpm", "voxcpm"), library_name="voxcpm", library_kind="pip",
        library_probe=True,
        health_paths=("/health", "/"), languages=_EN_ZH, chunk_capable=True,
    ),
    ModelEntry(
        "kokoro", CATEGORY_TTS, RUNTIME_MODEL,
        note="Kokoro-82M sherpa-onnx offline (zh/en; KOKORO_TTS_MODEL_DIR)",
        managed_kind="model", concurrency="in_process", distribution="sherpa-onnx",
        tier_engine="kokoro", tiered=True, pip=_SHERPA_ONNX, library_name="kokoro",
        library_kind="pip", library_probe=True, languages=_EN_ZH, chunk_capable=True, live=LIVE_WORD_BATCH,
    ),
    ModelEntry(
        "f5tts", CATEGORY_TTS, RUNTIME_SERVER,
        note="F5-TTS local api (fast flow-matching clone; F5TTS_URL)",
        managed_kind="server", concurrency="server", health_paths=("/health", "/"),
        languages=_EN_ZH, library_kind="api",
    ),
)

model_manifest.register(TTS_ENTRIES)
