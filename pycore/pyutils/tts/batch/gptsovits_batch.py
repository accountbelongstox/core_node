# -*- coding: utf-8 -*-
"""GPT-SoVITS batch word synthesis (strategy 2: single-request parallel_infer).

The official api_v2 server batches and parallelizes the INTERNAL fragments of
one text (``parallel_infer=True`` + ``batch_size`` + ``split_bucket``) but
accepts only one text per request. A group of words is therefore submitted as
one merged text - the server splits it into per-word fragments and runs them
through its internal parallel/batch pipeline - and the merged wav is split back
into per-word mp3 files with the shared silence splitter (``fragment_interval``
is raised above the api_v2 default so the boundaries are detectable).
Fallback: serial per-word synthesis.
"""

from pathlib import Path
from typing import List, Optional, Sequence

from pycore.pyutils.tts.batch import batch_common
from pycore.pyutils.tts.batch import batch_constants as const
from pycore.pyutils.tts.batch.batch_common import BatchItem, BatchResult
from pycore.pyutils.tts.gptsovits_engine import gptsovits_engine
from pycore.pyutils.tts.tts_http import tts_post


def _post_merged_wav(merged_text: str, lang: str, speed: float, out_wav: Path) -> bool:
    payload = dict(
        gptsovits_engine.tts_payload(merged_text, gptsovits_engine.text_lang(lang), speed),
        text_split_method="cut5",
        batch_size=const.gptsovits_batch_size(),
        batch_threshold=0.75,
        split_bucket=True,
        parallel_infer=True,
        fragment_interval=const.GPTSOVITS_FRAGMENT_INTERVAL_S,
    )
    reply = tts_post(f"{gptsovits_engine.base_url()}/tts", json_body=payload)
    if not reply.ok:
        return gptsovits_engine.fail(reply.error or "merged synthesis failed")
    out_wav.write_bytes(reply.content)
    return True


def _synthesize_group(
    group: Sequence[str], lang: str, out_dir: Path, start_index: int, speed: float, result: BatchResult,
) -> List[BatchItem]:
    return batch_common.merged_http_batch(
        gptsovits_engine, _post_merged_wav, group, lang, out_dir, start_index, speed, result,
    )


def synthesize_words(
    words: Sequence[str],
    lang: str = "en",
    out_dir: Optional[Path] = None,
    speed: float = 1.0,
) -> BatchResult:
    """Batch-synthesize words to per-word mp3 files in out_dir."""
    return batch_common.run_synthesize_words(
        gptsovits_engine, words, lang, out_dir, speed, gptsovits_engine.available, _synthesize_group,
    )


__all__ = ["synthesize_words"]
