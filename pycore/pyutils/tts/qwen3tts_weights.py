"""
Qwen3-TTS local weight validation shared by the engine and install/test scripts.

Single source of truth for Test-NeuralTtsLocalWeightsReady (Windows),
neural_tts_local_weights_ready (Linux), qwen3tts_engine.resolve_model_id,
and scripts/pytools/aitools/qwen3tts_tester.py.

Checks: config.json present, weight files meet HF catalog size when known,
and .safetensors files must deserialize cleanly.

The generic staging/sentinel/verify logic lives in
pycore.pyutils.common.hf_local_weights (shared by all neural engines); this
module binds it to Qwen3-TTS defaults (QWEN3TTS_DIR / "qwen3tts" staging,
QWEN3TTS_MODEL override, Qwen3-TTS static LFS sizes + docs) and re-exports the
public API the install scripts already import.

Storage invariant:
- staging_dir()/weights is the canonical persistent model store.
- .model_installed records the HF repository stored in that directory.
- The isolated Python venv contains packages only and may be rebuilt without
  moving, deleting, or downloading model weights.
- A QWEN3TTS_MODEL repository id matching the sentinel still resolves to the
  verified local weights directory, preventing a duplicate HF cache download.
"""

import os
from pathlib import Path
from typing import Dict, Optional

from pycore.pyfoundations.system_paths import get_local_data_dir
import pycore.pyutils.common.hf_local_weights as _core
from pycore.pyutils.common.model_tiers import runtime_engine_model

# Static LFS sizes (offline fallback; install scripts also resolve live via HF API).
_WEIGHT_BYTES_BY_REPO: Dict[str, Dict[str, int]] = {
    "Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice": {
        "model.safetensors": 3_833_402_552,
        "speech_tokenizer/model.safetensors": 682_293_092,
    },
    "Qwen/Qwen3-TTS-12Hz-0.6B-CustomVoice": {
        "model.safetensors": 1_811_626_576,
        "speech_tokenizer/model.safetensors": 682_293_092,
    },
}

_WEIGHT_SUFFIXES = _core._WEIGHT_SUFFIXES
_OFFICIAL_DOCS = (
    "https://github.com/QwenLM/Qwen3-TTS  |  "
    "https://qwenlm-qwen3-tts.mintlify.app/resources/faq"
)

_QWEN3TTS_ENV = "QWEN3TTS_DIR"
_QWEN3TTS_SUBDIR = "qwen3tts"
_QWEN3TTS_MODEL_ENV = "QWEN3TTS_MODEL"
_QWEN3TTS_DEFAULT = "Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice"


def _static_sizes(repo_id: str) -> Optional[Dict[str, int]]:
    return _WEIGHT_BYTES_BY_REPO.get((repo_id or "").strip())


def staging_dir() -> Path:
    explicit = (os.environ.get(_QWEN3TTS_ENV) or "").strip()
    if explicit:
        return Path(explicit)
    return get_local_data_dir() / _QWEN3TTS_SUBDIR


def sentinel_model_id(staging: Optional[Path] = None) -> Optional[str]:
    root = staging if staging is not None else staging_dir()
    return _core.sentinel_model_id(root)


def hf_repo_catalog(repo_id: str, use_cache: bool = True) -> Dict[str, int]:
    return _core.hf_repo_catalog(repo_id, use_cache=use_cache, static_sizes=_static_sizes(repo_id))


def local_weights_ready(weights_dir: Path, repo_id: str = "") -> bool:
    return _core.local_weights_ready(weights_dir, repo_id, _static_sizes(repo_id))


def local_weights_dir() -> Optional[Path]:
    staging = staging_dir()
    repo_id = sentinel_model_id(staging)
    return _core.local_weights_dir(staging, repo_id or "", _static_sizes(repo_id or ""))


def resolve_model_id(allow_remote: bool = True) -> str:
    explicit = (os.environ.get(_QWEN3TTS_MODEL_ENV) or "").strip()
    staging = staging_dir()
    repo_id = sentinel_model_id(staging)
    weights = staging / "weights"

    if explicit:
        try:
            if Path(explicit).expanduser().is_dir():
                return explicit
        except OSError:
            pass
        if explicit == (repo_id or "") and local_weights_ready(
            weights,
            explicit,
        ):
            return str(weights)
        return explicit if allow_remote else ""

    if local_weights_ready(weights, repo_id or ""):
        return str(weights)
    if repo_id:
        return repo_id if allow_remote else ""

    if not allow_remote:
        return ""

    try:
        return runtime_engine_model("qwen3tts")
    except Exception:
        return _QWEN3TTS_DEFAULT


def audit_local_weights(verbose: bool = False) -> tuple:
    staging = staging_dir()
    weights = staging / "weights"
    repo_id = sentinel_model_id(staging)
    if not weights.is_dir():
        if verbose:
            print(f"[AUDIT] Local weights dir missing: {weights}")
        return False, None, repo_id

    weight_files = sorted(
        p for p in weights.rglob("*") if p.is_file() and p.suffix.lower() in _WEIGHT_SUFFIXES
    )
    if not weight_files:
        if verbose:
            print(f"[AUDIT] No weight files under {weights}")
        return False, None, repo_id

    all_ok = True
    for path in weight_files:
        rel = path.relative_to(weights).as_posix()
        size = path.stat().st_size
        expected = _core._catalog_bytes(repo_id or "", rel, _static_sizes(repo_id or ""))
        ok = True
        detail = f"ok ({size:,} bytes)"
        if expected > 0 and size < expected:
            ok = False
            detail = f"too small ({size:,} bytes, expected {expected:,})"
        elif size <= 0:
            ok = False
            detail = "empty file"
        elif path.suffix.lower() == ".safetensors" and not _core._safetensors_readable(path):
            ok = False
            detail = f"corrupt or incomplete ({size:,} bytes)"
        if verbose:
            status = "OK" if ok else "BAD"
            print(f"[AUDIT] {status} {rel}: {detail}")
        if not ok:
            all_ok = False

    return all_ok, weights if all_ok else None, repo_id


def redownload_hint_lines(model_id: Optional[str] = None) -> list:
    staging = staging_dir()
    weights = staging / "weights"
    repo = (model_id or sentinel_model_id(staging) or resolve_model_id()).strip()
    return [
        "[FIX] Local Qwen3-TTS weights look incomplete or corrupt.",
        f"[FIX] Docs: {_OFFICIAL_DOCS}",
        "[FIX] Option A - huggingface-cli:",
        '        pip install -U "huggingface_hub[cli]"',
        f'        huggingface-cli download {repo} --local-dir "{weights}"',
        "[FIX] Option B - modelscope (mainland China):",
        "        pip install modelscope",
        f'        modelscope download --model {repo} --local_dir "{weights}"',
        "[FIX] Option C - let HF Hub download on load:",
        f"        python scripts/pytools/aitools/qwen3tts_tester.py --model {repo}",
        "[FIX] Option D - project installer (curl resume + size verify):",
        "        Step61_InstallQwen3Tts.ps1",
        "        scripts/shells/linux/debian/install_shells/140_install_qwen3tts.sh",
        f'[FIX] Delete bad files first, e.g. "{weights / "model.safetensors"}"',
    ]


__all__ = [
    "audit_local_weights",
    "hf_repo_catalog",
    "local_weights_dir",
    "local_weights_ready",
    "redownload_hint_lines",
    "resolve_model_id",
    "sentinel_model_id",
    "staging_dir",
]
