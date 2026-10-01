# -*- coding: utf-8 -*-
"""ChatTTS batch word synthesis (strategy 4: merged request + silence split).

ChatTTS natively batches a LIST of texts in its Python API (``chat.infer(texts)``,
see the official README), but pycore talks to the official OpenAI-compatible
HTTP server (``examples/api/openai_api.py``), which accepts one ``input`` per
request. A group of words is therefore merged into one ``/v1/audio/speech``
call (requesting wav so the merged audio is losslessly splitable), split back
into per-word mp3 files with the shared silence splitter, with serial per-word
synthesis on a segment mismatch.
"""

from pathlib import Path
from typing import List, Optional, Sequence

from pycore.pyutils.tts.batch import batch_common
from pycore.pyutils.tts.batch.batch_common import BatchItem, BatchResult
from pycore.pyutils.tts.chattts_engine import chattts_engine
from pycore.pyutils.tts.tts_http import tts_post


def _post_merged_wav(merged_text: str, lang: str, speed: float, out_wav: Path) -> bool:
    del lang
    payload = dict(chattts_engine.speech_payload(merged_text, speed), response_format="wav")
    reply = tts_post(f"{chattts_engine.base_url()}/v1/audio/speech", json_body=payload)
    if not reply.ok:
        return chattts_engine.fail(reply.error or "merged synthesis failed")
    out_wav.write_bytes(reply.content)
    return True


def _synthesize_group(
    group: Sequence[str], lang: str, out_dir: Path, start_index: int, speed: float, result: BatchResult,
) -> List[BatchItem]:
    return batch_common.merged_http_batch(
        chattts_engine, _post_merged_wav, group, lang, out_dir, start_index, speed, result,
    )


def synthesize_words(
    words: Sequence[str],
    lang: str = "en",
    out_dir: Optional[Path] = None,
    speed: float = 1.0,
) -> BatchResult:
    """Batch-synthesize words to per-word mp3 files in out_dir."""
    return batch_common.run_synthesize_words(
        chattts_engine, words, lang, out_dir, speed, chattts_engine.healthy, _synthesize_group,
    )


__all__ = ["synthesize_words"]
