# -*- coding: utf-8 -*-
"""Central package policy shared by pycore and platform installers."""

from __future__ import annotations

import argparse
import json
from typing import Dict, Iterable, Iterator, Sequence, Tuple


DEPENDENCY_MAP: Dict[str, str] = {
    "PIL": "Pillow",
    "cv2": "opencv-python",
    "pyautogui": "pyautogui",
    "psutil": "psutil",
    "pydantic": "pydantic",
    "mss": "mss",
    "torch": "torch",
    "ultralytics": "ultralytics>=8,<9",
    "numpy": "numpy",
    "adb_shell": "adb-shell",
    "av": "av",
    "uvicorn": "uvicorn[standard]",
    "websockets": "websockets",
    "requests": "requests>=2,<3",
    "urllib3": "urllib3>=2,<3",
    "idna": "idna>=3,<4",
    "chardet": "chardet>=5,<6",
    "certifi": "certifi",
    "zmq": "pyzmq",
    "msgpack": "msgpack>=1,<2",
    "werkzeug": "Werkzeug>=3,<4",
    "h5py": "h5py>=3,<4",
    "absl": "absl-py>=2,<3",
    "google.protobuf": "protobuf",
    "grpc": "grpcio",
    "six": "six>=1,<2",
    "aiohttp": "aiohttp",
    "fastapi": "fastapi",
    "typing_extensions": "typing_extensions>=4,<5",
    "PyQt5": "PyQt5>=5,<6",
    "matplotlib": "matplotlib",
    "labelme": "labelme",
    "labelImg": "labelImg",
    "tkinterweb": "tkinterweb",
    "tkhtmlview": "tkhtmlview",
    "pystray": "pystray",
    "loguru": "loguru",
    "yaml": "pyyaml",
    "huggingface_hub": "huggingface_hub",
    "pytesseract": "pytesseract",
    "pypdf": "pypdf",
    "pdfplumber": "pdfplumber",
    "docx": "python-docx",
    "openpyxl": "openpyxl",
    "pptx": "python-pptx",
    "bs4": "beautifulsoup4",
    "sklearn": "scikit-learn",
    "selenium": "selenium",
    "webdriver_manager": "webdriver-manager",
    "sqlalchemy": "sqlalchemy",
    "fastmcp": "fastmcp",
    "azure.cognitiveservices.speech": "azure-cognitiveservices-speech",
    "vosk": "vosk",
    "pynput": "pynput",
    "keyboard": "keyboard",
    "pyperclip": "pyperclip",
    "googletrans": "googletrans",
    "httpx": "httpx",
    "okx": "python-okx",
    "redis": "redis",
    "google.genai": "google-genai",
    "openai": "openai",
    "pygame": "pygame",
    "PySide6": "PySide6",
    "eng_to_ipa": "eng-to-ipa",
    "cryptography": "cryptography",
}

OPTIONAL_PACKAGES: Dict[str, str] = {
    "edge_tts": "edge-tts",
    "whisper": "openai-whisper",
    "watchdog": "watchdog",
    "gi": "PyGObject",
    "ebooklib": "ebooklib",
    "striprtf": "striprtf",
    "lxml": "lxml",
    "nltk": "nltk",
}

WINDOWS_ONLY_PACKAGES: Dict[str, str] = {
    "win32gui": "pywin32",
    "win32con": "pywin32",
    "win32api": "pywin32",
    "win32ui": "pywin32",
    "win32com_client": "pywin32",
    "win32com_propsys": "pywin32",
    "win32com_pscon": "pywin32",
    "pywinauto": "pywinauto",
    "pygetwindow": "pygetwindow",
    "uiautomation": "uiautomation",
    "pyaudiowpatch": "pyaudiowpatch",
    "pyaudio": "pyaudio",
}

WINDOWS_OCR_WINRT_PACKAGES: Tuple[str, ...] = (
    "winrt-Windows.Foundation",
    "winrt-Windows.Foundation.Collections",
    "winrt-Windows.Media.Ocr",
    "winrt-Windows.Graphics.Imaging",
    "winrt-Windows.Storage.Streams",
    "winrt-Windows.Globalization",
)

PREPARE_ALIGNED_PACKAGES: Dict[str, str] = {
    "multipart": "python-multipart",
    "easyocr": "easyocr",
}

DOCUMENT_PARSING_IMPORTS: Tuple[str, ...] = (
    "pdfplumber",
    "docx",
    "bs4",
    "lxml",
    "ebooklib",
    "striprtf",
    "multipart",
)

GUI_ONLY_IMPORTS = frozenset({"PySide6", "PyQt5", "labelme", "labelImg"})
SPECIALIZED_IMPORTS = frozenset({"torch", "ultralytics", "edge_tts", "whisper", "gi"})
BACKEND_IMPORTS = frozenset(
    {
        "PIL",
        "cv2",
        "pyautogui",
        "psutil",
        "mss",
        "numpy",
        "fastapi",
        "uvicorn",
    }
)


def installer_packages(platform_name: str, include_optional: bool = True) -> Iterator[Tuple[str, str]]:
    """Yield packages owned by the common installer for one platform."""
    normalized = platform_name.strip().lower()
    tables: Iterable[Dict[str, str]] = (DEPENDENCY_MAP, OPTIONAL_PACKAGES) if include_optional else (DEPENDENCY_MAP,)
    seen = set()
    for table in tables:
        for import_name, pip_spec in table.items():
            if import_name in SPECIALIZED_IMPORTS or import_name in BACKEND_IMPORTS or pip_spec.lower() in seen:
                continue
            seen.add(pip_spec.lower())
            yield import_name, pip_spec
    if normalized == "windows":
        for import_name, pip_spec in WINDOWS_ONLY_PACKAGES.items():
            if pip_spec.lower() in seen:
                continue
            seen.add(pip_spec.lower())
            yield import_name, pip_spec


def package_rows(set_name: str, platform_name: str, include_optional: bool = True) -> Iterator[Tuple[str, str]]:
    """Yield one installer-facing package set."""
    if set_name == "installer":
        yield from installer_packages(platform_name, include_optional)
        return
    if set_name == "prepare":
        yield from PREPARE_ALIGNED_PACKAGES.items()
        return
    if set_name == "document":
        for import_name in DOCUMENT_PARSING_IMPORTS:
            if import_name in PREPARE_ALIGNED_PACKAGES:
                yield import_name, PREPARE_ALIGNED_PACKAGES[import_name]
            elif import_name in DEPENDENCY_MAP:
                yield import_name, DEPENDENCY_MAP[import_name]
            else:
                yield import_name, OPTIONAL_PACKAGES[import_name]
        return
    if set_name == "ocr":
        yield "easyocr", PREPARE_ALIGNED_PACKAGES["easyocr"]
        if platform_name == "windows":
            for pip_spec in WINDOWS_OCR_WINRT_PACKAGES:
                yield "winrt.windows.media.ocr", pip_spec
        return
    if set_name == "winrt" and platform_name == "windows":
        for pip_spec in WINDOWS_OCR_WINRT_PACKAGES:
            yield "winrt.windows.media.ocr", pip_spec


def _main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--platform", choices=("linux", "windows"), required=True)
    parser.add_argument(
        "--set",
        choices=("installer", "prepare", "document", "ocr", "winrt"),
        default="installer",
    )
    parser.add_argument("--no-optional", action="store_true")
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args(argv)
    rows = list(package_rows(args.set, args.platform, include_optional=not args.no_optional))
    if args.json:
        print(json.dumps(rows))
    else:
        for import_name, pip_spec in rows:
            print(f"{import_name}\t{pip_spec}")
    return 0


if __name__ == "__main__":
    raise SystemExit(_main())


__all__ = [
    "BACKEND_IMPORTS",
    "DEPENDENCY_MAP",
    "DOCUMENT_PARSING_IMPORTS",
    "GUI_ONLY_IMPORTS",
    "OPTIONAL_PACKAGES",
    "PREPARE_ALIGNED_PACKAGES",
    "SPECIALIZED_IMPORTS",
    "WINDOWS_OCR_WINRT_PACKAGES",
    "WINDOWS_ONLY_PACKAGES",
    "installer_packages",
    "package_rows",
]
