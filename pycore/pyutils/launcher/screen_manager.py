# -*- coding: utf-8 -*-
"""
Screen Manager
Handles screen dimension detection across all monitors
"""

import ctypes
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint

# Win32 API constants
SM_XVIRTUALSCREEN = 76
SM_YVIRTUALSCREEN = 77
SM_CXVIRTUALSCREEN = 78
SM_CYVIRTUALSCREEN = 79


class RECT(ctypes.Structure):
    _fields_ = [("left", ctypes.c_long),
                ("top", ctypes.c_long),
                ("right", ctypes.c_long),
                ("bottom", ctypes.c_long)]


class MONITORINFO(ctypes.Structure):
    _fields_ = [("cbSize", ctypes.c_uint),
                ("rcMonitor", RECT),
                ("rcWork", RECT),
                ("dwFlags", ctypes.c_uint)]


class ScreenManager:
    """Manage screen dimensions and virtual desktop detection"""
    
    @staticmethod
    def get_screen_dimensions():
        """
        Get virtual desktop dimensions (entire OS desktop across all monitors)
        
        Returns:
            tuple: (screen_x, screen_y, screen_width, screen_height)
        """
        user32 = ctypes.windll.user32
        
        try:
            # Get virtual screen position and size (covers all monitors)
            screen_x = user32.GetSystemMetrics(SM_XVIRTUALSCREEN)
            screen_y = user32.GetSystemMetrics(SM_YVIRTUALSCREEN)
            screen_width = user32.GetSystemMetrics(SM_CXVIRTUALSCREEN)
            screen_height = user32.GetSystemMetrics(SM_CYVIRTUALSCREEN)
            
            if screen_width <= 0 or screen_height <= 0:
                raise ValueError("Invalid virtual screen dimensions from GetSystemMetrics")
            
            ColorPrint.plain("Using Win32 API: Virtual desktop (all monitors) dimensions")
            ColorPrint.plain(f"Screen dimensions: {screen_width}x{screen_height}")
            ColorPrint.plain(f"Screen position: {screen_x}, {screen_y}")
            return screen_x, screen_y, screen_width, screen_height
        except Exception as e:
            # Fallback: Calculate virtual desktop from all screens using EnumDisplayMonitors
            ColorPrint.plain("Warning: Win32 API method failed, calculating from all screens")
            try:
                monitors_bounds = []
                
                def monitor_enum_proc(hMonitor, hdcMonitor, lprcMonitor, dwData):
                    """Callback for EnumDisplayMonitors"""
                    monitor_info = MONITORINFO()
                    monitor_info.cbSize = ctypes.sizeof(MONITORINFO)
                    if user32.GetMonitorInfoW(hMonitor, ctypes.byref(monitor_info)):
                        rect = monitor_info.rcMonitor
                        monitors_bounds.append((rect.left, rect.top, rect.right, rect.bottom))
                    return True
                
                MonitorEnumProc = ctypes.WINFUNCTYPE(ctypes.c_bool,
                                                      ctypes.POINTER(ctypes.c_int),
                                                      ctypes.POINTER(ctypes.c_int),
                                                      ctypes.POINTER(RECT),
                                                      ctypes.c_ulong)
                callback = MonitorEnumProc(monitor_enum_proc)
                
                user32.EnumDisplayMonitors.argtypes = [ctypes.POINTER(ctypes.c_int),
                                                         ctypes.POINTER(RECT),
                                                         MonitorEnumProc,
                                                         ctypes.c_ulong]
                user32.EnumDisplayMonitors.restype = ctypes.c_bool
                
                user32.EnumDisplayMonitors(None, None, callback, 0)
                
                if monitors_bounds:
                    min_x = min(b[0] for b in monitors_bounds)
                    min_y = min(b[1] for b in monitors_bounds)
                    max_x = max(b[2] for b in monitors_bounds)
                    max_y = max(b[3] for b in monitors_bounds)
                    
                    screen_x = min_x
                    screen_y = min_y
                    screen_width = max_x - min_x
                    screen_height = max_y - min_y
                    
                    ColorPrint.plain(f"Using EnumDisplayMonitors: Calculated virtual desktop from {len(monitors_bounds)} screen(s)")
                    ColorPrint.plain(f"Screen dimensions: {screen_width}x{screen_height}")
                    ColorPrint.plain(f"Screen position: {screen_x}, {screen_y}")
                    return screen_x, screen_y, screen_width, screen_height
                else:
                    raise ValueError("No monitors found")
            except Exception as e2:
                ColorPrint.plain(f"Error: Failed to get screen dimensions: {e2}")
                screen_width = user32.GetSystemMetrics(0)
                screen_height = user32.GetSystemMetrics(1)
                ColorPrint.plain("Using Win32 API: Primary screen dimensions only")
                ColorPrint.plain(f"Screen dimensions: {screen_width}x{screen_height}")
                return 0, 0, screen_width, screen_height

