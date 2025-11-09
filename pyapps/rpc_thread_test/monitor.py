#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
RPC Server Monitor

Real-time monitoring tool for RPC server status and performance
"""

import sys
import asyncio
import time
from pathlib import Path

# Add project root to path
PROJECT_ROOT = Path(__file__).parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from pycore import ColorPrint
from pycore.pyutils.wsrpc import WsRpcClient


class RpcMonitor:
    """RPC Server Monitor"""

    def __init__(self, host='localhost', port=8765, interval=2):
        """
        Initialize monitor

        Args:
            host: Server host
            port: Server port
            interval: Monitoring interval in seconds
        """
        self.host = host
        self.port = port
        self.interval = interval
        self.url = f'ws://{host}:{port}'
        self.client = None
        self.running = False

        # Statistics
        self.stats = {
            'total_requests': 0,
            'successful_requests': 0,
            'failed_requests': 0,
            'response_times': [],
            'start_time': time.time()
        }

    async def connect(self):
        """Connect to RPC server"""
        self.client = WsRpcClient({
            'url': self.url,
            'reconnect': True,
            'reconnect_interval': 3,
            'debug': False
        })

        try:
            await self.client.connect()
            ColorPrint.green(f"✓ Connected to {self.url}")
            return True
        except Exception as e:
            ColorPrint.red(f"✗ Failed to connect: {e}")
            return False

    async def disconnect(self):
        """Disconnect from server"""
        if self.client:
            await self.client.disconnect()
            ColorPrint.yellow("Disconnected")

    async def check_health(self):
        """Check server health"""
        start_time = time.time()

        try:
            result = await self.client.call('health_check', {}, timeout=5.0)
            response_time = (time.time() - start_time) * 1000  # ms

            self.stats['total_requests'] += 1
            self.stats['successful_requests'] += 1
            self.stats['response_times'].append(response_time)

            # Keep only last 100 response times
            if len(self.stats['response_times']) > 100:
                self.stats['response_times'].pop(0)

            return {
                'status': 'healthy' if result.get('success') else 'unhealthy',
                'response_time': response_time,
                'server_data': result
            }

        except Exception as e:
            self.stats['total_requests'] += 1
            self.stats['failed_requests'] += 1

            return {
                'status': 'error',
                'error': str(e)
            }

    async def get_server_info(self):
        """Get server information"""
        try:
            result = await self.client.call('get_info', {}, timeout=5.0)
            return result
        except Exception as e:
            return {'error': str(e)}

    def display_stats(self, health_data, server_info):
        """Display monitoring statistics"""
        # Clear screen (Windows)
        import os
        os.system('cls' if os.name == 'nt' else 'clear')

        # Header
        ColorPrint.print_header("RPC Server Monitor")

        # Connection info
        ColorPrint.blue("Server Connection:")
        ColorPrint.green(f"  URL: {self.url}")

        # Health status
        ColorPrint.blue("\nHealth Status:")
        status = health_data.get('status')
        if status == 'healthy':
            ColorPrint.green(f"  Status: {status.upper()}")
            ColorPrint.green(f"  Response Time: {health_data.get('response_time', 0):.2f} ms")
        elif status == 'error':
            ColorPrint.red(f"  Status: ERROR")
            ColorPrint.red(f"  Error: {health_data.get('error')}")
        else:
            ColorPrint.yellow(f"  Status: {status.upper()}")

        # Server info
        if not server_info.get('error'):
            ColorPrint.blue("\nServer Information:")
            server_data = server_info.get('server', {})
            ColorPrint.green(f"  Name: {server_data.get('name', 'N/A')}")
            ColorPrint.green(f"  Host: {server_data.get('host', 'N/A')}")
            ColorPrint.green(f"  Port: {server_data.get('port', 'N/A')}")

            stats_data = server_info.get('stats', {})
            ColorPrint.green(f"  Server Requests: {stats_data.get('request_count', 'N/A')}")

        # Monitor statistics
        ColorPrint.blue("\nMonitor Statistics:")
        ColorPrint.green(f"  Total Checks: {self.stats['total_requests']}")
        ColorPrint.green(f"  Successful: {self.stats['successful_requests']}")
        if self.stats['failed_requests'] > 0:
            ColorPrint.red(f"  Failed: {self.stats['failed_requests']}")
        else:
            ColorPrint.green(f"  Failed: {self.stats['failed_requests']}")

        # Response times
        if self.stats['response_times']:
            avg_response = sum(self.stats['response_times']) / len(self.stats['response_times'])
            min_response = min(self.stats['response_times'])
            max_response = max(self.stats['response_times'])

            ColorPrint.blue("\nResponse Times:")
            ColorPrint.green(f"  Average: {avg_response:.2f} ms")
            ColorPrint.green(f"  Min: {min_response:.2f} ms")
            ColorPrint.green(f"  Max: {max_response:.2f} ms")

        # Success rate
        if self.stats['total_requests'] > 0:
            success_rate = (self.stats['successful_requests'] / self.stats['total_requests']) * 100
            ColorPrint.blue("\nSuccess Rate:")

            if success_rate >= 95:
                ColorPrint.green(f"  {success_rate:.1f}%")
            elif success_rate >= 80:
                ColorPrint.yellow(f"  {success_rate:.1f}%")
            else:
                ColorPrint.red(f"  {success_rate:.1f}%")

        # Uptime
        uptime = time.time() - self.stats['start_time']
        ColorPrint.blue("\nMonitor Uptime:")
        ColorPrint.green(f"  {uptime:.0f} seconds")

        # Footer
        print()
        ColorPrint.yellow(f"Monitoring interval: {self.interval}s | Press Ctrl+C to stop")

    async def run(self):
        """Run monitoring loop"""
        ColorPrint.blue("Starting RPC Server Monitor...")

        if not await self.connect():
            ColorPrint.red("Failed to connect to server")
            return

        self.running = True

        try:
            while self.running:
                # Check health
                health_data = await self.check_health()

                # Get server info (less frequently)
                server_info = {}
                if self.stats['total_requests'] % 5 == 1:  # Every 5 checks
                    server_info = await self.get_server_info()

                # Display stats
                self.display_stats(health_data, server_info)

                # Wait
                await asyncio.sleep(self.interval)

        except KeyboardInterrupt:
            ColorPrint.yellow("\nStopping monitor...")

        finally:
            self.running = False
            await self.disconnect()


def main():
    """Main entry point"""
    import argparse

    parser = argparse.ArgumentParser(description='RPC Server Monitor')
    parser.add_argument('--host', default='localhost', help='Server host (default: localhost)')
    parser.add_argument('--port', type=int, default=8765, help='Server port (default: 8765)')
    parser.add_argument('--interval', type=int, default=2, help='Monitoring interval in seconds (default: 2)')

    args = parser.parse_args()

    monitor = RpcMonitor(
        host=args.host,
        port=args.port,
        interval=args.interval
    )

    try:
        asyncio.run(monitor.run())
    except KeyboardInterrupt:
        ColorPrint.yellow("\nMonitor interrupted")


if __name__ == "__main__":
    main()
