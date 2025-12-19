#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Hotkey Listener

Global keyboard and mouse event listener with hotkey detection.
"""

import time
import threading
from typing import Optional, Callable
from pycore.pyfoundations.color_print import ColorPrint
from pycore.pyfoundations.third_party import get_third_package_pynput

pynput = get_third_package_pynput()


class HotkeyListener:
    """
    Global hotkey listener for keyboard + mouse combinations

    Listens for Ctrl+Click and Ctrl+DoubleClick events.
    Runs in background thread following project threading standards.
    """

    def __init__(self):
        """Initialize hotkey listener"""
        self.ctrl_pressed = False
        self.last_click_time = 0
        self.double_click_threshold = 0.3  # seconds

        # Callbacks
        self.on_ctrl_click: Optional[Callable[[], None]] = None
        self.on_ctrl_double_click: Optional[Callable[[], None]] = None

        # Listener threads
        self.keyboard_listener: Optional[pynput.keyboard.Listener] = None
        self.mouse_listener: Optional[pynput.mouse.Listener] = None

        self.running = False

    def start(self):
        """Start listening for hotkeys"""
        if self.running:
            ColorPrint.yellow("[Hotkey] Already running")
            return

        self.running = True

        # Start keyboard listener
        self.keyboard_listener = pynput.keyboard.Listener(
            on_press=self._on_key_press,
            on_release=self._on_key_release
        )
        self.keyboard_listener.start()

        # Start mouse listener
        self.mouse_listener = pynput.mouse.Listener(
            on_click=self._on_mouse_click
        )
        self.mouse_listener.start()

        ColorPrint.green("[Hotkey] Listener started")
        ColorPrint.blue("[Hotkey] Ctrl+Click - Copy last recognized text")
        ColorPrint.blue("[Hotkey] Ctrl+DoubleClick - Replay last sentence")

    def stop(self):
        """Stop listening for hotkeys"""
        if not self.running:
            return

        self.running = False

        if self.keyboard_listener:
            self.keyboard_listener.stop()
            self.keyboard_listener = None

        if self.mouse_listener:
            self.mouse_listener.stop()
            self.mouse_listener = None

        ColorPrint.yellow("[Hotkey] Listener stopped")

    def _on_key_press(self, key):
        """Handle key press events"""
        try:
            # Check for Ctrl key
            if key == pynput.keyboard.Key.ctrl_l or key == pynput.keyboard.Key.ctrl_r:
                self.ctrl_pressed = True
        except AttributeError:
            pass

    def _on_key_release(self, key):
        """Handle key release events"""
        try:
            # Check for Ctrl key
            if key == pynput.keyboard.Key.ctrl_l or key == pynput.keyboard.Key.ctrl_r:
                self.ctrl_pressed = False
        except AttributeError:
            pass

    def _on_mouse_click(self, x, y, button, pressed):
        """Handle mouse click events"""
        # Only handle left button press with Ctrl held
        if not pressed or button != pynput.mouse.Button.left:
            return

        if not self.ctrl_pressed:
            return

        current_time = time.time()
        time_since_last_click = current_time - self.last_click_time

        # Check for double click
        if time_since_last_click < self.double_click_threshold:
            # Double click detected
            ColorPrint.green("[Hotkey] Ctrl+DoubleClick detected")
            if self.on_ctrl_double_click:
                # Run callback in separate thread to avoid blocking
                threading.Thread(
                    target=self.on_ctrl_double_click,
                    daemon=True,
                    name="HotkeyCallbackThread"
                ).start()
            # Reset to prevent triple-click
            self.last_click_time = 0
        else:
            # Single click detected
            ColorPrint.green("[Hotkey] Ctrl+Click detected")
            if self.on_ctrl_click:
                # Run callback in separate thread to avoid blocking
                threading.Thread(
                    target=self.on_ctrl_click,
                    daemon=True,
                    name="HotkeyCallbackThread"
                ).start()
            self.last_click_time = current_time

    def set_ctrl_click_callback(self, callback: Callable[[], None]):
        """Set callback for Ctrl+Click"""
        self.on_ctrl_click = callback

    def set_ctrl_double_click_callback(self, callback: Callable[[], None]):
        """Set callback for Ctrl+DoubleClick"""
        self.on_ctrl_double_click = callback
