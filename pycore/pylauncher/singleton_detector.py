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

THREAD_BUS Integration:
- Registers shutdown handler (priority=95) for graceful shutdown
- Triggers 'singleton.message_received' events for cross-process messages
- Uses THREAD_BUS.is_busy() as fallback state checker when no callback provided
- Triggers THREAD_BUS.request_shutdown() when receiving SHUTDOWN from another instance
- Checks THREAD_BUS.is_shutdown_requested() in listener loop
- Backwards compatible: keeps existing on_message and state_checker callbacks

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

# THREAD_BUS Integration
from pycore import THREAD_BUS, ColorPrint

# Fallback "process start" stamp when psutil is unavailable: module import time
# (later than the true process start, but preserves ordering between instances
# whose load times are similar).
_IMPORT_TIME = time.time()


def _process_start_time() -> float:
    """This process's creation time (epoch seconds), used for instance ordering."""
    try:
        import psutil
        return float(psutil.Process().create_time())
    except Exception:
        return _IMPORT_TIME


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
    # True when this (older) process deliberately yielded to a PRIMARY that was
    # started MORE RECENTLY than itself (takeover ordering: newest instance wins).
    yielded_to_newer: bool = False


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
        # Process start time: the ordering key for takeover. "New kicks old" must
        # hold even when the OLDER instance finishes its (slow) startup LAST —
        # e.g. a boot-autostart instance still loading packages while the user
        # manually launches a fresh one. Without this, "whoever finishes
        # detection last wins" inverts the intended semantics.
        self.started_at = _process_start_time()

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
            # Use longer timeout for SHUTDOWN to allow response time
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

            # THREAD_BUS Integration: Register shutdown handler
            # Priority=95 ensures singleton detector stops after most services but before heartbeat
            THREAD_BUS.register_shutdown_handler(
                self.stop,
                priority=95,
                name=f"singleton_detector_{self.app_id}"
            )
            self._log("[THREAD_BUS] Registered shutdown handler (priority=95)")

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

                # Takeover ordering: the NEWEST instance wins. If the running
                # PRIMARY was started more recently than this process, this is
                # the OLD instance arriving late (slow startup, e.g. boot
                # autostart still loading packages while the user launched a
                # fresh instance) — yield instead of kicking the newer one.
                # Old instances that don't report started_at are treated as
                # older (kick them), keeping backward compatibility.
                existing_started = response.get('started_at')
                if (self.shutdown_existing and existing_started is not None
                        and float(existing_started) > self.started_at):
                    self._log(
                        f"[YIELD] Existing instance is NEWER (started "
                        f"{float(existing_started):.3f} > ours {self.started_at:.3f}); "
                        "yielding instead of shutting it down", "WARNING")
                    return DetectionResult(
                        is_primary=False,
                        port=0,
                        existing_instance=True,
                        existing_port=port,
                        message=f"Yielded to newer instance at port {port}",
                        yielded_to_newer=True
                    )

                # Check if we should shutdown existing instance
                if self.shutdown_existing:
                    self._log("[SHUTDOWN] Attempting to shutdown existing instance...")
                    result = self.send_shutdown_to_existing(port)

                    if result['accepted']:
                        # Old instance accepted shutdown, wait and retry binding
                        self._log("[SHUTDOWN] Shutdown accepted, waiting for old instance to stop...")
                        time.sleep(1.5)  # Wait for old instance to shutdown

                        # Retry binding with small delays (old instance may need time to release port)
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
                        self._log("[ERROR] Failed to bind port after shutdown", "ERROR")
                        return DetectionResult(
                            is_primary=False,
                            port=0,
                            existing_instance=False,
                            existing_port=None,
                            message=f"Failed to bind port {port} after shutdown (unknown error)"
                        )
                    else:
                        # Old instance rejected shutdown or no response (old code without callback)
                        reason = result['reason']
                        self._log(f"[SHUTDOWN] Shutdown rejected or no response: {reason}")

                        # Try forceful takeover if no response (old instance without callbacks)
                        if 'No response' in reason:
                            self._log("[FORCE] Old instance has no callback (old code), attempting forceful takeover...")

                            # Get old instance PID from response (if available)
                            old_pid = response.get('pid') if response else None

                            if old_pid:
                                try:
                                    import os
                                    import signal
                                    import socket
                                    import time as time_module

                                    self._log(f"[FORCE] Sending SIGTERM to old instance PID {old_pid}...")
                                    os.kill(old_pid, signal.SIGTERM)

                                    # Wait for graceful shutdown with port checking
                                    max_wait = 5.0  # Maximum 5 seconds for graceful shutdown
                                    start_wait = time_module.time()

                                    while time_module.time() - start_wait < max_wait:
                                        time_module.sleep(0.3)

                                        # Check if process still exists
                                        try:
                                            os.kill(old_pid, 0)  # Signal 0 just checks existence
                                        except ProcessLookupError:
                                            self._log(f"[FORCE] Process {old_pid} exited gracefully")
                                            break

                                    # Give additional time for port release
                                    time_module.sleep(0.5)

                                    # Try binding again after SIGTERM
                                    if self._try_bind_port(port):
                                        self._log("[SUCCESS] Forcefully took over after SIGTERM")
                                        return DetectionResult(
                                            is_primary=True,
                                            port=port,
                                            existing_instance=False,
                                            existing_port=None,
                                            message=f"Became PRIMARY on port {port} (forceful takeover from old instance)"
                                        )
                                    else:
                                        # SIGTERM didn't work, try SIGKILL
                                        self._log(f"[FORCE] SIGTERM failed, sending SIGKILL to PID {old_pid}...", "WARNING")
                                        os.kill(old_pid, signal.SIGKILL)
                                        time.sleep(1.0)

                                        if self._try_bind_port(port):
                                            self._log("[SUCCESS] Forcefully took over after SIGKILL")
                                            return DetectionResult(
                                                is_primary=True,
                                                port=port,
                                                existing_instance=False,
                                                existing_port=None,
                                                message=f"Became PRIMARY on port {port} (SIGKILL old instance)"
                                            )

                                except ProcessLookupError:
                                    self._log(f"[FORCE] Old instance PID {old_pid} already exited", "WARNING")
                                    # Try binding one more time
                                    if self._try_bind_port(port):
                                        return DetectionResult(
                                            is_primary=True,
                                            port=port,
                                            existing_instance=False,
                                            existing_port=None,
                                            message=f"Became PRIMARY on port {port} (old instance already exited)"
                                        )
                                except Exception as e:
                                    self._log(f"[FORCE] Failed to forcefully kill old instance: {e}", "ERROR")

                        return DetectionResult(
                            is_primary=False,
                            port=0,
                            existing_instance=True,
                            existing_port=port,
                            message=f"Existing instance at port {port} ({result['reason']})"
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
        """
        Socket listener loop (PRIMARY instance only)

        THREAD_BUS Integration:
        - Checks THREAD_BUS.is_shutdown_requested() for graceful shutdown
        """
        self._log("Listener thread started")

        while self._running:
            # THREAD_BUS Integration: Check if global shutdown was requested
            if THREAD_BUS.is_shutdown_requested():
                self._log("[THREAD_BUS] Shutdown detected, stopping listener...", "WARNING")
                break

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

            # THREAD_BUS Integration: Trigger message received event (for all messages)
            # This allows other modules to subscribe to singleton messages
            THREAD_BUS.trigger_event('singleton.message_received', {
                'message_type': msg_type,
                'pid': message.get('pid'),
                'app_id': self.app_id,
                'full_message': message
            }, async_mode=True)

            # Call message callback for non-SHUTDOWN messages (backward compatibility)
            # SHUTDOWN is handled specially below (after sending response)
            if self.on_message and msg_type != MessageType.SHUTDOWN.value:
                self.on_message(message)

            # Handle different message types
            if msg_type == MessageType.CHECK.value:
                # Send ALIVE response (started_at lets the checker order instances)
                response = self._create_message(
                    MessageType.ALIVE,
                    is_primary=self._is_primary,
                    port=self._bound_port,
                    started_at=self.started_at
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
                    # THREAD_BUS Integration: Use THREAD_BUS state as fallback when no state_checker
                    # Check if THREAD_BUS reports system is busy
                    app_state = {
                        "can_shutdown": not THREAD_BUS.is_busy(),
                        "message": THREAD_BUS.get_busy_reason() if THREAD_BUS.is_busy() else "Ready"
                    }

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
                else:
                    # THREAD_BUS Integration: Use THREAD_BUS state when no state_checker
                    # Check if THREAD_BUS reports system is busy
                    if THREAD_BUS.is_busy():
                        can_shutdown = False
                        shutdown_reason = f"Shutdown denied: {THREAD_BUS.get_busy_reason()}"
                        self._log(shutdown_reason, "WARNING")

                # Send response
                response = self._create_message(
                    MessageType.SHUTDOWN_ACK,
                    accepted=can_shutdown,
                    reason=shutdown_reason if not can_shutdown else "Shutdown accepted"
                )
                response_data = json.dumps(response).encode('utf-8')
                client_socket.sendall(response_data + b'\n')

                # Flush and close socket to ensure response is sent
                try:
                    client_socket.shutdown(socket.SHUT_WR)
                except:
                    pass

                if can_shutdown:
                    self._log("Shutdown ACK sent (accepted), triggering shutdown...", "WARNING")

                    # THREAD_BUS Integration: Trigger shutdown request via THREAD_BUS
                    # This allows all modules to respond to shutdown properly
                    def trigger_shutdown():
                        time.sleep(0.3)  # Short delay to ensure response is received

                        # Call legacy callback if provided (backward compatibility)
                        if self.on_message:
                            self.on_message({'type': 'SHUTDOWN', 'pid': message.get('pid')})

                        # Trigger THREAD_BUS shutdown (new mechanism)
                        THREAD_BUS.request_shutdown(
                            reason=f"Shutdown requested by another instance (PID {message.get('pid')})",
                            execute_handlers=True
                        )

                    threading.Thread(target=trigger_shutdown, daemon=True).start()
                else:
                    self._log(f"Shutdown ACK sent (rejected): {shutdown_reason}", "WARNING")

            elif msg_type == MessageType.PING.value:
                # Send PONG
                response = self._create_message(MessageType.PONG)
                response_data = json.dumps(response).encode('utf-8')
                client_socket.sendall(response_data + b'\n')

        except Exception as e:
            self._log(f"Error handling client: {e}", "ERROR")
        finally:
            client_socket.close()

    def send_shutdown_to_existing(self, existing_port: int) -> dict:
        """
        Send shutdown request to existing instance and wait for response

        Args:
            existing_port: Port of existing instance

        Returns:
            dict with 'accepted' (bool) and 'reason' (str)
        """
        self._log(f"Sending SHUTDOWN to existing instance on port {existing_port}")

        shutdown_msg = self._create_message(MessageType.SHUTDOWN)
        response = self._send_message_and_wait_response(existing_port, shutdown_msg, validate=True)

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

        self._log("No valid shutdown response received", "ERROR")
        return {
            'accepted': False,
            'reason': 'No response from existing instance'
        }

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
