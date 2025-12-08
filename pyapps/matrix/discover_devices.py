#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Matrix Device Discovery Script

Discovers:
1. Local ADB devices (USB connected)
2. WiFi ADB devices (already connected)
3. LAN RPC v2 services
"""

import sys
from pathlib import Path
from typing import List, Dict, Any
import asyncio

# Add project root to path
PROJECT_ROOT = Path(__file__).parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from pycore.pyutils.device.adb_manager import ADBManager
from pycore.pyutils.rpc_v2.discovery.network_scanner import NetworkScanner
from pycore import ColorPrint


class DeviceDiscovery:
    """Comprehensive device discovery"""

    def __init__(self, adb_path: str = "adb"):
        self.adb_path = adb_path
        self.network_scanner = NetworkScanner(debug=False)

    def discover_usb_devices(self) -> List[Dict[str, Any]]:
        """
        Discover USB-connected ADB devices

        Returns:
            List of device info dicts
        """
        print("\n" + "=" * 70)
        print("Scanning USB ADB Devices...")
        print("=" * 70)

        devices = []

        try:
            adb_devices = ADBManager.list_devices(self.adb_path)

            for device in adb_devices:
                serial = device.serial
                state = device.state.value

                # Skip non-device states
                if state != "device":
                    print(f"  [SKIP] {serial} - State: {state}")
                    continue

                # Get detailed properties
                props = ADBManager.get_device_properties(serial, self.adb_path)

                device_info = {
                    "serial": serial,
                    "state": state,
                    "connection": "usb",
                    "model": props.model if props else "Unknown",
                    "manufacturer": props.manufacturer if props else "Unknown",
                    "android_version": props.android_version if props else "Unknown",
                    "sdk_version": props.sdk_version if props else 0,
                }

                # Try to get IP address
                ip = ADBManager.get_device_ip(serial, self.adb_path)
                if ip:
                    device_info["wifi_ip"] = ip

                # Try to get battery
                battery = ADBManager.get_battery_status(serial, self.adb_path)
                if battery:
                    device_info["battery"] = {
                        "level": battery.level,
                        "charging": battery.charging,
                        "temperature": battery.temperature
                    }

                # Try to get resolution
                width, height = ADBManager.get_screen_resolution(serial, self.adb_path)
                if width > 0 and height > 0:
                    device_info["resolution"] = f"{width}x{height}"

                devices.append(device_info)

                # Print device info
                print(f"\n  [OK] {serial}")
                print(f"       Model: {device_info['model']}")
                print(f"       Manufacturer: {device_info['manufacturer']}")
                print(f"       Android: {device_info['android_version']} (SDK {device_info['sdk_version']})")
                if "wifi_ip" in device_info:
                    print(f"       WiFi IP: {device_info['wifi_ip']}")
                if "battery" in device_info:
                    bat = device_info["battery"]
                    charge_status = "Charging" if bat["charging"] else "Discharging"
                    print(f"       Battery: {bat['level']}% ({charge_status})")
                if "resolution" in device_info:
                    print(f"       Resolution: {device_info['resolution']}")

        except Exception as e:
            ColorPrint.red(f"  [ERROR] Failed to scan USB devices: {e}")

        print(f"\n  Total USB devices found: {len(devices)}")
        return devices

    def discover_wifi_devices(self) -> List[Dict[str, Any]]:
        """
        Discover WiFi-connected ADB devices

        Returns:
            List of WiFi device info dicts
        """
        print("\n" + "=" * 70)
        print("Scanning WiFi ADB Devices...")
        print("=" * 70)

        devices = []

        try:
            all_devices = ADBManager.list_devices(self.adb_path)

            for device in all_devices:
                serial = device.serial

                # WiFi devices have IP:PORT format
                if ":" not in serial:
                    continue

                state = device.state.value

                if state != "device":
                    print(f"  [SKIP] {serial} - State: {state}")
                    continue

                # Parse IP and port
                parts = serial.split(":")
                ip = parts[0]
                port = int(parts[1]) if len(parts) > 1 else 5555

                # Get device properties
                props = ADBManager.get_device_properties(serial, self.adb_path)

                device_info = {
                    "serial": serial,
                    "ip": ip,
                    "port": port,
                    "state": state,
                    "connection": "wifi",
                    "model": props.model if props else "Unknown",
                    "manufacturer": props.manufacturer if props else "Unknown",
                    "android_version": props.android_version if props else "Unknown",
                    "sdk_version": props.sdk_version if props else 0,
                }

                # Try to get battery
                battery = ADBManager.get_battery_status(serial, self.adb_path)
                if battery:
                    device_info["battery"] = {
                        "level": battery.level,
                        "charging": battery.charging
                    }

                devices.append(device_info)

                # Print device info
                print(f"\n  [OK] {serial}")
                print(f"       Model: {device_info['model']}")
                print(f"       Manufacturer: {device_info['manufacturer']}")
                print(f"       Android: {device_info['android_version']} (SDK {device_info['sdk_version']})")
                if "battery" in device_info:
                    bat = device_info["battery"]
                    charge_status = "Charging" if bat["charging"] else "Discharging"
                    print(f"       Battery: {bat['level']}% ({charge_status})")

        except Exception as e:
            ColorPrint.red(f"  [ERROR] Failed to scan WiFi devices: {e}")

        print(f"\n  Total WiFi devices found: {len(devices)}")
        return devices

    def discover_lan_services(self) -> List[Dict[str, Any]]:
        """
        Discover RPC v2 services on LAN

        Returns:
            List of RPC service info dicts
        """
        print("\n" + "=" * 70)
        print("Scanning LAN for RPC v2 Services...")
        print("=" * 70)

        services = []

        try:
            # Get network segments
            segments = self.network_scanner.get_local_network_segments()
            print(f"  Network segments: {segments}")

            # Scan network
            hosts = self.network_scanner.scan_network_segment()

            for host in hosts:
                if host.is_active:
                    service_info = {
                        "ip": host.ip,
                        "port": host.port,
                        "response_time": round(host.response_time * 1000, 2),  # ms
                        "service_type": "rpc_v2"
                    }

                    services.append(service_info)

                    print(f"\n  [OK] {host.ip}:{host.port}")
                    print(f"       Response time: {service_info['response_time']} ms")

        except Exception as e:
            ColorPrint.red(f"  [ERROR] Failed to scan LAN: {e}")

        print(f"\n  Total RPC v2 services found: {len(services)}")
        return services

    def enable_wifi_for_usb_device(self, serial: str, port: int = 5555) -> bool:
        """
        Enable WiFi ADB for a USB-connected device

        Args:
            serial: Device serial
            port: WiFi ADB port (default: 5555)

        Returns:
            Success status
        """
        print(f"\nEnabling WiFi ADB for {serial}...")

        try:
            # Enable WiFi ADB
            if not ADBManager.enable_wifi_adb(serial, port, self.adb_path):
                ColorPrint.red(f"  [FAIL] Failed to enable WiFi ADB")
                return False

            print(f"  [OK] WiFi ADB enabled on port {port}")

            # Get device IP
            ip = ADBManager.get_device_ip(serial, self.adb_path)
            if not ip:
                ColorPrint.yellow(f"  [WARN] Could not get device IP")
                return True

            print(f"  [INFO] Device IP: {ip}")
            print(f"  [INFO] You can now connect via: adb connect {ip}:{port}")

            return True

        except Exception as e:
            ColorPrint.red(f"  [ERROR] {e}")
            return False

    def connect_wifi_device(self, ip: str, port: int = 5555) -> bool:
        """
        Connect to a WiFi ADB device

        Args:
            ip: Device IP address
            port: WiFi ADB port (default: 5555)

        Returns:
            Success status
        """
        print(f"\nConnecting to WiFi device {ip}:{port}...")

        try:
            if ADBManager.connect_wifi(ip, port, self.adb_path):
                print(f"  [OK] Connected to {ip}:{port}")
                return True
            else:
                ColorPrint.red(f"  [FAIL] Failed to connect")
                return False

        except Exception as e:
            ColorPrint.red(f"  [ERROR] {e}")
            return False

    def generate_summary(
        self,
        usb_devices: List[Dict[str, Any]],
        wifi_devices: List[Dict[str, Any]],
        lan_services: List[Dict[str, Any]]
    ):
        """Print discovery summary"""
        print("\n" + "=" * 70)
        print("Discovery Summary")
        print("=" * 70)

        print(f"\n  USB ADB Devices: {len(usb_devices)}")
        for device in usb_devices:
            wifi_str = f" (WiFi IP: {device['wifi_ip']})" if "wifi_ip" in device else ""
            print(f"    - {device['serial']}: {device['model']}{wifi_str}")

        print(f"\n  WiFi ADB Devices: {len(wifi_devices)}")
        for device in wifi_devices:
            print(f"    - {device['serial']}: {device['model']}")

        print(f"\n  LAN RPC v2 Services: {len(lan_services)}")
        for service in lan_services:
            print(f"    - {service['ip']}:{service['port']} ({service['response_time']} ms)")

        print("\n" + "=" * 70)


def main():
    """Main discovery routine"""
    print("=" * 70)
    print("Matrix Device Discovery")
    print("=" * 70)

    discovery = DeviceDiscovery()

    # Discover all device types
    usb_devices = discovery.discover_usb_devices()
    wifi_devices = discovery.discover_wifi_devices()
    lan_services = discovery.discover_lan_services()

    # Print summary
    discovery.generate_summary(usb_devices, wifi_devices, lan_services)

    # Interactive WiFi setup (optional)
    if usb_devices:
        print("\n" + "-" * 70)
        response = input("Enable WiFi ADB for any USB device? (y/n): ").strip().lower()
        if response == 'y':
            print("\nAvailable USB devices:")
            for idx, device in enumerate(usb_devices):
                wifi_str = f" (WiFi IP: {device['wifi_ip']})" if "wifi_ip" in device else ""
                print(f"  [{idx}] {device['serial']}: {device['model']}{wifi_str}")

            try:
                choice = int(input("\nSelect device number: ").strip())
                if 0 <= choice < len(usb_devices):
                    device = usb_devices[choice]
                    discovery.enable_wifi_for_usb_device(device['serial'])
            except ValueError:
                print("Invalid input")


if __name__ == "__main__":
    main()
