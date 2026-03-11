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
if _runtime is not None:
    trigger_window_show = _runtime.trigger_window_show
    trigger_window_maximize = _runtime.trigger_window_maximize
    trigger_app_restart = _runtime.trigger_app_restart
    trigger_app_exit = _runtime.trigger_app_exit
else:
    trigger_window_show = None
    trigger_window_maximize = None
    trigger_app_restart = None
    trigger_app_exit = None

_pystray = get_third_package_pystray()
_Image = get_third_package_PIL_Image_optional()
_ImageDraw = get_third_package_PIL_ImageDraw_optional()

TRAY_AVAILABLE = (
    _pystray is not None
    and _Image is not None
    and _ImageDraw is not None
)
