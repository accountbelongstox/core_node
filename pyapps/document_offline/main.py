#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Document Offline Main Entry Point

Sub-app that imports logic from controller in mcpserver
"""

import sys
import asyncio
from pathlib import Path

# Add project root to path
PROJECT_ROOT = Path(__file__).parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from pyapps.mcpserver.controllers.document_offline import DocumentOfflineController
from pycore.pyfoundations.color_print import ColorPrint


def parse_args():
    """Parse command line arguments"""
    import argparse

    parser = argparse.ArgumentParser(description='Document Offline Crawler')
    parser.add_argument('target_url', help='URL to crawl')
    parser.add_argument('--depth', type=int, default=3, help='Max recursion depth (default: 3)')
    parser.add_argument('--fetcher-type', choices=['http', 'puppeteer', 'iframe'], default='http',
                        help='Fetcher type (default: http)')
    parser.add_argument('--scope-type', choices=['full', 'path'], default='full',
                        help='Scope type (default: full)')
    parser.add_argument('--disable-js', action='store_true', help='Disable JavaScript')
    parser.add_argument('--screenshot', action='store_true', help='Capture screenshots')
    parser.add_argument('--debug', action='store_true', help='Debug mode (browser visible)')
    parser.add_argument('--output-dir', help='Output directory')

    return parser.parse_args()


async def async_main():
    """Async main function"""
    args = parse_args()

    ColorPrint.print_title('Document Offline Crawler')
    ColorPrint.print_info(f"Target URL: {args.target_url}")
    ColorPrint.print_info(f"Max Depth: {args.depth}")
    ColorPrint.print_info(f"Fetcher Type: {args.fetcher_type}")
    print()

    # Create config from args
    config = {
        'target_url': args.target_url,
        'depth': args.depth,
        'fetcher_type': args.fetcher_type,
        'scope_type': args.scope_type,
        'disable_js': args.disable_js,
        'screenshot': args.screenshot,
        'debug': args.debug
    }

    if args.output_dir:
        config['output_dir'] = args.output_dir

    # Create and start controller
    controller = DocumentOfflineController()

    try:
        result = await controller.start(config)

        if result.get('success'):
            ColorPrint.print_success("\nCrawl completed successfully!")
            ColorPrint.print_info(f"Output directory: {result['output_dir']}")
            print()
            ColorPrint.print_title('Statistics:')
            stats = result['statistics']
            for key, value in stats.items():
                ColorPrint.print_info(f"  {key}: {value}")
        else:
            ColorPrint.print_error(f"\nCrawl failed: {result.get('error')}")
            sys.exit(1)

    except Exception as e:
        ColorPrint.print_error(f"\nError: {str(e)}")
        sys.exit(1)


def start():
    """Entry point"""
    try:
        asyncio.run(async_main())
    except KeyboardInterrupt:
        ColorPrint.print_warn("\n\nInterrupted by user")
        sys.exit(0)


if __name__ == '__main__':
    start()
