#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Azure Speech Services Test Script

Tests Azure Cognitive Services Speech SDK for text-to-speech functionality.
Uses Context7 service to verify if the service is working.

Configuration:
- KEY1: Azure Speech Service subscription key (leave empty if not available)
- KEY2: Azure Speech Service subscription key (leave empty if not available)
- Region: eastus
- Endpoint: https://eastus.api.cognitive.microsoft.com/
"""

import sys
import os
from pathlib import Path

# Add pycore to path
pycore_dir = Path(__file__).parent.parent.parent
sys.path.insert(0, str(pycore_dir))

from pycore import ColorPrint
from pycore.pyfoundations.third_party import speechsdk

# Azure Speech Service Configuration
# If keys are missing, leave them empty (use environment variables or set to empty string)
AZURE_SPEECH_KEY1 = os.environ.get('AZURE_SPEECH_KEY1', '')
AZURE_SPEECH_KEY2 = os.environ.get('AZURE_SPEECH_KEY2', '')
AZURE_SPEECH_REGION = os.environ.get('AZURE_SPEECH_REGION', 'eastus')
AZURE_SPEECH_ENDPOINT = os.environ.get('AZURE_SPEECH_ENDPOINT', 'https://eastus.api.cognitive.microsoft.com/')

# Use KEY1 if available and not empty, otherwise use KEY2, otherwise empty
AZURE_SPEECH_KEY = AZURE_SPEECH_KEY1.strip() if AZURE_SPEECH_KEY1 and AZURE_SPEECH_KEY1.strip() else (AZURE_SPEECH_KEY2.strip() if AZURE_SPEECH_KEY2 and AZURE_SPEECH_KEY2.strip() else '')


def test_speech_synthesis():
    """
    Test Azure Speech Services text-to-speech synthesis
    """
    if not speechsdk:
        ColorPrint.red("[ERROR] Azure Speech SDK not available. Please install: pip install azure-cognitiveservices-speech")
        return False

    if not AZURE_SPEECH_KEY:
        ColorPrint.yellow("[WARNING] Azure Speech Service key is empty. Test will be skipped.")
        ColorPrint.blue("[INFO] To set keys, use environment variables:")
        ColorPrint.blue("  - AZURE_SPEECH_KEY1 or AZURE_SPEECH_KEY2")
        return False

    try:
        ColorPrint.blue(f"[INFO] Testing Azure Speech Services...")
        ColorPrint.blue(f"[INFO] Region: {AZURE_SPEECH_REGION}")
        ColorPrint.blue(f"[INFO] Endpoint: {AZURE_SPEECH_ENDPOINT}")
        ColorPrint.blue(f"[INFO] Key: {AZURE_SPEECH_KEY[:8]}...{AZURE_SPEECH_KEY[-4:]}")

        # Create speech configuration
        speech_config = speechsdk.SpeechConfig(
            subscription=AZURE_SPEECH_KEY,
            region=AZURE_SPEECH_REGION
        )

        # Set voice (optional, uses default if not set)
        # speech_config.speech_synthesis_voice_name = "en-US-JennyNeural"

        # Create synthesizer
        synthesizer = speechsdk.SpeechSynthesizer(speech_config=speech_config)

        # Test text
        test_text = "Hello, this is a test of Azure Speech Services. The service is working correctly."

        ColorPrint.blue(f"[INFO] Synthesizing text: {test_text}")

        # Perform synthesis
        result = synthesizer.speak_text_async(test_text).get()

        # Check result
        if result.reason == speechsdk.ResultReason.SynthesizingAudioCompleted:
            ColorPrint.green("[SUCCESS] Speech synthesis completed successfully!")
            ColorPrint.blue(f"[INFO] Audio data length: {len(result.audio_data)} bytes")
            return True
        elif result.reason == speechsdk.ResultReason.Canceled:
            cancellation = speechsdk.CancellationDetails(result)
            ColorPrint.red(f"[ERROR] Speech synthesis canceled: {cancellation.reason}")
            if cancellation.reason == speechsdk.CancellationReason.Error:
                ColorPrint.red(f"[ERROR] Error details: {cancellation.error_details}")
            return False
        else:
            ColorPrint.red(f"[ERROR] Unexpected result reason: {result.reason}")
            return False

    except Exception as e:
        ColorPrint.red(f"[ERROR] Failed to test Azure Speech Services: {e}")
        import traceback
        ColorPrint.red(traceback.format_exc())
        return False


def test_list_voices():
    """
    Test listing available voices from Azure Speech Services
    """
    if not speechsdk:
        return False

    if not AZURE_SPEECH_KEY:
        return False

    try:
        ColorPrint.blue("[INFO] Fetching available voices...")

        # Create speech configuration
        speech_config = speechsdk.SpeechConfig(
            subscription=AZURE_SPEECH_KEY,
            region=AZURE_SPEECH_REGION
        )

        # Create synthesizer
        synthesizer = speechsdk.SpeechSynthesizer(speech_config=speech_config)

        # Get available voices
        result = synthesizer.get_voices_async().get()

        if result.reason == speechsdk.ResultReason.VoicesListRetrieved:
            ColorPrint.green(f"[SUCCESS] Retrieved {len(result.voices)} voices")
            ColorPrint.blue("[INFO] Sample voices:")
            for i, voice in enumerate(result.voices[:10]):  # Show first 10
                ColorPrint.blue(f"  {i+1}. {voice.short_name} ({voice.locale}) - {voice.gender}")
            if len(result.voices) > 10:
                ColorPrint.blue(f"  ... and {len(result.voices) - 10} more voices")
            return True
        else:
            ColorPrint.red(f"[ERROR] Failed to retrieve voices: {result.reason}")
            return False

    except Exception as e:
        ColorPrint.red(f"[ERROR] Failed to list voices: {e}")
        return False


def main():
    """
    Main test function
    """
    ColorPrint.blue("=" * 60)
    ColorPrint.blue("Azure Speech Services Test")
    ColorPrint.blue("=" * 60)

    # Test 1: Speech Synthesis
    ColorPrint.blue("\n[TEST 1] Text-to-Speech Synthesis")
    ColorPrint.blue("-" * 60)
    synthesis_success = test_speech_synthesis()

    # Test 2: List Voices
    ColorPrint.blue("\n[TEST 2] List Available Voices")
    ColorPrint.blue("-" * 60)
    voices_success = test_list_voices()

    # Summary
    ColorPrint.blue("\n" + "=" * 60)
    ColorPrint.blue("Test Summary")
    ColorPrint.blue("=" * 60)
    ColorPrint.blue(f"Speech Synthesis: {'PASS' if synthesis_success else 'FAIL'}")
    ColorPrint.blue(f"List Voices: {'PASS' if voices_success else 'FAIL'}")

    if synthesis_success and voices_success:
        ColorPrint.green("\n[SUCCESS] All tests passed!")
        return 0
    else:
        ColorPrint.yellow("\n[WARNING] Some tests failed or were skipped.")
        return 1


if __name__ == "__main__":
    sys.exit(main())

