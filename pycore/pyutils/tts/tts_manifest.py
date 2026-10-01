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
_REQUESTS = ("requests", "requests")
_OFFLINE_TTS_PREREQUISITE = "offline TTS prerequisite (sherpa-onnx)"

TTS_ENTRIES = (
    ModelEntry(
        "gptsovits", CATEGORY_TTS, RUNTIME_SERVER,
        note="GPT-SoVITS local api server (voice clone)",
        managed_kind="server", concurrency="server", tier_engine="gptsovits", tiered=True,
        health_paths=("/",), languages=_MULTI_CJK, chunk_capable=True, library_kind="api",
        install_markers=("deps", "GPT_SoVITS/pretrained_models/.snapshot_done", "api_v2.py", "GPT_SoVITS"),
        staging_env="GPTSOVITS_DIR",
    ),
    ModelEntry(
        "streamelements", CATEGORY_TTS, RUNTIME_CLOUD,
        note="StreamElements speech (online; API key; en only)",
        concurrency="cloud", languages=frozenset({"en"}), accent_aware=True, cloud=True,
        packages=(_REQUESTS,), install_markers=("packages",), secrets=("STREAMELEMENTS_API_KEY",),
    ),
    ModelEntry(
        "sherpa", CATEGORY_TTS, RUNTIME_MODEL,
        note="Sherpa-ONNX Kokoro offline (CPU)",
        managed_kind="model", concurrency="in_process", distribution="sherpa-onnx",
        tier_engine="sherpa", tiered=True, pip=_SHERPA_ONNX, library_name="sherpa_onnx",
        library_kind="pip", languages=_EN_ZH, chunk_capable=True,
        packages=(_SHERPA_ONNX,), install_markers=("packages",), installer=_OFFLINE_TTS_PREREQUISITE,
    ),
    ModelEntry(
        "melotts", CATEGORY_TTS, RUNTIME_SERVER,
        note="MeloTTS offline (torch GPU->CPU auto)",
        managed_kind="server", concurrency="server", tier_engine="melotts",
        health_paths=("/health", "/"),
        languages=frozenset({"en", "zh", "ja", "ko", "es", "fr"}),
        chunk_capable=True, library_kind="api",
        install_markers=("venv",),
        installer="Step55_InstallMelotts.ps1 -Full / 139_install_melotts.sh (or it auto-builds via ensure_venv on install)",
    ),
    ModelEntry(
        "edge", CATEGORY_TTS, RUNTIME_CLOUD,
        note="Microsoft Edge TTS (online; serialized)",
        concurrency="serial", pip=("edge_tts", "edge-tts"), library_name="edge_tts",
        library_kind="pip", languages=_LOCALES, accent_aware=True, cloud=True,
        packages=(("edge_tts", "edge-tts"),), install_markers=("packages",),
    ),
    ModelEntry(
        "gtts_web", CATEGORY_TTS, RUNTIME_CLOUD,
        note="Google Translate web TTS (online, keyless; short text)",
        concurrency="cloud", languages=frozenset({"en", "zh", "ja", "ko", "es", "fr"}),
        cloud=True,
        packages=(_REQUESTS,), install_markers=("packages",),
    ),
    ModelEntry(
        "azure", CATEGORY_TTS, RUNTIME_CLOUD,
        note="Azure Speech cloud (free F0; API fallback)",
        concurrency="cloud", languages=_LOCALES, cloud=True,
        packages=(("azure.cognitiveservices.speech", "azure-cognitiveservices-speech"),),
        install_markers=("packages",), secrets=("AZURE_SPEECH_KEY", "AZURE_SPEECH_REGION"),
    ),
    ModelEntry(
        "chattts", CATEGORY_TTS, RUNTIME_SERVER,
        note="ChatTTS local api (dialogue; laughs/sighs; CHATTTS_URL)",
        managed_kind="server", concurrency="server", health_paths=("/health", "/"),
        languages=_EN_ZH, library_kind="api",
        packages=(("ChatTTS", "ChatTTS"),), install_markers=("packages", "deps"), staging_env="CHATTTS_DIR",
    ),
    ModelEntry(
        "cosyvoice", CATEGORY_TTS, RUNTIME_SERVER,
        note="CosyVoice local api (multilingual clone; COSYVOICE_URL)",
        managed_kind="server", concurrency="server", tier_engine="cosyvoice", tiered=True,
        health_paths=("/docs", "/"), languages=_MULTI_CJK, chunk_capable=True,
        library_kind="api",
        install_markers=("venv", "deps", "runtime/python/fastapi/server.py", "runtime/python"),
        staging_env="COSYVOICE_DIR",
    ),
    ModelEntry(
        "fishspeech", CATEGORY_TTS, RUNTIME_SERVER,
        note="Fish Speech / Fish Audio (FISHSPEECH_URL or FISH_API_KEY)",
        managed_kind="server", concurrency="server", tier_engine="fishspeech", tiered=True,
        health_paths=("/v1/health", "/health", "/"), languages=frozenset({"en", "zh", "ja"}),
        chunk_capable=True, library_kind="api",
        install_markers=("venv", "deps", "tools/api_server.py"), staging_env="FISHSPEECH_DIR",
    ),
    ModelEntry(
        "qwen3tts", CATEGORY_TTS, RUNTIME_SERVER,
        note="Qwen3-TTS class-C HTTP server (isolated venv; managed lifecycle)",
        managed_kind="server", concurrency="server", tier_engine="qwen3tts", tiered=True,
        health_paths=("/health", "/"), languages=frozenset({"en", "zh", "ja", "ko"}),
        chunk_capable=True, live=LIVE_QWEN_QUEUE, library_kind="api",
        install_markers=("venv",), staging_env="QWEN3TTS_DIR",
        installer="Step61_InstallQwen3Tts.ps1 / 183_install_qwen3tts.sh",
    ),
    ModelEntry(
        "bark", CATEGORY_TTS, RUNTIME_MODEL,
        note="Bark via transformers (suno/bark; expressive; Python 3.13 native)",
        managed_kind="model", concurrency="in_process", tier_engine="bark", tiered=True,
        languages=frozenset({
            "en", "de", "es", "fr", "hi", "it", "ja", "ko", "pl", "pt", "ru", "tr", "zh",
        }),
        chunk_capable=True, library_kind="api",
        packages=(("transformers", "transformers"), ("scipy", "scipy")),
        install_markers=("packages", "deps"), staging_env="BARK_DIR",
    ),
    ModelEntry(
        "parler", CATEGORY_TTS, RUNTIME_MODEL,
        note="Parler-TTS in-process (HF; voice-description steering)",
        concurrency="in_process", tier_engine="parler", languages=frozenset({"en"}),
        library_kind="api",
        packages=(("parler_tts", "parler-tts"), ("soundfile", "soundfile"), ("transformers", "transformers")),
        install_markers=("packages",), staging_env="PARLER_DIR",
    ),
    ModelEntry(
        "voxcpm2", CATEGORY_TTS, RUNTIME_SERVER,
        note="VoxCPM2 class-C HTTP server (self-contained 3.10 venv; managed lifecycle)",
        managed_kind="server", concurrency="server", tier_engine="voxcpm2", tiered=True,
        pip=("voxcpm", "voxcpm"), library_name="voxcpm", library_kind="pip",
        library_probe=True,
        health_paths=("/health", "/"), languages=_EN_ZH, chunk_capable=True,
        install_markers=("venv", "deps"), staging_env="VOXCPM2_DIR",
        installer=(
            "Step58_InstallVoxcpm2.ps1 / 147_install_voxcpm2.sh (requires the dedicated "
            "Python 3.12; Windows: Step13_InstallPython310_312.ps1 -Runtime 312)"
        ),
    ),
    ModelEntry(
        "kokoro", CATEGORY_TTS, RUNTIME_MODEL,
        note="Kokoro-82M sherpa-onnx offline (zh/en; KOKORO_TTS_MODEL_DIR)",
        managed_kind="model", concurrency="in_process", distribution="sherpa-onnx",
        tier_engine="kokoro", tiered=True, pip=_SHERPA_ONNX, library_name="kokoro",
        library_kind="pip", library_probe=True, languages=_EN_ZH, chunk_capable=True, live=LIVE_WORD_BATCH,
        packages=(_SHERPA_ONNX,), install_markers=("packages",), installer=_OFFLINE_TTS_PREREQUISITE,
    ),
    ModelEntry(
        "f5tts", CATEGORY_TTS, RUNTIME_SERVER,
        note="F5-TTS local api (fast flow-matching clone; F5TTS_URL)",
        managed_kind="server", concurrency="server", health_paths=("/health", "/"),
        languages=_EN_ZH, library_kind="api",
        packages=(("f5_tts", "f5-tts"),), install_markers=("deps", "packages"), staging_env="F5TTS_DIR",
    ),
)

model_manifest.register(TTS_ENTRIES)
