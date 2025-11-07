# -*- coding: utf-8 -*-
"""
WebSocket RPC Singleton Backend Extension
Extends wsrpc with singleton instance management

IMPORTANT NOTICE:
==========================================
This is an extension module for wsrpc framework.
It provides singleton pattern for backend instances to reduce
resource consumption when multiple clients connect.

Features:
- Singleton instance detection via socket port
- Dual-thread architecture (backend + client communication)
- Automatic instance detection and connection
- Resource sharing among multiple clients
- Only uses Python standard library

Usage:
    See singleton_rpc_example.py for implementation examples
"""

import socket
import threading
import json
import time
import sys
from typing import Optional, Callable, Dict, Any


class SingletonBackendDetector:
    """
    Singleton Backend Detector

    Detects if a backend instance is already running using socket port binding.
    Uses only Python standard library - no external dependencies.

    Note: Copy this implementation to your client project and modify as needed.
    """

    # Hardcoded configuration constants
    DEFAULT_HOST = 'localhost'
    DEFAULT_PORT = 19999  # Default singleton detection port
    DEFAULT_TIMEOUT = 2   # Detection timeout in seconds

    # Communication protocol signals
    SIGNAL_CHECK = 'INSTANCE_CHECK'      # Check if instance exists
    SIGNAL_ALIVE = 'INSTANCE_ALIVE'      # Instance alive response
    SIGNAL_SHUTDOWN = 'SHUTDOWN'         # Shutdown signal
    SIGNAL_STATUS = 'STATUS_REQUEST'     # Status request
    SIGNAL_STATUS_RESPONSE = 'STATUS_RESPONSE'  # Status response

    def __init__(
        self,
        host: str = DEFAULT_HOST,
        port: int = DEFAULT_PORT,
        timeout: int = DEFAULT_TIMEOUT,
        debug: bool = False
    ):
        """
        Initialize Singleton Backend Detector

        Args:
            host: Listening host address (default: localhost)
            port: Listening port (default: 19999)
            timeout: Detection timeout in seconds (default: 2)
            debug: Enable debug output
        """
        self.host = host
        self.port = port
        self.timeout = timeout
        self.debug = debug

        # Runtime state
        self._running = False
        self._is_primary_instance = False

        # Socket server (only for primary instance)
        self._server_socket: Optional[socket.socket] = None

        # Threads
        self._backend_thread: Optional[threading.Thread] = None
        self._communication_thread: Optional[threading.Thread] = None
        self._socket_listener_thread: Optional[threading.Thread] = None

        # Event callbacks
        self._on_primary_started: Optional[Callable] = None
        self._on_secondary_started: Optional[Callable] = None
        self._on_shutdown: Optional[Callable] = None

    def _log(self, message: str, level: str = 'INFO'):
        """Output log message"""
        if self.debug or level in ['ERROR', 'WARNING']:
            timestamp = time.strftime('%Y-%m-%d %H:%M:%S')
            print(f"[{timestamp}] [{level}] SingletonBackend: {message}")

    def check_instance_exists(self) -> bool:
        """
        Check if a backend instance is already running

        Returns:
            True: Instance already exists
            False: No instance running
        """
        try:
            # Try to connect to the detection port
            client_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            client_socket.settimeout(self.timeout)

            self._log(f"Checking for existing instance at {self.host}:{self.port}")
            client_socket.connect((self.host, self.port))

            # Send check signal
            message = json.dumps({
                'type': self.SIGNAL_CHECK,
                'timestamp': time.time(),
                'pid': sys.platform
            }).encode('utf-8')

            client_socket.sendall(message + b'\n')

            # Wait for response
            response = client_socket.recv(1024).decode('utf-8')
            response_data = json.loads(response.strip())

            client_socket.close()

            # Check if received alive response
            if response_data.get('type') == self.SIGNAL_ALIVE:
                self._log("Existing instance detected", 'WARNING')
                return True

            return False

        except (socket.timeout, socket.error, ConnectionRefusedError):
            self._log(f"No existing instance detected")
            return False
        except Exception as e:
            self._log(f"Error during instance detection: {e}", 'ERROR')
            return False

    def _start_server_socket(self) -> bool:
        """
        Start server socket for singleton detection

        Returns:
            True: Started successfully
            False: Failed to start (port already in use)
        """
        try:
            self._server_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            self._server_socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            self._server_socket.bind((self.host, self.port))
            self._server_socket.listen(5)
            self._server_socket.settimeout(1.0)  # Timeout for shutdown response

            self._log(f"Server socket started at {self.host}:{self.port}")
            return True

        except OSError as e:
            self._log(f"Failed to start server socket: {e}", 'ERROR')
            return False

    def _handle_client_connection(self, client_socket: socket.socket, address):
        """
        Handle client connection for singleton detection

        Args:
            client_socket: Client socket
            address: Client address
        """
        try:
            data = client_socket.recv(1024).decode('utf-8')
            if not data:
                return

            message = json.loads(data.strip())
            msg_type = message.get('type')

            self._log(f"Received message from {address}: {msg_type}")

            # Respond to instance check
            if msg_type == self.SIGNAL_CHECK:
                response = json.dumps({
                    'type': self.SIGNAL_ALIVE,
                    'timestamp': time.time(),
                    'pid': sys.platform,
                    'is_primary': self._is_primary_instance
                }).encode('utf-8')
                client_socket.sendall(response + b'\n')

            # Handle shutdown signal
            elif msg_type == self.SIGNAL_SHUTDOWN:
                self._log("Received shutdown signal", 'WARNING')
                self._running = False
                response = json.dumps({
                    'type': 'SHUTDOWN_ACK',
                    'timestamp': time.time()
                }).encode('utf-8')
                client_socket.sendall(response + b'\n')

            # Handle status request
            elif msg_type == self.SIGNAL_STATUS:
                response = json.dumps({
                    'type': self.SIGNAL_STATUS_RESPONSE,
                    'timestamp': time.time(),
                    'is_primary': self._is_primary_instance,
                    'is_running': self._running,
                    'pid': sys.platform
                }).encode('utf-8')
                client_socket.sendall(response + b'\n')

        except Exception as e:
            self._log(f"Error handling client connection: {e}", 'ERROR')

        finally:
            client_socket.close()

    def _socket_listener_loop(self):
        """Server socket listening loop (primary instance only)"""
        self._log("Socket listener loop started")

        while self._running:
            try:
                client_socket, address = self._server_socket.accept()
                # Handle connection in new thread
                threading.Thread(
                    target=self._handle_client_connection,
                    args=(client_socket, address),
                    daemon=True
                ).start()

            except socket.timeout:
                continue  # Timeout, continue loop

            except Exception as e:
                if self._running:
                    self._log(f"Socket listener error: {e}", 'ERROR')
                break

        self._log("Socket listener loop ended")

    def _backend_thread_entry(self):
        """Backend thread entry point"""
        self._log("Backend thread started")

        try:
            # Start socket listener first
            if self._is_primary_instance:
                self._socket_listener_thread = threading.Thread(
                    target=self._socket_listener_loop,
                    name="SocketListenerThread",
                    daemon=True
                )
                self._socket_listener_thread.start()

            # Run user-defined backend logic
            self.run_backend()

        except Exception as e:
            self._log(f"Backend thread exception: {e}", 'ERROR')

        finally:
            self._log("Backend thread ended")

    def _communication_thread_entry(self):
        """Client communication thread entry point"""
        self._log("Client communication thread started")

        try:
            self.run_client_communication()

        except Exception as e:
            self._log(f"Client communication thread exception: {e}", 'ERROR')

        finally:
            self._log("Client communication thread ended")

    # ============================================
    # Methods to be implemented by subclass
    # ============================================

    def run_backend(self):
        """
        Run backend main logic (must be implemented by subclass)

        This method runs in the backend main thread and implements your core business logic.
        Only runs in the primary instance (first launched instance).

        Example:
            def run_backend(self):
                while self._running:
                    # Execute backend tasks
                    time.sleep(1)
        """
        raise NotImplementedError("Please implement run_backend() method")

    def run_client_communication(self):
        """
        Run client communication logic (must be implemented by subclass)

        This method runs in the client communication thread and handles client communication.
        Runs in all instances (both primary and secondary).

        Example:
            def run_client_communication(self):
                while self._running:
                    # Handle client communication
                    time.sleep(1)
        """
        raise NotImplementedError("Please implement run_client_communication() method")

    # ============================================
    # Public Interface
    # ============================================

    def start(self) -> bool:
        """
        Start the application

        Returns:
            True: Started successfully (as primary or secondary instance)
            False: Failed to start
        """
        if self._running:
            self._log("Application already running", 'WARNING')
            return False

        self._log("=== Singleton Backend Starting ===")

        # Check if instance already exists
        instance_exists = self.check_instance_exists()

        if instance_exists:
            # Instance exists, start as secondary
            self._log("Primary instance detected, starting as secondary instance", 'WARNING')
            self._is_primary_instance = False

            # Trigger secondary instance callback
            if self._on_secondary_started:
                self._on_secondary_started()

        else:
            # No instance, start as primary
            self._log("No primary instance detected, starting as primary instance")
            self._is_primary_instance = True

            # Start server socket
            if not self._start_server_socket():
                self._log("Failed to start server socket, startup failed", 'ERROR')
                return False

            # Start backend thread
            self._backend_thread = threading.Thread(
                target=self._backend_thread_entry,
                name="BackendThread",
                daemon=False
            )

            # Trigger primary instance callback
            if self._on_primary_started:
                self._on_primary_started()

        # Start client communication thread (all instances need this)
        self._communication_thread = threading.Thread(
            target=self._communication_thread_entry,
            name="ClientCommunicationThread",
            daemon=False
        )

        # Set running flag
        self._running = True

        # Start threads
        if self._is_primary_instance and self._backend_thread:
            self._backend_thread.start()

        self._communication_thread.start()

        self._log(f"=== Startup Complete (Primary: {self._is_primary_instance}) ===")
        return True

    def stop(self):
        """Stop the application"""
        if not self._running:
            return

        self._log("=== Stopping Application ===")

        self._running = False

        # Trigger shutdown callback
        if self._on_shutdown:
            self._on_shutdown()

        # Wait for threads to finish
        if self._communication_thread:
            self._communication_thread.join(timeout=5)

        if self._socket_listener_thread:
            self._socket_listener_thread.join(timeout=2)

        if self._backend_thread:
            self._backend_thread.join(timeout=5)

        # Close server socket
        if self._server_socket:
            try:
                self._server_socket.close()
            except:
                pass

        self._log("=== Application Stopped ===")

    def is_running(self) -> bool:
        """Check if running"""
        return self._running

    def is_primary_instance(self) -> bool:
        """Check if this is the primary instance"""
        return self._is_primary_instance

    # ============================================
    # Event Callback Setters
    # ============================================

    def on_primary_started(self, callback: Callable):
        """Set primary instance started callback"""
        self._on_primary_started = callback
        return self

    def on_secondary_started(self, callback: Callable):
        """Set secondary instance started callback"""
        self._on_secondary_started = callback
        return self

    def on_shutdown(self, callback: Callable):
        """Set shutdown callback"""
        self._on_shutdown = callback
        return self


# ============================================
# Utility Functions
# ============================================

def send_shutdown_signal(host: str = 'localhost', port: int = 19999, timeout: int = 2) -> bool:
    """
    Send shutdown signal to running instance

    Args:
        host: Target host
        port: Target port
        timeout: Connection timeout

    Returns:
        True: Signal sent successfully
        False: Failed to send signal
    """
    try:
        client_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        client_socket.settimeout(timeout)
        client_socket.connect((host, port))

        message = json.dumps({
            'type': SingletonBackendDetector.SIGNAL_SHUTDOWN,
            'timestamp': time.time()
        }).encode('utf-8')

        client_socket.sendall(message + b'\n')

        response = client_socket.recv(1024).decode('utf-8')
        response_data = json.loads(response.strip())

        client_socket.close()

        return response_data.get('type') == 'SHUTDOWN_ACK'

    except Exception as e:
        print(f"Failed to send shutdown signal: {e}")
        return False


def get_instance_status(host: str = 'localhost', port: int = 19999, timeout: int = 2) -> Optional[Dict[str, Any]]:
    """
    Get status of running instance

    Args:
        host: Target host
        port: Target port
        timeout: Connection timeout

    Returns:
        Status dictionary or None if failed
    """
    try:
        client_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        client_socket.settimeout(timeout)
        client_socket.connect((host, port))

        message = json.dumps({
            'type': SingletonBackendDetector.SIGNAL_STATUS,
            'timestamp': time.time()
        }).encode('utf-8')

        client_socket.sendall(message + b'\n')

        response = client_socket.recv(1024).decode('utf-8')
        response_data = json.loads(response.strip())

        client_socket.close()

        if response_data.get('type') == SingletonBackendDetector.SIGNAL_STATUS_RESPONSE:
            return response_data

        return None

    except Exception as e:
        print(f"Failed to get instance status: {e}")
        return None
