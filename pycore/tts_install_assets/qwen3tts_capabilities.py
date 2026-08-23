#!/usr/bin/env python3
"""Runtime language and speaker capabilities for Qwen3-TTS."""

from __future__ import annotations

import hashlib
import os
import random
import time
from typing import Any, Callable, Dict, List, Optional


LANGUAGE_NAMES = {
    "en": "English",
    "zh": "Chinese",
    "ja": "Japanese",
    "ko": "Korean",
    "de": "German",
    "fr": "French",
    "ru": "Russian",
    "pt": "Portuguese",
    "es": "Spanish",
    "it": "Italian",
}
DEFAULT_SPEAKERS = {
    "en": "Ryan",
    "zh": "Vivian",
    "ja": "Ono_Anna",
    "ko": "Sohee",
}
SPEAKER_NATIVE_LANGUAGE = {
    "Ryan": "en",
    "Aiden": "en",
    "Vivian": "zh",
    "Serena": "zh",
    "Uncle_Fu": "zh",
    "Dylan": "zh",
    "Eric": "zh",
    "Ono_Anna": "ja",
    "Sohee": "ko",
}
SPEAKERS_BY_GENDER = {
    "female": ("Serena", "Vivian", "Ono_Anna", "Sohee"),
    "male": ("Ryan", "Aiden", "Uncle_Fu", "Dylan", "Eric"),
}


class QwenCapabilities:
    """Own dynamic model capabilities and deterministic speaker selection."""

    def __init__(
        self,
        model_id: Callable[[], str],
        model_ready: Callable[[Any], bool],
        logger: Callable[[str], None],
    ) -> None:
        self._model_id = model_id
        self._model_ready = model_ready
        self._logger = logger
        self._cache: Optional[Dict[str, Any]] = None

    @staticmethod
    def _native_pool(code: str, capabilities: Dict[str, Any]) -> List[str]:
        supported = list(capabilities.get("speakers") or [])
        native = [
            speaker
            for speaker in supported
            if SPEAKER_NATIVE_LANGUAGE.get(speaker) == code
            or speaker not in SPEAKER_NATIVE_LANGUAGE
        ]
        return native or supported

    @staticmethod
    def _variant_candidates(
        code: str,
        gender: str,
        capabilities: Dict[str, Any],
    ) -> List[str]:
        supported = list(capabilities.get("speakers") or [])
        native = QwenCapabilities._native_pool(code, capabilities)
        preferred_gender = set(SPEAKERS_BY_GENDER.get(gender) or ())
        opposite_gender = set(
            SPEAKERS_BY_GENDER["male" if gender == "female" else "female"]
        )
        ordered = [speaker for speaker in native if speaker in preferred_gender]
        ordered.extend(
            speaker
            for speaker in native
            if speaker not in preferred_gender and speaker not in opposite_gender
        )
        ordered.extend(
            speaker
            for speaker in supported
            if speaker in preferred_gender and speaker not in ordered
        )
        ordered.extend(speaker for speaker in native if speaker not in ordered)
        ordered.extend(speaker for speaker in supported if speaker not in ordered)
        return ordered

    def _default_snapshot(self) -> Dict[str, Any]:
        speakers = sorted(
            set(SPEAKER_NATIVE_LANGUAGE) | set(DEFAULT_SPEAKERS.values())
        )
        return {
            "model_id": self._model_id(),
            "model_kind": "custom_voice",
            "speakers": speakers,
            "languages": sorted(set(LANGUAGE_NAMES.values())),
            "speaker_map": {
                speaker.lower(): speaker
                for speaker in speakers
            },
            "loaded_at": None,
            "revision": "fallback",
        }

    def refresh(self, model: Any) -> Dict[str, Any]:
        snapshot = self._default_snapshot()
        speakers: List[Any] = []
        languages: List[Any] = []
        if hasattr(model, "get_supported_speakers"):
            try:
                speakers = list(model.get_supported_speakers() or [])
            except Exception as error:
                self._logger(
                    f"[api] get_supported_speakers failed: {error}"
                )
        if hasattr(model, "get_supported_languages"):
            try:
                languages = list(model.get_supported_languages() or [])
            except Exception as error:
                self._logger(
                    f"[api] get_supported_languages failed: {error}"
                )
        if speakers:
            snapshot["speakers"] = [str(speaker) for speaker in speakers]
            snapshot["speaker_map"] = {
                str(speaker).lower(): str(speaker)
                for speaker in speakers
            }
        if languages:
            snapshot["languages"] = [str(language) for language in languages]
        snapshot["loaded_at"] = time.strftime(
            "%Y-%m-%dT%H:%M:%SZ",
            time.gmtime(),
        )
        snapshot["revision"] = (
            f"{snapshot['model_id']}:{len(snapshot['speakers'])}"
        )
        self._cache = snapshot
        return dict(snapshot)

    def snapshot(self, model: Any) -> Dict[str, Any]:
        if self._cache is not None:
            return dict(self._cache)
        if self._model_ready(model):
            return self.refresh(model)
        return self._default_snapshot()

    def native_pools(self, model: Any) -> Dict[str, List[str]]:
        capabilities = self.snapshot(model)
        return {
            code: self._native_pool(code, capabilities)
            for code in LANGUAGE_NAMES
        }

    def resolve_speaker(
        self,
        model: Any,
        language: str,
        *,
        requested: str = "",
        accent: str = "",
        gender: str = "female",
        index: int = 0,
        random_default: bool = False,
        stable_identity: str = "",
    ) -> Dict[str, Any]:
        capabilities = self.snapshot(model)
        speaker_map = dict(capabilities.get("speaker_map") or {})
        supported = list(capabilities.get("speakers") or [])
        environment_speaker = (os.environ.get("QWEN3TTS_SPEAKER") or "").strip()
        requested_speaker = str(requested or environment_speaker or "").strip()
        if requested_speaker:
            canonical = speaker_map.get(requested_speaker.lower())
            if not canonical:
                return {
                    "ok": False,
                    "code": "unknown_speaker",
                    "message": f"speaker not supported: {requested_speaker}",
                    "retryable": False,
                    "supported_speakers": supported,
                }
            return {
                "ok": True,
                "requested_speaker": requested_speaker,
                "resolved_speaker": canonical,
                "fallback_applied": canonical != requested_speaker,
            }
        code = str(language or "en").strip().lower()[:2]
        if random_default:
            pool = self._native_pool(code, capabilities)
            if not pool:
                return {
                    "ok": False,
                    "code": "no_speakers",
                    "message": "model reported no supported speakers",
                    "retryable": False,
                    "supported_speakers": [],
                }
            identity = str(stable_identity or "").strip()
            if identity:
                digest = hashlib.sha256(identity.encode("utf-8")).digest()
                picked = pool[int.from_bytes(digest[:8], "big") % len(pool)]
            else:
                picked = random.choice(pool)
            return {
                "ok": True,
                "requested_speaker": picked,
                "resolved_speaker": picked,
                "random_applied": True,
                "fallback_applied": SPEAKER_NATIVE_LANGUAGE.get(picked) != code,
            }
        gender_key = str(gender or "female").strip().lower()
        if gender_key not in SPEAKERS_BY_GENDER:
            gender_key = "female"
        candidates = self._variant_candidates(
            code,
            gender_key,
            capabilities,
        )
        if not candidates:
            candidates = list(supported)[:1] or ["Ryan"]
        preferred = candidates[index % len(candidates)]
        for candidate in candidates:
            canonical = speaker_map.get(candidate.lower())
            if canonical:
                return {
                    "ok": True,
                    "requested_speaker": preferred,
                    "resolved_speaker": canonical,
                    "fallback_applied": canonical != preferred,
                }
        if supported:
            return {
                "ok": True,
                "requested_speaker": preferred,
                "resolved_speaker": supported[0],
                "fallback_applied": True,
            }
        return {
            "ok": False,
            "code": "no_speakers",
            "message": "model reported no supported speakers",
            "retryable": False,
            "supported_speakers": [],
        }

    def speaker_for_variant(
        self,
        model: Any,
        language: str,
        variant: Dict[str, Any],
        index: int,
    ) -> Dict[str, Any]:
        explicit = str(
            variant.get("speaker_id") or variant.get("speaker") or ""
        ).strip()
        return self.resolve_speaker(
            model,
            language,
            requested=explicit,
            accent=str(variant.get("accent") or ""),
            gender=str(variant.get("gender") or "female"),
            index=index,
        )

    @staticmethod
    def qwen_language(language: str) -> str:
        code = str(language or "en").strip().lower()[:2]
        return LANGUAGE_NAMES.get(code, "Auto")


__all__ = ["DEFAULT_SPEAKERS", "QwenCapabilities"]
