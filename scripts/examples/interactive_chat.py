#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Interactive Chat with OpenRouter

Simple interactive chat interface using ChatSession.

Usage:
    python scripts/interactive_chat.py
"""

import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyutils.ai_cluster.openrouter.chat_session import ChatSession


def main():
    """Run interactive chat"""
    ColorPrint.green("\n" + "=" * 70)
    ColorPrint.green("Interactive Chat with OpenRouter")
    ColorPrint.green("=" * 70)

    # Create session
    session = ChatSession()

    ColorPrint.blue(f"\nUsing model: {session.model}")
    ColorPrint.yellow("\nType 'quit', 'exit', or 'q' to exit")
    ColorPrint.yellow("Type 'clear' to clear history")
    ColorPrint.yellow("Type 'stats' to show statistics")
    ColorPrint.yellow("Type 'history' to show conversation history")
    ColorPrint.blue("\n" + "=" * 70)

    while True:
        # Get user input
        ColorPrint.blue("\nYou: ", end='')
        try:
            user_input = input().strip()
        except (EOFError, KeyboardInterrupt):
            ColorPrint.yellow("\n\nGoodbye!")
            break

        if not user_input:
            continue

        # Handle commands
        if user_input.lower() in ['quit', 'exit', 'q']:
            ColorPrint.yellow("\nGoodbye!")
            break

        elif user_input.lower() == 'clear':
            session.clear_history()
            ColorPrint.green("History cleared!")
            continue

        elif user_input.lower() == 'stats':
            stats = session.get_statistics()
            ColorPrint.green("\nStatistics:")
            for key, value in stats.items():
                ColorPrint.blue(f"  {key}: {value}")
            continue

        elif user_input.lower() == 'history':
            history = session.get_history()
            ColorPrint.green(f"\nConversation history ({len(history)} messages):")
            for i, msg in enumerate(history, 1):
                role = msg['role']
                content = msg['content'][:100]
                ColorPrint.blue(f"  {i}. {role}: {content}...")
            continue

        # Send message and stream response
        ColorPrint.green("\nAssistant: ", end='', flush=True)

        try:
            for chunk in session.send_stream(user_input, max_tokens=500):
                print(chunk, end='', flush=True)
            print()  # New line
        except Exception as e:
            ColorPrint.red(f"\nError: {e}")


if __name__ == "__main__":
    main()
