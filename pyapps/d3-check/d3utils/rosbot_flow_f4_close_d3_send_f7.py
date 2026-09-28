# -*- coding: utf-8 -*-
"""
[F4] F4a close D3, F4b send F7 to system to close ROSBOT (ROSBOT_FLOW_MERMAID.md F block).
After this step flow goes to B2_HasWin.
"""
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from d3utils.d3_manager import get_d3_manager
from d3utils.key_send import send_f7_to_system
from d3utils.rosbot_manager import get_rosbot_manager
from d3utils.rosbot_flow_rosbot_exit_state import set_f7_sent_for_rosbot


def run_f4_close_d3_send_f7() -> None:
    """[F4a] Close D3; [F4b] Send F7 to system to close ROSBOT. Caller then enters B2."""
    get_d3_manager().kill_if_running()
    ColorPrint.blue("[F4] D3 process ended")
    if send_f7_to_system():
        set_f7_sent_for_rosbot()
        ColorPrint.blue("[F4] F7 sent to system (close ROSBOT)")
    else:
        ColorPrint.yellow("[F4] F7 send failed")
    mgr = get_rosbot_manager()
    mgr.kill_if_running()  # synchronous (taskkill blocks); caller should refresh D3/ROSBOT so next tick gate sees gone
    mgr.invalidate_lookup_cache()
