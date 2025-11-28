#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Complete Voice Subtitle System Test Guide

Tests the complete workflow:
1. Server startup with player and UI
2. Add content to queue
3. Enable playback
4. Watch subtitles display in UI window
"""

print("""
╔══════════════════════════════════════════════════════════════════════╗
║         Voice Subtitle System - Complete Test Guide                  ║
╚══════════════════════════════════════════════════════════════════════╝

📋 SYSTEM ARCHITECTURE:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

┌─────────────────┐
│  RPC Server     │  HTTP API endpoints at :59000/voice-subtitle/*
└────────┬────────┘
         │
    ┌────▼──────────────────────────────────────────┐
    │  Voice Subtitle System                        │
    │                                               │
    │  ┌──────────────┐  ┌──────────────┐          │
    │  │ Queue        │  │ Player       │          │
    │  │ Manager      │◄─┤ Service      │          │
    │  └──────────────┘  └──────┬───────┘          │
    │                           │                   │
    │  ┌──────────────┐         │                   │
    │  │ TTS Cache    │         │                   │
    │  │ (MD5-based)  │         │                   │
    │  └──────────────┘         │                   │
    │                           │                   │
    └───────────────────────────┼───────────────────┘
                                │
                    ┌───────────▼──────────┐
                    │  THREAD_BUS Events   │
                    │  'voice_subtitle_    │
                    │   update'            │
                    └───────────┬──────────┘
                                │
                    ┌───────────▼──────────┐
                    │  Subtitle UI Window  │
                    │  (Tkinter floating)  │
                    └──────────────────────┘

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚀 STEP 1: Start Server with UI
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Windows (with tray + subtitle UI):
  python pycore_module_caller.py --enable-voice-subtitle-ui

Windows (tray only, no UI):
  python pycore_module_caller.py

Linux (service mode):
  python pycore_module_caller.py

Expected output:
  [Launcher] Starting voice subtitle player...
  [Player] Playback loop started
  [Windows] Voice subtitle UI started

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📝 STEP 2: Add Content to Queue
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Method A: Using test script

  # Text (auto-translate to English)
  python test_voice_subtitle_image.py --text "你好世界，这是一个测试"

  # Image (Gemini summary -> TTS)
  python test_voice_subtitle_image.py "path/to/image.png"


Method B: Direct HTTP API

  # Add text
  curl -X POST http://localhost:59000/voice-subtitle/add-text \\
    -H "Content-Type: application/json" \\
    -d '{"text":"Hello world test","langs":["en"]}'

  # Add image
  curl -X POST http://localhost:59000/voice-subtitle/add-image \\
    -H "Content-Type: application/json" \\
    -d '{"image_path":"D:\\\\test.png","langs":["en"]}'

Expected:
  [VoiceSubtitle] Processing text input: ...
  [VoiceSubtitle] Translating to en...
  [TTS] Generating audio for (en): ...
  [TTS] Audio generated and cached: xxx.mp3
  [VoiceSubtitle] Added item: ...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
▶️  STEP 3: Enable Playback
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Method A: Tray menu (Windows)
  1. Right-click tray icon
  2. Click "Voice Subtitle" to toggle ✓

Method B: HTTP API
  curl -X POST http://localhost:59000/voice-subtitle/toggle

Expected:
  [VoiceSubtitle] Playback enabled
  [Player] Playing: Hello world test...
  [Player] Finished playing: Hello world test...

UI Window should display:
  ┌──────────────────────────────────────┐
  │ 🎵 Voice Subtitle              [✕]   │
  ├──────────────────────────────────────┤
  │                                      │
  │     Hello world test                 │
  │                                      │
  └──────────────────────────────────────┘

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔍 STEP 4: Check Status
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

View queue:
  curl http://localhost:59000/voice-subtitle/queue

Expected response:
  {
    "success": true,
    "enabled": true,
    "current_index": 0,
    "queue": [
      {
        "text": "Hello world test",
        "audio_path": "D:\\...\\.core_node\\cache\\voice_subtitle_tts\\xxx.mp3",
        "play_count": 1
      }
    ]
  }

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎮 STEP 5: Control Playback
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Next item:
  curl -X POST http://localhost:59000/voice-subtitle/next

Previous item:
  curl -X POST http://localhost:59000/voice-subtitle/previous

Disable playback:
  curl -X POST http://localhost:59000/voice-subtitle/toggle

Clear queue:
  curl -X POST http://localhost:59000/voice-subtitle/clear

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📦 DEPENDENCIES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Required for audio playback:
  pip install pygame

OR

  pip install pyaudio

(Player will try pygame first, fallback to pyaudio)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 KEY FEATURES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Auto-translation (auto-detect → target language)
✅ TTS caching (MD5-based, paragraph level)
✅ Loop playback (cycles through queue)
✅ Real-time subtitle display
✅ Draggable UI window
✅ Tray menu control
✅ HTTP API control
✅ Image summarization (Gemini AI)
✅ Persistent queue storage
✅ Multi-language support (en, zh, ja, ko)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🐛 TROUBLESHOOTING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Issue: No audio playback
  → Install pygame: pip install pygame
  → Check speaker is not muted

Issue: Subtitle window not showing
  → Use --enable-voice-subtitle-ui flag
  → Check if window is behind other windows (always-on-top should work)

Issue: No audio generated
  → Check edge-tts is working: edge-tts --list-voices
  → Check internet connection (edge-tts needs online)

Issue: Translation failed
  → Check internet connection (Google Translate needs online)
  → Check if text is too long (>5000 chars)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📂 FILE STRUCTURE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

pycore/
├── pyctl/voice_subtitle/
│   ├── __init__.py             # Exports
│   ├── queue_manager.py        # Queue + storage
│   ├── player.py               # Playback service
│   ├── processor.py            # Text/Image processing + TTS
│   └── ui/
│       ├── __init__.py
│       └── subtitle_window.py  # Tkinter UI
│
├── callmodule/
│   ├── routers/
│   │   └── voice_subtitle_router.py  # HTTP API
│   └── platform/
│       ├── launcher.py         # Starts player service
│       ├── server_setup.py     # Routes registration
│       └── windows_tray.py     # Tray menu + UI

Cache:
  D:\\.tmp\\Users\\<USER>\\.core_node\\cache\\voice_subtitle_tts\\*.mp3

Storage:
  D:\\.tmp\\Users\\<USER>\\.core_node\\data\\voice_subtitle\\queue.json

╚══════════════════════════════════════════════════════════════════════╝
""")
