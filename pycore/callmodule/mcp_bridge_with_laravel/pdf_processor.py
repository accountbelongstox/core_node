#!/usr/bin/env python3
# -*- coding: utf-8 -*-
from pdf2image import convert_from_path
"""
PDF Processing for OCR
Smart PDF splitting, page extraction, and batch processing
"""

import os
import io
import logging
import tempfile
import math
import importlib.util
from typing import List, Dict, Any, Tuple, Optional
from pathlib import Path

from ocr_config import OCRLimits, ProcessingConfig
from pycore.pyfoundations.third_party import get_third_package_pypdf

logger = logging.getLogger(__name__)

# Check for optional dependencies at module level
_pdf2image_available = importlib.util.find_spec("pdf2image") is not None

pypdf = get_third_package_pypdf()

if _pdf2image_available:
else:
    convert_from_path = None

class PDFProcessor:
    """Smart PDF processor for OCR batch processing"""

    def __init__(self):
        self.limits = OCRLimits()
        self.config = ProcessingConfig()
        self.temp_files = []  # Track temporary files for cleanup

    def prepare_pdf_for_ocr(self, pdf_path: str, target_engine: str = "free") -> List[Dict[str, Any]]:
        """
        Prepare PDF for OCR processing by splitting into optimal chunks

        Args:
            pdf_path: Path to input PDF
            target_engine: Target OCR engine ("free" or "tencent")

        Returns:
            List of processing chunks with metadata
        """
        try:
            logger.info(f"Preparing PDF for {target_engine} OCR: {pdf_path}")

            # Get engine limits
            engine_limits = self.limits.FREE_OCR if target_engine == "free" else self.limits.TENCENT_OCR

            # Analyze PDF
            pdf_info = self._analyze_pdf(pdf_path)
            logger.info(f"PDF analysis: {pdf_info['total_pages']} pages, "
                       f"size: {pdf_info['file_size']} bytes")

            # Determine processing strategy
            chunks = self._create_processing_chunks(pdf_path, pdf_info, engine_limits)

            logger.info(f"Created {len(chunks)} processing chunks")
            return chunks

        except Exception as e:
            logger.error(f"PDF preparation failed: {e}")
            raise

    def _analyze_pdf(self, pdf_path: str) -> Dict[str, Any]:
        """Analyze PDF structure and properties"""
        if pypdf is None:
            logger.warning("pypdf not available, returning minimal PDF info")
            return {
                "file_path": pdf_path,
                "file_size": os.path.getsize(pdf_path),
                "total_pages": 1,
                "has_text": False,
                "has_images": True,
                "metadata": {},
                "page_info": [{"page_number": 1, "estimated_complexity": "unknown"}]
            }
        
        try:
            pdf_info = {
                "file_path": pdf_path,
                "file_size": os.path.getsize(pdf_path),
                "total_pages": 0,
                "has_text": False,
                "has_images": False,
                "metadata": {},
                "page_info": []
            }

            with open(pdf_path, 'rb') as file:
                pdf_reader = pypdf.PdfReader(file)
                pdf_info["total_pages"] = len(pdf_reader.pages)

                # Extract metadata
                if pdf_reader.metadata:
                    pdf_info["metadata"] = {
                        "title": pdf_reader.metadata.get('/Title', ''),
                        "author": pdf_reader.metadata.get('/Author', ''),
                        "creator": pdf_reader.metadata.get('/Creator', ''),
                        "producer": pdf_reader.metadata.get('/Producer', ''),
                        "creation_date": str(pdf_reader.metadata.get('/CreationDate', '')),
                    }

                # Analyze each page
                for page_num, page in enumerate(pdf_reader.pages):
                    page_info = {
                        "page_number": page_num + 1,
                        "has_text": False,
                        "text_length": 0,
                        "estimated_complexity": "low"
                    }

                    # Check for text content
                    try:
                        text = page.extract_text()
                        if text and text.strip():
                            page_info["has_text"] = True
                            page_info["text_length"] = len(text.strip())
                            pdf_info["has_text"] = True

                            # Estimate complexity based on text length and structure
                            if len(text) > 1000:
                                page_info["estimated_complexity"] = "high"
                            elif len(text) > 300:
                                page_info["estimated_complexity"] = "medium"

                    except Exception as e:
                        logger.warning(f"Failed to extract text from page {page_num + 1}: {e}")

                    pdf_info["page_info"].append(page_info)

            return pdf_info

        except Exception as e:
            logger.error(f"PDF analysis failed: {e}")
            # Return minimal info
            return {
                "file_path": pdf_path,
                "file_size": os.path.getsize(pdf_path),
                "total_pages": 1,  # Assume single page
                "has_text": False,
                "has_images": True,
                "metadata": {},
                "page_info": [{"page_number": 1, "estimated_complexity": "unknown"}]
            }

    def _create_processing_chunks(self, pdf_path: str, pdf_info: Dict[str, Any],
                                engine_limits: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Create optimal processing chunks based on engine limits"""
        total_pages = pdf_info["total_pages"]
        max_pages_per_chunk = engine_limits["pdf_page_limit"]
        chunks = []

        if total_pages <= max_pages_per_chunk:
            # Single chunk
            chunk = {
                "chunk_id": 0,
                "source_pdf": pdf_path,
                "start_page": 1,
                "end_page": total_pages,
                "page_count": total_pages,
                "processing_type": "direct",
                "estimated_time": self._estimate_chunk_time(pdf_info, 1, total_pages),
                "priority": "normal",
                "file_path": pdf_path  # Use original file
            }
            chunks.append(chunk)

        else:
            # Multiple chunks
            chunk_id = 0
            start_page = 1

            while start_page <= total_pages:
                end_page = min(start_page + max_pages_per_chunk - 1, total_pages)

                # Create chunk file
                chunk_file = self._create_chunk_file(pdf_path, start_page, end_page, chunk_id)

                chunk = {
                    "chunk_id": chunk_id,
                    "source_pdf": pdf_path,
                    "start_page": start_page,
                    "end_page": end_page,
                    "page_count": end_page - start_page + 1,
                    "processing_type": "chunked",
                    "estimated_time": self._estimate_chunk_time(pdf_info, start_page, end_page),
                    "priority": self._determine_priority(pdf_info, start_page, end_page),
                    "file_path": chunk_file
                }
                chunks.append(chunk)

                start_page = end_page + 1
                chunk_id += 1

        return chunks

    def _create_chunk_file(self, pdf_path: str, start_page: int, end_page: int, chunk_id: int) -> str:
        """Create a PDF chunk file with specified page range"""
        if pypdf is None:
            logger.error("pypdf not available, cannot create PDF chunk")
            return pdf_path
        
        try:
            # Generate output path
            original_name = Path(pdf_path).stem
            temp_dir = tempfile.gettempdir()
            chunk_file = os.path.join(temp_dir, f"{original_name}_chunk_{chunk_id}_p{start_page}-{end_page}.pdf")

            # Create PDF writer
            pdf_writer = pypdf.PdfWriter()

            # Read source PDF
            with open(pdf_path, 'rb') as input_file:
                pdf_reader = pypdf.PdfReader(input_file)

                # Add specified pages (convert to 0-based indexing)
                for page_num in range(start_page - 1, end_page):
                    if page_num < len(pdf_reader.pages):
                        pdf_writer.add_page(pdf_reader.pages[page_num])

                # Write chunk file
                with open(chunk_file, 'wb') as output_file:
                    pdf_writer.write(output_file)

            self.temp_files.append(chunk_file)
            logger.info(f"Created PDF chunk: {chunk_file} (pages {start_page}-{end_page})")

            return chunk_file

        except Exception as e:
            logger.error(f"Failed to create PDF chunk: {e}")
            # Fallback: return original file
            return pdf_path

    def _estimate_chunk_time(self, pdf_info: Dict[str, Any], start_page: int, end_page: int) -> float:
        """Estimate processing time for a PDF chunk"""
        page_count = end_page - start_page + 1

        # Base time per page (seconds)
        base_time_per_page = 2.0

        # Complexity factor
        complexity_factor = 1.0
        page_info = pdf_info.get("page_info", [])

        for page_num in range(start_page - 1, min(end_page, len(page_info))):
            if page_num < len(page_info):
                complexity = page_info[page_num].get("estimated_complexity", "medium")
                if complexity == "high":
                    complexity_factor += 0.5
                elif complexity == "low":
                    complexity_factor += 0.2
                else:  # medium
                    complexity_factor += 0.3

        # File size factor
        file_size_mb = pdf_info["file_size"] / (1024 * 1024)
        size_factor = max(1.0, file_size_mb / 5.0)  # Reference: 5MB

        estimated_time = page_count * base_time_per_page * complexity_factor * size_factor
        return max(5.0, estimated_time)  # Minimum 5 seconds

    def _determine_priority(self, pdf_info: Dict[str, Any], start_page: int, end_page: int) -> str:
        """Determine processing priority for a chunk"""
        page_count = end_page - start_page + 1

        # High priority for small chunks or first pages
        if page_count == 1 or start_page == 1:
            return "high"

        # Low priority for large chunks at the end
        if page_count >= 3 and end_page == pdf_info["total_pages"]:
            return "low"

        return "normal"

    def convert_pdf_to_images(self, pdf_path: str, dpi: int = 300) -> List[str]:
        """
        Convert PDF pages to images for OCR processing

        Args:
            pdf_path: Path to PDF file
            dpi: Resolution for conversion

        Returns:
            List of image file paths
        """
        if not _pdf2image_available or convert_from_path is None:
            logger.warning("pdf2image not available, using fallback method")
            return self._fallback_pdf_to_images(pdf_path)
        
        try:
            # Convert PDF to images
            images = convert_from_path(pdf_path, dpi=dpi)
            image_paths = []

            for i, image in enumerate(images):
                # Generate image path
                pdf_name = Path(pdf_path).stem
                temp_dir = tempfile.gettempdir()
                image_path = os.path.join(temp_dir, f"{pdf_name}_page_{i+1}.png")

                # Save image
                image.save(image_path, 'PNG')
                image_paths.append(image_path)
                self.temp_files.append(image_path)

            logger.info(f"Converted PDF to {len(image_paths)} images")
            return image_paths

        except Exception as e:
            logger.error(f"PDF to image conversion failed: {e}")
            return []

    def _fallback_pdf_to_images(self, pdf_path: str) -> List[str]:
        """Fallback method for PDF to image conversion"""
        try:
            # Simple fallback: just return the PDF path
            # In a real implementation, you might use other libraries
            logger.warning("Using PDF directly for OCR (fallback mode)")
            return [pdf_path]

        except Exception as e:
            logger.error(f"Fallback PDF conversion failed: {e}")
            return []

    def merge_ocr_results(self, chunks: List[Dict[str, Any]],
                         chunk_results: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Merge OCR results from multiple PDF chunks

        Args:
            chunks: Original chunk information
            chunk_results: OCR results for each chunk

        Returns:
            Merged OCR result
        """
        try:
            merged_result = {
                "success": True,
                "type": "pdf_batch",
                "total_chunks": len(chunks),
                "successful_chunks": 0,
                "failed_chunks": 0,
                "full_text": "",
                "pages": [],
                "metadata": {
                    "total_pages": sum(chunk["page_count"] for chunk in chunks),
                    "processing_time": 0.0,
                    "providers_used": set()
                },
                "chunk_details": []
            }

            all_text_parts = []
            total_processing_time = 0

            for i, (chunk, result) in enumerate(zip(chunks, chunk_results)):
                chunk_detail = {
                    "chunk_id": chunk["chunk_id"],
                    "pages": f"{chunk['start_page']}-{chunk['end_page']}",
                    "success": result.get("success", False),
                    "provider": result.get("provider", "unknown"),
                    "processing_time": result.get("processing_time", 0),
                    "error": result.get("error") if not result.get("success") else None
                }

                if result.get("success"):
                    merged_result["successful_chunks"] += 1
                    text = result.get("text", "")
                    if text:
                        all_text_parts.append(f"[Page {chunk['start_page']}-{chunk['end_page']}]\n{text}")

                    # Add page details
                    if "pages" in result:
                        for page in result["pages"]:
                            page["original_page"] = chunk["start_page"] + page.get("page", 1) - 1
                            merged_result["pages"].append(page)

                    # Track providers
                    if "provider" in result:
                        merged_result["metadata"]["providers_used"].add(result["provider"])

                else:
                    merged_result["failed_chunks"] += 1

                total_processing_time += result.get("processing_time", 0)
                merged_result["chunk_details"].append(chunk_detail)

            # Finalize merged result
            merged_result["full_text"] = "\n\n".join(all_text_parts)
            merged_result["metadata"]["processing_time"] = total_processing_time
            merged_result["metadata"]["providers_used"] = list(merged_result["metadata"]["providers_used"])

            # Determine overall success
            merged_result["success"] = merged_result["successful_chunks"] > 0

            logger.info(f"Merged PDF OCR results: {merged_result['successful_chunks']}/{merged_result['total_chunks']} chunks successful")

            return merged_result

        except Exception as e:
            logger.error(f"Failed to merge OCR results: {e}")
            return {
                "success": False,
                "error": f"Result merging failed: {str(e)}",
                "type": "pdf_batch"
            }

    def cleanup_temp_files(self):
        """Clean up temporary files created during processing"""
        for temp_file in self.temp_files:
            try:
                if os.path.exists(temp_file):
                    os.unlink(temp_file)
                    logger.debug(f"Cleaned up temp file: {temp_file}")
            except Exception as e:
                logger.warning(f"Failed to cleanup temp file {temp_file}: {e}")

        self.temp_files.clear()

    def __del__(self):
        """Cleanup on object destruction"""
        self.cleanup_temp_files()
