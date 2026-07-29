#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Speech Transcription Thread

Threaded speech transcription following project threading standards.
Uses THREAD_BUS for communication, no shared mutable state.
"""

import sys
import threading
import time
from typing import Optional, Dict, Any
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS
from pycore.pyctl.speech.speech_manager import get_speech_manager
from pycore.pyctl.speech.transcription_app import run_app, run_app_dual_source


class SpeechTranscriptionThread(threading.Thread):
    """
    Speech Transcription Thread

    Follows project threading standards:
    - Inherits from threading.Thread directly
    - Name ends with "Thread"
    - Uses THREAD_BUS for communication
    - No shared mutable state
    - No cross-thread callbacks
    """

    def __init__(
        self,
        mode: str = "single",  # "single" or "dual"
        mic_language: str = "zh-CN",
        system_language: str = "en-US",
        daemon: bool = True
    ):
        """
        Initialize speech transcription thread

        Args:
            mode: Transcription mode ("single" or "dual")
            mic_language: Language for microphone (dual mode)
            system_language: Language for system audio (dual mode)
            daemon: Run as daemon thread
        """
        super().__init__(name="SpeechTranscriptionThread", daemon=daemon)
        self._config_signal = f"speech.transcription.config.{id(self)}"
        self._stop_signal = f"speech.transcription.stop.{id(self)}"
        THREAD_BUS.signal(self._config_signal, {
            "mode": mode,
            "mic_language": mic_language,
            "system_language": system_language,
        })
        THREAD_BUS.clear_signal(self._stop_signal)

        ColorPrint.blue(f"[SpeechThread] Initialized - Mode: {mode}")

    def run(self):
        """Thread main execution"""
        ColorPrint.green("[SpeechThread] Starting...")
        config = dict(THREAD_BUS.get_signal(self._config_signal, {}) or {})
        mode = str(config.get("mode") or "single")

        # Send startup message via THREAD_BUS
        THREAD_BUS.signal("speech.thread.started", {
            "mode": mode,
            "mic_language": config.get("mic_language"),
            "system_language": config.get("system_language"),
        })

        # Initialize speech manager
        speech_manager = get_speech_manager()
        if not speech_manager.initialize():
            ColorPrint.red("[SpeechThread] Failed to initialize speech manager")
            THREAD_BUS.signal("speech.thread.error", {
                "error": "Initialization failed"
            })
            return

        ColorPrint.green("[SpeechThread] Speech manager initialized")

        # Run appropriate mode
        if mode == "single":
            self._run_single_source()
        elif mode == "dual":
            self._run_dual_source()
        else:
            ColorPrint.red(f"[SpeechThread] Unknown mode: {mode}")
            THREAD_BUS.signal("speech.thread.error", {
                "error": f"Unknown mode: {mode}"
            })
            return

        # Cleanup
        ColorPrint.yellow("[SpeechThread] Stopped")
        THREAD_BUS.signal("speech.thread.stopped", {})

    def _run_single_source(self):
        """Run single-source transcription"""
        ColorPrint.blue("[SpeechThread] Running single-source mode...")


        # Run in this thread
        speech_manager = get_speech_manager()
        run_app(speech_manager)

    def _run_dual_source(self):
        """Run dual-source transcription"""
        ColorPrint.blue("[SpeechThread] Running dual-source mode...")


        # Run in this thread
        speech_manager = get_speech_manager()
        run_app_dual_source(speech_manager)

    def stop(self):
        """Request thread to stop"""
        ColorPrint.yellow("[SpeechThread] Stop requested...")
        THREAD_BUS.signal(self._stop_signal, True)

        # Send stop request via THREAD_BUS
        THREAD_BUS.signal("speech.thread.stop_requested", {})

    def is_running(self) -> bool:
        """Check if thread is running"""
        return self.is_alive() and not THREAD_BUS.get_signal(self._stop_signal, False)


class SpeechServiceThread(threading.Thread):
    """
    Speech Service Thread

    Background speech service that can be controlled via THREAD_BUS.
    Suitable for integration with other services.
    """

    def __init__(
        self,
        auto_start: bool = False,
        daemon: bool = True
    ):
        """
        Initialize speech service thread

        Args:
            auto_start: Auto-start transcription on thread start
            daemon: Run as daemon thread
        """
        super().__init__(name="SpeechServiceThread", daemon=daemon)
        self._config_signal = f"speech.service.config.{id(self)}"
        self._stop_signal = f"speech.service.stop.{id(self)}"
        THREAD_BUS.signal(self._config_signal, {"auto_start": bool(auto_start)})
        THREAD_BUS.clear_signal(self._stop_signal)

        ColorPrint.blue(f"[SpeechService] Initialized - Auto-start: {auto_start}")

    def run(self):
        """Thread main execution"""
        ColorPrint.green("[SpeechService] Starting...")
        config = dict(THREAD_BUS.get_signal(self._config_signal, {}) or {})
        auto_start = bool(config.get("auto_start"))

        # Send startup message
        THREAD_BUS.signal("speech.service.started", {
            "auto_start": auto_start
        })

        # Initialize speech manager
        speech_manager = get_speech_manager()

        if not speech_manager.initialize():
            ColorPrint.red("[SpeechService] Failed to initialize")
            THREAD_BUS.signal("speech.service.error", {
                "error": "Initialization failed"
            })
            return

        ColorPrint.green("[SpeechService] Initialized and ready")

        THREAD_BUS.signal("speech.service.ready", {
            "stt_available": speech_manager.is_stt_available(),
            "tts_available": speech_manager.is_tts_available()
        })

        # Auto-start if requested
        if auto_start:
            ColorPrint.blue("[SpeechService] Auto-starting transcription...")
            THREAD_BUS.signal("speech.service.auto_start", {})

        # Keep thread alive and process commands from message queue
        while not THREAD_BUS.get_signal(self._stop_signal, False):
            # Check for commands from message queue
            command = THREAD_BUS.receive_message("speech.service.commands", block=False)
            if command:
                self._handle_command(command, speech_manager)

            time.sleep(0.1)  # Short sleep to avoid busy-wait

        # Cleanup
        ColorPrint.yellow("[SpeechService] Stopped")
        THREAD_BUS.signal("speech.service.stopped", {})

    def _handle_command(self, command: Dict[str, Any], speech_manager: Any):
        """Handle command from message queue"""
        cmd_type = command.get("type")

        if cmd_type == "start":
            mode = command.get("mode", "single")
            ColorPrint.blue(f"[SpeechService] Start command received - Mode: {mode}")
            THREAD_BUS.signal("speech.service.transcription_started", {
                "mode": mode
            })

        elif cmd_type == "stop":
            ColorPrint.blue("[SpeechService] Stop command received")
            self.stop()

        elif cmd_type == "status":
            status = speech_manager.get_status()

            THREAD_BUS.signal("speech.service.status_response", {
                "initialized": True,
                "running": self.is_running(),
                "speech_status": status
            })

    def stop(self):
        """Request thread to stop"""
        ColorPrint.yellow("[SpeechService] Stop requested...")
        THREAD_BUS.signal(self._stop_signal, True)

        THREAD_BUS.signal("speech.service.stop_requested", {})

    def is_running(self) -> bool:
        """Check if thread is running"""
        return self.is_alive() and not THREAD_BUS.get_signal(self._stop_signal, False)
