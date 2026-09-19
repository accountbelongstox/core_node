# -*- coding: utf-8 -*-
"""GPT-SoVITS batch word synthesis (strategy 2: single-request parallel_infer).

The official api_v2 server batches and parallelizes the INTERNAL fragments of
one text (``parallel_infer=True`` + ``batch_size`` + ``split_bucket``) but
accepts only one text per request. This library therefore submits a group of
words as one merged text — the server splits it into per-word fragments and
runs them through its internal parallel/batch pipeline — then splits the merged
wav back into per-word mp3 files with the shared silence splitter
(``fragment_interval`` is raised above the api_v2 default so the boundaries are
detectable). Fallback: serial per-word synthesis.

Standalone:
  python -m pycore.pyutils.tts.batch.gptsovits_batch words.txt --lang zh
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
import pycore.pyutils.tts.gptsovits_engine as gptsovits_engine
from pycore.pyutils.tts.batch import batch_common
from pycore.pyutils.tts.batch import batch_constants as const
from pycore.pyutils.tts.batch.batch_common import BatchItem, BatchResult

_ENGINE = "gptsovits"
_REQUEST_TIMEOUT_S = 300
_LANG_MAP = {"en": "en", "zh": "zh", "ja": "ja", "ko": "ko", "yue": "yue"}


def _post_merged_wav(merged_text: str, text_lang: str, ref: Path, speed: float, out_wav: Path) -> bool:
    """POST one merged text to /tts with internal parallel fragment batching."""
    prompt_lang = (os.environ.get("GPTSOVITS_PROMPT_LANG") or text_lang).strip()
    body = {
        "text": merged_text,
        "text_lang": text_lang,
        "ref_audio_path": str(ref),
        "prompt_text": os.environ.get("GPTSOVITS_PROMPT_TEXT", ""),
        "prompt_lang": prompt_lang,
        "text_split_method": "cut5",
        "batch_size": const.gptsovits_batch_size(),
        "batch_threshold": 0.75,
        "split_bucket": True,
        "parallel_infer": True,
        "fragment_interval": const.GPTSOVITS_FRAGMENT_INTERVAL_S,
        "speed_factor": float(speed),
        "media_type": "wav",
        "streaming_mode": False,
    }
    requests = get_third_package_requests()
    if requests is None:
        return False
    try:
        resp = http_progress_client.post(
            f"{gptsovits_engine.base_url()}/tts",
            json=body,
            timeout=_REQUEST_TIMEOUT_S,
        )
        if resp.status_code != 200 or not resp.content:
            ColorPrint.red(
                f"[gptsovits-batch] /tts HTTP {resp.status_code}: {resp.text[:160]}"
            )
            return False
        out_wav.parent.mkdir(parents=True, exist_ok=True)
        out_wav.write_bytes(resp.content)
        return True
    except Exception as exc:  # noqa: BLE001
        ColorPrint.red(f"[gptsovits-batch] merged synth failed: {exc}")
        return False


def _synthesize_group(
    group: Sequence[str],
    lang: str,
    out_dir: Path,
    start_index: int,
    speed: float,
    ref: Path,
    result: BatchResult,
) -> List[BatchItem]:
    text_lang = _LANG_MAP.get((lang or "en").lower(), "en")
    merged = batch_common.merge_words(group, lang)
    fd, tmp_name = tempfile.mkstemp(suffix=".gsv_batch.wav", dir=str(TMP_DIR))
    os.close(fd)
    tmp_wav = Path(tmp_name)
    try:
        if _post_merged_wav(merged, text_lang, ref, speed, tmp_wav):
            samples, sample_rate = batch_common.read_wav_samples(tmp_wav)
            if samples is not None:
                ranges = batch_common.split_merged_samples(samples, sample_rate, len(group))
                if ranges is not None:
                    result.merged_used = True
                    return batch_common.write_segments_mp3(
                        samples, sample_rate, ranges, group, out_dir, start_index
                    )
        result.fallback_used = True
        return batch_common.serial_fallback(
            gptsovits_engine.synthesize, group, lang, out_dir, start_index, speed
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
    ref = gptsovits_engine._ref_audio()
    if ref is None or not gptsovits_engine.available():
        ColorPrint.yellow("[gptsovits-batch] engine unavailable (ref audio or server)")
        result.elapsed_ms = int((time.time() - began) * 1000)
        return result

    index = 0
    for group in batch_common.group_words(words):
        result.items.extend(
            _synthesize_group(group, lang, target_dir, index, speed, ref, result)
        )
        index += len(group)
    result.elapsed_ms = int((time.time() - began) * 1000)
    ColorPrint.green(
        f"[gptsovits-batch] {sum(1 for i in result.items if i.ok)}/{len(result.items)} "
        f"words ok in {result.elapsed_ms}ms (merged={result.merged_used}, "
        f"fallback={result.fallback_used})"
    )
    return result


if __name__ == "__main__":
    batch_common.run_batch_cli(_ENGINE, synthesize_words)


__all__ = ["synthesize_words"]
