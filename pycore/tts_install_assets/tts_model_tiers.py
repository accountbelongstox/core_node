#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
GPU vs CPU default model tiers for TTS/STT install scripts.

Single source of truth used by Windows Step scripts and Linux install_shells.
Official references (install docs verified against upstream READMEs):

  whisper         https://github.com/openai/whisper
  faster-whisper  https://github.com/SYSTRAN/faster-whisper
  kokoro/sherpa   https://k2-fsa.github.io/sherpa/onnx/tts/all/Chinese-English/kokoro-multi-lang-v1_1.html
  gptsovits       https://github.com/RVC-Boss/GPT-SoVITS  (models: lj1995/GPT-SoVITS)
  cosyvoice       https://github.com/FunAudioLLM/CosyVoice
  chattts         https://github.com/2noise/ChatTTS
  f5tts           https://github.com/SWivid/F5-TTS
  fishspeech      https://speech.fish.audio/server/
  voxcpm2         https://voxcpm.readthedocs.io/en/latest/quickstart.html
  melotts         https://github.com/myshell-ai/MeloTTS
  bark            https://huggingface.co/docs/transformers/model_doc/bark
  parler          https://github.com/huggingface/parler-tts
  qwen3tts        https://github.com/QwenLM/Qwen3-TTS

CLI:
  python tts_model_tiers.py resolve <key> [--gpu|--cpu]
  python tts_model_tiers.py official-env <engine>
  python tts_model_tiers.py idempotent <reason>
  python tts_model_tiers.py summary
  python tts_model_tiers.py engine-model <engine> [--gpu|--cpu]

Keys for resolve: whisper_model, faster_whisper_model, kokoro_url,
  gptsovits_hf_allow, cosyvoice_model_dir, voxcpm2_model, fishspeech_checkpoint
"""

from __future__ import annotations

import sys

SHERPA_KOKORO_BASE = (
    "https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/"
)

# Official perfect-support environment notes (printed by install scripts / engine docstrings).
OFFICIAL_ENV: dict[str, str] = {
    "whisper": (
        "Python 3.8+; ffmpeg on PATH; torch auto-installed. "
        "GPU: CUDA-capable GPU + drivers; model large-v3 (~3GB). "
        "CPU: model medium (~1.5GB) — largest practical CPU tier."
    ),
    "faster_whisper": (
        "Python 3.8+; CTranslate2 backend. "
        "GPU: CUDA 12 + nvidia-cublas-cu12 + nvidia-cudnn-cu12==9.*; model large-v3. "
        "CPU: int8 compute; model medium — largest CPU-viable tier."
    ),
    "sherpa": (
        "Python 3.8+; pip install sherpa-onnx. "
        "GPU: optional sherpa-onnx+cuda wheel via SHERPA_ONNX_CUDA_SPEC; "
        "model kokoro-multi-lang-v1_1 (full FP32, max quality). "
        "CPU: CPU wheel; model kokoro-int8-multi-lang-v1_1 (int8, max CPU tier)."
    ),
    "kokoro": (
        "Same sherpa-onnx stack as sherpa; dedicated KOKORO_TTS_MODEL_DIR cache. "
        "GPU -> kokoro-multi-lang-v1_1; CPU -> kokoro-int8-multi-lang-v1_1."
    ),
    "gptsovits": (
        "Python 3.9–3.11 recommended; git clone RVC-Boss/GPT-SoVITS; "
        "GPU: CUDA torch + all HF pretrained sets (GPTSOVITS_HF_ALLOW=*). "
        "CPU: CPU torch + v2 pretrained set (~1.2GB). "
        "Server: python api_v2.py on :9880; needs GPTSOVITS_REF_AUDIO."
    ),
    "cosyvoice": (
        "Python 3.10+; git FunAudioLLM/CosyVoice; modelscope iic/CosyVoice2-0.5B. "
        "GPU: CUDA torch recommended; CPU supported but slow. "
        "Server: runtime/python/fastapi/server.py --port 50000."
    ),
    "chattts": (
        "Python 3.10+ (3.13 OK: use current ChatTTS pip wheel; skip legacy one-click "
        "bundles with old numba/slicer deps). pip install ChatTTS; GPU ~4GB VRAM. "
        "API: chattts_api_server.py -> CHATTTS_URL :8000."
    ),
    "f5tts": (
        "Python 3.10+; pip install -e SWivid/F5-TTS; GPU recommended for real-time. "
        "HTTP wrapper: f5tts_api_server.py; needs F5TTS_REF_AUDIO + F5TTS_REF_TEXT."
    ),
    "fishspeech": (
        "Python 3.10–3.12; git fishaudio/fish-speech. "
        "GPU: openaudio-s1 checkpoint (~12GB VRAM for full quality). "
        "CPU: openaudio-s1-mini or Fish Audio cloud SDK (FISH_API_KEY). "
        "Local: tools/api_server.py or fishspeech_api_server.py bridge."
    ),
    "voxcpm2": (
        "Python 3.10–3.12; pip install voxcpm; model openbmb/VoxCPM2 (~8GB VRAM GPU). "
        "CPU inference supported but slow; VOXCPM2_DEVICE=auto."
    ),
    "melotts": (
        "Python 3.8+; pip install melotts (fallback: git myshell-ai/MeloTTS); "
        "Windows: unidic-lite; Linux: unidic download + MeCab for fugashi. "
        "NLTK averaged_perceptron_tagger_eng; GPU preferred; HF models lazy/ warm on install."
    ),
    "bark": (
        "Python 3.10+ (3.13 native with torch>=2.5); pip install transformers scipy. "
        "Do NOT pip install bark (wrong package). GPU: suno/bark; CPU: suno/bark-small. "
        "BARK_VOICE_PRESET for speaker style (e.g. v2/en_speaker_6)."
    ),
    "parler": (
        "Python 3.10+ (3.13 native with torch>=2.5); "
        "pip install git+https://github.com/huggingface/parler-tts.git. "
        "GPU: parler-tts/parler-tts-large-v1; CPU: parler-tts/parler-tts-mini-v1. "
        "PARLER_DESCRIPTION controls voice/style."
    ),
    "qwen3tts": (
        "Python 3.10+ (3.13 via pip qwen-tts; avoid legacy ComfyUI conversion scripts). "
        "pip install -U qwen-tts; torch>=2.5. "
        "SoX binary on PATH (pysox; winget ChrisBagwell.SoX / apt sox). "
        "GPU: Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice; "
        "CPU: Qwen/Qwen3-TTS-12Hz-0.6B-CustomVoice. "
        "Install scripts pre-download weights idempotently via curl (sentinel + resume + HF size/safetensors verify). "
        "QWEN3TTS_SPEAKER + optional QWEN3TTS_INSTRUCT."
    ),
}

_GPTSOVITS_CPU = (
    "chinese-hubert-base/*,chinese-roberta-wwm-ext-large/*,gsv-v2final-pretrained/*"
)

# GPU / CPU max tiers (single source for install scripts + runtime).
TIER_TABLE: dict[str, dict[str, str]] = {
    "whisper": {
        "gpu": "large-v3",
        "cpu": "medium",
        "env": "WHISPER_MODEL",
    },
    "faster_whisper": {
        "gpu": "large-v3",
        "cpu": "medium",
        "env": "FASTER_WHISPER_MODEL",
    },
    "kokoro": {
        "gpu": "kokoro-multi-lang-v1_1",
        "cpu": "kokoro-int8-multi-lang-v1_1",
        "env": "KOKORO_TTS_MODEL_DIR",
    },
    "sherpa": {
        "gpu": "kokoro-multi-lang-v1_1",
        "cpu": "kokoro-int8-multi-lang-v1_1",
        "env": "SHERPA_TTS_MODEL_DIR",
    },
    "gptsovits": {
        "gpu": "*",
        "cpu": "v2 (~1.2GB)",
        "env": "GPTSOVITS_HF_ALLOW",
    },
    "cosyvoice": {
        "gpu": "iic/CosyVoice2-0.5B",
        "cpu": "iic/CosyVoice2-0.5B",
        "env": "COSYVOICE_MODEL_DIR",
    },
    "voxcpm2": {
        "gpu": "openbmb/VoxCPM2",
        "cpu": "openbmb/VoxCPM2",
        "env": "VOXCPM2_MODEL",
    },
    "fishspeech": {
        "gpu": "openaudio-s1",
        "cpu": "openaudio-s1-mini",
        "env": "FISHSPEECH_CHECKPOINT",
    },
    "bark": {
        "gpu": "suno/bark",
        "cpu": "suno/bark-small",
        "env": "BARK_MODEL",
    },
    "parler": {
        "gpu": "parler-tts/parler-tts-large-v1",
        "cpu": "parler-tts/parler-tts-mini-v1",
        "env": "PARLER_MODEL",
    },
    "qwen3tts": {
        "gpu": "Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice",
        "cpu": "Qwen/Qwen3-TTS-12Hz-0.6B-CustomVoice",
        "env": "QWEN3TTS_MODEL",
    },
}


def kokoro_model_name(gpu: bool) -> str:
    return "kokoro-multi-lang-v1_1" if gpu else "kokoro-int8-multi-lang-v1_1"


def whisper_model(gpu: bool) -> str:
    return "large-v3" if gpu else "medium"


def faster_whisper_model(gpu: bool) -> str:
    return "large-v3" if gpu else "medium"


def kokoro_url(gpu: bool) -> str:
    name = "kokoro-multi-lang-v1_1.tar.bz2" if gpu else "kokoro-int8-multi-lang-v1_1.tar.bz2"
    return SHERPA_KOKORO_BASE + name


def gptsovits_hf_allow(gpu: bool) -> str:
    return "*" if gpu else _GPTSOVITS_CPU


def cosyvoice_model_dir(gpu: bool) -> str:
    del gpu  # CosyVoice2-0.5B is the official recommended model for both tiers.
    return "iic/CosyVoice2-0.5B"


def voxcpm2_model(gpu: bool) -> str:
    del gpu
    return "openbmb/VoxCPM2"


def fishspeech_checkpoint(gpu: bool) -> str:
    return "openaudio-s1" if gpu else "openaudio-s1-mini"


def bark_model(gpu: bool) -> str:
    return "suno/bark" if gpu else "suno/bark-small"


def parler_model(gpu: bool) -> str:
    return "parler-tts/parler-tts-large-v1" if gpu else "parler-tts/parler-tts-mini-v1"


def qwen3tts_model(gpu: bool) -> str:
    return (
        "Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice"
        if gpu
        else "Qwen/Qwen3-TTS-12Hz-0.6B-CustomVoice"
    )


def engine_model(engine: str, gpu: bool) -> str:
    """Resolve the canonical model/checkpoint id for one engine tier."""
    eng = (engine or "").strip().lower().replace("-", "_")
    if eng in ("whisper",):
        return whisper_model(gpu)
    if eng in ("faster_whisper", "faster-whisper"):
        return faster_whisper_model(gpu)
    if eng in ("kokoro", "sherpa"):
        return kokoro_model_name(gpu)
    if eng == "gptsovits":
        return gptsovits_hf_allow(gpu)
    if eng == "cosyvoice":
        return cosyvoice_model_dir(gpu)
    if eng == "voxcpm2":
        return voxcpm2_model(gpu)
    if eng in ("fishspeech", "fish_speech"):
        return fishspeech_checkpoint(gpu)
    if eng == "bark":
        return bark_model(gpu)
    if eng == "parler":
        return parler_model(gpu)
    if eng in ("qwen3tts", "qwen3_tts"):
        return qwen3tts_model(gpu)
    row = TIER_TABLE.get(eng)
    if row:
        return row["gpu"] if gpu else row["cpu"]
    return ""


def tier_summary_lines() -> list[str]:
    """Human-readable tier table for logs / UI constants."""
    lines: list[str] = []
    labels = {
        "whisper": "Whisper",
        "faster_whisper": "faster-whisper",
        "kokoro": "sherpa/kokoro",
        "sherpa": "sherpa (offline TTS)",
        "gptsovits": "GPT-SoVITS",
        "cosyvoice": "CosyVoice",
        "voxcpm2": "VoxCPM2",
        "fishspeech": "Fish Speech",
        "bark": "Bark (Suno/transformers)",
        "parler": "Parler-TTS",
        "qwen3tts": "Qwen3-TTS",
    }
    for key, row in TIER_TABLE.items():
        label = labels.get(key, key)
        env = row.get("env", "")
        lines.append(
            f"{label}: GPU={row['gpu']} | CPU={row['cpu']}"
            + (f" ({env})" if env else "")
        )
    return lines


_RESOLVERS = {
    "whisper_model": whisper_model,
    "faster_whisper_model": faster_whisper_model,
    "kokoro_url": kokoro_url,
    "gptsovits_hf_allow": gptsovits_hf_allow,
    "cosyvoice_model_dir": cosyvoice_model_dir,
    "voxcpm2_model": voxcpm2_model,
    "fishspeech_checkpoint": fishspeech_checkpoint,
    "bark_model": bark_model,
    "parler_model": parler_model,
    "qwen3tts_model": qwen3tts_model,
}


def idempotent_msg(reason: str) -> str:
    return f"[idempotent] skipping: {reason}"


def _parse_gpu_flag(argv: list[str]) -> tuple[bool, list[str]]:
    gpu = False
    rest: list[str] = []
    for arg in argv:
        if arg == "--gpu":
            gpu = True
        elif arg == "--cpu":
            gpu = False
        else:
            rest.append(arg)
    return gpu, rest


def main(argv: list[str] | None = None) -> int:
    args = list(argv if argv is not None else sys.argv[1:])
    if not args:
        print("usage: tts_model_tiers.py <resolve|official-env|idempotent> ...", file=sys.stderr)
        return 2

    cmd = args[0]
    tail = args[1:]

    if cmd == "resolve":
        if not tail:
            print("usage: resolve <key> [--gpu|--cpu]", file=sys.stderr)
            return 2
        key = tail[0]
        gpu, _ = _parse_gpu_flag(tail[1:])
        fn = _RESOLVERS.get(key)
        if fn is None:
            print(f"unknown key: {key}", file=sys.stderr)
            return 2
        print(fn(gpu))
        return 0

    if cmd == "official-env":
        if not tail:
            print("usage: official-env <engine>", file=sys.stderr)
            return 2
        eng = tail[0].lower()
        text = OFFICIAL_ENV.get(eng)
        if not text:
            print(f"unknown engine: {eng}", file=sys.stderr)
            return 2
        print(text)
        return 0

    if cmd == "idempotent":
        reason = " ".join(tail) if tail else "already satisfied"
        print(idempotent_msg(reason))
        return 0

    if cmd == "summary":
        for line in tier_summary_lines():
            print(line)
        return 0

    if cmd == "engine-model":
        if not tail:
            print("usage: engine-model <engine> [--gpu|--cpu]", file=sys.stderr)
            return 2
        eng = tail[0]
        gpu, _ = _parse_gpu_flag(tail[1:])
        value = engine_model(eng, gpu)
        if not value:
            print(f"unknown engine: {eng}", file=sys.stderr)
            return 2
        print(value)
        return 0

    print(f"unknown command: {cmd}", file=sys.stderr)
    return 2


if __name__ == "__main__":
    sys.exit(main())
