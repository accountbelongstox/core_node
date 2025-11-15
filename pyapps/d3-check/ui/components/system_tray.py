#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
System Tray Component
Provides system tray functionality for Windows 10/11
"""

import tkinter as tk
from tkinter import messagebox
import sys
import os
import time
import threading
from typing import Optional, Callable

# Import from common_imports (unified public library imports)
from providor.common_imports import ColorPrint

# Import i18n manager (global singleton instance)
from d3utils.i18n_manager import i18n_manager

from pycore.pyfoundations.third_party import pystray, PIL
from PIL import Image, ImageDraw

TRAY_AVAILABLE = True

class SystemTray:
    """System tray component for Windows 10/11"""
    
    def __init__(self, parent_ui):
        """
        Initialize system tray
        
        Args:
            parent_ui: Parent UI instance (Diablo3MacroUI)
        """
        self.parent_ui = parent_ui
        self.tray_icon = None
        self.tray_thread = None
        self.is_running = False
        
        # Callbacks
        self.on_show_window: Optional[Callable] = None
        self.on_exit: Optional[Callable] = None
        
        if TRAY_AVAILABLE:
            self._create_tray_icon()
        else:
            ColorPrint.yellow("[TRAY] System tray not available - install pystray and PIL")
    
    def _create_tray_icon(self):
        """Create system tray icon"""
        try:
            # Create a simple icon
            icon_image = self._create_icon_image()

            # Create menu items (only 2 items: Show Software and Exit)
            menu = pystray.Menu(
                pystray.MenuItem(
                    i18n_manager.get_ui_text("system_tray.show_software"),
                    self._show_window
                ),
                pystray.MenuItem(
                    i18n_manager.get_ui_text("system_tray.exit"),
                    self._exit_application
                )
            )

            # Create tray icon
            self.tray_icon = pystray.Icon(
                "D3Check",
                icon_image,
                i18n_manager.get_ui_text("main_window.title"),
                menu
            )

            ColorPrint.blue("[TRAY] System tray icon created")

        except Exception as e:
            ColorPrint.red(f"[TRAY] Failed to create tray icon: {e}")
            self.tray_icon = None
    
    def _create_icon_image(self):
        """Create a simple icon image"""
        try:
            # Create a 64x64 icon with a simple design
            width, height = 64, 64
            
            # Create image with transparent background
            image = Image.new('RGBA', (width, height), (0, 0, 0, 0))
            draw = ImageDraw.Draw(image)
            
            # Draw a simple D3-style icon (red circle with white "D3")
            # Background circle
            draw.ellipse([8, 8, width-8, height-8], fill=(200, 0, 0, 255), outline=(255, 255, 255, 255), width=2)
            
            # Draw "D3" text (simplified as rectangles for now)
            # D
            draw.rectangle([20, 20, 24, 44], fill=(255, 255, 255, 255))
            draw.rectangle([20, 20, 32, 24], fill=(255, 255, 255, 255))
            draw.rectangle([20, 40, 32, 44], fill=(255, 255, 255, 255))
            draw.rectangle([30, 24, 32, 40], fill=(255, 255, 255, 255))
            
            # 3
            draw.rectangle([36, 20, 40, 44], fill=(255, 255, 255, 255))
            draw.rectangle([36, 20, 44, 24], fill=(255, 255, 255, 255))
            draw.rectangle([36, 32, 44, 36], fill=(255, 255, 255, 255))
            draw.rectangle([36, 40, 44, 44], fill=(255, 255, 255, 255))
            
            return image
            
        except Exception as e:
            ColorPrint.red(f"[TRAY] Failed to create icon image: {e}")
            # Return a simple colored square as fallback
            image = Image.new('RGB', (64, 64), (200, 0, 0))
            return image
    
    def start(self):
        """Start the system tray"""
        if not TRAY_AVAILABLE or not self.tray_icon:
            return False
        
        try:
            if not self.is_running:
                self.is_running = True
                self.tray_thread = threading.Thread(target=self._run_tray, daemon=True)
                self.tray_thread.start()
                ColorPrint.green("[TRAY] System tray started")
                return True
        except Exception as e:
            ColorPrint.red(f"[TRAY] Failed to start system tray: {e}")
            return False
    
    def stop(self):
        """Stop the system tray"""
        if not TRAY_AVAILABLE or not self.tray_icon:
            return
        
        try:
            if self.is_running:
                self.is_running = False
                if self.tray_icon:
                    # Stop the tray icon
                    self.tray_icon.stop()
                    # Wait a bit for the tray to stop
                    time.sleep(0.1)
                    # Remove the icon reference
                    self.tray_icon = None
                ColorPrint.blue("[TRAY] System tray stopped")
        except Exception as e:
            ColorPrint.red(f"[TRAY] Failed to stop system tray: {e}")
    
    def _run_tray(self):
        """Run the tray icon in a separate thread"""
        try:
            if self.tray_icon:
                self.tray_icon.run()
        except Exception as e:
            ColorPrint.red(f"[TRAY] Error running tray icon: {e}")
    
    def _show_window(self, icon=None, item=None):
        """Show the main window"""
        try:
            if self.on_show_window:
                self.on_show_window()
            else:
                # Default behavior
                if hasattr(self.parent_ui, 'root'):
                    self.parent_ui.root.deiconify()
                    self.parent_ui.root.lift()
                    self.parent_ui.root.focus_force()
            ColorPrint.blue("[TRAY] Show window requested")
        except Exception as e:
            ColorPrint.red(f"[TRAY] Error showing window: {e}")
    
    def _exit_application(self, icon=None, item=None):
        """Exit the application"""
        try:
            if self.on_exit:
                self.on_exit()
            else:
                # Default behavior
                if hasattr(self.parent_ui, 'root'):
                    self.parent_ui.root.quit()
            ColorPrint.blue("[TRAY] Exit application requested")
        except Exception as e:
            ColorPrint.red(f"[TRAY] Error exiting application: {e}")
    
    def set_show_callback(self, callback: Callable):
        """Set callback for show window action"""
        self.on_show_window = callback

    def set_exit_callback(self, callback: Callable):
        """Set callback for exit action"""
        self.on_exit = callback
    
    def update_tooltip(self, text: str):
        """Update tray icon tooltip"""
        if TRAY_AVAILABLE and self.tray_icon:
            try:
                self.tray_icon.title = text
            except Exception as e:
                ColorPrint.red(f"[TRAY] Failed to update tooltip: {e}")
    
    def show_notification(self, title: str, message: str):
        """Show a system notification"""
        if TRAY_AVAILABLE and self.tray_icon:
            try:
                self.tray_icon.notify(message, title)
            except Exception as e:
                ColorPrint.red(f"[TRAY] Failed to show notification: {e}")
