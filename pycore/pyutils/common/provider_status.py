"""
Provider Status Management

Centralized status tracking for all speech providers (TTS/STT).
Providers report their availability here when they fail.
Switches query this to route tasks to available providers.

Architecture:
- Single source of truth for provider availability
- Thread-safe status updates
- Runtime status changes (not just initialization)
- Status listeners for notifications
"""

import time
from typing import Dict, Optional, Callable, List
from dataclasses import dataclass, field
from datetime import datetime

from pycore.pyfoundations import ColorPrint
from pycore.pyfoundations.third_party import (
    get_third_package_edge_tts,
    get_third_package_speechsdk,
    get_third_package_vosk,
    get_third_package_whisper,
)
from pycore.pyutils.edge_tts.edge_tts_client import get_edge_tts_client
from pycore.pyutils.azure_speech import get_azure_speech_client
from pycore.pyutils.azure_speech.quota_state import (
    is_tts_quota_blocked,
    is_stt_quota_blocked,
)


@dataclass
class ProviderInfo:
    """Information about a single provider"""
    available: bool = False
    error: Optional[str] = None
    last_check: Optional[datetime] = None
    last_success: Optional[datetime] = None
    last_failure: Optional[datetime] = None
    failure_count: int = 0
    busy: bool = False

    def mark_available(self):
        """Mark provider as available"""
        self.available = True
        self.error = None
        self.last_check = datetime.now()
        self.last_success = datetime.now()
        self.failure_count = 0
        self.busy = False

    def mark_unavailable(self, error: str):
        """Mark provider as unavailable"""
        self.available = False
        self.error = error
        self.last_check = datetime.now()
        self.last_failure = datetime.now()
        self.failure_count += 1
        self.busy = False


class ProviderStatus:
    """
    Centralized provider status management

    Tracks availability of all speech providers (TTS/STT).
    Updates when providers fail at runtime.
    Thread-safe for concurrent access.

    Usage:
        # Get singleton instance
        status = get_provider_status()

        # Check TTS providers
        status.check_tts_providers()

        # Check STT providers
        status.check_stt_providers()

        # Mark provider as unavailable (called by provider when it fails)
        status.mark_unavailable('tts', 'edge', 'Quota exceeded')

        # Get best available provider
        provider = status.get_best_tts_provider()
    """

    def __init__(self):
        """Initialize provider status tracker"""
        # Provider status storage
        self._status: Dict[str, Dict[str, ProviderInfo]] = {
            'tts': {
                'edge': ProviderInfo(),
                'azure': ProviderInfo()
            },
            'stt': {
                'whisper': ProviderInfo(),
                'azure': ProviderInfo(),
                'local': ProviderInfo()
            }
        }

        # Status change listeners
        self._listeners: List[Callable] = []

        # Initialization flag
        self._initialized = False

        ColorPrint.blue("[ProviderStatus] Initialized")

    def add_listener(self, callback: Callable):
        """
        Add status change listener

        Args:
            callback: Function called when status changes
                     Signature: callback(category, provider_name, available, error)
        """
        if callback not in self._listeners:
            self._listeners.append(callback)

    def remove_listener(self, callback: Callable):
        """Remove status change listener"""
        if callback in self._listeners:
            self._listeners.remove(callback)

    def _notify_listeners(self, category: str, provider_name: str, available: bool, error: Optional[str]):
        """Notify all listeners of status change"""
        for listener in list(self._listeners):
            try:
                listener(category, provider_name, available, error)
            except Exception as e:
                ColorPrint.red(f"[ProviderStatus] Listener error: {e}")

    def check_tts_providers(self):
        """
        Check availability of all TTS providers

        This should be called at initialization to detect which providers are available.
        """
        ColorPrint.blue("[ProviderStatus] Checking TTS providers...")

        # Edge TTS availability via third-party import
        edge_module = get_third_package_edge_tts()
        edge_info = self._status['tts']['edge']
        if edge_module:
            edge_info.mark_available()
            edge_info.busy = self._is_edge_tts_busy()
            state = "busy" if edge_info.busy else "idle"
            ColorPrint.green(f"[ProviderStatus] ✓ edge-tts available ({state})")
        else:
            error_msg = "edge-tts not installed"
            edge_info.mark_unavailable(error_msg)
            ColorPrint.yellow(f"[ProviderStatus] ✗ edge-tts unavailable: {error_msg}")

        # Azure TTS availability via SDK import
        speechsdk = get_third_package_speechsdk()
        azure_info = self._status['tts']['azure']
        blocked, blocked_error = is_tts_quota_blocked()
        if speechsdk and not blocked:
            azure_info.mark_available()
            azure_info.busy = self._is_azure_tts_busy()
            state = "busy" if azure_info.busy else "idle"
            ColorPrint.green(f"[ProviderStatus] ✓ Azure TTS SDK available ({state})")
        else:
            error_msg = blocked_error or "Azure Speech SDK not available"
            azure_info.mark_unavailable(error_msg)
            ColorPrint.yellow(f"[ProviderStatus] ✗ Azure TTS unavailable: {error_msg}")

    def check_stt_providers(self):
        """
        Check availability of all STT providers

        This should be called at initialization to detect which providers are available.
        """
        ColorPrint.blue("[ProviderStatus] Checking STT providers...")

        # Whisper STT availability
        whisper_module = get_third_package_whisper()
        whisper_info = self._status['stt']['whisper']
        if whisper_module:
            whisper_info.mark_available()
            ColorPrint.green("[ProviderStatus] ✓ Whisper STT available")
        else:
            error_msg = "Whisper not installed"
            whisper_info.mark_unavailable(error_msg)
            ColorPrint.yellow(f"[ProviderStatus] ✗ Whisper STT unavailable: {error_msg}")

        # Azure STT availability
        speechsdk = get_third_package_speechsdk()
        blocked, blocked_error = is_stt_quota_blocked()
        if speechsdk and not blocked:
            self._status['stt']['azure'].mark_available()
            ColorPrint.green("[ProviderStatus] ✓ Azure STT SDK available")
        else:
            error_msg = blocked_error or "Azure Speech SDK not available"
            self._status['stt']['azure'].mark_unavailable(error_msg)
            ColorPrint.yellow(f"[ProviderStatus] ✗ Azure STT unavailable: {error_msg}")

        # Local STT (Vosk) availability
        vosk_module = get_third_package_vosk()
        if vosk_module:
            self._status['stt']['local'].mark_available()
            ColorPrint.green("[ProviderStatus] ✓ Local STT (Vosk) available")
        else:
            error_msg = "Vosk not installed"
            self._status['stt']['local'].mark_unavailable(error_msg)
            ColorPrint.yellow(f"[ProviderStatus] ✗ Local STT unavailable: {error_msg}")

    def check_all_providers(self):
        """Check all providers (TTS + STT)"""
        self.check_tts_providers()
        self.check_stt_providers()
        self._initialized = True

    def _is_edge_tts_busy(self) -> bool:
        try:
            client = get_edge_tts_client()
            return client.is_busy()
        except Exception:
            return False

    def _is_azure_tts_busy(self) -> bool:
        try:
            client = get_azure_speech_client()
            return client.is_busy()
        except Exception:
            return False

    def mark_available(self, category: str, provider_name: str):
        """
        Mark provider as available

        Args:
            category: 'tts' or 'stt'
            provider_name: Provider identifier (e.g., 'edge', 'azure', 'local')
        """
        if category in self._status and provider_name in self._status[category]:
            info = self._status[category][provider_name]
            was_available = info.available

            info.mark_available()

            if not was_available:
                ColorPrint.green(f"[ProviderStatus] {category.upper()}/{provider_name} now available")
                self._notify_listeners(category, provider_name, True, None)

    def mark_unavailable(self, category: str, provider_name: str, error: str):
        """
        Mark provider as unavailable (called when provider fails)

        Args:
            category: 'tts' or 'stt'
            provider_name: Provider identifier (e.g., 'edge', 'azure', 'local')
            error: Error message explaining why provider is unavailable
        """
        if category in self._status and provider_name in self._status[category]:
            info = self._status[category][provider_name]
            was_available = info.available

            info.mark_unavailable(error)

            if was_available:
                ColorPrint.red(f"[ProviderStatus] {category.upper()}/{provider_name} now unavailable: {error}")
                self._notify_listeners(category, provider_name, False, error)

    def is_available(self, category: str, provider_name: str) -> bool:
        """
        Check if provider is available

        Args:
            category: 'tts' or 'stt'
            provider_name: Provider identifier

        Returns:
            True if provider is available, False otherwise
        """
        if category in self._status and provider_name in self._status[category]:
            return self._status[category][provider_name].available
        return False

    def get_provider_info(self, category: str, provider_name: str) -> Optional[ProviderInfo]:
        """
        Get detailed provider information

        Args:
            category: 'tts' or 'stt'
            provider_name: Provider identifier

        Returns:
            ProviderInfo object or None if not found
        """
        if category in self._status and provider_name in self._status[category]:
            return self._status[category][provider_name]
        return None

    def get_best_tts_provider(self) -> Optional[str]:
        """
        Get best available TTS provider

        Priority order: edge > azure

        Returns:
            Provider name or None if no providers available
        """
        for provider in ['edge', 'azure']:
            if self._status['tts'][provider].available:
                return provider
        return None

    def get_best_stt_provider(self) -> Optional[str]:
        """
        Get best available STT provider

        Priority order: whisper > azure > local

        Returns:
            Provider name or None if no providers available
        """
        for provider in ['whisper', 'azure', 'local']:
            if self._status['stt'][provider].available:
                return provider
        return None

    def get_all_status(self) -> Dict:
        """
        Get status of all providers

        Returns:
            Dict with full status information
        """
        result = {}
        for category, providers in self._status.items():
            result[category] = {}
            for provider_name, info in providers.items():
                result[category][provider_name] = {
                    'available': info.available,
                    'error': info.error,
                    'last_check': info.last_check.isoformat() if info.last_check else None,
                    'last_success': info.last_success.isoformat() if info.last_success else None,
                    'last_failure': info.last_failure.isoformat() if info.last_failure else None,
                    'failure_count': info.failure_count,
                    'busy': info.busy,
                }
        return result

    def print_status(self):
        """Print status of all providers (for debugging)"""
        ColorPrint.blue("\n" + "="*70)
        ColorPrint.blue("Provider Status Summary")
        ColorPrint.blue("="*70)

        for category, providers in self._status.items():
            ColorPrint.yellow(f"\n{category.upper()} Providers:")
            for provider_name, info in providers.items():
                status_symbol = "✓" if info.available else "✗"
                status_color = ColorPrint.green if info.available else ColorPrint.red
                status_color(f"  {status_symbol} {provider_name:10s} - ", end="")
                if info.available:
                    busy_state = "busy" if info.busy else "idle"
                    print(f"Available ({busy_state}, last success: {info.last_success})")
                else:
                    print(f"Unavailable - {info.error}")
                    if info.failure_count > 0:
                        print(f"                  (failures: {info.failure_count}, last: {info.last_failure})")

        ColorPrint.blue("="*70 + "\n")


# Global singleton instance
_provider_status: Optional[ProviderStatus] = None


def get_provider_status() -> ProviderStatus:
    """Get global ProviderStatus singleton."""
    global _provider_status
    if _provider_status is None:
        _provider_status = ProviderStatus()
    return _provider_status


# Export
__all__ = [
    'ProviderStatus',
    'ProviderInfo',
    'get_provider_status'
]
