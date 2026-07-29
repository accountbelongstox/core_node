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
import time
import uuid
from typing import Any, Dict, List, Optional, Callable
from pathlib import Path
from pycore.pyfoundations.serialized_worker import (
    init_serialized_owner,
    serialized_method,
    start_bus_task,
)
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS

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
        init_serialized_owner(self, "device_sync.udp_discovery", "UDPDiscoveryState")

        # Sockets
        self.broadcast_socket: Optional[socket.socket] = None
        self.listen_socket: Optional[socket.socket] = None

        # Threads
        self.broadcast_thread: Optional[Any] = None
        self.listen_thread: Optional[Any] = None
        self.cleanup_thread: Optional[Any] = None

        # Running state
        self.running = False
        self._running_signal = f"device_sync.udp_discovery.running.{id(self)}"
        THREAD_BUS.signal(self._running_signal, False)

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
        THREAD_BUS.signal(self._running_signal, True)

        # Start broadcast thread
        self.broadcast_thread = start_bus_task(
            self._broadcast_loop,
            thread_name="DeviceDiscovery-Broadcast",
        )

        # Start listen thread
        self.listen_thread = start_bus_task(
            self._listen_loop,
            thread_name="DeviceDiscovery-Listen",
        )

        # Start cleanup thread
        self.cleanup_thread = start_bus_task(
            self._cleanup_loop,
            thread_name="DeviceDiscovery-Cleanup",
        )

        logger.info("Device discovery started")

    def stop(self):
        """Stop discovery service."""
        logger.info("Stopping device discovery...")
        self.running = False
        THREAD_BUS.signal(self._running_signal, False)

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

    @serialized_method
    def update_status(self, mode: str, sync_enabled: bool):
        """
        Update device status (called externally).

        Args:
            mode: 'primary' or 'secondary'
            sync_enabled: Whether sync is enabled
        """
        self.mode = mode
        self.sync_enabled = sync_enabled

    @serialized_method
    def get_online_devices(self) -> List[Dict]:
        """
        Get list of all online devices.

        Returns:
            List of device info dicts
        """
        return list(self.online_devices.values())

    @serialized_method
    def get_primary_devices(self) -> List[Dict]:
        """
        Get list of primary devices.

        Returns:
            List of primary device info
        """
        return [
            d for d in self.online_devices.values()
            if d.get('mode') == 'primary'
        ]

    def _broadcast_loop(self):
        """Broadcast device info loop."""
        # Create UDP broadcast socket
        self.broadcast_socket = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        self.broadcast_socket.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)

        # Calculate directed broadcast address for local network
        broadcast_addr = self._get_broadcast_address()
        logger.info(f"Broadcast loop started, using broadcast address: {broadcast_addr}")

        while THREAD_BUS.get_signal(self._running_signal, False):
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

                # Broadcast to network using directed broadcast address
                self.broadcast_socket.sendto(
                    message,
                    (broadcast_addr, self.discovery_port)
                )

                logger.debug(f"Broadcasted device info to {broadcast_addr}: {device_info}")

            except Exception as e:
                if THREAD_BUS.get_signal(self._running_signal, False):
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

        while THREAD_BUS.get_signal(self._running_signal, False):
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
                is_new = self._record_device(device_id, device_info)

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
                if THREAD_BUS.get_signal(self._running_signal, False):
                    logger.error(f"Listen error: {e}", exc_info=True)

    def _cleanup_loop(self):
        """Remove offline devices (timeout check)."""
        logger.info("Cleanup loop started")

        while THREAD_BUS.get_signal(self._running_signal, False):
            try:
                current_time = time.time()
                offline_devices = self._remove_offline_devices(current_time)

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

    @serialized_method
    def _record_device(self, device_id: str, device_info: Dict) -> bool:
        is_new = device_id not in self.online_devices
        self.online_devices[device_id] = device_info
        return is_new

    @serialized_method
    def _remove_offline_devices(self, current_time: float) -> List[str]:
        offline_devices = []
        for device_id, device_info in list(self.online_devices.items()):
            last_seen = device_info.get('last_seen', 0)
            if current_time - last_seen > DEVICE_TIMEOUT:
                offline_devices.append(device_id)
                del self.online_devices[device_id]
        return offline_devices

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

    def _get_broadcast_address(self) -> str:
        """
        Calculate directed broadcast address for local network.

        For IP 192.168.50.22 with /24 subnet, returns 192.168.50.255
        This ensures broadcasts reach all devices on the same subnet.

        Returns:
            Broadcast address string (e.g., '192.168.50.255')
        """
        try:
            ip = self.local_ip

            # Parse IP address
            ip_parts = ip.split('.')
            if len(ip_parts) != 4:
                logger.warning(f"Invalid IP format: {ip}, using limited broadcast")
                return '255.255.255.255'

            # Assume /24 subnet (most common for home/office networks)
            # For 192.168.50.22, broadcast is 192.168.50.255
            broadcast = f"{ip_parts[0]}.{ip_parts[1]}.{ip_parts[2]}.255"

            logger.info(f"Calculated broadcast address: {broadcast} for IP: {ip}")
            return broadcast

        except Exception as e:
            logger.error(f"Failed to calculate broadcast address: {e}", exc_info=True)
            return '255.255.255.255'  # Fallback to limited broadcast

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
