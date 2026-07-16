#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
download_model.py

Pre-download a faster-whisper model from Hugging Face with live MB progress.
Invoked by Step11_InstallFasterWhisper.ps1 / Step42_InstallWhisper.ps1 so that the model download (a
form of installation) is driven from PowerShell, while the main worker simply
USES the cached model. Reuses helpers from video_audio_extractor.

Usage:  python download_model.py <model-name>

Exit codes: 0 ok / already cached, 1 error, 2 bad usage.
"""

import os
import sys

# Reuse the worker's helpers (progress monitor, repo/cache lookup, DLL dirs).
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import video_audio_extractor as V  # noqa: E402


def main():
    if len(sys.argv) < 2 or not sys.argv[1].strip():
        sys.stderr.write("usage: download_model.py <model-name>\n")
        return 2
    model = sys.argv[1].strip()
    if model == "auto":
        sys.stderr.write("[!] 'auto' must be resolved before download.\n")
        return 2

    try:
        from faster_whisper import download_model
    except Exception as exc:
        sys.stderr.write("[X] faster-whisper not importable: %s\n" % exc)
        return 1

    repo, repo_dir, cached = V.whisper_repo_and_cache(model)
    if not repo:
        sys.stderr.write("[!] Unknown model '%s'.\n" % model)
        return 1

    tok = os.environ.get("HF_TOKEN") or os.environ.get("HUGGING_FACE_HUB_TOKEN")
    print("    [dl] model : %s" % model, flush=True)
    print("    [dl] repo  : %s" % repo, flush=True)
    print("    [dl] auth  : %s"
          % (("HF_TOKEN=" + V._mask_token(tok)) if tok else "none (slower)"), flush=True)

    if cached:
        print("    [dl] already cached (%.0f MB)." % V._path_size_mb(repo_dir), flush=True)
        return 0

    print("    [dl] downloading from HuggingFace ...", flush=True)
    monitor = V._DownloadProgress(repo)
    monitor.start()
    try:
        path = download_model(model)
    except Exception as exc:
        monitor.stop()
        sys.stderr.write("[X] download failed: %s\n" % exc)
        return 1
    monitor.stop()
    print("    [dl] done: %s (%.0f MB)" % (path, V._path_size_mb(repo_dir)), flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
