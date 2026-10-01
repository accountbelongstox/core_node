#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Idempotent Hugging Face hub-cache prefetch shared by the Linux and Windows installers.

Runtime loads offline (HF_HUB_OFFLINE=1) from the hub cache under HF_HOME, so
the installer fills that same cache with the official ``huggingface_hub`` API
(https://huggingface.co/docs/huggingface_hub/guides/download).

  hf_prefetch.py REPO [--file NAME ...] [--allow PATTERN,PATTERN] [--prefer-safetensors] [--check]

  --file NAME           exact repo file (repeatable)
  --allow PATTERNS      comma-separated glob allow-list
  --prefer-safetensors  skip pickle weights when the repo publishes safetensors
  --check               local cache only, no network: prints __HF_READY__ and
                        exits 0 when complete, else prints __HF_MISSING__ and exits 1
"""

from __future__ import annotations

import argparse
import fnmatch
import json
import sys
from pathlib import Path
from typing import List, Optional

READY_MARKER = "__HF_READY__"
MISSING_MARKER = "__HF_MISSING__"
PICKLE_IGNORE = ["*.bin", "*.pt", "*.pth", "*.h5", "*.msgpack", "*.ot", "*.onnx"]
WEIGHT_SUFFIXES = (".safetensors", ".bin", ".pt", ".pth")


def _hub():
    import huggingface_hub

    return huggingface_hub


def _cached_snapshot(repo: str) -> Optional[Path]:
    try:
        return Path(_hub().snapshot_download(repo, local_files_only=True))
    except Exception:  # noqa: BLE001 - huggingface_hub raises several cache-miss types
        return None


def _cached_file(repo: str, name: str) -> bool:
    try:
        _hub().hf_hub_download(repo, name, local_files_only=True)
    except Exception:  # noqa: BLE001 - cache miss
        return False
    return True


def _shards_complete(snapshot: Path, index_name: str) -> bool:
    index = snapshot / index_name
    if not index.is_file():
        return False
    shards = set(json.loads(index.read_text(encoding="utf-8")).get("weight_map", {}).values())
    return bool(shards) and all((snapshot / shard).is_file() for shard in shards)


def _weights_ok(snapshot: Path) -> bool:
    for single, index in (("model.safetensors", "model.safetensors.index.json"),
                          ("pytorch_model.bin", "pytorch_model.bin.index.json")):
        if (snapshot / single).is_file() or _shards_complete(snapshot, index):
            return True
    return False


def _local_names(snapshot: Path) -> List[str]:
    return [path.relative_to(snapshot).as_posix() for path in snapshot.rglob("*") if path.is_file()]


def repo_ready(repo: str, files: List[str], allow: List[str]) -> bool:
    if files and not all(_cached_file(repo, name) for name in files):
        return False
    if not allow:
        return True
    snapshot = _cached_snapshot(repo)
    if snapshot is None:
        return False
    names = _local_names(snapshot)
    weight_patterns = [pattern for pattern in allow if pattern.endswith(WEIGHT_SUFFIXES) or "pytorch_model" in pattern]
    others = [pattern for pattern in allow if pattern not in weight_patterns]
    if others and not any(fnmatch.fnmatch(name, pattern) for name in names for pattern in others):
        return False
    return _weights_ok(snapshot) if weight_patterns else True


def fetch_repo(repo: str, files: List[str], allow: List[str], prefer_safetensors: bool) -> None:
    patterns = files + allow
    ignore = None
    if prefer_safetensors:
        siblings = _hub().HfApi().model_info(repo).siblings or []
        if any(sibling.rfilename.endswith(".safetensors") for sibling in siblings):
            ignore = [pattern for pattern in PICKLE_IGNORE if pattern not in patterns]
    path = _hub().snapshot_download(repo, allow_patterns=patterns or None, ignore_patterns=ignore)
    print(f"[hf-prefetch] {repo}: {path}", flush=True)


def main(argv: List[str]) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("repo")
    parser.add_argument("--file", action="append", default=[], dest="files")
    parser.add_argument("--allow", default="")
    parser.add_argument("--prefer-safetensors", action="store_true")
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args(argv)
    allow = [part.strip() for part in args.allow.split(",") if part.strip()]
    ready = repo_ready(args.repo, args.files, allow)
    if args.check:
        print(READY_MARKER if ready else f"{MISSING_MARKER} {args.repo}")
        return 0 if ready else 1
    if ready:
        print(f"[hf-prefetch] {args.repo}: already cached", flush=True)
        return 0
    fetch_repo(args.repo, args.files, allow, args.prefer_safetensors)
    if not repo_ready(args.repo, args.files, allow):
        print(f"[hf-prefetch] {args.repo}: cache incomplete after download", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
