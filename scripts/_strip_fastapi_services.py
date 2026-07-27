# -*- coding: utf-8 -*-
"""Strip FastAPI decorators from migrated service files."""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "pycore" / "callmodule" / "services"
FILES = [
    "tts_status_service.py",
    "stt_status_service.py",
    "llm_status_service.py",
    "ocr_status_service.py",
    "assist_service.py",
    "ai_keys_service.py",
    "ai_probe_service.py",
    "speech_history_service.py",
    "heartbeat_workers_service.py",
    "code_sync_service.py",
    "vocabulary_service.py",
    "voice_subtitle_service.py",
    "image_search_service.py",
    "ai_image_service.py",
]


def strip_file(path: Path) -> None:
    text = path.read_text(encoding="utf-8")
    text = re.sub(r"^import fastapi\s*\n", "", text, flags=re.M)
    text = re.sub(r"^from fastapi[^\n]*\n", "", text, flags=re.M)
    text = re.sub(r"^router = fastapi\.APIRouter[^\n]*\n\n", "", text, flags=re.M)
    text = re.sub(r"^@router\.(get|post|delete|put|patch)\([^\)]*\)\s*\n", "", text, flags=re.M)
    text = text.replace("from pycore import ColorPrint, get_user_data_store", "from pycore.pyfoundations.pybasecommon.color_print import ColorPrint\nfrom pycore.database.repositories.user_data_store import get_user_data_store")
    text = text.replace("from pycore import ColorPrint", "from pycore.pyfoundations.pybasecommon.color_print import ColorPrint")
    text = text.replace("raise fastapi.HTTPException", "return {\"success\": False, \"error\": \"request failed\"}; raise RuntimeError")
    path.write_text(text, encoding="utf-8")


if __name__ == "__main__":
    for name in FILES:
        strip_file(ROOT / name)
    print("stripped", len(FILES), "files")
