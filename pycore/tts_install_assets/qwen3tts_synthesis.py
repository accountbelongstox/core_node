#!/usr/bin/env python3
"""Reusable blocking synthesis operations for the standalone Qwen3-TTS API."""
from __future__ import annotations

import base64
import io
import os
import threading
import time
from typing import Any, Callable, Dict, List

import numpy as np
import soundfile as sf
from pydub import AudioSegment


class QwenSynthesis:
    """Own encoding, direct synthesis, variant batches, and direct-call stats."""

    def __init__(
        self,
        get_model: Callable[[], Any],
        model_lock: threading.Lock,
        resolve_speaker: Callable[..., Dict[str, Any]],
        speaker_for_variant: Callable[[str, Dict[str, Any], int], Dict[str, Any]],
        qwen_language: Callable[[str], str],
        query_gpu_snapshot: Callable[[int], Dict[str, Any]],
        estimate_max_parallel: Callable[..., int],
        detect_model_variant: Callable[[str], str],
        model_id: Callable[[], str],
        device: Callable[[], str],
        logger: Callable[[str], None],
    ) -> None:
        self._get_model = get_model
        self._model_lock = model_lock
        self._resolve_speaker = resolve_speaker
        self._speaker_for_variant = speaker_for_variant
        self._qwen_language = qwen_language
        self._query_gpu_snapshot = query_gpu_snapshot
        self._estimate_max_parallel = estimate_max_parallel
        self._detect_model_variant = detect_model_variant
        self._model_id = model_id
        self._device = device
        self._logger = logger
        self._stats_lock = threading.Lock()
        self._count = 0
        self._failed = 0
        self._total_ms = 0

    def stats(self) -> Dict[str, int]:
        with self._stats_lock:
            average = round(self._total_ms / self._count) if self._count else 0
            return {
                "synthesized_count": self._count,
                "failed_count": self._failed,
                "average_elapsed_ms": average,
            }

    def generate_one(
        self, params: Dict[str, Any], *, record_stats: bool = True
    ) -> Dict[str, Any]:
        text = str(params.get("text") or "").strip()
        language = str(params.get("language") or "en")
        fmt = "wav" if str(params.get("format") or "mp3").lower() == "wav" else "mp3"
        if not text:
            raise ValueError("empty text")
        model = self._get_model()
        resolved = self._resolve_speaker(
            language, requested=str(params.get("speaker") or "").strip()
        )
        if not resolved.get("ok"):
            raise ValueError(str(resolved.get("message") or resolved))
        speaker = str(resolved["resolved_speaker"])
        gen_kwargs: Dict[str, Any] = {
            "text": text,
            "language": self._qwen_language(language),
            "speaker": speaker,
        }
        instruct = str(
            params.get("instruct") or os.environ.get("QWEN3TTS_INSTRUCT") or ""
        ).strip()
        if instruct:
            gen_kwargs["instruct"] = instruct
        started = time.monotonic()
        try:
            with self._model_lock:
                wavs, sample_rate = model.generate_custom_voice(**gen_kwargs)
            audio, media_type = self._encode_audio(wavs[0], sample_rate, fmt)
            elapsed_ms = round((time.monotonic() - started) * 1000)
            if record_stats:
                self._record(elapsed_ms, True)
            return {
                "ok": True,
                "audio": audio,
                "media_type": media_type,
                "format": fmt,
                "sample_rate": int(sample_rate),
                "speaker": speaker,
                "elapsed_ms": elapsed_ms,
            }
        except Exception:
            if record_stats:
                self._record(round((time.monotonic() - started) * 1000), False)
            raise

    def generate_queue_batch(self, jobs: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        if not jobs:
            return []
        model = self._get_model()
        valid: List[Dict[str, Any]] = []
        results: List[Dict[str, Any]] = [
            {"ok": False, "error": "speaker resolution failed"} for _job in jobs
        ]
        for index, job in enumerate(jobs):
            resolved = self._resolve_speaker(
                str(job.get("language") or "en"),
                requested=str(job.get("speaker") or ""),
            )
            if not resolved.get("ok"):
                results[index] = {
                    "ok": False,
                    "error": resolved.get("message") or resolved,
                }
                continue
            valid.append(
                {"index": index, "job": job, "speaker": resolved["resolved_speaker"]}
            )
        if not valid:
            return results
        language = self._qwen_language(str(valid[0]["job"].get("language") or "en"))
        texts = [str(row["job"]["text"]) for row in valid]
        speakers = [str(row["speaker"]) for row in valid]
        instructions = [
            str(
                row["job"].get("instruct")
                or os.environ.get("QWEN3TTS_INSTRUCT")
                or ""
            )
            for row in valid
        ]
        gen_kwargs: Dict[str, Any] = {
            "text": texts,
            "language": [language] * len(valid),
            "speaker": speakers,
            "non_streaming_mode": True,
        }
        if any(instructions):
            gen_kwargs["instruct"] = instructions
        try:
            with self._model_lock:
                wavs, sample_rate = model.generate_custom_voice(**gen_kwargs)
            for offset, wav in enumerate(wavs):
                row = valid[offset]
                fmt = str(row["job"].get("format") or "mp3")
                audio, media_type = self._encode_audio(wav, sample_rate, fmt)
                results[int(row["index"])] = {
                    "ok": True,
                    "audio": audio,
                    "media_type": media_type,
                    "speaker": row["speaker"],
                }
            return results
        except Exception as batch_error:  # noqa: BLE001
            self._logger(f"[queue] batch generation fallback: {batch_error}")
        for row in valid:
            try:
                results[int(row["index"])] = self.generate_one(
                    row["job"], record_stats=False
                )
            except Exception as exc:  # noqa: BLE001
                results[int(row["index"])] = {"ok": False, "error": str(exc)}
        return results

    def generate_variants(self, params: Dict[str, Any]) -> Dict[str, Any]:
        text = str(params.get("text") or "").strip()
        language = str(params.get("language") or "en")
        variants = list(params.get("variants") or [])
        fmt = "wav" if str(params.get("format") or "mp3").lower() == "wav" else "mp3"
        if not text or not variants:
            raise ValueError("empty text or no variants")
        model = self._get_model()
        qwen_language = self._qwen_language(language)
        resolved_rows: List[Dict[str, Any]] = []
        speakers: List[str] = []
        for index, variant in enumerate(variants):
            resolved = self._speaker_for_variant(language, variant, index)
            if not resolved.get("ok"):
                resolved_rows.append({
                    "key": variant.get("key"),
                    "ok": False,
                    "requested_speaker": variant.get("speaker_id") or variant.get("speaker"),
                    "resolved_speaker": None,
                    "fallback_applied": False,
                    "audio_base64": None,
                    "error": resolved,
                })
                speakers.append("")
                continue
            speakers.append(str(resolved["resolved_speaker"]))
            resolved_rows.append(resolved)
        if all(not speaker for speaker in speakers):
            raise ValueError("no valid speakers in batch")
        snapshot = self._query_gpu_snapshot(self._gpu_index())
        max_parallel = self._estimate_max_parallel(
            self._detect_model_variant(self._model_id()),
            snapshot.get("mem_total_mb") or 0,
            snapshot.get("mem_used_mb") or 0,
            snapshot.get("util_percent"),
        )
        max_parallel = max(1, min(max_parallel, len(variants)))
        results: List[Dict[str, Any]] = [None] * len(variants)  # type: ignore[list-item]
        for index, row in enumerate(resolved_rows):
            if not row.get("ok"):
                results[index] = self._variant_error(variants[index], row)
        with self._model_lock:
            for start in range(0, len(variants), max_parallel):
                chunk = speakers[start:start + max_parallel]
                chunk_speakers = [speaker for speaker in chunk if speaker]
                chunk_indices = [
                    start + offset for offset, speaker in enumerate(chunk) if speaker
                ]
                if not chunk_speakers:
                    continue
                try:
                    wavs, sample_rate = model.generate_custom_voice(
                        text=[text] * len(chunk_speakers),
                        language=[qwen_language] * len(chunk_speakers),
                        speaker=chunk_speakers,
                        non_streaming_mode=True,
                    )
                    self._encode_variant_rows(
                        results, variants, resolved_rows, chunk_indices, wavs, sample_rate, fmt
                    )
                except Exception as chunk_error:  # noqa: BLE001
                    self._logger(
                        f"[api] chunk failed, falling back to item-by-item: {chunk_error}"
                    )
                    for offset, index in enumerate(chunk_indices):
                        try:
                            wavs, sample_rate = model.generate_custom_voice(
                                text=[text],
                                language=[qwen_language],
                                speaker=[chunk_speakers[offset]],
                                non_streaming_mode=True,
                            )
                            self._encode_variant_rows(
                                results,
                                variants,
                                resolved_rows,
                                [index],
                                wavs,
                                sample_rate,
                                fmt,
                            )
                        except Exception as item_error:  # noqa: BLE001
                            results[index] = self._variant_error(
                                variants[index], resolved_rows[index], str(item_error)
                            )
        return {"results": results}

    def _encode_variant_rows(
        self,
        results: List[Dict[str, Any]],
        variants: List[Dict[str, Any]],
        resolved_rows: List[Dict[str, Any]],
        indices: List[int],
        wavs: Any,
        sample_rate: int,
        fmt: str,
    ) -> None:
        for offset, wav in enumerate(wavs):
            index = indices[offset]
            audio, _media_type = self._encode_audio(wav, sample_rate, fmt)
            row = resolved_rows[index]
            results[index] = {
                "key": variants[index].get("key"),
                "ok": True,
                "requested_speaker": row.get("requested_speaker"),
                "resolved_speaker": row.get("resolved_speaker"),
                "fallback_applied": bool(row.get("fallback_applied")),
                "audio_base64": base64.b64encode(audio).decode("ascii"),
                "error": None,
            }

    @staticmethod
    def _variant_error(
        variant: Dict[str, Any], row: Dict[str, Any], error: Any = None
    ) -> Dict[str, Any]:
        return {
            "key": variant.get("key"),
            "ok": False,
            "requested_speaker": row.get("requested_speaker"),
            "resolved_speaker": row.get("resolved_speaker"),
            "fallback_applied": bool(row.get("fallback_applied")),
            "audio_base64": None,
            "error": error or row.get("error") or row,
        }

    def _gpu_index(self) -> int:
        device = self._device()
        suffix = device.rsplit(":", 1)[-1] if ":" in device else ""
        return int(suffix) if suffix.isdigit() else 0

    def _record(self, elapsed_ms: int, ok: bool) -> None:
        with self._stats_lock:
            self._count += 1
            self._total_ms += max(0, int(elapsed_ms))
            if not ok:
                self._failed += 1

    @staticmethod
    def _encode_audio(wav_samples: Any, sample_rate: int, fmt: str) -> "tuple[bytes, str]":
        array = np.asarray(wav_samples, dtype=np.float32)
        array = np.clip(array, -1.0, 1.0)
        if (fmt or "mp3").strip().lower() == "wav":
            buffer = io.BytesIO()
            sf.write(buffer, array, int(sample_rate), format="WAV", subtype="PCM_16")
            buffer.seek(0)
            return buffer.read(), "audio/wav"
        pcm16 = (array * 32767.0).astype(np.int16)
        segment = AudioSegment(
            pcm16.tobytes(), frame_rate=int(sample_rate), sample_width=2, channels=1
        )
        buffer = io.BytesIO()
        segment.export(buffer, format="mp3")
        buffer.seek(0)
        return buffer.read(), "audio/mpeg"


__all__ = ["QwenSynthesis"]
