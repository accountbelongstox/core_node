# -*- coding: utf-8 -*-
"""
Device Sync - Main Entry Point

Run as module:
    python -m pycore.pyutils.launcher.device_sync

Or with custom directory:
    python -m pycore.pyutils.launcher.device_sync D:/my/project

Auto-Background Mode:
    Automatically restarts with pythonw.exe to run in background.
    To disable (for debugging):
        set DEVICE_SYNC_NO_BACKGROUND=1
        python -m pycore.pyutils.launcher.device_sync
"""

from .tray_menu import main
from .daemon import auto_background_wrapper

# Wrap main with auto-background decorator
main = auto_background_wrapper(main)

if __name__ == '__main__':
    main()
