# -*- coding: utf-8 -*-
"""
Third-Party Package Unified Import Manager (package facade).

This package provides a unified interface for importing third-party packages
with automatic dependency checking and installation.

All third-party packages MUST be imported through this module.
Usage: from pycore.pyfoundations.third_party.api import aiohttp, netifaces, etc.
The package automatically checks and installs missing packages on first import.

Rule: This module must NOT import or reference pycore.pyutils (all imports at top are pyfoundations only).

Structure (private sub-modules, imported LEAF-FIRST to avoid circular imports):
  _package_cache    - _PACKAGE_CACHE singleton (the shared mutable root)
  _cache            - _lazy_import service
  _deps             - dependency tables + constants
  _pip_runner       - pip/subprocess layer over Commander
  _torch_cuda       - Torch CUDA wheel resolution + CPU/GPU guards (reuses compute_caps)
  _getters_core     - core required-package getters
  _getters_optional - optional/special getters
  _hf_helpers       - HF hub helpers + cnocr loader
  _ocr_models       - OCR model provisioning (PREWARM_SPEC + HF download)
  _ocr_initializer  - OcrInitializer class + CUDA/OCR singletons (reuses compute_caps.CudaInitializer)
  _dep_check        - check_and_install_dependencies (LAST; import-time auto-run is below)

_PACKAGE_CACHE lives in EXACTLY ONE leaf sub-module (_package_cache) and is
never re-declared.
"""

import os

# ---------------------------------------------------------------------------
# Import sub-modules LEAF-FIRST so no sub-module triggers a circular import.
# ---------------------------------------------------------------------------
from ._package_cache import _PACKAGE_CACHE

from ._deps import (
    DEPENDENCY_MAP,
    OPTIONAL_PACKAGES,
    WINDOWS_OCR_WINRT_PACKAGES,
    WINDOWS_ONLY_PACKAGES,
    PYTORCH_CUDA_INDEX_URL,
    _PYTORCH_CUDA_WHEELS,
    _PYTORCH_CUDA_DEFAULT_TAG,
    PYTORCH_CPU_INDEX_URL,
    GUI_ONLY_IMPORTS,
    _INSTALL_PROBE_SUBMODULE,
    _module_install_ok,
    _is_headless_linux,
)

from ._pip_runner import (
    run_third_party_command,
    build_pip_install_command,
    run_pip_install_with_realtime_output,
    run_command_with_realtime_output,
    _is_pip_package_installed,
    _run_pip_uninstall,
    _run_pip_install_for_ocr,
    _run_pip_install_for_ocr_force,
    _fix_ort_dependency_conflicts,
    _verify_onnx_import,
    _clear_cnocr_cache,
)

from ._cache import _lazy_import

from ._torch_cuda import (
    _print_cuda_support_prompt,
    _ensure_torch_cpu_build_when_no_gpu,
    _ensure_sherpa_onnx_cpu_build_when_no_gpu,
    _detect_driver_cuda_version,
    _resolve_pytorch_cuda_index_url,
    _ensure_torch_cuda_build_first,
)

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.pybasecommon.compute_caps import register_compute_torch_getter
from pycore.pyfoundations.pybasecommon.encyclopedia import ENCYCLOPEDIA

from ._dep_check import check_and_install_dependencies

from ._getters_core import (
    get_third_package_aiohttp,
    get_third_package_aiohttp_web,
    get_third_package_yaml,
    get_third_package_cryptography,
    get_third_package_PIL,
    get_third_package_PIL_Image,
    get_third_package_PIL_ImageDraw,
    get_third_package_PIL_ImageFont,
    get_third_package_PIL_ImageTk,
    get_third_package_PIL_ImageGrab,
    get_third_package_PIL_ImageEnhance,
    get_third_package_PIL_ImageFilter,
    get_third_package_PIL_ImageOps,
    get_third_package_PIL_ImageStat,
    get_third_package_cv2,
    get_third_package_pyautogui,
    get_third_package_psutil,
    get_third_package_mss,
    get_third_package_torch,
    get_third_package_ultralytics,
    get_third_package_numpy,
    get_third_package_matplotlib,
    get_third_package_labelme,
    get_third_package_labelImg,
    get_third_package_websockets,
    get_third_package_requests,
    get_third_package_urllib3,
    get_third_package_idna,
    get_third_package_chardet,
    get_third_package_certifi,
    get_third_package_zmq,
    get_third_package_msgpack,
    get_third_package_werkzeug,
    get_third_package_h5py,
    get_third_package_absl,
    get_third_package_google_protobuf,
    get_third_package_grpc,
    get_third_package_six,
    get_third_package_PyQt5,
    get_third_package_uvicorn,
    get_third_package_fastapi,
    get_third_package_adb_shell,
    get_third_package_av,
    get_third_package_loguru,
    get_third_package_selenium,
    get_third_package_selenium_by,
    get_third_package_webdriver_manager,
    get_third_package_webview,
    get_third_package_tkinterweb,
    get_third_package_tkhtmlview,
    get_third_package_pystray,
    get_third_package_pythoncom,
    get_third_package_runtime,
    get_third_package_PIL_Image_optional,
    get_third_package_PIL_ImageDraw_optional,
    get_third_package_pynput,
    get_third_package_pyperclip,
    get_third_package_googletrans,
    get_third_package_googletrans_Translator,
    get_third_package_httpx,
    get_third_package_pypdf,
    get_third_package_pdfplumber,
    get_third_package_docx,
    get_third_package_Document,
    get_third_package_python_docx,
    get_third_package_openpyxl,
    get_third_package_pptx,
    get_third_package_python_pptx,
    get_third_package_bs4,
    get_third_package_BeautifulSoup,
    get_third_package_ebooklib,
    get_third_package_striprtf,
    get_third_package_sklearn,
    get_third_package_sqlalchemy,
    get_third_package_fastmcp,
    get_third_package_FastMCP,
    get_third_package_Context,
    get_third_package_okx,
    get_third_package_redis,
    get_third_package_google_genai,
    get_third_package_openai,
    get_third_package_pygame,
    get_third_package_eng_to_ipa,
)

from ._getters_optional import (
    install_and_reimport_azure,
    install_and_reimport_edge_tts,
    get_third_package_speechsdk,
    get_third_package_edge_tts,
    get_third_package_vosk,
    get_third_package_whisper,
    get_third_package_easyocr,
    _ensure_watchdog_submodules,
    get_third_package_watchdog,
    get_third_package_pyaudio,
    get_third_package_tkinter,
    get_third_package_pyside6,
    get_third_package_win32gui,
    get_third_package_win32con,
    get_third_package_win32api,
    get_third_package_win32process,
    get_third_package_win32ui,
    get_third_package_windows_ocr,
    get_third_package_sherpa_onnx,
    get_third_package_melo,
    get_third_package_pywinauto,
    get_third_package_pygetwindow,
    get_third_package_uiautomation,
    get_third_package_pyaudiowpatch,
)

from ._hf_helpers import (
    get_third_package_huggingface_hub,
    _print_cnocr_init_info,
    get_third_package_cnocr,
    get_huggingface_cli_command,
    ensure_huggingface_cli_prerequisite,
    _ensure_huggingface_cli_on_path,
    CNOCR_MODEL_DOWNLOAD_HINT,
    ensure_huggingface_hub,
    hf_download_file,
    hf_snapshot_to_dir,
    hf_download_zip_and_extract,
    hf_list_repo_files,
    hf_get_collection_models,
    hf_download_repo_latest,
)

from ._ocr_models import (
    PREWARM_SPEC,
    PREWARM_LANGUAGES,
    REC_MORE_CONFIGS_CNOCR,
    all_cnstd_repos,
    all_cnocr_repos,
    all_cnstd_zips,
    all_cnocr_zips,
    prewarm_det_rec_for_lang,
    HF_OCR_REPO,
    CNSTD_SUBDIR,
    CNOCR_SUBDIR,
    CNSTD_COLLECTION_SLUG,
    CNOCR_COLLECTION_SLUG,
    _appdata_root,
    cnstd_root,
    cnocr_root,
    _model_name_from_ppocr_repo,
    _repos_from_collection,
    _needed_det_model_names,
    _needed_rec_model_names,
    _repos_to_download_cnstd,
    _repos_to_download_cnocr,
    _download_ppocr_single_model_repos,
    _zip_basename_to_ppocr_model,
    _dir_has_onnx,
    _zip_already_extracted,
    _normalize_extract_to_ppocr,
    _download_and_extract_zips_to,
    ensure_cnstd_models,
    ensure_cnocr_models,
    init_ocr_models_from_hf,
)

from ._ocr_initializer import (
    OcrInitializer,
    _cuda_initializer,
    _ocr_initializer,
    get_cnocr_prewarmed,
    init_third_party_cnocr,
)

register_compute_torch_getter(get_third_package_torch)


# ---------------------------------------------------------------------------
# Public API. Every previously-public name is re-exported so external callers
# doing "from pycore.pyfoundations.third_party.api import X" still resolve.
# Latent-bug fix: the former __all__ listed check_system_package_installed /
# install_system_packages which were NEVER defined - removed here. Every name in
# __all__ is defined/re-exported above.
# ---------------------------------------------------------------------------
__all__ = [
    # Dependency tables + constants
    'DEPENDENCY_MAP',
    'OPTIONAL_PACKAGES',
    'WINDOWS_OCR_WINRT_PACKAGES',
    'WINDOWS_ONLY_PACKAGES',
    'PYTORCH_CUDA_INDEX_URL',
    'PYTORCH_CPU_INDEX_URL',
    'GUI_ONLY_IMPORTS',
    # Pip / subprocess layer
    'run_third_party_command',
    'build_pip_install_command',
    'run_pip_install_with_realtime_output',
    'run_command_with_realtime_output',
    'check_and_install_dependencies',
    # Lazy loading getter functions (use these instead of direct imports)
    'get_third_package_aiohttp',
    'get_third_package_aiohttp_web',
    'get_third_package_websockets',
    'get_third_package_requests',
    'get_third_package_urllib3',
    'get_third_package_idna',
    'get_third_package_chardet',
    'get_third_package_certifi',
    'get_third_package_zmq',
    'get_third_package_msgpack',
    'get_third_package_grpc',
    'get_third_package_werkzeug',
    'get_third_package_h5py',
    'get_third_package_absl',
    'get_third_package_google_protobuf',
    'get_third_package_six',
    'get_third_package_PyQt5',
    'get_third_package_uvicorn',
    'get_third_package_fastapi',
    'get_third_package_PIL',
    'get_third_package_PIL_Image',
    'get_third_package_PIL_ImageDraw',
    'get_third_package_PIL_ImageFont',
    'get_third_package_PIL_ImageTk',
    'get_third_package_PIL_ImageGrab',
    'get_third_package_PIL_ImageEnhance',
    'get_third_package_PIL_ImageFilter',
    'get_third_package_PIL_ImageOps',
    'get_third_package_PIL_ImageStat',
    'get_third_package_PIL_Image_optional',
    'get_third_package_PIL_ImageDraw_optional',
    'get_third_package_cv2',
    'get_third_package_pyautogui',
    'get_third_package_psutil',
    'get_third_package_mss',
    'get_third_package_torch',
    'get_third_package_ultralytics',
    'get_third_package_numpy',
    'get_third_package_matplotlib',
    'get_third_package_labelme',
    'get_third_package_labelImg',
    'get_third_package_adb_shell',
    'get_third_package_av',
    'get_third_package_loguru',
    'get_third_package_yaml',
    'get_third_package_cryptography',
    'get_third_package_webview',
    'get_third_package_tkinterweb',
    'get_third_package_tkhtmlview',
    'get_third_package_pystray',
    'get_third_package_pythoncom',
    'get_third_package_runtime',
    'get_third_package_huggingface_hub',
    'get_third_package_cnocr',
    'get_cnocr_prewarmed',
    'get_huggingface_cli_command',
    'ensure_huggingface_cli_prerequisite',
    'get_third_package_pynput',
    'get_third_package_pyperclip',
    # Google Translate API
    'get_third_package_googletrans',
    'get_third_package_googletrans_Translator',
    'get_third_package_httpx',
    # Document processing packages
    'get_third_package_pypdf',
    'get_third_package_pdfplumber',
    'get_third_package_docx',
    'get_third_package_Document',
    'get_third_package_python_docx',
    'get_third_package_openpyxl',
    'get_third_package_pptx',
    'get_third_package_python_pptx',
    'get_third_package_ebooklib',
    'get_third_package_striprtf',
    # HTML parsing
    'get_third_package_bs4',
    'get_third_package_BeautifulSoup',
    # Machine learning
    'get_third_package_sklearn',
    # Database
    'get_third_package_sqlalchemy',
    # MCP (Model Context Protocol)
    'get_third_package_fastmcp',
    'get_third_package_FastMCP',
    'get_third_package_Context',
    # Optional packages
    'get_third_package_speechsdk',
    'get_third_package_edge_tts',
    'get_third_package_vosk',
    'get_third_package_whisper',
    'get_third_package_easyocr',
    'get_third_package_watchdog',
    'install_and_reimport_azure',
    'install_and_reimport_edge_tts',
    # Audio packages
    'get_third_package_pygame',
    'get_third_package_eng_to_ipa',
    'get_third_package_pyaudio',
    # GUI packages
    'get_third_package_tkinter',
    'get_third_package_pyside6',
    # Windows-only packages
    'get_third_package_win32gui',
    'get_third_package_win32con',
    'get_third_package_win32api',
    'get_third_package_win32process',
    'get_third_package_win32ui',
    'get_third_package_windows_ocr',
    'get_third_package_sherpa_onnx',
    'get_third_package_melo',
    'get_third_package_pywinauto',
    'get_third_package_pygetwindow',
    'get_third_package_uiautomation',
    'get_third_package_pyaudiowpatch',
    # Browser automation
    'get_third_package_selenium',
    'get_third_package_selenium_by',
    'get_third_package_webdriver_manager',
    # OKX exchange API
    'get_third_package_okx',
    # Redis cache
    'get_third_package_redis',
    # Google Gemini API
    'get_third_package_google_genai',
    # OpenAI-compatible API
    'get_third_package_openai',
    # Hugging Face Hub helpers
    'ensure_huggingface_hub',
    'hf_download_file',
    'hf_snapshot_to_dir',
    'hf_download_zip_and_extract',
    'hf_list_repo_files',
    'hf_get_collection_models',
    'hf_download_repo_latest',
    # OCR prewarm spec
    'PREWARM_SPEC',
    'PREWARM_LANGUAGES',
    'REC_MORE_CONFIGS_CNOCR',
    'all_cnstd_repos',
    'all_cnocr_repos',
    'all_cnstd_zips',
    'all_cnocr_zips',
    'prewarm_det_rec_for_lang',
    # OCR model provisioning
    'cnstd_root',
    'cnocr_root',
    'ensure_cnstd_models',
    'ensure_cnocr_models',
    'init_ocr_models_from_hf',
    # OCR initializer
    'OcrInitializer',
    'init_third_party_cnocr',
]


# ---------------------------------------------------------------------------
# Read pip metadata once without changing the interpreter environment.
# ---------------------------------------------------------------------------
if os.environ.get('PYCORE_SKIP_DEP_CHECK') != '1':
    try:
        check_and_install_dependencies()
    except Exception as e:
        ColorPrint.red(f"[ERROR] Failed to check dependencies during import: {e}")
        ColorPrint.yellow("[WARNING] Attempting to continue, but some packages may be missing")
        # Ensure checking flag is cleared even on error
        ENCYCLOPEDIA.add("pycore_dependencies_checking", False)
else:
    ColorPrint.blue("[INFO] Dependency check skipped (PYCORE_SKIP_DEP_CHECK=1)")
    ENCYCLOPEDIA.add("pycore_dependencies_checked", True)


# OCR/cnocr init is not run at import. Call init_third_party_cnocr() once (e.g. from cnocr_engine_registry) to download HF models and prewarm zh/en/cht.
