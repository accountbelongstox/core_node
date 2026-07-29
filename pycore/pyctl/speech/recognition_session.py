#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Recognition Session

- RecognitionChannel: per-source recognition result state + clipboard sync.
- TranscriptionSession: transcription lifecycle (on_recognizing/recognized),
  error recovery with quota/connection/authentication handling.
"""

import sys
import time
from pathlib import Path
from typing import Optional, Any, Dict, List

from pycore.pyfoundations.thread_bus.bus import THREAD_BUS
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyutils.clipboard.clipboard_sync import add_recognition_to_clipboard
from pycore.pyctl.speech.cache_info import print_recognition_cache_info

from pycore.pyctl.speech.provider_status import get_provider_status



class RecognitionChannel:
    """
    Single recognition channel for one audio source

    Manages recognition results from one audio source (microphone or system audio).
    """

    def __init__(self, channel_name: str, language: str, speech_manager=None):
        """
        Initialize recognition channel

        Args:
            channel_name: Name of this channel (e.g., 'Microphone', 'System Audio')
            language: Language code for this channel (e.g., 'zh-CN', 'en-US')
            speech_manager: SpeechManager instance (to show provider info)
        """
        self.channel_name = channel_name
        self.language = language
        self.speech_manager = speech_manager
        self.recognized_texts: List[Dict[str, Any]] = []
        self.current_recognizing_text = ""
        self.last_recognized_text = ""
        self.last_recognized_confidence = 0.0

    def on_recognizing(self, text: str):
        """Handle intermediate recognition result"""
        self.current_recognizing_text = text
        ColorPrint.blue(f"[{self.channel_name}] [RECOGNIZING] {text}")
        sys.stdout.flush()

    def on_recognized(self, text: str, confidence: float):
        """Handle final recognition result"""
        if not text or text.strip() == "":
            return

        # Get STT provider name
        stt_provider = "Unknown"
        if self.speech_manager:
            current_provider = self.speech_manager.get_current_stt_provider()
            if current_provider:
                stt_provider = current_provider.__class__.__name__.replace("Provider", "").replace("SpeechRecognition", "")

        ColorPrint.green(f"[{self.channel_name}] [RECOGNIZED via {stt_provider}] {text}")
        ColorPrint.yellow(f"[{self.channel_name}] [CONFIDENCE] {confidence:.2%}")
        sys.stdout.flush()

        # Store recognized text
        self.recognized_texts.append({
            'text': text,
            'confidence': confidence,
            'timestamp': time.time(),
            'channel': self.channel_name,
            'language': self.language
        })

        # Update last recognized
        self.last_recognized_text = text
        self.last_recognized_confidence = confidence

        # Reset current recognizing text
        self.current_recognizing_text = ""

        # Add to clipboard database for real-time sync
        add_recognition_to_clipboard(
            text=text,
            language=self.language,
            source=self.channel_name.lower().replace(' ', '_'),
            client_id="speech_recognition",
            confidence=confidence
        )

        # Print cycle complete
        print("-" * 70)
        ColorPrint.blue(f"[{self.channel_name}] [CYCLE COMPLETE] Text: {text}")
        ColorPrint.blue(f"[{self.channel_name}] [CYCLE COMPLETE] Length: {len(text)} chars, Words: {len(text.split())}")
        print("-" * 70)

        # Print cache info (with speech_manager to show default TTS provider)
        print_recognition_cache_info(text, self.language, self.speech_manager)

    def get_last_text(self) -> Optional[str]:
        """Get the last recognized text"""
        return self.last_recognized_text if self.last_recognized_text else None


class TranscriptionSession:
    """
    Transcription session manager

    Handles transcription lifecycle and processing of recognized text.
    """

    def __init__(self, language: str = "zh-CN", speech_manager=None):
        """
        Initialize transcription session

        Args:
            language: Language code (e.g., 'zh-CN', 'en-US')
            speech_manager: SpeechManager instance (to show provider info)
        """
        self.language = language
        self.speech_manager = speech_manager
        self.recognized_texts = []
        self.session_start_time = None
        self.current_recognizing_text = ""

        # Error handling state
        self.has_error = False
        self._stop_signal = f"speech.transcription_session.stop.{id(self)}"
        self._quota_signal = f"speech.transcription_session.quota.{id(self)}"
        THREAD_BUS.signal(self._stop_signal, False)
        THREAD_BUS.signal(self._quota_signal, False)
        self.error_message = ""

    def on_recognizing(self, text: str):
        """
        Handle intermediate recognition result

        Args:
            text: Intermediate recognized text
        """
        self.current_recognizing_text = text
        ColorPrint.blue(f"[RECOGNIZING] {text}")
        sys.stdout.flush()

    def on_recognized(self, text: str, confidence: float):
        """
        Handle final recognition result (one recognition cycle completed)

        This is called when a complete utterance is recognized.
        Each cycle from first [RECOGNIZING] to [RECOGNIZED] represents one utterance.

        Args:
            text: Final recognized text
            confidence: Recognition confidence (0.0 to 1.0)
        """
        # Get STT provider name
        stt_provider = "Unknown"
        if self.speech_manager:
            current_provider = self.speech_manager.get_current_stt_provider()
            if current_provider:
                stt_provider = current_provider.__class__.__name__.replace("Provider", "").replace("SpeechRecognition", "")

        ColorPrint.green(f"[RECOGNIZED via {stt_provider}] {text}")
        ColorPrint.yellow(f"[CONFIDENCE] {confidence:.2%}")
        sys.stdout.flush()

        # Store recognized text
        self.recognized_texts.append({
            'text': text,
            'confidence': confidence,
            'timestamp': time.time()
        })

        # Add to clipboard database for real-time sync
        add_recognition_to_clipboard(
            text=text,
            language=self.language,
            source="transcription",
            client_id="speech_recognition",
            confidence=confidence
        )

        # Process the completed recognition cycle
        self._process_recognition_cycle(text, confidence)

        # Reset current recognizing text
        self.current_recognizing_text = ""

    def _process_recognition_cycle(self, text: str, confidence: float):
        """
        Process a completed recognition cycle

        This method is called after each [RECOGNIZED] event.
        You can add custom processing here:
        - Save to file
        - Send to TTS for read-back
        - Send to API
        - Trigger actions
        - etc.

        Args:
            text: Recognized text
            confidence: Confidence score
        """
        # Print separator for clarity
        print("-" * 70)
        ColorPrint.blue(f"[CYCLE COMPLETE] Text: {text}")
        ColorPrint.blue(f"[CYCLE COMPLETE] Length: {len(text)} chars, Words: {len(text.split())}")
        print("-" * 70)

        # Print cache info (with speech_manager to show default TTS provider)
        print_recognition_cache_info(text, self.language, self.speech_manager)

        # Example: Save to file
        # self._save_to_file(text)

        # Example: Send to TTS
        # self._speak_text(text)

        # Example: Check for commands
        # self._check_commands(text)

    def _save_to_file(self, text: str):
        """Save recognized text to file"""
        output_file = Path("transcription.txt")

        with open(output_file, 'a', encoding='utf-8') as f:
            timestamp = time.strftime("%Y-%m-%d %H:%M:%S")
            f.write(f"[{timestamp}] {text}\n")

    def _speak_text(self, text: str):
        """
        Speak the recognized text using TTS

        Example implementation (requires TTS module)
        """
        # from pycore.pyctl.speech import speech_manager
        # speech_manager.synthesize_to_file(text, "temp.mp3")
        # play_audio("temp.mp3")
        pass

    def _check_commands(self, text: str):
        """Check if text contains commands"""
        text_lower = text.lower()

        if "stop" in text_lower or "exit" in text_lower:
            ColorPrint.yellow("[COMMAND] Stop command detected")
            # You can set a flag to stop the session

        if "save" in text_lower:
            ColorPrint.yellow("[COMMAND] Save command detected")
            # Save current session

    def on_error(self, error_msg: str):
        """Handle recognition error with recovery logic"""
        ColorPrint.red(f"[ERROR] {error_msg}")
        sys.stdout.flush()

        # Set error state
        self.has_error = True
        self.error_message = error_msg

        # Report provider failure to ProviderStatus
        try:
            provider_status = get_provider_status()
        except:
            provider_status = None

        # Check for critical errors that require session termination
        if "Quota exceeded" in error_msg or "Error code: 1007" in error_msg:
            THREAD_BUS.signal(self._quota_signal, True)
            THREAD_BUS.signal(self._stop_signal, True)

            # Report Azure STT as unavailable due to quota
            if provider_status:
                provider_status.mark_unavailable('stt', 'azure', 'Quota exceeded (Error 1007)')

            # Show critical error message
            print("\n" + "="*70)
            ColorPrint.red("CRITICAL ERROR: Azure Speech API Quota Exceeded!")
            print("="*70)
            ColorPrint.yellow("Your Azure Speech Service free tier limit has been reached.")
            ColorPrint.yellow("")
            ColorPrint.yellow("Options to resolve:")
            ColorPrint.yellow("  1. Wait for quota reset (resets monthly)")
            ColorPrint.yellow("  2. Upgrade your Azure subscription")
            ColorPrint.yellow("  3. Use local STT provider (offline)")
            ColorPrint.yellow("  4. Use alternative cloud provider")
            ColorPrint.yellow("")
            ColorPrint.yellow("Session will be terminated automatically.")
            print("="*70)
            sys.stdout.flush()

        elif "Connection was closed" in error_msg:
            # Network connection lost
            ColorPrint.yellow("\n[WARNING] Connection to Azure servers lost")
            ColorPrint.yellow("Check your internet connection and Azure service status")
            THREAD_BUS.signal(self._stop_signal, True)

            # Report Azure STT as unavailable due to connection
            if provider_status:
                provider_status.mark_unavailable('stt', 'azure', 'Connection lost')

        elif "authentication" in error_msg.lower() or "unauthorized" in error_msg.lower():
            # Authentication error
            ColorPrint.red("\n[CRITICAL] Azure authentication failed")
            ColorPrint.yellow("Check your API key and subscription status")
            THREAD_BUS.signal(self._stop_signal, True)

            # Report Azure STT as unavailable due to auth
            if provider_status:
                provider_status.mark_unavailable('stt', 'azure', 'Authentication failed')

    def get_session_summary(self) -> dict:
        """Get session summary statistics"""
        total_texts = len(self.recognized_texts)
        total_chars = sum(len(item['text']) for item in self.recognized_texts)
        total_words = sum(len(item['text'].split()) for item in self.recognized_texts)

        avg_confidence = 0.0
        if total_texts > 0:
            avg_confidence = sum(item['confidence'] for item in self.recognized_texts) / total_texts

        return {
            'total_utterances': total_texts,
            'total_characters': total_chars,
            'total_words': total_words,
            'average_confidence': avg_confidence,
            'recognized_texts': self.recognized_texts
        }

    @property
    def should_stop(self) -> bool:
        """Return the callback-to-controller stop request from THREAD_BUS."""
        return bool(THREAD_BUS.get_signal(self._stop_signal, False))

    @property
    def quota_exceeded(self) -> bool:
        """Return the callback-to-controller quota state from THREAD_BUS."""
        return bool(THREAD_BUS.get_signal(self._quota_signal, False))

    def save_session(self, output_file: Path):
        """Save complete session to file"""
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write("Speech Transcription Session\n")
            f.write("=" * 70 + "\n")
            f.write(f"Start Time: {time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(self.session_start_time))}\n")
            f.write(f"Total Utterances: {len(self.recognized_texts)}\n")
            f.write("\n")

            for i, item in enumerate(self.recognized_texts, 1):
                timestamp = time.strftime("%H:%M:%S", time.localtime(item['timestamp']))
                f.write(f"[{i}] [{timestamp}] [{item['confidence']:.2%}]\n")
                f.write(f"{item['text']}\n")
                f.write("\n")

        ColorPrint.green(f"[SESSION] Saved to {output_file}")
