# -*- coding: utf-8 -*-
"""Windows Core Audio endpoints over raw COM (ctypes): active capture devices, their default
per role, and switching that default (IPolicyConfig, the interface the Sound control panel uses).
Every call runs in its own COM apartment on the calling thread. Windows only."""

from __future__ import annotations

import ctypes
from typing import Callable, Dict, List, Optional, Tuple

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.pygvar import IS_WINDOWS

CLSID_MM_DEVICE_ENUMERATOR = "{BCDE0395-E52F-467C-8E3D-C4579291692E}"
IID_MM_DEVICE_ENUMERATOR = "{A95664D2-9614-4F35-A746-DE8DB63617E6}"
CLSID_POLICY_CONFIG_CLIENT = "{870AF99C-171D-4F9E-AF0D-E63DF40C2BC9}"
IID_POLICY_CONFIG = "{F8679F50-850A-41CF-9C72-430F290290C8}"
PKEY_DEVICE_FRIENDLY_NAME_FMTID = "{A45C254E-DF1C-4EFD-8020-67D146A850E0}"
PKEY_DEVICE_FRIENDLY_NAME_PID = 14
CLSCTX_ALL = 0x17
COINIT_APARTMENTTHREADED = 0x2
DATA_FLOW_CAPTURE = 1
DEVICE_STATE_ACTIVE = 0x1
STGM_READ = 0
VT_LPWSTR = 31
# ERole: console, multimedia, communications.
ROLES = (0, 1, 2)
# vtable slots (IUnknown takes 0-2).
SLOT_RELEASE = 2
SLOT_ENUM_AUDIO_ENDPOINTS = 3
SLOT_GET_DEFAULT_AUDIO_ENDPOINT = 4
SLOT_COLLECTION_GET_COUNT = 3
SLOT_COLLECTION_ITEM = 4
SLOT_DEVICE_OPEN_PROPERTY_STORE = 4
SLOT_DEVICE_GET_ID = 5
SLOT_PROPERTY_STORE_GET_VALUE = 5
SLOT_POLICY_SET_DEFAULT_ENDPOINT = 13


class _Guid(ctypes.Structure):
    _fields_ = [("data1", ctypes.c_uint32), ("data2", ctypes.c_uint16),
                ("data3", ctypes.c_uint16), ("data4", ctypes.c_ubyte * 8)]


class _PropertyKey(ctypes.Structure):
    _fields_ = [("fmtid", _Guid), ("pid", ctypes.c_uint32)]


class _PropVariant(ctypes.Structure):
    _fields_ = [("vt", ctypes.c_ushort), ("reserved1", ctypes.c_ushort), ("reserved2", ctypes.c_ushort),
                ("reserved3", ctypes.c_ushort), ("value", ctypes.c_void_p), ("extra", ctypes.c_void_p)]


def _guid(text: str) -> _Guid:
    guid = _Guid()
    ctypes.oledll.ole32.CLSIDFromString(ctypes.c_wchar_p(text), ctypes.byref(guid))
    return guid


def _call(interface: ctypes.c_void_p, slot: int, argtypes: Tuple, *args) -> int:
    """HRESULT of vtable method <slot> of a COM interface pointer."""
    vtable = ctypes.cast(interface, ctypes.POINTER(ctypes.POINTER(ctypes.c_void_p)))[0]
    method = ctypes.WINFUNCTYPE(ctypes.c_long, ctypes.c_void_p, *argtypes)(vtable[slot])
    return int(method(interface, *args))


def _release(interface: ctypes.c_void_p) -> None:
    if interface:
        vtable = ctypes.cast(interface, ctypes.POINTER(ctypes.POINTER(ctypes.c_void_p)))[0]
        ctypes.WINFUNCTYPE(ctypes.c_ulong, ctypes.c_void_p)(vtable[SLOT_RELEASE])(interface)


def _create(clsid: str, iid: str) -> Optional[ctypes.c_void_p]:
    instance = ctypes.c_void_p()
    result = ctypes.windll.ole32.CoCreateInstance(
        ctypes.byref(_guid(clsid)), None, CLSCTX_ALL, ctypes.byref(_guid(iid)), ctypes.byref(instance))
    return instance if result >= 0 and instance else None


def _device_id(device: ctypes.c_void_p) -> Optional[str]:
    pointer = ctypes.c_void_p()
    if _call(device, SLOT_DEVICE_GET_ID, (ctypes.POINTER(ctypes.c_void_p),), ctypes.byref(pointer)) < 0:
        return None
    value = ctypes.wstring_at(pointer.value)
    ctypes.windll.ole32.CoTaskMemFree(pointer)
    return value


def _friendly_name(device: ctypes.c_void_p) -> str:
    store = ctypes.c_void_p()
    if _call(device, SLOT_DEVICE_OPEN_PROPERTY_STORE, (ctypes.c_uint32, ctypes.POINTER(ctypes.c_void_p)),
             STGM_READ, ctypes.byref(store)) < 0:
        return ""
    key = _PropertyKey(_guid(PKEY_DEVICE_FRIENDLY_NAME_FMTID), PKEY_DEVICE_FRIENDLY_NAME_PID)
    variant = _PropVariant()
    name = ""
    if _call(store, SLOT_PROPERTY_STORE_GET_VALUE, (ctypes.POINTER(_PropertyKey), ctypes.POINTER(_PropVariant)),
             ctypes.byref(key), ctypes.byref(variant)) >= 0 and variant.vt == VT_LPWSTR and variant.value:
        name = ctypes.wstring_at(variant.value)
    ctypes.windll.ole32.PropVariantClear(ctypes.byref(variant))
    _release(store)
    return name


class WindowsAudioEndpoints:
    """Capture endpoints and their defaults; every method returns an empty result off Windows or on a COM failure."""

    def capture_endpoints(self) -> List[Tuple[str, str]]:
        """(endpoint id, friendly name) of every active capture device."""
        return self._in_apartment(self._capture_endpoints, [])

    def find_capture(self, name_part: str) -> Optional[str]:
        """Id of the first active capture device whose friendly name contains name_part."""
        lowered = name_part.lower()
        return next((endpoint for endpoint, name in self.capture_endpoints() if lowered in name.lower()), None)

    def default_captures(self) -> Dict[int, str]:
        """Default capture endpoint id per role."""
        return self._in_apartment(self._default_captures, {})

    def policy_available(self) -> bool:
        return self._in_apartment(self._policy_available, False)

    def set_default(self, endpoint_id: str, roles: Tuple[int, ...] = ROLES) -> bool:
        return self._in_apartment(lambda: self._set_default(endpoint_id, roles), False)

    @staticmethod
    def _in_apartment(body: Callable, fallback):
        if not IS_WINDOWS:
            return fallback
        initialized = ctypes.windll.ole32.CoInitializeEx(None, COINIT_APARTMENTTHREADED)
        try:
            return body()
        except OSError as exc:
            ColorPrint.yellow(f"[WindowsAudioEndpoints] Core Audio call failed: {exc}")
            return fallback
        finally:
            if initialized >= 0:
                ctypes.windll.ole32.CoUninitialize()

    @staticmethod
    def _capture_endpoints() -> List[Tuple[str, str]]:
        enumerator = _create(CLSID_MM_DEVICE_ENUMERATOR, IID_MM_DEVICE_ENUMERATOR)
        if enumerator is None:
            return []
        collection = ctypes.c_void_p()
        endpoints: List[Tuple[str, str]] = []
        if _call(enumerator, SLOT_ENUM_AUDIO_ENDPOINTS, (ctypes.c_int, ctypes.c_uint32, ctypes.POINTER(ctypes.c_void_p)),
                 DATA_FLOW_CAPTURE, DEVICE_STATE_ACTIVE, ctypes.byref(collection)) >= 0:
            count = ctypes.c_uint32()
            _call(collection, SLOT_COLLECTION_GET_COUNT, (ctypes.POINTER(ctypes.c_uint32),), ctypes.byref(count))
            for index in range(count.value):
                device = ctypes.c_void_p()
                if _call(collection, SLOT_COLLECTION_ITEM, (ctypes.c_uint32, ctypes.POINTER(ctypes.c_void_p)),
                         index, ctypes.byref(device)) < 0:
                    continue
                endpoint = _device_id(device)
                if endpoint:
                    endpoints.append((endpoint, _friendly_name(device)))
                _release(device)
            _release(collection)
        _release(enumerator)
        return endpoints

    @staticmethod
    def _default_captures() -> Dict[int, str]:
        enumerator = _create(CLSID_MM_DEVICE_ENUMERATOR, IID_MM_DEVICE_ENUMERATOR)
        if enumerator is None:
            return {}
        defaults: Dict[int, str] = {}
        for role in ROLES:
            device = ctypes.c_void_p()
            if _call(enumerator, SLOT_GET_DEFAULT_AUDIO_ENDPOINT, (ctypes.c_int, ctypes.c_int, ctypes.POINTER(ctypes.c_void_p)),
                     DATA_FLOW_CAPTURE, role, ctypes.byref(device)) < 0:
                continue
            endpoint = _device_id(device)
            if endpoint:
                defaults[role] = endpoint
            _release(device)
        _release(enumerator)
        return defaults

    @staticmethod
    def _policy_available() -> bool:
        policy = _create(CLSID_POLICY_CONFIG_CLIENT, IID_POLICY_CONFIG)
        _release(policy)
        return policy is not None

    @staticmethod
    def _set_default(endpoint_id: str, roles: Tuple[int, ...]) -> bool:
        policy = _create(CLSID_POLICY_CONFIG_CLIENT, IID_POLICY_CONFIG)
        if policy is None:
            return False
        succeeded = all(
            _call(policy, SLOT_POLICY_SET_DEFAULT_ENDPOINT, (ctypes.c_wchar_p, ctypes.c_int), endpoint_id, role) >= 0
            for role in roles
        )
        _release(policy)
        return succeeded


windows_audio_endpoints = WindowsAudioEndpoints()
