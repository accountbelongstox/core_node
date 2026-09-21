#!/usr/bin/env python3
"""Shared chunked-generation audio assembly for standalone TTS API servers.

Requires numpy (present in every engine venv). No pycore imports: servers use
this module directly, and the main process loads the same file by path.

Pipeline: split text (tts_text_chunking) -> synthesize each chunk through the
engine's native single-shot callable -> validate every chunk waveform ->
concatenate in order with a fixed pause -> return the assembled float32 mono
waveform plus per-chunk statistics. Any chunk failure fails the whole task;
no partial audio is ever published by this module.
"""
from __future__ import annotations

import os
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Sequence, Tuple

import numpy as np

try:
    from tts_text_chunking import (
        ChunkBudgetError,
        ChunkPolicy,
        TextChunk,
        default_policy,
        split_text,
    )
except ImportError:  # staged as a sibling module; direct package path fallback
    from .tts_text_chunking import (  # type: ignore
        ChunkBudgetError,
        ChunkPolicy,
        TextChunk,
        default_policy,
        split_text,
    )


class ChunkedGenerationError(RuntimeError):
    """One chunk failed permanently; the whole task must fail."""

    def __init__(self, chunk_index: int, chunk_count: int, reason: str) -> None:
        super().__init__(
            f"chunk {chunk_index + 1}/{chunk_count} failed: {reason}"
        )
        self.chunk_index = chunk_index
        self.chunk_count = chunk_count
        self.reason = reason


class ChunkedGenerationCancelled(RuntimeError):
    """Cancellation observed at a chunk boundary."""


@dataclass
class ChunkRecord:
    index: int
    chars: int
    attempts: int
    seconds: float
    wav_path: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return {
            "index": self.index,
            "chars": self.chars,
            "attempts": self.attempts,
            "seconds": round(self.seconds, 3),
        }


@dataclass
class ChunkedResult:
    wav: np.ndarray
    sample_rate: int
    chunk_count: int
    chunked: bool
    duration_s: float
    seconds: float
    records: List[ChunkRecord] = field(default_factory=list)

    def stats(self) -> Dict[str, Any]:
        return {
            "chunked": self.chunked,
            "chunk_count": self.chunk_count,
            "sample_rate": self.sample_rate,
            "duration_s": round(self.duration_s, 3),
            "seconds": round(self.seconds, 3),
            "chunks": [record.to_dict() for record in self.records],
        }


def validate_wav(wav: Any, sample_rate: int) -> np.ndarray:
    """Structural validation: non-empty, finite float32 mono in [-1, 1]."""
    arr = np.asarray(wav, dtype=np.float32).reshape(-1)
    if arr.size == 0:
        raise ChunkedGenerationError(-1, -1, "empty waveform")
    if not np.isfinite(arr).all():
        raise ChunkedGenerationError(-1, -1, "non-finite samples in waveform")
    if int(sample_rate) <= 0:
        raise ChunkedGenerationError(-1, -1, f"invalid sample rate {sample_rate}")
    return np.clip(arr, -1.0, 1.0)


def concatenate_wavs(
    wavs: Sequence[np.ndarray],
    sample_rate: int,
    pause_ms: int,
) -> np.ndarray:
    """Order-preserving concatenation with a fixed pause between chunks.

    All chunks share the engine's sample rate by construction; speed change is
    applied exactly once by the caller, never here."""
    if not wavs:
        raise ChunkedGenerationError(-1, -1, "no waveforms to concatenate")
    if len(wavs) == 1:
        return wavs[0]
    pause = np.zeros(max(0, int(sample_rate * pause_ms / 1000)), dtype=np.float32)
    pieces: List[np.ndarray] = []
    for index, wav in enumerate(wavs):
        if index:
            pieces.append(pause)
        pieces.append(wav)
    return np.concatenate(pieces) if pieces else np.zeros(0, dtype=np.float32)


def generate_chunked(
    text: str,
    synthesize_one: Callable[[str], Tuple[Any, int]],
    policy: Optional[ChunkPolicy] = None,
    engine: str = "",
    work_dir: Optional[Path] = None,
    task_id: str = "",
    cancel_check: Optional[Callable[[], bool]] = None,
    on_chunk: Optional[Callable[[ChunkRecord], None]] = None,
) -> ChunkedResult:
    """Serial chunked generation with bounded retries and a task deadline.

    synthesize_one(chunk_text) -> (wav_float32, sample_rate): the engine's
    native single-shot generation. Every attempt (including upstream internal
    retries) counts against policy.max_attempts for the chunk. A cancelled or
    failed task raises; nothing partial is returned.
    """
    resolved = (policy or default_policy(engine)).normalized()
    started = time.monotonic()
    chunks: List[TextChunk] = split_text(text, resolved)
    if not chunks:
        raise ChunkedGenerationError(-1, -1, "empty input text")

    wavs: List[np.ndarray] = []
    records: List[ChunkRecord] = []
    sample_rate = 0
    for chunk in chunks:
        if cancel_check is not None and cancel_check():
            raise ChunkedGenerationCancelled(
                f"cancelled before chunk {chunk.index + 1}/{len(chunks)}"
            )
        if resolved.total_deadline_s > 0:
            elapsed = time.monotonic() - started
            if elapsed > resolved.total_deadline_s:
                raise ChunkedGenerationError(
                    chunk.index,
                    len(chunks),
                    f"total deadline {resolved.total_deadline_s}s exhausted",
                )

        last_error = ""
        wav: Optional[np.ndarray] = None
        chunk_started = time.monotonic()
        attempt = 0
        for attempt in range(1, resolved.max_attempts + 1):
            try:
                raw_wav, raw_rate = synthesize_one(chunk.text)
                wav = validate_wav(raw_wav, raw_rate)
                if sample_rate and int(raw_rate) != sample_rate:
                    raise ChunkedGenerationError(
                        chunk.index,
                        len(chunks),
                        f"sample rate changed mid-task ({raw_rate} != {sample_rate})",
                    )
                sample_rate = int(raw_rate)
                last_error = ""
                break
            except ChunkedGenerationError:
                raise
            except Exception as exc:  # per-attempt failure; bounded retry
                last_error = str(exc)
        if wav is None:
            raise ChunkedGenerationError(
                chunk.index,
                len(chunks),
                last_error or f"exhausted {resolved.max_attempts} attempts",
            )

        if work_dir is not None:
            try:
                chunk_path = Path(work_dir) / f"chunk_{chunk.index:05d}.npy"
                np.save(str(chunk_path), wav)
            except Exception:
                pass
        record = ChunkRecord(
            index=chunk.index,
            chars=len(chunk.text),
            attempts=attempt,
            seconds=time.monotonic() - chunk_started,
        )
        records.append(record)
        if on_chunk is not None:
            on_chunk(record)
        wavs.append(wav)

    combined = concatenate_wavs(wavs, sample_rate, resolved.pause_ms)
    duration_s = float(combined.size) / float(sample_rate) if sample_rate else 0.0
    return ChunkedResult(
        wav=combined,
        sample_rate=sample_rate,
        chunk_count=len(chunks),
        chunked=len(chunks) > 1,
        duration_s=duration_s,
        seconds=time.monotonic() - started,
        records=records,
    )


def write_wav_float32(path: Path, wav: np.ndarray, sample_rate: int) -> None:
    """Dependency-light WAV writer (16-bit PCM mono)."""
    import wave

    arr = np.clip(np.asarray(wav, dtype=np.float32).reshape(-1), -1.0, 1.0)
    pcm16 = (arr * 32767.0).astype("<i2")
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path), "wb") as handle:
        handle.setnchannels(1)
        handle.setsampwidth(2)
        handle.setframerate(int(sample_rate))
        handle.writeframes(pcm16.tobytes())


__all__ = [
    "ChunkedGenerationCancelled",
    "ChunkedGenerationError",
    "ChunkedResult",
    "ChunkRecord",
    "concatenate_wavs",
    "generate_chunked",
    "validate_wav",
    "write_wav_float32",
]
