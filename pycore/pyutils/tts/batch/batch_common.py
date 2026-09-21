# -*- coding: utf-8 -*-
"""Shared base for the TTS batch libraries.

Holds the batch result model, the merge-words helper, the numpy silence
splitter used by every merge-then-split strategy, and the standalone CLI
runner so each library starts on its own via ``python -m ...``.
"""

import argparse
import json
import re
import sys
import time
import wave
from concurrent.futures import ThreadPoolExecutor
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Sequence, Tuple

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.third_party.api import get_third_package_numpy
from pycore.pyutils.tts.audio_utils import samples_to_mp3, wav_to_mp3
from pycore.pyutils.tts.batch import batch_constants as const


@dataclass
class BatchItem:
    index: int
    text: str
    output_path: str
    ok: bool = False
    duration_ms: int = 0
    error: str = ""


@dataclass
class BatchResult:
    engine: str
    items: List[BatchItem] = field(default_factory=list)
    merged_used: bool = False
    fallback_used: bool = False
    elapsed_ms: int = 0

    def summary(self) -> Dict[str, Any]:
        ok_count = sum(1 for item in self.items if item.ok)
        return {
            "engine": self.engine,
            "total": len(self.items),
            "ok": ok_count,
            "failed": len(self.items) - ok_count,
            "merged_used": self.merged_used,
            "fallback_used": self.fallback_used,
            "elapsed_ms": self.elapsed_ms,
            "items": [asdict(item) for item in self.items],
        }


def merge_words(words: Sequence[str], lang: str) -> str:
    """Join words into one synthesis text with the shared separator."""
    return const.merge_separator(lang).join(w.strip() for w in words if w.strip())


def group_words(words: Sequence[str], size: Optional[int] = None) -> List[List[str]]:
    """Split the word list into merged-synthesis groups."""
    step = size or const.group_size()
    cleaned = [w.strip() for w in words if w and w.strip()]
    return [cleaned[i:i + step] for i in range(0, len(cleaned), step)]


def safe_name(index: int, word: str) -> str:
    """Filesystem-safe per-word file stem; index prefix keeps it unique."""
    cleaned = re.sub(r"[^A-Za-z0-9_-]+", "_", (word or "").strip())[:48] or "word"
    return f"{index:04d}_{cleaned}"


def read_wav_samples(wav_path: Path) -> Tuple[Optional[Any], int]:
    """Read a mono/stereo PCM wav into (float32 mono samples, sample_rate)."""
    np = get_third_package_numpy()
    if np is None:
        ColorPrint.red("[tts.batch] numpy unavailable; cannot split audio")
        return None, 0
    try:
        with wave.open(str(wav_path), "rb") as handle:
            channels = handle.getnchannels()
            width = handle.getsampwidth()
            rate = handle.getframerate()
            raw = handle.readframes(handle.getnframes())
        if width == 2:
            arr = np.frombuffer(raw, dtype="<i2").astype(np.float32) / 32767.0
        elif width == 4:
            arr = np.frombuffer(raw, dtype="<i4").astype(np.float32) / 2147483647.0
        elif width == 1:
            arr = (np.frombuffer(raw, dtype=np.uint8).astype(np.float32) - 128.0) / 128.0
        else:
            ColorPrint.red(f"[tts.batch] unsupported wav sample width: {width}")
            return None, 0
        if channels > 1:
            arr = arr.reshape(-1, channels).mean(axis=1)
        return arr, int(rate)
    except Exception as exc:  # noqa: BLE001
        ColorPrint.red(f"[tts.batch] read wav failed ({wav_path}): {exc}")
        return None, 0


def _rms_frames(samples: Any, sample_rate: int) -> Optional[Tuple[Any, Any, int]]:
    """Windowed RMS over the clip -> (float32 samples, per-window rms, window)."""
    np = get_third_package_numpy()
    if np is None:
        return None
    arr = np.asarray(samples, dtype=np.float32)
    if arr.size == 0 or sample_rate <= 0:
        return None
    window = max(1, int(sample_rate * const.WINDOW_MS / 1000))
    frame_count = arr.size // window
    if frame_count == 0:
        return None
    trimmed = arr[: frame_count * window].reshape(frame_count, window)
    rms = np.sqrt(np.mean(trimmed * trimmed, axis=1))
    if float(rms.max()) <= 0:
        return None
    return arr, rms, window


def _silent_runs(silent: Any) -> List[Tuple[int, int]]:
    """Maximal runs of silent frames as (start_frame, end_frame_exclusive)."""
    runs: List[Tuple[int, int]] = []
    start: Optional[int] = None
    for frame in range(len(silent)):
        if silent[frame]:
            if start is None:
                start = frame
        elif start is not None:
            runs.append((start, frame))
            start = None
    if start is not None:
        runs.append((start, len(silent)))
    return runs


def _trim_ranges(
    arr: Any,
    silent: Any,
    window: int,
    ranges: List[Tuple[int, int]],
) -> List[Tuple[int, int]]:
    """Trim silent edges off each sample range, then apply SEGMENT_PAD_MS."""
    pad = int(round((const.SEGMENT_PAD_MS / const.WINDOW_MS)))
    trimmed: List[Tuple[int, int]] = []
    for lo, hi in ranges:
        f_lo = min(len(silent), max(0, lo // window))
        f_hi = min(len(silent), max(0, (hi + window - 1) // window))
        while f_lo < f_hi and silent[f_lo]:
            f_lo += 1
        while f_hi > f_lo and silent[f_hi - 1]:
            f_hi -= 1
        if f_hi <= f_lo:
            continue
        trimmed.append((
            max(0, (f_lo - pad) * window),
            min(arr.size, (f_hi + pad) * window),
        ))
    return trimmed


def split_samples_top_silence(
    samples: Any,
    sample_rate: int,
    expected_count: int,
) -> Optional[List[Tuple[int, int]]]:
    """Split merged audio at the (expected_count - 1) LONGEST interior silence
    runs. Pause length varies widely across engines/reading speed, so ranking
    silences instead of applying a fixed duration threshold is what makes
    merge-then-split deterministic. Returns None when there are not enough
    interior runs — callers then fall back to serial per-word synthesis."""
    frames = _rms_frames(samples, sample_rate)
    if frames is None or expected_count <= 0:
        return None
    arr, rms, window = frames
    if expected_count == 1:
        return [(0, arr.size)]
    # Loose threshold: candidate pauses are anything clearly below speech level.
    silent = rms < float(rms.max()) * (const.SILENCE_THRESHOLD_RATIO * 2.5)
    runs = _silent_runs(silent)
    interior = [
        run for run in runs
        if run[0] > 0 and run[1] < len(silent) and run[1] - run[0] >= 1
    ]
    needed = expected_count - 1
    if len(interior) < needed:
        ColorPrint.yellow(
            f"[tts.batch] top-silence split found {len(interior)} interior pauses, "
            f"need {needed}; falling back"
        )
        return None
    chosen = sorted(interior, key=lambda run: run[1] - run[0], reverse=True)[:needed]
    cuts = sorted((run[0] + run[1]) // 2 for run in chosen)
    bounds = [0] + [cut * window for cut in cuts] + [arr.size]
    ranges = [(bounds[i], bounds[i + 1]) for i in range(len(bounds) - 1)]
    trimmed = _trim_ranges(arr, silent, window, ranges)
    if len(trimmed) != expected_count:
        ColorPrint.yellow(
            f"[tts.batch] top-silence split kept {len(trimmed)} segments, "
            f"expected {expected_count}; falling back"
        )
        return None
    return trimmed


def split_merged_samples(
    samples: Any,
    sample_rate: int,
    expected_count: int,
) -> Optional[List[Tuple[int, int]]]:
    """Primary splitter for merge-then-split libraries: adaptive top-silence
    split first, fixed-threshold scan second, None (serial fallback) last."""
    ranges = split_samples_top_silence(samples, sample_rate, expected_count)
    if ranges is not None:
        return ranges
    return split_samples_by_silence(samples, sample_rate, expected_count)


def split_samples_by_silence(
    samples: Any,
    sample_rate: int,
    expected_count: int,
) -> Optional[List[Tuple[int, int]]]:
    """Locate speech segments in merged audio via windowed RMS silence scan.

    Returns ``expected_count`` (start, end) sample ranges, or None when the
    detected segment count does not match — callers then fall back to serial
    per-word synthesis.
    """
    np = get_third_package_numpy()
    if np is None or expected_count <= 0:
        return None
    arr = np.asarray(samples, dtype=np.float32)
    if arr.size == 0 or sample_rate <= 0:
        return None
    window = max(1, int(sample_rate * const.WINDOW_MS / 1000))
    frame_count = arr.size // window
    if frame_count == 0:
        return None
    trimmed = arr[: frame_count * window].reshape(frame_count, window)
    rms = np.sqrt(np.mean(trimmed * trimmed, axis=1))
    peak = float(rms.max())
    if peak <= 0:
        return None
    silent = rms < peak * const.SILENCE_THRESHOLD_RATIO

    min_silence_frames = max(1, const.MIN_SILENCE_MS // const.WINDOW_MS)
    min_segment_frames = max(1, const.MIN_SEGMENT_MS // const.WINDOW_MS)

    segments: List[Tuple[int, int]] = []
    start: Optional[int] = None
    silence_run = 0
    for frame in range(frame_count):
        if silent[frame]:
            silence_run += 1
            if start is not None and silence_run >= min_silence_frames:
                end = frame - silence_run + 1
                if end > start:
                    segments.append((start, end))
                start = None
        else:
            silence_run = 0
            if start is None:
                start = frame
    if start is not None:
        segments.append((start, frame_count))

    segments = [seg for seg in segments if seg[1] - seg[0] >= min_segment_frames]
    if len(segments) != expected_count:
        ColorPrint.yellow(
            f"[tts.batch] silence split found {len(segments)} segments, "
            f"expected {expected_count}; falling back"
        )
        return None

    pad = int(sample_rate * const.SEGMENT_PAD_MS / 1000)
    ranges: List[Tuple[int, int]] = []
    for seg_start, seg_end in segments:
        lo = max(0, seg_start * window - pad)
        hi = min(arr.size, seg_end * window + pad)
        ranges.append((lo, hi))
    return ranges


def plausible_ranges(
    ranges: Sequence[Tuple[int, int]],
    sample_rate: int,
) -> bool:
    """Sanity-check split segments: spoken word durations in a merged reading
    are roughly uniform, so any segment far shorter than the longest one means
    the cut points landed mid-word (truncated audio). False -> serial fallback."""
    if not ranges or sample_rate <= 0:
        return False
    durations = [(hi - lo) / sample_rate for lo, hi in ranges]
    longest = max(durations)
    if longest <= 0:
        return False
    floor = max(const.MIN_SEGMENT_MS / 1000.0, longest * 0.45)
    return all(duration >= floor for duration in durations)


def write_segments_mp3(
    samples: Any,
    sample_rate: int,
    ranges: Sequence[Tuple[int, int]],
    words: Sequence[str],
    out_dir: Path,
    start_index: int = 0,
) -> List[BatchItem]:
    """Write each (start, end) sample range as one mp3 per word."""
    items: List[BatchItem] = []
    for offset, (word, (lo, hi)) in enumerate(zip(words, ranges)):
        index = start_index + offset
        mp3_path = out_dir / f"{safe_name(index, word)}.mp3"
        item = BatchItem(index=index, text=word, output_path=str(mp3_path))
        began = time.time()
        try:
            segment = samples[lo:hi]
            item.ok = bool(samples_to_mp3(segment, sample_rate, mp3_path))
            if not item.ok:
                item.error = "mp3 encode failed"
        except Exception as exc:  # noqa: BLE001
            item.error = str(exc)
        item.duration_ms = int((time.time() - began) * 1000)
        items.append(item)
    return items


def write_word_samples_mp3(
    samples_list: Sequence[Any],
    sample_rate: int,
    words: Sequence[str],
    out_dir: Path,
    start_index: int = 0,
    workers: int = 4,
) -> List[BatchItem]:
    """Encode one ready-made sample array per word, in parallel.

    ffmpeg startup dominates per-word encode time on short clips; the encodes
    are independent processes, so a small thread pool overlaps them."""
    def encode_one(offset: int, word: str, segment: Any) -> BatchItem:
        index = start_index + offset
        mp3_path = out_dir / f"{safe_name(index, word)}.mp3"
        item = BatchItem(index=index, text=word, output_path=str(mp3_path))
        began = time.time()
        try:
            item.ok = bool(samples_to_mp3(segment, sample_rate, mp3_path))
            if not item.ok:
                item.error = "mp3 encode failed"
        except Exception as exc:  # noqa: BLE001
            item.error = str(exc)
        item.duration_ms = int((time.time() - began) * 1000)
        return item

    with ThreadPoolExecutor(max_workers=max(1, workers)) as pool:
        futures = [
            pool.submit(encode_one, offset, word, segment)
            for offset, (word, segment) in enumerate(zip(words, samples_list))
        ]
        return [future.result() for future in futures]


def convert_wav_items_mp3(
    wav_paths: Sequence[Path],
    words: Sequence[str],
    out_dir: Path,
    start_index: int = 0,
) -> List[BatchItem]:
    """Convert one wav per word into the output dir as mp3 (and remove the wav)."""
    items: List[BatchItem] = []
    for offset, (word, wav_path) in enumerate(zip(words, wav_paths)):
        index = start_index + offset
        mp3_path = out_dir / f"{safe_name(index, word)}.mp3"
        item = BatchItem(index=index, text=word, output_path=str(mp3_path))
        began = time.time()
        try:
            if wav_path.exists() and wav_path.stat().st_size > 0:
                item.ok = bool(wav_to_mp3(wav_path, mp3_path))
                if not item.ok:
                    item.error = "wav->mp3 conversion failed"
            else:
                item.error = "wav output missing"
        except Exception as exc:  # noqa: BLE001
            item.error = str(exc)
        finally:
            try:
                wav_path.unlink()
            except OSError:
                pass
        item.duration_ms = int((time.time() - began) * 1000)
        items.append(item)
    return items


def serial_fallback(
    synthesize_fn: Callable[[str, str, Path], bool],
    words: Sequence[str],
    lang: str,
    out_dir: Path,
    start_index: int = 0,
    speed: float = 1.0,
) -> List[BatchItem]:
    """Per-word serial synthesis fallback shared by every batch library."""
    items: List[BatchItem] = []
    for offset, word in enumerate(words):
        index = start_index + offset
        mp3_path = out_dir / f"{safe_name(index, word)}.mp3"
        item = BatchItem(index=index, text=word, output_path=str(mp3_path))
        began = time.time()
        try:
            item.ok = bool(synthesize_fn(word, lang, mp3_path, speed))
            if not item.ok:
                item.error = "serial synthesis failed"
        except Exception as exc:  # noqa: BLE001
            item.error = str(exc)
        item.duration_ms = int((time.time() - began) * 1000)
        items.append(item)
    return items


def run_batch_cli(
    engine: str,
    synthesize_words: Callable[[List[str], str, Path], BatchResult],
) -> None:
    """Standalone entry: ``python -m pycore.pyutils.tts.batch.<engine>_batch``."""
    parser = argparse.ArgumentParser(
        description=f"{engine} batch word synthesis (merge + split / native batch)"
    )
    parser.add_argument("words_file", nargs="?", help="Text file with one word per line")
    parser.add_argument("--words", nargs="*", default=None, help="Words inline")
    parser.add_argument("--lang", default="en", help="Language code (default: en)")
    parser.add_argument(
        "--out-dir",
        default=str(const.engine_output_dir(engine)),
        help="Output directory (default: shared batch cache dir for the engine)",
    )
    args = parser.parse_args()

    words: List[str] = []
    if args.words:
        words = [w.strip() for w in args.words if w.strip()]
    elif args.words_file:
        words = [
            line.strip()
            for line in Path(args.words_file).read_text(encoding="utf-8").splitlines()
            if line.strip()
        ]
    if not words:
        parser.error("provide a words_file or --words")

    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    result = synthesize_words(words, args.lang, out_dir)
    print(json.dumps(result.summary(), ensure_ascii=False, indent=2))
    sys.exit(0 if all(item.ok for item in result.items) else 1)


__all__ = [
    "BatchItem",
    "BatchResult",
    "merge_words",
    "group_words",
    "safe_name",
    "read_wav_samples",
    "split_samples_by_silence",
    "split_samples_top_silence",
    "split_merged_samples",
    "plausible_ranges",
    "write_segments_mp3",
    "write_word_samples_mp3",
    "convert_wav_items_mp3",
    "serial_fallback",
    "run_batch_cli",
]
