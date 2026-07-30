#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Speech Transcription Application Logic

Interactive real-time speech transcription interface.
This module is the entry facade; application logic called by speech_manager
lives here (run_app / run_app_dual_source). Implementation is split across the
sibling sub-modules audio_devices, audio_capture, recognition_session,
cached_selection, and cache_info.

The platform/PyAudio backend globals are owned by audio_devices.py and imported
here (never re-declared) so import-time init/side-effects stay single-sourced.
"""

import sys
import time
import tempfile
from pathlib import Path

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.pybasecommon.commander import exec_silent
from pycore.pyutils.clipboard.clipboard_manager import clipboard_manager
from pycore.pyutils.hotkey.hotkey_listener import HotkeyListener
from pycore.pyutils.common.speech_config import speech_config

# Backend globals + AudioDeviceManager: single-sourced in audio_devices.py.
# Importing audio_devices first preserves the original import-time init order
# (third-party getters, then platform-specific audio prints).
from pycore.pyctl.speech.audio_devices import (
    AudioDeviceManager,
    speechsdk,
    np,
    pyaudio,
    AUDIO_BACKEND,
    HAS_LOOPBACK_SUPPORT,
    pyaudio_standard,
    pyaudiowpatch,
    CURRENT_PLATFORM,
)
from pycore.pyctl.speech.audio_capture import AudioCaptureThread
from pycore.pyctl.speech.recognition_session import (
    RecognitionChannel,
    TranscriptionSession,
)
from pycore.pyctl.speech.cached_selection import (
    select_language_with_cache,
    select_device_with_cache,
    select_duration_with_cache,
)
from pycore.pyctl.speech.cache_info import print_recognition_cache_info

import os


# Facade re-exports: keep the public API importable from this module.
__all__ = [
    # Entry points (public API used by speech_manager / speech_thread)
    'run_app',
    'run_app_dual_source',
    # Internal helpers re-exported for backward compatibility
    '_replay_text_with_tts',
    # Backend globals (shared, single-sourced in audio_devices)
    'pyaudio',
    'AUDIO_BACKEND',
    'HAS_LOOPBACK_SUPPORT',
    'speechsdk',
    'np',
    'pyaudio_standard',
    'pyaudiowpatch',
    'CURRENT_PLATFORM',
    # Classes
    'AudioDeviceManager',
    'AudioCaptureThread',
    'RecognitionChannel',
    'TranscriptionSession',
    # Cached selection helpers
    'select_language_with_cache',
    'select_device_with_cache',
    'select_duration_with_cache',
    # Cache info
    'print_recognition_cache_info',
]


def run_app(speech_manager, interactive: bool = True, language: str = None, device_index: int = None, duration: int = None):
    """
    Run interactive transcription application

    Args:
        speech_manager: SpeechManager instance from pyctl
        interactive: If True, prompt user for selections. If False, use cached/provided values.
        language: Language code (used in non-interactive mode)
        device_index: Audio device index (used in non-interactive mode)
        duration: Duration in seconds, None for continuous (used in non-interactive mode)
    """
    ColorPrint.blue("\n" + "="*70)
    ColorPrint.blue("Real-time Speech Transcription with Cycle Processing")
    ColorPrint.blue("Powered by Azure Speech Service")
    ColorPrint.blue("="*70)

    # Check availability
    if not speech_manager.is_stt_available():
        ColorPrint.red("\nSpeech recognition not available!")
        ColorPrint.yellow("Please ensure Azure Speech SDK is installed and configured")
        if interactive:
            sys.exit(1)
        else:
            return False

    # Initialize
    if not speech_manager.initialize():
        ColorPrint.red("\nFailed to initialize speech manager")
        if interactive:
            sys.exit(1)
        else:
            return False

    # Select language with cache or use provided
    if interactive:
        selected_languages = select_language_with_cache(source="default", allow_multi_select=False)
        language = selected_languages[0]  # Use first language for single-source mode
    else:
        # Non-interactive: use provided language or try cached
        if not language:
            cached_languages = speech_config.get("ui_languages_default")
            if cached_languages:
                language = cached_languages[0]
            else:
                language = "zh-CN"  # Default
        ColorPrint.blue(f"[Non-Interactive] Using language: {language}")

    # Select device with cache or use provided
    device_manager = AudioDeviceManager()

    if interactive:
        selected_device = select_device_with_cache(device_manager, device_type="default")

        if not selected_device:
            ColorPrint.red("\nNo device selected")
            device_manager.cleanup()
            sys.exit(1)

        device_type, device_index, device_info = selected_device
    else:
        # Non-interactive: use provided device_index or try cached or auto-select
        devices = device_manager.list_devices()
        if not devices:
            ColorPrint.red("\nNo audio devices found")
            device_manager.cleanup()
            return False

        selected_device = None
        if device_index is not None:
            # Find device by index
            for dev in devices:
                if dev[1] == device_index:
                    selected_device = dev
                    break

        if not selected_device:
            # Try cached device
            cached_device_index = speech_config.get("ui_audio_device_default")
            if cached_device_index is not None:
                for dev in devices:
                    if dev[1] == cached_device_index:
                        selected_device = dev
                        break

        if not selected_device:
            # Auto-select first microphone
            selected_device = devices[0]
            ColorPrint.yellow(f"[Non-Interactive] Auto-selected device: {selected_device[2]['name']}")
        else:
            ColorPrint.blue(f"[Non-Interactive] Using device: {selected_device[2]['name']}")

        device_type, device_index, device_info = selected_device

    # Select duration with cache or use provided
    if interactive:
        duration = select_duration_with_cache()
    else:
        # Non-interactive: use provided duration or continuous
        if duration is None:
            cached_mode = speech_config.get("ui_duration_mode")
            if cached_mode == "limited":
                duration = speech_config.get("ui_duration_seconds")
            # else keep as None (continuous)
        ColorPrint.blue(f"[Non-Interactive] Duration: {'Continuous' if duration is None else f'{duration}s'}")

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
    session = TranscriptionSession(language=language, speech_manager=speech_manager)
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
    ColorPrint.plain()

    # Run for duration
    start_time = time.time()

    try:
        while True:
            time.sleep(0.5)

            # Check if recognition encountered critical error
            if session.should_stop:
                if session.quota_exceeded:
                    ColorPrint.red("\n[TERMINATED] Session stopped: Azure quota exceeded")
                else:
                    ColorPrint.red("\n[TERMINATED] Session stopped: Critical error occurred")
                break

            # Check duration limit
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
    ColorPrint.plain(f"Total Utterances: {summary['total_utterances']}")
    ColorPrint.plain(f"Total Words: {summary['total_words']}")
    ColorPrint.plain(f"Total Characters: {summary['total_characters']}")
    ColorPrint.plain(f"Average Confidence: {summary['average_confidence']:.2%}")

    # Ask if user wants to save session
    if summary['total_utterances'] > 0:
        ColorPrint.plain()
        save_choice = input("Save session to file? (y/n) [default: n]: ").strip().lower()
        if save_choice == 'y':
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
    enable_dual = system_language_2 is not None  # Enable dual language if secondary language is selected

    # Select devices with cache
    device_manager = AudioDeviceManager()

    # Select microphone with cache
    ColorPrint.plain("\n" + "="*70)
    ColorPrint.plain("Select Microphone Device")
    ColorPrint.plain("="*70)
    mic_device = select_device_with_cache(device_manager, device_type="microphone")
    if not mic_device:
        ColorPrint.red("\nNo microphone selected")
        device_manager.cleanup()
        sys.exit(1)

    # Select system audio with cache
    ColorPrint.plain("\n" + "="*70)
    ColorPrint.plain("Select System Audio Device")
    ColorPrint.plain("="*70)
    system_device = select_device_with_cache(device_manager, device_type="system")
    if not system_device:
        ColorPrint.red("\nNo system audio device selected")
        device_manager.cleanup()
        sys.exit(1)

    mic_type, mic_index, mic_info = mic_device
    sys_type, sys_index, sys_info = system_device

    # Create recognition channels
    mic_channel = RecognitionChannel("Microphone", mic_language, speech_manager=speech_manager)
    sys_channel = RecognitionChannel("System Audio", system_language, speech_manager=speech_manager)
    sys_channel_2 = RecognitionChannel("System Audio (Secondary)", system_language_2, speech_manager=speech_manager) if enable_dual else None

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
    ColorPrint.plain()

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
    ColorPrint.plain(f"Total Utterances: {len(mic_channel.recognized_texts)}")
    if mic_channel.recognized_texts:
        total_words = sum(len(item['text'].split()) for item in mic_channel.recognized_texts)
        avg_conf = sum(item['confidence'] for item in mic_channel.recognized_texts) / len(mic_channel.recognized_texts)
        ColorPrint.plain(f"Total Words: {total_words}")
        ColorPrint.plain(f"Average Confidence: {avg_conf:.2%}")

    ColorPrint.yellow(f"\n[System Audio - {system_language}]")
    ColorPrint.plain(f"Total Utterances: {len(sys_channel.recognized_texts)}")
    if sys_channel.recognized_texts:
        total_words = sum(len(item['text'].split()) for item in sys_channel.recognized_texts)
        avg_conf = sum(item['confidence'] for item in sys_channel.recognized_texts) / len(sys_channel.recognized_texts)
        ColorPrint.plain(f"Total Words: {total_words}")
        ColorPrint.plain(f"Average Confidence: {avg_conf:.2%}")

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
                os.startfile(str(temp_file))
            elif CURRENT_PLATFORM == 'Darwin':  # macOS
                exec_silent(['afplay', str(temp_file)])
            elif CURRENT_PLATFORM == 'Linux':
                exec_silent(['mpg123', str(temp_file)])
        else:
            ColorPrint.red("[TTS] Failed to generate speech")

    except Exception as e:
        ColorPrint.red(f"[TTS] Error: {e}")
