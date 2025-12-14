#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Log Broadcaster - Real-time Log Streaming Service

Broadcasts initialization logs and system messages to connected WebSocket clients.
"""

import asyncio
from typing import Set, Optional
from datetime import datetime


class LogBroadcaster:
    """
    Log Broadcaster Service

    Manages WebSocket connections and broadcasts log messages to all connected clients.
    """

    def __init__(self):
        """Initialize log broadcaster"""
        self.clients: Set = set()
        self.message_queue: asyncio.Queue = None
        self.broadcast_task: Optional[asyncio.Task] = None

    async def start(self):
        """Start the broadcaster service"""
        if self.message_queue is None:
            self.message_queue = asyncio.Queue()

        if self.broadcast_task is None or self.broadcast_task.done():
            self.broadcast_task = asyncio.create_task(self._broadcast_worker())

    async def stop(self):
        """Stop the broadcaster service"""
        if self.broadcast_task and not self.broadcast_task.done():
            self.broadcast_task.cancel()
            try:
                await self.broadcast_task
            except asyncio.CancelledError:
                pass

    async def _broadcast_worker(self):
        """Background worker to broadcast messages"""
        while True:
            try:
                message = await self.message_queue.get()
                await self._send_to_all_clients(message)
            except asyncio.CancelledError:
                break
            except Exception as e:
                print(f"[LogBroadcaster] Error in broadcast worker: {e}")

    async def _send_to_all_clients(self, message: dict):
        """Send message to all connected clients"""
        if not self.clients:
            return

        # Create tasks for all clients
        tasks = []
        for websocket in list(self.clients):
            tasks.append(self._send_to_client(websocket, message))

        # Wait for all sends to complete
        await asyncio.gather(*tasks, return_exceptions=True)

    async def _send_to_client(self, websocket, message: dict):
        """Send message to a single client"""
        try:
            await websocket.send_json(message)
        except Exception as e:
            print(f"[LogBroadcaster] Error sending to client: {e}")
            # Remove disconnected client
            self.clients.discard(websocket)

    async def register_client(self, websocket):
        """Register a new WebSocket client"""
        self.clients.add(websocket)
        print(f"[LogBroadcaster] Client connected. Total clients: {len(self.clients)}")

    async def unregister_client(self, websocket):
        """Unregister a WebSocket client"""
        self.clients.discard(websocket)
        print(f"[LogBroadcaster] Client disconnected. Total clients: {len(self.clients)}")

    def broadcast_log(self, level: str, message: str, coin: str = None):
        """
        Broadcast a log message (synchronous)

        Args:
            level: Log level (info, success, warning, error)
            message: Log message
            coin: Optional coin symbol
        """
        if self.message_queue is None:
            return

        log_data = {
            "type": "log",
            "level": level,
            "message": message,
            "timestamp": datetime.now().isoformat(),
        }

        if coin:
            log_data["coin"] = coin

        # Put message in queue (non-blocking)
        try:
            self.message_queue.put_nowait(log_data)
        except asyncio.QueueFull:
            print(f"[LogBroadcaster] Warning: Message queue is full")

    async def broadcast_log_async(self, level: str, message: str, coin: str = None):
        """
        Broadcast a log message (asynchronous)

        Args:
            level: Log level (info, success, warning, error)
            message: Log message
            coin: Optional coin symbol
        """
        if self.message_queue is None:
            return

        log_data = {
            "type": "log",
            "level": level,
            "message": message,
            "timestamp": datetime.now().isoformat(),
        }

        if coin:
            log_data["coin"] = coin

        await self.message_queue.put(log_data)


# Global instance
_log_broadcaster = None


def get_log_broadcaster() -> LogBroadcaster:
    """
    Get global log broadcaster instance

    Returns:
        LogBroadcaster: Global instance
    """
    global _log_broadcaster

    if _log_broadcaster is None:
        _log_broadcaster = LogBroadcaster()

    return _log_broadcaster
