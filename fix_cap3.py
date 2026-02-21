p = r'pyapps\GameAISDK\tools\SDKTool\src\WrappedDeviceAPI\deviceAPI\pcDevice\windows\win32driver\capture.py'
with open(p, 'r', encoding='utf-8') as f:
    s = f.read()
s = s.replace('    except ValueError:', '    except (ValueError, OverflowError, ctypes.ArgumentError):')
with open(p, 'w', encoding='utf-8') as f:
    f.write(s)
print('ok')
