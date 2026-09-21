# -*- coding: utf-8 -*-
"""Client-side protective chunking for HTTP TTS engines (main process).

Loads the shared split algorithm (pycore/tts_install_assets/tts_text_chunking.py)
BY PATH - the same single source the standalone api servers use - and applies it
as a guard for native-owner servers (cosyvoice, gptsovits): the server keeps its
native sentence splitting; the client only pre-splits inputs whose merged text
would exceed the hard character cap, POSTs each chunk, and concatenates the PCM
responses in order with the policy pause.

Concatenation is pure stdlib (wave module) at the PCM-frame level - no numpy in
the main process and no transcoding: chunk responses must be uncompressed PCM
wav with identical parameters, otherwise the task fails with a clear reason
(never a silent format conversion).
"""

import importlib.util
import sys
import wave
from pathlib import Path
from typing import Any, Callable, Dict, Optional, Tuple

_CHUNKING_PATH = (
    Path(__file__).resolve().parents[2] / "tts_install_assets" / "tts_text_chunking.py"
)
_chunking_module: Any = None


def _chunking() -> Any:
    """Load tts_text_chunking.py by path (cached)."""
    global _chunking_module
    if _chunking_module is None:
        spec = importlib.util.spec_from_file_location(
            "tts_text_chunking", str(_CHUNKING_PATH)
        )
        if spec is None or spec.loader is None:
            raise RuntimeError(f"cannot load {_CHUNKING_PATH}")
        module = importlib.util.module_from_spec(spec)
        sys.modules[spec.name] = module
        spec.loader.exec_module(module)
        _chunking_module = module
    return _chunking_module


def guard_policy(engine: str) -> Any:
    """Protective policy for a native-owner engine: merge cap == hard cap, so
    splitting only triggers for over-long inputs; normal texts pass through as
    ONE chunk (native server behavior unchanged)."""
    chunking = _chunking()
    base = chunking.default_policy(engine)
    return chunking.ChunkPolicy(
        owner="native",
        soft_limit=base.hard_limit,
        hard_limit=base.hard_limit,
        max_chunks=base.max_chunks,
        pause_ms=base.pause_ms,
    )


def _read_wav(path: Path) -> Tuple[bytes, Tuple[int, int, int]]:
    """Return (frames, (channels, sampwidth, framerate)) for an uncompressed
    PCM wav; raises ValueError otherwise."""
    with wave.open(str(path), "rb") as handle:
        params = (handle.getnchannels(), handle.getsampwidth(), handle.getframerate())
        if handle.getcomptype() != "NONE":
            raise ValueError(f"compressed wav ({handle.getcomptype()}) not supported")
        if params[0] <= 0 or params[1] <= 0 or params[2] <= 0:
            raise ValueError(f"invalid wav params {params}")
        return handle.readframes(handle.getnframes()), params


def _write_wav(path: Path, frames: bytes, params: Tuple[int, int, int]) -> None:
    channels, sampwidth, framerate = params
    path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path), "wb") as handle:
        handle.setnchannels(channels)
        handle.setsampwidth(sampwidth)
        handle.setframerate(framerate)
        handle.writeframes(frames)


def synthesize_chunked(
    engine: str,
    text: str,
    synthesize_one: Callable[[str, Path], bool],
    output_wav: Path,
    *,
    pause_ms: Optional[int] = None,
) -> Tuple[bool, Optional[str], Dict[str, Any]]:
    """Guarded chunked synthesis onto a wav file.

    synthesize_one(chunk_text, chunk_wav_path) -> bool must POST one chunk and
    write the response as an uncompressed PCM wav. Single-chunk inputs call it
    exactly once straight onto output_wav (legacy behavior). Returns
    (ok, error, stats); a failed chunk fails the whole task - no partial audio
    is published.
    """
    stats: Dict[str, Any] = {"engine": engine, "chunked": False, "chunk_count": 0}
    cleaned = (text or "").strip()
    if not cleaned:
        return False, "empty text", stats
    chunking = _chunking()
    policy = guard_policy(engine)
    try:
        chunks = chunking.split_text(cleaned, policy)
    except Exception as exc:  # noqa: BLE001
        return False, f"split failed: {exc}", stats
    if not chunks:
        return False, "empty text", stats

    output_wav = Path(output_wav)
    stats["chunk_count"] = len(chunks)
    if len(chunks) == 1:
        if synthesize_one(chunks[0].text, output_wav):
            return True, None, stats
        return False, "synthesis failed", stats

    stats["chunked"] = True
    work_dir = output_wav.parent / f"{output_wav.stem}.chunks"
    work_dir.mkdir(parents=True, exist_ok=True)
    chunk_paths = [work_dir / f"chunk_{chunk.index:05d}.wav" for chunk in chunks]
    try:
        for chunk, chunk_path in zip(chunks, chunk_paths):
            if not synthesize_one(chunk.text, chunk_path):
                return (
                    False,
                    f"chunk {chunk.index + 1}/{len(chunks)} failed",
                    stats,
                )
        frames_parts = []
        params: Optional[Tuple[int, int, int]] = None
        pause = int(policy.pause_ms if pause_ms is None else pause_ms)
        for index, chunk_path in enumerate(chunk_paths):
            try:
                frames, chunk_params = _read_wav(chunk_path)
            except (OSError, wave.Error, ValueError) as exc:
                return False, f"chunk {index + 1} wav unreadable: {exc}", stats
            if params is None:
                params = chunk_params
            elif chunk_params != params:
                return (
                    False,
                    f"chunk {index + 1} wav params {chunk_params} != {params}",
                    stats,
                )
            if index:
                pause_frames = params[2] * pause // 1000
                frames_parts.append(b"\x00" * pause_frames * params[0] * params[1])
            frames_parts.append(frames)
        _write_wav(output_wav, b"".join(frames_parts), params)
        return True, None, stats
    finally:
        for chunk_path in chunk_paths:
            try:
                chunk_path.unlink()
            except OSError:
                pass
        try:
            work_dir.rmdir()
        except OSError:
            pass


__all__ = ["guard_policy", "synthesize_chunked"]
