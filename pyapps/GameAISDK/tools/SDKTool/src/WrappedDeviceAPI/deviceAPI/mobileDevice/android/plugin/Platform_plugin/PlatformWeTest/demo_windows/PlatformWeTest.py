# -*- coding: utf-8 -*-
"""
PlatformWeTest for Windows host: minimal implementation so that
GameAISDK Android/WeTest import chain succeeds. Real screen/touch may require
WeTest SDK or minicap/minitouch integration.
"""
from .....devicePlatform.IPlatformProxy import DeviceInfo, IPlatformProxy


class PlatformWeTest(IPlatformProxy):
    """Minimal PlatformWeTest implementation for Windows host."""

    def __init__(self):
        super(PlatformWeTest, self).__init__()
        self._initialized = False
        self._device_info = None

    def init(self, serial=None, is_portrait=True, long_edge=720, **kwargs):
        self._device_info = DeviceInfo()
        self._device_info.display_width = long_edge if not is_portrait else (long_edge * 9 // 16)
        self._device_info.display_height = long_edge if is_portrait else (long_edge * 9 // 16)
        self._device_info.touch_slot_number = 10
        self._initialized = True
        return True, ""

    def deinit(self):
        self._initialized = False
        self._device_info = None

    def get_image(self):
        if not self._initialized:
            return -1, None
        return 0, None

    def get_device_info(self):
        if not self._initialized or self._device_info is None:
            return None, "not initialized"
        return self._device_info, ""

    def get_rotation(self):
        return 0

    def touch_down(self, px, py, contact=0, pressure=50):
        pass

    def touch_up(self, contact=0):
        pass

    def touch_move(self, px, py, contact=0, pressure=50):
        pass

    def touch_wait(self, milliseconds):
        import time
        time.sleep(milliseconds / 1000.0)

    def touch_reset(self):
        pass

    def touch_finish(self):
        pass
