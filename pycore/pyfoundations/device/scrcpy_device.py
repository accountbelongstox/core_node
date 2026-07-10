"""
Thin re-export of the canonical ScrcpyDevice.

The canonical scrcpy-server device implementation lives in
pycore.pyutils.device.scrcpy_device. This shim keeps pycore.pyfoundations.device
backward-compatible per the pkg-dedup-canonical rule (one canonical
implementation; siblings re-export).

Note: the previous 349-line standalone ScrcpyDevice here was an OLDER duplicate
(used a different DeviceInfo shape and pre-queue ADB calls). It was already
unimportable (relative imports .android_device/.device_info/.server_params
pointed at modules that do not exist in this package). Re-exporting the
canonical class fixes that and removes the duplicate.
"""

from pycore.pyutils.device.scrcpy_device import ScrcpyDevice

__all__ = ['ScrcpyDevice']
