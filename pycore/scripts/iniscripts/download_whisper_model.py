#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
download_whisper_model.py

Pre-download an OpenAI Whisper model so the first transcription does not stall on
a network fetch. Invoked by install_whisper.ps1 / install_whisper.sh (so the model
download - a form of installation - is driven from the shell), while the Pycore
worker simply USES the cached model.

Whisper caches models under ~/.cache/whisper (or $XDG_CACHE_HOME / the
--download-root passed to load_model). We let whisper itself do the download via
``whisper._download`` when available, falling back to ``load_model`` otherwise.

Usage:  python download_whisper_model.py <model-name>

Exit codes: 0 ok / already cached, 1 error, 2 bad usage.
"""

import os
import sys

# Models openai-whisper knows about (kept loose; whisper validates the real list).
KNOWN_HINT = (
    "tiny, tiny.en, base, base.en, small, small.en, medium, medium.en, "
    "large-v1, large-v2, large-v3, large, turbo"
)


def main():
    if len(sys.argv) < 2 or not sys.argv[1].strip():
        sys.stderr.write("usage: download_whisper_model.py <model-name>\n")
        sys.stderr.write("  known models: %s\n" % KNOWN_HINT)
        return 2

    model = sys.argv[1].strip()

    try:
        import whisper
    except Exception as exc:  # noqa: BLE001 - report any import failure clearly
        sys.stderr.write("[X] whisper not importable: %s\n" % exc)
        return 1

    available = getattr(whisper, "available_models", lambda: [])()
    if available and model not in available:
        sys.stderr.write(
            "[!] Unknown model '%s'. Available: %s\n" % (model, ", ".join(available))
        )
        return 1

    root = os.path.join(os.path.expanduser("~"), ".cache", "whisper")
    root = os.environ.get("WHISPER_CACHE_DIR", root)
    os.makedirs(root, exist_ok=True)

    print("    [dl] model : %s" % model, flush=True)
    print("    [dl] cache : %s" % root, flush=True)

    # Preferred: whisper._download pulls just the weights file (no model build,
    # no GPU/CPU allocation) and is a no-op when the file already exists+matches.
    url_map = getattr(whisper, "_MODELS", None)
    downloader = getattr(whisper, "_download", None)
    if isinstance(url_map, dict) and callable(downloader) and model in url_map:
        try:
            downloader(url_map[model], root, False)  # (url, root, in_memory=False)
            print("    [dl] done (weights cached under %s)." % root, flush=True)
            return 0
        except Exception as exc:  # noqa: BLE001
            sys.stderr.write("[!] direct download failed (%s); trying load_model.\n" % exc)

    # Fallback: load_model triggers the same download, then discards the model.
    try:
        whisper.load_model(model, device="cpu", download_root=root)
        print("    [dl] done (verified via load_model).", flush=True)
        return 0
    except Exception as exc:  # noqa: BLE001
        sys.stderr.write("[X] download failed: %s\n" % exc)
        return 1


if __name__ == "__main__":
    sys.exit(main())
