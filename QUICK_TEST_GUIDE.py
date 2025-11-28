#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Quick Test Script - Restart Server and Test

This script helps you quickly test the voice subtitle system.
"""

import subprocess
import sys
import time

print("=" * 70)
print("Voice Subtitle System - Quick Test Guide")
print("=" * 70)
print()
print("STEP 1: Restart the RPC server to apply code changes")
print()
print("  Option A (With UI):")
print("    python pycore_module_caller.py --enable-voice-subtitle-ui")
print()
print("  Option B (Without UI):")
print("    python pycore_module_caller.py")
print()
print("-" * 70)
print()
print("STEP 2: Test the voice subtitle system")
print()
print("  Text Test (English):")
print("    python test_voice_subtitle_image.py --text \"Hello world\"")
print()
print("  Text Test (Chinese -> English translation):")
print("    python test_voice_subtitle_image.py --text \"你好，这是一个测试\"")
print()
print("  Image Test:")
print("    python test_voice_subtitle_image.py <path_to_image.png>")
print()
print("-" * 70)
print()
print("STEP 3: Check the queue via HTTP API")
print()
print("  curl http://localhost:59000/voice-subtitle/queue")
print()
print("=" * 70)
print()
print("KEY FIX APPLIED:")
print("  - Always translate text to target language (auto-detect source)")
print("  - Ensures TTS voice matches text language")
print("  - Chinese text will be translated to English before TTS")
print()
print("=" * 70)
