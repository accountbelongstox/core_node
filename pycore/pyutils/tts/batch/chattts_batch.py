# -*- coding: utf-8 -*-
"""ChatTTS batch word synthesis (strategy 4: merged request + silence split).

ChatTTS natively batches a LIST of texts in its Python API (``chat.infer(texts)``,
see the official README), but pycore talks to the official OpenAI-compatible
HTTP server (``examples/api/openai_api.py``), which accepts one ``input`` per
request. This library therefore merges a group of words into one
``/v1/audio/speech`` call (requesting wav so the merged audio is losslessly
splitable), splits it back into per-word mp3 files with the shared silence
splitter, and falls back to serial per-word synthesis on a segment mismatch.
A future in-venv server exposing ``chat.infer(list)`` can replace the merge
step without touching the rest of the pipeline.

Standalone:
  python -m pycore.pyutils.tts.batch.chattts_batch words.txt --lang en
"""

import os
import tempfile
import time
from pathlib import Path
from typing import List, Optional, Sequence

from pycore.pyutils.common.http_progress_upload import http_progress_client
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.pygvar import TMP_DIR
from pycore.pyfoundations.third_party.api import get_third_package_requests
import pycore.pyutils.tts.chattts_engine as chattts_engine
from pycore.pyutils.tts.batch import batch_common
from pycore.pyutils.tts.batch import batch_constants as const
from pycore.pyutils.tts.batch.batch_common import BatchItem, BatchResult

_ENGINE = "chattts"
_REQUEST_TIMEOUT_S = 300


def _post_merged_wav(merged_text: str, speed: float, out_wav: Path) -> bool:
    """POST one merged text to /v1/audio/speech requesting wav for splitting."""
    prompt = (os.environ.get("CHATTTS_PROMPT") or "").strip()
    payload_text = f"{prompt}{merged_text}" if prompt else merged_text
    body = {
        "model": "tts-1",
        "input": payload_text,
        "voice": chattts_engine._voice(),
        "response_format": "wav",
        "speed": max(0.5, min(2.0, float(speed))),
    }
    requests = get_third_package_requests()
    if requests is None:
        return False
    try:
        resp = http_progress_client.post(
            f"{chattts_engine.base_url()}/v1/audio/speech",
            json=body,
            timeout=_REQUEST_TIMEOUT_S,
        )
        if resp.status_code != 200 or not resp.content:
            ColorPrint.red(
                f"[chattts-batch] /v1/audio/speech HTTP {resp.status_code}: "
                f"{(resp.text or '')[:160]}"
            )
            return False
        out_wav.parent.mkdir(parents=True, exist_ok=True)
        out_wav.write_bytes(resp.content)
        return True
    except Exception as exc:  # noqa: BLE001
        ColorPrint.red(f"[chattts-batch] merged synth failed: {exc}")
        return False


def _synthesize_group(
    group: Sequence[str],
    lang: str,
    out_dir: Path,
    start_index: int,
    speed: float,
    result: BatchResult,
) -> List[BatchItem]:
    merged = batch_common.merge_words(group, lang)
    fd, tmp_name = tempfile.mkstemp(suffix=".chattts_batch.wav", dir=str(TMP_DIR))
    os.close(fd)
    tmp_wav = Path(tmp_name)
    try:
        if _post_merged_wav(merged, speed, tmp_wav):
            samples, sample_rate = batch_common.read_wav_samples(tmp_wav)
            if samples is not None:
                ranges = batch_common.split_merged_samples(samples, sample_rate, len(group))
                if ranges is not None and batch_common.plausible_ranges(ranges, sample_rate):
                    result.merged_used = True
                    return batch_common.write_segments_mp3(
                        samples, sample_rate, ranges, group, out_dir, start_index
                    )
        result.fallback_used = True
        return batch_common.serial_fallback(
            chattts_engine.synthesize, group, lang, out_dir, start_index, speed
        )
    finally:
        try:
            tmp_wav.unlink()
        except OSError:
            pass


def synthesize_words(
    words: Sequence[str],
    lang: str = "en",
    out_dir: Optional[Path] = None,
    speed: float = 1.0,
) -> BatchResult:
    """Batch-synthesize words to per-word mp3 files in out_dir."""
    began = time.time()
    target_dir = Path(out_dir) if out_dir else const.engine_output_dir(_ENGINE)
    target_dir.mkdir(parents=True, exist_ok=True)
    result = BatchResult(engine=_ENGINE)
    if not chattts_engine.probe_ready():
        ColorPrint.yellow("[chattts-batch] server unreachable or model not ready")
        result.elapsed_ms = int((time.time() - began) * 1000)
        return result

    index = 0
    for group in batch_common.group_words(words):
        result.items.extend(
            _synthesize_group(group, lang, target_dir, index, speed, result)
        )
        index += len(group)
    result.elapsed_ms = int((time.time() - began) * 1000)
    ColorPrint.green(
        f"[chattts-batch] {sum(1 for i in result.items if i.ok)}/{len(result.items)} "
        f"words ok in {result.elapsed_ms}ms (merged={result.merged_used}, "
        f"fallback={result.fallback_used})"
    )
    return result


if __name__ == "__main__":
    batch_common.run_batch_cli(_ENGINE, synthesize_words)


__all__ = ["synthesize_words"]
