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

import threading
import time
from typing import Dict, Optional, Callable, List
from dataclasses import dataclass, field
from datetime import datetime

from pycore.pyfoundations import ColorPrint


@dataclass
class ProviderInfo:
    """Information about a single provider"""
    available: bool = False
    error: Optional[str] = None
    last_check: Optional[datetime] = None
    last_success: Optional[datetime] = None
    last_failure: Optional[datetime] = None
    failure_count: int = 0

    def mark_available(self):
        """Mark provider as available"""
        self.available = True
        self.error = None
        self.last_check = datetime.now()
        self.last_success = datetime.now()
        self.failure_count = 0

    def mark_unavailable(self, error: str):
        """Mark provider as unavailable"""
        self.available = False
        self.error = error
        self.last_check = datetime.now()
        self.last_failure = datetime.now()
        self.failure_count += 1


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
        self._lock = threading.RLock()

        # Provider status storage
        self._status: Dict[str, Dict[str, ProviderInfo]] = {
            'tts': {
                'edge': ProviderInfo(),
                'azure': ProviderInfo()
            },
            'stt': {
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
        with self._lock:
            if callback not in self._listeners:
                self._listeners.append(callback)

    def remove_listener(self, callback: Callable):
        """Remove status change listener"""
        with self._lock:
            if callback in self._listeners:
                self._listeners.remove(callback)

    def _notify_listeners(self, category: str, provider_name: str, available: bool, error: Optional[str]):
        """Notify all listeners of status change"""
        with self._lock:
            listeners = self._listeners.copy()

        for listener in listeners:
            try:
                listener(category, provider_name, available, error)
            except Exception as e:
                ColorPrint.red(f"[ProviderStatus] Listener error: {e}")

    def check_tts_providers(self):
        """
        Check availability of all TTS providers

        This should be called at initialization to detect which providers are available.
        """
        with self._lock:
            ColorPrint.blue("[ProviderStatus] Checking TTS providers...")

            # Check edge-tts
            try:
                import edge_tts
                self._status['tts']['edge'].mark_available()
                ColorPrint.green("[ProviderStatus] ✓ edge-tts available")
            except Exception as e:
                error_msg = f"Import failed: {e}"
                self._status['tts']['edge'].mark_unavailable(error_msg)
                ColorPrint.yellow(f"[ProviderStatus] ✗ edge-tts unavailable: {error_msg}")

            # Check Azure TTS (basic import check)
            try:
                import azure.cognitiveservices.speech as speechsdk
                # Note: We can't verify API key here, so we mark as potentially available
                # Actual availability will be determined at runtime
                self._status['tts']['azure'].mark_available()
                ColorPrint.green("[ProviderStatus] ✓ Azure TTS SDK available")
            except Exception as e:
                error_msg = f"Import failed: {e}"
                self._status['tts']['azure'].mark_unavailable(error_msg)
                ColorPrint.yellow(f"[ProviderStatus] ✗ Azure TTS unavailable: {error_msg}")

    def check_stt_providers(self):
        """
        Check availability of all STT providers

        This should be called at initialization to detect which providers are available.
        """
        with self._lock:
            ColorPrint.blue("[ProviderStatus] Checking STT providers...")

            # Check Azure STT (basic import check)
            try:
                import azure.cognitiveservices.speech as speechsdk
                # Note: We can't verify API key here, so we mark as potentially available
                # Actual availability will be determined at runtime
                self._status['stt']['azure'].mark_available()
                ColorPrint.green("[ProviderStatus] ✓ Azure STT SDK available")
            except Exception as e:
                error_msg = f"Import failed: {e}"
                self._status['stt']['azure'].mark_unavailable(error_msg)
                ColorPrint.yellow(f"[ProviderStatus] ✗ Azure STT unavailable: {error_msg}")

            # Check local STT (Vosk or similar)
            try:
                # Try to import Vosk as example local provider
                import vosk
                self._status['stt']['local'].mark_available()
                ColorPrint.green("[ProviderStatus] ✓ Local STT (Vosk) available")
            except Exception as e:
                # Local STT not available, but this is not critical
                error_msg = f"Vosk not installed: {e}"
                self._status['stt']['local'].mark_unavailable(error_msg)
                ColorPrint.yellow(f"[ProviderStatus] ✗ Local STT unavailable: {error_msg}")

    def check_all_providers(self):
        """Check all providers (TTS + STT)"""
        self.check_tts_providers()
        self.check_stt_providers()
        self._initialized = True

    def mark_available(self, category: str, provider_name: str):
        """
        Mark provider as available

        Args:
            category: 'tts' or 'stt'
            provider_name: Provider identifier (e.g., 'edge', 'azure', 'local')
        """
        with self._lock:
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
        with self._lock:
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
        with self._lock:
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
        with self._lock:
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
        with self._lock:
            # Try providers in priority order
            for provider in ['edge', 'azure']:
                if self._status['tts'][provider].available:
                    return provider
            return None

    def get_best_stt_provider(self) -> Optional[str]:
        """
        Get best available STT provider

        Priority order: azure > local

        Returns:
            Provider name or None if no providers available
        """
        with self._lock:
            # Try providers in priority order
            for provider in ['azure', 'local']:
                if self._status['stt'][provider].available:
                    return provider
            return None

    def get_all_status(self) -> Dict:
        """
        Get status of all providers

        Returns:
            Dict with full status information
        """
        with self._lock:
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
                        'failure_count': info.failure_count
                    }
            return result

    def print_status(self):
        """Print status of all providers (for debugging)"""
        ColorPrint.blue("\n" + "="*70)
        ColorPrint.blue("Provider Status Summary")
        ColorPrint.blue("="*70)

        with self._lock:
            for category, providers in self._status.items():
                ColorPrint.yellow(f"\n{category.upper()} Providers:")
                for provider_name, info in providers.items():
                    status_symbol = "✓" if info.available else "✗"
                    status_color = ColorPrint.green if info.available else ColorPrint.red

                    status_color(f"  {status_symbol} {provider_name:10s} - ", end="")
                    if info.available:
                        print(f"Available (last success: {info.last_success})")
                    else:
                        print(f"Unavailable - {info.error}")
                        if info.failure_count > 0:
                            print(f"                  (failures: {info.failure_count}, last: {info.last_failure})")

        ColorPrint.blue("="*70 + "\n")


# Global singleton instance
_provider_status: Optional[ProviderStatus] = None
_provider_status_lock = threading.Lock()


def get_provider_status() -> ProviderStatus:
    """
    Get global ProviderStatus singleton

    Returns:
        ProviderStatus instance
    """
    global _provider_status

    if _provider_status is None:
        with _provider_status_lock:
            if _provider_status is None:
                _provider_status = ProviderStatus()

    return _provider_status


# Export
__all__ = [
    'ProviderStatus',
    'ProviderInfo',
    'get_provider_status'
]
