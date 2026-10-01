# -*- coding: utf-8 -*-
"""
PostgreSQL cross-environment sync entry (run as a file by the Laravel start scripts):

    python3 <repo>/pycore/bootstrap/pg_sync.py --startup

Adds the repository root, then hands off to pycore.pyfoundations.pg_sync_adapter.
"""

import os
import sys

_REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, _REPO_ROOT)

import pycore.pyfoundations.pg_sync_adapter as pg_sync_adapter  # noqa: E402

raise SystemExit(pg_sync_adapter.main())
