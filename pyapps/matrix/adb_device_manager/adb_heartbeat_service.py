#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ADB Heartbeat Service - PyHeartbeat Driven Edition

No longer a Thread. Driven by PyHeartbeat periodic tasks.
Uses ENCYCLOPEDIA for busy state management.
"""

import time
import threading
from typing import Optional, List
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.tasks import Task
from pycore.pyfoundations.pybasecommon.encyclopedia import ENCYCLOPEDIA
from pyapps.matrix.adb_device_manager.adb_executor import adb_executor, ADBExecutor
from pyapps.matrix.adb_device_manager.device_table import device_table, DeviceTable, DeviceInfo, DeviceState, DeviceType
from pyapps.matrix.adb_device_manager.network_scanner import network_scanner, NetworkScanner
from pyapps.matrix.adb_device_manager.usb_monitor import get_usb_monitor
from pyapps.matrix.services.device_id_manager import DeviceIDManager
from pycore.pyutils.device.device_manager import device_manager, DeviceManager


class ADBHeartbeatService:
    """
    ADB Device Management Service - PyHeartbeat Driven

    No longer a standalone thread. Receives tasks from PyHeartbeat:
    - adb.network_scan: Scan network for devices
    - adb.usb_scan: Scan USB devices
    - adb.cleanup: Clean up stale devices
    - adb.heartbeat: Update device heartbeats
    - adb.push_devices: Push device list to clients

    Uses ENCYCLOPEDIA for busy state management.
    """

    def __init__(self, adb_path: str = "adb"):
        """
        Initialize ADB heartbeat service

        Args:
            adb_path: Path to adb executable
        """
        # ✅ Set global ADB path (must be set before use)
        from pyapps.matrix.adb_device_manager.adb_executor import set_adb_path
        set_adb_path(adb_path)

        # ✅ Use globally exported instances (module-level singletons)
        self.device_table = device_table
        self.adb = adb_executor
        self.network_scanner = network_scanner
        self.usb_monitor = get_usb_monitor()

        self.rpc_server = None
        self._start_time = time.time()
        self._task_count = {}

        # ✅ 并发控制：最多3个设备同时连接
        self.connection_semaphore = threading.Semaphore(3)
        self.connection_threads: List[threading.Thread] = []

        ColorPrint.green("[ADBHeartbeatService] Initialized (PyHeartbeat driven)")
        ColorPrint.blue("[ADBHeartbeatService] Concurrent device connection limit: 3")

    def set_rpc_server(self, rpc_server):
        """
        Attach RPC server for device push notifications

        Args:
            rpc_server: RPC v2 server instance
        """
        self.rpc_server = rpc_server
        ColorPrint.green("[ADBHeartbeatService] RPC server attached")

    def handle_task(self, task: Task) -> bool:
        """
        Handle ADB task from PyHeartbeat

        Args:
            task: Task instance

        Returns:
            True if task accepted and processed
        """
        task_type = task.task_type

        # Check if service is busy
        busy_key = f"adb_service.{task_type}.busy"
        if ENCYCLOPEDIA.get(busy_key, False):
            ColorPrint.yellow(f"[ADBService] Busy, skipping {task_type}")
            return False

        # Mark as busy
        ENCYCLOPEDIA.add(busy_key, True)

        try:
            # Route task to handler
            if task_type == "adb.network_scan":
                self._network_scan_task()
            elif task_type == "adb.usb_scan":
                self._usb_scan_task()
            elif task_type == "adb.cleanup":
                self._cleanup_task()
            elif task_type == "adb.heartbeat":
                self._heartbeat_task()
            elif task_type == "adb.push_devices":
                self._push_device_updates()
            else:
                ColorPrint.yellow(f"[ADBService] Unknown task type: {task_type}")
                return False

            # Track task count
            self._task_count[task_type] = self._task_count.get(task_type, 0) + 1

            # Mark task as completed
            task.mark_completed()
            return True

        except Exception as e:
            ColorPrint.red(f"[ADBService] Error handling {task_type}: {e}")
            task.mark_failed(str(e))
            return False

        finally:
            # Clear busy flag
            ENCYCLOPEDIA.add(busy_key, False)

    def _connect_device_with_limit(self, ip: str):
        """
        连接单个网络设备（带并发控制）

        Args:
            ip: 设备IP地址
        """
        # Import at function start to avoid UnboundLocalError
        from pycore.pyutils.device.device_manager import device_manager, DeviceState as DM_DeviceState
        from pyapps.matrix.services.device_id_manager import DeviceIDManager

        with self.connection_semaphore:  # 限制最多3个并发
            serial = f"{ip}:5555"

            try:
                # ✅ STEP 0: Check if device already exists in DeviceManager (skip if exists)
                if device_manager.get_device(serial):
                    ColorPrint.blue(f"[ADBService] Device {serial} already in DeviceManager, skipping scan")
                    return

                ColorPrint.blue(f"[ADBService] [STEP 1/6] Connecting to {serial}...")

                # 1. 连接设备
                if not self.adb.connect_wireless(ip, 5555):
                    ColorPrint.yellow(f"[ADBService] Failed to connect {serial}")
                    return

                ColorPrint.green(f"[ADBService] [STEP 1/6] ✓ Connected to network device: {serial}")

                # 2. ✅ 验证设备 online 状态（新增）
                ColorPrint.blue(f"[ADBService] [STEP 2/6] Verifying device online status for {serial}...")
                devices = self.adb.get_devices()
                device_state = next((state for s, state in devices if s == serial), None)

                if device_state != 'device':
                    ColorPrint.yellow(f"[ADBService] Device {serial} is not online (state: {device_state}), skipping")
                    return

                ColorPrint.green(f"[ADBService] [STEP 2/6] ✓ Device {serial} is online")

                # 3. ✅ 假设网络扫描到的设备都是 root（跳过检测）
                # Root 检测 (adb shell su -c id) 可能被 Magisk 阻塞，导致所有设备卡住
                # 对于已开启 5555 端口的设备，通常都是 root 设备（用户手动配置）
                ColorPrint.blue(f"[ADBService] [STEP 3/6] Assuming device is root (network scan), skipping su check...")
                is_root = True  # 假设所有网络扫描到的设备都是 root
                ColorPrint.green(f"[ADBService] [STEP 3/6] ✓ Device assumed as root (5555 port open)")

                # 4. 获取设备信息
                ColorPrint.blue(f"[ADBService] [STEP 4/6] Getting device info for {serial}...")
                device_info = self.adb.get_device_info(serial)
                ColorPrint.green(f"[ADBService] [STEP 4/6] ✓ Device info: model={device_info.get('model')}, android={device_info.get('android_version')}")

                # 5. 创建设备对象
                ColorPrint.blue(f"[ADBService] [STEP 5/6] Creating device object for {serial}...")
                device = DeviceInfo(
                    serial=serial,
                    device_type=DeviceType.ROOT if is_root else DeviceType.WIFI,
                    state=DeviceState.WIFI_CONNECTED,
                    ip_address=ip,
                    is_root=is_root,
                    model=device_info.get('model'),
                    android_version=device_info.get('android_version')
                )
                ColorPrint.green(f"[ADBService] [STEP 5/6] ✓ Device object created")

                # 6. 添加到设备表
                ColorPrint.blue(f"[ADBService] [STEP 6/6] Adding device to device table: {serial}...")
                added = self.device_table.add_device(device)
                if added:
                    # Register device with DeviceIDManager
                    device_id_manager = DeviceIDManager.instance()
                    device_id = device_id_manager.register_device(serial)

                    # ✅ CRITICAL: Also register in global DeviceManager's device_states
                    # This prevents VideoStreamHealth from logging "Device not in global DeviceManager" errors
                    # We add a minimal DeviceState entry so health checks can find the device
                    if serial not in device_manager.device_states:
                        minimal_state = DM_DeviceState(
                            serial=serial,
                            info=None,  # Will be populated when scrcpy connects
                            connected=False,  # Not scrcpy-connected yet
                            streaming=False,
                            controllable=False
                        )
                        device_manager.device_states[serial] = minimal_state
                        ColorPrint.blue(f"[ADBService] Registered {serial} in DeviceManager.device_states")

                    ColorPrint.green(f"[ADBService] [STEP 6/6] ✓ Device added: {serial} -> {device_id} (root={is_root})")
                else:
                    ColorPrint.yellow(f"[ADBService] [STEP 6/6] ✗ Failed to add device (already exists?): {serial}")

            except Exception as e:
                ColorPrint.red(f"[ADBService] ✗ Error connecting {serial}: {e}")
                import traceback
                traceback.print_exc()

    def _network_scan_task(self):
        """Network scan task"""
        ColorPrint.blue("[ADBService] Running network scan task...")

        found_ips = self.network_scanner.scan_network()

        if not found_ips:
            return

        existing_wifi_devices = {
            ADBExecutor.extract_ip_from_serial(d.serial)
            for d in self.device_table.get_wifi_devices()
            if d.ip_address
        }

        new_ips = [ip for ip in found_ips if ip not in existing_wifi_devices]

        if not new_ips:
            ColorPrint.blue("[ADBService] No new devices found in network scan")
            return

        ColorPrint.green(f"[ADBService] Found {len(new_ips)} new device(s) on network")

        # ✅ 使用线程并发连接（受 semaphore 限制，最多3个并发）
        for ip in new_ips:
            # 检查设备是否已存在
            serial = f"{ip}:5555"
            existing = self.device_table.get_device(serial)
            if existing:
                existing.update_heartbeat()
                continue

            # 创建线程连接设备
            thread = threading.Thread(
                target=self._connect_device_with_limit,
                args=(ip,),
                daemon=True,
                name=f"DeviceConnect-{ip}"
            )
            thread.start()
            self.connection_threads.append(thread)

        # 清理已完成的线程
        self.connection_threads = [t for t in self.connection_threads if t.is_alive()]

        if self.connection_threads:
            ColorPrint.blue(f"[ADBService] Active connection threads: {len(self.connection_threads)}")

    def _usb_scan_task(self):
        """USB scan task"""
        ColorPrint.blue("[ADBService] Running USB scan task...")

        results = self.usb_monitor.process_usb_devices()

        if not results:
            return

        # ✅ Register only newly converted USB devices (not all devices)
        from pyapps.matrix.services.device_id_manager import DeviceIDManager
        device_id_manager = DeviceIDManager.instance()
        for serial, success in results.items():
            if success:
                # Register converted device with DeviceIDManager
                device_id = device_id_manager.register_device(serial)
                ColorPrint.green(f"[ADBService] USB device {serial} converted to wireless -> {device_id}")
            else:
                ColorPrint.yellow(f"[ADBService] Failed to convert USB device {serial}")

    def _cleanup_task(self):
        """Cleanup task - removes stale devices and uncaches their IPs"""
        ColorPrint.blue("[ADBService] Running cleanup task...")

        # Get stale devices before removing (to uncache their IPs)
        stale_devices = self.device_table.get_stale_devices(timeout=120.0)

        # Remove stale devices from table
        removed = self.device_table.cleanup_stale_devices(timeout=120.0)

        if removed > 0:
            ColorPrint.yellow(f"[ADBService] Cleaned up {removed} stale device(s)")

            # ✅ Uncache IPs of removed devices (allow re-scanning)
            for device in stale_devices:
                ip = ADBExecutor.extract_ip_from_serial(device.serial)
                if ip:
                    self.network_scanner.uncache_ip(ip)

        stats = self.device_table.get_stats()
        ColorPrint.blue(f"[ADBService] Device stats: {stats['total_devices']} total, "
                       f"{stats['usb_devices']} USB, {stats['wifi_devices']} WiFi, "
                       f"{stats['root_devices']} Root")

    def _heartbeat_task(self):
        """Heartbeat task"""
        devices = self.adb.get_devices()
        serials = {serial for serial, state in devices if state == 'device'}

        for device in self.device_table.get_all_devices():
            if device.serial in serials:
                device.update_heartbeat()

                if device.state == DeviceState.DISCONNECTED:
                    if device.device_type == DeviceType.USB:
                        self.device_table.update_device_state(device.serial, DeviceState.USB_CONNECTED)
                    elif device.device_type in (DeviceType.WIFI, DeviceType.ROOT):
                        self.device_table.update_device_state(device.serial, DeviceState.WIFI_CONNECTED)

    def _push_device_updates(self):
        """Push device updates to all WebSocket clients via RPC v2"""
        if not self.rpc_server:
            return

        device_table = self.device_table
        all_devices = device_table.get_all_devices()

        # Register all devices with DeviceIDManager and include deviceId in response
        from pyapps.matrix.services.device_id_manager import DeviceIDManager
        device_id_manager = DeviceIDManager.instance()

        devices_list = []
        for device_info in all_devices:
            device_id = device_id_manager.register_device(device_info.serial)
            devices_list.append({
                "deviceId": device_id,  # Primary ID for frontend use
                "serial": device_info.serial,
                "ip": device_info.ip_address,
                "connection_type": device_info.device_type.value,
                "state": device_info.state.value,
                "is_root": device_info.is_root,
                "model": device_info.model,
                "android_version": device_info.android_version,
                "last_seen": device_info.last_seen,
                "connected_at": device_info.first_seen,
            })

        stats = device_table.get_stats()
        payload = {
            "devices": devices_list,
            "count": len(devices_list),
            "stats": stats,
            "timestamp": int(time.time() * 1000)
        }

        # Use synchronous wrapper to broadcast from non-async context
        # Note: broadcast_event_sync() will silently return if event loop is not ready yet
        # (i.e., before first WebSocket client connects)
        self.rpc_server.broadcast_event_sync(
            event_name="adb.devices.update",
            data=payload
        )

    def get_stats(self) -> dict:
        """Get service statistics"""
        uptime = time.time() - self._start_time

        return {
            'uptime': uptime,
            'task_counts': self._task_count,
            'device_table': self.device_table.get_stats()
        }

    def get_device_table(self) -> DeviceTable:
        """Get device table instance"""
        return self.device_table

    def get_adb_executor(self) -> ADBExecutor:
        """Get ADB executor instance"""
        return self.adb


# Global instance
_adb_heartbeat_service: Optional[ADBHeartbeatService] = None


def get_adb_heartbeat_service() -> Optional[ADBHeartbeatService]:
    """Get global ADB heartbeat service instance"""
    return _adb_heartbeat_service


def init_adb_heartbeat_service(adb_path: str = "adb") -> ADBHeartbeatService:
    """
    Initialize ADB heartbeat service

    Args:
        adb_path: Path to adb executable

    Returns:
        ADBHeartbeatService instance
    """
    global _adb_heartbeat_service

    if _adb_heartbeat_service is None:
        _adb_heartbeat_service = ADBHeartbeatService(adb_path=adb_path)

    return _adb_heartbeat_service
