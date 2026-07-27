# -*- coding: utf-8 -*-
"""
Punctuation Markers — canonical location: pyutils/text/punctuation_markers.py

Moved from pyfoundations.punctuation_markers (FIX V10).
pyfoundations.punctuation_markers now shims to this module.
"""

# Re-export everything from the source implementation
from pycore.pyfoundations.punctuation_markers import *  # noqa: F401, F403

try:
    from pycore.pyfoundations.punctuation_markers import __all__
except ImportError:
    pass
