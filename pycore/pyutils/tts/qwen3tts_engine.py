"""
Qwen3-TTS offline engine (Alibaba qwen-tts package).

Category 2 — Python 3.13 compatible with official qwen-tts wheel; avoid legacy
ComfyUI/weight-conversion scripts that pin old transformers. Official:
  https://github.com/QwenLM/Qwen3-TTS  pip install -U qwen-tts

Official perfect-support environment (see pycore/tts_install_assets/tts_model_tiers.py):
  Python 3.10+ (3.13 supported via qwen-tts); torch>=2.5; soundfile.
  GPU: Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice; CPU: Qwen/Qwen3-TTS-12Hz-0.6B-CustomVoice.

Config:
  QWEN3TTS_MODEL     - HF id or local path
  QWEN3TTS_DEVICE    - cpu | cuda:0 | auto (default auto)
  QWEN3TTS_SPEAKER   - preset speaker (default Ryan for en, Vivian for zh)
  QWEN3TTS_INSTRUCT  - optional style/emotion instruction
"""

import importlib.util
import os
import shutil
import subprocess
import threading
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.secret_manager import get_secret_key_indexed
from pycore.pyfoundations.system_paths import apply_shared_cache_env
from pycore.pyfoundations.third_party import get_third_package_torch
from pycore.pyutils.tts.audio_utils import wav_to_mp3, write_wav
from pycore.pyutils.tts.qwen3tts_weights import resolve_model_id

try:
    from qwen_tts import Qwen3TTSModel
    _QWEN_TTS_AVAILABLE = True
except Exception:
    # Any import-time failure (missing dep, partial install, init order) leaves
    # Qwen3TTSModel None; _ensure_model_class() retries lazily on first use so a
    # module-load failure doesn't permanently disable the engine (matches the
    # qwen3tts_tester lazy-import pattern).
    Qwen3TTSModel = None  # type: ignore[assignment]
    _QWEN_TTS_AVAILABLE = False




_lock = threading.Lock()
_model: Any = None
_last_synth_error: Optional[str] = None
# Whether the lazy import retry has been attempted (avoids re-running a
# persistently-failing import on every available()/synth call). Reset on
# success; one retry is enough for the init-order case the tester handles.
_import_attempted = False

_LANG_MAP = {
    "en": "English",
    "zh": "Chinese",
    "ja": "Japanese",
    "ko": "Korean",
    "de": "German",
    "fr": "French",
    "ru": "Russian",
    "pt": "Portuguese",
    "es": "Spanish",
    "it": "Italian",
}

_SPEAKER_BY_LANG = {
    "en": "Ryan",
    "zh": "Vivian",
    "ja": "Ono_Anna",
    "ko": "Sohee",
}

# Variant -> speaker map for batch multi-voice generation. Each variant is an
# accent/gender pair (from laravel tts_variant_specs); we pick a distinct qwen3tts
# preset speaker per (accent, gender) so 3 variants -> 3 different voices.
# en presets: Ryan(M), Aiden(M), Emma(F), Sophia(F).
_VARIANT_SPEAKER_EN = {
    ("us", "female"): "Emma",
    ("uk", "female"): "Sophia",
    ("us", "male"): "Ryan",
    ("uk", "male"): "Aiden",
}
# Non-English: pick by gender, cycling through the lang's presets for variety.
_SPEAKER_PRESETS = {
    "en": {"female": ["Emma", "Sophia"], "male": ["Ryan", "Aiden"]},
    "zh": {"female": ["Vivian", "Serena"], "male": ["Uncle_Fu", "Dylan"]},
    "ja": {"female": ["Ono_Anna", "Hina"], "male": ["Ono_Anna"]},
    "ko": {"female": ["Sohee"], "male": ["Hyunwoo"]},
}

# Official Qwen3-TTS VRAM (MB) per batch size - used to auto-tune max parallel.
_BATCH_VRAM_MB: Dict[str, Dict[int, int]] = {
    "0.6B": {1: 4096, 4: 6144, 8: 9216, 16: 14336, 32: 24576},
    "1.7B": {1: 8192, 4: 12288, 8: 18432, 16: 28672, 32: 49152},
}
_MAX_PARALLEL_CAP = 64
_DEFAULT_RESERVE_RATIO = 0.12


def detect_model_variant(model_id: str) -> str:
    """Return '0.6B' or '1.7B' from a HF id or local path."""
    token = (model_id or "").lower()
    if "0.6b" in token:
        return "0.6B"
    return "1.7B"


def _query_gpu_snapshot(device_index: int = 0) -> Dict[str, Any]:
    """Best-effort GPU utilization + memory via nvidia-smi (empty when unavailable)."""
    exe = shutil.which("nvidia-smi")
    base = {"available": False, "util_percent": None,
            "mem_used_mb": 0, "mem_total_mb": 0}
    if not exe:
        return base
    try:
        out = subprocess.run(
            [exe, "--query-gpu=index,name,utilization.gpu,memory.used,memory.total",
             "--format=csv,noheader,nounits"],
            capture_output=True, text=True, encoding="utf-8",
            errors="replace", check=False,
        )
    except Exception:  # noqa: BLE001
        return base
    if out.returncode != 0:
        return base
    rows: List[Dict[str, Any]] = []
    for line in (out.stdout or "").splitlines():
        parts = [p.strip() for p in line.strip().split(",") if p.strip()]
        if len(parts) < 5:
            continue

        def _num(tok: str, cast):
            try:
                return cast(tok)
            except (ValueError, TypeError):
                return None
        rows.append({
            "index": _num(parts[0], int) or 0,
            "util_percent": _num(parts[2], float),
            "mem_used_mb": _num(parts[3], int) or 0,
            "mem_total_mb": _num(parts[4], int) or 0,
        })
    if not rows:
        return base
    picked = rows[device_index] if device_index < len(rows) else rows[0]
    picked["available"] = True
    return picked


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
) -> int:
    """Safe batch count from official VRAM curves + live GPU load. Override via
    env QWEN3TTS_MAX_PARALLEL. Ported from scripts/pytools/aitools/qwen3tts_batch.py."""
    curve = _BATCH_VRAM_MB.get(model_variant) or _BATCH_VRAM_MB["1.7B"]
    total_mb = max(int(gpu_total_mb or 0), 0)
    used_mb = max(int(gpu_used_mb or 0), 0)
    budget = int(total_mb * (1.0 - _DEFAULT_RESERVE_RATIO)) if total_mb > 0 else 0
    max_by_vram = 1
    for batch_size, need_mb in sorted(curve.items()):
        if need_mb <= budget:
            max_by_vram = batch_size
    free_mb = max(0, total_mb - used_mb)
    max_by_free = 1
    base_mb = curve[1]
    if free_mb > 0 and 8 in curve:
        per_item = max(256, int((curve[8] - base_mb) / 7))
        extra = max(0, int((free_mb - max(0, base_mb - used_mb)) / per_item))
        max_by_free = max(1, 1 + extra)
    raw = max(1, min(max_by_vram, max_by_free, _MAX_PARALLEL_CAP))
    adjusted = max(1, min(_MAX_PARALLEL_CAP, int(raw * _load_factor(gpu_util_percent))))
    env_cap = (os.environ.get("QWEN3TTS_MAX_PARALLEL") or "").strip()
    if env_cap.isdigit():
        adjusted = max(1, min(int(env_cap), _MAX_PARALLEL_CAP))
    return adjusted


def _speaker_for_variant(lang: str, variant: Dict[str, Any], index: int) -> str:
    """Pick a qwen3tts preset speaker for one variant (accent/gender)."""
    explicit = (os.environ.get("QWEN3TTS_SPEAKER") or "").strip()
    if explicit:
        return explicit
    code = (lang or "en").strip().lower()[:2]
    accent = (variant.get("accent") or "").strip().lower() if variant.get("accent") else ""
    gender = (variant.get("gender") or "female").strip().lower()
    if gender not in ("female", "male"):
        gender = "female"
    if code == "en" and accent in ("us", "uk"):
        mapped = _VARIANT_SPEAKER_EN.get((accent, gender))
        if mapped:
            return mapped
    presets = _SPEAKER_PRESETS.get(code) or _SPEAKER_PRESETS["en"]
    options = presets.get(gender) or presets.get("female") or ["Ryan"]
    return options[index % len(options)]


def _device() -> str:
    want = (os.environ.get("QWEN3TTS_DEVICE") or "auto").strip() or "auto"
    if want != "auto":
        return want
    try:
        torch = get_third_package_torch()
        return "cuda:0" if torch.cuda.is_available() else "cpu"
    except ImportError:
        return "cpu"


def _model_id() -> str:
    return resolve_model_id()


def _qwen_language(lang: str) -> str:
    code = (lang or "en").strip().lower()[:2]
    return _LANG_MAP.get(code, "Auto")


def _speaker(lang: str) -> str:
    explicit = (os.environ.get("QWEN3TTS_SPEAKER") or "").strip()
    if explicit:
        return explicit
    code = (lang or "en").strip().lower()[:2]
    return _SPEAKER_BY_LANG.get(code, "Ryan")


def _ensure_model_class() -> bool:
    """Ensure ``Qwen3TTSModel`` is importable, retrying lazily ONCE on first use.

    The top-level import can fail at module load when an optional dep isn't
    initialized yet; by the time the orchestrator calls ``available()`` /
    ``_get_model()`` the runtime is ready, so retry once. A persistent failure
    is cached (``_import_attempted``) so we don't re-run a slow failing import
    on every status poll. Restart pycore to retry. Returns True when available."""
    global Qwen3TTSModel, _QWEN_TTS_AVAILABLE, _last_synth_error, _import_attempted
    if Qwen3TTSModel is not None:
        return True
    if _import_attempted:
        return False
    _import_attempted = True
    try:
        from qwen_tts import Qwen3TTSModel as _Cls  # lazy one-shot retry
    except Exception as exc:  # noqa: BLE001 - any import-time failure
        # Same actionable hint qwen3tts_tester.py's check_import() prints on a
        # failed import, so the Test button shows a fix, not a bare traceback.
        _last_synth_error = (
            f"qwen-tts import failed: {exc} "
            "[HINT] pip install -U qwen-tts (qwen-tts pins an exact transformers "
            "version; run 'pip show qwen-tts' to see it, then "
            "'pip install transformers==<that version>') "
            "[HINT] Or run Step61_InstallQwen3Tts.ps1 / 140_install_qwen3tts.sh"
        )
        _QWEN_TTS_AVAILABLE = False
        return False
    Qwen3TTSModel = _Cls
    _QWEN_TTS_AVAILABLE = True
    _import_attempted = False  # succeeded; allow future retries if unloaded
    return True


def available() -> bool:
    """Fast package-installed check (``find_spec`` only). Intentionally does NOT
    import ``qwen_tts`` - that's slow (pulls torch) and would blow the 8s
    ``local.tts.status`` WS-RPC timeout when ``tts_status()`` probes every engine.
    The actual class import + lazy retry happens in ``_get_model()`` at synth
    time; ``synthesize()`` guards ``model is None`` so a failed import never
    raises NoneType - it just falls through to the next engine."""
    try:
        return importlib.util.find_spec("qwen_tts") is not None
    except Exception:
        return False


def _dtype():
    torch = get_third_package_torch()
    dev = _device()
    if dev == "cpu":
        return torch.float32
    return torch.bfloat16


def _get_model() -> Any:
    global _model
    with _lock:
        if _model is not None:
            return _model
        try:
            apply_shared_cache_env()
        except Exception:
            pass
        # Ensure the HF token is in env (matches qwen3tts_tester.ensure_hf_token)
        # so from_pretrained can download/access the model the same way the tester does.
        try:
            token = (get_secret_key_indexed("HF_TOKEN") or "").strip()
            if token:
                os.environ.setdefault("HF_TOKEN", token)
                os.environ.setdefault("HUGGING_FACE_HUB_TOKEN", token)
        except Exception:  # noqa: BLE001 - token is best-effort
            pass
        torch = get_third_package_torch()
        if not _ensure_model_class():
            # _last_synth_error already set by _ensure_model_class().
            return None
        model_id = _model_id()
        dev = _device()
        kwargs = {
            "device_map": dev,
            "dtype": _dtype(),
        }
        try:
            _model = Qwen3TTSModel.from_pretrained(model_id, **kwargs)
        except TypeError:
            kwargs.pop("dtype", None)
            _model = Qwen3TTSModel.from_pretrained(model_id, **kwargs)
        ColorPrint.green(f"[qwen3tts] loaded {model_id} (device={dev})")
        return _model


def last_synth_error() -> Optional[str]:
    return _last_synth_error


def synthesize(text: str, lang: str, output_mp3: Path, speed: float = 1.0) -> bool:
    del speed
    global _last_synth_error
    _last_synth_error = None
    cleaned = (text or "").strip()
    if not cleaned:
        _last_synth_error = "empty text"
        return False
    if not available():
        _last_synth_error = "qwen-tts package not installed"
        return False
    tmp_wav = output_mp3.with_suffix(".qwen3.wav")
    try:
        model = _get_model()
        if model is None:
            # _last_synth_error already set by _get_model() / _ensure_model_class().
            return False
        language = _qwen_language(lang)
        speaker = _speaker(lang)
        instruct = (os.environ.get("QWEN3TTS_INSTRUCT") or "").strip()
        gen_kwargs = {
            "text": cleaned,
            "language": language,
            "speaker": speaker,
        }
        if instruct:
            gen_kwargs["instruct"] = instruct
        with _lock:
            wavs, sr = model.generate_custom_voice(**gen_kwargs)
        tmp_wav.parent.mkdir(parents=True, exist_ok=True)
        if not write_wav(wavs[0], int(sr), tmp_wav):
            _last_synth_error = "wav write failed"
            return False
    except Exception as exc:
        _last_synth_error = str(exc)
        ColorPrint.red(f"[qwen3tts] synth failed: {exc}")
        return False
    try:
        ok = wav_to_mp3(tmp_wav, output_mp3)
        if not ok:
            _last_synth_error = "wav->mp3 conversion failed"
        return ok
    finally:
        try:
            tmp_wav.unlink()
        except OSError:
            pass


def is_model_loaded() -> bool:
    """True when the model weights are resident in memory (managed-service state)."""
    return _model is not None


def unload_model() -> None:
    """Drop the loaded model so its GPU/CPU memory can be freed. The caller
    (managed_service) releases the GPU cache afterwards. Only invoked when no
    call is in flight (busy protection), so it is race-free."""
    global _model
    with _lock:
        _model = None


def synthesize_variants(
    text: str,
    lang: str,
    variants: List[Dict[str, Any]],
    out_paths: List[Path],
) -> List[bool]:
    """Batch multi-voice synthesis: ONE text -> N variant MP3s in a single
    ``generate_custom_voice`` list call (``non_streaming_mode=True``) at the
    GPU's max-parallel speed.

    ``variants[i]`` is ``{key, accent, gender}``; ``out_paths[i]`` receives the
    MP3. Returns a per-variant success list (never raises). Each variant gets a
    distinct speaker via ``_speaker_for_variant`` so 3 variants -> 3 voices.
    Falls back to per-variant single-file synth on batch failure is the CALLER's
    responsibility (tts_orchestrator.synthesize_variants handles that retry).
    """
    global _last_synth_error
    _last_synth_error = None
    cleaned = (text or "").strip()
    n = min(len(variants), len(out_paths))
    if not cleaned or n == 0:
        _last_synth_error = "empty text or no variants" if not cleaned else "no variants"
        return [False] * max(n, 0)
    if not available():
        _last_synth_error = "qwen-tts package not installed"
        return [False] * n
    results = [False] * n
    try:
        model = _get_model()
        if model is None:
            return results
        qwen_lang = _qwen_language(lang)
        speakers = [_speaker_for_variant(lang, variants[i], i) for i in range(n)]
        gpu_idx = 0
        dev = _device()
        if ":" in dev:
            suffix = dev.rsplit(":", 1)[-1]
            if suffix.isdigit():
                gpu_idx = int(suffix)
        snap = _query_gpu_snapshot(gpu_idx)
        max_parallel = estimate_max_parallel(
            detect_model_variant(_model_id()),
            snap.get("mem_total_mb") or 0,
            snap.get("mem_used_mb") or 0,
            snap.get("util_percent"),
        )
        max_parallel = max(1, min(max_parallel, n))
        texts = [cleaned] * n
        langs_list = [qwen_lang] * n
        with _lock:
            for start in range(0, n, max_parallel):
                chunk_t = texts[start:start + max_parallel]
                chunk_l = langs_list[start:start + max_parallel]
                chunk_s = speakers[start:start + max_parallel]
                wavs, sr = model.generate_custom_voice(
                    text=chunk_t, language=chunk_l, speaker=chunk_s,
                    non_streaming_mode=True,
                )
                for offset, wav in enumerate(wavs):
                    idx = start + offset
                    out_mp3 = Path(out_paths[idx])
                    out_mp3.parent.mkdir(parents=True, exist_ok=True)
                    tmp_wav = out_mp3.with_suffix(".qwen3.wav")
                    ok = write_wav(wav, int(sr), tmp_wav) and wav_to_mp3(tmp_wav, out_mp3)
                    results[idx] = bool(ok and out_mp3.exists() and out_mp3.stat().st_size > 0)
                    try:
                        tmp_wav.unlink()
                    except OSError:
                        pass
    except Exception as exc:  # noqa: BLE001
        _last_synth_error = str(exc)
        ColorPrint.red(f"[qwen3tts] batch synth failed: {exc}")
    return results


__all__ = [
    "available",
    "last_synth_error",
    "synthesize",
    "synthesize_variants",
    "is_model_loaded",
    "unload_model",
    "estimate_max_parallel",
]
