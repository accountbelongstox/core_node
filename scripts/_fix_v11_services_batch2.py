# -*- coding: utf-8 -*-
"""Fix migrated services for RPC V2 (batch 2)."""
from __future__ import annotations

import re
from pathlib import Path

SERVICES = Path(__file__).resolve().parents[1] / "pycore" / "callmodule" / "services"


def fix_vocabulary() -> None:
    path = SERVICES / "vocabulary_service.py"
    text = path.read_text(encoding="utf-8")
    text = text.replace("request: fastapi.Request", "query_params: Optional[Dict[str, Any]] = None")
    text = text.replace("dict(request.query_params)", "dict(query_params or {})")
    path.write_text(text, encoding="utf-8")


def fix_code_sync() -> None:
    path = SERVICES / "code_sync_service.py"
    text = path.read_text(encoding="utf-8")
    text = re.sub(r"\nrouter = APIRouter[^\n]*\n", "\n", text)
    text = text.replace("http_request: Request", 'client_ip: str = "unknown"')
    text = text.replace(
        'client_ip = http_request.client.host if http_request.client else "unknown"',
        "client_ip = client_ip or \"unknown\"",
    )
    text = re.sub(r"async def peer_heartbeat\(request: Request\):", "async def peer_heartbeat(payload: Dict = None):", text)
    text = text.replace("        payload = await request.json()\n    except Exception:\n        payload = {}", "        payload = payload or {}")
    text = re.sub(r"async def set_sync_settings\(request: Request\):", "async def set_sync_settings(payload: Dict = None):", text)
    text = text.replace("        body = await request.json()", "        body = payload or {}")
    text = re.sub(r"raise HTTPException\(status_code=(\d+), detail=([^)]+)\)", r'return {"success": False, "error": \2, "status_code": \1}', text)
    for model in ("RegisterResponse", "InitialSyncResponse", "ChangesResponse"):
        text = re.sub(rf"return {model}\(([^)]+)\)", r"return {\1}", text)
    path.write_text(text, encoding="utf-8")


def fix_ai_image_history_file() -> None:
    path = SERVICES / "ai_image_service.py"
    if not path.exists():
        return
    text = path.read_text(encoding="utf-8")
    if "content_base64" in text:
        return
    text = text.replace(
        "return Response(content=data, media_type=mime or \"image/png\")",
        'import base64\n    return {"success": True, "mime": mime or "image/png", "content_base64": base64.b64encode(data).decode("ascii"), "bytes": len(data)}',
    )
    path.write_text(text, encoding="utf-8")


if __name__ == "__main__":
    fix_vocabulary()
    fix_code_sync()
    fix_ai_image_history_file()
    print("batch2 fixes applied")
