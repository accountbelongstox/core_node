# -*- coding: utf-8 -*-
"""Image search controller — SerpApi Google-Images + optional AI compare."""

from typing import Any, Dict, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyctl.ai import generate_image
from pycore.pyctl.ai import image_search_history
from pycore.pyutils.external_apis.image_search_client import (
    _DEFAULT_NUM,
    _ENGINE,
    _KEY_NAME,
    _MAX_NUM,
    _SERPAPI_URL,
    download_image_b64,
    search_images,
    serpapi_configured,
)


class ImageSearchController:
    def __init__(self) -> None:
        self._resource_urls: set[str] = set()

    def _remember_resources(self, rows: Any) -> None:
        if not isinstance(rows, list):
            return
        for row in rows:
            if not isinstance(row, dict):
                continue
            for key in ("url", "thumbnail"):
                value = row.get(key)
                if isinstance(value, str) and value.startswith(("http://", "https://")):
                    self._resource_urls.add(value)

    def status(self) -> Dict[str, Any]:
        return {
            "available": serpapi_configured(),
            "provider": "serpapi",
            "engine": _ENGINE,
            "service_url": _SERPAPI_URL,
            "key_name": _KEY_NAME,
            "history_count": image_search_history.history_count(),
            "default_num": _DEFAULT_NUM,
            "max_num": _MAX_NUM,
        }

    def search(
        self,
        query: str,
        num: int = _DEFAULT_NUM,
        country: Optional[str] = None,
        record: bool = True,
    ) -> Dict[str, Any]:
        result = search_images(query, num=num, country=country)
        self._remember_resources(result.get("results"))
        history_id = None
        if record and (result.get("results") or result.get("error")):
            try:
                history_id = image_search_history.record_search(
                    query=result.get("query") or query,
                    engine=_ENGINE,
                    results=result.get("results") or [],
                    country=country,
                )
            except Exception as exc:  # noqa: BLE001
                ColorPrint.yellow(f"[ImageSearch] history record failed ({exc})")
        result["history_id"] = history_id
        return result

    def search_ai(
        self,
        query: str,
        size: Optional[str] = None,
        model: Optional[str] = None,
    ) -> Dict[str, Any]:
        clean = (query or "").strip()
        if not clean:
            return {
                "success": False,
                "provider": "ai",
                "model": model or "",
                "image_base64": None,
                "mime": "image/png",
                "latency_ms": None,
                "error": "query is required",
            }
        prompt = f"A high-quality illustration for the search query: {clean}"
        return generate_image(prompt=prompt, size=size or "1:1", model=model, source="image-search-ai")

    def compare(
        self,
        query: str,
        num: int = _DEFAULT_NUM,
        country: Optional[str] = None,
        size: Optional[str] = None,
        model: Optional[str] = None,
    ) -> Dict[str, Any]:
        clean = (query or "").strip()
        search_part = self.search(clean, num=num, country=country, record=False)
        ai_part = self.search_ai(clean, size=size, model=model)
        ai_ref = None
        if ai_part.get("success"):
            ai_ref = {
                "provider": ai_part.get("provider"),
                "model": ai_part.get("model"),
                "mime": ai_part.get("mime"),
            }
        try:
            image_search_history.record_search(
                query=clean,
                engine=_ENGINE,
                results=search_part.get("results") or [],
                country=country,
                ai=ai_ref,
            )
        except Exception as exc:  # noqa: BLE001
            ColorPrint.yellow(f"[ImageSearch] compare history record failed ({exc})")
        return {
            "query": clean,
            "search": {
                "provider": search_part.get("provider") or "serpapi",
                "engine": search_part.get("engine"),
                "count": search_part.get("count") or 0,
                "results": search_part.get("results") or [],
                "error": search_part.get("error"),
            },
            "ai": ai_part,
        }

    def history(self, limit: int = 50) -> Dict[str, Any]:
        entries = image_search_history.list_history(limit)
        for entry in entries:
            if isinstance(entry, dict):
                self._remember_resources(entry.get("results"))
        return {"success": True, "entries": entries}

    def delete_history(self, entry_id: str) -> Dict[str, Any]:
        return {"success": image_search_history.delete_entry(entry_id)}

    def clear_history(self) -> Dict[str, Any]:
        return {"success": True, "removed": image_search_history.clear_history()}

    def resource(self, url: str) -> Dict[str, Any]:
        """Download one search-result image for RPC v2 display."""
        normalized_url = str(url or "")
        if normalized_url not in self._resource_urls:
            self.history(200)
        if normalized_url not in self._resource_urls:
            return {"success": False, "error": "image resource URL was not returned by image search"}
        image_base64, mime = download_image_b64(normalized_url)
        if not image_base64:
            return {"success": False, "error": "image resource is unavailable"}
        return {"success": True, "image_base64": image_base64, "mime": mime}
