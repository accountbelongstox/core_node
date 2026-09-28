# -*- coding: utf-8 -*-
"""
Core required-package getters (lazy load with auto-install).

Packages are loaded only when first accessed via getter functions. This
significantly reduces initial import time (from ~12s to <1s) and keeps every
optional dependency optional: importing this module (or third_party.api) must
never require aiohttp/PIL/googletrans/docx/bs4/striprtf/fastmcp/google-genai to
be installed -- otherwise one missing package on a minimal Linux host kills
unrelated consumers (e.g. the agent-history extractor chain). All packages are
cached after first load to avoid repeated imports.

Latent-bug fix (split): the former third_party.py had DUPLICATE definitions of
get_third_package_docx / get_third_package_pdfplumber / get_third_package_bs4
where the second def silently shadowed the first. Now each is defined ONCE:
  - get_third_package_docx      -> the docx MODULE (shadows-wins behavior preserved)
  - get_third_package_Document  -> the docx.Document CLASS (new; was the shadowed first def)
  - get_third_package_pdfplumber-> the pdfplumber module (both old defs were identical)
  - get_third_package_bs4       -> the bs4 MODULE (shadows-wins behavior preserved)
  - get_third_package_BeautifulSoup -> the BeautifulSoup CLASS
"""

import os
import sys
import importlib
import platform

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint

from pycore.pyfoundations.third_party._cache import _lazy_import
from pycore.pyfoundations.third_party._package_cache import _PACKAGE_CACHE


# Standard packages getter functions
def get_third_package_aiohttp():
    """Get aiohttp package (lazy load)"""
    return _lazy_import('aiohttp', 'import aiohttp')


def get_third_package_aiohttp_web():
    """Get aiohttp.web (lazy load)"""
    if 'aiohttp_web' not in _PACKAGE_CACHE:
        _lazy_import('aiohttp', 'import aiohttp')
        _PACKAGE_CACHE['aiohttp_web'] = importlib.import_module('aiohttp.web')
    return _PACKAGE_CACHE['aiohttp_web']


def get_third_package_yaml():
    """Get yaml package (lazy load)"""
    return _lazy_import('yaml', 'import yaml')


def get_third_package_cryptography():
    """Get cryptography package (lazy load, for Fernet)"""
    return _lazy_import('cryptography', 'import cryptography')


def get_third_package_cryptography_ed25519():
    """Get the Ed25519 primitive after loading cryptography lazily."""
    get_third_package_cryptography()
    return importlib.import_module(
        'cryptography.hazmat.primitives.asymmetric.ed25519'
    )


def get_third_package_cryptography_serialization():
    """Get key serialization primitives after loading cryptography lazily."""
    get_third_package_cryptography()
    return importlib.import_module(
        'cryptography.hazmat.primitives.serialization'
    )


def _pil_submodule(cache_key: str, submodule: str):
    """Load a PIL submodule lazily (auto-installs Pillow on first use)."""
    if cache_key not in _PACKAGE_CACHE:
        _lazy_import('PIL', 'import PIL')
        _PACKAGE_CACHE[cache_key] = importlib.import_module(f'PIL.{submodule}')
    return _PACKAGE_CACHE[cache_key]


# PIL/Pillow packages
def get_third_package_PIL():
    """Get PIL (Pillow) package (lazy load)"""
    return _lazy_import('PIL', 'import PIL')


def get_third_package_PIL_Image():
    """Get PIL.Image module (lazy load)"""
    return _pil_submodule('PIL_Image', 'Image')


def get_third_package_PIL_ImageDraw():
    """Get PIL.ImageDraw module (lazy load)"""
    return _pil_submodule('PIL_ImageDraw', 'ImageDraw')


def get_third_package_PIL_ImageFont():
    """Get PIL.ImageFont module (lazy load)"""
    return _pil_submodule('PIL_ImageFont', 'ImageFont')


def get_third_package_PIL_ImageTk():
    """Get PIL.ImageTk module (lazy load) - requires tkinter"""
    return _pil_submodule('PIL_ImageTk', 'ImageTk')


def get_third_package_PIL_ImageGrab():
    """Get PIL.ImageGrab module (lazy load)"""
    return _pil_submodule('PIL_ImageGrab', 'ImageGrab')


def get_third_package_PIL_ImageEnhance():
    """Get PIL.ImageEnhance module (lazy load)"""
    return _pil_submodule('PIL_ImageEnhance', 'ImageEnhance')


def get_third_package_PIL_ImageFilter():
    """Get PIL.ImageFilter module (lazy load)"""
    return _pil_submodule('PIL_ImageFilter', 'ImageFilter')


def get_third_package_PIL_ImageOps():
    """Get PIL.ImageOps module (lazy load)"""
    return _pil_submodule('PIL_ImageOps', 'ImageOps')


def get_third_package_PIL_ImageStat():
    """Get PIL.ImageStat module (lazy load)"""
    return _pil_submodule('PIL_ImageStat', 'ImageStat')


# Computer vision and automation packages
def get_third_package_cv2():
    """Get cv2 (OpenCV) package (lazy load)"""
    return _lazy_import('cv2', 'import cv2')


def get_third_package_pyautogui():
    """Get pyautogui package (lazy load); returns None when unusable.

    On a headless host (no X11 / no DISPLAY) importing pyautogui raises
    KeyError('DISPLAY') from its mouseinfo dependency - NOT an ImportError - so
    _lazy_import does not catch it and it would crash the whole worker at module
    import time. Swallow any such environment error and cache None instead;
    every caller must handle a None pyautogui.
    """
    try:
        return _lazy_import('pyautogui', 'import pyautogui')
    except (ImportError, ModuleNotFoundError):
        # No pip package mapped (or install failed) - treat as unavailable.
        _PACKAGE_CACHE['pyautogui'] = None
        return None
    except Exception as e:
        # Headless display errors (KeyError('DISPLAY'), Xlib errors, etc.).
        ColorPrint.yellow(f"[third_party] pyautogui unavailable (headless/no DISPLAY): {e}")
        _PACKAGE_CACHE['pyautogui'] = None
        return None


def get_third_package_psutil():
    """Get psutil package (lazy load)"""
    return _lazy_import('psutil', 'import psutil')


def get_third_package_pydantic():
    """Get pydantic package (lazy load)."""
    return _lazy_import('pydantic', 'import pydantic')


def get_third_package_mss():
    """Get mss package (lazy load)"""
    return _lazy_import('mss', 'import mss')


# Deep learning packages
def get_third_package_torch():
    """Get torch (PyTorch) package (lazy load) - Heavy package"""
    return _lazy_import('torch', 'import torch')


def get_third_package_ultralytics():
    """Get ultralytics (YOLO) package (lazy load) - Heavy package"""
    return _lazy_import('ultralytics', 'import ultralytics')


def get_third_package_numpy():
    """Get numpy package (lazy load)"""
    return _lazy_import('numpy', 'import numpy')


def get_third_package_matplotlib():
    """Get matplotlib package (lazy load). Used by SDKTool for pyplot/font_manager."""
    return _lazy_import('matplotlib', 'import matplotlib')


def get_third_package_labelme():
    """Get labelme package (lazy load). Image polygonal annotation tool; used by SDKTool when run from core_node."""
    return _lazy_import('labelme', 'import labelme')


def get_third_package_labelImg():
    """Get labelImg package (lazy load). VOC/YOLO bbox annotation; used by GameAISDK yolo_label_lib / d3-check step 3."""
    return _lazy_import('labelImg', 'import labelImg')


# Network and web packages
def get_third_package_requests():
    """Get requests package (lazy load)"""
    return _lazy_import('requests', 'import requests')


def get_third_package_urllib3():
    """Get urllib3 package (lazy load). Used by requests; also available for direct use."""
    return _lazy_import('urllib3', 'import urllib3')


def get_third_package_idna():
    """Get idna package (lazy load). Used by requests for internationalized domain names."""
    return _lazy_import('idna', 'import idna')


def get_third_package_chardet():
    """Get chardet package (lazy load). Used by requests for response encoding detection."""
    return _lazy_import('chardet', 'import chardet')


def get_third_package_certifi():
    """Get certifi package (lazy load). Used by requests for TLS CA bundle; certifi.where() returns path."""
    return _lazy_import('certifi', 'import certifi')


def get_third_package_zmq():
    """Get zmq package (lazy load). PyZMQ bindings for ZeroMQ; import name is zmq."""
    return _lazy_import('zmq', 'import zmq')


def get_third_package_msgpack():
    """Get msgpack package (lazy load). Binary serialization; packb/unpackb, use_bin_type in 1.x."""
    return _lazy_import('msgpack', 'import msgpack')


def get_third_package_werkzeug():
    """Get werkzeug package (lazy load). WSGI utilities; tensorboard and others may depend on it."""
    return _lazy_import('werkzeug', 'import werkzeug')


def get_third_package_h5py():
    """Get h5py package (lazy load). HDF5 bindings; TF2/Keras often use 3.x."""
    return _lazy_import('h5py', 'import h5py')


def get_third_package_absl():
    """Get absl package (lazy load). Abseil Python common libraries; tensorflow and others may depend on it."""
    return _lazy_import('absl', 'import absl')


def get_third_package_google_protobuf():
    """Get google.protobuf package (lazy load). Protocol Buffers; actual version constrained by tensorflow/grpcio."""
    return _lazy_import('google.protobuf', 'from google import protobuf')


def get_third_package_grpc():
    """Get grpc package (lazy load). gRPC Python; used by tensorflow and others when run from core_node."""
    return _lazy_import('grpc', 'import grpc')


def get_third_package_six():
    """Get six package (lazy load). Python 2 and 3 compatibility library; tensorflow/protobuf and others may depend on it."""
    return _lazy_import('six', 'import six')


def get_third_package_PyQt5():
    """Get PyQt5 package (lazy load). Qt5 bindings for Python; GameAISDK SDKTool uses it for GUI. Version >=5.15."""
    return _lazy_import('PyQt5', 'import PyQt5')


def get_third_package_uvicorn():
    """Get uvicorn package (lazy load)"""
    return _lazy_import('uvicorn', 'import uvicorn')


def get_third_package_websockets():
    """Get websockets with its synchronous client module."""
    package = _lazy_import('websockets', 'import websockets')
    package.sync_client = importlib.import_module('websockets.sync.client')
    return package


def get_third_package_fastapi():
    """Get fastapi package (lazy load)"""
    package = _lazy_import('fastapi', 'import fastapi')
    package.encoders = importlib.import_module('fastapi.encoders')
    package.responses = importlib.import_module('fastapi.responses')
    package.CORSMiddleware = importlib.import_module(
        'fastapi.middleware.cors'
    ).CORSMiddleware
    package.StaticFiles = importlib.import_module('fastapi.staticfiles').StaticFiles
    return package


# Device and streaming packages
def get_third_package_adb_shell():
    """Get adb_shell package (lazy load)"""
    return _lazy_import('adb_shell', 'import adb_shell')


def get_third_package_av():
    """Get av (PyAV) package (lazy load)"""
    return _lazy_import('av', 'import av')


# Logging
def get_third_package_loguru():
    """Get loguru package (lazy load)"""
    return _lazy_import('loguru', 'import loguru')


# Browser automation
def get_third_package_selenium():
    """Get selenium package (lazy load)"""
    return _lazy_import('selenium', 'import selenium')


def get_third_package_selenium_by():
    """Get selenium.webdriver.common.by.By (lazy load). Returns None on failure."""
    try:
        selenium = get_third_package_selenium()
        return selenium.webdriver.common.by.By if selenium else None
    except Exception:
        return None


def get_third_package_webdriver_manager():
    """Get webdriver_manager package (lazy load)"""
    return _lazy_import('webdriver_manager', 'import webdriver_manager')


def get_third_package_webview():
    """Get webview package (lazy load)"""
    return _lazy_import('webview', 'import webview')


def get_third_package_tkinterweb():
    """Get tkinterweb package (lazy load)"""
    return _lazy_import('tkinterweb', 'import tkinterweb')


def get_third_package_tkhtmlview():
    """Get tkhtmlview package (lazy load)"""
    return _lazy_import('tkhtmlview', 'import tkhtmlview')


def get_third_package_pystray():
    """
    Get pystray package (lazy load)

    On Linux, pystray may fail to import if X11 display is not accessible.
    In this case, returns None instead of raising an exception.
    """
    if 'pystray' not in _PACKAGE_CACHE:
        try:
            _PACKAGE_CACHE['pystray'] = _lazy_import('pystray', 'import pystray')
        except Exception as e:
            # Display-related errors are common on Linux when running as a
            # service or headless; any other import failure is treated the
            # same -- tray features are optional.
            error_msg = str(e)
            if 'Display' in error_msg or 'DISPLAY' in error_msg or 'X11' in error_msg or 'Xlib' in str(type(e)):
                ColorPrint.yellow(f"[WARN] pystray unavailable due to display error: {type(e).__name__}")
                ColorPrint.blue("[INFO] This is normal when running without X11 display access (e.g., systemd service)")
                ColorPrint.blue("[INFO] System tray features will be disabled")
            else:
                ColorPrint.yellow(f"[WARN] pystray import failed: {e}")
            _PACKAGE_CACHE['pystray'] = None

    return _PACKAGE_CACHE['pystray']


def get_third_package_pythoncom():
    """
    Get pythoncom module (Windows COM, optional). Returns None on non-Windows or import failure.
    Same style as get_third_package_pystray(); callers must check for None.
    """
    if 'pythoncom' not in _PACKAGE_CACHE:
        if platform.system() != 'Windows':
            _PACKAGE_CACHE['pythoncom'] = None
        else:
            try:
                _PACKAGE_CACHE['pythoncom'] = importlib.import_module('pythoncom')
            except Exception:
                _PACKAGE_CACHE['pythoncom'] = None
    return _PACKAGE_CACHE['pythoncom']


def get_third_package_runtime():
    """
    Get application runtime module (optional). Returns None when not available.
    Used for trigger_window_show, trigger_app_exit, etc. Callers must check for None.
    """
    if 'runtime' not in _PACKAGE_CACHE:
        try:
            _PACKAGE_CACHE['runtime'] = importlib.import_module('runtime')
        except Exception:
            _PACKAGE_CACHE['runtime'] = None
    return _PACKAGE_CACHE['runtime']


def get_third_package_PIL_Image_optional():
    """Get PIL.Image module or None on failure. For optional use (e.g. tray icon); callers must check for None."""
    if 'PIL_Image_optional' not in _PACKAGE_CACHE:
        try:
            _PACKAGE_CACHE['PIL_Image_optional'] = get_third_package_PIL_Image()
        except Exception:
            _PACKAGE_CACHE['PIL_Image_optional'] = None
    return _PACKAGE_CACHE['PIL_Image_optional']


def get_third_package_PIL_ImageDraw_optional():
    """Get PIL.ImageDraw module or None on failure. For optional use; callers must check for None."""
    if 'PIL_ImageDraw_optional' not in _PACKAGE_CACHE:
        try:
            _PACKAGE_CACHE['PIL_ImageDraw_optional'] = get_third_package_PIL_ImageDraw()
        except Exception:
            _PACKAGE_CACHE['PIL_ImageDraw_optional'] = None
    return _PACKAGE_CACHE['PIL_ImageDraw_optional']


def get_third_package_pynput():
    """Get pynput package (lazy load)"""
    return _lazy_import('pynput', 'import pynput')


def get_third_package_keyboard():
    """Get keyboard package (lazy load)"""
    return _lazy_import('keyboard', 'import keyboard')


def get_third_package_pyperclip():
    """Get pyperclip package (lazy load)"""
    return _lazy_import('pyperclip', 'import pyperclip')


def get_third_package_Xlib_module(submodule: str):
    """Get one python-xlib submodule such as 'display' or 'ext.xtest' (lazy load)."""
    cache_key = f'Xlib.{submodule}'
    if cache_key not in _PACKAGE_CACHE:
        _lazy_import('Xlib', 'import Xlib')
        _PACKAGE_CACHE[cache_key] = importlib.import_module(cache_key)
    return _PACKAGE_CACHE[cache_key]


def get_third_package_jeepney_module(submodule: str = ''):
    """Get jeepney or one of its submodules such as 'io.blocking' (lazy load)."""
    root = _lazy_import('jeepney', 'import jeepney')
    if not submodule:
        return root
    cache_key = f'jeepney.{submodule}'
    if cache_key not in _PACKAGE_CACHE:
        _PACKAGE_CACHE[cache_key] = importlib.import_module(cache_key)
    return _PACKAGE_CACHE[cache_key]


# Google Translate API packages
def get_third_package_googletrans():
    """Get googletrans package (lazy load)"""
    return _lazy_import('googletrans', 'import googletrans')


def get_third_package_googletrans_Translator():
    """Get googletrans.Translator class (lazy load)"""
    if 'googletrans_Translator' not in _PACKAGE_CACHE:
        _PACKAGE_CACHE['googletrans_Translator'] = _lazy_import('googletrans', 'import googletrans').Translator
    return _PACKAGE_CACHE['googletrans_Translator']


def get_third_package_httpx():
    """Get httpx package (lazy load) - Required by googletrans"""
    return _lazy_import('httpx', 'import httpx')


# Document processing packages
def get_third_package_pypdf():
    """Get pypdf package (lazy load)"""
    return _lazy_import('pypdf', 'import pypdf')


def get_third_package_pdfplumber():
    """Get pdfplumber package (lazy load) for PDF text extraction."""
    return _lazy_import('pdfplumber', 'import pdfplumber')


def get_third_package_docx():
    """Get the docx MODULE (python-docx, lazy load) for .docx text extraction.

    Callers do `docx = get_third_package_docx(); docx.Document(...)`.
    Latent-bug fix: the former third_party.py had TWO defs of this name; the
    second (module-returning) one silently shadowed the first (class-returning).
    This is the single definition now, preserving the module behavior that all
    current callers (e.g. get_third_package_python_docx) depend on.
    """
    return _lazy_import('docx', 'import docx')


def get_third_package_Document():
    """Get python-docx's Document CLASS (lazy load).

    Latent-bug fix: restored as a distinct name. The former first def of
    get_third_package_docx returned this class but was shadowed by the
    module-returning second def, so callers expecting the class got the module
    instead. Use this getter when you need the Document class directly.
    """
    if 'docx_Document' not in _PACKAGE_CACHE:
        _PACKAGE_CACHE['docx_Document'] = _lazy_import('docx', 'import docx').Document
    return _PACKAGE_CACHE['docx_Document']


def get_third_package_python_docx():
    """Get python-docx package (alias for docx module, lazy load)"""
    return get_third_package_docx()


def get_third_package_openpyxl():
    """Get openpyxl package (lazy load)"""
    return _lazy_import('openpyxl', 'import openpyxl')


def get_third_package_pptx():
    """Get pptx package (lazy load)"""
    return _lazy_import('pptx', 'import pptx')


def get_third_package_python_pptx():
    """Get python-pptx package (alias for pptx, lazy load)"""
    return get_third_package_pptx()


# HTML parsing
def get_third_package_bs4():
    """Get bs4 (BeautifulSoup4) MODULE (lazy load).

    Latent-bug fix: the former third_party.py had TWO defs; the second
    (module-returning) silently shadowed the first (class-returning). This is
    the single definition now, preserving the module behavior. For the class
    use get_third_package_BeautifulSoup().
    """
    return _lazy_import('bs4', 'import bs4')


def get_third_package_BeautifulSoup():
    """Get BeautifulSoup class from bs4 (lazy load)"""
    if 'BeautifulSoup' not in _PACKAGE_CACHE:
        _PACKAGE_CACHE['BeautifulSoup'] = _lazy_import('bs4', 'import bs4').BeautifulSoup
    return _PACKAGE_CACHE['BeautifulSoup']


# Document-parsing optional packages (Books ingest). Used by book_processor /
# file_processor to extract plain text from .epub/.rtf. Auto-installed from
# OPTIONAL_PACKAGES on first use; have stdlib fallbacks in the processor when unavailable.
def get_third_package_ebooklib():
    """Get ebooklib package (lazy load) for EPUB parsing (optional)."""
    return _lazy_import('ebooklib', 'import ebooklib')


def get_third_package_striprtf():
    """Get striprtf's rtf_to_text function (lazy load) for .rtf (optional)."""
    if 'striprtf_rtf_to_text' not in _PACKAGE_CACHE:
        _lazy_import('striprtf', 'import striprtf')
        _PACKAGE_CACHE['striprtf_rtf_to_text'] = importlib.import_module('striprtf.striprtf').rtf_to_text
    return _PACKAGE_CACHE['striprtf_rtf_to_text']


# Machine learning
def get_third_package_sklearn():
    """Get sklearn package (lazy load) - Heavy package"""
    return _lazy_import('sklearn', 'import sklearn')


# Database operations
def get_third_package_sqlalchemy():
    """Get sqlalchemy package (lazy load)"""
    return _lazy_import('sqlalchemy', 'import sqlalchemy')


# MCP (Model Context Protocol) - FastMCP v2
def get_third_package_fastmcp():
    """Get fastmcp package (lazy load)"""
    return _lazy_import('fastmcp', 'import fastmcp')


def get_third_package_FastMCP():
    """Get FastMCP class (lazy load)"""
    if 'FastMCP' not in _PACKAGE_CACHE:
        _PACKAGE_CACHE['FastMCP'] = _lazy_import('fastmcp', 'import fastmcp').FastMCP
    return _PACKAGE_CACHE['FastMCP']


def get_third_package_Context():
    """Get MCP Context class (lazy load)"""
    if 'Context' not in _PACKAGE_CACHE:
        _PACKAGE_CACHE['Context'] = _lazy_import('fastmcp', 'import fastmcp').Context
    return _PACKAGE_CACHE['Context']


# OKX exchange API
def get_third_package_okx():
    """Get okx package (python-okx, lazy load)"""
    return _lazy_import('okx', 'import okx')


# Redis cache
def get_third_package_redis():
    """Get redis package (lazy load)"""
    return _lazy_import('redis', 'import redis')


# Google Gemini API
def get_third_package_google_genai():
    """Get google.genai package (lazy load)"""
    if 'google_genai' not in _PACKAGE_CACHE:
        _PACKAGE_CACHE['google_genai'] = _lazy_import('google.genai', 'from google import genai')
    return _PACKAGE_CACHE['google_genai']


def get_third_package_openai():
    """
    Get openai package (lazy load).

    Used by OpenAI-compatible providers (OpenAI, DeepSeek via base_url). The same
    SDK talks to any service that implements the OpenAI REST API: set base_url
    (e.g. https://api.deepseek.com for DeepSeek) and api_key on the client.
    """
    return _lazy_import('openai', 'import openai')


# Audio packages
def get_third_package_pygame():
    """Get pygame package (lazy load)"""
    return _lazy_import('pygame', 'import pygame')


def get_third_package_eng_to_ipa():
    """Get eng_to_ipa package (lazy load)"""
    return _lazy_import('eng_to_ipa', 'import eng_to_ipa')
