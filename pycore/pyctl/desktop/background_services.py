# -*- coding: utf-8 -*-
"""
Voice Subtitle Background Services

Manages clipboard monitoring and scheduled screenshot features. All AI work
goes through the unified AI gateway (injected via ai_hooks at the app layer):
clipboard text is rewritten in English, screenshots are described — by
whichever provider the gateway's smart dispatch picks. Prompts are unchanged
from the original Gemini-only implementation.
"""

import asyncio
import threading
import time
import queue
from pathlib import Path
from typing import Optional

from pycore import ColorPrint
from pycore.pyutils.clipboard.clipboard_monitor import get_clipboard_monitor
from pycore.pyutils.window.screenshot import WindowScreenshot
from pycore.pyctl.desktop import get_voice_subtitle_queue
from pycore.pyctl.desktop.ai_hooks import ai_generate_text
from pycore.pyctl.desktop.processor import process_text_input, process_image_input

import traceback



class VoiceSubtitleBackgroundServices:
    """
    Manages background services for voice subtitle system

    Features:
    - Clipboard monitoring with sentence length detection
    - Scheduled screenshot capture with AI analysis (unified gateway)
    """

    def __init__(self):
        """Initialize background services"""
        self._clipboard_monitor = None
        self._screenshot_timer = None
        self._clipboard_enabled = False
        self._screenshot_enabled = False
        self._screenshot_interval = 60  # seconds
        self._screenshot_lang = "en"  # recognition + output language (UI-selectable)
        self._screenshot_thread = None
        self._screenshot_running = False

        # AI request queue and rate limiting (provider-agnostic — the gateway
        # picks the provider; this only spaces out our own requests)
        self._ai_queue = queue.Queue()
        self._ai_thread = None
        self._ai_running = False
        self._last_ai_request = 0  # timestamp
        self._min_request_interval = 2.0  # minimum 2 seconds between requests

    # ========== Clipboard Monitoring ==========

    def start_clipboard_monitor(self):
        """Start clipboard monitoring"""
        if self._clipboard_enabled:
            ColorPrint.yellow("[VoiceSubtitle] Clipboard monitor already running")
            return

        # Start AI processing thread
        if not self._ai_running:
            self._ai_running = True
            self._ai_thread = threading.Thread(
                target=self._ai_processor_loop,
                daemon=True,
                name="VoiceSubtitle-AI"
            )
            self._ai_thread.start()
            ColorPrint.green("[VoiceSubtitle] AI processor thread started")

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

        # Stop AI processor thread
        if self._ai_running:
            self._ai_running = False
            if self._ai_thread:
                self._ai_thread.join(timeout=3.0)
                self._ai_thread = None
            ColorPrint.yellow("[VoiceSubtitle] AI processor thread stopped")

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

        ColorPrint.blue(f"[VoiceSubtitle] Clipboard changed, adding to AI queue: {content[:50]}...")

        # Add to AI processing queue (thread-safe)
        self._ai_queue.put(content)

    def _ai_processor_loop(self):
        """
        AI processing loop with rate limiting

        Processes clipboard content through the unified AI gateway with the
        ORIGINAL prompt: "Rewrite as English: 'xxxx'"

        Ensures minimum 2 second interval between requests.
        """
        ColorPrint.green("[VoiceSubtitle] AI processor loop started")

        while self._ai_running:
            try:
                # Get content from queue (blocking with timeout)
                try:
                    content = self._ai_queue.get(timeout=1.0)
                except queue.Empty:
                    continue

                # Rate limiting: ensure at least 2 seconds between requests
                current_time = time.time()
                time_since_last = current_time - self._last_ai_request
                if time_since_last < self._min_request_interval:
                    sleep_time = self._min_request_interval - time_since_last
                    ColorPrint.blue(f"[AI] Rate limiting, sleeping {sleep_time:.2f}s...")
                    time.sleep(sleep_time)

                # Process through the unified AI gateway
                ColorPrint.blue(f"[AI] Processing: {content[:50]}...")
                processed = self._process_clipboard_with_ai(content)
                self._last_ai_request = time.time()

                if processed:
                    text, provider, model = processed
                    # Add processed text to voice subtitle queue (AI-attributed)
                    asyncio.run(self._add_to_queue_sync(
                        text, category='clipboard', ai_provider=provider, ai_model=model))
                    ColorPrint.green(f"[AI] {provider}/{model} processed and added to queue: {text[:50]}...")
                else:
                    ColorPrint.yellow("[AI] Processing returned empty result")

            except Exception as e:
                ColorPrint.red(f"[AI] Error in processor loop: {e}")
                traceback.print_exc()

    def _process_clipboard_with_ai(self, text: str):
        """
        Process clipboard text through the unified AI gateway.

        Args:
            text: Original clipboard text

        Returns:
            (processed_text, provider, model) or None if failed
        """
        try:
            # Build prompt — UNCHANGED from the original implementation.
            prompt = f"Rewrite as English: '{text}'"

            result = ai_generate_text(prompt, source="clipboard-monitor")

            if result.get('success') and result.get('text'):
                return (result['text'].strip(),
                        result.get('provider', ''), result.get('model', ''))
            ColorPrint.red(f"[AI] No text in response: {result.get('error')}")
            return None

        except Exception as e:
            ColorPrint.red(f"[AI] Error processing clipboard: {e}")
            traceback.print_exc()
            return None

    async def _add_to_queue_sync(self, text: str, category: str = 'clipboard',
                                 ai_provider: str = '', ai_model: str = ''):
        """
        Add text to voice subtitle queue (sync wrapper for async function)

        Args:
            text: Processed text
            category: Queue category
            ai_provider: AI provider that produced the text (for attribution)
            ai_model: model id used by that provider
        """
        try:
            await process_text_input(text, langs=['en'], category=category,
                                     ai_provider=ai_provider, ai_model=ai_model)
            ColorPrint.green(f"[VoiceSubtitle] Added to queue: {text[:50]}...")
        except Exception as e:
            ColorPrint.red(f"[VoiceSubtitle] Error adding to queue: {e}")

    # ========== Screenshot Monitoring ==========

    def start_screenshot_monitor(self, interval: int = 60, lang: str = "en"):
        """
        Start scheduled screenshot capture

        Args:
            interval: Capture interval in seconds
            lang: Recognition/output language — the single parameter that drives
                  OCR recognition AND the generated subtitle language.
        """
        if self._screenshot_enabled:
            # Allow a live language change without a stop/start cycle.
            self._screenshot_lang = lang or self._screenshot_lang
            ColorPrint.yellow(
                f"[VoiceSubtitle] Screenshot monitor already running (lang -> {self._screenshot_lang})")
            return

        self._screenshot_interval = interval
        self._screenshot_lang = lang or "en"
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

                    # OCR -> translate -> TTS the screenshot (in the configured language)
                    asyncio.run(self._process_screenshot(screenshot_path))
                else:
                    ColorPrint.red("[VoiceSubtitle] Screenshot capture failed")

            except Exception as e:
                ColorPrint.red(f"[VoiceSubtitle] Error in screenshot loop: {e}")

            # Wait for next capture
            time.sleep(self._screenshot_interval)

    async def _process_screenshot(self, image_path: str):
        """
        Process screenshot through the unified AI gateway and add to queue

        Args:
            image_path: Path to screenshot image
        """
        try:
            lang = getattr(self, '_screenshot_lang', 'en') or 'en'
            await process_image_input(
                image_path=image_path,
                langs=[lang],
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

    def get_screenshot_lang(self) -> str:
        """Get the screenshot recognition/output language."""
        return getattr(self, '_screenshot_lang', 'en') or 'en'

    def set_screenshot_lang(self, lang: str) -> None:
        """Set the recognition/output language (applies on the next capture)."""
        if lang:
            self._screenshot_lang = lang


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
