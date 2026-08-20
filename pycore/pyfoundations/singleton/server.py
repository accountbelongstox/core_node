#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Singleton PRIMARY-side TCP Server Mixin

``_SingletonServerMixin`` owns the PRIMARY side of the cross-process singleton
protocol: binding a port, spawning the listener thread, handling inbound
CHECK/STATUS/SHUTDOWN/PING messages, and tearing the server down.

It is a *mixin*: it relies on the host class (SingletonDetector) to provide the
shared state and helpers set up by ``SingletonDetector.__init__``:
    self.app_id, self.started_at, self.on_message, self.state_checker,
    self._is_primary, self._bound_port, self._server_socket,
    self._listener_thread, self.timeout
    self._log(), self._create_message(), self._validate_message()
Mixing in (rather than composing) keeps the bind/listen lifecycle coherent with
the detector's PRIMARY/SECONDARY state and preserves the existing public API
(SingletonDetector._try_bind_port / .stop / .is_primary / .get_port).

THREAD_BUS Integration:
- Registers a shutdown handler (priority=95) on successful bind
- Checks THREAD_BUS.is_shutdown_requested() in the listener loop
- Fires 'singleton.message_received' / 'singleton.superseded' events
"""

import socket
import json
import time
from typing import Optional

from pycore.pyfoundations.thread_bus.bus import THREAD_BUS
from pycore.pyfoundations.serialized_worker import start_bus_task
from pycore.pyfoundations.singleton.protocol import MessageType


class _SingletonServerMixin:
    """PRIMARY-side TCP server for the cross-process singleton protocol.

    Mixed into SingletonDetector; not standalone. See module docstring.
    """

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
            self._running_signal = f"singleton.running.{self.app_id}.{port}"
            THREAD_BUS.signal(self._running_signal, True)
            self._register_process_owner()

            self._log(f"[SUCCESS] Bound to port {port} (PRIMARY instance)")

            # Start listener thread
            self._listener_thread = start_bus_task(
                self._listener_loop,
                thread_name=f"SingletonDetector-{self.app_id}",
            )

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
            if self._server_socket is not None:
                self._server_socket.close()
                self._server_socket = None
            self._log(f"Port {port}: Failed to bind - {e}", "ERROR")
            return False

    def _listener_loop(self):
        """
        Socket listener loop (PRIMARY instance only)

        THREAD_BUS Integration:
        - Checks THREAD_BUS.is_shutdown_requested() for graceful shutdown
        """
        self._log("Listener thread started")

        while THREAD_BUS.get_signal(self._running_signal, False):
            # THREAD_BUS Integration: Check if global shutdown was requested
            if THREAD_BUS.is_shutdown_requested():
                self._log("[THREAD_BUS] Shutdown detected, stopping listener...", "WARNING")
                break

            try:
                client_socket, address = self._server_socket.accept()
                # Handle in new thread
                start_bus_task(
                    self._handle_client,
                    client_socket,
                    address,
                    thread_name=f"SingletonClient-{self.app_id}",
                )
            except socket.timeout:
                continue
            except Exception as e:
                if THREAD_BUS.get_signal(self._running_signal, False):
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
                # Newest-wins takeover: a SHUTDOWN from a sibling means the user
                # launched a NEWER instance. Always accept and shut down
                # gracefully (execute_handlers=True still runs every shutdown
                # handler, so in-flight work can flush/save) - the newer instance
                # is the user's latest intent. Busy state is still reported via
                # STATUS for external monitors, but never blocks a sibling
                # takeover (that would leave the user's new launch unable to run).
                new_pid = message.get('pid')

                # Newest-wins guard (receiver side): only yield to a genuinely
                # NEWER instance. A SHUTDOWN from an OLDER sibling (a late boot-
                # autostart instance, a stray/duplicate, or a takeover race
                # against a just-bound PRIMARY) must NOT kill this newer process.
                # Senders that omit started_at are legacy -> accept (backward
                # compatible). Strict '<' so an exact tie still allows takeover
                # (avoids a mutual-reject deadlock on the import-time fallback).
                sender_started = message.get('started_at')
                if sender_started is not None and float(sender_started) < self.started_at:
                    self._log(
                        f"[REJECT] SHUTDOWN from OLDER instance (PID {new_pid}, started "
                        f"{float(sender_started):.3f} < ours {self.started_at:.3f}); "
                        "keeping this newer instance alive", "WARNING")
                    response = self._create_message(
                        MessageType.SHUTDOWN_ACK,
                        accepted=False,
                        reason="A newer instance is already running"
                    )
                    response_data = json.dumps(response).encode('utf-8')
                    client_socket.sendall(response_data + b'\n')
                    return

                self._log(f"Takeover SHUTDOWN from PID {new_pid}; yielding to newer instance", "WARNING")

                # Notification interface (the "old instance" side): fire
                # 'singleton.superseded' BEFORE the ACK so app code subscribed via
                # on_singleton_superseded() can react while graceful shutdown runs.
                THREAD_BUS.trigger_event('singleton.superseded', {
                    'app_id': self.app_id,
                    'new_pid': new_pid,
                }, async_mode=True)

                response = self._create_message(
                    MessageType.SHUTDOWN_ACK,
                    accepted=True,
                    reason="Shutdown accepted (newer instance takes over)"
                )
                response_data = json.dumps(response).encode('utf-8')
                client_socket.sendall(response_data + b'\n')

                # Ensure the ACK is flushed before teardown (benign if already closed).
                try:
                    client_socket.shutdown(socket.SHUT_WR)
                except OSError:
                    pass

                def trigger_shutdown():
                    time.sleep(0.3)  # let the ACK reach the new instance first
                    if self.on_shutdown_request:
                        self.on_shutdown_request()
                    THREAD_BUS.request_shutdown(
                        reason=f"Superseded by newer instance (PID {new_pid})",
                        execute_handlers=True
                    )

                start_bus_task(
                    trigger_shutdown,
                    thread_name=f"SingletonShutdown-{self.app_id}",
                )

            elif msg_type == MessageType.PING.value:
                # Send PONG
                response = self._create_message(MessageType.PONG)
                response_data = json.dumps(response).encode('utf-8')
                client_socket.sendall(response_data + b'\n')

        except Exception as e:
            self._log(f"Error handling client: {e}", "ERROR")
        finally:
            client_socket.close()

    def stop(self):
        """Stop detector and close socket"""
        if hasattr(self, "_running_signal"):
            THREAD_BUS.signal(self._running_signal, False)
        if self._server_socket:
            self._server_socket.close()
            self._server_socket = None
        if self._listener_thread:
            self._listener_thread.join(timeout=2.0)
            self._listener_thread = None
        self._is_primary = False
        self._bound_port = None
        self._unregister_process_owner()
        self._log("Detector stopped")

    def is_primary(self) -> bool:
        """Check if this is PRIMARY instance"""
        return self._is_primary

    def get_port(self) -> Optional[int]:
        """Get bound port (PRIMARY only)"""
        return self._bound_port


__all__ = ['_SingletonServerMixin']
