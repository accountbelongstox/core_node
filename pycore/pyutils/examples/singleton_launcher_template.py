# -*- coding: utf-8 -*-
"""
Singleton Launcher Template

COPY THIS FILE TO YOUR CLIENT PROJECT
======================================
This is a standalone template that can be copied to any Python project.
It only uses Python standard library (no external dependencies).

Usage:
1. Copy this file to your client project
2. Implement run_backend() and run_client_communication() methods
3. Run it: python your_launcher.py

Features:
- Singleton pattern: Only one backend instance runs
- Dual-thread architecture: Backend + Client communication
- Auto-detection: Detects existing instances automatically
- Resource sharing: Multiple clients share one backend
- Pure Python: Only uses standard library

Example Use Cases:
- Desktop applications with multiple client windows
- Services that need singleton backend
- Tools with GUI + background worker
- Multi-process applications sharing resources
"""

import socket
import json
import time
import sys
from typing import Any, Optional, Callable
from pycore.pyfoundations.serialized_worker import start_bus_task
from pycore.pyfoundations.thread_bus import THREAD_BUS


class SingletonLauncher:
    """
    Singleton Launcher Template

    IMPORTANT: Copy this class to your project and implement:
    - run_backend(): Your backend logic (primary instance only)
    - run_client_communication(): Your client communication logic (all instances)

    Example:
        class MyApp(SingletonLauncher):
            def run_backend(self):
                # Your backend code here
                while self.is_running():
                    print("Backend working...")
                    time.sleep(1)

            def run_client_communication(self):
                # Your client code here
                while self.is_running():
                    print("Client working...")
                    time.sleep(1)

        app = MyApp(port=19999)
        app.start()
    """

    # Configuration constants (modify as needed)
    DEFAULT_HOST = 'localhost'
    DEFAULT_PORT = 19999
    DEFAULT_TIMEOUT = 2

    # Protocol signals
    SIGNAL_CHECK = 'INSTANCE_CHECK'
    SIGNAL_ALIVE = 'INSTANCE_ALIVE'
    SIGNAL_SHUTDOWN = 'SHUTDOWN'

    def __init__(
        self,
        host: str = DEFAULT_HOST,
        port: int = DEFAULT_PORT,
        timeout: int = DEFAULT_TIMEOUT,
        debug: bool = False
    ):
        """
        Initialize Singleton Launcher

        Args:
            host: Host address for singleton detection (default: localhost)
            port: Port for singleton detection (default: 19999)
            timeout: Detection timeout in seconds (default: 2)
            debug: Enable debug output (default: False)
        """
        self.host = host
        self.port = port
        self.timeout = timeout
        self.debug = debug

        # Runtime state
        self._is_primary_instance = False

        # Threads
        self._backend_thread: Optional[Any] = None
        self._communication_thread: Optional[Any] = None
        self._running_signal = f"example.singleton_template.running.{id(self)}"
        THREAD_BUS.signal(self._running_signal, False)

        # Server socket (primary instance only)
        self._server_socket: Optional[socket.socket] = None

        # Callbacks
        self._on_primary_started: Optional[Callable] = None
        self._on_secondary_started: Optional[Callable] = None
        self._on_shutdown: Optional[Callable] = None

    def _log(self, message: str, level: str = 'INFO'):
        """Print log message"""
        if self.debug or level in ['ERROR', 'WARNING']:
            timestamp = time.strftime('%Y-%m-%d %H:%M:%S')
            print(f"[{timestamp}] [{level}] Launcher: {message}")

    def _check_instance_exists(self) -> bool:
        """
        Check if an instance is already running

        Returns:
            bool: True if instance exists, False otherwise
        """
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(self.timeout)
            sock.connect((self.host, self.port))

            # Send check signal
            message = json.dumps({
                'type': self.SIGNAL_CHECK,
                'timestamp': time.time()
            }).encode('utf-8')
            sock.sendall(message + b'\n')

            # Wait for response
            response = sock.recv(1024).decode('utf-8')
            data = json.loads(response.strip())

            sock.close()

            return data.get('type') == self.SIGNAL_ALIVE

        except (socket.timeout, socket.error, ConnectionRefusedError):
            return False
        except Exception as e:
            self._log(f"Error checking instance: {e}", 'ERROR')
            return False

    def _start_server_socket(self) -> bool:
        """
        Start server socket for singleton detection

        Returns:
            bool: True if started successfully
        """
        try:
            self._server_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            self._server_socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            self._server_socket.bind((self.host, self.port))
            self._server_socket.listen(5)
            self._server_socket.settimeout(1.0)
            self._log(f"Server socket started: {self.host}:{self.port}")
            return True
        except OSError as e:
            self._log(f"Failed to start server socket: {e}", 'ERROR')
            return False

    def _handle_client_connection(self, client_socket: socket.socket, address):
        """Handle incoming singleton detection connections"""
        try:
            data = client_socket.recv(1024).decode('utf-8')
            if not data:
                return

            message = json.loads(data.strip())
            msg_type = message.get('type')

            if msg_type == self.SIGNAL_CHECK:
                # Respond to instance check
                response = json.dumps({
                    'type': self.SIGNAL_ALIVE,
                    'timestamp': time.time()
                }).encode('utf-8')
                client_socket.sendall(response + b'\n')

            elif msg_type == self.SIGNAL_SHUTDOWN:
                # Handle shutdown request
                THREAD_BUS.signal(self._running_signal, False)
                response = json.dumps({
                    'type': 'SHUTDOWN_ACK',
                    'timestamp': time.time()
                }).encode('utf-8')
                client_socket.sendall(response + b'\n')

        except Exception as e:
            self._log(f"Error handling connection: {e}", 'ERROR')
        finally:
            client_socket.close()

    def _socket_listener_loop(self):
        """Socket listener loop (runs in backend thread)"""
        self._log("Socket listener started")
        while THREAD_BUS.get_signal(self._running_signal, False):
            try:
                client_socket, address = self._server_socket.accept()
                start_bus_task(
                    self._handle_client_connection,
                    client_socket,
                    address,
                    thread_name="TemplateSingletonClientThread",
                )
            except socket.timeout:
                continue
            except Exception as e:
                if self.is_running():
                    self._log(f"Socket listener error: {e}", 'ERROR')
                break
        self._log("Socket listener stopped")

    def _backend_thread_entry(self):
        """Backend thread entry point"""
        self._log("Backend thread started")
        try:
            # Start socket listener
            listener_thread = start_bus_task(
                self._socket_listener_loop,
                thread_name="TemplateSocketListenerThread",
            )

            # Run user backend logic
            self.run_backend()

        except Exception as e:
            self._log(f"Backend thread error: {e}", 'ERROR')
        finally:
            self._log("Backend thread stopped")

    def _communication_thread_entry(self):
        """Client communication thread entry point"""
        self._log("Communication thread started")
        try:
            self.run_client_communication()
        except Exception as e:
            self._log(f"Communication thread error: {e}", 'ERROR')
        finally:
            self._log("Communication thread stopped")

    # ================================================
    # IMPLEMENT THESE METHODS IN YOUR SUBCLASS
    # ================================================

    def run_backend(self):
        """
        Backend logic (primary instance only)

        Implement your backend logic here. This runs in a separate thread
        and only executes in the primary (first) instance.

        Example:
            def run_backend(self):
                while self.is_running():
                    # Do backend work
                    print("Backend running...")
                    time.sleep(1)
        """
        raise NotImplementedError("Implement run_backend() in your subclass")

    def run_client_communication(self):
        """
        Client communication logic (all instances)

        Implement your client communication logic here. This runs in a separate
        thread and executes in all instances (primary and secondary).

        Example:
            def run_client_communication(self):
                while self.is_running():
                    # Handle client communication
                    print("Client running...")
                    time.sleep(1)
        """
        raise NotImplementedError("Implement run_client_communication() in your subclass")

    # ================================================
    # PUBLIC INTERFACE
    # ================================================

    def start(self) -> bool:
        """
        Start the application

        Returns:
            bool: True if started successfully
        """
        if self.is_running():
            self._log("Already running", 'WARNING')
            return False

        self._log("=== Starting Singleton Launcher ===")

        # Check for existing instance
        instance_exists = self._check_instance_exists()

        if instance_exists:
            # Start as secondary instance
            self._log("Existing instance found, starting as secondary", 'WARNING')
            self._is_primary_instance = False

            if self._on_secondary_started:
                self._on_secondary_started()

        else:
            # Start as primary instance
            self._log("No existing instance, starting as primary")
            self._is_primary_instance = True

            # Start server socket
            if not self._start_server_socket():
                self._log("Failed to start server socket", 'ERROR')
                return False

            if self._on_primary_started:
                self._on_primary_started()

        # Start
        THREAD_BUS.signal(self._running_signal, True)

        if self._is_primary_instance:
            self._backend_thread = start_bus_task(
                self._backend_thread_entry,
                thread_name="BackendThread",
                daemon=False,
            )

        self._communication_thread = start_bus_task(
            self._communication_thread_entry,
            thread_name="CommunicationThread",
            daemon=False,
        )

        self._log(f"=== Started (Primary: {self._is_primary_instance}) ===")
        return True

    def stop(self):
        """Stop the application"""
        if not self.is_running():
            return

        self._log("=== Stopping ===")
        THREAD_BUS.signal(self._running_signal, False)

        if self._on_shutdown:
            self._on_shutdown()

        # Wait for threads
        if self._communication_thread:
            self._communication_thread.join(timeout=5)
        if self._backend_thread:
            self._backend_thread.join(timeout=5)

        # Close socket
        if self._server_socket:
            try:
                self._server_socket.close()
            except:
                pass

        self._log("=== Stopped ===")

    def is_running(self) -> bool:
        """Check if running"""
        return bool(THREAD_BUS.get_signal(self._running_signal, False))

    def is_primary_instance(self) -> bool:
        """Check if this is the primary instance"""
        return self._is_primary_instance

    # Callback setters
    def on_primary_started(self, callback: Callable):
        """Set callback for primary instance start"""
        self._on_primary_started = callback
        return self

    def on_secondary_started(self, callback: Callable):
        """Set callback for secondary instance start"""
        self._on_secondary_started = callback
        return self

    def on_shutdown(self, callback: Callable):
        """Set callback for shutdown"""
        self._on_shutdown = callback
        return self


# ================================================
# EXAMPLE IMPLEMENTATION
# ================================================

class ExampleApp(SingletonLauncher):
    """Example implementation - copy and modify for your needs"""

    def run_backend(self):
        """Example backend logic"""
        print("Backend started (primary instance only)")
        counter = 0
        while self.is_running():
            counter += 1
            print(f"  [Backend] Task #{counter}")
            time.sleep(2)
        print("Backend stopped")

    def run_client_communication(self):
        """Example client communication logic"""
        print("Client communication started (all instances)")
        counter = 0
        while self.is_running():
            counter += 1
            print(f"  [Client] Message #{counter}")
            time.sleep(3)
        print("Client communication stopped")


def main():
    """Example main function"""
    print("=" * 60)
    print("Singleton Launcher Example")
    print("=" * 60)
    print("\nYou can run this multiple times - only one backend will run!")
    print("Try: Open multiple terminals and run this script in each.\n")

    app = ExampleApp(port=19999, debug=True)

    # Set callbacks
    app.on_primary_started(lambda: print("→ I am the PRIMARY instance!\n"))
    app.on_secondary_started(lambda: print("→ I am a SECONDARY instance!\n"))

    # Start
    if app.start():
        try:
            print("Running... Press Ctrl+C to stop\n")
            while app.is_running():
                time.sleep(1)
        except KeyboardInterrupt:
            print("\n\nStopping...")
        finally:
            app.stop()
    else:
        print("Failed to start!")
        sys.exit(1)


if __name__ == '__main__':
    main()
