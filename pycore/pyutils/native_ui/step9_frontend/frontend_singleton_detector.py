#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Frontend Singleton Detector

专门用于前端线程的单例检测和管理。
当新的前端启动时，通知旧的前端线程关闭，避免多个前端进程同时运行导致的端口冲突和资源浪费。

特点:
- 使用独立的端口范围 (55000-55099)，与主应用单例检测分开
- 当检测到旧前端时，发送 SHUTDOWN 消息
- 旧前端收到通知后，通过 THREAD_BUS 触发前端关闭事件
- 支持前端线程的单独退出（其他线程可能已经退出）

Usage:
    from pycore.pyutils.native_ui.step9_frontend.frontend_singleton_detector import FrontendSingletonDetector

    # 创建检测器
    detector = FrontendSingletonDetector(
        app_id="matrix_frontend",
        port_start=55000
    )

    # 检测并绑定（如果有旧实例会自动通知其关闭）
    result = detector.detect_and_bind(shutdown_existing=True)

    if result.is_primary:
        print("成为主前端实例")
        # 启动前端服务
    else:
        print("发现现有前端实例")
"""

# REUSE-TODO (deferred): FrontendSingletonDetector duplicates ~13/14 method
# names 1:1 with pycore.pylauncher.singleton_detector.SingletonDetector
# (_log/_create_message/_validate_message/_send_message_and_wait_response/
#  _try_connect_and_verify/_try_bind_port/detect_and_bind/_listener_loop/
#  _handle_client/stop/is_primary/get_port + own _send_shutdown_to_existing).
# The pylauncher detector was split into singleton_protocol.py (data layer) +
# singleton_server.py (_SingletonServerMixin) + singleton_detector.py
# (orchestrator) on 2026-07-09. Merging this frontend variant onto those
# shared components is the strongest reuse win but is cross-file + risky
# (different port range, FrontendDetectionResult, shutdown_existing default,
# no newest-wins ordering) -> deferred. When revisiting: subclass the
# SingletonDetector/_SingletonServerMixin or compose, and delete the local
# MessageType/FrontendDetectionResult duplicates in favor of
# pycore.pylauncher.singleton_protocol.

import os
import time
import socket
import json
import threading
from typing import Optional, Dict, Callable
from dataclasses import dataclass
from enum import Enum

from pycore import THREAD_BUS
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint

from pycore.pyutils.native_ui.step9_frontend.port_killer import kill_process_on_port



# ============================================================
# Protocol Definition
# ============================================================

class ProtocolVersion:
    """Protocol version identifier for frontend singleton"""
    CURRENT = "PYCORE_FRONTEND_SINGLETON_V1"


class MessageType(Enum):
    """Message types for frontend singleton communication"""
    CHECK = "CHECK"              # Check if frontend instance exists
    ALIVE = "ALIVE"              # Frontend alive response
    SHUTDOWN = "SHUTDOWN"        # Request frontend shutdown
    SHUTDOWN_ACK = "SHUTDOWN_ACK"  # Shutdown acknowledged
    PING = "PING"                # Keep-alive ping
    PONG = "PONG"                # Ping response


# ============================================================
# Detection Result
# ============================================================

@dataclass
class FrontendDetectionResult:
    """Result of frontend singleton detection"""
    is_primary: bool              # True if this is PRIMARY frontend instance
    port: int                     # Bound port number
    existing_instance: bool       # True if found existing frontend instance
    existing_port: Optional[int]  # Port of existing instance (if found)
    message: str                  # Human-readable message


# ============================================================
# Frontend Singleton Detector
# ============================================================

class FrontendSingletonDetector:
    """
    Frontend Singleton Detector

    专门用于前端线程的单例检测。使用独立的端口范围，避免与主应用冲突。

    检测逻辑:
    1. 从 port_start 开始扫描 (默认 55000)
    2. 尝试连接到端口:
       - 连接失败 → 端口可用 → 绑定端口 → 成为 PRIMARY
       - 连接成功 → 发送协议验证:
         * 协议正确 → 找到旧前端 → 发送 SHUTDOWN → 等待关闭 → 重试绑定
         * 协议错误 → 其他程序 → 尝试下一个端口
    3. 重复直到:
       - 找到可用端口 (成为 PRIMARY)
       - 找到旧实例并成功通知关闭 (成为 PRIMARY)
       - 超出端口范围 (失败)
    """

    def __init__(
        self,
        app_id: str,
        port_start: int = 55000,
        port_range: int = 100,
        timeout: float = 1.0,
        debug: bool = False,
        on_shutdown_request: Optional[Callable[[], None]] = None
    ):
        """
        Initialize Frontend Singleton Detector

        Args:
            app_id: Frontend application identifier
            port_start: Starting port for scanning (default: 55000)
            port_range: Number of ports to scan (default: 100)
            timeout: Connection timeout in seconds (default: 1.0)
            debug: Enable debug output
            on_shutdown_request: Optional callback when shutdown is requested
        """
        self.app_id = app_id
        self.port_start = port_start
        self.port_range = port_range
        self.timeout = timeout
        self.debug = debug or os.environ.get('FRONTEND_SINGLETON_DEBUG', '').lower() in ('1', 'true', 'yes')
        self.on_shutdown_request = on_shutdown_request

        # Runtime state
        self._is_primary = False
        self._bound_port: Optional[int] = None
        self._server_socket: Optional[socket.socket] = None
        self._running = False
        self._listener_thread: Optional[threading.Thread] = None

        if self.debug:
            ColorPrint.blue(f"[FrontendSingleton] Initialized for '{app_id}', port range {port_start}-{port_start + port_range - 1}")

    def _log(self, message: str, level: str = "INFO"):
        """Log message if debug enabled"""
        if self.debug or level in ["ERROR", "WARNING"]:
            timestamp = time.strftime('%Y-%m-%d %H:%M:%S')
            log_msg = f"[{timestamp}] [{level}] FrontendSingleton({self.app_id}): {message}"
            try:
                print(log_msg)
            except UnicodeEncodeError:
                print(log_msg.encode('ascii', errors='ignore').decode('ascii'))

    def _create_message(self, msg_type: MessageType, **kwargs) -> Dict:
        """Create protocol message"""
        return {
            "protocol": ProtocolVersion.CURRENT,
            "type": msg_type.value,
            "app_id": self.app_id,
            "pid": os.getpid(),
            "timestamp": time.time(),
            **kwargs
        }

    def _validate_message(self, message: Dict) -> bool:
        """Validate received message"""
        if not isinstance(message, dict):
            return False

        # Check protocol version
        if message.get("protocol") != ProtocolVersion.CURRENT:
            self._log(f"Protocol mismatch: {message.get('protocol')}", "WARNING")
            return False

        # Check app_id
        if message.get("app_id") != self.app_id:
            self._log(f"App ID mismatch: {message.get('app_id')}", "WARNING")
            return False

        return True

    def _send_message_and_wait_response(self, port: int, message: Dict) -> Optional[Dict]:
        """Send message to port and wait for response"""
        try:
            client_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            # Use longer timeout for SHUTDOWN
            timeout = 2.0 if message.get('type') == MessageType.SHUTDOWN.value else self.timeout
            client_socket.settimeout(timeout)
            client_socket.connect(('localhost', port))

            # Send message
            message_data = json.dumps(message).encode('utf-8')
            client_socket.sendall(message_data + b'\n')

            # Wait for response
            response_data = client_socket.recv(4096).decode('utf-8')
            client_socket.close()

            if not response_data:
                return None

            # Parse response
            response = json.loads(response_data.strip())

            # Validate
            if not self._validate_message(response):
                return None

            return response

        except (socket.timeout, ConnectionRefusedError):
            return None
        except Exception as e:
            self._log(f"Port {port}: Error - {e}", "ERROR")
            return None

    def _try_connect_and_verify(self, port: int) -> Optional[Dict]:
        """Try to connect to port and verify protocol"""
        self._log(f"Checking port {port}...")
        check_msg = self._create_message(MessageType.CHECK)
        response = self._send_message_and_wait_response(port, check_msg)

        if response:
            self._log(f"Port {port}: Found valid frontend instance (PID {response.get('pid')})")
        else:
            self._log(f"Port {port}: Not in use or no valid response")

        return response

    def _try_bind_port(self, port: int) -> bool:
        """Try to bind to port and start listener"""
        try:
            self._server_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            self._server_socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            self._server_socket.bind(('localhost', port))
            self._server_socket.listen(5)
            self._server_socket.settimeout(1.0)

            self._bound_port = port
            self._is_primary = True
            self._running = True

            ColorPrint.green(f"[FrontendSingleton] Bound to port {port} (PRIMARY frontend)")

            # Start listener thread
            self._listener_thread = threading.Thread(
                target=self._listener_loop,
                name=f"FrontendSingleton-{self.app_id}",
                daemon=True
            )
            self._listener_thread.start()

            return True

        except OSError as e:
            self._log(f"Port {port}: Failed to bind - {e}", "ERROR")
            return False

    def detect_and_bind(self, shutdown_existing: bool = True) -> FrontendDetectionResult:
        """
        Detect existing frontend instances and try to become PRIMARY

        Args:
            shutdown_existing: If True, shutdown existing frontend and take over

        Returns:
            FrontendDetectionResult with detection status
        """
        ColorPrint.blue("=" * 60)
        ColorPrint.blue(f"[FrontendSingleton] Detecting frontend for '{self.app_id}'")
        ColorPrint.blue(f"[FrontendSingleton] Port range: {self.port_start}-{self.port_start + self.port_range - 1}")
        ColorPrint.blue(f"[FrontendSingleton] Shutdown existing: {shutdown_existing}")
        ColorPrint.blue("=" * 60)

        for offset in range(self.port_range):
            port = self.port_start + offset

            # Try to connect and verify
            response = self._try_connect_and_verify(port)

            if response:
                # Found valid frontend instance!
                ColorPrint.yellow(f"[FrontendSingleton] Found existing frontend at port {port}")

                if shutdown_existing:
                    # Send shutdown request
                    ColorPrint.yellow("[FrontendSingleton] Sending shutdown request to old frontend...")
                    shutdown_result = self._send_shutdown_to_existing(port)

                    if shutdown_result['accepted']:
                        ColorPrint.green("[FrontendSingleton] Old frontend accepted shutdown")
                        ColorPrint.blue("[FrontendSingleton] Waiting for old frontend to shutdown gracefully...")

                        # Don't sleep for fixed time - poll to check if port is released
                        # Old instance should release singleton port when it shuts down
                        max_wait = 15.0
                        interval = 0.5
                        waited = 0.0

                        while waited < max_wait:
                            # Try to bind - if successful, old instance has released the port
                            if self._try_bind_port(port):
                                ColorPrint.green(f"[FrontendSingleton] Old frontend released port after {waited:.1f}s")
                                ColorPrint.green("[FrontendSingleton] Became PRIMARY frontend (after shutdown)")
                                return FrontendDetectionResult(
                                    is_primary=True,
                                    port=port,
                                    existing_instance=False,
                                    existing_port=None,
                                    message=f"Became PRIMARY frontend on port {port} (shutdown old frontend)"
                                )

                            time.sleep(interval)
                            waited += interval

                        # Timeout - port still not available
                        ColorPrint.yellow(f"[FrontendSingleton] Old frontend did not release port after {max_wait}s")

                        # Retry binding
                        max_retries = 3
                        for retry in range(max_retries):
                            if retry > 0:
                                ColorPrint.cyan(f"[FrontendSingleton] Retry {retry}/{max_retries}...")
                                time.sleep(0.5)

                            if self._try_bind_port(port):
                                ColorPrint.green("[FrontendSingleton] Became PRIMARY frontend (after shutdown)")
                                return FrontendDetectionResult(
                                    is_primary=True,
                                    port=port,
                                    existing_instance=False,
                                    existing_port=None,
                                    message=f"Became PRIMARY frontend on port {port} (shutdown old frontend)"
                                )

                        # All retries failed
                        ColorPrint.red("[FrontendSingleton] Failed to bind port after shutdown")
                        return FrontendDetectionResult(
                            is_primary=False,
                            port=0,
                            existing_instance=False,
                            existing_port=None,
                            message=f"Failed to bind port {port} after shutdown"
                        )
                    else:
                        # Old frontend rejected shutdown
                        ColorPrint.yellow(f"[FrontendSingleton] Shutdown rejected: {shutdown_result['reason']}")
                        return FrontendDetectionResult(
                            is_primary=False,
                            port=0,
                            existing_instance=True,
                            existing_port=port,
                            message=f"Existing frontend at port {port} ({shutdown_result['reason']})"
                        )
                else:
                    # Don't shutdown, return as SECONDARY
                    return FrontendDetectionResult(
                        is_primary=False,
                        port=0,
                        existing_instance=True,
                        existing_port=port,
                        message=f"Found existing frontend at port {port}"
                    )

            # Port is available, try to bind
            if self._try_bind_port(port):
                ColorPrint.green("[FrontendSingleton] Became PRIMARY frontend")
                return FrontendDetectionResult(
                    is_primary=True,
                    port=port,
                    existing_instance=False,
                    existing_port=None,
                    message=f"Became PRIMARY frontend on port {port}"
                )

        # Exhausted all ports
        ColorPrint.red("[FrontendSingleton] No available port in range")
        return FrontendDetectionResult(
            is_primary=False,
            port=0,
            existing_instance=False,
            existing_port=None,
            message="No available ports in range"
        )

    def _listener_loop(self):
        """Socket listener loop (PRIMARY instance only)"""
        self._log("Listener thread started")

        while self._running:
            try:
                client_socket, address = self._server_socket.accept()
                # Handle in new thread
                threading.Thread(
                    target=self._handle_client,
                    args=(client_socket, address),
                    daemon=True
                ).start()
            except socket.timeout:
                continue
            except Exception as e:
                if self._running:
                    self._log(f"Listener error: {e}", "ERROR")
                break

        self._log("Listener thread stopped")

    def _handle_client(self, client_socket: socket.socket, address):
        """Handle client connection"""
        try:
            data = client_socket.recv(4096).decode('utf-8')
            if not data:
                return

            message = json.loads(data.strip())

            # Validate message
            if not self._validate_message(message):
                self._log(f"Invalid message from {address}", "WARNING")
                return

            msg_type = message.get('type')
            self._log(f"Received {msg_type} from PID {message.get('pid')}")

            # Handle different message types
            if msg_type == MessageType.CHECK.value:
                # Send ALIVE response
                response = self._create_message(
                    MessageType.ALIVE,
                    is_primary=self._is_primary,
                    port=self._bound_port
                )
                response_data = json.dumps(response).encode('utf-8')
                client_socket.sendall(response_data + b'\n')

            elif msg_type == MessageType.SHUTDOWN.value:
                ColorPrint.yellow("[FrontendSingleton] Received shutdown request")

                # Send ACK immediately
                response = self._create_message(
                    MessageType.SHUTDOWN_ACK,
                    accepted=True,
                    reason="Frontend shutdown accepted"
                )
                response_data = json.dumps(response).encode('utf-8')
                client_socket.sendall(response_data + b'\n')

                # Flush and close socket
                try:
                    client_socket.shutdown(socket.SHUT_WR)
                except:
                    pass

                ColorPrint.yellow("[FrontendSingleton] Shutdown ACK sent, triggering frontend shutdown...")

                # Trigger shutdown via THREAD_BUS (like main singleton detector)
                # This ensures all modules shutdown in correct order
                def trigger_shutdown():
                    time.sleep(0.3)  # Short delay to ensure response is received

                    # Call legacy callback if provided (for notification only, not shutdown logic)
                    if self.on_shutdown_request:
                        self.on_shutdown_request()

                    # Trigger THREAD_BUS shutdown (unified shutdown mechanism)
                    THREAD_BUS.request_shutdown(
                        reason=f"Frontend shutdown requested by another instance (PID {message.get('pid')})",
                        execute_handlers=True
                    )

                threading.Thread(target=trigger_shutdown, daemon=True).start()

            elif msg_type == MessageType.PING.value:
                # Send PONG
                response = self._create_message(MessageType.PONG)
                response_data = json.dumps(response).encode('utf-8')
                client_socket.sendall(response_data + b'\n')

        except Exception as e:
            self._log(f"Error handling client: {e}", "ERROR")
        finally:
            client_socket.close()

    def _send_shutdown_to_existing(self, existing_port: int) -> dict:
        """
        Send shutdown request to existing frontend instance

        If communication fails, use port killer to force shutdown.

        Args:
            existing_port: Port of existing frontend

        Returns:
            dict with 'accepted' (bool) and 'reason' (str)
        """
        self._log(f"Sending SHUTDOWN to existing frontend on port {existing_port}")

        shutdown_msg = self._create_message(MessageType.SHUTDOWN)
        response = self._send_message_and_wait_response(existing_port, shutdown_msg)

        if response and response.get('type') == MessageType.SHUTDOWN_ACK.value:
            accepted = response.get('accepted', False)
            reason = response.get('reason', '')

            if accepted:
                self._log(f"Shutdown ACCEPTED: {reason}")
            else:
                self._log(f"Shutdown REJECTED: {reason}", "WARNING")

            return {
                'accepted': accepted,
                'reason': reason
            }

        # Communication failed - use port killer
        self._log("No valid shutdown response received, using port killer...", "WARNING")


        if kill_process_on_port(existing_port, force=True):
            self._log(f"Port {existing_port} forcefully cleaned", "INFO")
            return {
                'accepted': True,
                'reason': 'Process killed by port killer'
            }
        else:
            self._log(f"Failed to kill process on port {existing_port}", "ERROR")
            return {
                'accepted': False,
                'reason': 'Port killer failed'
            }

    def stop(self):
        """Stop detector and close socket"""
        self._running = False
        if self._server_socket:
            self._server_socket.close()
        if self._listener_thread:
            self._listener_thread.join(timeout=2.0)
        self._log("Frontend singleton detector stopped")

    def is_primary(self) -> bool:
        """Check if this is PRIMARY frontend instance"""
        return self._is_primary

    def get_port(self) -> Optional[int]:
        """Get bound port (PRIMARY only)"""
        return self._bound_port
