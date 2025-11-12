# -*- coding: utf-8 -*-
"""
Device Discovery - UDP Broadcast

UDP-based device discovery for real-time device detection.

Port: 5892 (UDP broadcast)

Features:
- Broadcast device info every 3 seconds
- Listen for other devices
- Maintain online device list
- Auto-remove offline devices (timeout: 15s)
"""

import socket
import json
import threading
import time
import uuid
from typing import Dict, List, Optional, Callable
from pathlib import Path

from .logging_config import setup_logging

logger = setup_logging(__name__)

DISCOVERY_PORT = 5892
BROADCAST_INTERVAL = 3  # seconds
DEVICE_TIMEOUT = 15  # seconds


class DeviceDiscoveryUDP:
    """
    UDP-based device discovery service.

    Broadcasts device info and listens for other devices on the network.
    """

    def __init__(self, http_port: int = 58923):
        """
        Initialize device discovery.

        Args:
            http_port: HTTP/WebSocket server port
        """
        self.http_port = http_port
        self.discovery_port = DISCOVERY_PORT

        # Generate unique device ID (persistent)
        self.device_id = self._get_or_create_device_id()

        # Device info
        self.hostname = socket.gethostname()
        self.local_ip = self._get_local_ip()

        # Device mode and status (will be updated externally)
        self.mode = None  # 'primary' or 'secondary'
        self.sync_enabled = False

        # Online devices: {device_id: device_info}
        self.online_devices: Dict[str, Dict] = {}
        self.devices_lock = threading.Lock()

        # Sockets
        self.broadcast_socket: Optional[socket.socket] = None
        self.listen_socket: Optional[socket.socket] = None

        # Threads
        self.broadcast_thread: Optional[threading.Thread] = None
        self.listen_thread: Optional[threading.Thread] = None
        self.cleanup_thread: Optional[threading.Thread] = None

        # Running state
        self.running = False

        # Callbacks
        self.on_device_online: Optional[Callable] = None
        self.on_device_offline: Optional[Callable] = None
        self.on_device_updated: Optional[Callable] = None

    def start(self):
        """Start discovery service."""
        if self.running:
            return

        logger.info(f"Starting device discovery on port {self.discovery_port}")
        logger.info(f"Device ID: {self.device_id}")
        logger.info(f"Hostname: {self.hostname}")
        logger.info(f"IP: {self.local_ip}")

        self.running = True

        # Start broadcast thread
        self.broadcast_thread = threading.Thread(
            target=self._broadcast_loop,
            daemon=True,
            name="DeviceDiscovery-Broadcast"
        )
        self.broadcast_thread.start()

        # Start listen thread
        self.listen_thread = threading.Thread(
            target=self._listen_loop,
            daemon=True,
            name="DeviceDiscovery-Listen"
        )
        self.listen_thread.start()

        # Start cleanup thread
        self.cleanup_thread = threading.Thread(
            target=self._cleanup_loop,
            daemon=True,
            name="DeviceDiscovery-Cleanup"
        )
        self.cleanup_thread.start()

        logger.info("Device discovery started")

    def stop(self):
        """Stop discovery service."""
        logger.info("Stopping device discovery...")
        self.running = False

        # Close sockets
        if self.broadcast_socket:
            try:
                self.broadcast_socket.close()
            except Exception:
                pass

        if self.listen_socket:
            try:
                self.listen_socket.close()
            except Exception:
                pass

        logger.info("Device discovery stopped")

    def update_status(self, mode: str, sync_enabled: bool):
        """
        Update device status (called externally).

        Args:
            mode: 'primary' or 'secondary'
            sync_enabled: Whether sync is enabled
        """
        self.mode = mode
        self.sync_enabled = sync_enabled

    def get_online_devices(self) -> List[Dict]:
        """
        Get list of all online devices.

        Returns:
            List of device info dicts
        """
        with self.devices_lock:
            return list(self.online_devices.values())

    def get_primary_devices(self) -> List[Dict]:
        """
        Get list of primary devices.

        Returns:
            List of primary device info
        """
        with self.devices_lock:
            return [
                d for d in self.online_devices.values()
                if d.get('mode') == 'primary'
            ]

    def _broadcast_loop(self):
        """Broadcast device info loop."""
        # Create UDP broadcast socket
        self.broadcast_socket = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        self.broadcast_socket.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)

        logger.info("Broadcast loop started")

        while self.running:
            try:
                # Build device info
                device_info = {
                    'device_id': self.device_id,
                    'hostname': self.hostname,
                    'ip': self.local_ip,
                    'mode': self.mode,
                    'http_port': self.http_port,
                    'ws_port': self.http_port,
                    'sync_enabled': self.sync_enabled,
                    'timestamp': time.time()
                }

                # Serialize to JSON
                message = json.dumps(device_info).encode('utf-8')

                # Broadcast to network
                self.broadcast_socket.sendto(
                    message,
                    ('<broadcast>', self.discovery_port)
                )

                logger.debug(f"Broadcasted device info: {device_info}")

            except Exception as e:
                if self.running:
                    logger.error(f"Broadcast error: {e}", exc_info=True)

            # Sleep until next broadcast
            time.sleep(BROADCAST_INTERVAL)

    def _listen_loop(self):
        """Listen for device broadcasts."""
        # Create UDP listen socket
        self.listen_socket = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        self.listen_socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        self.listen_socket.bind(('', self.discovery_port))
        self.listen_socket.settimeout(1.0)

        logger.info("Listen loop started")

        while self.running:
            try:
                data, addr = self.listen_socket.recvfrom(4096)
                device_info = json.loads(data.decode('utf-8'))

                # Ignore own broadcasts
                if device_info.get('device_id') == self.device_id:
                    continue

                # Update device info
                device_id = device_info.get('device_id')
                if not device_id:
                    continue

                # Add last seen timestamp
                device_info['last_seen'] = time.time()

                # Update device list
                with self.devices_lock:
                    is_new = device_id not in self.online_devices
                    self.online_devices[device_id] = device_info

                # Trigger callbacks
                if is_new:
                    logger.info(f"Device online: {device_info.get('hostname')} ({device_info.get('ip')})")
                    if self.on_device_online:
                        try:
                            self.on_device_online(device_info)
                        except Exception as e:
                            logger.error(f"Callback error: {e}")
                else:
                    if self.on_device_updated:
                        try:
                            self.on_device_updated(device_info)
                        except Exception as e:
                            logger.error(f"Callback error: {e}")

            except socket.timeout:
                continue
            except Exception as e:
                if self.running:
                    logger.error(f"Listen error: {e}", exc_info=True)

    def _cleanup_loop(self):
        """Remove offline devices (timeout check)."""
        logger.info("Cleanup loop started")

        while self.running:
            try:
                current_time = time.time()
                offline_devices = []

                with self.devices_lock:
                    for device_id, device_info in list(self.online_devices.items()):
                        last_seen = device_info.get('last_seen', 0)
                        if current_time - last_seen > DEVICE_TIMEOUT:
                            offline_devices.append(device_id)
                            del self.online_devices[device_id]

                # Trigger offline callbacks
                for device_id in offline_devices:
                    logger.info(f"Device offline: {device_id}")
                    if self.on_device_offline:
                        try:
                            self.on_device_offline({'device_id': device_id})
                        except Exception as e:
                            logger.error(f"Callback error: {e}")

            except Exception as e:
                logger.error(f"Cleanup error: {e}", exc_info=True)

            # Sleep 5 seconds
            time.sleep(5)

    def _get_local_ip(self) -> str:
        """Get local IP address."""
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.settimeout(1)
            s.connect(('8.8.8.8', 80))
            local_ip = s.getsockname()[0]
            s.close()
            return local_ip
        except Exception:
            try:
                return socket.gethostbyname(self.hostname)
            except Exception:
                return '127.0.0.1'

    def _get_or_create_device_id(self) -> str:
        """Get or create persistent device ID."""
        device_id_file = Path.home() / '.device_sync' / 'device_id.txt'
        device_id_file.parent.mkdir(parents=True, exist_ok=True)

        if device_id_file.exists():
            try:
                return device_id_file.read_text().strip()
            except Exception:
                pass

        # Generate new ID
        device_id = str(uuid.uuid4())
        try:
            device_id_file.write_text(device_id)
        except Exception as e:
            logger.warning(f"Failed to save device ID: {e}")

        return device_id
