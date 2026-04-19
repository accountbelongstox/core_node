# -*- coding: utf-8 -*-
"""
Threads package: all threading.Thread-based classes and task thread manager.

Convention (see docs/THREADS_CONVENTION.md):
- Thread modules MAY import from d3utils (utils) and all other packages.
- No other package may import from threads except runtime (main/orchestrator).
- Runtime is the single consumer: creates/starts threads and re-exports get_task_manager,
  get_*_thread for the rest of the app.
"""
