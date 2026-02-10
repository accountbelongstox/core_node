# Optional dependencies for system tray. All loaded via pycore third_party style; no catch in this module.

from pycore.pyfoundations.third_party import (
    get_third_package_pythoncom,
    get_third_package_runtime,
    get_third_package_pystray,
    get_third_package_PIL_Image_optional,
    get_third_package_PIL_ImageDraw_optional,
)

pythoncom = get_third_package_pythoncom()

_runtime = get_third_package_runtime()
trigger_window_show = getattr(_runtime, "trigger_window_show", None) if _runtime else None
trigger_window_maximize = getattr(_runtime, "trigger_window_maximize", None) if _runtime else None
trigger_app_restart = getattr(_runtime, "trigger_app_restart", None) if _runtime else None
trigger_app_exit = getattr(_runtime, "trigger_app_exit", None) if _runtime else None

_pystray = get_third_package_pystray()
_Image = get_third_package_PIL_Image_optional()
_ImageDraw = get_third_package_PIL_ImageDraw_optional()

TRAY_AVAILABLE = (
    _pystray is not None
    and _Image is not None
    and _ImageDraw is not None
)
