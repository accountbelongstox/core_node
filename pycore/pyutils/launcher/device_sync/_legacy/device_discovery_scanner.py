# -*- coding: utf-8 -*-
"""
Device Discovery - TCP Scanner Based

使用TCP端口扫描替代UDP广播的设备发现机制

Features:
- 定期扫描局域网（每30秒）
- 通过HTTP端口探测发现设备
- 维护在线设备列表
- 提供与UDP版本相同的接口
"""

import socket
import time
import uuid
from contextlib import nullcontext
from typing import Any, Dict, List, Optional, Callable
from pathlib import Path
from pycore.pyfoundations.serialized_worker import (
    init_serialized_owner,
    serialized_method,
    start_bus_task,
)
from pycore.pyfoundations.thread_bus import THREAD_BUS

from .simple_device_scanner import SimpleDeviceScanner
from .logging_config import setup_logging

logger = setup_logging(__name__)

SCAN_INTERVAL = 30  # 扫描间隔（秒）
DEVICE_TIMEOUT = 90  # 设备超时（秒）


class DeviceDiscoveryScanner:
    """
    基于TCP扫描的设备发现服务

    Usage:
        discovery = DeviceDiscoveryScanner()
        discovery.start()

        # Get devices
        devices = discovery.get_online_devices()
    """

    def __init__(self, http_port: int = 58923):
        """
        初始化设备发现

        Args:
            http_port: HTTP/WebSocket服务端口
        """
        self.http_port = http_port

        # 生成唯一设备ID（持久化）
        self.device_id = self._get_or_create_device_id()

        # 设备信息
        self.hostname = socket.gethostname()
        self.local_ip = self._get_local_ip()

        # 设备模式和状态（外部更新）
        self.mode = None  # 'primary' or 'secondary'
        self.sync_enabled = False

        # 在线设备列表
        self.online_devices: Dict[str, Dict] = {}
        self.devices_scope = nullcontext()
        init_serialized_owner(self, "device_sync.discovery_scanner", "DiscoveryScannerState")

        # 扫描器
        self.scanner = SimpleDeviceScanner(port=http_port)

        # 扫描线程
        self.scan_thread: Optional[Any] = None
        self.cleanup_thread: Optional[Any] = None

        # 运行状态
        self.running = False
        self._running_signal = f"device_sync.discovery_scanner.running.{id(self)}"
        THREAD_BUS.signal(self._running_signal, False)

        # 回调函数
        self.on_device_online: Optional[Callable] = None
        self.on_device_offline: Optional[Callable] = None
        self.on_device_updated: Optional[Callable] = None

    def start(self):
        """启动设备发现服务"""
        if self.running:
            return

        logger.info(f"Starting device discovery (Scanner mode)")
        logger.info(f"Device ID: {self.device_id}")
        logger.info(f"Hostname: {self.hostname}")
        logger.info(f"IP: {self.local_ip}")
        logger.info(f"Scan interval: {SCAN_INTERVAL}s")

        self.running = True
        THREAD_BUS.signal(self._running_signal, True)

        # 启动扫描线程
        self.scan_thread = start_bus_task(
            self._scan_loop,
            thread_name="DeviceDiscovery-Scanner",
        )

        # 启动清理线程
        self.cleanup_thread = start_bus_task(
            self._cleanup_loop,
            thread_name="DeviceDiscovery-Cleanup",
        )

        logger.info("Device discovery started")

    def stop(self):
        """停止设备发现服务"""
        logger.info("Stopping device discovery...")
        self.running = False
        THREAD_BUS.signal(self._running_signal, False)
        logger.info("Device discovery stopped")

    @serialized_method
    def update_status(self, mode: str, sync_enabled: bool):
        """
        更新设备状态（外部调用）

        Args:
            mode: 'primary' or 'secondary'
            sync_enabled: 是否启用同步
        """
        self.mode = mode
        self.sync_enabled = sync_enabled

    @serialized_method
    def get_online_devices(self) -> List[Dict]:
        """
        获取在线设备列表

        Returns:
            设备信息字典列表
        """
        with self.devices_scope:
            return list(self.online_devices.values())

    @serialized_method
    def get_primary_devices(self) -> List[Dict]:
        """
        获取PRIMARY设备列表

        Returns:
            PRIMARY设备列表
        """
        with self.devices_scope:
            return [
                d for d in self.online_devices.values()
                if d.get('mode') == 'primary'
            ]

    def _scan_loop(self):
        """扫描循环"""
        logger.info("Scan loop started")

        # 首次启动立即扫描
        self._perform_scan()

        while THREAD_BUS.get_signal(self._running_signal, False):
            # 等待扫描间隔
            time.sleep(SCAN_INTERVAL)

            if not THREAD_BUS.get_signal(self._running_signal, False):
                break

            # 执行扫描
            self._perform_scan()

    @serialized_method
    def _perform_scan(self):
        """执行一次网络扫描"""
        try:
            logger.info("Scanning network for devices...")
            start_time = time.time()

            # 扫描设备
            devices = self.scanner.scan_all_devices()

            elapsed = time.time() - start_time
            logger.info(f"Scan complete: Found {len(devices)} device(s) in {elapsed:.2f}s")

            # 更新设备列表
            current_time = time.time()

            with self.devices_scope:
                # 记录当前扫描到的设备ID
                scanned_device_ids = set()

                for device in devices:
                    device_id = device['device_id']

                    # Skip self (don't add current device to online devices list)
                    if device_id == self.device_id:
                        logger.debug(f"Skipping self device: {device['hostname']}")
                        continue

                    scanned_device_ids.add(device_id)

                    # Update last_seen time
                    device['last_seen'] = current_time

                    # Check if new device
                    is_new = device_id not in self.online_devices

                    # Update device info
                    self.online_devices[device_id] = device

                    # Trigger callbacks
                    if is_new:
                        logger.info(f"Device online: {device['hostname']} ({device['ip']})")
                        if self.on_device_online:
                            try:
                                self.on_device_online(device)
                            except Exception as e:
                                logger.error(f"Callback error: {e}")
                    else:
                        if self.on_device_updated:
                            try:
                                self.on_device_updated(device)
                            except Exception as e:
                                logger.error(f"Callback error: {e}")

        except Exception as e:
            logger.error(f"Scan error: {e}", exc_info=True)

    def _cleanup_loop(self):
        """清理超时设备"""
        logger.info("Cleanup loop started")

        while THREAD_BUS.get_signal(self._running_signal, False):
            try:
                current_time = time.time()
                offline_devices = self._remove_offline_devices(current_time)

                # 触发离线回调
                for device_id, device_info in offline_devices:
                    logger.info(f"Device offline (timeout): {device_info.get('hostname')} ({device_info.get('ip')})")
                    if self.on_device_offline:
                        try:
                            self.on_device_offline(device_info)
                        except Exception as e:
                            logger.error(f"Callback error: {e}")

            except Exception as e:
                logger.error(f"Cleanup error: {e}", exc_info=True)

            # 每30秒检查一次
            time.sleep(30)

    @serialized_method
    def _remove_offline_devices(self, current_time: float) -> List[tuple]:
        offline_devices = []
        for device_id, device_info in list(self.online_devices.items()):
            last_seen = device_info.get('last_seen', 0)
            if current_time - last_seen > DEVICE_TIMEOUT:
                offline_devices.append((device_id, device_info))
                del self.online_devices[device_id]
        return offline_devices

    def _get_local_ip(self) -> str:
        """获取本地IP地址"""
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
        """获取或创建持久化设备ID"""
        device_id_file = Path.home() / '.device_sync' / 'device_id.txt'
        device_id_file.parent.mkdir(parents=True, exist_ok=True)

        if device_id_file.exists():
            try:
                return device_id_file.read_text().strip()
            except Exception:
                pass

        # 生成新ID
        device_id = str(uuid.uuid4())
        try:
            device_id_file.write_text(device_id)
        except Exception as e:
            logger.warning(f"Failed to save device ID: {e}")

        return device_id
