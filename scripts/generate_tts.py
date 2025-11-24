"""
Generate English, Japanese, Lao, and Vietnamese pronunciation audio for dictionary entries using edge-tts.

Audio files are stored in the specified output folders using an MD5 hash of the word text.
The corresponding dictionary JSON files are updated with language-specific `*_audio` fields
that point to the Linux-style `/mnt/d/...` paths the user requested.

Example usage:

    python scripts/generate_tts.py dict41 dict42 --force

Requirements:
    pip install edge-tts
"""

from __future__ import annotations

import argparse
import asyncio
import hashlib
import json
import os
import pathlib
from typing import Iterable, List, Tuple

from aiohttp import client_exceptions
import edge_tts

BASE_DICT_DIR = pathlib.Path("pycore_db_cache/dict")

IS_WINDOWS = os.name == "nt"
BASE_STORAGE_DIR = pathlib.Path("D:/wwwroot/pycore_db") if IS_WINDOWS else pathlib.Path("/mnt/d/wwwroot/pycore_db")


def default_prefix(path: pathlib.Path) -> str:
    return path.as_posix()


DEFAULT_EN_DIR = BASE_STORAGE_DIR / "tts" / "en"
DEFAULT_JP_DIR = BASE_STORAGE_DIR / "tts" / "jp"
DEFAULT_LAOS_DIR = BASE_STORAGE_DIR / "tts" / "laos"
DEFAULT_VIE_DIR = BASE_STORAGE_DIR / "tts" / "vie"

DEFAULT_EN_PREFIX = default_prefix(DEFAULT_EN_DIR)
DEFAULT_JP_PREFIX = default_prefix(DEFAULT_JP_DIR)
DEFAULT_LAOS_PREFIX = default_prefix(DEFAULT_LAOS_DIR)
DEFAULT_VIE_PREFIX = default_prefix(DEFAULT_VIE_DIR)

THROTTLED_EXCEPTION = getattr(edge_tts.exceptions, "ThrottledException", None)

LANG_CONFIGS = {
    "en": {
        "voice": "en-US-JennyNeural",
        "text_field": "en",
        "dir": DEFAULT_EN_DIR,
        "prefix": DEFAULT_EN_PREFIX,
        "audio_field": "en_audio",
    },
    "jp": {
        "voice": "ja-JP-NanamiNeural",
        "text_field": "jp",
        "dir": DEFAULT_JP_DIR,
        "prefix": DEFAULT_JP_PREFIX,
        "audio_field": "jp_audio",
    },
    "laos": {
        "voice": "lo-LA-KeomanyNeural",
        "text_field": "laos",
        "dir": DEFAULT_LAOS_DIR,
        "prefix": DEFAULT_LAOS_PREFIX,
        "audio_field": "laos_audio",
    },
    "vie": {
        "voice": "vi-VN-HoaiMyNeural",
        "text_field": "vie",
        "dir": DEFAULT_VIE_DIR,
        "prefix": DEFAULT_VIE_PREFIX,
        "audio_field": "vie_audio",
    },
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Generate English/Japanese/Lao/Vietnamese TTS audio for dict files."
    )
    parser.add_argument(
        "targets",
        nargs="*",
        help="Dictionary numbers (e.g., 41) or filenames (dict41.json). Defaults to dict1–dict81 when omitted.",
    )
    parser.add_argument(
        "--en-dir",
        type=pathlib.Path,
        default=DEFAULT_EN_DIR,
        help="Filesystem path for English audio output (default: %(default)s)",
    )
    parser.add_argument(
        "--jp-dir",
        type=pathlib.Path,
        default=DEFAULT_JP_DIR,
        help="Filesystem path for Japanese audio output (default: %(default)s)",
    )
    parser.add_argument(
        "--laos-dir",
        type=pathlib.Path,
        default=DEFAULT_LAOS_DIR,
        help="Filesystem path for Lao audio output (default: %(default)s)",
    )
    parser.add_argument(
        "--vie-dir",
        type=pathlib.Path,
        default=DEFAULT_VIE_DIR,
        help="Filesystem path for Vietnamese audio output (default: %(default)s)",
    )
    parser.add_argument(
        "--en-prefix",
        default=DEFAULT_EN_PREFIX,
        help="Path prefix saved inside JSON for English audio references (default: %(default)s)",
    )
    parser.add_argument(
        "--jp-prefix",
        default=DEFAULT_JP_PREFIX,
        help="Path prefix saved inside JSON for Japanese audio references (default: %(default)s)",
    )
    parser.add_argument(
        "--laos-prefix",
        default=DEFAULT_LAOS_PREFIX,
        help="Path prefix saved inside JSON for Lao audio references (default: %(default)s)",
    )
    parser.add_argument(
        "--vie-prefix",
        default=DEFAULT_VIE_PREFIX,
        help="Path prefix saved inside JSON for Vietnamese audio references (default: %(default)s)",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Regenerate audio even if the hashed file already exists.",
    )
    parser.add_argument(
        "--concurrency",
        type=int,
        default=4,
        help="Maximum concurrent synthesis tasks (default: %(default)s)",
    )
    return parser.parse_args()


def normalize_target(target: str) -> pathlib.Path:
    target = target.strip()
    if not target:
        raise ValueError("Empty target provided.")
    if target.endswith(".json"):
        name = target
    elif target.isdigit():
        name = f"dict{int(target)}.json"
    else:
        name = target
    return BASE_DICT_DIR / name


def hashed_audio_path(text: str, directory: pathlib.Path) -> Tuple[pathlib.Path, str]:
    digest = hashlib.md5(text.strip().lower().encode("utf-8")).hexdigest()
    return directory / f"{digest}.mp3", digest


def is_rate_limit_error(exc: Exception) -> bool:
    if THROTTLED_EXCEPTION and isinstance(exc, THROTTLED_EXCEPTION):
        return True
    if isinstance(exc, client_exceptions.WSServerHandshakeError) and getattr(exc, "status", None) == 429:
        return True
    return False


async def synthesize(
    text: str,
    voice: str,
    output_path: pathlib.Path,
    semaphore: asyncio.Semaphore,
    max_retries: int = 3,
):
    output_path.parent.mkdir(parents=True, exist_ok=True)
    for attempt in range(max_retries):
        print(f"[CMD] edge-tts voice={voice} -> {output_path}")
        try:
            async with semaphore:
                communicator = edge_tts.Communicate(text, voice)
                await communicator.save(str(output_path))
            if output_path.exists() and output_path.stat().st_size > 0:
                return
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            if is_rate_limit_error(exc):
                print(f"[WARN] 429 from edge-tts (attempt {attempt + 1}) voice={voice}: {exc}; pausing 5s")
                await asyncio.sleep(5)
            else:
                print(f"[WARN] edge-tts error (attempt {attempt + 1}) for voice={voice}: {exc}")
        if output_path.exists():
            try:
                output_path.unlink()
            except OSError:
                pass
        await asyncio.sleep(1.5 * (attempt + 1))
    raise RuntimeError(f"TTS synthesis failed for '{text}' using voice '{voice}'")


async def generate_audio_requests(
    requests: List[Tuple[str, str, pathlib.Path]],
    concurrency: int,
):
    semaphore = asyncio.Semaphore(max(1, concurrency))
    tasks = [
        asyncio.create_task(synthesize(text, voice, path, semaphore))
        for text, voice, path in requests
    ]
    if tasks:
        await asyncio.gather(*tasks)


def linux_style_path(prefix: str, digest: str) -> str:
    prefix_norm = prefix.replace("\\", "/").rstrip("/")
    return f"{prefix_norm}/{digest}.mp3"


async def process_file(
    path: pathlib.Path,
    lang_settings: dict,
    force: bool,
    concurrency: int,
):
    if not path.exists():
        print(f"[WARN] File not found: {path}")
        return

    data = json.loads(path.read_text(encoding="utf-8"))
    items = data.get("items", [])
    pending: List[Tuple[str, str, pathlib.Path]] = []
    audio_refs: List[Tuple[dict, str, pathlib.Path, str]] = []

    for item in items:
        word_info = item.get("word", {})

        for lang_key, config in lang_settings.items():
            term = word_info.get(config["text_field"], "").strip()
            if not term:
                continue
            output_dir = pathlib.Path(config["dir"])
            output_dir.mkdir(parents=True, exist_ok=True)
            audio_path, digest = hashed_audio_path(term, output_dir)
            needs_generation = force or not audio_path.exists() or audio_path.stat().st_size == 0
            if needs_generation:
                pending.append((term, config["voice"], audio_path))
            audio_refs.append(
                (
                    word_info,
                    config["audio_field"],
                    audio_path,
                    linux_style_path(config["prefix"], digest),
                )
            )

    if pending:
        print(f"[INFO] Synthesizing {len(pending)} clips for {path.name} ...")
        await generate_audio_requests(pending, concurrency)

    for word_section, field, file_path, json_path in audio_refs:
        if file_path.exists():
            word_section[field] = json_path

    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"[DONE] Updated {path.name}")


async def main_async():
    args = parse_args()
    lang_settings = {
        "en": {
            **LANG_CONFIGS["en"],
            "dir": args.en_dir.resolve(),
            "prefix": args.en_prefix,
        },
        "jp": {
            **LANG_CONFIGS["jp"],
            "dir": args.jp_dir.resolve(),
            "prefix": args.jp_prefix,
        },
        "laos": {
            **LANG_CONFIGS["laos"],
            "dir": args.laos_dir.resolve(),
            "prefix": args.laos_prefix,
        },
        "vie": {
            **LANG_CONFIGS["vie"],
            "dir": args.vie_dir.resolve(),
            "prefix": args.vie_prefix,
        },
    }

    if args.targets:
        targets = args.targets
    else:
        targets = [f"dict{i}.json" for i in range(1, 82)]

    tasks = [
        process_file(
            normalize_target(target),
            lang_settings,
            args.force,
            args.concurrency,
        )
        for target in targets
    ]
    await asyncio.gather(*tasks)


def main():
    asyncio.run(main_async())


if __name__ == "__main__":
    main()
