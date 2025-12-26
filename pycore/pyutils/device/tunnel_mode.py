#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Scrcpy Tunnel Mode Abstraction

Based on official scrcpy documentation and source code:
- https://github.com/Genymobile/scrcpy/blob/master/doc/tunnels.md
- poly_apps/scrcpy/server/src/main/java/com/genymobile/scrcpy/device/DesktopConnection.java

Scrcpy supports two tunnel modes for ADB communication:
1. REVERSE mode (default, preferred)
2. FORWARD mode (fallback)
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Optional
import socket


@dataclass
class TunnelConfig:
    """Configuration for tunnel setup"""
    device_serial: str
    scid_hex: str  # 8-digit hex string, e.g., "1a2b3c4d"
    local_port: int
    device_socket_name: str  # e.g., "scrcpy_1a2b3c4d"


class TunnelMode(ABC):
    """
    Abstract base class for scrcpy tunnel modes

    A tunnel allows PC to communicate with device via ADB port forwarding.
    There are two modes: REVERSE (preferred) and FORWARD (fallback).
    """

    @abstractmethod
    def get_adb_tunnel_command(self, adb_path: str, config: TunnelConfig) -> list:
        """
        Get ADB command to setup tunnel

        Returns:
            List of command arguments for subprocess
        """
        pass

    @abstractmethod
    def get_server_parameter(self) -> Optional[str]:
        """
        Get server parameter for this tunnel mode

        Returns:
            Parameter string to append to server command, or None
            e.g., "tunnel_forward=true" or None
        """
        pass

    @abstractmethod
    def should_send_dummy_byte(self) -> bool:
        """
        Check if server sends dummy byte in this mode

        Returns:
            True if dummy byte is sent, False otherwise
        """
        pass

    @abstractmethod
    def create_client_socket(self, config: TunnelConfig, timeout: float) -> socket.socket:
        """
        Create and configure client socket for this mode

        Args:
            config: Tunnel configuration
            timeout: Socket timeout in seconds

        Returns:
            Configured socket (not connected yet)
        """
        pass

    @abstractmethod
    def get_mode_name(self) -> str:
        """Get human-readable mode name"""
        pass

    @abstractmethod
    def get_priority(self) -> int:
        """
        Get priority for this mode (lower = higher priority)

        Returns:
            Priority number (0 = highest priority)
        """
        pass


class ReverseTunnelMode(TunnelMode):
    """
    REVERSE Tunnel Mode (Default, Preferred)

    How it works:
    - ADB command: adb reverse localabstract:scrcpy_XXX tcp:PORT
    - PC creates ServerSocket and listens on PORT
    - Server (device) connects to PC via reverse tunnel
    - Server parameter: tunnelForward=false (default, can be omitted)
    - Dummy byte: NOT sent (server is client, connects directly)

    Advantages:
    - Default mode, more efficient
    - Recommended by official scrcpy

    Disadvantages:
    - Not supported on Android 8 and below with ADB over Wi-Fi
    - May fail with custom ADB transports

    Reference:
    - https://github.com/Genymobile/scrcpy/blob/master/doc/tunnels.md
    - DesktopConnection.java line 92-100
    """

    def get_adb_tunnel_command(self, adb_path: str, config: TunnelConfig) -> list:
        return [
            adb_path,
            "-s", config.device_serial,
            "reverse",
            f"localabstract:{config.device_socket_name}",
            f"tcp:{config.local_port}"
        ]

    def get_server_parameter(self) -> Optional[str]:
        # tunnelForward defaults to false, no need to specify
        return None

    def should_send_dummy_byte(self) -> bool:
        # Server connects as client, no dummy byte
        return False

    def create_client_socket(self, config: TunnelConfig, timeout: float) -> socket.socket:
        """
        In REVERSE mode, PC listens and device connects to us
        So we create a listening socket (ServerSocket)
        """
        listen_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        listen_socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        listen_socket.bind(('localhost', config.local_port))
        listen_socket.listen(1)
        listen_socket.settimeout(timeout)
        return listen_socket

    def get_mode_name(self) -> str:
        return "REVERSE"

    def get_priority(self) -> int:
        return 0  # Highest priority (preferred mode)


class ForwardTunnelMode(TunnelMode):
    """
    FORWARD Tunnel Mode (Fallback)

    How it works:
    - ADB command: adb forward tcp:PORT localabstract:scrcpy_XXX
    - Server (device) creates LocalServerSocket and listens
    - PC connects to server via forward tunnel
    - Server parameter: tunnelForward=true (REQUIRED!)
    - Dummy byte: SENT on first socket after accept() to detect connection errors

    Advantages:
    - More compatible (works with ADB over Wi-Fi on Android 8 and below)
    - Works with network devices (IP:PORT format)

    Disadvantages:
    - Slightly less efficient than REVERSE mode
    - Requires server to create ServerSocket and wait

    Reference:
    - https://github.com/Genymobile/scrcpy/blob/master/doc/tunnels.md
    - DesktopConnection.java line 64-90
    """

    def get_adb_tunnel_command(self, adb_path: str, config: TunnelConfig) -> list:
        return [
            adb_path,
            "-s", config.device_serial,
            "forward",
            f"tcp:{config.local_port}",
            f"localabstract:{config.device_socket_name}"
        ]

    def get_server_parameter(self) -> Optional[str]:
        # CRITICAL: Must set tunnelForward=true for FORWARD mode
        # This tells server to create LocalServerSocket and wait
        return "tunnel_forward=true"

    def should_send_dummy_byte(self) -> bool:
        # Server sends dummy byte after accept() to detect connection errors
        return True

    def create_client_socket(self, config: TunnelConfig, timeout: float) -> socket.socket:
        """
        In FORWARD mode, server listens and PC connects to it
        So we create a regular socket and connect to forwarded port
        """
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(timeout)
        return sock

    def get_mode_name(self) -> str:
        return "FORWARD"

    def get_priority(self) -> int:
        return 1  # Lower priority (fallback mode)


class TunnelModeFactory:
    """
    Factory for creating tunnel mode instances

    Usage:
        modes = TunnelModeFactory.get_all_modes_by_priority()
        for mode in modes:
            try:
                setup_tunnel(mode)
                break
            except:
                continue  # Try next mode
    """

    @staticmethod
    def get_reverse_mode() -> ReverseTunnelMode:
        """Get REVERSE mode instance (preferred)"""
        return ReverseTunnelMode()

    @staticmethod
    def get_forward_mode() -> ForwardTunnelMode:
        """Get FORWARD mode instance (fallback)"""
        return ForwardTunnelMode()

    @staticmethod
    def get_all_modes_by_priority() -> list[TunnelMode]:
        """
        Get all modes sorted by priority (preferred first)

        Returns:
            List of TunnelMode instances, sorted by priority
        """
        modes = [
            ReverseTunnelMode(),
            ForwardTunnelMode(),
        ]
        return sorted(modes, key=lambda m: m.get_priority())

    @staticmethod
    def get_mode_by_name(name: str) -> Optional[TunnelMode]:
        """
        Get mode by name

        Args:
            name: Mode name ("reverse" or "forward", case-insensitive)

        Returns:
            TunnelMode instance or None if not found
        """
        name = name.lower()
        if name == "reverse":
            return ReverseTunnelMode()
        elif name == "forward":
            return ForwardTunnelMode()
        else:
            return None


# Convenience exports
REVERSE_MODE = ReverseTunnelMode()
FORWARD_MODE = ForwardTunnelMode()
ALL_MODES = TunnelModeFactory.get_all_modes_by_priority()
