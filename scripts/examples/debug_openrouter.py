#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Debug OpenRouter API

Simple debug script to test OpenRouter API directly.
"""

import sys
import json
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from pycore.pyfoundations.color_print import ColorPrint
from pycore.pyutils.ai_cluster.openrouter import openrouter_client


def debug_basic_request():
    """Test basic API request and show raw response"""
    ColorPrint.blue("\n" + "=" * 70)
    ColorPrint.blue("Debug: Basic API Request")
    ColorPrint.blue("=" * 70)

    ColorPrint.yellow(f"\nAPI Key: {openrouter_client.api_key[:20]}...")

    messages = [
        {"role": "user", "content": "Say exactly: 'Hello from OpenRouter!'"}
    ]

    ColorPrint.blue("\nRequest:")
    print(json.dumps(messages, indent=2))

    ColorPrint.blue("\nSending request to OpenRouter API...")

    response = openrouter_client.chat_completion(
        messages=messages,
        model="tngtech/deepseek-r1t2-chimera:free",
        max_tokens=200,  # Increased for reasoning models
        temperature=0.7
    )

    ColorPrint.blue("\nRaw Response:")
    print(json.dumps(response, indent=2))

    if 'error' in response:
        ColorPrint.red(f"\nError: {response['error']}")
    elif 'choices' in response and len(response['choices']) > 0:
        message = response['choices'][0].get('message', {})

        # Extract using the helper method
        extracted = openrouter_client._extract_message_content(message)

        # Show all fields
        ColorPrint.yellow("\nMessage fields:")
        ColorPrint.blue(f"  content: {message.get('content', '(empty)')[:100]}")
        ColorPrint.blue(f"  reasoning: {message.get('reasoning', '(none)')[:100]}...")

        ColorPrint.green(f"\nExtracted Content (via helper): {extracted[:200]}...")
        ColorPrint.green(f"Content Length: {len(extracted)} characters")
    else:
        ColorPrint.yellow("\nNo choices in response")


def debug_simple_chat():
    """Test simple chat method"""
    ColorPrint.blue("\n" + "=" * 70)
    ColorPrint.blue("Debug: Simple Chat Method")
    ColorPrint.blue("=" * 70)

    response = openrouter_client.chat(
        prompt="Count from 1 to 3.",
        model="free",
        max_tokens=50
    )

    ColorPrint.blue(f"\nResponse type: {type(response)}")
    ColorPrint.blue(f"Response length: {len(response)}")
    ColorPrint.green(f"\nResponse content:\n{response}")


def debug_different_models():
    """Test different model names"""
    ColorPrint.blue("\n" + "=" * 70)
    ColorPrint.blue("Debug: Different Model Names")
    ColorPrint.blue("=" * 70)

    models_to_test = [
        "free",
        "deepseek-r1t2-chimera",
        "tngtech/deepseek-r1t2-chimera:free",
    ]

    for model in models_to_test:
        ColorPrint.yellow(f"\nTesting model: {model}")

        response = openrouter_client.chat_completion(
            messages=[{"role": "user", "content": "Hi"}],
            model=model,
            max_tokens=20
        )

        if 'error' in response:
            ColorPrint.red(f"  Error: {response['error']}")
        elif 'choices' in response:
            content = response['choices'][0].get('message', {}).get('content', '(empty)')
            ColorPrint.green(f"  Success: {content[:50]}")
        else:
            ColorPrint.yellow(f"  Unexpected response: {str(response)[:100]}")


if __name__ == "__main__":
    ColorPrint.green("\n" + "=" * 70)
    ColorPrint.green("OpenRouter API Debug Tool")
    ColorPrint.green("=" * 70)

    if not openrouter_client.api_key:
        ColorPrint.red("\n✗ No API key configured!")
        sys.exit(1)

    try:
        debug_basic_request()
        debug_simple_chat()
        debug_different_models()

        ColorPrint.green("\n" + "=" * 70)
        ColorPrint.green("Debug Complete")
        ColorPrint.green("=" * 70)

    except Exception as e:
        ColorPrint.red(f"\nDebug failed: {e}")
        import traceback
        traceback.print_exc()
