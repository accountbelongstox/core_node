# -*- coding: utf-8 -*-
"""
Heartbeat Manager
Manages WebSocket connection heartbeats for client liveness detection
"""

import time
import threading
from typing import Dict, Callable, Optional
from pycore.pyfoundations.color_print import ColorPrint
from pycore.pygvar import WS_RPC_CONSTANTS

MSG_TYPES = WS_RPC_CONSTANTS.MESSAGE_TYPES
DEFAULTS = WS_RPC_CONSTANTS.DEFAULTS


class HeartbeatManager:
    """Manages heartbeat mechanism for WebSocket connections"""

    def __init__(self, options: Optional[Dict] = None):
        """
        Initialize heartbeat manager

        Args:
            options: Configuration options including interval, timeout, callbacks
        """
        options = options or {}
        self.interval = options.get('interval', DEFAULTS['HEARTBEAT_INTERVAL'])
        self.timeout = options.get('timeout', DEFAULTS['HEARTBEAT_TIMEOUT'])
        self.on_timeout = options.get('on_timeout', lambda client_id: None)
        self.on_pong = options.get('on_pong', lambda client_id, latency: None)
        self.debug = options.get('debug', False)

        self.timers: Dict[str, Dict] = {}
        self.last_pong_time: Dict[str, float] = {}
        self.missed_pongs: Dict[str, int] = {}
        self.max_missed_pongs = 3
        self._lock = threading.Lock()

    def start(self, client_id: str, send_function: Callable):
        """
        Start heartbeat for a client

        Args:
            client_id: Unique client identifier
            send_function: Function to send ping messages
        """
        with self._lock:
            if client_id in self.timers:
                ColorPrint.debug(f"Heartbeat already running for {client_id}")
                return

            self.last_pong_time[client_id] = time.time()
            self.missed_pongs[client_id] = 0

            # Start interval timer
            timer = threading.Timer(self.interval, self._send_ping_loop, [client_id, send_function])
            timer.daemon = True
            timer.start()

            self.timers[client_id] = {
                'interval_timer': timer,
                'timeout_timer': None,
                'send_function': send_function
            }

            ColorPrint.debug(f"Heartbeat started for {client_id}")

    def stop(self, client_id: str):
        """
        Stop heartbeat for a client

        Args:
            client_id: Unique client identifier
        """
        with self._lock:
            if client_id in self.timers:
                timer_data = self.timers[client_id]
                if timer_data['interval_timer']:
                    timer_data['interval_timer'].cancel()
                if timer_data['timeout_timer']:
                    timer_data['timeout_timer'].cancel()

                del self.timers[client_id]
                self.last_pong_time.pop(client_id, None)
                self.missed_pongs.pop(client_id, None)

                ColorPrint.debug(f"Heartbeat stopped for {client_id}")

    def received_pong(self, client_id: str, data: Optional[Dict] = None):
        """
        Handle pong received from client

        Args:
            client_id: Unique client identifier
            data: Pong message data
        """
        data = data or {}
        with self._lock:
            if client_id not in self.timers:
                return

            timer_data = self.timers[client_id]
            if timer_data['timeout_timer']:
                timer_data['timeout_timer'].cancel()
                timer_data['timeout_timer'] = None

            now = time.time()
            last_pong = self.last_pong_time.get(client_id, now)
            latency = (now - data.get('timestamp', last_pong)) * 1000  # Convert to ms

            self.last_pong_time[client_id] = now
            self.missed_pongs[client_id] = 0

            ColorPrint.debug(f"Pong received from {client_id}, latency: {latency:.2f}ms")
            self.on_pong(client_id, latency)

    def get_latency(self, client_id: str) -> Optional[float]:
        """
        Get current latency for a client

        Args:
            client_id: Unique client identifier

        Returns:
            Latency in milliseconds or None
        """
        last_pong = self.last_pong_time.get(client_id)
        if not last_pong:
            return None
        return (time.time() - last_pong) * 1000

    def get_stats(self, client_id: str) -> Dict:
        """
        Get heartbeat statistics for a client

        Args:
            client_id: Unique client identifier

        Returns:
            Dictionary with heartbeat statistics
        """
        return {
            'last_pong_time': self.last_pong_time.get(client_id),
            'missed_pongs': self.missed_pongs.get(client_id, 0),
            'latency': self.get_latency(client_id)
        }

    def stop_all(self):
        """Stop all heartbeats"""
        with self._lock:
            client_ids = list(self.timers.keys())
            for client_id in client_ids:
                self.stop(client_id)

    def _send_ping_loop(self, client_id: str, send_function: Callable):
        """Internal method to send ping messages"""
        try:
            with self._lock:
                if client_id not in self.timers:
                    return

                message = {
                    'type': MSG_TYPES['PING'],
                    'timestamp': time.time()
                }

                try:
                    send_function(message)
                    ColorPrint.debug(f"Ping sent to {client_id}")

                    # Start timeout timer
                    timeout_timer = threading.Timer(self.timeout, self._handle_timeout, [client_id])
                    timeout_timer.daemon = True
                    timeout_timer.start()
                    self.timers[client_id]['timeout_timer'] = timeout_timer

                except Exception as e:
                    ColorPrint.red(f"Failed to send ping to {client_id}: {e}")

                # Schedule next ping
                interval_timer = threading.Timer(self.interval, self._send_ping_loop, [client_id, send_function])
                interval_timer.daemon = True
                interval_timer.start()
                self.timers[client_id]['interval_timer'] = interval_timer

        except Exception as e:
            ColorPrint.red(f"Error in ping loop for {client_id}: {e}")

    def _handle_timeout(self, client_id: str):
        """Internal method to handle heartbeat timeout"""
        with self._lock:
            missed = self.missed_pongs.get(client_id, 0) + 1
            self.missed_pongs[client_id] = missed

            ColorPrint.yellow(f"Heartbeat timeout for {client_id}, missed pongs: {missed}")

            if missed >= self.max_missed_pongs:
                ColorPrint.red(f"Client {client_id} exceeded max missed pongs, disconnecting")
                self.stop(client_id)
                self.on_timeout(client_id)
