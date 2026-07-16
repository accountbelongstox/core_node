# -*- coding: utf-8 -*-
"""
File Processor - Core logic for file analysis and processing
"""

import time
from typing import Dict, Any, List
from pathlib import Path

from pycore.pyfoundations.system_paths import get_app_temp_dir

from pycore.pyfoundations.third_party import get_third_package_pdfplumber
from pycore.pyfoundations.third_party import get_third_package_openpyxl



class FileProcessor:
    """Processor for file analysis (PDF, DOCX, XLSX, etc.)"""

    def __init__(self):
        self.output_dir = get_app_temp_dir() / "files"
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def analyze_file(self, file_path: str, config: Dict[str, Any]) -> Dict[str, Any]:
        """
        Analyze file and extract content.

        Args:
            file_path: Path to file
            config: Analysis configuration
                - file_type: File type
                - extract_text: Extract text flag
                - extract_images: Extract images flag
                - extract_metadata: Extract metadata flag

        Returns:
            Dictionary with analysis result
        """
        start_time = time.time()

        try:
            # Check if file exists
            if not Path(file_path).exists():
                return {
                    "success": False,
                    "error": f"File not found: {file_path}",
                    "execution_time": time.time() - start_time
                }

            # Detect file type
            file_path_obj = Path(file_path)
            file_type = config.get("file_type") or file_path_obj.suffix.lower().lstrip(".")

            # Route to appropriate handler
            if file_type == "pdf":
                result = self._analyze_pdf(file_path, config)
            elif file_type == "docx":
                result = self._analyze_docx(file_path, config)
            elif file_type == "xlsx":
                result = self._analyze_xlsx(file_path, config)
            elif file_type in ["txt", "md"]:
                result = self._analyze_text(file_path, config)
            else:
                return {
                    "success": False,
                    "error": f"Unsupported file type: {file_type}",
                    "execution_time": time.time() - start_time
                }

            result["execution_time"] = time.time() - start_time
            return result

        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "execution_time": time.time() - start_time
            }

    def _analyze_pdf(self, file_path: str, config: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze PDF file"""
        try:
            pdfplumber = get_third_package_pdfplumber()

            with pdfplumber.open(file_path) as pdf:
                # Extract metadata
                metadata = {
                    "file_name": Path(file_path).name,
                    "file_size": Path(file_path).stat().st_size,
                    "file_type": "pdf",
                    "page_count": len(pdf.pages)
                }

                # Extract text if requested
                text_content = None
                page_texts = []
                word_count = 0

                if config.get("extract_text", True):
                    for i, page in enumerate(pdf.pages, 1):
                        page_text = page.extract_text() or ""
                        page_texts.append({"page": i, "text": page_text})
                        word_count += len(page_text.split())

                    text_content = "\n\n".join([pt["text"] for pt in page_texts])
                    metadata["word_count"] = word_count

                # Extract images if requested
                extracted_images = []
                if config.get("extract_images", False):
                    # TODO: Implement image extraction from PDF
                    pass

                return {
                    "success": True,
                    "metadata": metadata,
                    "text_content": text_content,
                    "page_texts": page_texts,
                    "extracted_images": extracted_images
                }

        except ImportError:
            return {
                "success": False,
                "error": "pdfplumber not available. Install with: pip install pdfplumber"
            }
        except Exception as e:
            return {
                "success": False,
                "error": f"PDF analysis error: {str(e)}"
            }

    def _analyze_docx(self, file_path: str, config: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze DOCX file"""
        try:

            doc = Document(file_path)

            # Extract metadata
            metadata = {
                "file_name": Path(file_path).name,
                "file_size": Path(file_path).stat().st_size,
                "file_type": "docx"
            }

            # Extract text
            text_content = None
            if config.get("extract_text", True):
                paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
                text_content = "\n\n".join(paragraphs)
                metadata["word_count"] = len(text_content.split())

            return {
                "success": True,
                "metadata": metadata,
                "text_content": text_content,
                "extracted_images": []
            }

        except ImportError:
            return {
                "success": False,
                "error": "python-docx not available. Install with: pip install python-docx"
            }
        except Exception as e:
            return {
                "success": False,
                "error": f"DOCX analysis error: {str(e)}"
            }

    def _analyze_xlsx(self, file_path: str, config: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze XLSX file"""
        try:
            openpyxl = get_third_package_openpyxl()

            wb = openpyxl.load_workbook(file_path, data_only=True)

            # Extract metadata
            metadata = {
                "file_name": Path(file_path).name,
                "file_size": Path(file_path).stat().st_size,
                "file_type": "xlsx",
                "sheet_count": len(wb.sheetnames)
            }

            # Extract text/data
            text_content = None
            if config.get("extract_text", True):
                sheets_data = []
                for sheet_name in wb.sheetnames:
                    sheet = wb[sheet_name]
                    rows = []
                    for row in sheet.iter_rows(values_only=True):
                        row_values = [str(cell) if cell is not None else "" for cell in row]
                        if any(row_values):  # Skip empty rows
                            rows.append("\t".join(row_values))
                    sheets_data.append(f"[Sheet: {sheet_name}]\n" + "\n".join(rows))

                text_content = "\n\n".join(sheets_data)

            return {
                "success": True,
                "metadata": metadata,
                "text_content": text_content,
                "extracted_images": []
            }

        except ImportError:
            return {
                "success": False,
                "error": "openpyxl not available. Install with: pip install openpyxl"
            }
        except Exception as e:
            return {
                "success": False,
                "error": f"XLSX analysis error: {str(e)}"
            }

    def _analyze_text(self, file_path: str, config: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze text file"""
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                text_content = f.read()

            metadata = {
                "file_name": Path(file_path).name,
                "file_size": Path(file_path).stat().st_size,
                "file_type": Path(file_path).suffix.lstrip("."),
                "word_count": len(text_content.split())
            }

            return {
                "success": True,
                "metadata": metadata,
                "text_content": text_content,
                "extracted_images": []
            }

        except Exception as e:
            return {
                "success": False,
                "error": f"Text file analysis error: {str(e)}"
            }
