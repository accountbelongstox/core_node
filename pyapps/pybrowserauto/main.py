#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Document Offline Main Entry Point

PyApps entry point that uses pycore.pyctl.document_offline implementation.
"""

import sys
from pathlib import Path

# Add project root to path
PROJECT_ROOT = Path(__file__).parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

# One-line import from pycore
from pycore.pyctl.document_offline.controller.cli_controller import main


if __name__ == '__main__':
    main()
