#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Robust GPT-SoVITS pretrained-model downloader (shared by install_gptsovits.ps1/.sh).

WHY NOT huggingface_hub.snapshot_download? On networks where HuggingFace's byte CDN
is blocked (the direct /resolve/ URL transfers 0 bytes), the hf-mirror.com mirror
serves the BYTES fine, but huggingface_hub's metadata resolution against the mirror
fails (LocalEntryNotFoundError). So we split the job:
  * list the repo files via the HF (or mirror) JSON API  ->  /api/models/<repo>
  * stream each file's bytes from the MIRROR /resolve/ URL with a resumable Range
    request + a live progress line.
Idempotent: a file already at its full Content-Length is skipped (no re-download);
a partial file is resumed from its current size. The completion sentinel is written
ONLY when every wanted file is fully present (file-based, never an exit code).

Usage:  gptsovits_dl.py <repo_id> <dest_dir> <sentinel_path>
Env:
  GPTSOVITS_MIRROR     byte mirror (default https://hf-mirror.com)
  GPTSOVITS_HF_ALLOW   comma globs to fetch ('*' = everything); default = v2 set
"""

import fnmatch
import os
import sys
import time

import requests

_DEFAULT_PATTERNS = [
    "chinese-hubert-base/*",
    "chinese-roberta-wwm-ext-large/*",
    "gsv-v2final-pretrained/*",
]


def _patterns():
    allow = [p.strip() for p in os.environ.get("GPTSOVITS_HF_ALLOW", "").split(",") if p.strip()]
    if allow == ["*"]:
        return ["*"]
    return allow or _DEFAULT_PATTERNS


def _list_files(repo):
    """File names via the JSON API — try direct HF, then the mirror."""
    mirror = os.environ.get("GPTSOVITS_MIRROR", "https://hf-mirror.com").rstrip("/")
    for base in ("https://huggingface.co", mirror):
        try:
            r = requests.get(f"{base}/api/models/{repo}", timeout=30)
            if r.ok:
                names = [s["rfilename"] for s in r.json().get("siblings", [])]
                if names:
                    print(f"[dl] listed {len(names)} files via {base}", flush=True)
                    return names
        except Exception as e:  # noqa: BLE001
            print(f"[dl] list via {base} failed: {e}", flush=True)
    return []


def _download_one(repo, name, dest, mirror):
    out = os.path.join(dest, *name.split("/"))
    os.makedirs(os.path.dirname(out) or ".", exist_ok=True)
    url = f"{mirror}/{repo}/resolve/main/{name}"
    # Expected size from the mirror (HEAD follows the redirect to the byte host).
    exp = 0
    try:
        h = requests.head(url, allow_redirects=True, timeout=30)
        exp = int(h.headers.get("Content-Length", 0) or 0)
    except Exception:  # noqa: BLE001
        exp = 0
    have = os.path.getsize(out) if os.path.exists(out) else 0
    if exp and have >= exp:
        print(f"[dl] [skip] {name} ({have} bytes, complete)", flush=True)
        return True
    headers = {"Range": f"bytes={have}-"} if have else {}
    try:
        with requests.get(url, headers=headers, stream=True, timeout=60) as r:
            # 416 = range not satisfiable -> the local file is already complete.
            if r.status_code == 416:
                print(f"[dl] [skip] {name} (already complete)", flush=True)
                return True
            r.raise_for_status()
            mode = "ab" if have else "wb"
            done = have
            last = 0.0
            with open(out, mode) as f:
                for chunk in r.iter_content(1024 * 1024):
                    if not chunk:
                        continue
                    f.write(chunk)
                    done += len(chunk)
                    now = time.time()
                    if now - last > 0.5:
                        pct = (done / exp * 100) if exp else 0
                        print(f"\r[dl]   {name}: {done/1e6:6.0f}/{(exp/1e6) if exp else 0:.0f}MB {pct:4.0f}%",
                              end="", flush=True)
                        last = now
        print(f"\r[dl] [ok ] {name}: {done/1e6:.0f}MB" + " " * 24, flush=True)
        return (not exp) or (os.path.getsize(out) >= exp)
    except Exception as e:  # noqa: BLE001
        print(f"\n[dl] [!] {name} failed ({e}); will resume next run", flush=True)
        return False


def main():
    if len(sys.argv) < 4:
        print("usage: gptsovits_dl.py <repo> <dest> <sentinel>")
        return 2
    repo, dest, sentinel = sys.argv[1], sys.argv[2], sys.argv[3]
    mirror = os.environ.get("GPTSOVITS_MIRROR", "https://hf-mirror.com").rstrip("/")
    patterns = _patterns()

    names = _list_files(repo)
    if not names:
        print("[dl] could not list repo files (network?)", flush=True)
        return 1
    wanted = [n for n in names if any(fnmatch.fnmatch(n, p) for p in patterns)]
    print(f"[dl] {len(wanted)} of {len(names)} files match {patterns} (bytes from {mirror})", flush=True)

    all_ok = True
    for name in wanted:
        if not _download_one(repo, name, dest, mirror):
            all_ok = False

    if all_ok and wanted:
        with open(sentinel, "w", encoding="utf-8") as f:
            f.write("done")
        print("[dl] all models present -> done", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
