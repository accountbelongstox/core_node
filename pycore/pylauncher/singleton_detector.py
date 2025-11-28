#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Cross-Process Singleton Detector

A universal cross-process singleton detector using port range scanning and protocol verification.

Features:
- Port range scanning: Start from initial port, try sequentially until finding available port or correct instance
- Protocol verification: Ensure detected instance is our program, not another program
- PRIMARY/SECONDARY mode: First instance becomes PRIMARY, others become SECONDARY
- Cross-process communication: Based on JSON message protocol

Use cases:
- Prevent multiple launches of the same application
- Cross-process instance discovery and communication
- Singleton service management

Usage:
    from pycore.pyutils.singleton_detector import SingletonDetector

    # Create detector
    detector = SingletonDetector(
        app_id="my_app",
        port_start=54000,
        port_range=100
    )

    # Detect and try to become PRIMARY
    result = detector.detect_and_bind()

    if result.is_primary:
        print("Started as PRIMARY instance")
        # Start application main logic
    else:
        print(f"Found existing instance at port {result.port}")
        # Choose: Connect to existing instance or exit
"""

import os
import sys
import socket
import json
import time
import threading
from typing import Optional, Callable, Dict, Any, List
from dataclasses import dataclass
from enum import Enum


# ============================================================
# Protocol Definition
# ============================================================

class ProtocolVersion:
    """Protocol version identifier"""
    CURRENT = "PYCORE_SINGLETON_V1"


class MessageType(Enum):
    """Message types for singleton communication"""
    CHECK = "CHECK"              # Check if instance exists
    ALIVE = "ALIVE"              # Instance alive response
    SHUTDOWN = "SHUTDOWN"        # Request shutdown
    SHUTDOWN_ACK = "SHUTDOWN_ACK"  # Shutdown acknowledged
    STATUS = "STATUS"            # Request status
    STATUS_RESPONSE = "STATUS_RESPONSE"  # Status response
    PING = "PING"                # Keep-alive ping
    PONG = "PONG"                # Ping response


# ============================================================
# Detection Result
# ============================================================

@dataclass
class DetectionResult:
    """Result of singleton detection"""
    is_primary: bool              # True if this is PRIMARY instance
    port: int                     # Bound port number
    existing_instance: bool       # True if found existing instance
    existing_port: Optional[int]  # Port of existing instance (if found)
    message: str                  # Human-readable message


# ============================================================
# Singleton Detector
# ============================================================

class SingletonDetector:
    """
    Cross-Process Singleton Detector with Port Range Scanning

    Detection logic:
    1. Start from port_start (e.g., 54000)
    2. Try to connect to port:
       - Connection failed → Port not in use → Try to bind → Become PRIMARY
       - Connection success → Send protocol verification:
         * Protocol correct → Found our instance → Become SECONDARY
         * Protocol wrong/no response → Other program → Try next port (54001)
    3. Repeat until:
       - Find available port (become PRIMARY)
       - Find correct instance (become SECONDARY)
       - Exceed port range (fail)

    Protocol format:
        Request:
        {
            "protocol": "PYCORE_SINGLETON_V1",
            "type": "CHECK",
            "app_id": "my_app",
            "pid": 12345,
            "timestamp": 1234567890
        }

        Response:
        {
            "protocol": "PYCORE_SINGLETON_V1",
            "type": "ALIVE",
            "app_id": "my_app",
            "pid": 12345,
            "is_primary": true
        }
    """

    def __init__(
        self,
        app_id: str,
        port_start: int = 54000,
        port_range: int = 100,
        timeout: float = 1.0,
        debug: bool = False,
        on_message: Optional[Callable[[Dict], None]] = None,
        state_checker: Optional[Callable[[], Dict]] = None,
        shutdown_existing: bool = False
    ):
        """
        Initialize Singleton Detector

        Args:
            app_id: Application identifier (must be unique)
            port_start: Starting port for scanning (default: 54000)
            port_range: Number of ports to scan (default: 100)
            timeout: Connection timeout in seconds (default: 1.0)
            debug: Enable debug output
            on_message: Optional callback for received messages
            state_checker: Optional callback to get application state (returns dict with can_shutdown, etc.)
            shutdown_existing: If True, shutdown existing instance and take over (default: False)
        """
        self.app_id = app_id
        self.port_start = port_start
        self.port_range = port_range
        self.timeout = timeout
        # Enable debug via parameter OR environment variable SINGLETON_DEBUG=1
        self.debug = debug or os.environ.get('SINGLETON_DEBUG', '').lower() in ('1', 'true', 'yes')
        self.on_message = on_message
        self.state_checker = state_checker
        self.shutdown_existing = shutdown_existing

        # Runtime state
        self._is_primary = False
        self._bound_port: Optional[int] = None
        self._server_socket: Optional[socket.socket] = None
        self._running = False
        self._listener_thread: Optional[threading.Thread] = None

        if self.debug:
            self._log(f"[DEBUG] Initialized for app_id='{app_id}', port range {port_start}-{port_start + port_range - 1}")
            self._log(f"[DEBUG] Protocol: {ProtocolVersion.CURRENT}, Timeout: {timeout}s")

    def _log(self, message: str, level: str = "INFO"):
        """Log message if debug enabled"""
        if self.debug or level in ["ERROR", "WARNING"]:
            timestamp = time.strftime('%Y-%m-%d %H:%M:%S')
            # Use ASCII-safe output to avoid encoding issues on Windows
            log_msg = f"[{timestamp}] [{level}] SingletonDetector({self.app_id}): {message}"
            try:
                print(log_msg)
            except UnicodeEncodeError:
                # Fallback: encode as ASCII with ignore for problematic characters
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
        """
        Validate received message

        Returns:
            True if message is from our app with correct protocol
        """
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

    def _send_message_and_wait_response(self, port: int, message: Dict, validate: bool = True) -> Optional[Dict]:
        """
        Send message to port and wait for response

        Args:
            port: Target port
            message: Message dict to send
            validate: Whether to validate response protocol (default: True)

        Returns:
            Response dict if successful, None otherwise
        """
        try:
            client_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            client_socket.settimeout(self.timeout)
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

            # Validate if requested
            if validate and not self._validate_message(response):
                self._log(f"Port {port}: Invalid protocol", "WARNING")
                return None

            return response

        except (socket.timeout, ConnectionRefusedError):
            return None
        except Exception as e:
            self._log(f"Port {port}: Error - {e}", "ERROR")
            return None

    def _try_connect_and_verify(self, port: int) -> Optional[Dict]:
        """
        Try to connect to port and verify protocol

        Args:
            port: Port to connect to

        Returns:
            Response message if valid instance found, None otherwise
        """
        self._log(f"Trying to connect to port {port}...")
        check_msg = self._create_message(MessageType.CHECK)
        response = self._send_message_and_wait_response(port, check_msg, validate=True)

        if response:
            self._log(f"Port {port}: Found valid instance (PID {response.get('pid')})")
        else:
            self._log(f"Port {port}: Not in use or no valid response")

        return response

    def _try_bind_port(self, port: int) -> bool:
        """
        Try to bind to port and start listener

        Args:
            port: Port to bind

        Returns:
            True if successfully bound
        """
        try:
            self._server_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            self._server_socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            self._server_socket.bind(('localhost', port))
            self._server_socket.listen(5)
            self._server_socket.settimeout(1.0)

            self._bound_port = port
            self._is_primary = True
            self._running = True

            self._log(f"[SUCCESS] Bound to port {port} (PRIMARY instance)")

            # Start listener thread
            self._listener_thread = threading.Thread(
                target=self._listener_loop,
                name=f"SingletonDetector-{self.app_id}",
                daemon=True
            )
            self._listener_thread.start()

            return True

        except OSError as e:
            self._log(f"Port {port}: Failed to bind - {e}", "ERROR")
            return False

    def detect_and_bind(self) -> DetectionResult:
        """
        Detect existing instances and try to become PRIMARY

        Detection algorithm:
        1. Scan port range from port_start
        2. For each port:
           - Try to connect
           - If connection fails → Port available → Try to bind → SUCCESS
           - If connection succeeds → Verify protocol
             * Valid protocol → Found our instance
               - If shutdown_existing=True → Send shutdown and retry binding
               - If shutdown_existing=False → RETURN (SECONDARY mode)
             * Invalid protocol → Other program → Continue to next port
        3. If all ports exhausted → FAIL

        Returns:
            DetectionResult with detection status
        """
        self._log("=" * 60)
        self._log(f"Starting singleton detection for '{self.app_id}'")
        self._log(f"Port range: {self.port_start}-{self.port_start + self.port_range - 1}")
        self._log(f"Shutdown existing: {self.shutdown_existing}")
        self._log("=" * 60)

        for offset in range(self.port_range):
            port = self.port_start + offset

            self._log(f"[{offset + 1}/{self.port_range}] Checking port {port}...")

            # Try to connect and verify
            response = self._try_connect_and_verify(port)

            if response:
                # Found valid instance!
                self._log("[FOUND] Existing instance detected")

                # Check if we should shutdown existing instance
                if self.shutdown_existing:
                    self._log("[SHUTDOWN] Attempting to shutdown existing instance...")
                    if self.send_shutdown_to_existing(port):
                        self._log("[SHUTDOWN] Successfully shutdown existing instance, retrying bind...")

                        # Retry binding with small delays (旧实例可能需要时间释放端口)
                        max_retries = 3
                        for retry in range(max_retries):
                            if retry > 0:
                                retry_delay = 0.5
                                self._log(f"[RETRY] Retry {retry}/{max_retries} after {retry_delay}s...")
                                time.sleep(retry_delay)

                            # Try to bind to this port
                            if self._try_bind_port(port):
                                self._log("[SUCCESS] Became PRIMARY instance (after shutdown)")
                                return DetectionResult(
                                    is_primary=True,
                                    port=port,
                                    existing_instance=False,
                                    existing_port=None,
                                    message=f"Became PRIMARY instance on port {port} (shutdown existing)"
                                )

                        # All retries failed
                        self._log("[ERROR] Shutdown succeeded but failed to bind port after retries", "ERROR")
                        return DetectionResult(
                            is_primary=False,
                            port=0,
                            existing_instance=False,
                            existing_port=None,
                            message=f"Shutdown succeeded but failed to bind port {port} after {max_retries} retries"
                        )
                    else:
                        self._log("[SHUTDOWN] Failed to shutdown existing instance", "WARNING")
                        return DetectionResult(
                            is_primary=False,
                            port=0,
                            existing_instance=True,
                            existing_port=port,
                            message=f"Found existing instance at port {port} (shutdown failed)"
                        )
                else:
                    # Don't shutdown, return as SECONDARY
                    self._log("[FOUND] Existing instance detected (SECONDARY mode)")
                    return DetectionResult(
                        is_primary=False,
                        port=0,  # We don't bind any port
                        existing_instance=True,
                        existing_port=port,
                        message=f"Found existing instance at port {port}"
                    )

            # Port is available, try to bind
            if self._try_bind_port(port):
                self._log("[SUCCESS] Became PRIMARY instance")
                return DetectionResult(
                    is_primary=True,
                    port=port,
                    existing_instance=False,
                    existing_port=None,
                    message=f"Became PRIMARY instance on port {port}"
                )

        # Exhausted all ports
        self._log("[FAILED] No available port in range", "ERROR")
        return DetectionResult(
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

            # Call message callback if set
            if self.on_message:
                self.on_message(message)

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

            elif msg_type == MessageType.STATUS.value:
                # Query application state
                app_state = {}
                if self.state_checker:
                    try:
                        app_state = self.state_checker()
                    except Exception as e:
                        self._log(f"State checker failed: {e}", "ERROR")
                        app_state = {"can_shutdown": True, "error": str(e)}
                else:
                    # No state checker - always allow shutdown
                    app_state = {"can_shutdown": True}

                # Send STATUS_RESPONSE
                response = self._create_message(
                    MessageType.STATUS_RESPONSE,
                    is_primary=self._is_primary,
                    port=self._bound_port,
                    **app_state
                )
                response_data = json.dumps(response).encode('utf-8')
                client_socket.sendall(response_data + b'\n')

            elif msg_type == MessageType.SHUTDOWN.value:
                self._log("Received shutdown request", "WARNING")

                # Check if shutdown is allowed
                can_shutdown = True
                shutdown_reason = "Normal shutdown"

                if self.state_checker:
                    try:
                        app_state = self.state_checker()
                        can_shutdown = app_state.get("can_shutdown", True)
                        if not can_shutdown:
                            shutdown_reason = f"Shutdown denied: {app_state.get('message', 'Application is busy')}"
                            self._log(shutdown_reason, "WARNING")
                    except Exception as e:
                        self._log(f"State checker failed during shutdown: {e}", "ERROR")
                        # On error, allow shutdown (fail-safe)
                        can_shutdown = True

                if can_shutdown:
                    self._log("Shutdown accepted, triggering shutdown...", "WARNING")

                    # Trigger shutdown callback (calls THREAD_BUS.request_shutdown via on_message)
                    if self.on_message:
                        # Trigger shutdown in separate thread to avoid blocking current message handler
                        def trigger_shutdown():
                            time.sleep(0.1)  # Short delay to ensure message handling completes
                            self.on_message({'type': 'SHUTDOWN', 'pid': message.get('pid')})

                        threading.Thread(target=trigger_shutdown, daemon=True).start()
                else:
                    self._log(f"Shutdown rejected: {shutdown_reason}", "WARNING")

            elif msg_type == MessageType.PING.value:
                # Send PONG
                response = self._create_message(MessageType.PONG)
                response_data = json.dumps(response).encode('utf-8')
                client_socket.sendall(response_data + b'\n')

        except Exception as e:
            self._log(f"Error handling client: {e}", "ERROR")
        finally:
            client_socket.close()

    def send_shutdown_to_existing(self, existing_port: int) -> bool:
        """
        Send shutdown request to existing instance

        Simplified logic: Don't wait for response, just send SHUTDOWN message
        Old instance will trigger THREAD_BUS.request_shutdown() via on_message callback

        Args:
            existing_port: Port of existing instance

        Returns:
            True (always, because we don't wait for response)
        """
        self._log(f"Sending SHUTDOWN to existing instance on port {existing_port}")

        try:
            client_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            client_socket.settimeout(1.0)
            client_socket.connect(('localhost', existing_port))

            # Send SHUTDOWN message
            shutdown_msg = self._create_message(MessageType.SHUTDOWN)
            message_data = json.dumps(shutdown_msg).encode('utf-8')
            client_socket.sendall(message_data + b'\n')

            client_socket.close()

            self._log("SHUTDOWN message sent (not waiting for response)")
            # Give old instance some time to start shutdown
            time.sleep(1.0)
            return True

        except Exception as e:
            self._log(f"Failed to send SHUTDOWN: {e}", "ERROR")
            return False

    def stop(self):
        """Stop detector and close socket"""
        self._running = False
        if self._server_socket:
            self._server_socket.close()
        if self._listener_thread:
            self._listener_thread.join(timeout=2.0)
        self._log("Detector stopped")

    def is_primary(self) -> bool:
        """Check if this is PRIMARY instance"""
        return self._is_primary

    def get_port(self) -> Optional[int]:
        """Get bound port (PRIMARY only)"""
        return self._bound_port


# ============================================================
# Convenience Function
# ============================================================

def detect_singleton(
    app_id: str,
    port_start: int = 54000,
    port_range: int = 100,
    debug: bool = False
) -> DetectionResult:
    """
    Convenience function for singleton detection

    Args:
        app_id: Application identifier
        port_start: Starting port
        port_range: Number of ports to scan
        debug: Enable debug output

    Returns:
        DetectionResult
    """
    detector = SingletonDetector(
        app_id=app_id,
        port_start=port_start,
        port_range=port_range,
        debug=debug
    )
    return detector.detect_and_bind()


# ============================================================
# Test
# ============================================================

if __name__ == "__main__":
    print("=" * 70)
    print("Singleton Detector Test")
    print("=" * 70)
    print("")

    # Test detection
    result = detect_singleton(
        app_id="test_app",
        port_start=54000,
        port_range=10,
        debug=True
    )

    print("")
    print("=" * 70)
    print("Detection Result:")
    print(f"  Is Primary: {result.is_primary}")
    print(f"  Port: {result.port}")
    print(f"  Existing Instance: {result.existing_instance}")
    print(f"  Existing Port: {result.existing_port}")
    print(f"  Message: {result.message}")
    print("=" * 70)

    if result.is_primary:
        print("\nThis is the PRIMARY instance.")
        print("Press Enter to exit...")
        input()
    else:
        print("\nFound existing instance, exiting...")
