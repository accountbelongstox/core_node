#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import sys
from pathlib import Path

# Add parent directory to path for module imports
PARENT_DIR = Path(__file__).parent.parent.absolute()
if str(PARENT_DIR) not in sys.path:
    sys.path.insert(0, str(PARENT_DIR))
