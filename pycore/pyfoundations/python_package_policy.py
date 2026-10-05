# -*- coding: utf-8 -*-
"""Central package policy shared by pycore and platform installers."""

from __future__ import annotations

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
    "mcp": "mcp>=1,<2",
    "multipart": "python-multipart",
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
    # fastmcp 4 requires mcp 2 (FastMCP renamed to MCPServer); stay on the mcp<2 major.
    "fastmcp": "fastmcp>=2,<4",
    "azure.cognitiveservices.speech": "azure-cognitiveservices-speech",
    "vosk": "vosk",
    "pynput": "pynput",
    "keyboard": "keyboard",
    "pyperclip": "pyperclip",
    "googletrans": "googletrans>=4.0.2",
    "httpx": "httpx",
    "okx": "python-okx",
    "redis": "redis",
    "orjson": "orjson",
    "google.genai": "google-genai",
    "openai": "openai",
    "pygame": "pygame",
    "PySide6": "PySide6",
    "eng_to_ipa": "eng-to-ipa",
    "cryptography": "cryptography",
}

OPTIONAL_PACKAGES: Dict[str, str] = {
    "fishaudio": "fish-audio-sdk",
    "fishaudio.utils": "fish-audio-sdk",
    "edge_tts": "edge-tts",
    "parler_tts": "git+https://github.com/huggingface/parler-tts.git",
    "scipy": "scipy",
    "soundfile": "soundfile",
    "transformers": "transformers",
    "voxcpm": "voxcpm",
    "whisper": "openai-whisper",
    "watchdog": "watchdog",
    "gi": "PyGObject",
    "ebooklib": "ebooklib",
    "striprtf": "striprtf",
    "lxml": "lxml",
    "nltk": "nltk",
    "google.auth": "google-auth",
    "pynvml": "nvidia-ml-py",
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

LINUX_ONLY_PACKAGES: Dict[str, str] = {
    "Xlib": "python-xlib",
    "jeepney": "jeepney",
}

PLATFORM_ONLY_PACKAGES: Dict[str, Dict[str, str]] = {
    "windows": WINDOWS_ONLY_PACKAGES,
    "linux": LINUX_ONLY_PACKAGES,
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
SPECIALIZED_IMPORTS = frozenset(
    {
        "edge_tts",
        "gi",
        "parler_tts",
        "scipy",
        "soundfile",
        "torch",
        "transformers",
        "ultralytics",
        "voxcpm",
        "whisper",
    }
)
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
    for import_name, pip_spec in PLATFORM_ONLY_PACKAGES.get(normalized, {}).items():
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


_SPECIFIER_CHARS = "<>=!~"


def _split_spec(pip_spec: str) -> Tuple[str, str]:
    """(distribution name without extras, version specifier or '')."""
    cut = min((pip_spec.find(char) for char in _SPECIFIER_CHARS if char in pip_spec), default=len(pip_spec))
    return pip_spec[:cut].split("[", 1)[0].strip(), pip_spec[cut:].strip()


def constraint_line(pip_spec: str) -> str:
    """'name<specifier>' of a version-bounded pip spec (extras dropped, as pip
    constraints allow only a name and a specifier); '' when unbounded."""
    name, specifier = _split_spec(pip_spec)
    return f"{name}{specifier}" if specifier else ""


def constraint_lines(set_name: str, platform_name: str, include_optional: bool = True) -> Iterator[str]:
    """pip constraints guarding one install: the core installer policy plus the
    set's own specs (the set wins per package), so installing a missing package
    never moves a present one out of policy."""
    lines: Dict[str, str] = {}
    for current_set in dict.fromkeys(("installer", set_name)):
        for _import_name, pip_spec in package_rows(current_set, platform_name, include_optional):
            name, specifier = _split_spec(pip_spec)
            if specifier:
                lines[name.lower()] = f"{name}{specifier}"
    yield from lines.values()


__all__ = [
    "BACKEND_IMPORTS",
    "DEPENDENCY_MAP",
    "DOCUMENT_PARSING_IMPORTS",
    "GUI_ONLY_IMPORTS",
    "LINUX_ONLY_PACKAGES",
    "OPTIONAL_PACKAGES",
    "PLATFORM_ONLY_PACKAGES",
    "PREPARE_ALIGNED_PACKAGES",
    "SPECIALIZED_IMPORTS",
    "WINDOWS_OCR_WINRT_PACKAGES",
    "WINDOWS_ONLY_PACKAGES",
    "constraint_line",
    "constraint_lines",
    "installer_packages",
    "package_rows",
]
