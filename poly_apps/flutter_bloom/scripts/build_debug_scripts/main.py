#!/usr/bin/env python3
"""
Flutter Bloom Build System - Main Entry Point
Simple entry point that delegates to the core build system
"""

import sys
from pathlib import Path

# Import using relative path from build_scripts root
from core.build_system import FlutterBloomBuildSystem


def main():
    """Main build system entry point"""
    try:
        build_system = FlutterBloomBuildSystem()
        result = build_system.run()

        if not result['success']:
            print(f"[BUILD-ERROR] Build system failed: {result.get('error', 'Unknown error')}")
            sys.exit(1)

        print("[BUILD-SUCCESS] Build system completed successfully")

    except KeyboardInterrupt:
        print("\n[BUILD-CANCELLED] Build cancelled by user")
        sys.exit(1)
    except Exception as e:
        print(f"[BUILD-ERROR] Unexpected error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()