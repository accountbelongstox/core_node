# -*- coding: utf-8 -*-
"""
Screen Manager
Handles screen dimension detection across all monitors
"""

import ctypes
import platform
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyutils.launcher.linux_screen_manager import LinuxScreenManager

IS_WINDOWS = platform.system() == "Windows"
IS_LINUX = platform.system() == "Linux"

# Win32 API constants
SM_XVIRTUALSCREEN = 76
SM_YVIRTUALSCREEN = 77
SM_CXVIRTUALSCREEN = 78
SM_CYVIRTUALSCREEN = 79
ENUM_CURRENT_SETTINGS = 0xFFFFFFFF
CCHDEVICENAME = 32
CCHFORMNAME = 32


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


class DEVMODEW(ctypes.Structure):
    _fields_ = [("dmDeviceName", ctypes.c_wchar * CCHDEVICENAME),
                ("dmSpecVersion", ctypes.c_uint16),
                ("dmDriverVersion", ctypes.c_uint16),
                ("dmSize", ctypes.c_uint16),
                ("dmDriverExtra", ctypes.c_uint16),
                ("dmFields", ctypes.c_uint32),
                ("dmPositionX", ctypes.c_int32),
                ("dmPositionY", ctypes.c_int32),
                ("dmDisplayOrientation", ctypes.c_uint32),
                ("dmDisplayFixedOutput", ctypes.c_uint32),
                ("dmColor", ctypes.c_int16),
                ("dmDuplex", ctypes.c_int16),
                ("dmYResolution", ctypes.c_int16),
                ("dmTTOption", ctypes.c_int16),
                ("dmCollate", ctypes.c_int16),
                ("dmFormName", ctypes.c_wchar * CCHFORMNAME),
                ("dmLogPixels", ctypes.c_uint16),
                ("dmBitsPerPel", ctypes.c_uint32),
                ("dmPelsWidth", ctypes.c_uint32),
                ("dmPelsHeight", ctypes.c_uint32),
                ("dmDisplayFlags", ctypes.c_uint32),
                ("dmDisplayFrequency", ctypes.c_uint32),
                ("dmICMMethod", ctypes.c_uint32),
                ("dmICMIntent", ctypes.c_uint32),
                ("dmMediaType", ctypes.c_uint32),
                ("dmDitherType", ctypes.c_uint32),
                ("dmReserved1", ctypes.c_uint32),
                ("dmReserved2", ctypes.c_uint32),
                ("dmPanningWidth", ctypes.c_uint32),
                ("dmPanningHeight", ctypes.c_uint32)]


class ScreenManager:
    """Manage screen dimensions and virtual desktop detection"""

    @staticmethod
    def get_physical_primary_resolution():
        """
        Physical (unscaled) primary display mode, independent of DPI awareness.

        Returns:
            tuple: (width, height) in pixels, or None when unavailable.
        """
        if not IS_WINDOWS:
            return None
        user32 = ctypes.windll.user32
        user32.EnumDisplaySettingsW.argtypes = [ctypes.c_wchar_p,
                                                ctypes.c_uint32,
                                                ctypes.POINTER(DEVMODEW)]
        user32.EnumDisplaySettingsW.restype = ctypes.c_int
        devmode = DEVMODEW()
        devmode.dmSize = ctypes.sizeof(DEVMODEW)
        devmode.dmDriverExtra = 0
        if not user32.EnumDisplaySettingsW(None, ENUM_CURRENT_SETTINGS, ctypes.byref(devmode)):
            return None
        if devmode.dmPelsWidth == 0 or devmode.dmPelsHeight == 0:
            return None
        return int(devmode.dmPelsWidth), int(devmode.dmPelsHeight)

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


def create_screen_manager():
    """Screen manager for the current OS (both expose get_screen_dimensions)."""
    if IS_LINUX:
        return LinuxScreenManager()
    return ScreenManager()

