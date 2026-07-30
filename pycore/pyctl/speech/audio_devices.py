#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Audio Device Management and Backend Globals

THE single home for the platform/PyAudio backend globals:
- pyaudio, AUDIO_BACKEND, HAS_LOOPBACK_SUPPORT, speechsdk, np, CURRENT_PLATFORM
These are initialized once at import time (with print side-effects) and imported
by other speech sub-modules (audio_capture.py, transcription_app.py). They MUST
NOT be re-declared or re-initialized anywhere else.

Also hosts AudioDeviceManager (platform-specific device enumeration).

TODO: extract a shared device-enumeration+loopback core together with
pyutils/whisper_stt/audio_capture.py (deferred to a later reuse batch).
"""

import platform

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.third_party.api import get_third_package_speechsdk, get_third_package_pyaudio, get_third_package_pyaudiowpatch
from pycore.pyfoundations.third_party.api import get_third_package_numpy

# Backend globals - initialized once at import time (single source of truth).
# Other modules MUST import these names from here; never re-declare them.
# Import order is load-bearing: getters are called before the platform prints below.
speechsdk = get_third_package_speechsdk()
np = get_third_package_numpy()
pyaudio_standard = get_third_package_pyaudio()
pyaudiowpatch = get_third_package_pyaudiowpatch()

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

        ColorPrint.plain("="*70)
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
                            ColorPrint.plain(f"  [{len(devices)-1}] {device_info['name']}")
                            ColorPrint.plain(f"      Sample Rate: {int(device_info['defaultSampleRate'])} Hz")
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
                    ColorPrint.plain(f"  [{len(devices)-1}] {device_info['name']}")
                    ColorPrint.plain(f"      Sample Rate: {int(device_info['defaultSampleRate'])} Hz")
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
                ColorPrint.plain(f"  [{len(devices)-1}] {device_info['name']}")
                ColorPrint.plain(f"      Sample Rate: {int(device_info['defaultSampleRate'])} Hz")
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
                    ColorPrint.plain(f"  [{len(devices)-1}] {device_info['name']}")
                    ColorPrint.plain(f"      Sample Rate: {int(device_info['defaultSampleRate'])} Hz")
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
                    ColorPrint.plain(f"  [{len(devices)-1}] {device_info['name']}")
                    ColorPrint.plain(f"      Sample Rate: {int(device_info['defaultSampleRate'])} Hz")
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
                    ColorPrint.plain(f"  [{len(devices)-1}] {device_info['name']}")
                    ColorPrint.plain(f"      Sample Rate: {int(device_info['defaultSampleRate'])} Hz")
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
                ColorPrint.plain(f"  [{len(devices)-1}] {device_info['name']}")
                ColorPrint.plain(f"      Inputs: {device_info['maxInputChannels']}")
                ColorPrint.plain(f"      Sample Rate: {int(device_info['defaultSampleRate'])} Hz")

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
