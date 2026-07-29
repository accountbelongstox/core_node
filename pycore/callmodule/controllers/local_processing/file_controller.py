# -*- coding: utf-8 -*-
"""File Controller"""
from pycore.callmodule.services.processors.file_processor import FileProcessor
from ...models.local_processing.file_models import FileAnalyzeRequest, FileAnalyzeResponse

class FileController:
    def __init__(self):
        self.processor = FileProcessor()
    
    def analyze(self, request: FileAnalyzeRequest) -> FileAnalyzeResponse:
        file_path = request.file_path or request.file_url
        config = {
            "file_type": request.file_type,
            "extract_text": request.extract_text,
            "extract_images": request.extract_images,
            "extract_metadata": request.extract_metadata
        }
        result = self.processor.analyze_file(file_path, config)
        return FileAnalyzeResponse(
            success=result.get("success", False),
            message=result.get("message", "File analysis completed"),
            metadata=result.get("metadata"),
            text_content=result.get("text_content"),
            extracted_images=result.get("extracted_images"),
            page_texts=result.get("page_texts"),
            execution_time=result.get("execution_time", 0.0),
            error=result.get("error")
        )
