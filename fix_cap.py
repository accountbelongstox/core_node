p = r'pyapps\GameAISDK\tools\SDKTool\src\WrappedDeviceAPI\deviceAPI\pcDevice\windows\win32driver\capture.py'
with open(p, 'r', encoding='utf-8') as f:
    s = f.read()
old = '        dc = ctypes.windll.user32.GetWindowDC(hwnd)\n        cdc = ctypes.windll.gdi32.CreateCompatibleDC(dc)'
new = '        u32, g32 = ctypes.windll.user32, ctypes.windll.gdi32\n        u32.GetWindowDC.argtypes = [ctypes.c_void_p]\n        u32.GetWindowDC.restype = ctypes.c_void_p\n        g32.CreateCompatibleDC.argtypes = [ctypes.c_void_p]\n        g32.CreateCompatibleDC.restype = ctypes.c_void_p\n        dc = u32.GetWindowDC(hwnd)\n        cdc = g32.CreateCompatibleDC(dc)'
s = s.replace(old, new, 1)
with open(p, 'w', encoding='utf-8') as f:
    f.write(s)
print('done')
