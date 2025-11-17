#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Edge TTS Client

Provides Edge TTS integration with Windows/Linux compatibility.
"""

import os
import sys
import platform
import subprocess
import shutil
import threading
from pathlib import Path
from typing import Optional, List, Dict, Any

from pycore import ColorPrint
from pycore.pyfoundations.third_party import get_third_package_edge_tts

edge_tts = get_third_package_edge_tts()
from pycore.pyutils.edge_tts.config import TTSConfig


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
        
        result = subprocess.run(test_cmd, capture_output=True, text=True)
        if result.returncode == 0:
            self._edge_tts_binary = python_exe
            return python_exe
        
        ColorPrint.yellow("[EdgeTTS] Edge TTS not found. Please install: pip install edge-tts")
        return None
    
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
    
    def get_voices(self) -> List[Dict[str, Any]]:
        """
        Get available voices (synchronous wrapper)
        
        Returns:
            List[Dict]: List of voice information
        """
        if self._voices_cache:
            return self._voices_cache
        
        if not self.initialize():
            return []
        
        if edge_tts:
            # Use Python package (async)
            import asyncio
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
            result = subprocess.run(cmd, capture_output=True, text=True)
            
            if result.returncode != 0:
                ColorPrint.red(f"[EdgeTTS] Failed to get voices: {result.stderr}")
                return []
            
            # Parse output
            self._voices_cache = self._parse_voices_output(result.stdout)
        
        return self._voices_cache
    
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
    
    def synthesize(self, text: str, voice: str, output_path: Path, 
                   subtitle_path: Optional[Path] = None) -> bool:
        """
        Synthesize text to speech (synchronous wrapper)
        
        Args:
            text: Text to synthesize
            voice: Voice name (e.g., 'en-US-JennyNeural')
            output_path: Output audio file path
            subtitle_path: Output subtitle file path (optional)
        
        Returns:
            bool: True if successful
        """
        if not self.initialize():
            return False
        
        # Ensure output directory exists
        output_path.parent.mkdir(parents=True, exist_ok=True)
        
        if edge_tts:
            # Use Python package (async)
            import asyncio
            try:
                loop = asyncio.get_event_loop()
            except RuntimeError:
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
            
            async def _synthesize_async():
                communicate = edge_tts.Communicate(text, voice)
                await communicate.save(str(output_path))
                return True
            
            loop.run_until_complete(_synthesize_async())
        else:
            # Use command line
            binary = self._find_edge_tts_binary()
            if not binary:
                return False
            
            cmd = [binary, '--voice', voice, '--text', text, '--write-media', str(output_path)]
            
            if subtitle_path:
                subtitle_path.parent.mkdir(parents=True, exist_ok=True)
                cmd.extend(['--write-subtitles', str(subtitle_path)])
            
            if binary == 'python':
                cmd = [binary, '-m', 'edge_tts'] + cmd[1:]
            
            result = subprocess.run(cmd, capture_output=True, text=True)
            
            if result.returncode != 0:
                ColorPrint.red(f"[EdgeTTS] Synthesis failed: {result.stderr}")
                return False
        
        return True
    
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


# Global Edge TTS client instance
_global_edge_tts_client: Optional[EdgeTTSClient] = None
_client_lock = threading.Lock()


def get_edge_tts_client() -> EdgeTTSClient:
    """Get global Edge TTS client instance"""
    global _global_edge_tts_client
    with _client_lock:
        if _global_edge_tts_client is None:
            _global_edge_tts_client = EdgeTTSClient()
        return _global_edge_tts_client

