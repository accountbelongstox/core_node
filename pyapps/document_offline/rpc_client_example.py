#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Document Offline RPC Client Example

Demonstrates how to use document_offline service via RPC
"""

import sys
import asyncio
from pathlib import Path

PROJECT_ROOT = Path(__file__).parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from pycore.pyutils.wsrpc.ws_rpc_client import WsRpcClient


async def main():
    """Main example"""
    print("=" * 70)
    print("Document Offline RPC Client Example")
    print("=" * 70)
    print()

    # Create RPC client
    client = WsRpcClient({
        'host': 'localhost',
        'port': 8767,  # MCP server RPC port
        'debug': True
    })

    try:
        # Connect to server
        print("[INFO] Connecting to MCP server...")
        await client.connect()
        print("[SUCCESS] Connected to MCP server")
        print()

        # Example 1: Start a crawl
        print("-" * 70)
        print("Example 1: Start Crawl")
        print("-" * 70)

        crawl_params = {
            'target_url': 'https://example.com',
            'depth': 1,
            'fetcher_type': 'http',
            'scope_type': 'full'
        }

        print(f"[INFO] Starting crawl with params: {crawl_params}")
        result = await client.call('document_offline.start_crawl', crawl_params)

        if result.get('success'):
            print(f"[SUCCESS] Crawl started!")
            print(f"  Crawl ID: {result.get('crawl_id')}")
            print(f"  Output Dir: {result.get('output_dir')}")
            print(f"  Statistics: {result.get('statistics')}")
            crawl_id = result.get('crawl_id')
        else:
            print(f"[ERROR] Crawl failed: {result.get('error')}")
            crawl_id = None

        print()

        # Example 2: Get status
        print("-" * 70)
        print("Example 2: Get Status")
        print("-" * 70)

        if crawl_id:
            print(f"[INFO] Getting status for crawl {crawl_id}")
            result = await client.call('document_offline.get_status', {'crawl_id': crawl_id})

            if result.get('success'):
                print(f"[SUCCESS] Status retrieved:")
                crawl = result.get('crawl', {})
                for key, value in crawl.items():
                    print(f"  {key}: {value}")
            else:
                print(f"[ERROR] Failed to get status: {result.get('error')}")

        print()

        # Example 3: List all crawls
        print("-" * 70)
        print("Example 3: List All Crawls")
        print("-" * 70)

        print("[INFO] Listing all crawls")
        result = await client.call('document_offline.list_crawls', {})

        if result.get('success'):
            crawls = result.get('crawls', [])
            print(f"[SUCCESS] Found {len(crawls)} crawls:")
            for crawl in crawls:
                print(f"  - {crawl.get('crawl_id')}: {crawl.get('target_url')} ({crawl.get('status')})")
        else:
            print(f"[ERROR] Failed to list crawls: {result.get('error')}")

        print()

        # Example 4: Get system info
        print("-" * 70)
        print("Example 4: Get System Info")
        print("-" * 70)

        print("[INFO] Getting system info")
        result = await client.call('system.get_info', {})

        if result.get('success'):
            print(f"[SUCCESS] System info:")
            print(f"  Server: {result.get('server_name')}")
            print(f"  Version: {result.get('version')}")
            print(f"  Architecture: {result.get('architecture')}")
        else:
            print(f"[ERROR] Failed to get system info: {result.get('error')}")

        print()

        # Example 5: List services
        print("-" * 70)
        print("Example 5: List Services")
        print("-" * 70)

        print("[INFO] Listing available services")
        result = await client.call('system.list_services', {})

        if result.get('success'):
            services = result.get('services', {})
            print(f"[SUCCESS] Available services:")
            for service, methods in services.items():
                print(f"  {service}:")
                for method in methods:
                    print(f"    - {method}")
        else:
            print(f"[ERROR] Failed to list services: {result.get('error')}")

        print()
        print("=" * 70)
        print("All examples completed successfully!")
        print("=" * 70)

    except Exception as e:
        print(f"[ERROR] Error: {str(e)}")
        import traceback
        traceback.print_exc()

    finally:
        # Disconnect
        await client.disconnect()
        print("\n[INFO] Disconnected from server")


if __name__ == '__main__':
    asyncio.run(main())
