#!/usr/bin/env python3
"""Codebase Content Hub MCP server."""

import json
import logging
import os
import stat
import subprocess
import sys
import threading
import time
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
import importlib

from pyapps.codebase_content_hub.service.constants import ContentHubConstants

from pycore.pyfoundations.third_party import get_third_package_fastmcp

fastmcp = get_third_package_fastmcp()
from fastmcp import FastMCP

mcp = FastMCP(ContentHubConstants.SERVICE_NAME)
logger = logging.getLogger("codebase_content_hub")
package_lock = threading.Lock()
OCR_ENGINE_CACHE: Dict[str, Any] = {"initialized": False, "engine": None, "type": "none"}


def setup_logging() -> None:
    ContentHubConstants.ensure_directories()
    log_format = "%(asctime)s [%(levelname)s] [ContentHub] %(message)s"
    handlers = [logging.StreamHandler(sys.stderr)]
    try:
        file_handler = logging.FileHandler(ContentHubConstants.LOG_FILE, encoding="utf-8")
        handlers.append(file_handler)
    except OSError:
        pass
    logging.basicConfig(level=logging.INFO, format=log_format, handlers=handlers)


def ensure_packages() -> None:
    required = ContentHubConstants.REQUIRED_PACKAGES
    mapping = ContentHubConstants.PACKAGE_IMPORT_MAPPING
    for package in required:
        module_name = mapping.get(package, package)
        try:
            importlib.import_module(module_name)
            continue
        except ImportError:
            pass
        with package_lock:
            try:
                importlib.import_module(module_name)
                continue
            except ImportError:
                install_cmd = [sys.executable, "-m", "pip", "install", package, "--quiet"]
                try:
                    subprocess.run(install_cmd, check=False, capture_output=True, timeout=60)
                except Exception as exc:  # pragma: no cover
                    logger.warning("Package install failed for %s: %s", package, exc)


def path_to_dict(target: Path, include_files: bool, include_hidden: bool, max_depth: int,
                 current_depth: int = 0, entry_limit: int = 500) -> Dict[str, Any]:
    node: Dict[str, Any] = {
        "name": target.name or str(target),
        "path": str(target),
        "type": "directory" if target.is_dir() else "file",
        "children": []
    }
    if target.is_file():
        node.update(_build_file_metadata(target))
        return node
    if current_depth >= max_depth:
        node["truncated"] = True
        return node
    try:
        entries = list(target.iterdir())
    except (OSError, PermissionError) as exc:
        node["error"] = str(exc)
        return node
    included_count = 0
    for entry in sorted(entries, key=lambda p: (p.is_file(), p.name.lower())):
        if included_count >= entry_limit:
            node.setdefault("notes", []).append("entry limit reached")
            break
        if not include_hidden and entry.name.startswith('.'):
            continue
        if entry.is_dir():
            child = path_to_dict(entry, include_files, include_hidden, max_depth, current_depth + 1,
                                 entry_limit)
            node["children"].append(child)
            included_count += 1
        elif include_files:
            file_info = _build_file_metadata(entry)
            file_info["type"] = "file"
            node["children"].append(file_info)
            included_count += 1
    return node


def _build_file_metadata(path_obj: Path) -> Dict[str, Any]:
    stat_info = path_obj.stat()
    return {
        "path": str(path_obj),
        "name": path_obj.name,
        "size_bytes": stat_info.st_size,
        "modified": datetime.fromtimestamp(stat_info.st_mtime).isoformat(),
        "created": datetime.fromtimestamp(stat_info.st_ctime).isoformat(),
        "mode": oct(stat_info.st_mode),
    }


def resolve_path(raw_path: str) -> Path:
    candidate = Path(raw_path)
    if not candidate.is_absolute():
        candidate = ContentHubConstants.PROJECT_ROOT / raw_path
    candidate = candidate.resolve()
    return candidate


def read_text_file(file_path: Path, max_chars: int) -> Dict[str, Any]:
    try:
        with open(file_path, "r", encoding="utf-8") as handle:
            data = handle.read()
    except UnicodeDecodeError:
        with open(file_path, "r", encoding="utf-8", errors="ignore") as handle:
            data = handle.read()
    snippet = data[:max_chars]
    return {
        "text": snippet,
        "truncated": len(data) > max_chars,
        "encoding": "utf-8",
    }


def _import_optional(module_name: str) -> Optional[Any]:
    try:
        return importlib.import_module(module_name)
    except ImportError:
        return None


def read_pdf_file(file_path: Path, max_chars: int) -> Dict[str, Any]:
    fitz_module = _import_optional("fitz")
    text_chunks: List[str] = []
    metadata: Dict[str, Any] = {}
    page_summaries: List[Dict[str, Any]] = []
    if fitz_module:
        doc = fitz_module.open(file_path)
        metadata = doc.metadata or {}
        metadata["page_count"] = doc.page_count
        for index in range(doc.page_count):
            page = doc.load_page(index)
            extracted = page.get_text("text")
            text_chunks.append(extracted)
            page_summaries.append({
                "page": index + 1,
                "characters": len(extracted)
            })
        doc.close()
    else:
        pypdf_module = _import_optional("pypdf")
        if pypdf_module:
            with open(file_path, "rb") as handle:
                reader = pypdf_module.PdfReader(handle)
                metadata["page_count"] = len(reader.pages)
                for index, page in enumerate(reader.pages):
                    text = page.extract_text() or ""
                    text_chunks.append(text)
                    page_summaries.append({
                        "page": index + 1,
                        "characters": len(text)
                    })
    combined = "\n".join(text_chunks)
    snippet = combined[:max_chars]
    return {
        "text": snippet,
        "truncated": len(combined) > max_chars,
        "metadata": metadata,
        "pages": page_summaries,
    }


def read_docx_file(file_path: Path, max_chars: int) -> Dict[str, Any]:
    docx_module = _import_optional("docx")
    if not docx_module:
        return {"text": "", "truncated": False, "metadata": {"error": "python-docx missing"}}
    document = docx_module.Document(str(file_path))
    paragraphs = [para.text for para in document.paragraphs]
    combined = "\n".join(paragraphs)
    properties = document.core_properties
    metadata = {
        "author": properties.author,
        "title": properties.title,
        "created": str(properties.created),
    }
    snippet = combined[:max_chars]
    return {
        "text": snippet,
        "truncated": len(combined) > max_chars,
        "metadata": metadata,
    }


def read_excel_file(file_path: Path, max_rows: int = 50, max_cols: int = 20) -> Dict[str, Any]:
    openpyxl_module = _import_optional("openpyxl")
    if not openpyxl_module:
        return {"rows": [], "metadata": {"error": "openpyxl missing"}}
    workbook = openpyxl_module.load_workbook(file_path, data_only=True, read_only=True)
    sheet = workbook.active
    rows: List[List[Any]] = []
    for row_index, row in enumerate(sheet.iter_rows(values_only=True)):
        if row_index >= max_rows:
            break
        row_values = []
        for col_index, value in enumerate(row):
            if col_index >= max_cols:
                break
            row_values.append(value)
        rows.append(row_values)
    metadata = {
        "sheet_name": sheet.title,
        "rows_sampled": len(rows),
        "columns_sampled": max_cols,
    }
    workbook.close()
    return {"rows": rows, "metadata": metadata}


def read_pptx_file(file_path: Path, max_chars: int) -> Dict[str, Any]:
    pptx_module = _import_optional("pptx")
    if not pptx_module:
        return {"slides": [], "metadata": {"error": "python-pptx missing"}}
    presentation = pptx_module.Presentation(str(file_path))
    slides: List[Dict[str, Any]] = []
    total_text = ""
    for index, slide in enumerate(presentation.slides, start=1):
        slide_text_parts: List[str] = []
        for shape in slide.shapes:
            if hasattr(shape, "text"):
                slide_text_parts.append(shape.text)
        slide_text = "\n".join(slide_text_parts)
        total_text += slide_text + "\n"
        slides.append({"slide": index, "text": slide_text[:max_chars]})
    snippet = total_text[:max_chars]
    metadata = {"slides": len(presentation.slides)}
    return {"text": snippet, "slides": slides, "truncated": len(total_text) > max_chars, "metadata": metadata}


def read_image_file(file_path: Path, max_chars: int) -> Dict[str, Any]:
    pil_image_module = _import_optional("PIL.Image")
    if not pil_image_module:
        return {"metadata": {"error": "Pillow missing"}}
    with pil_image_module.open(file_path) as image_obj:
        metadata = {
            "format": image_obj.format,
            "mode": image_obj.mode,
            "width": image_obj.width,
            "height": image_obj.height,
            "info": {key: str(value) for key, value in image_obj.info.items()}
        }
        ocr_result = run_image_ocr(file_path)
        metadata.update(ocr_result.get("metadata", {}))
        return {
            "metadata": metadata,
            "ocr_text": ocr_result.get("text", ""),
            "ocr_blocks": ocr_result.get("blocks", []),
            "truncated": False,
        }


def run_image_ocr(file_path: Path) -> Dict[str, Any]:
    backend = get_ocr_backend()
    if backend["type"] == "paddleocr":
        try:
            result = backend["engine"].ocr(str(file_path), cls=True)
        except Exception as exc:
            logger.warning("PaddleOCR failed: %s", exc)
            return {"text": "", "blocks": [], "metadata": {"ocr_backend": "paddleocr", "error": str(exc)}}
        lines: List[str] = []
        blocks: List[Dict[str, Any]] = []
        for item in result:
            for entry in item:
                box, content = entry
                text = content[0]
                confidence = content[1]
                lines.append(text)
                blocks.append({"text": text, "confidence": confidence, "box": box})
        return {"text": "\n".join(lines), "blocks": blocks, "metadata": {"ocr_backend": "paddleocr"}}
    if backend["type"] == "pytesseract":
        pytesseract = backend["engine"]
        image_module = backend["image_module"]
        with image_module.open(file_path) as image_obj:
            text = pytesseract.image_to_string(image_obj)
            data = pytesseract.image_to_data(image_obj, output_type=pytesseract.Output.DICT)
        blocks: List[Dict[str, Any]] = []
        for idx in range(len(data["text"])):
            word = data["text"][idx]
            if not word.strip():
                continue
            box = [
                [data["left"][idx], data["top"][idx]],
                [data["left"][idx] + data["width"][idx], data["top"][idx]],
                [data["left"][idx] + data["width"][idx], data["top"][idx] + data["height"][idx]],
                [data["left"][idx], data["top"][idx] + data["height"][idx]],
            ]
            blocks.append({
                "text": word,
                "confidence": float(data["conf"][idx]),
                "box": box,
            })
        return {
            "text": text,
            "blocks": blocks,
            "metadata": {"ocr_backend": "pytesseract"}
        }
    return {"text": "", "blocks": [], "metadata": {"ocr_backend": "none"}}


def get_ocr_backend() -> Dict[str, Any]:
    if OCR_ENGINE_CACHE["initialized"]:
        return OCR_ENGINE_CACHE
    with package_lock:
        if OCR_ENGINE_CACHE["initialized"]:
            return OCR_ENGINE_CACHE
        paddle_module = _import_optional("paddleocr")
        if paddle_module:
            try:
                PaddleOCR = getattr(paddle_module, "PaddleOCR")
                OCR_ENGINE_CACHE.update({
                    "initialized": True,
                    "engine": PaddleOCR(use_angle_cls=True, show_log=False),
                    "type": "paddleocr"
                })
                return OCR_ENGINE_CACHE
            except Exception as exc:
                logger.warning("PaddleOCR init failed: %s", exc)
        pytesseract = _import_optional("pytesseract")
        image_module = _import_optional("PIL.Image")
        if pytesseract and image_module:
            OCR_ENGINE_CACHE.update({
                "initialized": True,
                "engine": pytesseract,
                "image_module": image_module,
                "type": "pytesseract"
            })
            return OCR_ENGINE_CACHE
        OCR_ENGINE_CACHE.update({"initialized": True, "engine": None, "type": "none"})
    return OCR_ENGINE_CACHE


def read_binary_file(file_path: Path, max_bytes: int = 2048) -> Dict[str, Any]:
    with open(file_path, "rb") as handle:
        data = handle.read(max_bytes)
    return {
        "bytes_sample": data.hex(),
        "truncated": os.path.getsize(file_path) > max_bytes,
    }


def describe_file(file_path: Path, max_chars: int) -> Dict[str, Any]:
    suffix = file_path.suffix.lower()
    if suffix in {".txt", ".md", ".py", ".js", ".json", ".xml", ".html", ".csv", ".yaml", ".yml"}:
        return read_text_file(file_path, max_chars)
    if suffix == ".pdf":
        return read_pdf_file(file_path, max_chars)
    if suffix in {".docx"}:
        return read_docx_file(file_path, max_chars)
    if suffix in {".xlsx", ".xls"}:
        return read_excel_file(file_path)
    if suffix in {".pptx", ".ppt"}:
        return read_pptx_file(file_path, max_chars)
    if suffix in {".png", ".jpg", ".jpeg", ".bmp", ".gif", ".tiff", ".webp"}:
        return read_image_file(file_path, max_chars)
    if suffix in {".json"}:
        content = read_text_file(file_path, max_chars * 2)
        try:
            parsed = json.loads(content["text"])
        except json.JSONDecodeError:
            parsed = None
        content["parsed_json"] = parsed
        return content
    return read_binary_file(file_path)


def build_response_for_file(file_path: Path, max_chars: int) -> Dict[str, Any]:
    metadata = _build_file_metadata(file_path)
    metadata["type"] = file_path.suffix.lower()
    metadata["size_mb"] = round(metadata["size_bytes"] / (1024 * 1024), 4)
    metadata["permissions"] = stat.filemode(file_path.stat().st_mode)
    content = describe_file(file_path, max_chars)
    return {
        "path": str(file_path),
        "metadata": metadata,
        "content": content,
    }


@mcp.tool()
async def get_directory_tree(base_path: str = ".", max_depth: int = 3,
                             include_files: bool = True, include_hidden: bool = False) -> Dict[str, Any]:
    resolved = resolve_path(base_path)
    if not resolved.exists():
        return {"error": f"Path not found: {base_path}"}
    tree = path_to_dict(resolved, include_files, include_hidden, max_depth)
    return {
        "root": str(resolved),
        "max_depth": max_depth,
        "tree": tree,
    }


@mcp.tool()
async def describe_directory(base_path: str = ".", max_depth: int = 2) -> Dict[str, Any]:
    resolved = resolve_path(base_path)
    if not resolved.exists():
        return {"error": f"Path not found: {base_path}"}
    tree = path_to_dict(resolved, include_files=False, include_hidden=False, max_depth=max_depth)
    summary = {
        "directories": len(tree.get("children", [])),
        "path": str(resolved),
    }
    return {"summary": summary, "tree": tree}


@mcp.tool()
async def get_file_content(file_path: str, max_chars: int = 16000) -> Dict[str, Any]:
    resolved = resolve_path(file_path)
    if not resolved.exists():
        return {"error": f"File not found: {file_path}"}
    if not resolved.is_file():
        return {"error": f"Path is not a file: {file_path}"}
    return build_response_for_file(resolved, max_chars)


@mcp.tool()
async def health_check() -> Dict[str, Any]:
    return {
        "service": ContentHubConstants.SERVICE_NAME,
        "version": ContentHubConstants.SERVICE_VERSION,
        "project_root": str(ContentHubConstants.PROJECT_ROOT),
        "tmp_dir": str(ContentHubConstants.TMP_DIR),
        "ocr_backend": get_ocr_backend()["type"],
    }


def run_server() -> None:
    if mcp is None:
        raise RuntimeError("FastMCP is not available. Install the mcp package.")
    setup_logging()
    ensure_packages()
    logger.info("Starting Codebase Content Hub MCP server")
    mcp.run()


if __name__ == "__main__":
    run_server()
