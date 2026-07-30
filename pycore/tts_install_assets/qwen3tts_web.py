#!/usr/bin/env python3
"""Filesystem locations for the standalone Qwen3-TTS Web console assets."""

from pathlib import Path


_ASSET_DIR = Path(__file__).resolve().parent / "qwen3tts_web_assets"
QWEN3TTS_WEB_HTML_PATH = _ASSET_DIR / "index.html"
QWEN3TTS_WEB_CSS_PATH = _ASSET_DIR / "style.css"
QWEN3TTS_WEB_JS_PATH = _ASSET_DIR / "app.js"


__all__ = [
    "QWEN3TTS_WEB_CSS_PATH",
    "QWEN3TTS_WEB_HTML_PATH",
    "QWEN3TTS_WEB_JS_PATH",
]
