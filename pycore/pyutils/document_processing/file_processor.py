# -*- coding: utf-8 -*-
"""
File Processor - reusable file analysis and text extraction (PDF, DOCX, XLSX, TXT/MD).
"""

import time
import zipfile
from pathlib import Path
from typing import Any, Dict

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.third_party.api import (
    get_third_package_docx,
    get_third_package_openpyxl,
    get_third_package_pdfplumber,
)


def _failure(kind: str, file_path: str, exc: Exception) -> Dict[str, Any]:
    ColorPrint.yellow(f"[FileProcessor] {kind} analysis failed: path={file_path} error={exc}")
    return {"success": False, "error": f"{kind} analysis error: {exc}"}


def _file_metadata(file_path: str, file_type: str) -> Dict[str, Any]:
    path = Path(file_path)
    return {"file_name": path.name, "file_size": path.stat().st_size, "file_type": file_type}


class FileProcessor:
    """Stateless file analyzer routed by file type."""

    def analyze_file(self, file_path: str, config: Dict[str, Any]) -> Dict[str, Any]:
        """
        Analyze a file and extract its content.

        config keys: file_type (optional override), extract_text (default True).
        """
        start_time = time.time()
        if not Path(file_path).exists():
            return {
                "success": False,
                "error": f"File not found: {file_path}",
                "execution_time": time.time() - start_time
            }

        file_type = config.get("file_type") or Path(file_path).suffix.lower().lstrip(".")
        handler = {
            "pdf": self._analyze_pdf,
            "docx": self._analyze_docx,
            "xlsx": self._analyze_xlsx,
            "txt": self._analyze_text,
            "md": self._analyze_text,
        }.get(file_type)
        if handler is None:
            return {
                "success": False,
                "error": f"Unsupported file type: {file_type}",
                "execution_time": time.time() - start_time
            }
        result = handler(file_path, config)
        result["execution_time"] = time.time() - start_time
        return result

    def _analyze_pdf(self, file_path: str, config: Dict[str, Any]) -> Dict[str, Any]:
        pdfplumber = get_third_package_pdfplumber()
        try:
            with pdfplumber.open(file_path) as pdf:
                metadata = _file_metadata(file_path, "pdf")
                metadata["page_count"] = len(pdf.pages)
                page_texts = []
                text_content = None
                if config.get("extract_text", True):
                    page_texts = [{"page": i, "text": page.extract_text() or ""} for i, page in enumerate(pdf.pages, 1)]
                    text_content = "\n\n".join(pt["text"] for pt in page_texts)
                    metadata["word_count"] = len(text_content.split())
        except (OSError, ValueError, pdfplumber.utils.exceptions.PdfminerException) as e:
            return _failure("PDF", file_path, e)
        return {
            "success": True,
            "metadata": metadata,
            "text_content": text_content,
            "page_texts": page_texts,
            "extracted_images": []
        }

    def _analyze_docx(self, file_path: str, config: Dict[str, Any]) -> Dict[str, Any]:
        docx = get_third_package_docx()
        try:
            doc = docx.Document(file_path)
            metadata = _file_metadata(file_path, "docx")
        except (OSError, KeyError, zipfile.BadZipFile, docx.opc.exceptions.OpcError) as e:
            return _failure("DOCX", file_path, e)
        text_content = None
        if config.get("extract_text", True):
            text_content = "\n\n".join(p.text for p in doc.paragraphs if p.text.strip())
            metadata["word_count"] = len(text_content.split())
        return {
            "success": True,
            "metadata": metadata,
            "text_content": text_content,
            "extracted_images": []
        }

    def _analyze_xlsx(self, file_path: str, config: Dict[str, Any]) -> Dict[str, Any]:
        openpyxl = get_third_package_openpyxl()
        try:
            wb = openpyxl.load_workbook(file_path, data_only=True)
            metadata = _file_metadata(file_path, "xlsx")
        except (OSError, KeyError, zipfile.BadZipFile, openpyxl.utils.exceptions.InvalidFileException) as e:
            return _failure("XLSX", file_path, e)
        metadata["sheet_count"] = len(wb.sheetnames)
        text_content = None
        if config.get("extract_text", True):
            sheets_data = []
            for sheet_name in wb.sheetnames:
                rows = []
                for row in wb[sheet_name].iter_rows(values_only=True):
                    row_values = [str(cell) if cell is not None else "" for cell in row]
                    if any(row_values):
                        rows.append("\t".join(row_values))
                sheets_data.append(f"[Sheet: {sheet_name}]\n" + "\n".join(rows))
            text_content = "\n\n".join(sheets_data)
        return {
            "success": True,
            "metadata": metadata,
            "text_content": text_content,
            "extracted_images": []
        }

    def _analyze_text(self, file_path: str, config: Dict[str, Any]) -> Dict[str, Any]:
        try:
            text_content = Path(file_path).read_text(encoding="utf-8")
            metadata = _file_metadata(file_path, Path(file_path).suffix.lstrip("."))
        except (OSError, UnicodeDecodeError) as e:
            return _failure("Text file", file_path, e)
        metadata["word_count"] = len(text_content.split())
        return {
            "success": True,
            "metadata": metadata,
            "text_content": text_content,
            "extracted_images": []
        }


file_processor = FileProcessor()
