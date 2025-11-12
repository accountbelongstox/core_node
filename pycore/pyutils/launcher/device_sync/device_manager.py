# -*- coding: utf-8 -*-
"""
Device Manager - Central Device Control

Manages device state, mode switching, and sync control.

Features:
- Mode switching (primary/secondary)
- Sync enable/disable with validation
- Primary device uniqueness validation
- Auto-close sync on mode switch
- WebSocket event broadcasting
"""

import asyncio
import threading
from typing import Optional, Callable, List, Dict
from pathlib import Path

from .device_discovery_udp import DeviceDiscoveryUDP
from .unified_server import UnifiedServer, DEFAULT_PORT
from .http_sync_client import HTTPFileSyncClient
from .logging_config import setup_logging
from .sync_history import (
    SyncHistoryTracker,
    record_mode_change,
    record_sync_enabled,
    record_sync_disabled,
    record_device_online,
    record_device_offline,
    record_conflict,
    record_primary_validation
)

logger = setup_logging(__name__)

DEFAULT_HTTP_PORT = DEFAULT_PORT


class DeviceManager:
    """
    Central device manager.

    Coordinates device discovery, WebSocket communication, and sync control.
    """

    def __init__(self, root_dir: str, http_port: int = DEFAULT_HTTP_PORT):
        """
        Initialize device manager.

        Args:
            root_dir: Root directory for file sync
            http_port: HTTP/WebSocket port
        """
        self.root_dir = Path(root_dir)
        self.http_port = http_port

        # Device state
        self.mode: Optional[str] = None  # 'primary' or 'secondary'
        self.sync_enabled = False

        # Components
        self.device_discovery = DeviceDiscoveryUDP(http_port=http_port)
        self.unified_server = UnifiedServer(port=http_port, root_dir=str(self.root_dir))
        self.http_client: Optional[HTTPFileSyncClient] = None

        # Sync history tracker
        self.history_tracker = SyncHistoryTracker()

        # Callbacks
        self.on_mode_changed: Optional[Callable] = None
        self.on_sync_changed: Optional[Callable] = None
        self.on_device_list_changed: Optional[Callable] = None
        self.on_conflict_detected: Optional[Callable] = None

        # Setup callbacks
        self._setup_callbacks()

    def start(self):
        """Start device manager."""
        logger.info("Starting device manager...")

        # Set device manager reference in unified server
        self.unified_server.device_manager = self

        # Start unified server (HTTP + WebSocket)
        self.unified_server.start()

        # Start device discovery
        self.device_discovery.start()

        logger.info("Device manager started")

    def stop(self):
        """Stop device manager."""
        logger.info("Stopping device manager...")

        # Stop device discovery
        self.device_discovery.stop()

        # Stop unified server
        self.unified_server.stop()

        # Stop sync client
        if self.http_client:
            self.http_client.stop_auto_sync()

        # Close history tracker (cleanup old records)
        if self.history_tracker:
            self.history_tracker.close()

        logger.info("Device manager stopped")

    def set_mode(self, mode: str):
        """
        Set device mode (auto-closes sync).

        Args:
            mode: 'primary' or 'secondary'
        """
        logger.info(f"Setting mode to {mode}")

        # Auto-close sync
        if self.sync_enabled:
            logger.info("Auto-closing sync due to mode switch")
            self.disable_sync(reason="Mode switch")

        # Update mode
        old_mode = self.mode
        self.mode = mode

        # Update discovery info
        self.device_discovery.update_status(mode, self.sync_enabled)

        # Broadcast mode change via WebSocket
        self._broadcast_status_change()

        # Record mode change to history
        record_mode_change(self.history_tracker, old_mode, mode)

        # Trigger callback
        if self.on_mode_changed:
            try:
                self.on_mode_changed(old_mode, mode)
            except Exception as e:
                logger.error(f"Callback error: {e}", exc_info=True)

        logger.info(f"Mode set to {mode}, sync disabled")

    def enable_sync(self) -> bool:
        """
        Enable file synchronization (validates primary uniqueness).

        Returns:
            True if enabled successfully, False if validation failed
        """
        logger.info("Enabling sync...")

        # Primary devices don't need sync (they serve files, not receive)
        if self.mode == 'primary':
            logger.warning("Primary devices cannot enable sync (they only serve files)")
            return False

        # Mode must be set
        if not self.mode:
            logger.error("Cannot enable sync: Mode not set")
            return False

        # Validate primary device uniqueness
        if not self._validate_primary_uniqueness():
            logger.error("Sync enable failed: Primary device validation failed")
            return False

        # Enable sync
        self.sync_enabled = True

        # Update discovery info
        self.device_discovery.update_status(self.mode, self.sync_enabled)

        # Start sync based on mode
        if self.mode == 'secondary':
            self._start_sync_client()

        # Broadcast sync change
        self._broadcast_status_change()

        # Record sync enabled to history
        record_sync_enabled(self.history_tracker, self.mode)

        # Trigger callback
        if self.on_sync_changed:
            try:
                self.on_sync_changed(True)
            except Exception as e:
                logger.error(f"Callback error: {e}", exc_info=True)

        logger.info("Sync enabled")
        return True

    def disable_sync(self, reason: str = "User request"):
        """
        Disable file synchronization.

        Args:
            reason: Reason for disabling sync (for history tracking)
        """
        logger.info("Disabling sync...")

        self.sync_enabled = False

        # Update discovery info
        self.device_discovery.update_status(self.mode, self.sync_enabled)

        # Stop sync client
        if self.http_client:
            self.http_client.disable_sync()

        # Broadcast sync change
        self._broadcast_status_change()

        # Record sync disabled to history
        record_sync_disabled(self.history_tracker, reason)

        # Trigger callback
        if self.on_sync_changed:
            try:
                self.on_sync_changed(False)
            except Exception as e:
                logger.error(f"Callback error: {e}", exc_info=True)

        logger.info("Sync disabled")

    def get_online_devices(self) -> List[Dict]:
        """Get list of all online devices."""
        return self.device_discovery.get_online_devices()

    def get_primary_count(self) -> int:
        """Get count of primary devices."""
        return len(self.device_discovery.get_primary_devices())

    def _validate_primary_uniqueness(self) -> bool:
        """
        Validate primary device uniqueness.

        Returns:
            True if validation passed
        """
        primary_devices = self.device_discovery.get_primary_devices()
        primary_count = len(primary_devices)

        logger.info(f"Primary device count: {primary_count}")

        if primary_count == 0:
            logger.error("No primary device found")
            record_primary_validation(self.history_tracker, False, primary_count)
            return False

        if primary_count > 1:
            logger.error(f"Multiple primary devices detected: {primary_count}")

            # Record conflict to history
            conflict_info = {
                'count': primary_count,
                'devices': primary_devices
            }
            record_conflict(self.history_tracker, conflict_info)

            # Trigger conflict callback
            if self.on_conflict_detected:
                try:
                    self.on_conflict_detected(conflict_info)
                except Exception as e:
                    logger.error(f"Callback error: {e}", exc_info=True)

            record_primary_validation(self.history_tracker, False, primary_count)
            return False

        logger.info("Primary device uniqueness validated")
        record_primary_validation(self.history_tracker, True, primary_count)
        return True

    def _start_sync_client(self):
        """Start HTTP sync client (for secondary mode)."""
        if not self.http_client:
            logger.info("Creating HTTP sync client")
            self.http_client = HTTPFileSyncClient(
                target_dir=str(self.root_dir)
            )

        # Discover primary device
        if not self.http_client.discover_primary():
            logger.warning("Failed to discover primary device")
            return

        # Enable sync
        self.http_client.enable_sync()
        logger.info("Sync client started")

    def _broadcast_status_change(self):
        """Broadcast status change via WebSocket."""
        if not self.unified_server or not self.unified_server.loop:
            return

        message = {
            'type': 'status_change',
            'device_id': self.device_discovery.device_id,
            'data': {
                'mode': self.mode,
                'sync_enabled': self.sync_enabled
            }
        }

        # Broadcast in server loop
        asyncio.run_coroutine_threadsafe(
            self.unified_server.broadcast(message),
            self.unified_server.loop
        )

    def _broadcast_device_list(self):
        """Broadcast device list update via WebSocket."""
        if not self.unified_server or not self.unified_server.loop:
            return

        devices = self.get_online_devices()

        message = {
            'type': 'device_list',
            'devices': devices
        }

        # Broadcast in server loop
        asyncio.run_coroutine_threadsafe(
            self.unified_server.broadcast(message),
            self.unified_server.loop
        )

    def _setup_callbacks(self):
        """Setup internal callbacks."""
        # Device discovery callbacks
        def on_device_online(device_info):
            logger.info(f"Device online: {device_info.get('hostname')}")
            record_device_online(self.history_tracker, device_info)
            self._broadcast_device_list()
            if self.on_device_list_changed:
                self.on_device_list_changed()

        def on_device_offline(device_info):
            logger.info(f"Device offline: {device_info.get('device_id')}")
            record_device_offline(self.history_tracker, device_info)
            self._broadcast_device_list()
            if self.on_device_list_changed:
                self.on_device_list_changed()

        def on_device_updated(device_info):
            logger.debug(f"Device updated: {device_info.get('hostname')}")
            self._broadcast_device_list()

        self.device_discovery.on_device_online = on_device_online
        self.device_discovery.on_device_offline = on_device_offline
        self.device_discovery.on_device_updated = on_device_updated
