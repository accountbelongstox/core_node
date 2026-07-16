# -*- coding: utf-8 -*-
"""
ONE key-reading center for service APIs (the non-AI-gateway side).

Every API secret in pycore flows through the SAME global loader,
``pyfoundations.secret_manager.get_secret_key_indexed`` — the indexed
``<BASE>_1.._5`` (then bare ``<BASE>``) convention the AI gateway already uses
(see [[ai-key-indexed-loader]]). This module is the single home for the small
per-API "which base name" wrappers so callers never hardcode an index or
duplicate fallback logic. Lives under ``pyutils/common`` (the shared base any
pyutils group may import), so TTS / STT / azure_speech all reuse it.

Azure Speech unified key names (entered in "Set Special Software Environment
Variables"):
  AZURE_SPEECH_KEY      - subscription key (the env manager stores the first
                          entry as AZURE_SPEECH_KEY_1; rotation _2.._5 supported)
  AZURE_SPEECH_REGION   - resource region, e.g. "eastus"
A transitional fallback to the old AZURE_SPEECH_KEYA / AZURE_SPEECH_KEYB names
keeps a key entered before the rename working until it is re-entered.

StreamElements TTS (online Polly voices; required since the keyless endpoint
started returning HTTP 401):
  STREAMELEMENTS_API_KEY - channel/JWT auth token stored under
  ``.secret_keys/.secret_ignore/`` as ``STREAMELEMENTS_API_KEY_1`` .. ``_5``
  (or bare ``STREAMELEMENTS_API_KEY``). Enter via Special Software env manager;
  read only through ``get_secret_key_indexed`` — never OS env vars here.
"""

from pycore.pyfoundations.secret_manager import get_secret_key_indexed


def azure_speech_key() -> str:
    """Azure Speech subscription key via the global indexed loader.
    Order: AZURE_SPEECH_KEY (unified) -> legacy AZURE_SPEECH_KEYA / KEYB."""
    return (get_secret_key_indexed("AZURE_SPEECH_KEY")
            or get_secret_key_indexed("AZURE_SPEECH_KEYA")
            or get_secret_key_indexed("AZURE_SPEECH_KEYB")
            or "")


def azure_speech_region() -> str:
    """Azure Speech region (default 'eastus'). Indexed loader from .secret_keys."""
    return get_secret_key_indexed("AZURE_SPEECH_REGION") or "eastus"


def streamelements_api_key() -> str:
    """StreamElements speech API key from ``.secret_keys`` (indexed _1.._5 then bare)."""
    return (get_secret_key_indexed("STREAMELEMENTS_API_KEY") or "").strip()


def streamelements_key_present() -> bool:
    """True when STREAMELEMENTS_API_KEY is configured in ``.secret_keys`` (never leaks value)."""
    return bool(streamelements_api_key())


__all__ = [
    "azure_speech_key",
    "azure_speech_region",
    "streamelements_api_key",
    "streamelements_key_present",
]
