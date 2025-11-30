#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Real-time Speech-to-Text using Azure Speech Service
Captures audio from microphone or system audio and transcribes to text in real-time
"""

import sys
import os
import time
import threading
from pathlib import Path

# Force unbuffered output for real-time display
# This ensures print statements appear immediately
sys.stdout.reconfigure(line_buffering=True) if hasattr(sys.stdout, 'reconfigure') else None
os.environ['PYTHONUNBUFFERED'] = '1'

# Add project root to Python path
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

# Import from pycore following project standards
from pycore.pyfoundations.secret_manager import get_secret_key
from pycore.pyfoundations.third_party import get_third_package_speechsdk, get_third_package_numpy

speechsdk = get_third_package_speechsdk()
np = get_third_package_numpy()
from pycore.pyfoundations.color_print import ColorPrint

# Import pyaudiowpatch for Windows system audio capture
try:
    import pyaudiowpatch as pyaudio
    AUDIO_BACKEND = "pyaudiowpatch"
    ColorPrint.green(f"[INFO] Using {AUDIO_BACKEND} for audio capture")
except ImportError:
    try:
        import pyaudio
        AUDIO_BACKEND = "pyaudio"
        ColorPrint.yellow(f"[WARNING] Using {AUDIO_BACKEND} - loopback may not be available")
    except ImportError:
        ColorPrint.red("[ERROR] PyAudio or PyAudioWPatch is required")
        ColorPrint.yellow("[INFO] Install with: pip install pyaudiowpatch")
        sys.exit(1)


class RealtimeSpeechToText:
    """Real-time speech-to-text transcription using Azure Speech Service"""

    def __init__(self):
        """Initialize with Azure Speech credentials from secret manager"""
        self.speech_key = None
        self.speech_region = None
        self.speech_config = None
        self.recognizer = None
        self.is_running = False
        self.push_stream = None
        self.audio_thread = None
        self.audio = pyaudio.PyAudio()

    def load_credentials(self):
        """Load Azure Speech credentials from secret files"""
        ColorPrint.blue("[INFO] Loading Azure Speech credentials...")

        # Try KEY A first, fallback to KEY B
        self.speech_key = get_secret_key("AZURE_SPEECH_KEYA_1")
        if not self.speech_key:
            ColorPrint.yellow("[WARNING] AZURE_SPEECH_KEYA_1 not found, trying KEYB...")
            self.speech_key = get_secret_key("AZURE_SPEECH_KEYB_1")

        if not self.speech_key:
            ColorPrint.red("[ERROR] No valid Azure Speech Key found")
            ColorPrint.yellow("[INFO] Please ensure AZURE_SPEECH_KEYA_1 or AZURE_SPEECH_KEYB_1 exists")
            return False

        # Load region
        self.speech_region = get_secret_key("AZURE_SPEECH_REGION_1")
        if not self.speech_region:
            ColorPrint.red("[ERROR] AZURE_SPEECH_REGION_1 not found")
            return False

        ColorPrint.green(f"[SUCCESS] Loaded credentials - Region: {self.speech_region}")
        return True

    def initialize_speech_config(self, language="zh-CN"):
        """
        Initialize Azure Speech configuration

        Args:
            language: Recognition language (default: zh-CN for Chinese)
                     Common values: en-US, zh-CN, ja-JP, ko-KR, etc.
        """
        if not self.speech_key or not self.speech_region:
            ColorPrint.red("[ERROR] Credentials not loaded. Call load_credentials() first")
            return False

        ColorPrint.blue("[INFO] Initializing Azure Speech SDK...")

        # Check if speechsdk is available
        if speechsdk is None:
            ColorPrint.red("[ERROR] Azure Speech SDK not available")
            ColorPrint.yellow("[INFO] Install with: pip install azure-cognitiveservices-speech")
            return False

        # Create speech config
        self.speech_config = speechsdk.SpeechConfig(
            subscription=self.speech_key,
            region=self.speech_region
        )

        # Set recognition language
        self.speech_config.speech_recognition_language = language

        # Enable detailed result for better accuracy info
        self.speech_config.output_format = speechsdk.OutputFormat.Detailed

        ColorPrint.green(f"[SUCCESS] Speech SDK initialized - Language: {language}")
        return True

    def list_audio_devices(self):
        """List all available audio capture devices"""
        ColorPrint.blue("\n" + "="*70)
        ColorPrint.blue("Available Audio Devices / Keyong yinpin shebei")
        ColorPrint.blue("="*70)

        devices = []

        # Try to get WASAPI info for loopback
        try:
            wasapi_info = self.audio.get_host_api_info_by_type(pyaudio.paWASAPI)
            has_wasapi = True
        except:
            has_wasapi = False
            ColorPrint.yellow("[WARNING] WASAPI not available - loopback may not work")

        # List loopback devices (Windows WASAPI)
        if has_wasapi:
            ColorPrint.yellow("\n[System Audio / Xitong yinpin] - Loopback Devices:")
            ColorPrint.yellow("-" * 70)

            loopback_found = False
            for i in range(self.audio.get_device_count()):
                try:
                    device_info = self.audio.get_device_info_by_index(i)

                    # Check if device is WASAPI loopback
                    if device_info.get('hostApi') == wasapi_info['index']:
                        # Check for loopback flag
                        is_loopback = device_info.get('isLoopbackDevice', False)

                        # Also check output channels for potential loopback
                        if is_loopback or device_info.get('maxOutputChannels', 0) > 0:
                            if is_loopback or 'loopback' in device_info['name'].lower():
                                devices.append(('loopback', i, device_info))
                                print(f"  [{len(devices)-1}] {device_info['name']}")
                                print(f"      Channels: {device_info.get('maxInputChannels', device_info.get('maxOutputChannels', 0))}")
                                print(f"      Sample Rate: {int(device_info['defaultSampleRate'])} Hz")
                                loopback_found = True
                except Exception as e:
                    pass

            if not loopback_found:
                ColorPrint.yellow("  No loopback devices found / Wei zhaodao huihuan shebei")
                ColorPrint.yellow("  Listing WASAPI output devices as potential loopback sources:")

                for i in range(self.audio.get_device_count()):
                    try:
                        device_info = self.audio.get_device_info_by_index(i)
                        if device_info.get('hostApi') == wasapi_info['index'] and device_info.get('maxOutputChannels', 0) > 0:
                            devices.append(('loopback', i, device_info))
                            print(f"  [{len(devices)-1}] {device_info['name']} (Output)")
                            print(f"      Channels: {device_info.get('maxOutputChannels', 0)}")
                            print(f"      Sample Rate: {int(device_info['defaultSampleRate'])} Hz")
                    except:
                        pass

        # List microphone devices
        ColorPrint.yellow("\n[Microphones / Maikefeng]:")
        ColorPrint.yellow("-" * 70)

        mic_found = False
        for i in range(self.audio.get_device_count()):
            try:
                device_info = self.audio.get_device_info_by_index(i)

                # Check if device has input channels
                if device_info.get('maxInputChannels', 0) > 0:
                    # Skip if already added as loopback
                    if not any(d[1] == i for d in devices):
                        devices.append(('microphone', i, device_info))
                        print(f"  [{len(devices)-1}] {device_info['name']}")
                        print(f"      Channels: {device_info['maxInputChannels']}")
                        print(f"      Sample Rate: {int(device_info['defaultSampleRate'])} Hz")
                        mic_found = True
            except Exception as e:
                pass

        if not mic_found:
            ColorPrint.yellow("  No microphone devices found / Wei zhaodao maikefeng")

        print("="*70)
        return devices

    def select_device(self, devices):
        """Select audio device for capture"""
        if not devices:
            ColorPrint.red("\n[ERROR] No audio devices available!")
            return None

        while True:
            choice = input(f"\nSelect device / Xuanze shebei (0-{len(devices)-1}) [default: 0]: ").strip()
            if choice == "":
                choice = "0"

            if choice.isdigit():
                device_index = int(choice)
                if 0 <= device_index < len(devices):
                    return devices[device_index]

            ColorPrint.yellow("[WARNING] Invalid choice, please try again")

    def _audio_capture_thread(self, device_type, device_index, device_info, push_stream):
        """Thread function to capture audio and push to stream"""
        ColorPrint.blue(f"\n[THREAD] Audio capture thread started")
        ColorPrint.blue(f"[THREAD] Device: {device_info['name']}")
        ColorPrint.blue(f"[THREAD] Type: {device_type}")

        # Audio parameters
        FORMAT = pyaudio.paInt16
        TARGET_RATE = 16000  # Azure Speech SDK requires 16kHz
        TARGET_CHANNELS = 1  # Mono for Azure

        # Get device native sample rate
        device_rate = int(device_info.get('defaultSampleRate', 48000))

        # Use device's native channel count (we'll convert to mono later)
        if device_type == 'loopback':
            device_channels = device_info.get('maxOutputChannels', 2)
        else:
            device_channels = device_info.get('maxInputChannels', 2)

        # Make sure we have at least 1 channel
        if device_channels < 1:
            device_channels = 2  # Default to stereo

        CHUNK = 1024

        ColorPrint.blue(f"[THREAD] Device native rate: {device_rate} Hz, channels: {device_channels}")
        ColorPrint.blue(f"[THREAD] Target rate: {TARGET_RATE} Hz, channels: {TARGET_CHANNELS}")

        stream = None

        try:
            # Open audio stream with device's native sample rate
            ColorPrint.blue(f"[THREAD] Opening audio stream...")

            stream = self.audio.open(
                format=FORMAT,
                channels=device_channels,
                rate=device_rate,
                input=True,
                input_device_index=device_index,
                frames_per_buffer=CHUNK
            )

            ColorPrint.green("[THREAD] Audio stream opened successfully")

            # Calculate resampling ratio
            resample_ratio = TARGET_RATE / device_rate
            ColorPrint.blue(f"[THREAD] Resampling ratio: {resample_ratio:.4f}")

            while self.is_running:
                # Read audio data
                data = stream.read(CHUNK, exception_on_overflow=False)

                # Convert bytes to numpy array
                audio_data = np.frombuffer(data, dtype=np.int16)

                # Convert to mono if stereo
                if device_channels > 1:
                    # Reshape to (samples, channels) and average across channels
                    audio_data = audio_data.reshape(-1, device_channels)
                    audio_data = np.mean(audio_data, axis=1).astype(np.int16)

                # Resample if necessary
                if device_rate != TARGET_RATE:
                    # Simple linear interpolation resampling
                    num_samples = int(len(audio_data) * resample_ratio)
                    indices = np.linspace(0, len(audio_data) - 1, num_samples)
                    audio_data = np.interp(indices, np.arange(len(audio_data)), audio_data).astype(np.int16)

                # Convert back to bytes
                resampled_data = audio_data.tobytes()

                # Push to Azure Speech SDK stream
                push_stream.write(resampled_data)

        except Exception as e:
            ColorPrint.red(f"[THREAD ERROR] Audio capture error: {e}")
            import traceback
            traceback.print_exc()
            self.is_running = False

        finally:
            if stream:
                stream.stop_stream()
                stream.close()
            ColorPrint.yellow("[THREAD] Audio capture thread stopped")

    def recognize_continuous_from_device(self, device_info, duration_seconds=None):
        """
        Continuous speech recognition from selected audio device

        Args:
            device_info: (device_type, device_index, device_dict) tuple from select_device()
            duration_seconds: Optional duration limit. If None, runs until Ctrl+C
        """
        if not self.speech_config:
            ColorPrint.red("[ERROR] Speech config not initialized")
            return

        device_type, device_index, device_dict = device_info

        ColorPrint.blue("\n" + "="*70)
        ColorPrint.blue("[INFO] Continuous Recognition Mode")
        ColorPrint.blue(f"[INFO] Device Type: {'System Audio' if device_type == 'loopback' else 'Microphone'}")
        ColorPrint.blue(f"[INFO] Device: {device_dict['name']}")
        if duration_seconds:
            ColorPrint.blue(f"[INFO] Duration: {duration_seconds} seconds")
        else:
            ColorPrint.blue("[INFO] Press Ctrl+C to stop")
        ColorPrint.blue("="*70)

        # Audio format for Azure Speech SDK
        # Must be 16 kHz, 16-bit, mono PCM
        samplerate = 16000

        # Create push stream
        format = speechsdk.audio.AudioStreamFormat(
            samples_per_second=samplerate,
            bits_per_sample=16,
            channels=1
        )
        self.push_stream = speechsdk.audio.PushAudioInputStream(format)

        # Create audio config from push stream
        audio_config = speechsdk.audio.AudioConfig(stream=self.push_stream)

        # Create speech recognizer
        speech_recognizer = speechsdk.SpeechRecognizer(
            speech_config=self.speech_config,
            audio_config=audio_config
        )

        # Setup event handlers
        self._setup_continuous_recognition_handlers(speech_recognizer)

        # Start audio capture thread
        self.is_running = True
        self.audio_thread = threading.Thread(
            target=self._audio_capture_thread,
            args=(device_type, device_index, device_dict, self.push_stream),
            daemon=True
        )
        self.audio_thread.start()

        # Give audio thread time to start
        time.sleep(1)

        # Start continuous recognition
        speech_recognizer.start_continuous_recognition_async()

        ColorPrint.green("\n[READY] Recognition started")
        if device_type == 'loopback':
            ColorPrint.yellow("[INFO] Play some audio on your system to see transcription")
        else:
            ColorPrint.yellow("[INFO] Start speaking into the microphone")
        print()

        # Run for specified duration or until interrupted
        start_time = time.time()

        try:
            while self.is_running:
                time.sleep(0.5)

                # Check duration limit
                if duration_seconds and (time.time() - start_time) >= duration_seconds:
                    ColorPrint.yellow("\n[INFO] Duration limit reached")
                    break

        except KeyboardInterrupt:
            ColorPrint.yellow("\n[INFO] Interrupted by user (Ctrl+C)")

        # Stop recognition and audio capture
        self.is_running = False
        speech_recognizer.stop_continuous_recognition_async()

        # Close push stream
        if self.push_stream:
            self.push_stream.close()

        # Wait for audio thread to finish
        if self.audio_thread:
            self.audio_thread.join(timeout=2)

        ColorPrint.blue("\n[INFO] Recognition stopped")

    def _setup_continuous_recognition_handlers(self, recognizer):
        """Setup event handlers for continuous recognition"""

        def recognizing_handler(evt):
            """Called when intermediate result is available"""
            if evt.result.text:
                ColorPrint.blue(f"[RECOGNIZING] {evt.result.text}")
                sys.stdout.flush()  # Force flush to display immediately

        def recognized_handler(evt):
            """Called when final result is available"""
            if evt.result.reason == speechsdk.ResultReason.RecognizedSpeech:
                if evt.result.text:
                    ColorPrint.green(f"[RECOGNIZED] {evt.result.text}")
                    sys.stdout.flush()  # Force flush

                    # Print confidence if available
                    try:
                        if hasattr(evt.result, 'best') and evt.result.best:
                            confidence = evt.result.best[0].confidence
                            ColorPrint.yellow(f"[CONFIDENCE] {confidence:.2%}")
                            sys.stdout.flush()  # Force flush
                    except:
                        pass

            elif evt.result.reason == speechsdk.ResultReason.NoMatch:
                ColorPrint.yellow("[WARNING] No speech could be recognized")
                sys.stdout.flush()  # Force flush

        def canceled_handler(evt):
            """Called when recognition is canceled"""
            ColorPrint.red(f"\n[CANCELED] Recognition canceled: {evt.result.cancellation_details.reason}")
            sys.stdout.flush()  # Force flush

            if evt.result.cancellation_details.reason == speechsdk.CancellationReason.Error:
                ColorPrint.red(f"[ERROR] {evt.result.cancellation_details.error_details}")
                ColorPrint.yellow("[INFO] Check your Speech Key and Region settings")
                sys.stdout.flush()  # Force flush

            self.is_running = False

        def session_started_handler(evt):
            """Called when recognition session starts"""
            ColorPrint.green("[SESSION] Recognition session started")
            sys.stdout.flush()  # Force flush

        def session_stopped_handler(evt):
            """Called when recognition session stops"""
            ColorPrint.yellow("[SESSION] Recognition session stopped")
            sys.stdout.flush()  # Force flush
            self.is_running = False

        # Connect event handlers
        recognizer.recognizing.connect(recognizing_handler)
        recognizer.recognized.connect(recognized_handler)
        recognizer.canceled.connect(canceled_handler)
        recognizer.session_started.connect(session_started_handler)
        recognizer.session_stopped.connect(session_stopped_handler)

    def cleanup(self):
        """Cleanup resources"""
        self.audio.terminate()


def main():
    """Main function"""
    ColorPrint.blue("\n" + "="*70)
    ColorPrint.blue("Real-time Speech-to-Text Transcription")
    ColorPrint.blue("System Audio & Microphone Support")
    ColorPrint.blue("Powered by Azure Speech Service")
    ColorPrint.blue("="*70)

    # Check if Azure Speech SDK is available
    if speechsdk is None:
        ColorPrint.red("\n[ERROR] Azure Speech SDK is not available")
        ColorPrint.yellow("[INFO] Install with: pip install azure-cognitiveservices-speech")
        ColorPrint.yellow("[INFO] Or it will be auto-installed via third_party.py")
        sys.exit(1)

    # Create instance
    stt = RealtimeSpeechToText()

    try:
        # Load credentials
        if not stt.load_credentials():
            ColorPrint.red("\n[ERROR] Failed to load credentials")
            sys.exit(1)

        # Select language
        print("\n" + "="*70)
        print("Language Selection / Yuyan xuanze")
        print("="*70)
        print("1 - Chinese (Simplified) / Zhongwen jianti")
        print("2 - English (US) / Yingwen")
        print("3 - Japanese / Riwen")
        print("4 - Korean / Hanwen")
        print("5 - Custom language code / Ziding yi yuyan daima")

        language_map = {
            "1": "zh-CN",
            "2": "en-US",
            "3": "ja-JP",
            "4": "ko-KR"
        }

        while True:
            choice = input("\nSelect language / Xuanze yuyan [default: 1]: ").strip()
            if choice == "":
                choice = "1"

            if choice in language_map:
                language = language_map[choice]
                break
            elif choice == "5":
                language = input("Enter language code (e.g., de-DE, fr-FR): ").strip()
                if language:
                    break
                ColorPrint.yellow("[WARNING] Invalid language code")
            else:
                ColorPrint.yellow("[WARNING] Invalid choice, please try again")

        # Initialize speech config
        if not stt.initialize_speech_config(language=language):
            ColorPrint.red("\n[ERROR] Failed to initialize Speech SDK")
            sys.exit(1)

        # List and select audio device
        devices = stt.list_audio_devices()
        if not devices:
            ColorPrint.red("\n[ERROR] No audio devices found")
            sys.exit(1)

        selected_device = stt.select_device(devices)
        if not selected_device:
            ColorPrint.red("\n[ERROR] No device selected")
            sys.exit(1)

        # Select duration
        print("\n" + "="*70)
        print("Duration Setting / Shichang shezhi")
        print("="*70)
        print("1 - Continuous (press Ctrl+C to stop) / Lianxu (an Ctrl+C tingzhi)")
        print("2 - Time limited / Xianshi")

        while True:
            mode = input("\nSelect mode / Xuanze moshi [default: 1]: ").strip()
            if mode == "":
                mode = "1"

            if mode == "1":
                duration = None
                break
            elif mode == "2":
                while True:
                    duration_input = input("Enter duration in seconds / Shuru shichang (miao) [default: 30]: ").strip()
                    if duration_input == "":
                        duration = 30
                        break

                    if duration_input.isdigit() and int(duration_input) > 0:
                        duration = int(duration_input)
                        break

                    ColorPrint.yellow("[WARNING] Please enter a valid positive number")
                break
            else:
                ColorPrint.yellow("[WARNING] Invalid choice, please try again")

        # Run recognition
        ColorPrint.yellow("\n[INFO] Preparing to start recognition...")
        device_type = selected_device[0]
        if device_type == 'loopback':
            ColorPrint.yellow("[INFO] Please start playing audio now (music, video, etc.)")
        time.sleep(2)

        try:
            stt.recognize_continuous_from_device(
                device_info=selected_device,
                duration_seconds=duration
            )

        except KeyboardInterrupt:
            ColorPrint.yellow("\n\n[INFO] Recognition interrupted by user (Ctrl+C)")
            stt.is_running = False

        except Exception as e:
            ColorPrint.red(f"\n[ERROR] Unexpected error: {e}")
            import traceback
            traceback.print_exc()

    finally:
        stt.cleanup()

    ColorPrint.blue("\n" + "="*70)
    ColorPrint.green("[DONE] Speech-to-text session completed")
    ColorPrint.blue("="*70 + "\n")


if __name__ == "__main__":
    main()
