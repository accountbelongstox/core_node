#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Document Parser with Text Positions and Metadata Extraction
Comprehensive document parsing for PDF, DOCX, XLSX, PPTX with text positions and metadata
"""

import logging
import hashlib
import os
from typing import Dict, Any, List, Optional
from datetime import datetime
from pathlib import Path

from pycore.pyfoundations.serialized_worker import SerializedSingletonProvider
from pycore.pyfoundations.third_party import get_third_package_pypdf, get_third_package_pdfplumber, get_third_package_python_docx, get_third_package_openpyxl, get_third_package_python_pptx

pypdf = get_third_package_pypdf()
pdfplumber = get_third_package_pdfplumber()
python_docx = get_third_package_python_docx()
openpyxl = get_third_package_openpyxl()
python_pptx = get_third_package_python_pptx()
from pycore.pyfoundations.pygvar import PYTOOLS_TMP_DIR

logger = logging.getLogger(__name__)


class DocumentParserWithTextPositionsAndMetadataExtraction:
    """Comprehensive document parser for PDF and Office documents"""

    async def parse_document_comprehensive_with_text_positions_metadata_images_tables_and_hyperlinks(
        self,
        document_path: str,
        extract_images: bool = True,
        extract_tables: bool = True,
        extract_hyperlinks: bool = True
    ) -> Dict[str, Any]:
        """
        Parse document and extract comprehensive information

        Args:
            document_path: Path to document file
            extract_images: Whether to extract embedded images
            extract_tables: Whether to extract tables
            extract_hyperlinks: Whether to extract hyperlinks

        Returns:
            Comprehensive document analysis dictionary
        """
        start_time = datetime.utcnow()

        # Detect document type
        file_ext = Path(document_path).suffix.lower()

        if file_ext == '.pdf':
            result = await self.parse_pdf_document_with_text_extraction_metadata_images_tables_and_hyperlinks(
                document_path, extract_images, extract_tables, extract_hyperlinks
            )
        elif file_ext == '.docx':
            result = await self.parse_word_document_with_text_paragraphs_styles_images_and_metadata(
                document_path, extract_images
            )
        elif file_ext == '.xlsx':
            result = await self.parse_excel_spreadsheet_with_sheets_cells_formulas_and_data_ranges(
                document_path
            )
        elif file_ext == '.pptx':
            result = await self.parse_powerpoint_presentation_with_slides_text_images_and_speaker_notes(
                document_path, extract_images
            )
        else:
            logger.error("[ERROR] Unsupported document type: %s", file_ext)
            return {
                "file_type": "unknown",
                "file_path": document_path,
                "error": "Unsupported document type: %s" % file_ext
            }

        # Add processing stats
        processing_duration = (datetime.utcnow() - start_time).total_seconds()
        result["processing_comprehensive_stats"] = {
            "processing_timestamp_utc": start_time.isoformat(),
            "processing_duration_seconds": round(processing_duration, 3),
            "processing_methods_applied": result.get("processing_methods_applied", []),
            "processing_engine_versions": result.get("processing_engine_versions", {}),
            "errors_and_warnings": result.get("errors_and_warnings", [])
        }

        return result

    async def parse_pdf_document_with_text_extraction_metadata_images_tables_and_hyperlinks(
        self,
        pdf_path: str,
        extract_images: bool = True,
        extract_tables: bool = True,
        extract_hyperlinks: bool = True
    ) -> Dict[str, Any]:
        """Parse PDF document with comprehensive information extraction"""
        processing_methods = ["pdf_text_extraction", "pdf_metadata_extraction"]

        # Extract text with positions using pdfplumber
        text_with_positions = []
        full_text_content = ""
        total_pages = 0
        tables_extraction = []

        with pdfplumber.open(pdf_path) as pdf:
            total_pages = len(pdf.pages)

            for page_num, page in enumerate(pdf.pages, start=1):
                page_text = page.extract_text() or ""
                full_text_content += page_text + "\n"

                # Extract text with positions
                words = page.extract_words()
                for word in words:
                    text_with_positions.append({
                        "page_number": page_num,
                        "text_content": word.get("text", ""),
                        "bounding_box_coordinates": {
                            "x1": round(word.get("x0", 0), 2),
                            "y1": round(word.get("top", 0), 2),
                            "x2": round(word.get("x1", 0), 2),
                            "y2": round(word.get("bottom", 0), 2)
                        },
                        "font_info": {
                            "font_family": word.get("fontname", "Unknown"),
                            "font_size": round(word.get("height", 0), 2),
                            "is_bold": "Bold" in word.get("fontname", ""),
                            "is_italic": "Italic" in word.get("fontname", "")
                        }
                    })

                # Extract tables if requested
                if extract_tables:
                    page_tables = page.extract_tables()
                    for table_idx, table in enumerate(page_tables):
                        if table:
                            tables_extraction.append({
                                "table_index": len(tables_extraction),
                                "page_number": page_num,
                                "rows": len(table),
                                "columns": len(table[0]) if table else 0,
                                "data": table
                            })
                    if page_tables:
                        processing_methods.append("table_extraction")

        # Extract metadata using pypdf
        metadata = await self._extract_pdf_metadata(pdf_path)

        # Extract images if requested
        embedded_images = []
        if extract_images:
            embedded_images = await self._extract_pdf_images(pdf_path)
            if embedded_images:
                processing_methods.append("image_extraction")

        # Extract hyperlinks if requested
        hyperlinks_extraction = []
        if extract_hyperlinks:
            hyperlinks_extraction = await self._extract_pdf_hyperlinks(pdf_path)
            if hyperlinks_extraction:
                processing_methods.append("hyperlink_extraction")

        # Calculate file info
        file_size_bytes = os.path.getsize(pdf_path)
        file_hash = await self._calculate_file_hash_sha256(pdf_path)

        return {
            "file_type": "pdf",
            "file_path": pdf_path,
            "file_size_bytes": file_size_bytes,
            "file_hash_sha256": file_hash,
            "mime_type": "application/pdf",
            "document_comprehensive_parsing": {
                "document_type": "pdf",
                "total_pages": total_pages,
                "full_text_content": full_text_content.strip(),
                "text_extraction_with_page_positions": text_with_positions,
                "document_metadata_extraction": metadata,
                "embedded_images_analysis": embedded_images,
                "tables_extraction": tables_extraction,
                "hyperlinks_extraction": hyperlinks_extraction
            },
            "processing_methods_applied": processing_methods,
            "processing_engine_versions": {
                "pdf_parser": "pdfplumber",
                "pdf_metadata": "pypdf"
            },
            "errors_and_warnings": []
        }

    async def parse_word_document_with_text_paragraphs_styles_images_and_metadata(
        self, docx_path: str, extract_images: bool = True
    ) -> Dict[str, Any]:
        """Parse Word document with comprehensive information extraction"""
        processing_methods = ["docx_text_extraction", "docx_metadata_extraction"]

        doc = python_docx.Document(docx_path)

        # Extract text with paragraph information
        text_with_positions = []
        full_text_content = ""

        for para_idx, para in enumerate(doc.paragraphs):
            para_text = para.text
            full_text_content += para_text + "\n"

            if para_text.strip():
                text_with_positions.append({
                    "page_number": 1,  # Word doesn't have strict page concept in API
                    "text_content": para_text,
                    "bounding_box_coordinates": {
                        "x1": 0, "y1": 0, "x2": 0, "y2": 0  # Not available in python-docx
                    },
                    "font_info": {
                        "font_family": para.style.font.name if para.style.font.name else "Unknown",
                        "font_size": float(para.style.font.size.pt) if para.style.font.size else 0,
                        "is_bold": para.style.font.bold or False,
                        "is_italic": para.style.font.italic or False
                    }
                })

        # Extract metadata
        metadata = await self._extract_docx_metadata(doc)

        # Extract images if requested
        embedded_images = []
        if extract_images:
            embedded_images = await self._extract_docx_images(doc, docx_path)
            if embedded_images:
                processing_methods.append("image_extraction")

        # Extract tables
        tables_extraction = []
        for table_idx, table in enumerate(doc.tables):
            table_data = []
            for row in table.rows:
                row_data = [cell.text for cell in row.cells]
                table_data.append(row_data)

            tables_extraction.append({
                "table_index": table_idx,
                "page_number": 1,
                "rows": len(table.rows),
                "columns": len(table.columns),
                "data": table_data
            })

        if tables_extraction:
            processing_methods.append("table_extraction")

        # Calculate file info
        file_size_bytes = os.path.getsize(docx_path)
        file_hash = await self._calculate_file_hash_sha256(docx_path)

        return {
            "file_type": "docx",
            "file_path": docx_path,
            "file_size_bytes": file_size_bytes,
            "file_hash_sha256": file_hash,
            "mime_type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "document_comprehensive_parsing": {
                "document_type": "docx",
                "total_pages": len(doc.sections),
                "full_text_content": full_text_content.strip(),
                "text_extraction_with_page_positions": text_with_positions,
                "document_metadata_extraction": metadata,
                "embedded_images_analysis": embedded_images,
                "tables_extraction": tables_extraction,
                "hyperlinks_extraction": []  # Would require deeper parsing
            },
            "processing_methods_applied": processing_methods,
            "processing_engine_versions": {
                "docx_parser": "python-docx"
            },
            "errors_and_warnings": []
        }

    async def parse_excel_spreadsheet_with_sheets_cells_formulas_and_data_ranges(
        self, xlsx_path: str
    ) -> Dict[str, Any]:
        """Parse Excel spreadsheet with comprehensive sheet and cell information"""
        processing_methods = ["xlsx_data_extraction", "xlsx_formula_extraction"]

        workbook = openpyxl.load_workbook(xlsx_path, data_only=False)

        sheets_data = []
        total_sheets = len(workbook.sheetnames)

        for sheet_idx, sheet_name in enumerate(workbook.sheetnames):
            sheet = workbook[sheet_name]

            # Get data range
            if sheet.max_row > 0 and sheet.max_column > 0:
                data_range = f"A1:{openpyxl.utils.get_column_letter(sheet.max_column)}{sheet.max_row}"
            else:
                data_range = "A1:A1"

            # Extract cell data
            cell_data = []
            formulas = []

            for row in sheet.iter_rows(values_only=False):
                row_data = []
                for cell in row:
                    cell_value = cell.value
                    row_data.append(str(cell_value) if cell_value is not None else "")

                    # Check for formulas
                    if isinstance(cell.value, str) and cell.value.startswith('='):
                        formulas.append({
                            "cell": cell.coordinate,
                            "formula": cell.value
                        })

                cell_data.append(row_data)

            sheets_data.append({
                "sheet_name": sheet_name,
                "sheet_index": sheet_idx,
                "total_rows": sheet.max_row,
                "total_columns": sheet.max_column,
                "data_range": data_range,
                "cell_data": cell_data,
                "formulas": formulas
            })

        # Calculate file info
        file_size_bytes = os.path.getsize(xlsx_path)
        file_hash = await self._calculate_file_hash_sha256(xlsx_path)

        return {
            "file_type": "xlsx",
            "file_path": xlsx_path,
            "file_size_bytes": file_size_bytes,
            "file_hash_sha256": file_hash,
            "mime_type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "excel_spreadsheet_analysis": {
                "total_sheets": total_sheets,
                "sheets_data": sheets_data
            },
            "processing_methods_applied": processing_methods,
            "processing_engine_versions": {
                "xlsx_parser": "openpyxl"
            },
            "errors_and_warnings": []
        }

    async def parse_powerpoint_presentation_with_slides_text_images_and_speaker_notes(
        self, pptx_path: str, extract_images: bool = True
    ) -> Dict[str, Any]:
        """Parse PowerPoint presentation with comprehensive slide information"""
        processing_methods = ["pptx_text_extraction", "pptx_slide_extraction"]

        presentation = python_pptx.Presentation(pptx_path)

        slides_data = []
        full_text_content = ""

        for slide_idx, slide in enumerate(presentation.slides, start=1):
            slide_text = ""
            shapes_data = []

            for shape in slide.shapes:
                if hasattr(shape, "text"):
                    shape_text = shape.text
                    slide_text += shape_text + "\n"

                    shapes_data.append({
                        "text": shape_text,
                        "shape_type": str(shape.shape_type)
                    })

            full_text_content += slide_text

            # Extract speaker notes
            notes_text = ""
            if slide.has_notes_slide:
                notes_slide = slide.notes_slide
                if notes_slide.notes_text_frame:
                    notes_text = notes_slide.notes_text_frame.text

            slides_data.append({
                "slide_number": slide_idx,
                "slide_text": slide_text.strip(),
                "shapes": shapes_data,
                "speaker_notes": notes_text
            })

        # Calculate file info
        file_size_bytes = os.path.getsize(pptx_path)
        file_hash = await self._calculate_file_hash_sha256(pptx_path)

        return {
            "file_type": "pptx",
            "file_path": pptx_path,
            "file_size_bytes": file_size_bytes,
            "file_hash_sha256": file_hash,
            "mime_type": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
            "document_comprehensive_parsing": {
                "document_type": "pptx",
                "total_pages": len(presentation.slides),
                "full_text_content": full_text_content.strip(),
                "slides_data": slides_data
            },
            "processing_methods_applied": processing_methods,
            "processing_engine_versions": {
                "pptx_parser": "python-pptx"
            },
            "errors_and_warnings": []
        }

    async def _extract_pdf_metadata(self, pdf_path: str) -> Dict[str, Any]:
        """Extract PDF metadata using pypdf"""
        metadata = {
            "title": "",
            "author": "",
            "subject": "",
            "keywords": [],
            "created_date": "",
            "modified_date": "",
            "application_name": "",
            "total_words": 0,
            "total_characters": 0
        }

        with open(pdf_path, 'rb') as file:
            pdf_reader = pypdf.PdfReader(file)
            if pdf_reader.metadata:
                metadata["title"] = pdf_reader.metadata.get('/Title', '') or ''
                metadata["author"] = pdf_reader.metadata.get('/Author', '') or ''
                metadata["subject"] = pdf_reader.metadata.get('/Subject', '') or ''
                metadata["created_date"] = str(pdf_reader.metadata.get('/CreationDate', ''))
                metadata["modified_date"] = str(pdf_reader.metadata.get('/ModDate', ''))
                metadata["application_name"] = pdf_reader.metadata.get('/Creator', '') or ''

                keywords_str = pdf_reader.metadata.get('/Keywords', '')
                if keywords_str:
                    metadata["keywords"] = [k.strip() for k in str(keywords_str).split(',')]

        return metadata

    async def _extract_pdf_images(self, pdf_path: str) -> List[Dict[str, Any]]:
        """Extract embedded images from PDF"""
        images = []
        # Image extraction from PDF requires additional libraries like pdf2image
        # For now, return empty list
        logger.warning("[WARNING] PDF image extraction not fully implemented")
        return images

    async def _extract_pdf_hyperlinks(self, pdf_path: str) -> List[Dict[str, Any]]:
        """Extract hyperlinks from PDF"""
        hyperlinks = []
        # Hyperlink extraction requires deeper PDF parsing
        # For now, return empty list
        logger.warning("[WARNING] PDF hyperlink extraction not fully implemented")
        return hyperlinks

    async def _extract_docx_metadata(self, doc) -> Dict[str, Any]:
        """Extract Word document metadata"""
        core_props = doc.core_properties

        metadata = {
            "title": core_props.title or "",
            "author": core_props.author or "",
            "subject": core_props.subject or "",
            "keywords": core_props.keywords.split(',') if core_props.keywords else [],
            "created_date": core_props.created.isoformat() if core_props.created else "",
            "modified_date": core_props.modified.isoformat() if core_props.modified else "",
            "application_name": "",
            "total_words": 0,
            "total_characters": 0
        }

        return metadata

    async def _extract_docx_images(self, doc, docx_path: str) -> List[Dict[str, Any]]:
        """Extract embedded images from Word document"""
        images = []
        # Image extraction from DOCX requires parsing relationships
        # For now, return empty list
        logger.warning("[WARNING] DOCX image extraction not fully implemented")
        return images

    async def _calculate_file_hash_sha256(self, file_path: str) -> str:
        """Calculate SHA256 hash of file"""
        sha256_hash = hashlib.sha256()
        with open(file_path, "rb") as f:
            for byte_block in iter(lambda: f.read(4096), b""):
                sha256_hash.update(byte_block)
        return sha256_hash.hexdigest()


_DOCUMENT_PARSER_PROVIDER = SerializedSingletonProvider(
    DocumentParserWithTextPositionsAndMetadataExtraction,
    "mcp.document_parser.provider",
    "MCPDocumentParserProviderThread",
)

def get_document_parser_singleton() -> DocumentParserWithTextPositionsAndMetadataExtraction:
    """Get singleton instance of document parser"""
    return _DOCUMENT_PARSER_PROVIDER.get()
