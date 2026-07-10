# -*- coding: utf-8 -*-
"""CoreBook HTTP request/response models (prefix /api/local/corebook)."""

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class CoreBookCompletenessLang(BaseModel):
    text: int = 0
    audio: int = 0


class CoreBookMissing(BaseModel):
    kind: str
    language: str
    count: int


class CoreBookCompleteness(BaseModel):
    languages: Dict[str, CoreBookCompletenessLang] = Field(default_factory=dict)
    missing: List[CoreBookMissing] = Field(default_factory=list)


class CoreBookSummary(BaseModel):
    source_key: Optional[str] = None
    source_type: str = "book"
    title: Optional[str] = None
    language: Optional[str] = None
    selected_languages: List[str] = Field(default_factory=list)
    chapter_count: int = 0
    slot_count: int = 0
    completeness: CoreBookCompleteness = Field(default_factory=CoreBookCompleteness)
    updated_at: Optional[float] = None


class CoreBookListResponse(BaseModel):
    success: bool
    items: List[CoreBookSummary] = Field(default_factory=list)
    error: Optional[str] = None


class CoreBookConvertRequest(BaseModel):
    path: str
    language: Optional[str] = None
    languages: Optional[List[str]] = None
    source_type: str = "book"
    text: Optional[str] = None


class CoreBookConvertResponse(BaseModel):
    success: bool
    summary: Optional[CoreBookSummary] = None
    error: Optional[str] = None


class CoreBookGetResponse(BaseModel):
    success: bool
    summary: Optional[CoreBookSummary] = None
    source: Dict[str, Any] = Field(default_factory=dict)
    chapters: List[Dict[str, Any]] = Field(default_factory=list)
    slots: List[Dict[str, Any]] = Field(default_factory=list)
    total_slots: int = 0
    start: int = 0
    limit: int = 0
    error: Optional[str] = None


class CoreBookDeleteResponse(BaseModel):
    success: bool
    removed: bool = False
    error: Optional[str] = None


class CoreBookAddLanguageRequest(BaseModel):
    source_key: str
    target_language: str
    source_language: Optional[str] = None
    provider: Optional[str] = None
    chunk_size: int = Field(120, ge=1, le=500)
    grain: str = "sentence"


class CoreBookFillAudioRequest(BaseModel):
    source_key: str
    languages: List[str]
    rate: str = "+0%"
    grain: str = "sentence"


class CoreBookEnrichResponse(BaseModel):
    success: bool
    result: Dict[str, Any] = Field(default_factory=dict)
    summary: Optional[CoreBookSummary] = None
    error: Optional[str] = None


class CoreBookAssistItem(BaseModel):
    request_type: str
    language: Optional[str] = None
    payload: Optional[Dict[str, Any]] = None


class CoreBookSubmitRequest(BaseModel):
    source_key: str
    upload_audio: bool = True
    request_assist: bool = False
    assist_items: Optional[List[CoreBookAssistItem]] = None


class CoreBookSubmitResponse(BaseModel):
    success: bool
    result: Dict[str, Any] = Field(default_factory=dict)
    error: Optional[str] = None
