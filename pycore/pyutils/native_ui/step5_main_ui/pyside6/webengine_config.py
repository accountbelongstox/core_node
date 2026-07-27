#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
QtWebEngine Configuration - Multi-Tier Redundant Configuration

Provides redundant methods to enable WebCodecs, WebGL, and hardware acceleration
in QtWebEngine/Chromium. Uses multiple fallback tiers to maximize compatibility.

Tier 1: Environment variables (QTWEBENGINE_CHROMIUM_FLAGS)
Tier 2: Qt qputenv() API
Tier 3: QWebEngineSettings attributes

Usage:
    # Apply all tiers before QApplication creation
    from .webengine_config import configure_webengine_all_tiers
    configure_webengine_all_tiers()

    # Or apply individual tiers
    from .webengine_config import (
        configure_webengine_tier1_env,
        configure_webengine_tier2_qputenv,
        configure_webengine_tier3_settings
    )
    configure_webengine_tier1_env()
    configure_webengine_tier2_qputenv()
    # ... after QWebEngineView creation:
    configure_webengine_tier3_settings(webview.settings())
"""

import os
import sys
from pathlib import Path
from typing import Optional, List

from PySide6.QtCore import QCoreApplication, Qt
from PySide6.QtWebEngineCore import QWebEngineSettings, qWebEngineVersion

from pycore import ColorPrint
from pycore.pyfoundations.serialized_worker import SerializedValue
from pycore.pyfoundations.system_paths import get_system_cache_dir

from pycore.pyutils.native_ui.step5_main_ui.pyside6.codec_diagnostic import check_proprietary_codec_support, print_codec_solutions



# ---------------------------------------------------------------------------
# Module state / configuration (declared at file top)
# ---------------------------------------------------------------------------
# Guard so the pre-QApplication tier configuration runs exactly once even when
# both the native launcher and the framework call configure_webengine_all_tiers().
_ALL_TIERS_CONFIGURED = SerializedValue(
    False,
    "WebEngineTierConfigurationStateThread",
)

# GPU rendering mode selectable via the PYCORE_WEBENGINE_GPU env var (or a
# persisted fallback marker). 'auto' = normal accelerated path.
_GPU_ENV_VAR = 'PYCORE_WEBENGINE_GPU'
_SOFTWARE_GPU_MODES = ('software', 'off', 'disable', 'none')

# Persisted marker: written after repeated GPU/render crashes so the NEXT launch
# starts in software rendering without user intervention (self-healing fallback).
_GPU_FALLBACK_MARKER = get_system_cache_dir() / 'webengine_gpu_fallback.flag'


def _gpu_fallback_marker_present() -> bool:
    """True if a prior run persisted a software-rendering fallback request."""
    try:
        return _GPU_FALLBACK_MARKER.is_file()
    except Exception:
        return False


def mark_gpu_fallback(reason: str = "") -> bool:
    """Persist a request to start in software rendering on the next launch.

    Called after repeated GPU/render-process crashes so a machine whose driver
    cannot support the accelerated path recovers automatically. Clear it with
    clear_gpu_fallback() or by setting PYCORE_WEBENGINE_GPU=auto.
    """
    try:
        _GPU_FALLBACK_MARKER.parent.mkdir(parents=True, exist_ok=True)
        _GPU_FALLBACK_MARKER.write_text(reason or "gpu_fallback", encoding='utf-8')
        ColorPrint.yellow(f"[WebEngineConfig] Persisted GPU software-fallback marker: {_GPU_FALLBACK_MARKER}")
        ColorPrint.yellow("[WebEngineConfig] Next launch will use software rendering. "
                          "Set PYCORE_WEBENGINE_GPU=auto (or delete the marker) to re-enable the GPU.")
        return True
    except Exception as e:
        ColorPrint.red(f"[WebEngineConfig] Failed to persist GPU fallback marker: {e}")
        return False


def clear_gpu_fallback() -> None:
    """Remove the persisted software-rendering fallback marker, if any."""
    try:
        if _GPU_FALLBACK_MARKER.is_file():
            _GPU_FALLBACK_MARKER.unlink()
            ColorPrint.blue("[WebEngineConfig] Cleared GPU software-fallback marker")
    except Exception:
        pass


def _resolve_gpu_mode() -> str:
    """Resolve the desired QtWebEngine GPU mode.

    Priority: PYCORE_WEBENGINE_GPU env var, then the persisted fallback marker,
    else 'auto'. Recognized values:
      auto         - normal accelerated path (default)
      dcomp-off    - accelerated but disable the Windows DirectComposition path
                     (--disable-features=DirectComposition) for flaky overlay drivers
      angle-sw     - force ANGLE SwiftShader software GL (--use-angle=swiftshader)
      software/off - no GPU (--disable-gpu --disable-gpu-compositing + QT_OPENGL=software)
    """
    mode = os.environ.get(_GPU_ENV_VAR, '').strip().lower()
    if not mode and _gpu_fallback_marker_present():
        ColorPrint.yellow("[WebEngineConfig] GPU fallback marker present -> forcing software rendering")
        mode = 'software'
    return mode or 'auto'


def _build_chromium_flags(
    enable_webcodecs: bool = True,
    enable_hardware_acceleration: bool = True,
    disable_gpu_sandbox: bool = True,
    enable_remote_debugging: bool = False,
    remote_debugging_port: int = 9222,
    disable_sandbox_for_root: bool = True,
    gpu_mode: Optional[str] = None,
) -> List[str]:
    """
    Build PLATFORM-AWARE Chromium flags for QtWebEngine.

    The flag set is tailored per OS. Linux gets VA-API / GBM video-decode flags;
    Windows relies on the default ANGLE->D3D11 + DirectComposition path (WebGL2 and
    D3D11 hardware video already work with no extra flags) and DELIBERATELY does NOT
    force hardware overlays / native GPU memory buffers / ignore-gpu-blocklist /
    disable-gpu-sandbox. Forcing those pushes the fragile DirectComposition overlay
    path that crashes the GPU/host process on hybrid laptop GPUs (the observed
    "QueryInterface to IDCompositionDevice4 failed" init crash).

    gpu_mode ('auto' | 'dcomp-off' | 'angle-sw' | 'software') selects a robust
    fallback when a driver cannot support the accelerated path (resolved from the
    PYCORE_WEBENGINE_GPU env / fallback marker when None).

    Args:
        enable_webcodecs: Enable WebCodecs API
        enable_hardware_acceleration: Enable GPU hardware acceleration
        disable_gpu_sandbox: Disable GPU sandbox (Linux only; ignored on Windows)
        enable_remote_debugging: Enable remote debugging (F12 dev tools)
        remote_debugging_port: Port for remote debugging (default: 9222)
        disable_sandbox_for_root: Auto-detect root user and add --no-sandbox if needed
        gpu_mode: Override GPU mode; None resolves from env / fallback marker

    Returns:
        List of Chromium command-line flags
    """
    is_windows = sys.platform == 'win32'
    is_macos = sys.platform == 'darwin'
    is_linux = sys.platform.startswith('linux')

    if gpu_mode is None:
        gpu_mode = _resolve_gpu_mode()
    software_mode = gpu_mode in _SOFTWARE_GPU_MODES

    enabled_features: List[str] = []
    disabled_features: List[str] = []
    flags: List[str] = []

    # Keep the hidden tray-resident webview active so it is ready when shown.
    flags.extend([
        '--disable-background-timer-throttling',
        '--disable-renderer-backgrounding',
        '--disable-backgrounding-occluded-windows',
    ])

    # Check if running as root (Linux/macOS only) -> needs --no-sandbox
    is_root = False
    if not is_windows and disable_sandbox_for_root:
        try:
            is_root = os.geteuid() == 0
            if is_root:
                ColorPrint.yellow("[WebEngineConfig] Running as root user detected")
        except AttributeError:
            pass

    # Remote debugging for developer tools (F12, right-click inspect)
    if enable_remote_debugging:
        flags.append(f'--remote-debugging-port={remote_debugging_port}')
        flags.append('--remote-allow-origins=*')  # Allow all origins (for development)
        ColorPrint.blue(f"[WebEngineConfig] Remote debugging enabled on port {remote_debugging_port}")
        ColorPrint.blue(f"[WebEngineConfig] Access dev tools at: http://localhost:{remote_debugging_port}")

    # WebCodecs support (H.264 decode API) - available regardless of GPU mode
    if enable_webcodecs:
        enabled_features.append('WebCodecs')

    if software_mode:
        # Robust software path: no GPU at all. Qt's own GL is switched to software
        # in Tier 0. This is the last-resort recovery for a broken GPU/driver.
        flags.extend(['--disable-gpu', '--disable-gpu-compositing'])
        ColorPrint.yellow(f"[WebEngineConfig] GPU acceleration DISABLED (gpu_mode={gpu_mode}) -> software rendering")
    elif enable_hardware_acceleration:
        # Safe, cross-platform acceleration baseline
        flags.extend([
            '--enable-gpu',
            '--enable-gpu-rasterization',
            '--enable-accelerated-2d-canvas',
            '--enable-webgl',
        ])

        if is_linux:
            # VA-API / GBM hardware video decode (Linux-scoped feature names)
            enabled_features.extend([
                'AcceleratedVideoDecodeLinuxGL',
                'VaapiVideoDecodeLinuxGL',
                'VaapiVideoEncoder',
            ])
            disabled_features.append('UseChromeOSDirectVideoDecoder')
            flags.extend([
                '--enable-accelerated-video-decode',
                '--enable-native-gpu-memory-buffers',  # Linux-scoped (GBM)
                '--enable-zero-copy',
                '--ignore-gpu-blocklist',
            ])
        elif is_windows:
            # ANGLE->D3D11 + DirectComposition is the Qt default and works out of
            # the box (WebGL2 + D3D11 video). Add only the safe hardware-video
            # feature + zero-copy. Do NOT force overlays / native GMB /
            # ignore-blocklist / disable-gpu-sandbox -- those crash hybrid GPUs.
            enabled_features.append('D3D11VideoDecoder')
            flags.append('--enable-zero-copy')
        elif is_macos:
            flags.append('--enable-zero-copy')

    # Windows GPU-mode escape hatches (independent of the hardware-accel toggle)
    if is_windows and not software_mode:
        if gpu_mode == 'dcomp-off':
            disabled_features.append('DirectComposition')
            ColorPrint.yellow("[WebEngineConfig] DirectComposition disabled via gpu_mode=dcomp-off")
        elif gpu_mode in ('angle-sw', 'swiftshader', 'angle-gl'):
            flags.append('--use-angle=swiftshader')
            ColorPrint.yellow("[WebEngineConfig] ANGLE SwiftShader (software GL) via gpu_mode")

    # GPU sandbox: only disable where it is actually needed (Linux root / Linux
    # explicit request). NEVER force-disable it on Windows -- it is a security
    # downgrade and is not needed on the default D3D11 path.
    if is_linux and (is_root or disable_gpu_sandbox):
        flags.append('--disable-gpu-sandbox')
    if is_root:
        flags.append('--no-sandbox')
        ColorPrint.yellow("[WebEngineConfig] Added --no-sandbox flag (running as root)")

    # Assemble --enable-features / --disable-features as single de-duplicated flags
    if enabled_features:
        flags.insert(0, f'--enable-features={",".join(dict.fromkeys(enabled_features))}')
    if disabled_features:
        idx = 1 if enabled_features else 0
        flags.insert(idx, f'--disable-features={",".join(dict.fromkeys(disabled_features))}')

    return flags


def configure_webengine_tier1_env(flags: Optional[List[str]] = None) -> bool:
    """
    Tier 1: Configure QtWebEngine via environment variable QTWEBENGINE_CHROMIUM_FLAGS.

    This is the most reliable method as it sets flags before Chromium initializes.
    MUST be called before QApplication is created.

    Args:
        flags: Custom Chromium flags list. If None, uses comprehensive default flags.

    Returns:
        True if configuration successful, False otherwise

    Default flags enable:
        - WebCodecs API
        - Hardware acceleration
        - Accelerated video decode
        - WebGL/WebGL2
        - GPU rasterization
        - Canvas acceleration
    """
    try:
        if flags is None:
            # Single source of truth: the platform-aware builder.
            flags = _build_chromium_flags()

        # Join flags into single string
        flags_str = ' '.join(flags)

        # Check if already set
        existing = os.environ.get('QTWEBENGINE_CHROMIUM_FLAGS', '')
        if existing:
            ColorPrint.yellow(f"[WebEngineConfig-Tier1] QTWEBENGINE_CHROMIUM_FLAGS already set: {existing}")
            # Merge with existing flags, de-duplicating repeated tokens (avoids the
            # whole set doubling when configure_webengine_all_tiers is called twice).
            merged_tokens = existing.split() + flags_str.split()
            flags_str = ' '.join(dict.fromkeys(merged_tokens))

        # Set environment variable
        os.environ['QTWEBENGINE_CHROMIUM_FLAGS'] = flags_str

        ColorPrint.green(f"[WebEngineConfig-Tier1] ✓ Environment variable set successfully")
        ColorPrint.blue(f"[WebEngineConfig-Tier1] QTWEBENGINE_CHROMIUM_FLAGS={flags_str}")

        return True

    except Exception as e:
        ColorPrint.red(f"[WebEngineConfig-Tier1] ✗ Failed to set environment variable: {e}")
        return False


def configure_webengine_tier2_qputenv(flags: Optional[List[str]] = None) -> bool:
    """
    Tier 2: Redundant environment variable configuration via os.environ (fallback).

    This is a redundant layer that ensures environment variables are set
    even if Tier 1 somehow fails. Uses Python's os.environ directly.

    NOTE: qputenv() does not exist in PySide6. We use os.environ instead.
    MUST be called before QApplication is created.

    Args:
        flags: Custom Chromium flags list. If None, uses comprehensive default flags.

    Returns:
        True if configuration successful, False otherwise
    """
    try:
        if flags is None:
            # Single source of truth: the platform-aware builder (same as Tier 1).
            flags = _build_chromium_flags()

        # Join flags into single string
        flags_str = ' '.join(flags)

        # Check if already set by Tier 1
        existing = os.environ.get('QTWEBENGINE_CHROMIUM_FLAGS', '')
        if existing == flags_str:
            ColorPrint.green(f"[WebEngineConfig-Tier2] ✓ Environment variable already set correctly (Tier 1)")
            return True

        # Set via os.environ as redundant layer
        os.environ['QTWEBENGINE_CHROMIUM_FLAGS'] = flags_str

        ColorPrint.green(f"[WebEngineConfig-Tier2] ✓ os.environ redundant set successful")
        ColorPrint.blue(f"[WebEngineConfig-Tier2] Flags: {flags_str[:100]}...")  # Truncate for readability

        return True

    except Exception as e:
        ColorPrint.red(f"[WebEngineConfig-Tier2] ✗ Failed to set os.environ: {e}")
        return False


def configure_webengine_tier3_settings(settings) -> bool:
    """
    Tier 3: Configure QtWebEngine via QWebEngineSettings attributes.

    This sets individual feature flags via QWebEngineSettings API.
    MUST be called after QWebEngineView is created.

    Args:
        settings: QWebEngineSettings instance (from QWebEngineView.settings())

    Returns:
        True if configuration successful, False otherwise

    Enables:
        - JavaScript
        - WebGL
        - Accelerated 2D Canvas
        - Plugins
        - Local content can access remote URLs (for development)
    """
    try:

        if settings is None:
            ColorPrint.red(f"[WebEngineConfig-Tier3] ✗ settings is None")
            return False

        # Enable JavaScript (required for WebCodecs)
        settings.setAttribute(QWebEngineSettings.JavascriptEnabled, True)
        ColorPrint.blue(f"[WebEngineConfig-Tier3] JavascriptEnabled = True")

        # Enable WebGL
        settings.setAttribute(QWebEngineSettings.WebGLEnabled, True)
        ColorPrint.blue(f"[WebEngineConfig-Tier3] WebGLEnabled = True")

        # Enable Accelerated 2D Canvas
        settings.setAttribute(QWebEngineSettings.Accelerated2dCanvasEnabled, True)
        ColorPrint.blue(f"[WebEngineConfig-Tier3] Accelerated2dCanvasEnabled = True")

        # Enable Plugins (may be needed for some codec features)
        settings.setAttribute(QWebEngineSettings.PluginsEnabled, True)
        ColorPrint.blue(f"[WebEngineConfig-Tier3] PluginsEnabled = True")

        # Allow local content to access remote URLs (development)
        # This allows local HTML to make requests to localhost:48000
        settings.setAttribute(QWebEngineSettings.LocalContentCanAccessRemoteUrls, True)
        ColorPrint.blue(f"[WebEngineConfig-Tier3] LocalContentCanAccessRemoteUrls = True")

        # Allow local content to access file URLs
        settings.setAttribute(QWebEngineSettings.LocalContentCanAccessFileUrls, True)
        ColorPrint.blue(f"[WebEngineConfig-Tier3] LocalContentCanAccessFileUrls = True")

        ColorPrint.green(f"[WebEngineConfig-Tier3] ✓ QWebEngineSettings configured successfully")

        return True

    except ImportError as e:
        ColorPrint.red(f"[WebEngineConfig-Tier3] ✗ PySide6.QtWebEngineCore not available: {e}")
        return False
    except Exception as e:
        ColorPrint.red(f"[WebEngineConfig-Tier3] ✗ Failed to configure settings: {e}")
        return False


def configure_webengine_all_tiers(
    env_flags: Optional[List[str]] = None,
    qputenv_flags: Optional[List[str]] = None,
    enable_webcodecs: bool = True,
    enable_hardware_acceleration: bool = True,
    disable_gpu_sandbox: bool = True,
    enable_remote_debugging: bool = False,
    remote_debugging_port: int = 9222,
    print_diagnostics: bool = False
) -> dict:
    """
    Apply all configuration tiers for maximum redundancy.

    Tier 1 + Tier 2 should be called before QApplication creation.
    Tier 3 will be applied automatically when QWebEngineView is created (via framework).

    Args:
        env_flags: Custom flags for Tier 1 (environment variable). If None, flags are auto-generated based on options.
        qputenv_flags: Custom flags for Tier 2 (qputenv). If None, flags are auto-generated based on options.
        enable_webcodecs: Enable WebCodecs API (default: True)
        enable_hardware_acceleration: Enable GPU hardware acceleration (default: True)
        disable_gpu_sandbox: Disable GPU sandbox for compatibility (default: True)
        enable_remote_debugging: Enable remote debugging (F12 dev tools) (default: False)
        remote_debugging_port: Port for remote debugging (default: 9222)
        print_diagnostics: Print detailed diagnostic info (default: False)

    Returns:
        Dictionary with success status for each tier:
        {
            'tier1_env': bool,
            'tier2_qputenv': bool,
            'note': str
        }
    """
    if not _ALL_TIERS_CONFIGURED.compare_and_set(False, True):
        # Idempotent: both the native launcher and the framework call this before
        # QApplication; run it once so the env var isn't populated twice.
        ColorPrint.yellow("[WebEngineConfig] Tiers already configured; skipping duplicate call")
        return {'tier1_env': True, 'tier2_qputenv': True, 'note': 'already configured (idempotent)'}

    ColorPrint.blue("=" * 80)
    ColorPrint.blue("[WebEngineConfig] Applying ALL configuration tiers (multi-redundant)")
    ColorPrint.blue("=" * 80)

    gpu_mode = _resolve_gpu_mode()

    # Tier 0: pre-QApplication GL attributes.
    # Qt 6 removed the bundled ANGLE, so QT_OPENGL=angle, Qt::AA_UseOpenGLES and a
    # forced OpenGL ES QSurfaceFormat "no longer have any effect"
    # (doc.qt.io/qt-6/opengl-changes-qt6.html) and only risk mismatching the real
    # context -- we no longer set them. WebGL2 is provided by QtWebEngine's own
    # bundled ANGLE (ANGLE->D3D11 on Windows) regardless. Only AA_ShareOpenGLContexts
    # is still required and kept.
    try:
        if QCoreApplication.instance() is None:
            ColorPrint.blue("\n[WebEngineConfig] >>> Tier 0: OpenGL context sharing (Qt 6)")

            # CRITICAL and still required in Qt 6: share GL contexts for QtWebEngine.
            # Must be set before QApplication. Fixes CSS animation flicker / high CPU.
            QCoreApplication.setAttribute(Qt.AA_ShareOpenGLContexts)
            ColorPrint.green("[WebEngineConfig-Tier0] AA_ShareOpenGLContexts enabled (required for QtWebEngine)")

            if gpu_mode in _SOFTWARE_GPU_MODES:
                # Robust fallback: drive Qt's own rendering through the bundled Mesa
                # llvmpipe software rasterizer so the UI comes up even on a broken GPU.
                os.environ['QT_OPENGL'] = 'software'
                os.environ.setdefault('QT_QUICK_BACKEND', 'software')
                ColorPrint.yellow(f"[WebEngineConfig-Tier0] Software rendering (QT_OPENGL=software) via gpu_mode={gpu_mode}")
            else:
                ColorPrint.blue(f"[WebEngineConfig-Tier0] GPU mode: {gpu_mode} (default ANGLE/D3D11 on Windows; nothing forced)")
        else:
            ColorPrint.yellow("[WebEngineConfig-Tier0] QApplication already created; skipping Tier 0 GL attributes")
    except Exception as e:
        ColorPrint.red(f"[WebEngineConfig-Tier0] Failed to configure GL attributes: {e}")

    # Auto-generate flags if not provided
    if env_flags is None:
        env_flags = _build_chromium_flags(
            enable_webcodecs=enable_webcodecs,
            enable_hardware_acceleration=enable_hardware_acceleration,
            disable_gpu_sandbox=disable_gpu_sandbox,
            enable_remote_debugging=enable_remote_debugging,
            remote_debugging_port=remote_debugging_port
        )
        ColorPrint.blue(f"[WebEngineConfig] Auto-generated flags with options:")
        ColorPrint.blue(f"  - enable_webcodecs: {enable_webcodecs}")
        ColorPrint.blue(f"  - enable_hardware_acceleration: {enable_hardware_acceleration}")
        ColorPrint.blue(f"  - disable_gpu_sandbox: {disable_gpu_sandbox}")
        ColorPrint.blue(f"  - enable_remote_debugging: {enable_remote_debugging}")
        if enable_remote_debugging:
            ColorPrint.blue(f"  - remote_debugging_port: {remote_debugging_port}")

    if qputenv_flags is None:
        qputenv_flags = env_flags  # Use same flags

    results = {}

    # Tier 1: Environment variable
    ColorPrint.blue("\n[WebEngineConfig] >>> Tier 1: QTWEBENGINE_CHROMIUM_FLAGS environment variable")
    results['tier1_env'] = configure_webengine_tier1_env(env_flags)

    # Tier 2: qputenv
    ColorPrint.blue("\n[WebEngineConfig] >>> Tier 2: Qt qputenv() API")
    results['tier2_qputenv'] = configure_webengine_tier2_qputenv(qputenv_flags)

    # Tier 3: QWebEngineSettings (will be applied later when webview is created)
    ColorPrint.blue("\n[WebEngineConfig] >>> Tier 3: QWebEngineSettings (will be applied in PySide6WebView)")
    results['note'] = "Tier 3 will be applied automatically when QWebEngineView is created"

    # Print diagnostics if requested
    if print_diagnostics:
        ColorPrint.blue("\n[WebEngineConfig] >>> Diagnostic Information")
        print_webengine_info()

        # Check proprietary codec support (CRITICAL for H.264)
        ColorPrint.blue("\n[WebEngineConfig] >>> Proprietary Codec Support Check")
        has_codecs = check_proprietary_codec_support()
        if not has_codecs:
            print_codec_solutions()

    # Summary
    ColorPrint.blue("\n" + "=" * 80)
    ColorPrint.blue("[WebEngineConfig] Configuration Summary:")
    ColorPrint.blue("=" * 80)

    success_count = sum([results['tier1_env'], results['tier2_qputenv']])

    if success_count == 2:
        ColorPrint.green(f"[WebEngineConfig] ✓ All pre-init tiers successful (2/2)")
    elif success_count == 1:
        ColorPrint.yellow(f"[WebEngineConfig] ⚠ Partial success (1/2 tiers)")
    else:
        ColorPrint.red(f"[WebEngineConfig] ✗ All pre-init tiers failed (0/2)")

    ColorPrint.blue(f"[WebEngineConfig] Tier 1 (env): {'✓ OK' if results['tier1_env'] else '✗ FAILED'}")
    ColorPrint.blue(f"[WebEngineConfig] Tier 2 (qputenv): {'✓ OK' if results['tier2_qputenv'] else '✗ FAILED'}")
    ColorPrint.blue(f"[WebEngineConfig] Tier 3 (settings): Pending (will be applied in webview)")
    ColorPrint.blue("=" * 80)

    return results


def get_chromium_version() -> Optional[str]:
    """
    Get Chromium version used by QtWebEngine.

    Returns:
        Chromium version string, or None if unable to determine
    """
    try:
        version = qWebEngineVersion()
        ColorPrint.blue(f"[WebEngineConfig] QtWebEngine Chromium version: {version}")
        return version
    except Exception as e:
        ColorPrint.yellow(f"[WebEngineConfig] Unable to get Chromium version: {e}")
        return None


def print_webengine_info():
    """Print comprehensive QtWebEngine configuration info for debugging."""
    ColorPrint.blue("=" * 80)
    ColorPrint.blue("[WebEngineConfig] QtWebEngine Environment Information")
    ColorPrint.blue("=" * 80)

    # Chromium version
    get_chromium_version()

    # Environment variables
    ColorPrint.blue("\n[WebEngineConfig] Environment Variables:")
    env_vars = [
        'QTWEBENGINE_CHROMIUM_FLAGS',
        'QTWEBENGINE_REMOTE_DEBUGGING',
        'QTWEBENGINE_DISABLE_SANDBOX',
    ]

    for var in env_vars:
        value = os.environ.get(var, '<not set>')
        ColorPrint.blue(f"  {var} = {value}")

    # Platform info
    ColorPrint.blue(f"\n[WebEngineConfig] Platform: {sys.platform}")

    ColorPrint.blue("=" * 80)
