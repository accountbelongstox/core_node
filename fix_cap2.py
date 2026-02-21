p = r'pyapps\GameAISDK\tools\SDKTool\src\WrappedDeviceAPI\deviceAPI\pcDevice\windows\win32driver\capture.py'
with open(p, 'r', encoding='utf-8') as f:
    s = f.read()
# Set remaining GDI prototypes for 64-bit handles
old = '''        u32, g32 = ctypes.windll.user32, ctypes.windll.gdi32
        u32.GetWindowDC.argtypes = [ctypes.c_void_p]
        u32.GetWindowDC.restype = ctypes.c_void_p
        g32.CreateCompatibleDC.argtypes = [ctypes.c_void_p]
        g32.CreateCompatibleDC.restype = ctypes.c_void_p
        dc = u32.GetWindowDC(hwnd)
        cdc = g32.CreateCompatibleDC(dc)

        l, t, r, b = win32gui.GetWindowRect(hwnd)'''
new = '''        u32, g32 = ctypes.windll.user32, ctypes.windll.gdi32
        u32.GetWindowDC.argtypes = [ctypes.c_void_p]
        u32.GetWindowDC.restype = ctypes.c_void_p
        g32.CreateCompatibleDC.argtypes = [ctypes.c_void_p]
        g32.CreateCompatibleDC.restype = ctypes.c_void_p
        g32.CreateDIBSection.argtypes = [ctypes.c_void_p, ctypes.POINTER(BITMAPINFO), ctypes.c_uint, ctypes.POINTER(ctypes.c_void_p), ctypes.c_void_p, ctypes.c_uint]
        g32.CreateDIBSection.restype = ctypes.c_void_p
        g32.SelectObject.argtypes = [ctypes.c_void_p, ctypes.c_void_p]
        g32.SelectObject.restype = ctypes.c_void_p
        g32.BitBlt.argtypes = [ctypes.c_void_p, ctypes.c_int, ctypes.c_int, ctypes.c_int, ctypes.c_int, ctypes.c_void_p, ctypes.c_int, ctypes.c_int, ctypes.c_uint32]
        g32.BitBlt.restype = ctypes.c_int
        g32.GetDIBits.argtypes = [ctypes.c_void_p, ctypes.c_void_p, ctypes.c_uint, ctypes.c_uint, ctypes.c_void_p, ctypes.POINTER(BITMAPINFO), ctypes.c_uint]
        g32.GetDIBits.restype = ctypes.c_int
        g32.DeleteObject.argtypes = [ctypes.c_void_p]
        g32.DeleteObject.restype = ctypes.c_int
        g32.DeleteDC.argtypes = [ctypes.c_void_p]
        g32.DeleteDC.restype = ctypes.c_int
        dc = u32.GetWindowDC(hwnd)
        cdc = g32.CreateCompatibleDC(dc)

        l, t, r, b = win32gui.GetWindowRect(hwnd)'''
s = s.replace(old, new, 1)
old2 = 'hbm_capture = ctypes.windll.gdi32.CreateDIBSection(cdc,'
new2 = 'hbm_capture = g32.CreateDIBSection(cdc,'
s = s.replace(old2, new2, 1)
old3 = 'hbmOld = ctypes.windll.gdi32.SelectObject(cdc, hbm_capture)'
new3 = 'hbmOld = g32.SelectObject(cdc, hbm_capture)'
s = s.replace(old3, new3, 1)
old4 = 'ctypes.windll.gdi32.BitBlt(cdc,'
new4 = 'g32.BitBlt(cdc,'
s = s.replace(old4, new4, 1)
old5 = 'cpy_bytes = ctypes.windll.gdi32.GetDIBits(cdc,'
new5 = 'cpy_bytes = g32.GetDIBits(cdc,'
s = s.replace(old5, new5, 1)
old6 = 'ctypes.windll.gdi32.SelectObject(cdc, hbmOld)'
new6 = 'g32.SelectObject(cdc, hbmOld)'
s = s.replace(old6, new6, 1)
old7 = 'ctypes.windll.gdi32.DeleteObject(hbm_capture)'
new7 = 'g32.DeleteObject(hbm_capture)'
s = s.replace(old7, new7, 1)
old8 = 'ctypes.windll.gdi32.DeleteDC(cdc)\n        ctypes.windll.gdi32.DeleteDC(dc)'
new8 = 'g32.DeleteDC(cdc)\n        g32.DeleteDC(dc)'
s = s.replace(old8, new8, 1)
with open(p, 'w', encoding='utf-8') as f:
    f.write(s)
print('done')
