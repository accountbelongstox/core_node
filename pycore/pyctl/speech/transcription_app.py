#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Speech Transcription Application Logic

Interactive real-time speech transcription interface.
This module contains all the application logic called by speech_manager.
"""

import sys
import time
import threading
import platform
import tempfile
from pathlib import Path
from typing import Optional, Any, Dict, List

from pycore.pyfoundations.color_print import ColorPrint
from pycore.pyfoundations.third_party import get_third_package_speechsdk, get_third_package_numpy, get_third_package_pyaudio, get_third_package_pyaudiowpatch

speechsdk = get_third_package_speechsdk()
np = get_third_package_numpy()
pyaudio_standard = get_third_package_pyaudio()
pyaudiowpatch = get_third_package_pyaudiowpatch()
from pycore.pyutils.audio_utils import SilenceDetector
from pycore.pyutils.clipboard import clipboard_manager
from pycore.pyutils.hotkey import HotkeyListener
from pycore.pyutils.config_cache import speech_config_cache
from pycore.pyutils.tts_cache import tts_cache_manager

# Platform detection
CURRENT_PLATFORM = platform.system()  # 'Windows', 'Linux', 'Darwin' (macOS)

# Import PyAudio with platform-specific handling
# Windows: pyaudiowpatch for loopback support (fallback to pyaudio)
# Linux/Mac: standard pyaudio
pyaudio = None
AUDIO_BACKEND = None
HAS_LOOPBACK_SUPPORT = False

if CURRENT_PLATFORM == 'Windows':
    # Windows: Try pyaudiowpatch first (has loopback support)
    if pyaudiowpatch:
        pyaudio = pyaudiowpatch
        AUDIO_BACKEND = "pyaudiowpatch"
        HAS_LOOPBACK_SUPPORT = True
        ColorPrint.green(f"[Audio] Using {AUDIO_BACKEND} (Windows loopback supported)")
    elif pyaudio_standard:
        pyaudio = pyaudio_standard
        AUDIO_BACKEND = "pyaudio"
        HAS_LOOPBACK_SUPPORT = False
        ColorPrint.yellow(f"[Audio] Using {AUDIO_BACKEND} (loopback may not work)")
    else:
        ColorPrint.red(f"[Audio] PyAudio not available on Windows")
        ColorPrint.yellow("[Audio] Install with: pip install pyaudiowpatch")

elif CURRENT_PLATFORM == 'Linux':
    # Linux: Standard pyaudio (loopback via PulseAudio monitor)
    if pyaudio_standard:
        pyaudio = pyaudio_standard
        AUDIO_BACKEND = "pyaudio"
        HAS_LOOPBACK_SUPPORT = True
        ColorPrint.green(f"[Audio] Using {AUDIO_BACKEND} on Linux")
        ColorPrint.blue("[Audio] Loopback via PulseAudio monitor sources")
    else:
        ColorPrint.red("[Audio] PyAudio not available on Linux")
        ColorPrint.yellow("[Audio] Install with: sudo apt-get install portaudio19-dev python3-pyaudio && pip install pyaudio")

elif CURRENT_PLATFORM == 'Darwin':
    # macOS: Standard pyaudio (loopback requires virtual device)
    if pyaudio_standard:
        pyaudio = pyaudio_standard
        AUDIO_BACKEND = "pyaudio"
        HAS_LOOPBACK_SUPPORT = False
        ColorPrint.green(f"[Audio] Using {AUDIO_BACKEND} on macOS")
        ColorPrint.yellow("[Audio] Loopback requires BlackHole or Soundflower")
    else:
        ColorPrint.red("[Audio] PyAudio not available on macOS")
        ColorPrint.yellow("[Audio] Install with: brew install portaudio && pip install pyaudio")

else:
    # Unknown/unsupported platform
    ColorPrint.red(f"[Audio] Unsupported platform: {CURRENT_PLATFORM}")
    ColorPrint.yellow("[Audio] Supported platforms: Windows, Linux, macOS")


class AudioDeviceManager:
    """
    Manages audio device enumeration and selection

    Handles platform-specific audio device access and provides
    robust device listing with error handling.
    """

    def __init__(self):
        """Initialize audio device manager with platform detection"""
        if not pyaudio:
            ColorPrint.red("[AudioDevices] PyAudio not available")
            self.audio = None
            self.platform = CURRENT_PLATFORM
            return

        self.audio = pyaudio.PyAudio()
        self.platform = CURRENT_PLATFORM
        self.has_loopback = HAS_LOOPBACK_SUPPORT

        ColorPrint.blue(f"[AudioDevices] Platform: {self.platform}")
        if self.has_loopback:
            ColorPrint.blue("[AudioDevices] Loopback support: Yes")
        else:
            ColorPrint.yellow("[AudioDevices] Loopback support: No")

    def list_devices(self):
        """
        List all available audio devices with platform-specific handling

        Returns:
            list: List of (device_type, device_index, device_info) tuples
        """
        if not self.audio:
            ColorPrint.red("[AudioDevices] PyAudio not initialized")
            return []

        ColorPrint.blue("\n" + "="*70)
        ColorPrint.blue(f"Available Audio Devices ({self.platform})")
        ColorPrint.blue("="*70)

        devices = []

        # Platform-specific device listing
        if self.platform == 'Windows':
            devices = self._list_windows_devices()
        elif self.platform == 'Linux':
            devices = self._list_linux_devices()
        elif self.platform == 'Darwin':
            devices = self._list_macos_devices()
        else:
            ColorPrint.yellow("[AudioDevices] Generic device listing")
            devices = self._list_generic_devices()

        if not devices:
            ColorPrint.yellow("\n[WARNING] No audio devices found")
            ColorPrint.yellow("[HELP] Troubleshooting:")
            ColorPrint.yellow("  1. Check audio drivers are installed")
            ColorPrint.yellow("  2. Check devices are enabled in system settings")
            ColorPrint.yellow("  3. Try restarting the application")

        print("="*70)
        return devices

    def _list_windows_devices(self):
        """List Windows audio devices (with WASAPI loopback)"""
        devices = []

        # Try to get WASAPI info
        has_wasapi = False
        wasapi_info = None

        if hasattr(pyaudio, 'paWASAPI'):
            wasapi_info = self.audio.get_host_api_info_by_type(pyaudio.paWASAPI)
            has_wasapi = True

        # List loopback devices (Windows WASAPI)
        if has_wasapi and self.has_loopback:
            ColorPrint.yellow("\n[System Audio] - Loopback Devices:")
            ColorPrint.yellow("-" * 70)

            loopback_count = 0
            for i in range(self.audio.get_device_count()):
                device_info = self.audio.get_device_info_by_index(i)

                if device_info.get('hostApi') == wasapi_info['index']:
                    is_loopback = device_info.get('isLoopbackDevice', False)

                    if is_loopback or device_info.get('maxOutputChannels', 0) > 0:
                        if is_loopback or 'loopback' in device_info['name'].lower():
                            devices.append(('loopback', i, device_info))
                            print(f"  [{len(devices)-1}] {device_info['name']}")
                            print(f"      Sample Rate: {int(device_info['defaultSampleRate'])} Hz")
                            loopback_count += 1

            if loopback_count == 0:
                ColorPrint.yellow("  No loopback devices found")
                ColorPrint.blue("  Note: System audio capture requires WASAPI loopback")

        # List microphone devices
        ColorPrint.yellow("\n[Microphones]:")
        ColorPrint.yellow("-" * 70)

        mic_count = 0
        for i in range(self.audio.get_device_count()):
            device_info = self.audio.get_device_info_by_index(i)

            if device_info.get('maxInputChannels', 0) > 0:
                # Skip if already added as loopback
                if not any(d[1] == i for d in devices):
                    devices.append(('microphone', i, device_info))
                    print(f"  [{len(devices)-1}] {device_info['name']}")
                    print(f"      Sample Rate: {int(device_info['defaultSampleRate'])} Hz")
                    mic_count += 1

        if mic_count == 0:
            ColorPrint.yellow("  No microphones found")

        return devices

    def _list_linux_devices(self):
        """List Linux audio devices (with PulseAudio monitor)"""
        devices = []

        # On Linux, loopback is via PulseAudio monitor sources
        ColorPrint.yellow("\n[System Audio] - Monitor Sources:")
        ColorPrint.yellow("-" * 70)
        ColorPrint.blue("  Linux loopback via PulseAudio monitor sources")

        monitor_count = 0
        for i in range(self.audio.get_device_count()):
            device_info = self.audio.get_device_info_by_index(i)

            # Monitor sources typically have "monitor" in the name
            if 'monitor' in device_info['name'].lower():
                devices.append(('loopback', i, device_info))
                print(f"  [{len(devices)-1}] {device_info['name']}")
                print(f"      Sample Rate: {int(device_info['defaultSampleRate'])} Hz")
                monitor_count += 1

        if monitor_count == 0:
            ColorPrint.yellow("  No monitor sources found")
            ColorPrint.blue("  Tip: Check PulseAudio configuration")

        # List microphones
        ColorPrint.yellow("\n[Microphones]:")
        ColorPrint.yellow("-" * 70)

        mic_count = 0
        for i in range(self.audio.get_device_count()):
            device_info = self.audio.get_device_info_by_index(i)

            if device_info.get('maxInputChannels', 0) > 0:
                if not any(d[1] == i for d in devices):
                    devices.append(('microphone', i, device_info))
                    print(f"  [{len(devices)-1}] {device_info['name']}")
                    print(f"      Sample Rate: {int(device_info['defaultSampleRate'])} Hz")
                    mic_count += 1

        if mic_count == 0:
            ColorPrint.yellow("  No microphones found")

        return devices

    def _list_macos_devices(self):
        """List macOS audio devices (loopback requires virtual device)"""
        devices = []

        # macOS loopback requires BlackHole or Soundflower
        if self.has_loopback:
            ColorPrint.yellow("\n[System Audio] - Virtual Audio Devices:")
            ColorPrint.yellow("-" * 70)

            virtual_count = 0
            for i in range(self.audio.get_device_count()):
                device_info = self.audio.get_device_info_by_index(i)

                # Look for BlackHole, Soundflower, etc.
                name_lower = device_info['name'].lower()
                if 'blackhole' in name_lower or 'soundflower' in name_lower:
                    devices.append(('loopback', i, device_info))
                    print(f"  [{len(devices)-1}] {device_info['name']}")
                    print(f"      Sample Rate: {int(device_info['defaultSampleRate'])} Hz")
                    virtual_count += 1

            if virtual_count == 0:
                ColorPrint.yellow("  No virtual audio devices found")
                ColorPrint.blue("  Install BlackHole: brew install blackhole-2ch")

        # List microphones
        ColorPrint.yellow("\n[Microphones]:")
        ColorPrint.yellow("-" * 70)

        mic_count = 0
        for i in range(self.audio.get_device_count()):
            device_info = self.audio.get_device_info_by_index(i)

            if device_info.get('maxInputChannels', 0) > 0:
                if not any(d[1] == i for d in devices):
                    devices.append(('microphone', i, device_info))
                    print(f"  [{len(devices)-1}] {device_info['name']}")
                    print(f"      Sample Rate: {int(device_info['defaultSampleRate'])} Hz")
                    mic_count += 1

        if mic_count == 0:
            ColorPrint.yellow("  No microphones found")

        return devices

    def _list_generic_devices(self):
        """Generic device listing for unknown platforms"""
        devices = []

        ColorPrint.yellow("\n[All Devices]:")
        ColorPrint.yellow("-" * 70)

        for i in range(self.audio.get_device_count()):
            device_info = self.audio.get_device_info_by_index(i)

            if device_info.get('maxInputChannels', 0) > 0:
                devices.append(('microphone', i, device_info))
                print(f"  [{len(devices)-1}] {device_info['name']}")
                print(f"      Inputs: {device_info['maxInputChannels']}")
                print(f"      Sample Rate: {int(device_info['defaultSampleRate'])} Hz")

        return devices

    def select_device(self, devices):
        """Interactive device selection"""
        if not devices:
            ColorPrint.red("\nNo audio devices available!")
            return None

        while True:
            choice = input(f"\nSelect device (0-{len(devices)-1}) [default: 0]: ").strip()
            if choice == "":
                choice = "0"

            if choice.isdigit():
                device_index = int(choice)
                if 0 <= device_index < len(devices):
                    return devices[device_index]

            ColorPrint.yellow("Invalid choice, please try again")

    def cleanup(self):
        """Cleanup audio resources"""
        if self.audio:
            self.audio.terminate()


class AudioCaptureThread(threading.Thread):
    """
    Thread for capturing audio and pushing to Azure Speech SDK

    Following project threading standards:
    - Inherits from threading.Thread
    - Name ends with "Thread"
    - No shared mutable state, no callbacks
    """

    def __init__(self, device_type: str, device_index: int, device_info: dict, push_stream: Any):
        """Initialize audio capture thread"""
        super().__init__(name="AudioCaptureThread", daemon=True)
        self.device_type = device_type
        self.device_index = device_index
        self.device_info = device_info
        self.push_stream = push_stream
        self.is_running = False

    def run(self):
        """Thread main function"""
        ColorPrint.blue(f"\n[Thread] Audio capture started")
        ColorPrint.blue(f"[Thread] Device: {self.device_info['name']}")

        # Audio parameters
        FORMAT = pyaudio.paInt16
        TARGET_RATE = 16000  # Azure requires 16kHz
        device_rate = int(self.device_info.get('defaultSampleRate', 48000))

        if self.device_type == 'loopback':
            device_channels = self.device_info.get('maxOutputChannels', 2)
        else:
            device_channels = self.device_info.get('maxInputChannels', 2)

        if device_channels < 1:
            device_channels = 2

        CHUNK = 1024

        ColorPrint.blue(f"[Thread] Device: {device_rate}Hz → Target: {TARGET_RATE}Hz")

        audio = pyaudio.PyAudio()
        stream = None

        self.is_running = True

        stream = audio.open(
            format=FORMAT,
            channels=device_channels,
            rate=device_rate,
            input=True,
            input_device_index=self.device_index,
            frames_per_buffer=CHUNK
        )

        ColorPrint.green("[Thread] Audio stream opened")

        resample_ratio = TARGET_RATE / device_rate

        while self.is_running:
            data = stream.read(CHUNK, exception_on_overflow=False)

            # Convert to numpy
            audio_data = np.frombuffer(data, dtype=np.int16)

            # Convert to mono
            if device_channels > 1:
                audio_data = audio_data.reshape(-1, device_channels)
                audio_data = np.mean(audio_data, axis=1).astype(np.int16)

            # Resample
            if device_rate != TARGET_RATE:
                num_samples = int(len(audio_data) * resample_ratio)
                indices = np.linspace(0, len(audio_data) - 1, num_samples)
                audio_data = np.interp(indices, np.arange(len(audio_data)), audio_data).astype(np.int16)

            # Push to stream
            self.push_stream.write(audio_data.tobytes())

        if stream:
            stream.stop_stream()
            stream.close()
        audio.terminate()

        ColorPrint.yellow("[Thread] Audio capture stopped")

    def stop(self):
        """Stop audio capture"""
        self.is_running = False


class RecognitionChannel:
    """
    Single recognition channel for one audio source

    Manages recognition results from one audio source (microphone or system audio).
    """

    def __init__(self, channel_name: str, language: str):
        """
        Initialize recognition channel

        Args:
            channel_name: Name of this channel (e.g., 'Microphone', 'System Audio')
            language: Language code for this channel (e.g., 'zh-CN', 'en-US')
        """
        self.channel_name = channel_name
        self.language = language
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

        ColorPrint.green(f"[{self.channel_name}] [RECOGNIZED] {text}")
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

        # Print cycle complete
        print("-" * 70)
        ColorPrint.blue(f"[{self.channel_name}] [CYCLE COMPLETE] Text: {text}")
        ColorPrint.blue(f"[{self.channel_name}] [CYCLE COMPLETE] Length: {len(text)} chars, Words: {len(text.split())}")
        print("-" * 70)

        # Print cache info
        print_recognition_cache_info(text, self.language)

    def get_last_text(self) -> Optional[str]:
        """Get the last recognized text"""
        return self.last_recognized_text if self.last_recognized_text else None


class TranscriptionSession:
    """
    Transcription session manager

    Handles transcription lifecycle and processing of recognized text.
    """

    def __init__(self, language: str = "zh-CN"):
        """
        Initialize transcription session

        Args:
            language: Language code (e.g., 'zh-CN', 'en-US')
        """
        self.language = language
        self.recognized_texts = []
        self.session_start_time = None
        self.current_recognizing_text = ""

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
        ColorPrint.green(f"[RECOGNIZED] {text}")
        ColorPrint.yellow(f"[CONFIDENCE] {confidence:.2%}")
        sys.stdout.flush()

        # Store recognized text
        self.recognized_texts.append({
            'text': text,
            'confidence': confidence,
            'timestamp': time.time()
        })

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

        # Print cache info
        print_recognition_cache_info(text, self.language)

        # Example: Save to file
        # self._save_to_file(text)

        # Example: Send to TTS
        # self._speak_text(text)

        # Example: Check for commands
        # self._check_commands(text)

    def _save_to_file(self, text: str):
        """Save recognized text to file"""
        from pathlib import Path
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
        """Handle recognition error"""
        ColorPrint.red(f"[ERROR] {error_msg}")
        sys.stdout.flush()

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


# ============================================================
# Helper Functions for Cached Selection
# ============================================================

def select_language_with_cache(source: str = "default", allow_multi_select: bool = False) -> List[str]:
    """
    Select language(s) with cache support

    Args:
        source: Language source ('default', 'microphone', 'system')
        allow_multi_select: Allow selecting multiple languages

    Returns:
        List of selected language codes
    """
    # Check cache first
    cached_languages = speech_config_cache.get_languages(source)
    if cached_languages:
        ColorPrint.green(f"\n[Cached {source} languages: {cached_languages}]")
        use_cached = input("Use cached languages? (y/n) [default: y]: ").strip().lower()
        if use_cached != 'n':
            return cached_languages

    # Language selection
    print("\n" + "="*70)
    print(f"Language Selection ({source})")
    print("="*70)
    print("1 - Chinese (Simplified)")
    print("2 - English (US)")
    print("3 - Japanese")
    print("4 - Korean")

    if allow_multi_select:
        print("\nYou can select multiple languages (e.g., '1,2' or '1 2')")

    language_map = {
        "1": "zh-CN",
        "2": "en-US",
        "3": "ja-JP",
        "4": "ko-KR"
    }

    while True:
        if allow_multi_select:
            choice = input("\nSelect language(s) [default: 1]: ").strip()
        else:
            choice = input("\nSelect language [default: 1]: ").strip()

        if choice == "":
            choice = "1"

        # Parse multi-select
        if allow_multi_select:
            # Split by comma or space
            choices = choice.replace(',', ' ').split()
            selected_languages = []

            valid = True
            for c in choices:
                if c in language_map:
                    lang = language_map[c]
                    if lang not in selected_languages:
                        selected_languages.append(lang)
                else:
                    ColorPrint.yellow(f"Invalid choice: {c}")
                    valid = False
                    break

            if valid and selected_languages:
                # Cache selection
                speech_config_cache.set_languages(selected_languages, source)
                return selected_languages
        else:
            # Single select
            if choice in language_map:
                language = language_map[choice]
                # Cache selection
                speech_config_cache.set_languages([language], source)
                return [language]

        ColorPrint.yellow("Invalid choice, please try again")


def select_device_with_cache(device_manager, device_type: str = "default"):
    """
    Select audio device with cache support

    Args:
        device_manager: AudioDeviceManager instance
        device_type: Device type ('default', 'microphone', 'system')

    Returns:
        Selected device tuple or None
    """
    devices = device_manager.list_devices()

    if not devices:
        ColorPrint.red("\nNo audio devices found")
        return None

    # Check cache
    cached_device_index = speech_config_cache.get_audio_device(device_type)
    if cached_device_index is not None:
        ColorPrint.green(f"\n[Cached {device_type} device: {cached_device_index}]")
        use_cached = input("Use cached device? (y/n) [default: y]: ").strip().lower()
        if use_cached != 'n':
            # Find device by index
            for dev in devices:
                if dev[1] == cached_device_index:
                    return dev

    # Select device
    selected = device_manager.select_device(devices)
    if selected:
        _, device_index, _ = selected
        # Cache selection
        speech_config_cache.set_audio_device(device_index, device_type)

    return selected


def select_duration_with_cache():
    """
    Select duration mode with cache support

    Returns:
        Duration in seconds (None for continuous)
    """
    # Check cache
    cached_mode = speech_config_cache.get_duration_mode()
    if cached_mode:
        ColorPrint.green(f"\n[Cached duration mode: {cached_mode}]")
        if cached_mode == "continuous":
            ColorPrint.green("[Cached: Continuous mode]")
        else:
            cached_seconds = speech_config_cache.get_duration_seconds()
            ColorPrint.green(f"[Cached: Limited mode - {cached_seconds}s]")

        use_cached = input("Use cached duration? (y/n) [default: y]: ").strip().lower()
        if use_cached != 'n':
            if cached_mode == "continuous":
                return None
            else:
                return speech_config_cache.get_duration_seconds()

    # Select duration
    print("\n" + "="*70)
    print("Duration Setting")
    print("="*70)
    print("1 - Continuous (press Ctrl+C to stop)")
    print("2 - Time limited")

    while True:
        mode = input("\nSelect mode [default: 1]: ").strip()
        if mode == "":
            mode = "1"

        if mode == "1":
            speech_config_cache.set_duration_mode("continuous")
            return None
        elif mode == "2":
            while True:
                duration_input = input("Enter duration in seconds [default: 30]: ").strip()
                if duration_input == "":
                    duration = 30
                    break

                if duration_input.isdigit() and int(duration_input) > 0:
                    duration = int(duration_input)
                    break

                ColorPrint.yellow("Please enter a valid positive number")

            speech_config_cache.set_duration_mode("limited")
            speech_config_cache.set_duration_seconds(duration)
            return duration
        else:
            ColorPrint.yellow("Invalid choice, please try again")


def print_recognition_cache_info(text: str, language: str):
    """
    Print cache information for recognized text

    Args:
        text: Recognized text
        language: Language code
    """
    import hashlib

    # Calculate MD5 for text
    md5_hash = hashlib.md5(text.encode('utf-8')).hexdigest()

    # Check TTS cache for this text
    tts_stats = tts_cache_manager.get_statistics()

    print("\n" + "-" * 70)
    ColorPrint.blue("[Cache Info]")
    print(f"Sentence: {text}")
    print(f"MD5: {md5_hash}")
    print(f"Language: {language}")

    # Check if TTS cache exists for this text
    has_edge_cache = tts_cache_manager.has_cache("edge", text, language)
    has_azure_cache = tts_cache_manager.has_cache("azure", text, language)

    if has_edge_cache:
        cache_path = tts_cache_manager.get_cache_path("edge", text, language)
        ColorPrint.green(f"Edge TTS Cache: EXISTS - {cache_path.name}")
    else:
        ColorPrint.yellow(f"Edge TTS Cache: NOT FOUND")

    if has_azure_cache:
        cache_path = tts_cache_manager.get_cache_path("azure", text, language)
        ColorPrint.green(f"Azure TTS Cache: EXISTS - {cache_path.name}")
    else:
        ColorPrint.yellow(f"Azure TTS Cache: NOT FOUND")

    # Print overall cache stats
    print(f"\nTotal TTS Cache Files: {tts_stats['total_cached_files']}")
    print(f"Total Cache Size: {tts_stats['total_cache_size_mb']:.2f} MB")
    print(f"Cache Hit Rate: {tts_stats['hit_rate']:.2f}%")
    print("-" * 70)


def run_app(speech_manager):
    """
    Run interactive transcription application

    Args:
        speech_manager: SpeechManager instance from pyctl
    """
    ColorPrint.blue("\n" + "="*70)
    ColorPrint.blue("Real-time Speech Transcription with Cycle Processing")
    ColorPrint.blue("Powered by Azure Speech Service")
    ColorPrint.blue("="*70)

    # Check availability
    if not speech_manager.is_stt_available():
        ColorPrint.red("\nSpeech recognition not available!")
        ColorPrint.yellow("Please ensure Azure Speech SDK is installed and configured")
        sys.exit(1)

    # Initialize
    if not speech_manager.initialize():
        ColorPrint.red("\nFailed to initialize speech manager")
        sys.exit(1)

    # Select language with cache
    selected_languages = select_language_with_cache(source="default", allow_multi_select=False)
    language = selected_languages[0]  # Use first language for single-source mode

    # Select device with cache
    device_manager = AudioDeviceManager()
    selected_device = select_device_with_cache(device_manager, device_type="default")

    if not selected_device:
        ColorPrint.red("\nNo device selected")
        device_manager.cleanup()
        sys.exit(1)

    device_type, device_index, device_info = selected_device

    # Select duration with cache
    duration = select_duration_with_cache()

    # Setup audio streaming
    ColorPrint.yellow("\n[INFO] Preparing to start recognition...")
    if device_type == 'loopback':
        ColorPrint.yellow("[INFO] Please start playing audio now")
    time.sleep(2)

    # Create push stream for Azure
    format = speechsdk.audio.AudioStreamFormat(
        samples_per_second=16000,
        bits_per_sample=16,
        channels=1
    )
    push_stream = speechsdk.audio.PushAudioInputStream(format)

    # Start audio capture thread
    capture_thread = AudioCaptureThread(device_type, device_index, device_info, push_stream)
    capture_thread.start()

    time.sleep(1)  # Let thread start

    # Create transcription session
    session = TranscriptionSession(language=language)
    session.session_start_time = time.time()

    # Start continuous recognition with session callbacks
    success = speech_manager.start_continuous_recognition(
        audio_source=push_stream,
        language=language,
        on_recognizing=session.on_recognizing,
        on_recognized=session.on_recognized,
        on_error=session.on_error
    )

    if not success:
        ColorPrint.red("\nFailed to start recognition")
        capture_thread.stop()
        push_stream.close()
        device_manager.cleanup()
        sys.exit(1)

    ColorPrint.green("\n[READY] Recognition started")
    if device_type == 'loopback':
        ColorPrint.yellow("[INFO] Play audio to see transcription")
    else:
        ColorPrint.yellow("[INFO] Start speaking into microphone")
    print()

    # Run for duration
    start_time = time.time()

    try:
        while True:
            time.sleep(0.5)

            if duration and (time.time() - start_time) >= duration:
                ColorPrint.yellow("\n[INFO] Duration limit reached")
                break
    except KeyboardInterrupt:
        ColorPrint.yellow("\n[INFO] Interrupted by user (Ctrl+C)")

    # Cleanup
    ColorPrint.blue("\n[INFO] Stopping recognition...")
    speech_manager.stop_recognition()
    capture_thread.stop()
    capture_thread.join(timeout=2)
    push_stream.close()
    device_manager.cleanup()

    # Show session summary
    ColorPrint.blue("\n" + "="*70)
    ColorPrint.green("[SESSION SUMMARY]")
    ColorPrint.blue("="*70)

    summary = session.get_session_summary()
    print(f"Total Utterances: {summary['total_utterances']}")
    print(f"Total Words: {summary['total_words']}")
    print(f"Total Characters: {summary['total_characters']}")
    print(f"Average Confidence: {summary['average_confidence']:.2%}")

    # Ask if user wants to save session
    if summary['total_utterances'] > 0:
        print()
        save_choice = input("Save session to file? (y/n) [default: n]: ").strip().lower()
        if save_choice == 'y':
            from pathlib import Path
            timestamp = time.strftime("%Y%m%d_%H%M%S")
            output_file = Path(f"transcription_{timestamp}.txt")
            session.save_session(output_file)
            ColorPrint.green(f"Session saved to: {output_file}")

    ColorPrint.blue("\n" + "="*70)
    ColorPrint.green("[DONE] Transcription session completed")
    ColorPrint.blue("="*70 + "\n")


def run_app_dual_source(speech_manager):
    """
    Run dual-source transcription app with hotkey control

    Features:
    - Dual audio sources: microphone + system audio
    - Independent language settings for each source
    - Ctrl+Click: Copy last system audio text to clipboard
    - Ctrl+DoubleClick: Replay last system audio text with TTS
    - Silence detection for intelligent sentence segmentation

    Args:
        speech_manager: SpeechManager instance from pyctl
    """
    ColorPrint.blue("\n" + "="*70)
    ColorPrint.blue("Dual-Source Speech Transcription with Hotkey Control")
    ColorPrint.blue("Powered by Azure Speech Service")
    ColorPrint.blue("="*70)

    # Check availability
    if not speech_manager.is_stt_available():
        ColorPrint.red("\nSpeech recognition not available!")
        ColorPrint.yellow("Please ensure Azure Speech SDK is installed and configured")
        sys.exit(1)

    # Initialize
    if not speech_manager.initialize():
        ColorPrint.red("\nFailed to initialize speech manager")
        sys.exit(1)

    # Configuration with cache
    # Microphone language (with cache)
    mic_languages = select_language_with_cache(source="microphone", allow_multi_select=False)
    mic_language = mic_languages[0]

    # System audio language (with cache, multi-select supported)
    system_languages = select_language_with_cache(source="system", allow_multi_select=True)
    system_language = system_languages[0]  # Primary language
    system_language_2 = system_languages[1] if len(system_languages) > 1 else None  # Secondary language (optional)

    # Select devices with cache
    device_manager = AudioDeviceManager()

    # Select microphone with cache
    print("\n" + "="*70)
    print("Select Microphone Device")
    print("="*70)
    mic_device = select_device_with_cache(device_manager, device_type="microphone")
    if not mic_device:
        ColorPrint.red("\nNo microphone selected")
        device_manager.cleanup()
        sys.exit(1)

    # Select system audio with cache
    print("\n" + "="*70)
    print("Select System Audio Device")
    print("="*70)
    system_device = select_device_with_cache(device_manager, device_type="system")
    if not system_device:
        ColorPrint.red("\nNo system audio device selected")
        device_manager.cleanup()
        sys.exit(1)

    mic_type, mic_index, mic_info = mic_device
    sys_type, sys_index, sys_info = system_device

    # Create recognition channels
    mic_channel = RecognitionChannel("Microphone", mic_language)
    sys_channel = RecognitionChannel("System Audio", system_language)
    sys_channel_2 = RecognitionChannel("System Audio (Secondary)", system_language_2) if enable_dual else None

    # Setup hotkey listener
    hotkey_listener = HotkeyListener()

    def on_ctrl_click():
        """Copy last system audio text to clipboard"""
        last_text = sys_channel.get_last_text()
        if last_text:
            clipboard_manager.copy_with_backup(last_text)
            ColorPrint.green(f"[Hotkey] Copied to clipboard: {last_text[:50]}...")
        else:
            ColorPrint.yellow("[Hotkey] No system audio text to copy")

    def on_ctrl_double_click():
        """Replay last system audio text with TTS"""
        last_text = sys_channel.get_last_text()
        if last_text:
            ColorPrint.green(f"[Hotkey] Replaying: {last_text[:50]}...")
            # TTS playback
            _replay_text_with_tts(last_text, system_language, speech_manager)
        else:
            ColorPrint.yellow("[Hotkey] No system audio text to replay")

    hotkey_listener.set_ctrl_click_callback(on_ctrl_click)
    hotkey_listener.set_ctrl_double_click_callback(on_ctrl_double_click)
    hotkey_listener.start()

    # Setup audio streams
    ColorPrint.yellow("\n[INFO] Preparing to start dual-source recognition...")
    time.sleep(2)

    # Create push streams for Azure
    format_config = speechsdk.audio.AudioStreamFormat(
        samples_per_second=16000,
        bits_per_sample=16,
        channels=1
    )
    mic_stream = speechsdk.audio.PushAudioInputStream(format_config)
    sys_stream = speechsdk.audio.PushAudioInputStream(format_config)
    sys_stream_2 = speechsdk.audio.PushAudioInputStream(format_config) if enable_dual else None

    # Start audio capture threads
    mic_capture = AudioCaptureThread(mic_type, mic_index, mic_info, mic_stream)
    sys_capture = AudioCaptureThread(sys_type, sys_index, sys_info, sys_stream)

    mic_capture.start()
    sys_capture.start()

    time.sleep(1)

    # Start recognition for microphone
    ColorPrint.blue("[Microphone] Starting recognition...")
    success_mic = speech_manager.start_continuous_recognition(
        audio_source=mic_stream,
        language=mic_language,
        on_recognizing=mic_channel.on_recognizing,
        on_recognized=mic_channel.on_recognized,
        on_error=lambda msg: ColorPrint.red(f"[Microphone] Error: {msg}")
    )

    if not success_mic:
        ColorPrint.red("[Microphone] Failed to start recognition")
        mic_capture.stop()
        sys_capture.stop()
        mic_stream.close()
        sys_stream.close()
        device_manager.cleanup()
        hotkey_listener.stop()
        sys.exit(1)

    # Start recognition for system audio (primary language)
    ColorPrint.blue("[System Audio] Starting recognition...")
    success_sys = speech_manager.start_continuous_recognition(
        audio_source=sys_stream,
        language=system_language,
        on_recognizing=sys_channel.on_recognizing,
        on_recognized=sys_channel.on_recognized,
        on_error=lambda msg: ColorPrint.red(f"[System Audio] Error: {msg}")
    )

    if not success_sys:
        ColorPrint.red("[System Audio] Failed to start recognition")
        speech_manager.stop_recognition()
        mic_capture.stop()
        sys_capture.stop()
        mic_stream.close()
        sys_stream.close()
        device_manager.cleanup()
        hotkey_listener.stop()
        sys.exit(1)

    # Start recognition for system audio (secondary language) if enabled
    if enable_dual and sys_stream_2:
        ColorPrint.blue("[System Audio - Secondary] Starting recognition...")
        # Note: Azure Speech SDK doesn't support multiple recognizers on same stream
        # This is a simplified version - in production, you'd need to split the audio
        ColorPrint.yellow("[System Audio - Secondary] Dual language not fully implemented")
        ColorPrint.yellow("[System Audio - Secondary] Consider using separate audio capture")

    ColorPrint.green("\n[READY] Dual-source recognition started")
    ColorPrint.yellow("[Microphone] Start speaking")
    ColorPrint.yellow("[System Audio] Play audio to see transcription")
    ColorPrint.blue("[Hotkey] Ctrl+Click - Copy last system audio text")
    ColorPrint.blue("[Hotkey] Ctrl+DoubleClick - Replay last system audio text")
    print()

    # Run until interrupted
    start_time = time.time()

    try:
        while True:
            time.sleep(0.5)
    except KeyboardInterrupt:
        ColorPrint.yellow("\n[INFO] Interrupted by user (Ctrl+C)")

    # Cleanup
    ColorPrint.blue("\n[INFO] Stopping recognition...")
    hotkey_listener.stop()
    speech_manager.stop_recognition()
    mic_capture.stop()
    sys_capture.stop()
    mic_capture.join(timeout=2)
    sys_capture.join(timeout=2)
    mic_stream.close()
    sys_stream.close()
    if sys_stream_2:
        sys_stream_2.close()
    device_manager.cleanup()

    # Show summary
    ColorPrint.blue("\n" + "="*70)
    ColorPrint.green("[SESSION SUMMARY]")
    ColorPrint.blue("="*70)

    ColorPrint.yellow(f"\n[Microphone - {mic_language}]")
    print(f"Total Utterances: {len(mic_channel.recognized_texts)}")
    if mic_channel.recognized_texts:
        total_words = sum(len(item['text'].split()) for item in mic_channel.recognized_texts)
        avg_conf = sum(item['confidence'] for item in mic_channel.recognized_texts) / len(mic_channel.recognized_texts)
        print(f"Total Words: {total_words}")
        print(f"Average Confidence: {avg_conf:.2%}")

    ColorPrint.yellow(f"\n[System Audio - {system_language}]")
    print(f"Total Utterances: {len(sys_channel.recognized_texts)}")
    if sys_channel.recognized_texts:
        total_words = sum(len(item['text'].split()) for item in sys_channel.recognized_texts)
        avg_conf = sum(item['confidence'] for item in sys_channel.recognized_texts) / len(sys_channel.recognized_texts)
        print(f"Total Words: {total_words}")
        print(f"Average Confidence: {avg_conf:.2%}")

    ColorPrint.blue("\n" + "="*70)
    ColorPrint.green("[DONE] Dual-source transcription completed")
    ColorPrint.blue("="*70 + "\n")


def _replay_text_with_tts(text: str, language: str, speech_manager):
    """
    Replay text using TTS

    Args:
        text: Text to speak
        language: Language code
        speech_manager: SpeechManager instance
    """
    try:
        # Determine voice based on language
        voice_map = {
            "zh-CN": "zh-CN-XiaoxiaoNeural",
            "en-US": "en-US-JennyNeural",
            "ja-JP": "ja-JP-NanamiNeural",
            "ko-KR": "ko-KR-SunHiNeural"
        }

        voice = voice_map.get(language, "en-US-JennyNeural")

        # Generate temporary audio file
        temp_dir = Path(tempfile.gettempdir())
        temp_file = temp_dir / f"tts_replay_{int(time.time())}.mp3"

        ColorPrint.blue(f"[TTS] Generating speech: {voice}")

        # Use speech_manager to synthesize (with caching)
        result = speech_manager.synthesize_to_file(
            text=text,
            output_file=str(temp_file),
            voice=voice,
            language=language,
            provider=None,  # Use default provider (edge-tts if available)
            use_cache=True  # Enable caching
        )

        if result:
            ColorPrint.green(f"[TTS] Playing audio: {temp_file}")
            # Play audio (platform-specific)
            if CURRENT_PLATFORM == 'Windows':
                import os
                os.startfile(str(temp_file))
            elif CURRENT_PLATFORM == 'Darwin':  # macOS
                import subprocess
                subprocess.run(['afplay', str(temp_file)])
            elif CURRENT_PLATFORM == 'Linux':
                import subprocess
                subprocess.run(['mpg123', str(temp_file)])
        else:
            ColorPrint.red("[TTS] Failed to generate speech")

    except Exception as e:
        ColorPrint.red(f"[TTS] Error: {e}")
