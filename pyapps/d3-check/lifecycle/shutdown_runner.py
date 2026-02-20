# -*- coding: utf-8 -*-
"""
Shutdown runner: joins extension threads and stops task manager.
All thread references live here; only main and event bus may import lifecycle.
"""

from pycore.pyfoundations.color_print import ColorPrint
from threads.main_function_thread import get_main_function_thread
from threads.auxiliary_function_thread import get_auxiliary_function_thread
from threads.d3_extension_thread import get_d3_extension_thread
from threads.d4_extension_thread import get_d4_extension_thread
from threads.task_thread_manager import get_task_manager


def run_thread_shutdown_sequence() -> None:
    """
    Join all 4 extension threads and stop the task thread manager.
    Called from d3utils.shutdown_manager.execute_shutdown() via registered runner.
    """
    for getter, label in [
        (get_main_function_thread, "Main function"),
        (get_auxiliary_function_thread, "Auxiliary"),
        (get_d3_extension_thread, "D3/ROSBOT"),
        (get_d4_extension_thread, "D4"),
    ]:
        try:
            th = getter()
            if th and th.is_alive():
                ColorPrint.blue(f"[ShutdownManager] [0/5] Joining {label} thread...")
                th.request_shutdown()
                th.join(timeout=3.0)
                ColorPrint.green(f"[ShutdownManager] [OK] {label} thread stopped")
        except Exception as e:
            ColorPrint.red(f"[ShutdownManager] [ERROR] {label} thread error: {e}")

    try:
        ColorPrint.blue("[ShutdownManager] [2/5] Stopping task thread manager...")
        get_task_manager().stop_all()
        ColorPrint.green("[ShutdownManager] [OK] Task thread manager stopped")
    except Exception as e:
        ColorPrint.red(f"[ShutdownManager] [ERROR] Task thread manager error: {e}")
