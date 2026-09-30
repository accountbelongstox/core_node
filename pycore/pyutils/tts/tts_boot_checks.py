# -*- coding: utf-8 -*-
"""Boot verification of every TTS engine (cheap: no network, no weight loading).

Class-C servers are never blocked: a missing venv or clone is fixed by the
managed lifecycle, so it is ``deferred``. A missing key, package or model file
of a cloud or in-process engine is a hard precondition and ``blocked``.
"""

from pycore.pyfoundations.api_secrets import (
    azure_speech_key,
    azure_speech_region,
    streamelements_api_key,
)
from pycore.pyutils.common.model_boot import model_boot
from pycore.pyutils.common.model_checks import packages_check
from pycore.pyutils.common.model_manifest import (
    BOOT_READY,
    CATEGORY_TTS,
    BootVerdict,
    blocked,
    deferred,
    ready,
)
import pycore.pyutils.tts.kokoro_engine as kokoro_engine
import pycore.pyutils.tts.sherpa_engine as sherpa_engine
from pycore.pyutils.tts.tts_engine_probe import engine_installed
import pycore.pyutils.tts.tts_manifest as tts_manifest
from pycore.pyutils.tts.tts_reason_codes import (
    TTS_INSTALL_HINT_PREREQUISITES,
    TTS_REASON_MODEL_NOT_FOUND,
    TTS_REASON_NOT_INSTALLED,
    TTS_REASON_PACKAGE_MISSING,
    TTS_REASON_SECRET_REQUIRED,
    tts_reason,
)

_OFFLINE_TTS_PREREQUISITE = "offline TTS prerequisite (sherpa-onnx)"
_HTTP_CLIENT_PACKAGE = "requests"
_STREAMELEMENTS_SECRET = "STREAMELEMENTS_API_KEY"
_AZURE_SPEECH_SECRETS = "AZURE_SPEECH_KEY, AZURE_SPEECH_REGION"
_AZURE_SPEECH_PACKAGE = "azure-cognitiveservices-speech"
_AZURE_SPEECH_MODULE = "azure.cognitiveservices.speech"


def _installed_or_deferred(name: str) -> BootVerdict:
    if engine_installed(name):
        return ready()
    return deferred(tts_reason(TTS_REASON_NOT_INSTALLED, installer=TTS_INSTALL_HINT_PREREQUISITES))


def _installed_or_blocked(name: str, package: str) -> BootVerdict:
    if engine_installed(name):
        return ready()
    return blocked(tts_reason(TTS_REASON_PACKAGE_MISSING, package=package))


def _sherpa_family(name: str, model_dir_getter) -> BootVerdict:
    package = packages_check(
        ("sherpa_onnx",), tts_reason(TTS_REASON_PACKAGE_MISSING, package="sherpa-onnx"),
    )
    if package.state != BOOT_READY:
        return package
    if not sherpa_engine.model_files_present(model_dir_getter()):
        return blocked(tts_reason(
            TTS_REASON_MODEL_NOT_FOUND, engine=name, installer=_OFFLINE_TTS_PREREQUISITE,
        ))
    return ready()


def _edge() -> BootVerdict:
    return packages_check(
        ("edge_tts",), tts_reason(TTS_REASON_PACKAGE_MISSING, package="edge-tts"),
    )


def _http_client_only() -> BootVerdict:
    return packages_check(
        ("requests",), tts_reason(TTS_REASON_PACKAGE_MISSING, package=_HTTP_CLIENT_PACKAGE),
    )


def _streamelements() -> BootVerdict:
    if not (streamelements_api_key() or "").strip():
        return blocked(tts_reason(TTS_REASON_SECRET_REQUIRED, secrets=_STREAMELEMENTS_SECRET))
    return _http_client_only()


def _azure() -> BootVerdict:
    package = packages_check(
        (_AZURE_SPEECH_MODULE,),
        tts_reason(TTS_REASON_PACKAGE_MISSING, package=_AZURE_SPEECH_PACKAGE),
    )
    if package.state != BOOT_READY:
        return package
    if not (azure_speech_key() and azure_speech_region()):
        return blocked(tts_reason(TTS_REASON_SECRET_REQUIRED, secrets=_AZURE_SPEECH_SECRETS))
    return ready()


_TTS_CHECKS = {
    "gptsovits": lambda: _installed_or_deferred("gptsovits"),
    "streamelements": _streamelements,
    "sherpa": lambda: _sherpa_family("sherpa", sherpa_engine.model_dir),
    "melotts": lambda: _installed_or_deferred("melotts"),
    "edge": _edge,
    "gtts_web": _http_client_only,
    "azure": _azure,
    "chattts": lambda: _installed_or_deferred("chattts"),
    "cosyvoice": lambda: _installed_or_deferred("cosyvoice"),
    "fishspeech": lambda: _installed_or_deferred("fishspeech"),
    "qwen3tts": lambda: _installed_or_deferred("qwen3tts"),
    "bark": lambda: _installed_or_blocked("bark", "transformers, scipy"),
    "parler": lambda: _installed_or_blocked("parler", "parler-tts, soundfile, transformers"),
    "voxcpm2": lambda: _installed_or_deferred("voxcpm2"),
    "kokoro": lambda: _sherpa_family("kokoro", kokoro_engine.model_dir),
    "f5tts": lambda: _installed_or_deferred("f5tts"),
}

model_boot.register_checks(
    CATEGORY_TTS,
    tuple((entry.id, _TTS_CHECKS[entry.id]) for entry in tts_manifest.TTS_ENTRIES),
)
