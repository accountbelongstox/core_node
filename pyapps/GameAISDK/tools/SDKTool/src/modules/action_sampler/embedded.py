# -*- coding: utf-8 -*-
"""
GameAISDK action_sampler as class library: import directly, control via in-memory API. No HTTP, no logging.config.
Usage: add action_sampler dir to sys.path, then:
  from embedded import RecordSession
  session = RecordSession.create(hwnd, config_dict, action_cfg_path_abs)
  session.start_segment() / session.end_segment() / session.stop()
"""

import os
import sys
import threading
import time

__cur_dir = os.path.dirname(os.path.abspath(__file__))
__sdk_src = os.path.abspath(os.path.join(__cur_dir, "..", ".."))  # action_sampler -> modules -> src
__pymodules = os.path.join(__cur_dir, "pymodules")
for _p in (__sdk_src, __pymodules):
    if _p not in sys.path:
        sys.path.insert(0, _p)

from actionsampler.action_sampler import ActionSampler, is_windows
if is_windows:
    from actionsampler.window_touch_sampler import unhook_all
from WrappedDeviceAPI.deviceAdapter import DeviceType


def _run_sampler(sampler):
    try:
        sampler.run()
    finally:
        sampler.finish()
    if is_windows:
        try:
            unhook_all()
        except Exception:
            pass


class RecordSession:
    """In-process recording session. Control via start_segment/end_segment/stop (no HTTP)."""

    def __init__(self, sampler, thread):
        self._sampler = sampler
        self._thread = thread

    def start_segment(self):
        if self._sampler is not None:
            self._sampler.set_start_segment()

    def end_segment(self):
        if self._sampler is not None:
            self._sampler.set_end_segment()

    def stop(self):
        if self._sampler is None:
            return
        self._sampler.set_end_segment()
        time.sleep(0.6)
        self._sampler.set_exited()
        self._thread.join(timeout=5)
        self._sampler = None
        self._thread = None

    def is_running(self):
        return self._thread is not None and self._thread.is_alive()

    @classmethod
    def create(cls, device_id, device_type, config_dict, action_cfg_path_abs):
        """
        Create and start a recording session (run loop in one thread). No HTTP.
        config_dict: GameName, SavePath, FrameFPS, FrameHeight, FrameWidth, Debug, OutputAsVideo, LogTimestamp.
        action_cfg_path_abs: absolute path to action.json.
        Returns RecordSession or None on init failure.
        """
        sampler = ActionSampler(device_id, device_type, continuous=False)
        if not sampler.init_embedded(config_dict, action_cfg_path_abs):
            return None
        thread = threading.Thread(target=_run_sampler, args=(sampler,), name="action_sampler_lib", daemon=False)
        thread.start()
        return cls(sampler, thread)
