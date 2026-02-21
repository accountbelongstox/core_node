#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Diablo 3 Macro - WebView UI Launcher
Uses NativeUIFrameworkV2 with HTML/CSS/JS frontend.
Single creator of D3MacroWebViewAPI / WebViewFramework per window.
"""

# Check and install dependencies before importing
from pycore import check_and_install_dependencies
check_and_install_dependencies()

# Import ColorPrint for logging
from pycore.pyfoundations.color_print import ColorPrint

import os
import sys
from pathlib import Path
from typing import Optional, Dict, Any

# Import WebView UI Framework
from pycore.pyutils.native_ui import (
    WebViewFramework,
    UIConfig,
    SignalType
)

# Import d3-check components
from pycore.pyfoundations.encyclopedia import ENCYCLOPEDIA
from providor.providor_index import CONFIG, save_config, DIABLO_III_WINDOW_TITLES
from providor.i18n_manager import i18n_manager
class D3MacroWebViewAPI:
    """
    Python API exposed to JavaScript via webview bridge
    This class provides methods that can be called from the HTML UI
    """

    def __init__(self, launcher):
        """
        Initialize API with reference to launcher

        Args:
            launcher: Reference to WebViewLauncher instance
        """
        self.launcher = launcher
        ColorPrint.green("[WebViewAPI] API initialized")

    def call_method(self, method_name: str, params: Optional[Dict] = None) -> Dict[str, Any]:
        """
        Generic method call dispatcher

        Args:
            method_name: Name of the method to call
            params: Parameters to pass to the method

        Returns:
            Result dictionary
        """
        ColorPrint.blue(f"[WebViewAPI] Method called: {method_name} with params: {params}")

        if hasattr(self, method_name):
            method = getattr(self, method_name)
            if params:
                return method(params)
            return method()
        else:
            ColorPrint.yellow(f"[WebViewAPI] Unknown method: {method_name}")
            return {'success': False, 'error': f'Unknown method: {method_name}'}

    # ============================================
    # Window Control Methods
    # ============================================

    def minimize_window(self) -> Dict[str, Any]:
        """Minimize window"""
        ColorPrint.blue("[WebViewAPI] Minimize window requested")
        self.launcher.framework.emit_signal(SignalType.WINDOW_MINIMIZE)
        return {'success': True}

    def maximize_window(self) -> Dict[str, Any]:
        """Maximize window"""
        ColorPrint.blue("[WebViewAPI] Maximize window requested")
        self.launcher.framework.emit_signal(SignalType.WINDOW_MAXIMIZE)
        return {'success': True}

    def close_window(self) -> Dict[str, Any]:
        """Close window"""
        ColorPrint.blue("[WebViewAPI] Close window requested")
        self.launcher.framework.emit_signal(SignalType.WINDOW_CLOSE)
        return {'success': True}

    # ============================================
    # Macro Control Methods
    # ============================================

    def start_macro(self, params: Optional[Dict] = None) -> Dict[str, Any]:
        """
        Start macro execution

        Args:
            params: Parameters including config name

        Returns:
            Success status
        """
        config = params.get('config', 'config1') if params else 'config1'
        ColorPrint.green(f"[WebViewAPI] Starting macro with config: {config}")

        # TODO: Integrate with actual macro controller
        # Example: self.launcher.macro_controller.start(config)

        return {'success': True, 'message': f'Macro started with {config}'}

    def stop_macro(self) -> Dict[str, Any]:
        """Stop macro execution"""
        ColorPrint.yellow("[WebViewAPI] Stopping macro")

        # TODO: Integrate with actual macro controller
        # Example: self.launcher.macro_controller.stop()

        return {'success': True, 'message': 'Macro stopped'}

    # ============================================
    # Status Query Methods
    # ============================================

    def get_window_status(self) -> Dict[str, Any]:
        """
        Get game window detection status

        Returns:
            Window detection status
        """
        # TODO: Integrate with actual game window detector
        # Example: detected = self.launcher.window_detector.is_detected()

        return {
            'success': True,
            'detected': False,  # Replace with actual detection
            'window_title': (DIABLO_III_WINDOW_TITLES[0] if DIABLO_III_WINDOW_TITLES else "Diablo III")
        }

    def get_skills(self) -> list:
        """
        Get configured skills list

        Returns:
            List of skill configurations
        """
        # TODO: Integrate with actual skill configuration
        # Example: return self.launcher.skill_manager.get_skills()

        return [
            {'name': 'Primary Attack', 'key': '1', 'delay': 100},
            {'name': 'Secondary Attack', 'key': '2', 'delay': 150},
            {'name': 'Defensive Skill', 'key': '3', 'delay': 200}
        ]

    # ============================================
    # Language Control Methods
    # ============================================

    def change_language(self, params: Dict) -> Dict[str, Any]:
        """
        Change UI language

        Args:
            params: Parameters including language code

        Returns:
            Success status
        """
        language = params.get('language', 'en')
        ColorPrint.blue(f"[WebViewAPI] Changing language to: {language}")

        # Update i18n manager
        i18n_manager.set_language(language)

        return {'success': True, 'language': language}


class WebViewLauncher:
    """
    WebView UI Launcher for Diablo 3 Macro
    Integrates NativeUIFrameworkV2 with HTML frontend
    """

    def __init__(self):
        """Initialize WebView launcher"""
        ColorPrint.green("=" * 70)
        ColorPrint.green(" Diablo 3 Macro - WebView UI Launcher")
        ColorPrint.green("=" * 70)

        # Get HTML UI path
        self.ui_dir = Path(__file__).parent / 'html'
        self.html_file = self.ui_dir / 'index.html'

        if not self.html_file.exists():
            ColorPrint.red(f"[WebViewLauncher] HTML file not found: {self.html_file}")
            raise FileNotFoundError(f"HTML UI file not found: {self.html_file}")

        ColorPrint.green(f"[WebViewLauncher] HTML UI path: {self.html_file}")

        # Create Python API for JavaScript
        self.api = D3MacroWebViewAPI(self)

        # Store in ENCYCLOPEDIA for global access
        ENCYCLOPEDIA['webview_launcher'] = self
        ENCYCLOPEDIA['webview_api'] = self.api

        # Create UI configuration
        config = UIConfig(
            app_name="Diablo 3 Macro Control",
            window_size=(800, 600),
            min_window_size=(670, 400),
            show_on_start=True,
            frameless=True,
            ui_source=str(self.html_file),
            icon_path=None,  # TODO: Add icon path if available
            debug=True
        )

        # Create UI framework instance with API
        self.framework = WebViewFramework(config, api_instance=self.api)

        # Register custom signal handlers
        self._register_signal_handlers()

        # Register timer tasks
        self._register_timer_tasks()

        # TODO: Initialize controllers
        # self.macro_controller = D3MacroController()
        # self.window_detector = GameWindowDetector()
        # self.skill_manager = SkillManager()

        ColorPrint.green("[WebViewLauncher] Initialization complete")

    def _register_signal_handlers(self):
        """Register custom signal handlers"""
        ColorPrint.blue("[WebViewLauncher] Registering signal handlers...")

        # UI Ready signal
        def on_ui_ready(signal):
            ColorPrint.green("[WebViewLauncher] UI is ready!")
            # TODO: Initialize UI with data
            # self._update_ui_data()

        self.framework.register_signal_handler(SignalType.UI_READY, on_ui_ready)

        ColorPrint.blue("[WebViewLauncher] Signal handlers registered")

    def _register_timer_tasks(self):
        """Register periodic timer tasks"""
        ColorPrint.blue("[WebViewLauncher] Registering timer tasks...")

        # Status update task (every 1 second)
        def update_status_task():
            # TODO: Update status in UI
            # ColorPrint.blue("[Task] Updating status...")
            pass

        self.framework.register_timer_task(
            name="status_update",
            callback=update_status_task,
            interval=1
        )

        # Window detection task (every 2 seconds)
        def window_detection_task():
            # TODO: Detect game window
            # ColorPrint.blue("[Task] Detecting window...")
            pass

        self.framework.register_timer_task(
            name="window_detection",
            callback=window_detection_task,
            interval=2
        )

        ColorPrint.blue("[WebViewLauncher] Timer tasks registered")

    def start(self):
        """Start the UI framework"""
        ColorPrint.green("[WebViewLauncher] Starting UI framework...")
        self.framework.start()

    def stop(self):
        """Stop the UI framework"""
        ColorPrint.yellow("[WebViewLauncher] Stopping UI framework...")
        self.framework.stop()


def main():
    """Main entry point. Launcher and start must succeed at code level."""
    launcher = WebViewLauncher()
    launcher.start()


if __name__ == '__main__':
    main()
