# -*- coding: utf-8 -*-
"""
Singleton Launcher Example

⚠️ IMPORTANT NOTICE:
==========================================
This is an example library and should NOT be imported directly.
Please copy this code to your project and modify it according to your needs.

Features:
==========================================
1. Singleton pattern: Ensures only one backend instance is started
2. Dual-thread architecture:
   - Client communication thread: Handles communication with clients
   - Backend main thread: Runs main business logic
3. Smart detection: Automatically detects if an instance is already running
4. Resource sharing: Multiple clients share the same backend instance

Requirements:
==========================================
Only uses Python standard library, no third-party dependencies

Implementation:
==========================================
Uses socket port detection to implement singleton pattern
"""

import socket
import threading
import json
import time
import sys
from typing import Optional, Callable, Dict, Any


class SingletonLauncher:
    """
    Singleton launcher base class

    Usage:
    1. Copy this class to your project
    2. Inherit this class and implement run_backend() and run_client_communication() methods
    3. Call start() method in main program entry

    Example:
        class MyLauncher(SingletonLauncher):
            def run_backend(self):
                # Implement backend logic
                pass

            def run_client_communication(self):
                # Implement client communication logic
                pass

        launcher = MyLauncher(host='localhost', port=9999)
        launcher.start()
    """

    # Hardcoded Configuration
    DEFAULT_HOST = 'localhost'
    DEFAULT_PORT = 19999  # Default singleton detection port
    DEFAULT_TIMEOUT = 2   # Detection timeout (seconds)

    # Communication Protocol Constants
    SIGNAL_CHECK = 'INSTANCE_CHECK'      # Instance detection signal
    SIGNAL_ALIVE = 'INSTANCE_ALIVE'      # Instance alive response
    SIGNAL_SHUTDOWN = 'SHUTDOWN'         # Shutdown signal

    def __init__(
        self,
        host: str = DEFAULT_HOST,
        port: int = DEFAULT_PORT,
        timeout: int = DEFAULT_TIMEOUT,
        debug: bool = False
    ):
        """
        Initialize singleton launcher

        Args:
            host: Listen address (default: localhost)
            port: Listen port (default: 19999)
            timeout: Detection timeout (default: 2 seconds)
            debug: Whether to enable debug output
        """
        self.host = host
        self.port = port
        self.timeout = timeout
        self.debug = debug

        # Running state
        self._running = False
        self._is_primary_instance = False

        # Thread objects
        self._backend_thread: Optional[threading.Thread] = None
        self._communication_thread: Optional[threading.Thread] = None

        # Server socket (only used by primary instance)
        self._server_socket: Optional[socket.socket] = None

        # Event callbacks
        self._on_primary_started: Optional[Callable] = None
        self._on_secondary_started: Optional[Callable] = None
        self._on_shutdown: Optional[Callable] = None

    def _log(self, message: str, level: str = 'INFO'):
        """Output log"""
        if self.debug or level in ['ERROR', 'WARNING']:
            print(f"[{level}] SingletonLauncher: {message}")

    def _check_instance_exists(self) -> bool:
        """
        Check if an instance is already running

        Returns:
            True: Instance already running
            False: No instance running
        """
        try:
            # Try to connect to specified port
            client_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            client_socket.settimeout(self.timeout)

            self._log(f"Checking instance: {self.host}:{self.port}")
            client_socket.connect((self.host, self.port))

            # Send detection signal
            message = json.dumps({
                'type': self.SIGNAL_CHECK,
                'timestamp': time.time()
            }).encode('utf-8')

            client_socket.sendall(message + b'\n')

            # Wait for response
            response = client_socket.recv(1024).decode('utf-8')
            response_data = json.loads(response.strip())

            client_socket.close()

            # Check if received alive response
            if response_data.get('type') == self.SIGNAL_ALIVE:
                self._log("Detected existing instance running", 'WARNING')
                return True

            return False

        except (socket.timeout, socket.error, ConnectionRefusedError) as e:
            self._log(f"No instance detected: {e}")
            return False
        except Exception as e:
            self._log(f"Error during detection: {e}", 'ERROR')
            return False

    def _start_server_socket(self) -> bool:
        """
        Start server socket (for singleton detection)

        Returns:
            True: Started successfully
            False: Failed to start (port in use)
        """
        try:
            self._server_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            self._server_socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            self._server_socket.bind((self.host, self.port))
            self._server_socket.listen(5)
            self._server_socket.settimeout(1.0)  # Set timeout to allow shutdown response

            self._log(f"Server socket started successfully: {self.host}:{self.port}")
            return True

        except OSError as e:
            self._log(f"Server socket startup failed: {e}", 'ERROR')
            return False

    def _handle_client_connection(self, client_socket: socket.socket, address):
        """
        Handle client connection (singleton detection)

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

            # Respond to instance detection
            if msg_type == self.SIGNAL_CHECK:
                response = json.dumps({
                    'type': self.SIGNAL_ALIVE,
                    'timestamp': time.time(),
                    'pid': sys.platform
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

        except Exception as e:
            self._log(f"Error handling client connection: {e}", 'ERROR')

        finally:
            client_socket.close()

    def _server_socket_loop(self):
        """Server socket listening loop (primary instance)"""
        self._log("Server socket listening loop started")

        while self._running:
            try:
                client_socket, address = self._server_socket.accept()
                # Use new thread to handle connection
                threading.Thread(
                    target=self._handle_client_connection,
                    args=(client_socket, address),
                    daemon=True
                ).start()

            except socket.timeout:
                continue  # Timeout, continue loop

            except Exception as e:
                if self._running:
                    self._log(f"Server socket error: {e}", 'ERROR')
                break

        self._log("Server socket listening loop ended")

    def _backend_thread_entry(self):
        """Backend thread entry"""
        self._log("Backend thread started")

        try:
            # Start server socket first (singleton detection)
            self._server_socket_loop()

            # Run user-defined backend logic
            self.run_backend()

        except Exception as e:
            self._log(f"Backend thread exception: {e}", 'ERROR')

        finally:
            self._log("Backend thread ended")

    def _communication_thread_entry(self):
        """Client communication thread entry"""
        self._log("Client communication thread started")

        try:
            self.run_client_communication()

        except Exception as e:
            self._log(f"Client communication thread exception: {e}", 'ERROR')

        finally:
            self._log("Client communication thread ended")

    # ============================================
    # Methods to be implemented
    # ============================================

    def run_backend(self):
        """
        Run backend main logic (needs to be implemented by subclass)

        This method runs in the backend main thread, implementing your core business logic.
        Only runs in the primary instance (first started instance).

        Example:
            def run_backend(self):
                while self._running:
                    # Execute backend tasks
                    time.sleep(1)
        """
        raise NotImplementedError("Please implement run_backend() method")

    def run_client_communication(self):
        """
        Run client communication logic (needs to be implemented by subclass)

        This method runs in the client communication thread, handling communication with clients.
        Runs in all instances (primary and secondary instances).

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
        Start application

        Returns:
            True: Started successfully (as primary or secondary instance)
            False: Failed to start
        """
        if self._running:
            self._log("Application already running", 'WARNING')
            return False

        self._log("=== Singleton launcher starting ===")

        # Check if instance already exists
        instance_exists = self._check_instance_exists()

        if instance_exists:
            # Instance exists, start as secondary instance
            self._log("Primary instance detected, starting as secondary instance", 'WARNING')
            self._is_primary_instance = False

            # Trigger secondary instance startup callback
            if self._on_secondary_started:
                self._on_secondary_started()

        else:
            # No instance running, start as primary instance
            self._log("No primary instance detected, starting as primary instance")
            self._is_primary_instance = True

            # Start server socket
            if not self._start_server_socket():
                self._log("Cannot start server socket, startup failed", 'ERROR')
                return False

            # Start backend thread
            self._backend_thread = threading.Thread(
                target=self._backend_thread_entry,
                name="BackendThread",
                daemon=False
            )

            # Trigger primary instance startup callback
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

        self._log(f"=== Startup complete (Primary instance: {self._is_primary_instance}) ===")
        return True

    def stop(self):
        """Stop application"""
        if not self._running:
            return

        self._log("=== Starting application shutdown ===")

        self._running = False

        # Trigger shutdown callback
        if self._on_shutdown:
            self._on_shutdown()

        # Wait for threads to end
        if self._communication_thread:
            self._communication_thread.join(timeout=5)

        if self._backend_thread:
            self._backend_thread.join(timeout=5)

        # Close server socket
        if self._server_socket:
            try:
                self._server_socket.close()
            except:
                pass

        self._log("=== Application stopped ===")

    def is_running(self) -> bool:
        """Check if running"""
        return self._running

    def is_primary_instance(self) -> bool:
        """Check if primary instance"""
        return self._is_primary_instance

    # ============================================
    # Event Callback Setters
    # ============================================

    def on_primary_started(self, callback: Callable):
        """Set primary instance startup callback"""
        self._on_primary_started = callback
        return self

    def on_secondary_started(self, callback: Callable):
        """Set secondary instance startup callback"""
        self._on_secondary_started = callback
        return self

    def on_shutdown(self, callback: Callable):
        """Set shutdown callback"""
        self._on_shutdown = callback
        return self


# ============================================
# Usage Example
# ============================================

class ExampleLauncher(SingletonLauncher):
    """Example implementation"""

    def run_backend(self):
        """Backend logic example"""
        print("Backend thread starting...")
        counter = 0
        while self._running:
            counter += 1
            print(f"Backend task executing... (count: {counter})")
            time.sleep(2)
        print("Backend thread ended")

    def run_client_communication(self):
        """Client communication logic example"""
        print("Client communication thread starting...")
        counter = 0
        while self._running:
            counter += 1
            print(f"Client communication processing... (count: {counter})")
            time.sleep(3)
        print("Client communication thread ended")


def main():
    """Example main function"""
    print("=== SingletonLauncher Usage Example ===\n")

    # Create launcher instance
    launcher = ExampleLauncher(
        host='localhost',
        port=19999,
        debug=True
    )

    # Set callbacks
    launcher.on_primary_started(lambda: print("✓ Started as primary instance"))
    launcher.on_secondary_started(lambda: print("✓ Started as secondary instance"))
    launcher.on_shutdown(lambda: print("✓ Application shutting down"))

    # Start
    if launcher.start():
        try:
            # Keep main thread running
            print("\nApplication running, press Ctrl+C to stop...\n")
            while launcher.is_running():
                time.sleep(1)

        except KeyboardInterrupt:
            print("\nReceived interrupt signal")

        finally:
            launcher.stop()
    else:
        print("Startup failed!")


if __name__ == '__main__':
    main()
