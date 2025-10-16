#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Shared import helpers for providor modules.
Ensures the ncore package path is available and exposes commonly used pytools utilities.
"""

import sys
import os
from pathlib import Path
from typing import Final

# Add ncore and pycore paths for pytools access
# Current file: apps/d3-check/providor/common_imports.py
# Need to go up 3 levels to reach core_node, then add core_node (for pycore) and ncore
current_dir = os.path.dirname(__file__)  # apps/d3-check/providor
d3_check_dir = os.path.dirname(current_dir)  # apps/d3-check
apps_dir = os.path.dirname(d3_check_dir)  # apps
core_node_dir = os.path.dirname(apps_dir)  # core_node
ncore_path = os.path.join(core_node_dir, "ncore")

# Add core_node to path (so we can import pycore.xxx)
if core_node_dir not in sys.path:
    sys.path.insert(0, core_node_dir)
# Add ncore to path (so we can import pytools.xxx)
if ncore_path not in sys.path:
    sys.path.insert(0, ncore_path)

# pytools foundations
from pytools.pyfoundations.color_print import ColorPrint  # noqa: E402
from pytools.pyfoundations.encyclopedia import ENCYCLOPEDIA  # noqa: E402

# pytools utils - Core utilities
from pytools.pyutils.click_handler import ClickHandler  # noqa: E402
from pytools.pyutils.window_screenshot import WindowScreenshot  # noqa: E402

# pytools utils - Image processing
from pytools.pyutils.image_annotator import ImageAnnotator  # noqa: E402
from pytools.pyutils.image_comparator import ImageComparator  # noqa: E402
from pytools.pyutils.image_crop import ImageCrop  # noqa: E402
from pytools.pyutils.image_matcher import ImageMatcher  # noqa: E402

# pytools utils - OCR
from pytools.pyutils.ocr_cnocr_engine import CnOCREngine  # noqa: E402

# pytools utils - Hotkey listener (explicit imports instead of *)
from pytools.pyutils.hotkey_listener import (  # noqa: E402
    HotkeyListener,
    HotkeyType,
    HotkeyInfo,
    get_global_hotkey_listener,
    register_global_hotkey,
    unregister_global_hotkey,
    start_global_hotkey_listening,
    stop_global_hotkey_listening,
)

# pytools utils - Advanced features (from pycore)
from pycore.pyutils.ultralytics.ultralytics_trainer import UltralyticsTrainer, TrainingConfig  # noqa: E402
from pycore.pyutils.ultralytics.classification_trainer import (  # noqa: E402
    ClassificationTrainer as UltralyticsClassificationTrainer,
)
from pytools.pyutils.window_activator import WindowActivator  # noqa: E402
from pytools.pyutils.dataset_generator import DatasetGenerator  # noqa: E402
# Note: PNGMatcher has been replaced by ImageMatcher, no need to import separately

__all__ = [
    'ColorPrint',
    'ENCYCLOPEDIA',
    'ClickHandler',
    'WindowScreenshot',
    'ImageAnnotator',
    'ImageComparator',
    'ImageCrop',
    'ImageMatcher',
    'CnOCREngine',
    'HotkeyListener',
    'HotkeyType',
    'HotkeyInfo',
    'get_global_hotkey_listener',
    'register_global_hotkey',
    'unregister_global_hotkey',
    'start_global_hotkey_listening',
    'stop_global_hotkey_listening',
    'UltralyticsTrainer',
    'TrainingConfig',
    'ClassificationTrainer',
    'ClassificationPreprocessor',
    'ClassificationDataConfig',
    'create_classification_trainer',
    'WindowActivator',
    'DatasetGenerator',
]
