# -*- coding: utf-8 -*-
"""
IPC Server - Inter-Process Communication Server

Provides single instance enforcement and remote control via socket.

Features:
- Single instance check and enforcement
- Remote commands: restart, shutdown, set_primary, set_secondary
- Non-blocking socket server
- Thread-safe command handling

Port: 45678 (configurable)
"""

import socket
import threading
import json
import time
from typing import Optional, Callable, Dict

DEFAULT_IPC_PORT = 45678


class IPCServer:
    """
    IPC Server for single instance control and remote commands.

    Usage:
        def on_restart():
            print("Restarting application...")

        ipc = IPCServer(port=45678)
        ipc.register_handler('restart', on_restart)
        ipc.start()
    """

    def __init__(self, port: int = DEFAULT_IPC_PORT):
        """
        Initialize IPC server.

        Args:
            port: Port number for IPC socket
        """
        self.port = port
        self.running = False
        self.server_socket: Optional[socket.socket] = None
        self.server_thread: Optional[threading.Thread] = None
        self.handlers: Dict[str, Callable] = {}

    def is_already_running(self) -> bool:
        """
        Check if another instance is already running.

        Returns:
            True if another instance detected
        """
        test_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        test_socket.settimeout(1)

        try:
            test_socket.connect(('127.0.0.1', self.port))
            test_socket.close()
            return True
        except (socket.error, socket.timeout):
            return False
        finally:
            test_socket.close()

    def send_command(self, command: str, data: Optional[Dict] = None) -> bool:
        """
        Send command to running instance.

        Args:
            command: Command name (restart, shutdown, etc.)
            data: Optional command data

        Returns:
            True if command sent successfully
        """
        client_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        client_socket.settimeout(2)

        try:
            client_socket.connect(('127.0.0.1', self.port))

            message = {
                'command': command,
                'data': data or {},
                'timestamp': time.time()
            }

            client_socket.sendall(json.dumps(message).encode('utf-8'))

            # Wait for response
            response = client_socket.recv(1024).decode('utf-8')
            result = json.loads(response)

            return result.get('status') == 'ok'
        except Exception as e:
            print(f"[IPCServer] Failed to send command: {e}")
            return False
        finally:
            client_socket.close()

    def register_handler(self, command: str, handler: Callable):
        """
        Register command handler.

        Args:
            command: Command name
            handler: Handler function (takes data dict as parameter)
        """
        self.handlers[command] = handler

    def start(self) -> bool:
        """
        Start IPC server in background thread.

        Returns:
            True if started successfully
        """
        if self.running:
            return True

        # Create server socket
        try:
            self.server_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            self.server_socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            self.server_socket.bind(('127.0.0.1', self.port))
            self.server_socket.listen(5)
            self.server_socket.settimeout(1)
        except Exception as e:
            print(f"[IPCServer] Failed to bind port {self.port}: {e}")
            return False

        self.running = True
        self.server_thread = threading.Thread(target=self._server_loop, daemon=True)
        self.server_thread.start()

        print(f"[IPCServer] Started on port {self.port}")
        return True

    def stop(self):
        """Stop IPC server."""
        self.running = False

        if self.server_socket:
            self.server_socket.close()

        if self.server_thread and self.server_thread.is_alive():
            self.server_thread.join(timeout=2)

        print("[IPCServer] Stopped")

    def _server_loop(self):
        """Server main loop (runs in background thread)."""
        while self.running:
            try:
                client_socket, addr = self.server_socket.accept()
                threading.Thread(
                    target=self._handle_client,
                    args=(client_socket,),
                    daemon=True
                ).start()
            except socket.timeout:
                continue
            except Exception as e:
                if self.running:
                    print(f"[IPCServer] Error accepting connection: {e}")

    def _handle_client(self, client_socket: socket.socket):
        """
        Handle client connection.

        Args:
            client_socket: Client socket
        """
        try:
            # Receive message
            data = client_socket.recv(4096).decode('utf-8')
            message = json.loads(data)

            command = message.get('command')
            command_data = message.get('data', {})

            # Execute handler
            if command in self.handlers:
                handler = self.handlers[command]
                threading.Thread(
                    target=handler,
                    args=(command_data,),
                    daemon=True
                ).start()

                response = {'status': 'ok', 'message': f'Command {command} executed'}
            else:
                response = {'status': 'error', 'message': f'Unknown command: {command}'}

            # Send response
            client_socket.sendall(json.dumps(response).encode('utf-8'))
        except Exception as e:
            error_response = {'status': 'error', 'message': str(e)}
            client_socket.sendall(json.dumps(error_response).encode('utf-8'))
        finally:
            client_socket.close()


# Convenience functions
def check_single_instance(port: int = DEFAULT_IPC_PORT) -> bool:
    """
    Check if application is already running.

    Args:
        port: IPC port

    Returns:
        True if already running
    """
    ipc = IPCServer(port=port)
    return ipc.is_already_running()


def send_restart_command(port: int = DEFAULT_IPC_PORT) -> bool:
    """
    Send restart command to running instance.

    Args:
        port: IPC port

    Returns:
        True if command sent successfully
    """
    ipc = IPCServer(port=port)
    return ipc.send_command('restart')


def send_shutdown_command(port: int = DEFAULT_IPC_PORT) -> bool:
    """
    Send shutdown command to running instance.

    Args:
        port: IPC port

    Returns:
        True if command sent successfully
    """
    ipc = IPCServer(port=port)
    return ipc.send_command('shutdown')
