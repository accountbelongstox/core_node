#!/usr/bin/env python3

import sys
import asyncio
import argparse
import json
from pathlib import Path

project_root = Path(__file__).resolve().parent.parent.parent.parent
sys.path.insert(0, str(project_root))

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyutils.translator.google_translator import (
    GoogleTranslator,
    translate_from_json_file,
    translate_from_dict,
    clear_cache,
)


def print_usage_examples():
    ColorPrint.plain("""
Google Translator - Usage Examples

1. Single translation with parameters:
   python -m pycore.pyutils.translator \\
       --text "Hello world" \\
       --src en \\
       --dest ko \\
       --output result.json

2. Multiple target languages:
   python -m pycore.pyutils.translator \\
       --text "Hello world" \\
       --src en \\
       --dest ko ja zh-cn \\
       --output result.json

3. Batch translation from JSON config:
   python -m pycore.pyutils.translator \\
       --config config.json \\
       --output results.json

4. Without cache:
   python -m pycore.pyutils.translator \\
       --text "Hello" \\
       --src en \\
       --dest ko \\
       --no-cache

5. Clear cache for specific language pair:
   python -m pycore.pyutils.translator \\
       --clear-cache \\
       --src en \\
       --dest ko

6. Clear all cache:
   python -m pycore.pyutils.translator --clear-cache

JSON Configuration Format:
{
    "src": "en",
    "dest": ["ko", "ja", "zh-cn"],
    "texts": [
        "Hello world",
        "How are you?",
        "Thank you"
    ]
}

Supported Languages (examples):
    en, ko, ja, zh-cn, zh-tw, fr, es, de, it, pt, ru, ar, th, vi, etc.
""")


async def handle_json_input(json_str: str) -> dict:
    try:
        input_data = json.loads(json_str)
    except json.JSONDecodeError as e:
        return {'success': False, 'error': f'Invalid JSON input: {str(e)}'}

    action = input_data.get('action', 'translate_single')

    try:
        if action == 'translate_single':
            text = input_data.get('text', '')
            src = input_data.get('src', 'auto')
            dest = input_data.get('dest', 'en')
            use_cache = input_data.get('use_cache', True)

            async with GoogleTranslator() as translator:
                result = await translator.translate_single(text, src=src, dest=dest, use_cache=use_cache)
                return result.to_dict()

        elif action == 'translate_batch':
            texts = input_data.get('texts', [])
            src = input_data.get('src', 'auto')
            dest = input_data.get('dest', 'en')
            use_cache = input_data.get('use_cache', True)

            async with GoogleTranslator() as translator:
                results = await translator.translate_batch(texts, src=src, dest=dest, use_cache=use_cache)
                return {'success': True, 'results': [r.to_dict() for r in results]}

        elif action == 'detect_language':
            text = input_data.get('text', '')

            async with GoogleTranslator() as translator:
                result = await translator.detect_language(text)
                return {'success': True, **result}

        elif action == 'clear_cache':
            src_lang = input_data.get('src_lang')
            dest_lang = input_data.get('dest_lang')
            count = clear_cache(src_lang, dest_lang)
            return {'success': True, 'cleared_count': count}

        else:
            return {'success': False, 'error': f'Unknown action: {action}'}

    except Exception as e:
        return {'success': False, 'error': str(e), 'type': type(e).__name__}


async def main():
    if len(sys.argv) >= 2 and sys.argv[1].startswith('{'):
        result = await handle_json_input(sys.argv[1])
        print(json.dumps(result, ensure_ascii=False))
        return 0 if result.get('success', True) else 1

    parser = argparse.ArgumentParser(
        description='Google Translator - Translate text with caching support',
        formatter_class=argparse.RawDescriptionHelpFormatter
    )

    parser.add_argument(
        '--text',
        type=str,
        help='Text to translate (can be used multiple times for batch)',
        action='append'
    )

    parser.add_argument(
        '--src',
        type=str,
        default='auto',
        help='Source language code (default: auto)'
    )

    parser.add_argument(
        '--dest',
        type=str,
        nargs='+',
        default=['en'],
        help='Destination language code(s) (default: en)'
    )

    parser.add_argument(
        '--config',
        type=str,
        help='JSON configuration file path'
    )

    parser.add_argument(
        '--output',
        type=str,
        help='Output JSON file path'
    )

    parser.add_argument(
        '--no-cache',
        action='store_true',
        help='Disable cache (force fresh translation)'
    )

    parser.add_argument(
        '--clear-cache',
        action='store_true',
        help='Clear translation cache'
    )

    parser.add_argument(
        '--examples',
        action='store_true',
        help='Show usage examples'
    )

    args = parser.parse_args()
    
    if args.examples:
        print_usage_examples()
        return 0
    
    if args.clear_cache:
        if args.src and args.dest:
            count = 0
            for dest in args.dest:
                count += clear_cache(args.src, dest)
            ColorPrint.plain(f"✓ Cleared {count} cache entries for {args.src} -> {', '.join(args.dest)}")
        else:
            count = clear_cache()
            ColorPrint.plain(f"✓ Cleared {count} cache entries (all languages)")
        return 0
    
    use_cache = not args.no_cache
    
    if args.config:
        ColorPrint.plain(f"Loading configuration from: {args.config}")
        results = await translate_from_json_file(
            args.config,
            output_file=args.output,
            use_cache=use_cache
        )
    elif args.text:
        texts = args.text if len(args.text) > 1 else args.text[0]
        
        config = {
            'src': args.src,
            'dest': args.dest,
            'texts': texts
        }
        
        ColorPrint.plain(f"Translating from {args.src} to {', '.join(args.dest)}...")
        ColorPrint.plain()
        
        results = await translate_from_dict(
            config,
            output_file=args.output,
            use_cache=use_cache
        )
    else:
        ColorPrint.plain("Error: Either --text or --config must be provided")
        ColorPrint.plain("Use --help for usage information or --examples for examples")
        return 1
    
    ColorPrint.plain("=" * 80)
    ColorPrint.plain("Translation Results")
    ColorPrint.plain("=" * 80)
    ColorPrint.plain()
    
    for i, result in enumerate(results, 1):
        cache_marker = "[CACHE]" if result.from_cache else "[FRESH]"
        
        if result.error:
            ColorPrint.plain(f"[{i}] ✗ ERROR: {result.error}")
            ColorPrint.plain(f"    Original ({result.src_lang}): {result.original_text}")
        else:
            ColorPrint.plain(f"[{i}] {cache_marker} {result.src_lang} -> {result.dest_lang}")
            ColorPrint.plain(f"    Original: {result.original_text}")
            ColorPrint.plain(f"    Translated: {result.translated_text}")
            if result.pronunciation:
                ColorPrint.plain(f"    Pronunciation: {result.pronunciation}")
        ColorPrint.plain()
    
    success_count = sum(1 for r in results if not r.error)
    cache_count = sum(1 for r in results if r.from_cache)
    
    ColorPrint.plain("=" * 80)
    ColorPrint.plain(f"Total: {len(results)} | Success: {success_count} | From Cache: {cache_count}")
    ColorPrint.plain("=" * 80)
    
    if args.output:
        ColorPrint.plain(f"\n✓ Results saved to: {args.output}")
    
    return 0 if success_count == len(results) else 1


if __name__ == '__main__':
    try:
        exit_code = asyncio.run(main())
        sys.exit(exit_code)
    except KeyboardInterrupt:
        ColorPrint.plain("\n\nInterrupted by user")
        sys.exit(1)
    except Exception as e:
        ColorPrint.plain(f"\n✗ Error: {e}")
        sys.exit(1)
