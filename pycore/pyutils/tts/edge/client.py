#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Edge TTS Client

Provides Edge TTS integration with Windows/Linux compatibility.
"""

import os
import sys
import platform
from pycore.pyfoundations.pybasecommon.commander import exec_silent, exec_realtime
import shutil
from pathlib import Path
from typing import Optional, List, Dict, Any

import time
import asyncio

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS
from pycore.pyfoundations.third_party.api import get_third_package_edge_tts

import tempfile


edge_tts = get_third_package_edge_tts()
from pycore.pyutils.tts.edge.config import TTSConfig
from pycore.pyfoundations.serialized_worker import (
    SerializedWorkerThread,
    call_serialized,
    init_serialized_owner,
    serialized_method,
    start_bus_task,
)

# Microsoft's speech endpoint periodically returns HTTP 403 on the WebSocket
# handshake — usually rate-limiting or regional network blocking, NOT a code bug
# (edge-tts already handles the Sec-MS-GEC token + clock skew). We retry with
# backoff, and honor an optional outbound proxy for blocked regions.
#   EDGE_TTS_PROXY = http://host:port   (or socks5://…) — passed to Communicate.
_SYNTH_MAX_ATTEMPTS = 3
_SYNTH_BACKOFF_BASE_S = 1.5
# Hard per-attempt timeout. edge-tts's communicate.save() has NO timeout of its
# own, so a stalled WebSocket to Microsoft hangs on Python's default socket timeout
# (~180s) before failing — which stalled the whole TTS track per word. Bounding each
# attempt makes a stall fail FAST so the orchestrator falls back to the offline
# engine quickly. Override with EDGE_TTS_SYNTH_TIMEOUT_S.
_SYNTH_TIMEOUT_SIGNAL = "edge_tts.synth_timeout"
THREAD_BUS.signal(
    _SYNTH_TIMEOUT_SIGNAL,
    float(os.environ.get("EDGE_TTS_SYNTH_TIMEOUT_S", "25") or "25"),
)
_SUBTITLE_TIMEOUT_S = 10.0
# Live-availability test result is cached so a status poll never hammers the
# endpoint (each test is a real synth round-trip).
_AVAIL_TTL_S = 60.0

# NO CONCURRENCY: edge-tts opens one WebSocket to Microsoft per synth; running
# several at once is a fast path to HTTP 403 (rate-limit). This process-wide bus
# owner serializes every edge-tts synthesis so there is never more than one in flight,
# no matter how many callers/threads/pipelines request TTS at the same time.
_EDGE_SYNTH_QUEUE = 'pyutils.edge_tts.synthesize'
_EDGE_SYNTH_WORKER = SerializedWorkerThread(
    _EDGE_SYNTH_QUEUE,
    'EdgeTTSSynthesisThread',
)
_EDGE_SYNTH_WORKER.start()

# Default speech rate. edge-tts wants a signed percentage string ("-20%", "+0%").
# For a language-learning subtitle tool, a slight slowdown (~0.8x) sharpens word
# boundaries while keeping natural prosody. Override with EDGE_TTS_RATE.
_DEFAULT_RATE = "-20%"


def _edge_tts_proxy() -> Optional[str]:
    """Optional outbound proxy for edge-tts (EDGE_TTS_PROXY env), or None."""
    proxy = (os.environ.get('EDGE_TTS_PROXY') or '').strip()
    return proxy or None


def _normalize_rate(rate: Optional[str]) -> str:
    """
    Coerce a rate to edge-tts's signed-percentage form ("-20%", "+10%", "+0%").

    Accepts None (-> EDGE_TTS_RATE env or the -20% default), a bare number
    ("-20" -> "-20%"), or an already-valid string. An unsigned percentage gets a
    leading "+".
    """
    if rate is None:
        rate = (os.environ.get('EDGE_TTS_RATE') or '').strip() or _DEFAULT_RATE
    rate = str(rate).strip()
    if not rate:
        return "+0%"
    if not rate.endswith('%'):
        rate += '%'
    if rate[0] not in '+-':
        rate = '+' + rate
    return rate


def _is_retryable_tts_error(err: Exception) -> bool:
    """403 handshake / rate-limit / transient network / our synth timeout are retryable."""
    # asyncio.wait_for timeout (our per-attempt bound) carries an empty message, so
    # match it by TYPE, not text.
    if isinstance(err, (asyncio.TimeoutError, TimeoutError)):
        return True
    msg = str(err).lower()
    return any(m in msg for m in (
        '403', 'invalid response status', 'handshake', 'timeout', 'timed out',
        'temporarily', 'connection reset', 'connection aborted', 'too many requests',
        '429', 'server disconnected', 'no audio was received', 'no audio received',
    ))


def get_synth_timeout() -> float:
    """Current per-attempt synth timeout (seconds)."""
    return float(THREAD_BUS.get_signal(_SYNTH_TIMEOUT_SIGNAL, 25.0))


def set_synth_timeout(seconds: Any) -> float:
    """Override the per-attempt synth timeout at runtime (Settings-adjustable).
    Clamped to [5, 120]s; ignored if not numeric. Returns the value in effect."""
    current = get_synth_timeout()
    try:
        current = max(5.0, min(120.0, float(seconds)))
    except (TypeError, ValueError):
        pass
    THREAD_BUS.signal(_SYNTH_TIMEOUT_SIGNAL, current)
    return current


class EdgeTTSClient:
    """
    Edge TTS client for text-to-speech conversion
    
    Features:
    - Automatic Edge TTS binary detection (Windows/Linux)
    - Voice list management
    - Text-to-speech conversion
    - Subtitle generation
    """
    
    def __init__(self):
        """Initialize Edge TTS client"""
        self._edge_tts_binary: Optional[str] = None
        self._voices_cache: Optional[List[Dict[str, Any]]] = None
        self._initialized = False
        self._active_tasks = 0
        self._avail_cache: Optional[Dict[str, Any]] = None
        self._avail_probing = False
        init_serialized_owner(
            self,
            "edge_tts.client.state",
            "EdgeTTSClientState",
            timeout=300.0,
        )
    
    def _find_edge_tts_binary(self) -> Optional[str]:
        """
        Find Edge TTS binary
        
        Returns:
            str: Path to edge-tts binary or None
        """
        if self._edge_tts_binary:
            return self._edge_tts_binary
        
        # Try using edge_tts Python package first
        if edge_tts:
            # Use Python package directly
            self._edge_tts_binary = 'python'
            return self._edge_tts_binary
        
        # Try finding edge-tts command
        binary_name = 'edge-tts.exe' if platform.system() == 'Windows' else 'edge-tts'
        binary_path = shutil.which(binary_name)
        
        if binary_path:
            self._edge_tts_binary = binary_path
            return binary_path
        
        # Try Python module execution
        python_exe = sys.executable
        test_cmd = [python_exe, '-m', 'edge_tts', '--version']
        
        result = exec_silent(test_cmd, capture_output=True, text=True)
        if result.return_code == 0:
            self._edge_tts_binary = python_exe
            return python_exe
        
        ColorPrint.yellow("[EdgeTTS] Edge TTS not found. Please install: pip install edge-tts")
        return None
    
    @serialized_method
    def initialize(self) -> bool:
        """
        Initialize Edge TTS client
        
        Returns:
            bool: True if initialized successfully
        """
        if self._initialized:
            return True
        
        binary = self._find_edge_tts_binary()
        if not binary:
            return False
        
        self._initialized = True
        ColorPrint.blue(f"[EdgeTTS] Initialized with binary: {binary}")
        return True
    
    @serialized_method
    def get_voices(self) -> List[Dict[str, Any]]:
        """
        Get available voices (synchronous wrapper)
        
        Returns:
            List[Dict]: List of voice information
        """
        if self._voices_cache:
            return [dict(voice) for voice in self._voices_cache]
        
        if not self.initialize():
            return []
        
        if edge_tts:
            # Use Python package (async)
            try:
                loop = asyncio.get_event_loop()
            except RuntimeError:
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
            
            voices = loop.run_until_complete(edge_tts.list_voices())
            self._voices_cache = []
            for voice in voices:
                self._voices_cache.append({
                    'ShortName': voice.get('ShortName', ''),
                    'Locale': voice.get('Locale', ''),
                    'Gender': voice.get('Gender', ''),
                    'Name': voice.get('Name', ''),
                })
        else:
            # Use command line
            binary = self._find_edge_tts_binary()
            if not binary:
                return []
            
            cmd = [binary, '--list-voices'] if binary != 'python' else [binary, '-m', 'edge_tts', '--list-voices']
            result = exec_silent(cmd, capture_output=True, text=True)
            
            if result.return_code != 0:
                ColorPrint.red(f"[EdgeTTS] Failed to get voices: {result.stderr}")
                return []
            
            # Parse output
            self._voices_cache = self._parse_voices_output(result.stdout)
        
        return [dict(voice) for voice in self._voices_cache]
    
    def _parse_voices_output(self, output: str) -> List[Dict[str, Any]]:
        """Parse edge-tts --list-voices output"""
        voices = []
        lines = output.strip().split('\n')
        
        for line in lines:
            if not line.strip():
                continue
            
            parts = line.split()
            if len(parts) >= 3:
                short_name = parts[0]
                gender = parts[1] if parts[1] in ['Male', 'Female'] else 'Female'
                locale = short_name.split('-')[0] + '-' + short_name.split('-')[1] if '-' in short_name else 'en-US'
                
                voices.append({
                    'ShortName': short_name,
                    'Locale': locale,
                    'Gender': gender,
                    'Name': ' '.join(parts[2:]) if len(parts) > 2 else short_name,
                })
        
        return voices
    
    def _synthesize(self, text: str, voice: str, output_path: Path,
                    subtitle_path: Optional[Path] = None,
                    rate: Optional[str] = None) -> bool:
        """
        Synthesize text to speech (synchronous wrapper).

        Serialized PROCESS-WIDE: edge-tts is never run concurrently (concurrent
        WebSockets to Microsoft trigger HTTP 403). All callers queue on the
        synthesis owner and synthesize one at a time.

        Args:
            text: Text to synthesize
            voice: Voice name (e.g., 'en-US-JennyNeural')
            output_path: Output audio file path
            subtitle_path: Output subtitle file path (optional)
            rate: Speech rate as a signed percentage ("-20%", "+0%"). None ->
                  EDGE_TTS_RATE env or the -20% default.

        Returns:
            bool: True if successful
        """
        if not self.initialize():
            return False

        # Ensure output directory exists
        output_path.parent.mkdir(parents=True, exist_ok=True)

        rate = _normalize_rate(rate)

        self._mark_task_start()
        try:
            # This method runs only on the process-wide synthesis owner thread.
            if True:
                if edge_tts:
                    try:
                        loop = asyncio.get_event_loop()
                    except RuntimeError:
                        loop = asyncio.new_event_loop()
                        asyncio.set_event_loop(loop)

                    proxy = _edge_tts_proxy()

                    async def _synthesize_async():
                        # Fresh Communicate per attempt; edge-tts is one-shot per save.
                        kwargs = {"proxy": proxy} if proxy else {}
                        communicate = edge_tts.Communicate(text, voice, rate=rate, **kwargs)
                        # Bound each attempt: edge-tts's save() has no timeout, so a
                        # stalled WebSocket otherwise hangs ~180s (Python socket
                        # default). wait_for cancels the coroutine + raises on stall.
                        await asyncio.wait_for(
                            communicate.save(str(output_path)),
                            timeout=get_synth_timeout(),
                        )
                        if subtitle_path:
                            await asyncio.wait_for(
                                communicate.save_subtitles(str(subtitle_path), subtitle_format="srt"),
                                timeout=_SUBTITLE_TIMEOUT_S)

                    # Retry with backoff: the endpoint 403s under rate-limit/region
                    # blocking even though edge-tts already corrects clock skew.
                    last_err: Optional[Exception] = None
                    for attempt in range(1, _SYNTH_MAX_ATTEMPTS + 1):
                        try:
                            loop.run_until_complete(_synthesize_async())
                            return True
                        except Exception as e:  # noqa: BLE001 — classify, then retry or give up
                            last_err = e
                            if attempt < _SYNTH_MAX_ATTEMPTS and _is_retryable_tts_error(e):
                                delay = _SYNTH_BACKOFF_BASE_S * (2 ** (attempt - 1))
                                ColorPrint.yellow(
                                    f"[EdgeTTS] synth attempt {attempt}/{_SYNTH_MAX_ATTEMPTS} "
                                    f"failed ({e}); retrying in {delay:.1f}s"
                                    + (" via proxy" if proxy else ""))
                                time.sleep(delay)
                                continue
                            break
                    hint = (" Set EDGE_TTS_PROXY for region-blocked networks."
                            if last_err and '403' in str(last_err) and not proxy else "")
                    ColorPrint.red(f"[EdgeTTS] Synthesis failed after {_SYNTH_MAX_ATTEMPTS} attempts: {last_err}.{hint}")
                    return False

                binary = self._find_edge_tts_binary()
                if not binary:
                    return False

                cmd = [binary, '--voice', voice, '--rate', rate, '--text', text, '--write-media', str(output_path)]
                if subtitle_path:
                    subtitle_path.parent.mkdir(parents=True, exist_ok=True)
                    cmd.extend(['--write-subtitles', str(subtitle_path)])

                if binary == 'python':
                    cmd = [binary, '-m', 'edge_tts'] + cmd[1:]

                result = exec_silent(cmd, capture_output=True, text=True)
                if result.return_code != 0:
                    ColorPrint.red(f"[EdgeTTS] Synthesis failed: {result.stderr}")
                    return False
                return True
        finally:
            self._mark_task_end()

    def synthesize(self, text: str, voice: str, output_path: Path,
                   subtitle_path: Optional[Path] = None,
                   rate: Optional[str] = None) -> bool:
        """Synthesize through the process-wide edge-tts owner thread."""
        return call_serialized(
            _EDGE_SYNTH_QUEUE,
            self._synthesize,
            text,
            voice,
            output_path,
            subtitle_path,
            rate,
            timeout=300.0,
        )
    
    @serialized_method
    def find_voice_by_locale(self, locale: str, gender: str = 'female') -> Optional[str]:
        """
        Find voice by locale and gender
        
        Args:
            locale: Language locale
            gender: 'female' or 'male'
        
        Returns:
            str: Voice name or None
        """
        # First try config map
        voice = TTSConfig.get_voice(locale, gender)
        if voice:
            return voice
        
        # Then try to find from available voices
        if self._voices_cache:
            for v in self._voices_cache:
                if v.get('Locale', '').startswith(locale.split('-')[0]):
                    if v.get('Gender', '').lower() == gender.lower():
                        return v.get('ShortName')
        
        return None

    @serialized_method
    def get_version(self) -> Optional[str]:
        """Installed edge-tts package version, or None when unavailable."""
        if not edge_tts:
            return None
        return getattr(edge_tts, '__version__', None)

    @serialized_method
    def peek_availability(self) -> Optional[Dict[str, Any]]:
        """Last availability result WITHOUT a network probe (None if never run).

        Periodic status polls use this so they never block on a real edge synth
        round-trip (which can hang for seconds under 403 rate-limiting). A live
        probe happens only on an explicit user-initiated refresh.
        """
        cached = getattr(self, '_avail_cache', None)
        return {**cached, 'cached': True} if cached else None

    @serialized_method
    def ensure_background_probe(self) -> None:
        """Populate the availability cache via a ONE-SHOT background probe.

        Non-blocking: returns immediately. The status poll calls this when the
        cache is missing/stale so edge availability fills in within a poll cycle
        WITHOUT the request ever waiting on a network synth. A guard flag keeps
        at most one probe in flight.
        """
        if getattr(self, '_avail_probing', False):
            return
        cached = getattr(self, '_avail_cache', None)
        if cached and (time.time() - cached['checked_at']) < _AVAIL_TTL_S:
            return
        self._avail_probing = True

        def _run():
            try:
                self.test_availability(force=True)
            except Exception:
                pass
            finally:
                self._finish_background_probe()

        start_bus_task(_run, thread_name="EdgeTTSProbeThread")

    @serialized_method
    def _finish_background_probe(self) -> None:
        self._avail_probing = False

    @serialized_method
    def test_availability(self, force: bool = False) -> Dict[str, Any]:
        """
        Live availability check: synthesize a tiny clip and report the outcome.

        Cached for _AVAIL_TTL_S so a status poll never hammers the endpoint
        (each test is a real synth round-trip that counts against rate limits).

        Returns: { available, version, proxy, error, checked_at, cached }
        """
        now = time.time()
        cached = getattr(self, '_avail_cache', None)
        if cached and not force and (now - cached['checked_at']) < _AVAIL_TTL_S:
            return {**cached, 'cached': True}

        version = self.get_version()
        proxy = _edge_tts_proxy()
        result: Dict[str, Any] = {
            'available': False,
            'version': version,
            'proxy': bool(proxy),
            'error': None,
            'checked_at': now,
            'cached': False,
        }

        if not edge_tts:
            result['error'] = 'edge-tts package not installed'
            self._avail_cache = result
            return result


        async def _probe():
            kwargs = {"proxy": proxy} if proxy else {}
            # A 1-attempt synth to a temp file is the true end-to-end test.
            communicate = edge_tts.Communicate("test", "en-US-AriaNeural", **kwargs)
            fd, tmp = tempfile.mkstemp(suffix=".mp3")
            os.close(fd)
            try:
                await communicate.save(tmp)
            finally:
                try:
                    os.remove(tmp)
                except OSError:
                    pass

        try:
            loop = asyncio.get_event_loop()
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
        try:
            loop.run_until_complete(_probe())
            result['available'] = True
        except Exception as e:  # noqa: BLE001 — report the failure to the UI
            result['error'] = str(e)

        self._avail_cache = result
        return result

    @serialized_method
    def is_busy(self) -> bool:
        return self._active_tasks > 0

    @serialized_method
    def _mark_task_start(self) -> None:
        self._active_tasks += 1

    @serialized_method
    def _mark_task_end(self) -> None:
        self._active_tasks = max(0, self._active_tasks - 1)


edge_tts_client = EdgeTTSClient()

