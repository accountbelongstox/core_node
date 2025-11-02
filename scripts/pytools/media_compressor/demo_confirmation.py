#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Demo: Multi-threaded Confirmation Prompt
Shows what the user will see before batch processing starts
"""

def demo_confirmation():
    """Simulate the confirmation prompt"""

    # Simulate GPU detection
    print("\n" + "="*60)
    print("Auto Mode: Multi-threaded Batch Processing")
    print("GPU: NVIDIA GeForce RTX 4060 Laptop GPU")
    print("GPU Memory: 8.0 GB")
    print("NVENC Support: Yes")
    print()
    print("[*] Multi-threading: ENABLED")
    print("    Worker Threads: 4")
    print("    Concurrent Tasks: Up to 4 files simultaneously")
    print("="*60)

    # Confirmation prompt
    print("\nThis will use 4 parallel worker threads.")
    print("Press 'y' or Enter to continue, any other key to cancel...")
    choice = input("Continue? [Y/n]: ").strip().lower()

    if choice and choice not in ['y', 'yes', '']:
        print("Operation cancelled by user")
        return False

    print("\n[OK] Starting multi-threaded batch processing with 4 workers...\n")
    print("Scanning directory...")
    print("(Rest of the process would continue here)")
    return True


if __name__ == '__main__':
    print("="*60)
    print("DEMO: Multi-threaded Confirmation Prompt")
    print("="*60)
    print("\nThis demonstrates what you'll see before compression starts:\n")

    result = demo_confirmation()

    print("\n" + "="*60)
    if result:
        print("Demo completed: User confirmed")
    else:
        print("Demo completed: User cancelled")
    print("="*60)
