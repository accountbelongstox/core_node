import os

file_path = r"d:\programing\core_node\pycore\pyfoundations\third_party\_getters_optional.py"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# Fix vosk
content = content.replace(
    """        try:
            _PACKAGE_CACHE['vosk'] = vosk""",
    """        try:
            import vosk
            _PACKAGE_CACHE['vosk'] = vosk"""
)

# Fix whisper
content = content.replace(
    """        try:
            _PACKAGE_CACHE['whisper'] = whisper""",
    """        try:
            import whisper
            _PACKAGE_CACHE['whisper'] = whisper"""
)

# Fix easyocr
content = content.replace(
    """        try:
            _PACKAGE_CACHE['easyocr'] = easyocr""",
    """        try:
            import easyocr
            _PACKAGE_CACHE['easyocr'] = easyocr"""
)

# Fix watchdog
content = content.replace(
    """        try:
            _PACKAGE_CACHE['watchdog'] = watchdog""",
    """        try:
            import watchdog
            _PACKAGE_CACHE['watchdog'] = watchdog"""
)

content = content.replace(
    """                try:
                    _PACKAGE_CACHE['watchdog'] = watchdog""",
    """                try:
                    import watchdog
                    _PACKAGE_CACHE['watchdog'] = watchdog"""
)

# Fix pyaudio
content = content.replace(
    """        try:
            _PACKAGE_CACHE['pyaudio'] = pyaudio""",
    """        try:
            import pyaudio
            _PACKAGE_CACHE['pyaudio'] = pyaudio"""
)

# Fix tkinter
content = content.replace(
    """        try:
            # IMPORTANT: Import tkinter.ttk to ensure ttk becomes an attribute of tkinter
            # This is required because tkinter.ttk is a submodule and not automatically imported
            _PACKAGE_CACHE['tkinter'] = _tkinter_module""",
    """        try:
            import tkinter as _tkinter_module
            import tkinter.ttk
            import tkinter.font
            import tkinter.messagebox
            import tkinter.filedialog
            import tkinter.scrolledtext
            _PACKAGE_CACHE['tkinter'] = _tkinter_module"""
)

# Fix sherpa_onnx
content = content.replace(
    """        try:
            _PACKAGE_CACHE['sherpa_onnx'] = sherpa_onnx""",
    """        try:
            import sherpa_onnx
            _PACKAGE_CACHE['sherpa_onnx'] = sherpa_onnx"""
)

# Fix melo
content = content.replace(
    """        try:
            _PACKAGE_CACHE['melo'] = melo""",
    """        try:
            import melo
            _PACKAGE_CACHE['melo'] = melo"""
)

# Fix pywinauto
content = content.replace(
    """        if current_platform == 'Windows':
            _PACKAGE_CACHE['pywinauto'] = pywinauto""",
    """        if current_platform == 'Windows':
            import pywinauto
            _PACKAGE_CACHE['pywinauto'] = pywinauto"""
)

# Fix pygetwindow
content = content.replace(
    """        if current_platform == 'Windows':
            _PACKAGE_CACHE['pygetwindow'] = pygetwindow""",
    """        if current_platform == 'Windows':
            import pygetwindow
            _PACKAGE_CACHE['pygetwindow'] = pygetwindow"""
)

# Fix uiautomation
content = content.replace(
    """        if current_platform == 'Windows':
            _PACKAGE_CACHE['uiautomation'] = uiautomation""",
    """        if current_platform == 'Windows':
            import uiautomation
            _PACKAGE_CACHE['uiautomation'] = uiautomation"""
)

# Fix pyaudiowpatch
content = content.replace(
    """            try:
                _PACKAGE_CACHE['pyaudiowpatch'] = pyaudiowpatch""",
    """            try:
                import pyaudiowpatch
                _PACKAGE_CACHE['pyaudiowpatch'] = pyaudiowpatch"""
)

# Fix windows_ocr
content = content.replace(
    """        try:
            from winrt.windows.graphics.imaging import (
                SoftwareBitmap,
                BitmapPixelFormat,
                BitmapAlphaMode,
            )
            _PACKAGE_CACHE[cache_key] = type('WindowsOcrNamespace', (), {""",
    """        try:
            from winrt.windows.media.ocr import OcrEngine, OcrResult, OcrLine, OcrWord
            from winrt.windows.graphics.imaging import (
                SoftwareBitmap,
                BitmapPixelFormat,
                BitmapAlphaMode,
            )
            from winrt.windows.storage.streams import Buffer
            from winrt.windows.globalization import Language
            from winrt.windows.foundation import IAsyncOperation
            _PACKAGE_CACHE[cache_key] = type('WindowsOcrNamespace', (), {"""
)

content = content.replace(
    """            try:
                from winrt.windows.graphics.imaging import (
                    SoftwareBitmap,
                    BitmapPixelFormat,
                    BitmapAlphaMode,
                )
                _PACKAGE_CACHE[cache_key] = type('WindowsOcrNamespace', (), {""",
    """            try:
                from winrt.windows.media.ocr import OcrEngine, OcrResult, OcrLine, OcrWord
                from winrt.windows.graphics.imaging import (
                    SoftwareBitmap,
                    BitmapPixelFormat,
                    BitmapAlphaMode,
                )
                from winrt.windows.storage.streams import Buffer
                from winrt.windows.globalization import Language
                from winrt.windows.foundation import IAsyncOperation
                _PACKAGE_CACHE[cache_key] = type('WindowsOcrNamespace', (), {"""
)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("Done")
