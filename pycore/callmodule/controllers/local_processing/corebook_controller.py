# -*- coding: utf-8 -*-
"""CoreBook controller — thin HTTP adapter over CoreBookEngine."""

from typing import Any, Dict, List, Optional

from pycore.callmodule.services.corebook.corebook_engine import CoreBookEngine


class CoreBookController:
    def __init__(self) -> None:
        self._engine = CoreBookEngine()

    def list_books(self) -> Dict[str, Any]:
        return self._engine.list_books()

    def convert(
        self,
        path: str,
        language: Optional[str] = None,
        languages: Optional[List[str]] = None,
        source_type: str = "book",
        text: Optional[str] = None,
    ) -> Dict[str, Any]:
        return self._engine.convert(path, language, languages, source_type, text)

    def get(self, source_key: str, start: int = 0, limit: int = 0) -> Dict[str, Any]:
        return self._engine.get(source_key, start, limit)

    def delete(self, source_key: str) -> Dict[str, Any]:
        return self._engine.delete(source_key)

    def add_language(
        self,
        source_key: str,
        target_language: str,
        source_language: Optional[str] = None,
        chunk_size: int = 120,
        grain: str = "sentence",
    ) -> Dict[str, Any]:
        return self._engine.add_language(
            source_key, target_language, source_language, chunk_size, grain)

    def fill_audio(
        self,
        source_key: str,
        languages: List[str],
        rate: str = "+0%",
        grain: str = "sentence",
    ) -> Dict[str, Any]:
        return self._engine.fill_audio(source_key, languages, rate, grain)

    def submit(
        self,
        source_key: str,
        upload_audio: bool = True,
        request_assist: bool = False,
        assist_items: Optional[List[Dict[str, Any]]] = None,
    ) -> Dict[str, Any]:
        return self._engine.submit(source_key, upload_audio, request_assist, assist_items)

    def autoflow(
        self,
        path: str,
        languages: Optional[List[str]] = None,
        source_type: str = "book",
    ) -> Dict[str, Any]:
        return self._engine.autoflow(path, languages, source_type)
