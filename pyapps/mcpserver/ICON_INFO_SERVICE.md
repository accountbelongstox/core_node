#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Icon Information Service - Comprehensive Documentation

Complete guide for icon analysis and information extraction
"""

import sys
import asyncio
from pathlib import Path

# Add project root to path
PROJECT_ROOT = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

# Import RPC client
from pycore.pyutils.wsrpc.ws_rpc_client import WsRpcClient


async def example_analyze_icon():
    """Example: Analyze a single icon/image"""
    print("=" * 70)
    print("Example: Analyze Icon")
    print("=" * 70)

    client = WsRpcClient(
        server_url='ws://localhost:8767',
        client_id='icon_analyzer_client'
    )

    try:
        # Connect to MCP server
        print("\n1. Connecting to MCP Server...")
        await client.connect()
        print("   ✓ Connected")

        # Analyze icon
        print("\n2. Analyzing icon...")
        result = await client.call(
            'icon.analyze',
            {
                'image_path': 'D:/test/icon.png',
                'include_ocr': False,
                'include_colors': True,
                'include_hash': True
            }
        )

        if result.get('success'):
            print("   ✓ Analysis successful")
            print("\n   File Info:")
            file_info = result.get('file_info', {})
            print(f"   - Name: {file_info.get('name')}")
            print(f"   - Size: {file_info.get('size_kb')} KB")
            print(f"   - Format: {file_info.get('extension')}")

            print("\n   Image Info:")
            img_info = result.get('image_info', {})
            print(f"   - Dimensions: {img_info.get('dimensions')}")
            print(f"   - Aspect Ratio: {img_info.get('aspect_ratio_str')}")
            print(f"   - Format: {img_info.get('format')}")
            print(f"   - Mode: {img_info.get('mode')}")
            print(f"   - Has Transparency: {img_info.get('has_transparency')}")

            if 'color_info' in result:
                print("\n   Color Info:")
                color_info = result['color_info']
                print(f"   - Dominant Color: {color_info.get('dominant_color_hex')}")
                print(f"   - Average Color: {color_info.get('average_color_hex')}")
                print(f"   - Brightness: {color_info.get('brightness_percent')}%")
                print(f"   - Is Grayscale: {color_info.get('is_grayscale')}")

            if 'hash' in result:
                print("\n   Hash Info:")
                hash_info = result['hash']
                print(f"   - Perceptual Hash: {hash_info.get('perceptual_hash')}")
                print(f"   - MD5 Hash: {hash_info.get('md5_hash')[:16]}...")
        else:
            print(f"   ✗ Failed: {result.get('error')}")

    except Exception as e:
        print(f"Error: {e}")

    finally:
        await client.disconnect()
        print("\n✓ Disconnected")


async def example_get_metadata():
    """Example: Get icon metadata only"""
    print("=" * 70)
    print("Example: Get Icon Metadata")
    print("=" * 70)

    client = WsRpcClient(
        server_url='ws://localhost:8767',
        client_id='metadata_client'
    )

    try:
        # Connect
        print("\n1. Connecting to MCP Server...")
        await client.connect()
        print("   ✓ Connected")

        # Get metadata
        print("\n2. Getting icon metadata...")
        result = await client.call(
            'icon.get_metadata',
            {
                'image_path': 'D:/test/icon.png'
            }
        )

        if result.get('success'):
            print("   ✓ Metadata retrieved")
            print("\n   Metadata:")
            img_info = result.get('image_info', {})
            for key, value in img_info.items():
                print(f"   - {key}: {value}")
        else:
            print(f"   ✗ Failed: {result.get('error')}")

    except Exception as e:
        print(f"Error: {e}")

    finally:
        await client.disconnect()
        print("\n✓ Disconnected")


async def example_extract_text():
    """Example: Extract text from icon using OCR"""
    print("=" * 70)
    print("Example: Extract Text from Icon")
    print("=" * 70)

    client = WsRpcClient(
        server_url='ws://localhost:8767',
        client_id='ocr_client'
    )

    try:
        # Connect
        print("\n1. Connecting to MCP Server...")
        await client.connect()
        print("   ✓ Connected")

        # Extract text
        print("\n2. Extracting text using OCR...")
        result = await client.call(
            'icon.extract_text',
            {
                'image_path': 'D:/test/icon_with_text.png',
                'language': 'eng'
            }
        )

        if result.get('success'):
            print("   ✓ OCR completed")
            print(f"\n   Text: {result.get('text')}")
            print(f"   Confidence: {result.get('confidence')}")
            print(f"   Provider: {result.get('provider')}")
        else:
            print(f"   ✗ Failed: {result.get('error')}")

    except Exception as e:
        print(f"Error: {e}")

    finally:
        await client.disconnect()
        print("\n✓ Disconnected")


async def example_analyze_colors():
    """Example: Analyze icon colors"""
    print("=" * 70)
    print("Example: Analyze Icon Colors")
    print("=" * 70)

    client = WsRpcClient(
        server_url='ws://localhost:8767',
        client_id='color_client'
    )

    try:
        # Connect
        print("\n1. Connecting to MCP Server...")
        await client.connect()
        print("   ✓ Connected")

        # Analyze colors
        print("\n2. Analyzing colors...")
        result = await client.call(
            'icon.analyze_colors',
            {
                'image_path': 'D:/test/icon.png'
            }
        )

        if result.get('success'):
            print("   ✓ Color analysis completed")
            print(f"\n   Dominant Color: {result.get('dominant_color_hex')}")
            print(f"   Average Color: {result.get('average_color_hex')}")
            print(f"   Brightness: {result.get('brightness_percent')}%")
            print(f"   Is Grayscale: {result.get('is_grayscale')}")

            palette = result.get('color_palette_hex', [])
            if palette:
                print(f"\n   Color Palette:")
                for i, color in enumerate(palette, 1):
                    print(f"   {i}. {color}")
        else:
            print(f"   ✗ Failed: {result.get('error')}")

    except Exception as e:
        print(f"Error: {e}")

    finally:
        await client.disconnect()
        print("\n✓ Disconnected")


async def example_batch_analyze():
    """Example: Batch analyze multiple icons"""
    print("=" * 70)
    print("Example: Batch Analyze Icons")
    print("=" * 70)

    client = WsRpcClient(
        server_url='ws://localhost:8767',
        client_id='batch_client'
    )

    try:
        # Connect
        print("\n1. Connecting to MCP Server...")
        await client.connect()
        print("   ✓ Connected")

        # Batch analyze
        print("\n2. Batch analyzing icons...")
        result = await client.call(
            'icon.batch_analyze',
            {
                'image_paths': [
                    'D:/test/icon1.png',
                    'D:/test/icon2.png',
                    'D:/test/icon3.png'
                ],
                'include_ocr': False,
                'include_colors': True,
                'include_hash': True
            }
        )

        if result.get('success'):
            print("   ✓ Batch analysis completed")
            print(f"\n   Total: {result.get('total')}")
            print(f"   Analyzed: {result.get('analyzed')}")
            print(f"   Failed: {result.get('failed')}")

            results = result.get('results', [])
            if results:
                print("\n   Results:")
                for i, res in enumerate(results, 1):
                    file_info = res.get('file_info', {})
                    img_info = res.get('image_info', {})
                    print(f"\n   Icon {i}: {file_info.get('name')}")
                    print(f"   - Size: {file_info.get('size_kb')} KB")
                    print(f"   - Dimensions: {img_info.get('dimensions')}")

            errors = result.get('errors', [])
            if errors:
                print("\n   Errors:")
                for err in errors:
                    print(f"   - {err.get('path')}: {err.get('error')}")
        else:
            print(f"   ✗ Failed: {result.get('error')}")

    except Exception as e:
        print(f"Error: {e}")

    finally:
        await client.disconnect()
        print("\n✓ Disconnected")


async def example_find_similar():
    """Example: Find similar icons"""
    print("=" * 70)
    print("Example: Find Similar Icons")
    print("=" * 70)

    client = WsRpcClient(
        server_url='ws://localhost:8767',
        client_id='similar_client'
    )

    try:
        # Connect
        print("\n1. Connecting to MCP Server...")
        await client.connect()
        print("   ✓ Connected")

        # Find similar
        print("\n2. Finding similar icons...")
        result = await client.call(
            'icon.find_similar',
            {
                'target_image': 'D:/test/target.png',
                'candidate_images': [
                    'D:/test/icon1.png',
                    'D:/test/icon2.png',
                    'D:/test/icon3.png',
                    'D:/test/icon4.png',
                    'D:/test/icon5.png'
                ],
                'threshold': 0.8
            }
        )

        if result.get('success'):
            print("   ✓ Similarity search completed")
            print(f"\n   Target: {result.get('target_image')}")
            print(f"   Total Candidates: {result.get('total_candidates')}")
            print(f"   Similar Found: {result.get('similar_count')}")
            print(f"   Threshold: {result.get('threshold')}")

            similar = result.get('similar_icons', [])
            if similar:
                print("\n   Similar Icons:")
                for i, icon in enumerate(similar, 1):
                    print(f"\n   {i}. {icon.get('path')}")
                    print(f"      Similarity: {icon.get('similarity')}")
                    print(f"      Distance: {icon.get('distance')}")
            else:
                print("\n   No similar icons found")
        else:
            print(f"   ✗ Failed: {result.get('error')}")

    except Exception as e:
        print(f"Error: {e}")

    finally:
        await client.disconnect()
        print("\n✓ Disconnected")


async def example_scan_directory():
    """Example: Scan directory for icons"""
    print("=" * 70)
    print("Example: Scan Directory for Icons")
    print("=" * 70)

    client = WsRpcClient(
        server_url='ws://localhost:8767',
        client_id='scan_client'
    )

    try:
        # Connect
        print("\n1. Connecting to MCP Server...")
        await client.connect()
        print("   ✓ Connected")

        # Scan directory
        print("\n2. Scanning directory...")
        result = await client.call(
            'icon.scan_directory',
            {
                'directory': 'D:/test/icons',
                'recursive': True,
                'extensions': ['.png', '.jpg', '.ico'],
                'include_ocr': False,
                'include_colors': True
            }
        )

        if result.get('success'):
            print("   ✓ Directory scan completed")
            print(f"\n   Directory: {result.get('directory')}")
            print(f"   Total Icons: {result.get('analyzed')}")
            print(f"   Failed: {result.get('failed')}")

            results = result.get('results', [])
            if results:
                print("\n   Icon Summary:")
                for res in results[:5]:  # Show first 5
                    file_info = res.get('file_info', {})
                    img_info = res.get('image_info', {})
                    print(f"\n   - {file_info.get('name')}")
                    print(f"     Size: {img_info.get('dimensions')}")
                    print(f"     Format: {img_info.get('format')}")

                if len(results) > 5:
                    print(f"\n   ... and {len(results) - 5} more")
        else:
            print(f"   ✗ Failed: {result.get('error')}")

    except Exception as e:
        print(f"Error: {e}")

    finally:
        await client.disconnect()
        print("\n✓ Disconnected")


async def example_get_hash():
    """Example: Get icon hash for deduplication"""
    print("=" * 70)
    print("Example: Get Icon Hash")
    print("=" * 70)

    client = WsRpcClient(
        server_url='ws://localhost:8767',
        client_id='hash_client'
    )

    try:
        # Connect
        print("\n1. Connecting to MCP Server...")
        await client.connect()
        print("   ✓ Connected")

        # Get hash
        print("\n2. Getting icon hash...")
        result = await client.call(
            'icon.get_hash',
            {
                'image_path': 'D:/test/icon.png'
            }
        )

        if result.get('success'):
            print("   ✓ Hash calculated")
            print(f"\n   Perceptual Hash: {result.get('perceptual_hash')}")
            print(f"   MD5 Hash: {result.get('md5_hash')}")
            print("\n   Use perceptual hash to find visually similar images")
            print("   Use MD5 hash to find exact duplicates")
        else:
            print(f"   ✗ Failed: {result.get('error')}")

    except Exception as e:
        print(f"Error: {e}")

    finally:
        await client.disconnect()
        print("\n✓ Disconnected")


async def main():
    """Main entry point"""
    import argparse

    parser = argparse.ArgumentParser(description='Icon Info Service Examples')
    parser.add_argument(
        'example',
        choices=[
            'analyze',
            'metadata',
            'extract_text',
            'colors',
            'batch',
            'similar',
            'scan',
            'hash',
            'all'
        ],
        help='Example to run'
    )

    args = parser.parse_args()

    if args.example == 'analyze':
        await example_analyze_icon()
    elif args.example == 'metadata':
        await example_get_metadata()
    elif args.example == 'extract_text':
        await example_extract_text()
    elif args.example == 'colors':
        await example_analyze_colors()
    elif args.example == 'batch':
        await example_batch_analyze()
    elif args.example == 'similar':
        await example_find_similar()
    elif args.example == 'scan':
        await example_scan_directory()
    elif args.example == 'hash':
        await example_get_hash()
    elif args.example == 'all':
        print("\nRunning all examples...\n")
        await example_analyze_icon()
        print("\n" + "=" * 70 + "\n")
        await asyncio.sleep(1)

        await example_get_metadata()
        print("\n" + "=" * 70 + "\n")
        await asyncio.sleep(1)

        await example_analyze_colors()
        print("\n" + "=" * 70 + "\n")
        await asyncio.sleep(1)

        await example_get_hash()


if __name__ == '__main__':
    # Note: Make sure MCP Server is running before executing examples
    # Start server with: python pyapps/mcpserver/mcpserver_main.py

    asyncio.run(main())
