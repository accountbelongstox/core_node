#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Chat Session Examples

Examples demonstrating ChatSession usage with caching and streaming.

Usage:
    python scripts/chat_session_examples.py
"""

import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyutils.ai_cluster.openrouter.chat_session import ChatSession, list_free_models


def example_1_basic_usage():
    """Example 1: Basic batch send"""
    ColorPrint.blue("\n" + "=" * 70)
    ColorPrint.blue("Example 1: Basic Batch Send")
    ColorPrint.blue("=" * 70)

    # Create session (auto-selects free model)
    session = ChatSession()

    ColorPrint.yellow(f"\nUsing model: {session.model}")

    # Send message and get complete response
    response = session.send("What is 2 + 2?", max_tokens=300)

    ColorPrint.green("\nResponse:")
    print(response)

    ColorPrint.blue(f"\nState: {session.get_state().value}")


def example_2_streaming():
    """Example 2: Streaming output"""
    ColorPrint.blue("\n" + "=" * 70)
    ColorPrint.blue("Example 2: Streaming Output")
    ColorPrint.blue("=" * 70)

    session = ChatSession()

    ColorPrint.yellow("\nSending: Write a haiku about AI")
    ColorPrint.green("\nStreaming response:")

    # Stream response in real-time
    for chunk in session.send_stream("Write a short haiku about AI", max_tokens=300):
        print(chunk, end='', flush=True)

    print("\n")
    ColorPrint.blue(f"State: {session.get_state().value}")


def example_3_conversation():
    """Example 3: Multi-turn conversation"""
    ColorPrint.blue("\n" + "=" * 70)
    ColorPrint.blue("Example 3: Multi-turn Conversation")
    ColorPrint.blue("=" * 70)

    session = ChatSession(system_prompt="You are a helpful math tutor.")

    # Turn 1
    ColorPrint.yellow("\nUser: What's the largest planet?")
    response1 = session.send("What's the largest planet?", max_tokens=300)
    ColorPrint.green(f"Assistant: {response1}\n")

    # Turn 2
    ColorPrint.yellow("User: How big is it?")
    response2 = session.send("How big is it?", max_tokens=300)
    ColorPrint.green(f"Assistant: {response2}\n")

    # Show history
    ColorPrint.blue("Conversation history:")
    for i, msg in enumerate(session.get_history(), 1):
        print(f"  {i}. {msg['role']}: {msg['content'][:50]}...")


def example_4_callbacks():
    """Example 4: Using callbacks"""
    ColorPrint.blue("\n" + "=" * 70)
    ColorPrint.blue("Example 4: Using Callbacks")
    ColorPrint.blue("=" * 70)

    session = ChatSession()

    # Add callbacks
    chunk_count = [0]

    def on_chunk(chunk):
        chunk_count[0] += 1

    def on_complete(response):
        ColorPrint.yellow(f"\n\n[Callback] Response complete!")
        ColorPrint.blue(f"[Callback] Total length: {len(response)} chars")
        ColorPrint.blue(f"[Callback] Total chunks: {chunk_count[0]}")

    session.add_on_chunk_callback(on_chunk)
    session.add_on_complete_callback(on_complete)

    ColorPrint.yellow("\nSending with callbacks...")
    ColorPrint.green("Stream: ")

    for chunk in session.send_stream("Count from 1 to 5", max_tokens=300):
        print(chunk, end='', flush=True)


def example_5_state_tracking():
    """Example 5: State tracking"""
    ColorPrint.blue("\n" + "=" * 70)
    ColorPrint.blue("Example 5: State Tracking")
    ColorPrint.blue("=" * 70)

    session = ChatSession()

    ColorPrint.blue(f"\nInitial state: {session.get_state().value}")
    ColorPrint.blue(f"Is idle: {session.is_idle()}")

    ColorPrint.yellow("\nSending message...")

    # Send in batch mode
    response = session.send("Hello!", max_tokens=200)

    ColorPrint.blue(f"\nAfter send:")
    ColorPrint.blue(f"  State: {session.get_state().value}")
    ColorPrint.blue(f"  Is completed: {session.is_completed()}")
    ColorPrint.blue(f"  Last response: {session.get_last_response()[:50]}...")


def example_6_statistics():
    """Example 6: Session statistics"""
    ColorPrint.blue("\n" + "=" * 70)
    ColorPrint.blue("Example 6: Session Statistics")
    ColorPrint.blue("=" * 70)

    session = ChatSession()

    # Send a few messages
    session.send("Hi", max_tokens=200)
    session.send("How are you?", max_tokens=200)

    # Get statistics
    stats = session.get_statistics()

    ColorPrint.green("\nSession Statistics:")
    for key, value in stats.items():
        ColorPrint.blue(f"  {key}: {value}")


def example_7_history_management():
    """Example 7: History management"""
    ColorPrint.blue("\n" + "=" * 70)
    ColorPrint.blue("Example 7: History Management")
    ColorPrint.blue("=" * 70)

    session = ChatSession(max_history=5)  # Keep only last 5 messages

    # Send multiple messages
    for i in range(3):
        session.send(f"Message {i + 1}", max_tokens=200)

    # Show history
    history = session.get_history()
    ColorPrint.green(f"\nHistory count: {len(history)}")

    for msg in history:
        print(f"  {msg['role']}: {msg['content'][:30]}...")

    # Clear history
    ColorPrint.yellow("\nClearing history...")
    session.clear_history()

    ColorPrint.blue(f"History after clear: {len(session.get_history())}")


def example_8_custom_model():
    """Example 8: Using custom model"""
    ColorPrint.blue("\n" + "=" * 70)
    ColorPrint.blue("Example 8: Custom Model Selection")
    ColorPrint.blue("=" * 70)

    # Auto-select (default)
    session1 = ChatSession()
    ColorPrint.green(f"\nAuto-selected: {session1.model}")

    # Specify model
    session2 = ChatSession(model="gpt-4o-mini")
    ColorPrint.green(f"Custom model: {session2.model}")

    # Use full model ID
    session3 = ChatSession(model="tngtech/deepseek-r1t2-chimera:free")
    ColorPrint.green(f"Full ID: {session3.model}")


def run_all_examples():
    """Run all examples"""
    ColorPrint.green("\n" + "=" * 70)
    ColorPrint.green("ChatSession Examples")
    ColorPrint.green("=" * 70)

    # List free models first
    list_free_models()

    try:
        example_1_basic_usage()
        example_2_streaming()
        example_3_conversation()
        example_4_callbacks()
        example_5_state_tracking()
        example_6_statistics()
        example_7_history_management()
        example_8_custom_model()

        ColorPrint.green("\n" + "=" * 70)
        ColorPrint.green("All Examples Completed!")
        ColorPrint.green("=" * 70)

    except Exception as e:
        ColorPrint.red(f"\nExample failed: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    run_all_examples()
