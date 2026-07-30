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
from typing import Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS
from pycore.pyutils.clipboard.clipboard_monitor import get_clipboard_monitor
from pycore.pyutils.window.screenshot import WindowScreenshot
from pycore.pyctl.desktop.ai_hooks import ai_generate_text
from pycore.pyctl.desktop.processor import process_text_input, process_image_input
from pycore.pyfoundations.serialized_worker import (
    SerializedWorkerThread,
    call_serialized,
)

import traceback


_STATE_SIGNAL = 'pyctl.desktop.background_services.state'
_STATE_QUEUE = 'pyctl.desktop.background_services.state.update'
_AI_QUEUE = 'pyctl.desktop.background_services.ai'
_AI_START_QUEUE = 'pyctl.desktop.background_services.ai.start'
_SCREENSHOT_START_QUEUE = 'pyctl.desktop.background_services.screenshot.start'
_STATE_WORKER = SerializedWorkerThread(
    _STATE_QUEUE,
    'VoiceSubtitleBackgroundStateThread',
)
_STATE_WORKER.start()


def _publish_background_state(updates: dict) -> dict:
    """Merge background service state on its owner thread."""
    state = dict(THREAD_BUS.get_signal(_STATE_SIGNAL, {}) or {})
    state.update(updates)
    THREAD_BUS.signal(_STATE_SIGNAL, state)
    return state


class VoiceSubtitleAIThread(threading.Thread):
    """Run clipboard AI work received through THREAD_BUS."""

    def __init__(self) -> None:
        super().__init__(daemon=True, name='VoiceSubtitleAIThread')

    def run(self) -> None:
        payload = THREAD_BUS.receive_message(_AI_START_QUEUE)
        if isinstance(payload, dict):
            payload['service']._ai_processor_loop(payload['generation'])


class VoiceSubtitleScreenshotThread(threading.Thread):
    """Run screenshot work received through THREAD_BUS."""

    def __init__(self) -> None:
        super().__init__(daemon=True, name='VoiceSubtitleScreenshotThread')

    def run(self) -> None:
        payload = THREAD_BUS.receive_message(_SCREENSHOT_START_QUEUE)
        if isinstance(payload, dict):
            payload['service']._screenshot_loop(payload['generation'])



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
        self._min_request_interval = 2.0  # minimum 2 seconds between requests
        if THREAD_BUS.get_signal(_STATE_SIGNAL) is None:
            THREAD_BUS.signal(_STATE_SIGNAL, {
                'clipboard_enabled': False,
                'ai_running': False,
                'ai_generation': 0,
                'screenshot_enabled': False,
                'screenshot_running': False,
                'screenshot_generation': 0,
                'screenshot_interval': 60,
                'screenshot_lang': 'en',
            })

    def _state(self) -> dict:
        """Return the current immutable service state snapshot."""
        return dict(THREAD_BUS.get_signal(_STATE_SIGNAL, {}) or {})

    def _update_state(self, **updates) -> dict:
        """Merge state updates through the state-owner queue."""
        return call_serialized(_STATE_QUEUE, _publish_background_state, updates)

    def _generation_active(self, kind: str, generation: int) -> bool:
        """Check whether one loop generation is still active."""
        state = self._state()
        return bool(
            state.get(f'{kind}_running')
            and state.get(f'{kind}_generation') == generation
        )

    # ========== Clipboard Monitoring ==========

    def start_clipboard_monitor(self):
        """Start clipboard monitoring"""
        state = self._state()
        if state.get('clipboard_enabled'):
            ColorPrint.yellow("[VoiceSubtitle] Clipboard monitor already running")
            return

        if not state.get('ai_running'):
            generation = int(state.get('ai_generation', 0)) + 1
            self._update_state(ai_running=True, ai_generation=generation)
            THREAD_BUS.send_message(_AI_START_QUEUE, {
                'service': self,
                'generation': generation,
            })
            VoiceSubtitleAIThread().start()
            ColorPrint.green("[VoiceSubtitle] AI processor thread started")

        self._clipboard_monitor = get_clipboard_monitor(client_id="voice_subtitle")
        self._clipboard_monitor.set_change_callback(self._on_clipboard_change)
        self._clipboard_monitor.start()
        self._update_state(clipboard_enabled=True)

        ColorPrint.green("[VoiceSubtitle] Clipboard monitoring started")

    def stop_clipboard_monitor(self):
        """Stop clipboard monitoring"""
        if not self._state().get('clipboard_enabled'):
            return

        if self._clipboard_monitor:
            self._clipboard_monitor.stop()
            self._clipboard_monitor = None

        self._update_state(clipboard_enabled=False, ai_running=False)
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

        THREAD_BUS.send_message(_AI_QUEUE, content)

    def _ai_processor_loop(self, generation: int):
        """
        AI processing loop with rate limiting

        Processes clipboard content through the unified AI gateway with the
        ORIGINAL prompt: "Rewrite as English: 'xxxx'"

        Ensures minimum 2 second interval between requests.
        """
        ColorPrint.green("[VoiceSubtitle] AI processor loop started")
        last_ai_request = 0.0

        while self._generation_active('ai', generation):
            try:
                content = THREAD_BUS.receive_message(
                    _AI_QUEUE,
                    block=True,
                    timeout=1.0,
                )
                if not isinstance(content, str):
                    continue

                # Rate limiting: ensure at least 2 seconds between requests
                current_time = time.time()
                time_since_last = current_time - last_ai_request
                if time_since_last < self._min_request_interval:
                    sleep_time = self._min_request_interval - time_since_last
                    ColorPrint.blue(f"[AI] Rate limiting, sleeping {sleep_time:.2f}s...")
                    time.sleep(sleep_time)

                # Process through the unified AI gateway
                ColorPrint.blue(f"[AI] Processing: {content[:50]}...")
                processed = self._process_clipboard_with_ai(content)
                last_ai_request = time.time()

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
        state = self._state()
        if state.get('screenshot_enabled'):
            # Allow a live language change without a stop/start cycle.
            screenshot_lang = lang or state.get('screenshot_lang', 'en')
            self._update_state(screenshot_lang=screenshot_lang)
            ColorPrint.yellow(
                f"[VoiceSubtitle] Screenshot monitor already running (lang -> {screenshot_lang})")
            return

        generation = int(state.get('screenshot_generation', 0)) + 1
        self._update_state(
            screenshot_interval=interval,
            screenshot_lang=lang or 'en',
            screenshot_enabled=True,
            screenshot_running=True,
            screenshot_generation=generation,
        )
        THREAD_BUS.send_message(_SCREENSHOT_START_QUEUE, {
            'service': self,
            'generation': generation,
        })
        VoiceSubtitleScreenshotThread().start()

        ColorPrint.green(f"[VoiceSubtitle] Screenshot monitoring started (interval: {interval}s)")

    def stop_screenshot_monitor(self):
        """Stop screenshot monitoring"""
        state = self._state()
        if not state.get('screenshot_enabled'):
            return
        generation = int(state.get('screenshot_generation', 0))
        self._update_state(screenshot_enabled=False, screenshot_running=False)
        THREAD_BUS.signal(
            f'pyctl.desktop.background_services.screenshot.stop.{generation}',
            True,
        )

        ColorPrint.yellow("[VoiceSubtitle] Screenshot monitoring stopped")

    def _screenshot_loop(self, generation: int):
        """Screenshot capture loop"""
        screenshot_manager = WindowScreenshot()

        while self._generation_active('screenshot', generation):
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

            state = self._state()
            stop_signal = (
                f'pyctl.desktop.background_services.screenshot.stop.{generation}'
            )
            if THREAD_BUS.wait_signal(
                stop_signal,
                timeout=float(state.get('screenshot_interval', 60)),
            ):
                THREAD_BUS.clear_signal(stop_signal)
                break

    async def _process_screenshot(self, image_path: str):
        """
        Process screenshot through the unified AI gateway and add to queue

        Args:
            image_path: Path to screenshot image
        """
        try:
            lang = self._state().get('screenshot_lang', 'en') or 'en'
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
        return bool(self._state().get('clipboard_enabled'))

    def is_screenshot_enabled(self) -> bool:
        """Check if screenshot monitoring is enabled"""
        return bool(self._state().get('screenshot_enabled'))

    def get_screenshot_interval(self) -> int:
        """Get screenshot capture interval"""
        return int(self._state().get('screenshot_interval', 60))

    def get_screenshot_lang(self) -> str:
        """Get the screenshot recognition/output language."""
        return self._state().get('screenshot_lang', 'en') or 'en'

    def set_screenshot_lang(self, lang: str) -> None:
        """Set the recognition/output language (applies on the next capture)."""
        if lang:
            self._update_state(screenshot_lang=lang)


background_services = VoiceSubtitleBackgroundServices()
