# -*- coding: utf-8 -*-
"""
Voice Subtitle Player

Plays audio from queue and displays subtitles in UI.
"""

import threading
import time
from pathlib import Path
from typing import Optional

from pycore import ColorPrint, THREAD_BUS
from pycore.pyfoundations.third_party import get_third_package_pygame
from pycore.pyctl.desktop.queue_manager import get_voice_subtitle_queue


_PLAYER_START_QUEUE = 'pyctl.desktop.player.start'
_PLAYER_RUNNING_SIGNAL = 'pyctl.desktop.player.running'
_PLAYER_STOPPED_SIGNAL = 'pyctl.desktop.player.stopped'


class VoiceSubtitlePlayerThread(threading.Thread):
    """Run player work received through THREAD_BUS."""

    def __init__(self) -> None:
        super().__init__(daemon=True, name='VoiceSubtitlePlayerThread')

    def run(self) -> None:
        payload = THREAD_BUS.receive_message(_PLAYER_START_QUEUE)
        if not isinstance(payload, dict):
            return
        try:
            payload['player']._play_loop()
        finally:
            THREAD_BUS.signal(_PLAYER_RUNNING_SIGNAL, False)
            THREAD_BUS.signal(_PLAYER_STOPPED_SIGNAL, True)


class VoiceSubtitlePlayer:
    """
    Voice subtitle player service

    Features:
    - Plays audio files from queue in order
    - Displays subtitles via THREAD_BUS events
    - Loops through queue when enabled
    - Pauses when disabled
    """

    def __init__(self):
        """Initialize player"""
        THREAD_BUS.signal(_PLAYER_RUNNING_SIGNAL, False)

        # Initialize pygame mixer once
        pygame = get_third_package_pygame()
        pygame.mixer.init()
        ColorPrint.green("[Player] pygame.mixer initialized")

    def start(self):
        """Start player thread"""
        if THREAD_BUS.get_signal(_PLAYER_RUNNING_SIGNAL, False):
            ColorPrint.yellow("[Player] Already running")
            return

        THREAD_BUS.clear_signal(_PLAYER_STOPPED_SIGNAL)
        THREAD_BUS.signal(_PLAYER_RUNNING_SIGNAL, True)
        THREAD_BUS.send_message(_PLAYER_START_QUEUE, {'player': self})
        VoiceSubtitlePlayerThread().start()
        ColorPrint.green("[Player] Started")

    def stop(self):
        """Stop player thread"""
        if not THREAD_BUS.get_signal(_PLAYER_RUNNING_SIGNAL, False):
            return

        THREAD_BUS.signal(_PLAYER_RUNNING_SIGNAL, False)
        THREAD_BUS.wait_signal(_PLAYER_STOPPED_SIGNAL, timeout=2.0)
        THREAD_BUS.clear_signal(_PLAYER_STOPPED_SIGNAL)

        # Quit pygame mixer
        pygame = get_third_package_pygame()
        pygame.mixer.quit()

        ColorPrint.blue("[Player] Stopped")

    def _play_loop(self):
        """Main playback loop"""
        ColorPrint.blue("[Player] Playback loop started")

        while THREAD_BUS.get_signal(_PLAYER_RUNNING_SIGNAL, False):
            try:
                queue = get_voice_subtitle_queue()

                # Wait if disabled
                if not queue.is_enabled():
                    time.sleep(0.5)
                    continue

                # Get current item
                current_item = queue.get_current_item()

                if not current_item:
                    # Queue is empty, wait
                    time.sleep(1)
                    continue

                # Play current item
                self._play_item(current_item.text, current_item.audio_path)

                # Increment play count
                queue.increment_play_count()

                # Move to next item
                queue.next_item()

                # Small delay between items
                time.sleep(0.3)

            except Exception as e:
                ColorPrint.red(f"[Player] Error in playback loop: {e}")
                time.sleep(1)

        ColorPrint.blue("[Player] Playback loop ended")

    def _play_item(self, text: str, audio_path: str):
        """
        Play a single item

        Args:
            text: Subtitle text
            audio_path: Path to audio file
        """
        audio_file = Path(audio_path)

        if not audio_file.exists():
            ColorPrint.red(f"[Player] Audio file not found: {audio_path}")
            return

        ColorPrint.blue(f"[Player] Playing: {text[:50]}...")

        # Send subtitle update event to UI via THREAD_BUS
        THREAD_BUS.trigger_event('voice_subtitle_update', {
            'text': text,
            'audio_path': audio_path
        })

        # Get pygame (already initialized in __init__)
        pygame = get_third_package_pygame()

        # Play audio using pygame
        pygame.mixer.music.load(str(audio_file))
        pygame.mixer.music.play()

        # Wait for playback to finish
        while (
            pygame.mixer.music.get_busy()
            and THREAD_BUS.get_signal(_PLAYER_RUNNING_SIGNAL, False)
        ):
            time.sleep(0.1)

        pygame.mixer.music.stop()

        ColorPrint.green(f"[Player] Finished playing: {text[:30]}...")


# Global player instance
_voice_subtitle_player: Optional[VoiceSubtitlePlayer] = None


def get_voice_subtitle_player() -> VoiceSubtitlePlayer:
    """
    Get global voice subtitle player instance

    Returns:
        VoiceSubtitlePlayer: Global player instance

    NOTE: Server-side playback is now disabled.
    All audio playback happens in the frontend (browser).
    """
    global _voice_subtitle_player

    # DISABLED: Server-side playback no longer needed - frontend plays audio
    # if _voice_subtitle_player is None:
    #     with _player_lock:
    #         if _voice_subtitle_player is None:
    #             _voice_subtitle_player = VoiceSubtitlePlayer()
    #             _voice_subtitle_player.start()

    # Return None - no server-side player
    return None
