# -*- coding: utf-8 -*-
from .window_manager import VoiceSubtitleWindowManager, get_window_manager
"""
Voice Subtitle Controller

Manages voice subtitle playback queue and state.
"""

from .queue_manager import VoiceSubtitleQueue, get_voice_subtitle_queue
from .player import VoiceSubtitlePlayer, get_voice_subtitle_player

try:
    HAS_WINDOW_MANAGER = True
except ImportError:
    VoiceSubtitleWindowManager = None
    get_window_manager = None
    HAS_WINDOW_MANAGER = False

__all__ = [
    'VoiceSubtitleQueue',
    'get_voice_subtitle_queue',
    'VoiceSubtitlePlayer',
    'get_voice_subtitle_player',
    'VoiceSubtitleWindowManager',
    'get_window_manager',
    'HAS_WINDOW_MANAGER'
]
