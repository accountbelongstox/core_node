#!/usr/bin/env python3
"""Reusable blocking synthesis operations for the standalone Qwen3-TTS API."""
from __future__ import annotations

import base64
import io
import os
import re
import threading
import time
from typing import Any, Callable, Dict, List

import numpy as np
import soundfile as sf
import librosa
from pydub import AudioSegment

# Sentence-level chunked synthesis: long inputs are split into
# sentence-sized chunks, synthesized, and concatenated with a pause
# (single-shot long-text generation degrades into noise in the second half,
# QwenLM/Qwen3-TTS#258). This is the ONLY pipeline - there is no version
# split: every synthesis result is multi-sentence audio by construction, and
# /status reports "chunked": true so clients can tag it as such.
# The chunks of one task are generated through the model library's NATIVE
# BATCH API (generate_custom_voice accepts parallel text/speaker/language
# lists and returns wavs in input order) in GPU-bounded parallel groups -
# large paragraphs no longer synthesize their sentences one by one.

# Long-text guard: one long single-shot generation derails the 12Hz talker
# halfway through (audible as noise in the second half - upstream issue
# QwenLM/Qwen3-TTS#258). The official recommendation for long text is
# sentence-sized chunking with concatenated audio.
#
# Two budgets bound every generated chunk (both in CHARACTERS of input text,
# scaled by the playback speed because slower speech turns the same
# characters into a longer generation):
#   hard cap  - QWEN3TTS_CHUNK_MAX_CHARS at speed 1.0 (default 280, ~20s of
#               audio). A single pathological sentence longer than the merge
#               budget (but within the hard cap) is still synthesized whole;
#               anything beyond the hard cap is hard-cut.
#   merge cap - a fixed fraction of the hard cap. ADJACENT SENTENCES are only
#               merged while the merged chunk stays within it, so a
#               multi-sentence text never becomes one long merged chunk.
_CHUNK_MAX_CHARS_DEFAULT = 280
_CHUNK_PAUSE_MS_DEFAULT = 150
_SENTENCE_MERGE_RATIO = 0.85
_SPEED_MIN = 0.25
_SPEED_MAX = 3.0
_SENTENCE_SPLIT_RE = re.compile(r"(?<=[.!?;。！？；:：])\s+|(?<=[。！？；])|\n+")
_CLAUSE_SPLIT_RE = re.compile(r"(?<=[,，、])\s*")


def _chunk_max_chars(speed: float = 1.0) -> int:
    """Hard input cap for one model generation.

    Playback speed is applied after inference, so it must not shrink the model
    input and multiply the number of generation calls."""
    raw = (os.environ.get("QWEN3TTS_CHUNK_MAX_CHARS") or "").strip()
    try:
        base = max(80, int(raw)) if raw else _CHUNK_MAX_CHARS_DEFAULT
    except ValueError:
        base = _CHUNK_MAX_CHARS_DEFAULT
    return base


def _chunk_pause_ms() -> int:
    raw = (os.environ.get("QWEN3TTS_CHUNK_PAUSE_MS") or "").strip()
    try:
        return max(0, int(raw)) if raw else _CHUNK_PAUSE_MS_DEFAULT
    except ValueError:
        return _CHUNK_PAUSE_MS_DEFAULT


def _pack_units(units: List[str], merge_cap: int, hard_cap: int) -> List[str]:
    """Greedy sentence merging: adjacent units merge only while the merged
    chunk stays within ``merge_cap``; a single unit longer than the merge cap
    (but within ``hard_cap``) is kept whole, and only a unit beyond the hard
    cap is hard-cut."""
    chunks: List[str] = []
    current = ""
    for unit in units:
        while len(unit) > hard_cap:
            if current:
                chunks.append(current)
                current = ""
            chunks.append(unit[:hard_cap])
            unit = unit[hard_cap:].strip()
        if not unit:
            continue
        candidate = f"{current} {unit}".strip() if current else unit
        if current and len(candidate) > merge_cap:
            chunks.append(current)
            current = unit
        else:
            current = candidate
    if current:
        chunks.append(current)
    return chunks


def _split_long_text(text: str, hard_cap: int) -> List[str]:
    """ALWAYS sentence-aware chunks - even when the whole text fits the hard
    cap, a multi-sentence text is still split at sentence boundaries and only
    merged up to the (tighter) merge cap, so no generation ever carries an
    over-long merged run of sentences."""
    cleaned = (text or "").strip()
    if not cleaned:
        return []
    merge_cap = max(60, round(hard_cap * _SENTENCE_MERGE_RATIO))
    sentences = [
        piece.strip() for piece in _SENTENCE_SPLIT_RE.split(cleaned) if piece.strip()
    ]
    units: List[str] = []
    for sentence in sentences:
        if len(sentence) <= hard_cap:
            units.append(sentence)
            continue
        clauses = [
            piece.strip() for piece in _CLAUSE_SPLIT_RE.split(sentence) if piece.strip()
        ]
        units.extend(clauses if len(clauses) > 1 else sentence.split())
    return _pack_units(units, merge_cap, hard_cap)


def _stretch_to_speed(wav: np.ndarray, speed: float) -> np.ndarray:
    """Pitch-preserving playback-speed adjustment (phase-vocoder time
    stretch; librosa is a hard dependency of qwen-tts in this venv).
    speed < 1.0 slows the speech down, > 1.0 speeds it up; ~1.0 is a no-op.
    The official generate_custom_voice API exposes no speed parameter, so the
    stretch is applied to the final waveform - one place, every endpoint."""
    factor = float(speed)
    if factor <= 0.0 or abs(factor - 1.0) < 1e-3:
        return np.asarray(wav, dtype=np.float32)
    stretched = librosa.effects.time_stretch(
        np.asarray(wav, dtype=np.float32), rate=1.0 / factor
    )
    return np.asarray(stretched, dtype=np.float32)


class QwenSynthesis:
    """Own encoding, direct synthesis, variant batches, and direct-call stats."""

    def __init__(
        self,
        get_model: Callable[[], Any],
        model_lock: threading.Lock,
        resolve_speaker: Callable[..., Dict[str, Any]],
        speaker_for_variant: Callable[[str, Dict[str, Any], int], Dict[str, Any]],
        qwen_language: Callable[[str], str],
        capacity_plan: Callable[[], Dict[str, Any]],
        logger: Callable[[str], None],
        default_speed: Callable[[], float],
    ) -> None:
        self._get_model = get_model
        self._model_lock = model_lock
        self._resolve_speaker = resolve_speaker
        self._speaker_for_variant = speaker_for_variant
        self._qwen_language = qwen_language
        self._capacity_plan = capacity_plan
        self._logger = logger
        self._default_speed = default_speed
        self._stats_lock = threading.Lock()
        self._count = 0
        self._failed = 0
        self._total_ms = 0
        self._runtime_lock = threading.Lock()
        self._runtime: Dict[str, Any] = {
            "phase": "idle",
            "work_kind": None,
            "job_count": 0,
            "text_chars": 0,
            "chunks_total": 0,
            "chunks_completed": 0,
            "active_native_batch": 0,
            "started_monotonic": None,
        }

    def stats(self) -> Dict[str, int]:
        with self._stats_lock:
            average = round(self._total_ms / self._count) if self._count else 0
            return {
                "synthesized_count": self._count,
                "failed_count": self._failed,
                "average_elapsed_ms": average,
            }

    def runtime(self) -> Dict[str, Any]:
        with self._runtime_lock:
            snapshot = dict(self._runtime)
        started = snapshot.pop("started_monotonic", None)
        snapshot["running_elapsed_ms"] = (
            max(0, round((time.monotonic() - float(started)) * 1000))
            if started is not None
            else 0
        )
        return snapshot

    def _start_runtime(
        self,
        work_kind: str,
        job_count: int,
        text_chars: int,
        chunks_total: int,
    ) -> None:
        with self._runtime_lock:
            self._runtime = {
                "phase": "running",
                "work_kind": work_kind,
                "job_count": max(1, int(job_count)),
                "text_chars": max(0, int(text_chars)),
                "chunks_total": max(1, int(chunks_total)),
                "chunks_completed": 0,
                "active_native_batch": 1,
                "started_monotonic": time.monotonic(),
            }

    def _update_runtime(
        self,
        phase: str,
        active_native_batch: int,
        chunks_completed: int,
    ) -> None:
        with self._runtime_lock:
            self._runtime["phase"] = phase
            self._runtime["active_native_batch"] = max(
                1, int(active_native_batch)
            )
            self._runtime["chunks_completed"] = max(
                0, int(chunks_completed)
            )

    def _finish_runtime(self) -> None:
        with self._runtime_lock:
            self._runtime = {
                "phase": "idle",
                "work_kind": None,
                "job_count": 0,
                "text_chars": 0,
                "chunks_total": 0,
                "chunks_completed": 0,
                "active_native_batch": 0,
                "started_monotonic": None,
            }

    def _resolve_speed(self, params: Dict[str, Any]) -> float:
        """Effective playback speed for one job: explicit valid request value,
        else the server-wide default (QWEN3TTS_SPEED / shared constant)."""
        raw = params.get("speed")
        try:
            value = float(raw) if raw is not None else float(self._default_speed())
        except (TypeError, ValueError):
            value = float(self._default_speed())
        return min(_SPEED_MAX, max(_SPEED_MIN, value))

    def generate_one(
        self, params: Dict[str, Any], *, record_stats: bool = True
    ) -> Dict[str, Any]:
        text = str(params.get("text") or "").strip()
        language = str(params.get("language") or "en")
        fmt = "wav" if str(params.get("format") or "mp3").lower() == "wav" else "mp3"
        if not text:
            raise ValueError("empty text")
        speed = self._resolve_speed(params)
        model = self._get_model()
        resolved = self._resolve_speaker(
            language,
            requested=str(params.get("speaker") or "").strip(),
            random_default=True,
            stable_identity=str(
                params.get("client_job_id") or params.get("job_id") or ""
            ),
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
            hard_cap = _chunk_max_chars(speed)
            chunks = _split_long_text(text, hard_cap)
            with self._model_lock:
                self._start_runtime(
                    "sentence_chunks" if len(chunks) > 1 else "single",
                    1,
                    len(text),
                    len(chunks),
                )
                try:
                    if len(chunks) > 1:
                        self._logger(
                            f"[api] sentence text -> {len(chunks)} chunks "
                            f"({len(text)} chars, merge_cap="
                            f"{max(60, round(hard_cap * _SENTENCE_MERGE_RATIO))}, "
                            f"speed={speed:g}, speaker={speaker})"
                        )
                        wav, sample_rate = self._generate_chunked(
                            model, gen_kwargs, chunks
                        )
                    else:
                        self._update_runtime("single", 1, 0)
                        wavs, sample_rate = model.generate_custom_voice(**gen_kwargs)
                        wav = wavs[0]
                        self._update_runtime("single", 1, 1)
                finally:
                    self._finish_runtime()
            wav = _stretch_to_speed(wav, speed)
            audio, media_type = self._encode_audio(wav, sample_rate, fmt)
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
                "speaker_random": bool(resolved.get("random_applied")),
                "chunked": True,
                "speed": speed,
                "elapsed_ms": elapsed_ms,
            }
        except Exception:
            if record_stats:
                self._record(round((time.monotonic() - started) * 1000), False)
            raise

    def _generate_chunked(
        self, model: Any, gen_kwargs: Dict[str, Any], chunks: List[str]
    ) -> "tuple[Any, int]":
        """Generate the sentence chunks of ONE task and concatenate them in
        ORIGINAL order, inserting a short pause at chunk boundaries.

        Chunks are produced in parallel groups through the model library's
        native batch API, bounded by the GPU-tuned max parallelism (same
        estimator as the queue). A failing group degrades to per-chunk
        sequential generation for THAT GROUP ONLY - one bad chunk never
        loses the whole task, and one group's fallback never affects the
        next group."""
        pause_ms = _chunk_pause_ms()
        group_limit = self._chunk_parallel_limit()
        if len(chunks) > group_limit:
            self._logger(
                f"[api] parallel chunk groups: {len(chunks)} chunks / "
                f"batch <= {group_limit} (GPU-tuned)"
            )
        sample_rate = 0
        ordered: List[Any] = [None] * len(chunks)
        for start in range(0, len(chunks), group_limit):
            group = chunks[start:start + group_limit]
            batch_done = False
            self._update_runtime("sentence_batch", len(group), start)
            if len(group) > 1:
                try:
                    wavs, sample_rate = self._generate_chunk_group(
                        model, gen_kwargs, group
                    )
                    if len(wavs) != len(group):
                        raise RuntimeError(
                            f"chunk batch returned {len(wavs)}/{len(group)} wavs"
                        )
                    for offset, wav in enumerate(wavs):
                        ordered[start + offset] = np.asarray(wav, dtype=np.float32)
                    batch_done = True
                except Exception as batch_error:  # noqa: BLE001 - group-local fallback
                    self._logger(
                        f"[api] chunk batch of {len(group)} failed "
                        f"({batch_error}) -> sequential fallback for this group"
                    )
            if not batch_done:
                for offset, chunk in enumerate(group):
                    self._update_runtime("sentence_fallback", 1, start + offset)
                    wavs, sample_rate = model.generate_custom_voice(
                        **{**gen_kwargs, "text": chunk}
                    )
                    ordered[start + offset] = np.asarray(wavs[0], dtype=np.float32)
            self._update_runtime(
                "sentence_batch",
                len(group),
                start + len(group),
            )
        parts: List[Any] = []
        for index, wav in enumerate(ordered):
            if wav is None:
                raise RuntimeError(f"chunk {index} produced no audio")
            if parts and pause_ms > 0:
                parts.append(
                    np.zeros(int(sample_rate * pause_ms / 1000), dtype=np.float32)
                )
            parts.append(wav)
        return np.concatenate(parts), int(sample_rate)

    def _generate_chunk_group(
        self, model: Any, gen_kwargs: Dict[str, Any], group: List[str]
    ) -> "tuple[Any, int]":
        """One native batch call for a group of sentence chunks: same speaker
        and language for every chunk of the task, wavs returned in input
        order by the model library (qwen_tts.generate_custom_voice)."""
        count = len(group)
        batch_kwargs: Dict[str, Any] = {
            **gen_kwargs,
            "text": list(group),
            "language": [gen_kwargs["language"]] * count,
            "speaker": [gen_kwargs["speaker"]] * count,
            "non_streaming_mode": True,
        }
        if batch_kwargs.get("instruct"):
            batch_kwargs["instruct"] = [batch_kwargs["instruct"]] * count
        else:
            batch_kwargs.pop("instruct", None)
        return model.generate_custom_voice(**batch_kwargs)

    def _chunk_parallel_limit(self) -> int:
        """Use the immutable startup plan shared by every synthesis path."""
        return max(1, int(self._capacity_plan().get("batch_size") or 1))

    def queue_batchable(self, job: Dict[str, Any]) -> bool:
        text = str(job.get("text") or "").strip()
        hard_cap = _chunk_max_chars(self._resolve_speed(job))
        return len(_split_long_text(text, hard_cap)) <= 1

    def generate_queue_batch(self, jobs: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        if not jobs:
            return []
        model = self._get_model()
        valid: List[Dict[str, Any]] = []
        results: List[Dict[str, Any]] = [
            {"ok": False, "error": "speaker resolution failed"} for _job in jobs
        ]
        for index, job in enumerate(jobs):
            # random_default: one random native voice per JOB (task) - resolved
            # once here, so every sentence chunk of the job reuses it.
            resolved = self._resolve_speaker(
                str(job.get("language") or "en"),
                requested=str(job.get("speaker") or ""),
                random_default=True,
                stable_identity=str(
                    job.get("client_job_id") or job.get("job_id") or ""
                ),
            )
            if not resolved.get("ok"):
                results[index] = {
                    "ok": False,
                    "error": resolved.get("message") or resolved,
                }
                continue
            valid.append({
                "index": index,
                "job": job,
                "speaker": resolved["resolved_speaker"],
                "speaker_random": bool(resolved.get("random_applied")),
            })
        if not valid:
            return results
        # Any text that produces multiple sentence-safe chunks is routed
        # through the one shared chunk-and-merge path. Cross-job batching is
        # reserved for inputs that remain one safe chunk.
        long_rows: List[Dict[str, Any]] = []
        batch_rows: List[Dict[str, Any]] = []
        for row in valid:
            if not self.queue_batchable(row["job"]):
                long_rows.append(row)
            else:
                batch_rows.append(row)
        for row in long_rows:
            self._logger(
                "[queue] long text "
                f"({len(str(row['job'].get('text') or ''))} chars) -> chunked generation"
            )
            try:
                results[int(row["index"])] = self.generate_one(
                    row["job"], record_stats=False
                )
            except Exception as exc:  # noqa: BLE001
                results[int(row["index"])] = {"ok": False, "error": str(exc)}
        if not batch_rows:
            return results
        language = self._qwen_language(str(batch_rows[0]["job"].get("language") or "en"))
        texts = [str(row["job"]["text"]) for row in batch_rows]
        speakers = [str(row["speaker"]) for row in batch_rows]
        instructions = [
            str(
                row["job"].get("instruct")
                or os.environ.get("QWEN3TTS_INSTRUCT")
                or ""
            )
            for row in batch_rows
        ]
        gen_kwargs: Dict[str, Any] = {
            "text": texts,
            "language": [language] * len(batch_rows),
            "speaker": speakers,
            "non_streaming_mode": True,
        }
        if any(instructions):
            gen_kwargs["instruct"] = instructions
        try:
            with self._model_lock:
                self._start_runtime(
                    "queue_batch",
                    len(batch_rows),
                    sum(len(text) for text in texts),
                    len(batch_rows),
                )
                try:
                    self._update_runtime("queue_batch", len(batch_rows), 0)
                    wavs, sample_rate = model.generate_custom_voice(**gen_kwargs)
                    self._update_runtime(
                        "queue_batch", len(batch_rows), len(batch_rows)
                    )
                finally:
                    self._finish_runtime()
            for offset, wav in enumerate(wavs):
                row = batch_rows[offset]
                fmt = str(row["job"].get("format") or "mp3")
                speed = self._resolve_speed(row["job"])
                wav = _stretch_to_speed(wav, speed)
                audio, media_type = self._encode_audio(wav, sample_rate, fmt)
                results[int(row["index"])] = {
                    "ok": True,
                    "audio": audio,
                    "media_type": media_type,
                    "speaker": row["speaker"],
                    "speaker_random": bool(row.get("speaker_random")),
                    "chunked": True,
                    "speed": speed,
                }
            return results
        except Exception as batch_error:  # noqa: BLE001
            self._logger(f"[queue] batch generation fallback: {batch_error}")
        for row in batch_rows:
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
        max_parallel = max(
            1,
            min(
                int(self._capacity_plan().get("batch_size") or 1),
                len(variants),
            ),
        )
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
        speed = self._default_speed()
        for offset, wav in enumerate(wavs):
            index = indices[offset]
            wav = _stretch_to_speed(wav, speed)
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
