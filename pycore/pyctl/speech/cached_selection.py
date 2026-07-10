#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Cached Selection Helpers

Interactive (with cache support) selection of language, audio device, and
duration. Uses speech_config for persistence and AudioDeviceManager (passed in)
for device listing.
"""

from typing import List

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyutils.common import speech_config


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
    cached_languages = speech_config.get(f"ui_languages_{source}")
    if cached_languages:
        ColorPrint.green(f"\n[Cached {source} languages: {cached_languages}]")

        # Check if auto-use cached config is enabled
        auto_use_cached = speech_config.get('auto_use_cached', True)

        if auto_use_cached:
            ColorPrint.blue("[Auto-using cached languages (speech_auto_use_cached=True)]")
            return cached_languages

        # Manual prompt (if auto-use is disabled)
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
                speech_config.set(f"ui_languages_{source}", selected_languages)
                return selected_languages
        else:
            # Single select
            if choice in language_map:
                language = language_map[choice]
                # Cache selection
                speech_config.set(f"ui_languages_{source}", [language])
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
    all_devices = device_manager.list_devices()

    if not all_devices:
        ColorPrint.red("\nNo audio devices found")
        return None

    # Filter devices based on device_type
    if device_type == "microphone":
        # Only show microphones (non-loopback)
        devices = [d for d in all_devices if d[0] != 'loopback']
        selection_title = "Select Microphone Device"
    elif device_type == "system":
        # Only show loopback devices (system audio)
        devices = [d for d in all_devices if d[0] == 'loopback']
        selection_title = "Select System Audio Device (Loopback)"
    else:
        # Show all devices
        devices = all_devices
        selection_title = "Select Audio Device"

    if not devices:
        ColorPrint.red(f"\nNo {device_type} devices found")
        return None

    # Check cache
    cached_device_index = speech_config.get(f"ui_audio_device_{device_type}")
    if cached_device_index is not None:
        ColorPrint.green(f"\n[Cached {device_type} device: {cached_device_index}]")

        # Check if auto-use cached config is enabled
        auto_use_cached = speech_config.get('auto_use_cached', True)

        # Find device by index in filtered list
        cached_device = None
        for dev in devices:
            if dev[1] == cached_device_index:
                cached_device = dev
                break

        if cached_device:
            if auto_use_cached:
                ColorPrint.blue("[Auto-using cached device (auto_use_cached=True)]")
                return cached_device
            else:
                use_cached = input("Use cached device? (y/n) [default: y]: ").strip().lower()
                if use_cached != 'n':
                    return cached_device
        else:
            ColorPrint.yellow(f"[Warning] Cached device (index {cached_device_index}) not found in current {device_type} device list")
            ColorPrint.yellow("[Action] Please select a new device")

    # Select device
    selected = device_manager.select_device(devices)
    if selected:
        _, device_index, _ = selected
        # Cache selection
        speech_config.set(f"ui_audio_device_{device_type}", device_index)

    return selected


def select_duration_with_cache():
    """
    Select duration mode with cache support

    Returns:
        Duration in seconds (None for continuous)
    """
    # Check cache
    cached_mode = speech_config.get("ui_duration_mode")
    if cached_mode:
        ColorPrint.green(f"\n[Cached duration mode: {cached_mode}]")
        if cached_mode == "continuous":
            ColorPrint.green("[Cached: Continuous mode]")
        else:
            cached_seconds = speech_config.get("ui_duration_seconds")
            ColorPrint.green(f"[Cached: Limited mode - {cached_seconds}s]")

        # Check if auto-use cached config is enabled
        auto_use_cached = speech_config.get('auto_use_cached', True)

        if auto_use_cached:
            ColorPrint.blue("[Auto-using cached duration (speech_auto_use_cached=True)]")
            if cached_mode == "continuous":
                return None
            else:
                return speech_config.get("ui_duration_seconds")
        else:
            use_cached = input("Use cached duration? (y/n) [default: y]: ").strip().lower()
            if use_cached != 'n':
                if cached_mode == "continuous":
                    return None
                else:
                    return speech_config.get("ui_duration_seconds")

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
            speech_config.set("ui_duration_mode", "continuous")
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

            speech_config.set("ui_duration_mode", "limited")
            speech_config.set("ui_duration_seconds", duration)
            return duration
        else:
            ColorPrint.yellow("Invalid choice, please try again")
