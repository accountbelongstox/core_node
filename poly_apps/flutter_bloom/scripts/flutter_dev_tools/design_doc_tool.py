#!/usr/bin/env python3
"""
Flutter design documentation inspection server.

This file serves as a compatibility wrapper.
All functionality has been moved to the modular architecture in main.py.
"""

if __name__ == "__main__":
    print("=" * 60)
    print("Flutter Design Documentation Tool")
    print("Using modular architecture (main.py)")
    print("=" * 60)
    print()

    # Import and run the new main server
    from main import run_server
    run_server()
