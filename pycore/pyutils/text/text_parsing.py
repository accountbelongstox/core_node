# -*- coding: utf-8 -*-
"""
Text Parsing Utilities — canonical location: pyutils/text/text_parsing.py

Moved from pyfoundations.text_parsing (FIX V10).
pyfoundations.text_parsing now shims to this module.
"""

# Re-export everything from the source implementation
from pycore.pyfoundations.text_parsing import *  # noqa: F401, F403

try:
    from pycore.pyfoundations.text_parsing import __all__
except ImportError:
    pass
