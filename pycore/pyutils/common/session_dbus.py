# -*- coding: utf-8 -*-
from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Optional, Tuple

from pycore.pyfoundations.desktop_session import ensure_session_environment
from pycore.pyfoundations.third_party.api import get_third_package_jeepney_module
from pycore.pyutils.common.activity_log import ActivityLog


jeepney = get_third_package_jeepney_module()
jeepney_blocking = get_third_package_jeepney_module("io.blocking")
jeepney_bus_messages = get_third_package_jeepney_module("bus_messages")

DBUS_ERROR_BUS_UNAVAILABLE = "session_bus_unavailable"
DBUS_ERROR_TIMEOUT = "dbus_timeout"
DBUS_ERROR_SERVICE_UNKNOWN = "org.freedesktop.DBus.Error.ServiceUnknown"
DBUS_ERROR_ACCESS_DENIED = "org.freedesktop.DBus.Error.AccessDenied"
DBUS_ERROR_UNKNOWN_METHOD = "org.freedesktop.DBus.Error.UnknownMethod"
DEFAULT_CALL_TIMEOUT_SECONDS = 5.0
session_dbus_activity_log = ActivityLog("SessionDBus")


@dataclass(frozen=True)
class DBusReply:
    success: bool
    body: Tuple[Any, ...] = ()
    error_name: str = ""
    error_message: str = ""

    def value(self, index: int = 0, default: Any = None) -> Any:
        return self.body[index] if self.success and len(self.body) > index else default


def variant(signature: str, value: Any) -> Tuple[str, Any]:
    return (signature, value)


def open_session_bus() -> Optional[Any]:
    session = ensure_session_environment()
    if not session.dbus_address:
        return None
    try:
        return jeepney_blocking.open_dbus_connection(bus="SESSION")
    except (OSError, ValueError, KeyError) as error:
        session_dbus_activity_log.warning(
            "connect.failed",
            error_type=type(error).__name__,
            error=error,
        )
        return None


def call_method(
    connection: Any,
    destination: str,
    object_path: str,
    interface: str,
    method: str,
    signature: str = "",
    body: Tuple[Any, ...] = (),
    timeout: float = DEFAULT_CALL_TIMEOUT_SECONDS,
) -> DBusReply:
    address = jeepney.DBusAddress(object_path, bus_name=destination, interface=interface)
    message = jeepney.new_method_call(address, method, signature or None, body)
    try:
        reply = connection.send_and_get_reply(message, timeout=timeout)
    except TimeoutError:
        return DBusReply(False, error_name=DBUS_ERROR_TIMEOUT)
    if reply.header.message_type == jeepney.MessageType.error:
        error_name = str(reply.header.fields.get(jeepney.HeaderFields.error_name, ""))
        error_message = str(reply.body[0]) if reply.body else ""
        return DBusReply(False, error_name=error_name, error_message=error_message)
    return DBusReply(True, body=tuple(reply.body))


def call_session_method(
    destination: str,
    object_path: str,
    interface: str,
    method: str,
    signature: str = "",
    body: Tuple[Any, ...] = (),
    timeout: float = DEFAULT_CALL_TIMEOUT_SECONDS,
) -> DBusReply:
    connection = open_session_bus()
    if connection is None:
        return DBusReply(False, error_name=DBUS_ERROR_BUS_UNAVAILABLE)
    reply = call_method(
        connection,
        destination,
        object_path,
        interface,
        method,
        signature,
        body,
        timeout,
    )
    connection.close()
    return reply


def name_has_owner(name: str) -> bool:
    reply = call_session_method(
        "org.freedesktop.DBus",
        "/org/freedesktop/DBus",
        "org.freedesktop.DBus",
        "NameHasOwner",
        "s",
        (name,),
    )
    return bool(reply.value(0, False))


def add_match(connection: Any, rule: Any) -> DBusReply:
    message = jeepney_bus_messages.message_bus.AddMatch(rule)
    reply = connection.send_and_get_reply(message, timeout=DEFAULT_CALL_TIMEOUT_SECONDS)
    if reply.header.message_type == jeepney.MessageType.error:
        return DBusReply(False, error_name=str(reply.header.fields.get(jeepney.HeaderFields.error_name, "")))
    return DBusReply(True)


def unique_name(connection: Any) -> str:
    return str(connection.unique_name or "")


__all__ = [
    "DBUS_ERROR_ACCESS_DENIED",
    "DBUS_ERROR_BUS_UNAVAILABLE",
    "DBUS_ERROR_SERVICE_UNKNOWN",
    "DBUS_ERROR_TIMEOUT",
    "DBUS_ERROR_UNKNOWN_METHOD",
    "DBusReply",
    "add_match",
    "call_method",
    "call_session_method",
    "name_has_owner",
    "open_session_bus",
    "unique_name",
    "variant",
]
