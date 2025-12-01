# -*- coding: utf-8 -*-
"""
Voice Subtitle Background Services

Manages clipboard monitoring and scheduled screenshot features.
"""

import asyncio
import threading
import time
import queue
from pathlib import Path
from typing import Optional

from pycore import ColorPrint
from pycore.pyutils.clipboard.clipboard_monitor import get_clipboard_monitor
from pycore.pyutils.window_screenshot import WindowScreenshot
from pycore.pyutils.gemini import gemini_manager
from pycore.pyctl.desktop import get_voice_subtitle_queue
from pycore.pyctl.desktop.processor import process_text_input, process_image_input


class VoiceSubtitleBackgroundServices:
    """
    Manages background services for voice subtitle system

    Features:
    - Clipboard monitoring with sentence length detection
    - Scheduled screenshot capture with Gemini analysis
    """

    def __init__(self):
        """Initialize background services"""
        self._clipboard_monitor = None
        self._screenshot_timer = None
        self._clipboard_enabled = False
        self._screenshot_enabled = False
        self._screenshot_interval = 60  # seconds
        self._screenshot_thread = None
        self._screenshot_running = False

        # Gemini request queue and rate limiting
        self._gemini_queue = queue.Queue()
        self._gemini_thread = None
        self._gemini_running = False
        self._last_gemini_request = 0  # timestamp
        self._min_request_interval = 2.0  # minimum 2 seconds between requests

    # ========== Clipboard Monitoring ==========

    def start_clipboard_monitor(self):
        """Start clipboard monitoring"""
        if self._clipboard_enabled:
            ColorPrint.yellow("[VoiceSubtitle] Clipboard monitor already running")
            return

        # Start Gemini processing thread
        if not self._gemini_running:
            self._gemini_running = True
            self._gemini_thread = threading.Thread(
                target=self._gemini_processor_loop,
                daemon=True,
                name="VoiceSubtitle-Gemini"
            )
            self._gemini_thread.start()
            ColorPrint.green("[VoiceSubtitle] Gemini processor thread started")

        self._clipboard_monitor = get_clipboard_monitor(client_id="voice_subtitle")
        self._clipboard_monitor.set_change_callback(self._on_clipboard_change)
        self._clipboard_monitor.start()
        self._clipboard_enabled = True

        ColorPrint.green("[VoiceSubtitle] Clipboard monitoring started")

    def stop_clipboard_monitor(self):
        """Stop clipboard monitoring"""
        if not self._clipboard_enabled:
            return

        if self._clipboard_monitor:
            self._clipboard_monitor.stop()
            self._clipboard_monitor = None

        self._clipboard_enabled = False

        # Stop Gemini processor thread
        if self._gemini_running:
            self._gemini_running = False
            if self._gemini_thread:
                self._gemini_thread.join(timeout=3.0)
                self._gemini_thread = None
            ColorPrint.yellow("[VoiceSubtitle] Gemini processor thread stopped")

        ColorPrint.yellow("[VoiceSubtitle] Clipboard monitoring stopped")

    def _on_clipboard_change(self, content: str):
        """
        Handle clipboard content change

        Args:
            content: Clipboard text content
        """
        # Check if content is sentence length (at least 10 characters)
        if len(content.strip()) < 10:
            ColorPrint.blue(f"[VoiceSubtitle] Clipboard content too short, ignoring: {content[:30]}...")
            return

        ColorPrint.blue(f"[VoiceSubtitle] Clipboard changed, adding to Gemini queue: {content[:50]}...")

        # Add to Gemini processing queue (thread-safe)
        self._gemini_queue.put(content)

    def _gemini_processor_loop(self):
        """
        Gemini processing loop with rate limiting

        Processes clipboard content through Gemini with prompt:
        "Rewrite as English: 'xxxx'"

        Ensures minimum 2 second interval between requests.
        """
        ColorPrint.green("[VoiceSubtitle] Gemini processor loop started")

        while self._gemini_running:
            try:
                # Get content from queue (blocking with timeout)
                try:
                    content = self._gemini_queue.get(timeout=1.0)
                except queue.Empty:
                    continue

                # Rate limiting: ensure at least 2 seconds between requests
                current_time = time.time()
                time_since_last = current_time - self._last_gemini_request
                if time_since_last < self._min_request_interval:
                    sleep_time = self._min_request_interval - time_since_last
                    ColorPrint.blue(f"[Gemini] Rate limiting, sleeping {sleep_time:.2f}s...")
                    time.sleep(sleep_time)

                # Process with Gemini
                ColorPrint.blue(f"[Gemini] Processing: {content[:50]}...")
                processed_text = self._process_clipboard_with_gemini(content)
                self._last_gemini_request = time.time()

                if processed_text:
                    # Add processed text to voice subtitle queue
                    asyncio.run(self._add_to_queue_sync(processed_text, category='clipboard'))
                    ColorPrint.green(f"[Gemini] Processed and added to queue: {processed_text[:50]}...")
                else:
                    ColorPrint.yellow("[Gemini] Processing returned empty result")

            except Exception as e:
                ColorPrint.red(f"[Gemini] Error in processor loop: {e}")
                import traceback
                traceback.print_exc()

    def _process_clipboard_with_gemini(self, text: str) -> Optional[str]:
        """
        Process clipboard text with Gemini

        Args:
            text: Original clipboard text

        Returns:
            Processed English text or None if failed
        """
        try:
            # Build prompt
            prompt = f"Rewrite as English: '{text}'"

            # Call Gemini API
            result = gemini_manager.ask_gemini(prompt, model_name="gemini-2.0-flash-exp")

            if result and result.get('text'):
                return result['text'].strip()
            else:
                ColorPrint.red(f"[Gemini] No text in response: {result}")
                return None

        except Exception as e:
            ColorPrint.red(f"[Gemini] Error processing clipboard: {e}")
            import traceback
            traceback.print_exc()
            return None

    async def _add_to_queue_sync(self, text: str, category: str = 'clipboard'):
        """
        Add text to voice subtitle queue (sync wrapper for async function)

        Args:
            text: Processed text
            category: Queue category
        """
        try:
            await process_text_input(text, langs=['en'], category=category)
            ColorPrint.green(f"[VoiceSubtitle] Added to queue: {text[:50]}...")
        except Exception as e:
            ColorPrint.red(f"[VoiceSubtitle] Error adding to queue: {e}")

    # ========== Screenshot Monitoring ==========

    def start_screenshot_monitor(self, interval: int = 60):
        """
        Start scheduled screenshot capture

        Args:
            interval: Capture interval in seconds
        """
        if self._screenshot_enabled:
            ColorPrint.yellow("[VoiceSubtitle] Screenshot monitor already running")
            return

        self._screenshot_interval = interval
        self._screenshot_enabled = True
        self._screenshot_running = True

        # Start screenshot thread
        self._screenshot_thread = threading.Thread(
            target=self._screenshot_loop,
            daemon=True,
            name="VoiceSubtitle-Screenshot"
        )
        self._screenshot_thread.start()

        ColorPrint.green(f"[VoiceSubtitle] Screenshot monitoring started (interval: {interval}s)")

    def stop_screenshot_monitor(self):
        """Stop screenshot monitoring"""
        if not self._screenshot_enabled:
            return

        self._screenshot_enabled = False
        self._screenshot_running = False

        if self._screenshot_thread:
            self._screenshot_thread.join(timeout=3.0)
            self._screenshot_thread = None

        ColorPrint.yellow("[VoiceSubtitle] Screenshot monitoring stopped")

    def _screenshot_loop(self):
        """Screenshot capture loop"""
        screenshot_manager = WindowScreenshot()

        while self._screenshot_running:
            try:
                # Capture fullscreen screenshot
                ColorPrint.blue("[VoiceSubtitle] Capturing screenshot...")
                result = screenshot_manager.capture_window_fast(
                    titles=None,  # Full screen
                    filename_prefix="voice_subtitle_auto"
                )

                if result and result.get('screenshot_path'):
                    screenshot_path = str(result['screenshot_path'])
                    ColorPrint.green(f"[VoiceSubtitle] Screenshot captured: {screenshot_path}")

                    # Process screenshot with Gemini
                    asyncio.run(self._process_screenshot(screenshot_path))
                else:
                    ColorPrint.red("[VoiceSubtitle] Screenshot capture failed")

            except Exception as e:
                ColorPrint.red(f"[VoiceSubtitle] Error in screenshot loop: {e}")

            # Wait for next capture
            import time
            time.sleep(self._screenshot_interval)

    async def _process_screenshot(self, image_path: str):
        """
        Process screenshot with Gemini and add to queue

        Args:
            image_path: Path to screenshot image
        """
        try:
            await process_image_input(
                image_path=image_path,
                langs=['en'],
                category='screenshot'
            )
            ColorPrint.green("[VoiceSubtitle] Screenshot processed and added to queue")
        except Exception as e:
            ColorPrint.red(f"[VoiceSubtitle] Error processing screenshot: {e}")

    # ========== Status ==========

    def is_clipboard_enabled(self) -> bool:
        """Check if clipboard monitoring is enabled"""
        return self._clipboard_enabled

    def is_screenshot_enabled(self) -> bool:
        """Check if screenshot monitoring is enabled"""
        return self._screenshot_enabled

    def get_screenshot_interval(self) -> int:
        """Get screenshot capture interval"""
        return self._screenshot_interval


# Global singleton instance
_background_services: Optional[VoiceSubtitleBackgroundServices] = None
_services_lock = threading.Lock()


def get_background_services() -> VoiceSubtitleBackgroundServices:
    """
    Get global background services instance

    Returns:
        VoiceSubtitleBackgroundServices: Global instance
    """
    global _background_services

    if _background_services is None:
        with _services_lock:
            if _background_services is None:
                _background_services = VoiceSubtitleBackgroundServices()

    return _background_services
