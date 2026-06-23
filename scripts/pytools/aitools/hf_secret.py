#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Shared Hugging Face Hub auth helper for the aitools scripts.

Reads HF_TOKEN from the project secret store (.secret_keys/.secret_ignore) and
exports it into the environment BEFORE transformers / huggingface_hub run, so Hub
requests are authenticated: no "unauthenticated requests to the HF Hub" warning,
higher rate limits, faster downloads.

Dependency-free on purpose: it must NOT import pycore.pyfoundations, whose import
chain touches CUDA/torch detection and can trigger a heavy reinstall. It mirrors
the indexed-secret convention of pyfoundations.secret_manager: try HF_TOKEN_1..N
then bare HF_TOKEN, first non-empty line wins.
"""

import os
from pathlib import Path

# Env var names transformers / huggingface_hub honor for Hub auth (newer + legacy).
_HF_ENV_VARS = ("HF_TOKEN", "HUGGING_FACE_HUB_TOKEN")
_SECRET_BASE = "HF_TOKEN"
_MAX_INDEX = 5


def _find_secret_raw_dir():
    """Walk up from this file to the project root holding .secret_keys/.secret_ignore."""
    for parent in Path(__file__).resolve().parents:
        raw_dir = parent / ".secret_keys" / ".secret_ignore"
        if raw_dir.is_dir():
            return raw_dir
    return None


def _read_first_line(path):
    """First non-empty, stripped line of a raw secret file (BOM-aware); '' on failure."""
    try:
        content = path.read_text(encoding="utf-8")
    except Exception:
        return ""
    if content.startswith("\ufeff"):
        content = content[1:]
    for line in content.splitlines():
        line = line.strip()
        if line:
            return line
    return ""


def read_hf_token():
    """Resolve the HF token: env first, then HF_TOKEN_1..5, then bare HF_TOKEN."""
    for var in _HF_ENV_VARS:
        val = os.environ.get(var)
        if val and val.strip():
            return val.strip()
    raw_dir = _find_secret_raw_dir()
    if raw_dir is None:
        return ""
    for i in range(1, _MAX_INDEX + 1):
        token = _read_first_line(raw_dir / f"{_SECRET_BASE}_{i}")
        if token:
            return token
    return _read_first_line(raw_dir / _SECRET_BASE)


def ensure_hf_token():
    """Export the resolved HF token into the environment for transformers/huggingface_hub.

    Returns the token ('' if none found). Safe to call repeatedly; never raises and
    never overwrites a token already present in the environment.
    """
    token = read_hf_token()
    if token:
        for var in _HF_ENV_VARS:
            os.environ.setdefault(var, token)
    return token
