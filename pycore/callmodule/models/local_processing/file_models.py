# -*- coding: utf-8 -*-
"""
File Models

Models for file analysis and processing (PDF, Word, Excel, etc.).
"""

from typing import Optional, List, Literal
from pydantic import BaseModel, Field


FileTypeType = Literal['pdf', 'docx', 'xlsx', 'pptx', 'txt', 'csv']


class FileAnalyzeRequest(BaseModel):
    """File analysis request"""
    file_data: Optional[str] = Field(None, description="Base64 encoded file data")
    file_path: Optional[str] = Field(None, description="Local file path")
    file_url: Optional[str] = Field(None, description="File URL")
    file_type: Optional[FileTypeType] = Field(None, description="File type, auto-detected if not provided")
    extract_text: bool = Field(default=True, description="Extract text content")
    extract_images: bool = Field(default=False, description="Extract images from file")
    extract_metadata: bool = Field(default=True, description="Extract file metadata")
    auto_upload: bool = Field(default=True, description="Automatically upload result")

    class Config:
        schema_extra = {
            "example": {
                "file_path": "/tmp/document.pdf",
                "file_type": "pdf",
                "extract_text": True,
                "extract_images": False,
                "extract_metadata": True,
                "auto_upload": True
            }
        }


class FileMetadata(BaseModel):
    """File metadata"""
    file_name: str
    file_size: int = Field(..., description="File size in bytes")
    file_type: str
    page_count: Optional[int] = None
    word_count: Optional[int] = None
    author: Optional[str] = None
    created_date: Optional[str] = None
    modified_date: Optional[str] = None


class ExtractedImage(BaseModel):
    """Extracted image information"""
    image_id: str
    page_number: Optional[int] = None
    image_data: Optional[str] = Field(None, description="Base64 encoded image data")
    image_path: Optional[str] = Field(None, description="Saved image path")
    width: Optional[int] = None
    height: Optional[int] = None


class FileAnalyzeResponse(BaseModel):
    """File analysis response"""
    success: bool
    message: str
    analyze_id: Optional[str] = None
    metadata: Optional[FileMetadata] = None
    text_content: Optional[str] = Field(None, description="Extracted text content")
    extracted_images: Optional[List[ExtractedImage]] = Field(None, description="Extracted images")
    page_texts: Optional[List[dict]] = Field(None, description="Text content by page")
    upload_result: Optional[dict] = Field(None, description="Upload result if auto_upload is True")
    execution_time: float = Field(..., description="Execution time in seconds")
    error: Optional[str] = None

    class Config:
        schema_extra = {
            "example": {
                "success": True,
                "message": "File analyzed successfully",
                "analyze_id": "analyze_20251207_143000",
                "metadata": {
                    "file_name": "document.pdf",
                    "file_size": 1024000,
                    "file_type": "pdf",
                    "page_count": 10,
                    "word_count": 5000,
                    "author": "John Doe",
                    "created_date": "2025-01-01",
                    "modified_date": "2025-12-01"
                },
                "text_content": "This is the extracted text content...",
                "extracted_images": [],
                "page_texts": [
                    {"page": 1, "text": "Page 1 content..."}
                ],
                "upload_result": {"uploaded": True, "upload_id": "upload_123"},
                "execution_time": 4.5,
                "error": None
            }
        }


class PDFExtractRequest(BaseModel):
    """PDF-specific extraction request"""
    pdf_data: Optional[str] = Field(None, description="Base64 encoded PDF data")
    pdf_path: Optional[str] = Field(None, description="Local PDF file path")
    pdf_url: Optional[str] = Field(None, description="PDF URL")
    extract_text: bool = Field(default=True, description="Extract text")
    extract_images: bool = Field(default=False, description="Extract images")
    extract_tables: bool = Field(default=False, description="Extract tables")
    page_range: Optional[str] = Field(None, description="Page range (e.g., '1-5', '1,3,5')")
    ocr_if_needed: bool = Field(default=False, description="Use OCR if text extraction fails")
    auto_upload: bool = Field(default=True, description="Automatically upload result")


class PDFExtractResponse(BaseModel):
    """PDF extraction response"""
    success: bool
    message: str
    extract_id: Optional[str] = None
    page_count: Optional[int] = None
    text_by_page: Optional[List[dict]] = Field(None, description="Text content by page")
    images_by_page: Optional[List[dict]] = Field(None, description="Images by page")
    tables_by_page: Optional[List[dict]] = Field(None, description="Tables by page")
    full_text: Optional[str] = Field(None, description="Complete text content")
    upload_result: Optional[dict] = None
    execution_time: float = Field(..., description="Execution time in seconds")
    error: Optional[str] = None
