# -*- coding: utf-8 -*-
"""Subtitle-search application service."""

from typing import Any, Dict


_NOT_IMPLEMENTED = "subtitle_search: OpenSubtitles client not implemented"


class SubtitleSearchService:
    """Own subtitle-search capability, cache, and history responses."""

    def status(self) -> Dict[str, Any]:
        return {
            "available": False,
            "provider": "opensubtitles",
            "service_url": "",
            "key_name": "OPENSUBTITLES_API_KEY",
            "authenticated": False,
            "history_count": 0,
            "default_languages": ["en"],
            "max_results": 50,
        }

    def probe(self) -> Dict[str, Any]:
        return {
            "configured": False,
            "available": False,
            "latency_ms": None,
            "error": _NOT_IMPLEMENTED,
            "languages_count": 0,
        }

    def providers(self) -> Dict[str, Any]:
        return {
            "success": True,
            "providers": [
                {
                    "name": "opensubtitles",
                    "label": "OpenSubtitles",
                    "order": 1,
                    "available": False,
                    "configured": False,
                    "needs": "OpenSubtitles client not implemented in pycore",
                    "fallback": False,
                    "note": _NOT_IMPLEMENTED,
                },
            ],
        }

    def provider_test(self, name: str) -> Dict[str, Any]:
        provider_name = str(name or "opensubtitles")
        return {
            "name": provider_name,
            "label": provider_name,
            "available": False,
            "latency_ms": None,
            "error": _NOT_IMPLEMENTED,
        }

    def cache(self) -> Dict[str, Any]:
        return {
            "success": True,
            "dir": "",
            "downloads": 0,
            "fetches": 0,
            "bytes": 0,
        }

    def clear_cache(self) -> Dict[str, Any]:
        return {"success": True, "removed": 0}

    def search(self, query: str) -> Dict[str, Any]:
        return {
            "provider": "opensubtitles",
            "query": str(query or ""),
            "count": 0,
            "results": [],
            "error": _NOT_IMPLEMENTED,
        }

    def download(self) -> Dict[str, Any]:
        return {"success": False, "error": _NOT_IMPLEMENTED}

    def history(self) -> Dict[str, Any]:
        return {"success": True, "entries": []}

    def delete_history(self) -> Dict[str, Any]:
        return {"success": False}

    def clear_history(self) -> Dict[str, Any]:
        return {"success": True, "removed": 0}


subtitle_search_service = SubtitleSearchService()
