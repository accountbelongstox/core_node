"""
Installation Monitor - Main Entry Point
Launches the GUI interface for monitoring software installations
"""

import sys
import tkinter as tk
from pathlib import Path

# Add current directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from monitor_gui import MonitorGUI
from config import ensure_cache_directories


def main():
    """Main entry point for Installation Monitor"""
    print("Starting Software Installation Monitor...")
    print("Initializing cache directories...")
    
    # Ensure cache directories exist
    ensure_cache_directories()
    
    print("Initializing GUI...")

    try:
        root = tk.Tk()
        app = MonitorGUI(root)

        print("GUI loaded successfully!")
        print("Ready to monitor software installations.\n")

        root.mainloop()

    except Exception as e:
        print(f"\nError starting application: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
