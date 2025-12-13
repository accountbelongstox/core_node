#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
OKX WebSocket Client - Real-time Price Updates

Provides WebSocket connection to OKX for real-time ticker updates.
Features:
- Multi-connection support (240 channels per connection)
- Automatic reconnection
- Heartbeat management
- Callback-based message handling
"""

import asyncio
import json
import time
from typing import List, Callable, Optional, Dict, Set
from collections import defaultdict
import websockets
from websockets.client import WebSocketClientProtocol


class OKXWebSocketClient:
    """
    OKX WebSocket Client

    Manages WebSocket connections to OKX for real-time data.
    Supports multiple connections to handle >240 subscriptions.
    """

    # WebSocket endpoints
    WS_PUBLIC_URL = "wss://ws.okx.com:8443/ws/v5/public"
    WS_PRIVATE_URL = "wss://ws.okx.com:8443/ws/v5/private"

    # Limits
    MAX_CHANNELS_PER_CONNECTION = 240
    PING_INTERVAL = 20  # Send ping every 20 seconds
    PING_TIMEOUT = 10   # Wait 10 seconds for pong
    RECONNECT_DELAY = 5  # Wait 5 seconds before reconnecting

    def __init__(self, on_message: Optional[Callable] = None):
        """
        Initialize WebSocket client

        Args:
            on_message (Callable): Callback for ticker updates
                                  Signature: on_message(inst_id: str, ticker_data: dict)
        """
        self.on_message = on_message
        self.connections: List[WebSocketClientProtocol] = []
        self.subscribed_channels: Set[str] = set()

        # Dynamic blacklist for invalid instruments (detected at runtime)
        self.invalid_instruments: Set[str] = set()
        self.invalid_instruments_timestamp: Dict[str, float] = {}  # Track when each was blacklisted

        # Connection state
        self.running = False
        self.tasks: List[asyncio.Task] = []

        # Retry configuration (seconds)
        self.retry_interval = 3600  # Default 1 hour, can be configured

        # Statistics
        self.stats = {
            'messages_received': 0,
            'reconnections': 0,
            'last_message_time': None,
            'connections_count': 0,
            'invalid_instruments_count': 0,
            'blacklist_retries': 0  # Count of blacklist retry attempts
        }

        print("[OKXWebSocketClient] Initialized")

    def set_retry_interval(self, seconds: int):
        """
        Set the retry interval for invalid instruments

        Args:
            seconds (int): Retry interval in seconds
        """
        self.retry_interval = seconds
        print(f"[OKXWebSocketClient] Retry interval set to {seconds}s ({seconds/3600:.1f}h)")

    async def connect_and_subscribe(self, inst_ids: List[str]):
        """
        Connect to WebSocket and subscribe to tickers for given instruments

        Args:
            inst_ids (List[str]): List of instrument IDs (e.g., ["BTC-USDT", "ETH-USDT"])
        """
        print(f"\n[WebSocket] Connecting to OKX WebSocket...")
        print(f"[WebSocket] Total instruments to subscribe: {len(inst_ids)}")

        # Split instruments into batches (240 per connection)
        batches = []
        for i in range(0, len(inst_ids), self.MAX_CHANNELS_PER_CONNECTION):
            batch = inst_ids[i:i + self.MAX_CHANNELS_PER_CONNECTION]
            batches.append(batch)

        print(f"[WebSocket] Connections needed: {len(batches)}")
        print(f"[WebSocket] Distribution: {[len(b) for b in batches]}")

        self.running = True

        # Create connection tasks for each batch
        for idx, batch in enumerate(batches, 1):
            task = asyncio.create_task(
                self._maintain_connection(batch, connection_id=idx)
            )
            self.tasks.append(task)

        print(f"[WebSocket] {len(self.tasks)} connection(s) started")

    async def _maintain_connection(self, inst_ids: List[str], connection_id: int):
        """
        Maintain a single WebSocket connection with auto-reconnect

        Args:
            inst_ids (List[str]): Instruments for this connection
            connection_id (int): Connection identifier
        """
        while self.running:
            try:
                print(f"\n[WS-{connection_id}] Connecting ({len(inst_ids)} instruments)...")

                async with websockets.connect(
                    self.WS_PUBLIC_URL,
                    ping_interval=self.PING_INTERVAL,
                    ping_timeout=self.PING_TIMEOUT
                ) as websocket:
                    print(f"[WS-{connection_id}] Connected successfully")
                    self.stats['connections_count'] = len(self.connections) + 1

                    # Subscribe to tickers
                    await self._subscribe_tickers(websocket, inst_ids, connection_id)

                    # Handle messages
                    await self._handle_messages(websocket, connection_id)

            except websockets.exceptions.ConnectionClosed as e:
                print(f"[WS-{connection_id}] Connection closed: {e}")
                self.stats['reconnections'] += 1

            except Exception as e:
                print(f"[WS-{connection_id}] Error: {e}")
                self.stats['reconnections'] += 1

            if self.running:
                print(f"[WS-{connection_id}] Reconnecting in {self.RECONNECT_DELAY}s...")
                await asyncio.sleep(self.RECONNECT_DELAY)
            else:
                print(f"[WS-{connection_id}] Stopped")
                break

    async def _subscribe_tickers(self, websocket: WebSocketClientProtocol,
                                 inst_ids: List[str], connection_id: int):
        """
        Subscribe to ticker channels

        Args:
            websocket: WebSocket connection
            inst_ids: List of instrument IDs
            connection_id: Connection identifier
        """
        # Check and remove expired items from blacklist (dynamic retry mechanism)
        current_time = time.time()
        expired_instruments = []

        for inst_id in list(self.invalid_instruments):
            blacklist_time = self.invalid_instruments_timestamp.get(inst_id, 0)
            time_since_blacklist = current_time - blacklist_time

            if time_since_blacklist >= self.retry_interval:
                # Remove from blacklist and retry
                expired_instruments.append(inst_id)
                self.invalid_instruments.discard(inst_id)
                self.invalid_instruments_timestamp.pop(inst_id, None)
                self.stats['blacklist_retries'] += 1

        if expired_instruments:
            print(f"[WS-{connection_id}] RETRY Retrying {len(expired_instruments)} expired blacklist instrument(s):")
            for inst_id in expired_instruments:
                print(f"[WS-{connection_id}]    - {inst_id}")
            self.stats['invalid_instruments_count'] = len(self.invalid_instruments)

        # Filter out invalid instruments from blacklist (dynamic)
        valid_inst_ids = [
            inst_id for inst_id in inst_ids
            if inst_id not in self.invalid_instruments
        ]

        if len(valid_inst_ids) < len(inst_ids):
            skipped = len(inst_ids) - len(valid_inst_ids)
            print(f"[WS-{connection_id}] Skipping {skipped} invalid instrument(s) from blacklist")

        if not valid_inst_ids:
            print(f"[WS-{connection_id}] No valid instruments to subscribe")
            return

        # Build subscription arguments
        args = [
            {"channel": "tickers", "instId": inst_id}
            for inst_id in valid_inst_ids
        ]

        subscribe_msg = {
            "op": "subscribe",
            "args": args
        }

        # Send subscription request
        await websocket.send(json.dumps(subscribe_msg))
        print(f"[WS-{connection_id}] Subscription request sent for {len(valid_inst_ids)} instruments")

        # Wait for subscription confirmation
        response = await websocket.recv()
        response_data = json.loads(response)

        if response_data.get('event') == 'subscribe':
            print(f"[WS-{connection_id}] Subscription confirmed")
            for arg in args:
                channel_key = f"{arg['channel']}:{arg['instId']}"
                self.subscribed_channels.add(channel_key)
        else:
            print(f"[WS-{connection_id}] Subscription response: {response_data}")

    async def _handle_messages(self, websocket: WebSocketClientProtocol, connection_id: int):
        """
        Handle incoming WebSocket messages

        Args:
            websocket: WebSocket connection
            connection_id: Connection identifier
        """
        message_count = 0

        async for message in websocket:
            try:
                data = json.loads(message)

                # Update statistics
                self.stats['messages_received'] += 1
                self.stats['last_message_time'] = time.time()
                message_count += 1

                # Handle different message types
                if 'event' in data:
                    # Event messages (subscribe, error, etc.)
                    event = data.get('event')
                    if event == 'error':
                        print(f"[WS-{connection_id}] Error event: {data}")
                        # Extract invalid instrument from error message
                        self._handle_error_event(data, connection_id)
                    # Ignore other events (already handled in subscribe)

                elif 'arg' in data and 'data' in data:
                    # Data push messages
                    arg = data['arg']
                    channel = arg.get('channel')

                    if channel == 'tickers':
                        # Ticker data
                        inst_id = arg.get('instId')
                        ticker_list = data['data']

                        for ticker in ticker_list:
                            # Call callback with ticker data
                            if self.on_message:
                                try:
                                    self.on_message(inst_id, ticker)
                                except Exception as e:
                                    print(f"[WS-{connection_id}] Callback error: {e}")

                        # Progress report every 1000 messages
                        if message_count % 1000 == 0:
                            print(f"[WS-{connection_id}] Messages processed: {message_count:,}")

            except json.JSONDecodeError as e:
                print(f"[WS-{connection_id}] JSON decode error: {e}")
            except Exception as e:
                print(f"[WS-{connection_id}] Message handling error: {e}")

    def _handle_error_event(self, error_data: dict, connection_id: int):
        """
        Handle WebSocket error event and extract invalid instruments

        Args:
            error_data: Error event data from WebSocket
            connection_id: Connection identifier
        """
        # Error message format example:
        # "Wrong URL or channel:tickers,instId:EURC-USDT doesn't exist..."
        msg = error_data.get('msg', '')
        code = error_data.get('code', '')

        # Extract instrument ID from error message (dynamic parsing)
        if 'instId:' in msg and "doesn't exist" in msg:
            try:
                # Extract the instId part
                start_idx = msg.find('instId:') + 7
                end_idx = msg.find(' ', start_idx)
                if end_idx == -1:
                    end_idx = len(msg)

                inst_id = msg[start_idx:end_idx].strip()

                # Add to blacklist (dynamic detection) with timestamp
                if inst_id and inst_id not in self.invalid_instruments:
                    self.invalid_instruments.add(inst_id)
                    self.invalid_instruments_timestamp[inst_id] = time.time()
                    self.stats['invalid_instruments_count'] = len(self.invalid_instruments)
                    print(f"[WS-{connection_id}] WARNING  Blacklisted invalid instrument: {inst_id} (code: {code})")
                    print(f"[WS-{connection_id}] Will retry after {self.retry_interval}s ({self.retry_interval/3600:.1f}h)")
                    print(f"[WS-{connection_id}] Total invalid instruments: {len(self.invalid_instruments)}")

            except Exception as e:
                print(f"[WS-{connection_id}] Failed to parse error message: {e}")

    async def stop(self):
        """Stop all WebSocket connections"""
        print("\n[WebSocket] Stopping all connections...")
        self.running = False

        # Cancel all tasks
        for task in self.tasks:
            task.cancel()

        # Wait for tasks to finish
        await asyncio.gather(*self.tasks, return_exceptions=True)

        print("[WebSocket] All connections stopped")

    def get_stats(self) -> Dict:
        """
        Get WebSocket statistics

        Returns:
            Dict: Statistics including message count, reconnections, etc.
        """
        stats = self.stats.copy()
        stats['subscribed_channels'] = len(self.subscribed_channels)
        stats['running'] = self.running
        stats['active_tasks'] = len([t for t in self.tasks if not t.done()])

        return stats

    def get_invalid_instruments(self) -> Set[str]:
        """
        Get set of invalid instruments (dynamic blacklist)

        Returns:
            Set[str]: Set of instrument IDs that failed subscription
        """
        return self.invalid_instruments.copy()


async def test_websocket():
    """Test WebSocket client with a few coins"""
    print("="*80)
    print("Testing OKX WebSocket Client")
    print("="*80)

    # Test instruments
    test_instruments = [
        "BTC-USDT", "ETH-USDT", "SOL-USDT", "BNB-USDT", "XRP-USDT"
    ]

    # Message counter
    message_counts = defaultdict(int)

    def on_ticker_update(inst_id: str, ticker: dict):
        """Callback for ticker updates"""
        message_counts[inst_id] += 1

        # Print first update for each instrument
        if message_counts[inst_id] == 1:
            price = ticker.get('last')
            print(f"[TICKER] {inst_id}: ${price} (first update received)")

    # Create client
    client = OKXWebSocketClient(on_message=on_ticker_update)

    # Connect and subscribe
    await client.connect_and_subscribe(test_instruments)

    # Run for 10 seconds
    print("\n[TEST] Running for 10 seconds...")
    await asyncio.sleep(10)

    # Stop client
    await client.stop()

    # Print summary
    print("\n" + "="*80)
    print("Test Summary")
    print("="*80)
    print(f"Total messages: {client.stats['messages_received']}")
    print(f"Updates per instrument:")
    for inst_id, count in sorted(message_counts.items()):
        print(f"  {inst_id}: {count} updates")
    print("="*80)


if __name__ == '__main__':
    asyncio.run(test_websocket())
