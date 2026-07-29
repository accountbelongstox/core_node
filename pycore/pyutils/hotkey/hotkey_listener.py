#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Hotkey Listener

Global keyboard and mouse event listener with hotkey detection.

THREAD_BUS Integration:
- Registers shutdown handler (priority=85) for graceful shutdown
- Triggers 'hotkey.ctrl_click' events when Ctrl+Click detected
- Triggers 'hotkey.ctrl_double_click' events when Ctrl+DoubleClick detected
- Backwards compatible: keeps existing callback mechanism
"""

import time
import threading
from typing import Optional, Callable
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.third_party.api import get_third_package_pynput
from pycore.pyfoundations.serialized_worker import start_bus_task

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

        # THREAD_BUS Integration: Register shutdown handler
        # Priority=85 ensures hotkey listener stops before most services
        THREAD_BUS.register_shutdown_handler(
            self.stop,
            priority=85,
            name="hotkey_listener"
        )
        ColorPrint.blue("[Hotkey] Registered THREAD_BUS shutdown handler (priority=85)")

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

            # THREAD_BUS Integration: Trigger event (new mechanism)
            THREAD_BUS.trigger_event('hotkey.ctrl_double_click', {
                'x': x,
                'y': y,
                'timestamp': current_time
            }, async_mode=True)

            # Call legacy callback (backward compatibility)
            if self.on_ctrl_double_click:
                # Run callback in separate thread to avoid blocking
                start_bus_task(
                    self.on_ctrl_double_click,
                    thread_name="HotkeyCallbackThread",
                )
            # Reset to prevent triple-click
            self.last_click_time = 0
        else:
            # Single click detected
            ColorPrint.green("[Hotkey] Ctrl+Click detected")

            # THREAD_BUS Integration: Trigger event (new mechanism)
            THREAD_BUS.trigger_event('hotkey.ctrl_click', {
                'x': x,
                'y': y,
                'timestamp': current_time
            }, async_mode=True)

            # Call legacy callback (backward compatibility)
            if self.on_ctrl_click:
                # Run callback in separate thread to avoid blocking
                start_bus_task(
                    self.on_ctrl_click,
                    thread_name="HotkeyCallbackThread",
                )
            self.last_click_time = current_time

    def set_ctrl_click_callback(self, callback: Callable[[], None]):
        """Set callback for Ctrl+Click"""
        self.on_ctrl_click = callback

    def set_ctrl_double_click_callback(self, callback: Callable[[], None]):
        """Set callback for Ctrl+DoubleClick"""
        self.on_ctrl_double_click = callback
