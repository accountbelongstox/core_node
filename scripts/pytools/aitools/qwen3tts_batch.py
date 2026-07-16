#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Qwen3-TTS batch / parallel generation helpers for qwen3tts_tester.py.

Official docs:
  https://qwenlm-qwen3-tts.mintlify.app/guides/batch-processing
  https://qwenlm-qwen3-tts.mintlify.app/advanced/performance

Batch inference passes lists to generate_custom_voice(..., non_streaming_mode=True).
"""

import os
import shutil
import subprocess
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

# Total VRAM (MB) per batch size — Qwen3-TTS official memory table.
_BATCH_VRAM_MB: Dict[str, Dict[int, int]] = {
    "0.6B": {1: 4096, 4: 6144, 8: 9216, 16: 14336, 32: 24576},
    "1.7B": {1: 8192, 4: 12288, 8: 18432, 16: 28672, 32: 49152},
}

_DEFAULT_RESERVE_RATIO = 0.12
_MAX_PARALLEL_CAP = 64


def detect_model_variant(model_id: str) -> str:
    """Return '0.6B' or '1.7B' from a HF id or local path."""
    token = (model_id or "").lower()
    if "0.6b" in token:
        return "0.6B"
    return "1.7B"


def query_gpu_snapshot(device_index: int = 0) -> Dict[str, Any]:
    """Best-effort GPU utilization + memory via nvidia-smi."""
    exe = shutil.which("nvidia-smi")
    if not exe:
        return {
            "available": False,
            "index": device_index,
            "name": None,
            "util_percent": None,
            "mem_used_mb": 0,
            "mem_total_mb": 0,
        }

    try:
        out = subprocess.run(
            [
                exe,
                "--query-gpu=index,name,utilization.gpu,memory.used,memory.total",
                "--format=csv,noheader,nounits",
            ],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            check=False,
        )
    except Exception:
        return {
            "available": False,
            "index": device_index,
            "name": None,
            "util_percent": None,
            "mem_used_mb": 0,
            "mem_total_mb": 0,
        }

    if out.returncode != 0:
        return {
            "available": False,
            "index": device_index,
            "name": None,
            "util_percent": None,
            "mem_used_mb": 0,
            "mem_total_mb": 0,
        }

    def _num(token: str, cast):
        token = (token or "").strip()
        if not token or token.lower() in ("n/a", "[n/a]"):
            return None
        try:
            return cast(token)
        except (ValueError, TypeError):
            return None

    rows: List[Dict[str, Any]] = []
    for line in (out.stdout or "").splitlines():
        line = line.strip()
        if not line:
            continue
        parts = [p.strip() for p in line.split(",")]
        if len(parts) < 5:
            continue
        rows.append({
            "index": _num(parts[0], int) or 0,
            "name": parts[1],
            "util_percent": _num(parts[2], float),
            "mem_used_mb": _num(parts[3], int) or 0,
            "mem_total_mb": _num(parts[4], int) or 0,
        })

    if not rows:
        return {
            "available": False,
            "index": device_index,
            "name": None,
            "util_percent": None,
            "mem_used_mb": 0,
            "mem_total_mb": 0,
        }

    picked = rows[device_index] if device_index < len(rows) else rows[0]
    return {
        "available": True,
        "index": picked["index"],
        "name": picked["name"],
        "util_percent": picked["util_percent"],
        "mem_used_mb": picked["mem_used_mb"],
        "mem_total_mb": picked["mem_total_mb"],
    }


def _load_factor(gpu_util_percent: Optional[float]) -> float:
    """Scale max parallel down when the GPU is already busy."""
    if gpu_util_percent is None:
        return 1.0
    util = float(gpu_util_percent)
    if util >= 85.0:
        return 0.25
    if util >= 65.0:
        return 0.5
    if util >= 45.0:
        return 0.75
    return 1.0


def estimate_max_parallel(
    model_variant: str,
    gpu_total_mb: int,
    gpu_used_mb: int,
    gpu_util_percent: Optional[float] = None,
    *,
    reserve_ratio: float = _DEFAULT_RESERVE_RATIO,
) -> Dict[str, Any]:
    """
    Pick a safe batch / parallel count from official VRAM tables and live GPU load.

    Uses Qwen3-TTS doc memory curves, then scales by current GPU utilization so a
    busy card keeps headroom for other workloads.
    """
    curve = _BATCH_VRAM_MB.get(model_variant) or _BATCH_VRAM_MB["1.7B"]
    total_mb = max(int(gpu_total_mb or 0), 0)
    used_mb = max(int(gpu_used_mb or 0), 0)
    reserve = max(0.0, min(float(reserve_ratio), 0.5))
    budget_total_mb = int(total_mb * (1.0 - reserve)) if total_mb > 0 else 0

    max_by_vram = 1
    for batch_size, need_mb in sorted(curve.items()):
        if need_mb <= budget_total_mb:
            max_by_vram = batch_size

    free_mb = max(0, total_mb - used_mb)
    max_by_free = 1
    base_mb = curve[1]
    if free_mb > 0 and 8 in curve:
        per_item_mb = max(256, int((curve[8] - base_mb) / 7))
        extra_slots = max(0, int((free_mb - max(0, base_mb - used_mb)) / per_item_mb))
        max_by_free = max(1, 1 + extra_slots)

    raw_cap = max(1, min(max_by_vram, max_by_free, _MAX_PARALLEL_CAP))
    factor = _load_factor(gpu_util_percent)
    adjusted = max(1, min(_MAX_PARALLEL_CAP, int(raw_cap * factor)))

    env_cap = (os.environ.get("QWEN3TTS_MAX_PARALLEL") or "").strip()
    if env_cap.isdigit():
        adjusted = max(1, min(int(env_cap), _MAX_PARALLEL_CAP))

    return {
        "max_parallel": adjusted,
        "max_by_vram": max_by_vram,
        "max_by_free": max_by_free,
        "raw_cap": raw_cap,
        "load_factor": factor,
        "gpu_util_percent": gpu_util_percent,
        "model_variant": model_variant,
        "gpu_total_mb": total_mb,
        "gpu_used_mb": used_mb,
        "budget_total_mb": budget_total_mb,
        "reserve_ratio": reserve,
    }


def _sample_texts(count: int, lang: str) -> List[str]:
    en = [
        "Hello, this is batch sample one.",
        "The weather is pleasant today.",
        "Parallel generation improves throughput.",
        "Short sentences keep the benchmark stable.",
        "Voice synthesis can run in batches.",
        "Each line becomes one audio clip.",
        "GPU memory limits the batch size.",
        "Non-streaming mode is recommended for batches.",
        "FlashAttention helps on supported GPUs.",
        "This is the tenth validation sentence.",
        "Eleven — checking list handling.",
        "Twelve — final sample in the set.",
    ]
    zh = [
        "你好，这是第一条批量合成样本。",
        "今天天气不错，适合测试语音。",
        "并行生成可以提高 GPU 利用率。",
        "短句有助于稳定基准测试。",
        "批量模式应关闭流式输出。",
        "每条文本会生成一个音频。",
        "显存决定最大并行数。",
        "官方文档支持列表输入。",
        "这是第九条中文测试句。",
        "第十条，继续验证批量接口。",
        "第十一条，检查列表长度。",
        "第十二条，批量样本结束。",
    ]
    pool = zh if (lang or "en").lower().startswith("zh") else en
    if count <= len(pool):
        return pool[:count]
    out = list(pool)
    while len(out) < count:
        out.append(pool[len(out) % len(pool)])
    return out


def _lang_map(lang: str) -> str:
    code = (lang or "en").strip().lower()[:2]
    mapping = {
        "en": "English",
        "zh": "Chinese",
        "ja": "Japanese",
        "ko": "Korean",
    }
    return mapping.get(code, "English")


def _speaker_for(lang: str) -> str:
    explicit = (os.environ.get("QWEN3TTS_SPEAKER") or "").strip()
    if explicit:
        return explicit
    code = (lang or "en").strip().lower()[:2]
    return {"en": "Ryan", "zh": "Vivian", "ja": "Ono_Anna", "ko": "Sohee"}.get(code, "Ryan")


def _resolve_device_index(device: str) -> int:
    token = (device or "cuda:0").strip().lower()
    if token == "cpu":
        return 0
    if ":" in token:
        suffix = token.rsplit(":", 1)[-1]
        if suffix.isdigit():
            return int(suffix)
    return 0


def run_batch_test(
    *,
    model_cls,
    model_id: str,
    device: str,
    dtype,
    lang: str = "en",
    batch_size: Optional[int] = None,
    item_count: Optional[int] = None,
    output_dir: Optional[Path] = None,
) -> Tuple[bool, Dict[str, Any]]:
    """
    Compare sequential single-item calls vs one official batch call.

    Returns (success, report_dict).
    """
    import soundfile as sf

    torch_mod = None
    try:
        import torch as torch_mod
    except ImportError:
        torch_mod = None

    out_dir = output_dir or (Path.cwd() / "qwen3tts_batch_out")
    out_dir.mkdir(parents=True, exist_ok=True)

    gpu_idx = _resolve_device_index(device)
    gpu_before = query_gpu_snapshot(gpu_idx)
    variant = detect_model_variant(model_id)
    plan = estimate_max_parallel(
        variant,
        gpu_before.get("mem_total_mb") or 0,
        gpu_before.get("mem_used_mb") or 0,
        gpu_before.get("util_percent"),
    )
    chosen_batch = batch_size if batch_size and batch_size > 0 else plan["max_parallel"]
    chosen_batch = max(1, min(int(chosen_batch), _MAX_PARALLEL_CAP))
    total_items = item_count if item_count and item_count > 0 else max(chosen_batch * 2, 4)
    total_items = max(total_items, chosen_batch)

    texts = _sample_texts(total_items, lang)
    qwen_lang = _lang_map(lang)
    speaker = _speaker_for(lang)
    languages = [qwen_lang] * len(texts)
    speakers = [speaker] * len(texts)

    report: Dict[str, Any] = {
        "model_id": model_id,
        "device": device,
        "model_variant": variant,
        "gpu_before": gpu_before,
        "parallel_plan": plan,
        "batch_size": chosen_batch,
        "item_count": len(texts),
        "sequential_ms": None,
        "batch_ms": None,
        "speedup": None,
        "outputs": [],
        "error": None,
    }

    print()
    print("[INFO] Qwen3-TTS batch / parallel test (official list API)")
    print(f"[INFO] Docs: https://qwenlm-qwen3-tts.mintlify.app/guides/batch-processing")
    print(f"[INFO] Model: {model_id} ({variant}) on {device}")
    if gpu_before.get("available"):
        print(
            f"[INFO] GPU: {gpu_before.get('name')} | "
            f"util={gpu_before.get('util_percent')}% | "
            f"mem={gpu_before.get('mem_used_mb')}/{gpu_before.get('mem_total_mb')} MB"
        )
    print(
        f"[INFO] Auto max parallel: {plan['max_parallel']} "
        f"(vram_cap={plan['max_by_vram']}, free_cap={plan['max_by_free']}, "
        f"load_factor={plan['load_factor']})"
    )
    print(f"[INFO] Test batch_size={chosen_batch}, items={len(texts)}")
    print()

    kwargs = {"device_map": device, "dtype": dtype}
    try:
        model = model_cls.from_pretrained(model_id, **kwargs)
    except TypeError:
        kwargs.pop("dtype", None)
        model = model_cls.from_pretrained(model_id, **kwargs)

    gpu_after_load = query_gpu_snapshot(gpu_idx)
    report["gpu_after_load"] = gpu_after_load
    if gpu_after_load.get("available"):
        plan_loaded = estimate_max_parallel(
            variant,
            gpu_after_load.get("mem_total_mb") or 0,
            gpu_after_load.get("mem_used_mb") or 0,
            gpu_after_load.get("util_percent"),
        )
        report["parallel_plan_after_load"] = plan_loaded
        if batch_size is None:
            chosen_batch = max(1, min(plan_loaded["max_parallel"], _MAX_PARALLEL_CAP))
            report["batch_size"] = chosen_batch
            print(
                f"[INFO] After model load — adjusted max parallel: "
                f"{plan_loaded['max_parallel']} (using batch_size={chosen_batch})"
            )

    if torch_mod is not None and device != "cpu" and torch_mod.cuda.is_available():
        try:
            torch_mod.cuda.synchronize()
        except Exception:
            pass

    # Warmup (single item, excluded from timing)
    print("[RUN] Warmup (1 item)...")
    model.generate_custom_voice(
        text=texts[0],
        language=qwen_lang,
        speaker=speaker,
        non_streaming_mode=True,
    )
    if torch_mod is not None and device != "cpu" and torch_mod.cuda.is_available():
        try:
            torch_mod.cuda.synchronize()
        except Exception:
            pass

    # Sequential baseline: one text per call
    print(f"[RUN] Sequential baseline ({len(texts)} calls, batch=1)...")
    t0 = time.monotonic()
    for idx, line in enumerate(texts):
        model.generate_custom_voice(
            text=line,
            language=qwen_lang,
            speaker=speaker,
            non_streaming_mode=True,
        )
    if torch_mod is not None and device != "cpu" and torch_mod.cuda.is_available():
        try:
            torch_mod.cuda.synchronize()
        except Exception:
            pass
    sequential_ms = round((time.monotonic() - t0) * 1000)
    report["sequential_ms"] = sequential_ms
    print(f"[OK] Sequential: {sequential_ms} ms ({sequential_ms / len(texts):.1f} ms/item)")

    # Official batch API: process in chunks of batch_size
    print(f"[RUN] Batch API ({len(texts)} items, chunk batch_size={chosen_batch})...")
    t1 = time.monotonic()
    batch_paths: List[str] = []
    for start in range(0, len(texts), chosen_batch):
        chunk_texts = texts[start:start + chosen_batch]
        chunk_langs = languages[start:start + chosen_batch]
        chunk_speakers = speakers[start:start + chosen_batch]
        wavs, sr = model.generate_custom_voice(
            text=chunk_texts,
            language=chunk_langs,
            speaker=chunk_speakers,
            non_streaming_mode=True,
        )
        for offset, wav in enumerate(wavs):
            idx = start + offset
            out_path = out_dir / f"batch_{idx:03d}.wav"
            sf.write(str(out_path), wav, int(sr))
            batch_paths.append(str(out_path))
    if torch_mod is not None and device != "cpu" and torch_mod.cuda.is_available():
        try:
            torch_mod.cuda.synchronize()
        except Exception:
            pass
    batch_ms = round((time.monotonic() - t1) * 1000)
    report["batch_ms"] = batch_ms
    report["outputs"] = batch_paths
    speedup = round(sequential_ms / batch_ms, 2) if batch_ms > 0 else None
    report["speedup"] = speedup

    print(f"[OK] Batch: {batch_ms} ms ({batch_ms / len(texts):.1f} ms/item)")
    if speedup is not None:
        print(f"[OK] Throughput speedup (sequential / batch): {speedup}x")
    print(f"[OK] Wrote {len(batch_paths)} wav file(s) under {out_dir}")
    print()
    print("[SUCCESS] Qwen3-TTS batch / parallel test completed")
    return True, report
