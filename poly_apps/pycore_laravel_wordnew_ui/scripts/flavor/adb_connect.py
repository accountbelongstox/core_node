#!/usr/bin/env python3
from __future__ import annotations

import ipaddress
import json
import os
import re
import shutil
import socket
import subprocess
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from pathlib import Path


ADB_DEFAULT_PORT = 5555
ADB_KNOWN_STATES = ("device", "unauthorized", "offline")
ADB_CONNECT_TIMEOUT_SECONDS = 10
ADB_PAIR_TIMEOUT_SECONDS = 30
AUTHORIZE_TRIES = 30
AUTHORIZE_POLL_SECONDS = 2
TCPIP_CONNECT_TRIES = 10
PAIR_SERVICE_WAIT_SECONDS = 12
PAIRING_DIALOG_WAIT_SECONDS = 20
PAIRING_DIALOG_POLL_SECONDS = 3
SCAN_TIMEOUT_SECONDS = 1.2
SCAN_WORKERS = 128
SCAN_HOST_RANGE = range(1, 255)
TARGETS_STATE = "devices.json"
TARGETS_KEEP = 8
MDNS_CONNECT_PATTERN = re.compile(r"_adb(-tls-connect)?\._tcp")
MDNS_PAIRING_PATTERN = re.compile(r"_adb-tls-pairing\._tcp")
MDNS_SERIAL_PATTERN = re.compile(r"^adb-([^-]+)-")
DISCOVERY_STEPS = 4
# Typed pairing details: "[IP:]PORT CODE" as shown in the phone's pairing dialog.
PAIRING_INPUT_PATTERN = re.compile(r"^\s*(?:(\d+\.\d+\.\d+\.\d+):)?(\d{2,5})\s+(\d{6})\s*$")
WIFI_ADDRESS_PATTERN = re.compile(r"inet (\d+\.\d+\.\d+\.\d+)/")
WIFI_ROUTE_PATTERN = re.compile(r"src (\d+\.\d+\.\d+\.\d+)")
IP_LINE_PATTERN = re.compile(r"inet (\d+\.\d+\.\d+\.\d+)/")
ROUTE_PROBE_ADDRESS = ("192.0.2.1", 9)
CARRIER_NAT_NETWORK = ipaddress.ip_network("100.64.0.0/10")
NETWORK_SERIAL_MARKERS = (":", "._adb")
EMULATOR_PREFIX = "emulator-"


def log(message: str) -> None:
    print(f"[debug] {message}", flush=True)


def load_json(path: Path) -> dict:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}


def write_json(path: Path, data: dict) -> None:
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(data, indent=2), encoding="utf-8")
    os.replace(temporary, path)


def run_adb(adb_bin: str, *arguments: str, timeout: float | None = None) -> str:
    try:
        result = subprocess.run([adb_bin, *arguments], capture_output=True, text=True, errors="replace", check=False,
                                timeout=timeout)
    except subprocess.TimeoutExpired:
        return "timeout"
    return (result.stdout + result.stderr).replace("\r", "")


def adb(adb_bin: str, serial: str, *arguments: str, timeout: float | None = None) -> str:
    return run_adb(adb_bin, "-s", serial, *arguments, timeout=timeout)


def log_lines(text: str) -> None:
    for line in text.splitlines():
        if line.strip():
            log(f"  {line.strip()}")


def list_devices(adb_bin: str) -> list[tuple[str, str]]:
    devices: list[tuple[str, str]] = []
    for line in run_adb(adb_bin, "devices").splitlines():
        fields = line.split()
        if len(fields) >= 2 and fields[1] in ADB_KNOWN_STATES:
            devices.append((fields[0], fields[1]))
    return devices


def device_state(adb_bin: str, serial: str) -> str:
    return next((state for name, state in list_devices(adb_bin) if name == serial), "")


def is_network_serial(serial: str) -> bool:
    return any(marker in serial for marker in NETWORK_SERIAL_MARKERS)


def is_usb_serial(serial: str) -> bool:
    return not is_network_serial(serial) and not serial.startswith(EMULATOR_PREFIX)


def online_serials(adb_bin: str) -> list[str]:
    return [serial for serial, state in list_devices(adb_bin) if state == "device"]


def hardware_serial(adb_bin: str, serial: str) -> str:
    return adb(adb_bin, serial, "shell", "getprop", "ro.serialno").strip() or serial


def device_model(adb_bin: str, serial: str) -> str:
    return adb(adb_bin, serial, "shell", "getprop", "ro.product.model").strip()


def unique_serials(adb_bin: str) -> list[str]:
    serials: list[str] = []
    hardware_seen: set[str] = set()
    for serial in sorted(online_serials(adb_bin), key=lambda name: not is_network_serial(name)):
        hardware = hardware_serial(adb_bin, serial)
        if hardware in hardware_seen:
            continue
        hardware_seen.add(hardware)
        serials.append(serial)
    return serials


def normalize_endpoint(target: str) -> str:
    endpoint = target.strip()
    return endpoint if ":" in endpoint else f"{endpoint}:{ADB_DEFAULT_PORT}"


def split_endpoint(endpoint: str) -> tuple[str, int]:
    host, _, port = endpoint.rpartition(":")
    return host, int(port) if port.isdigit() else ADB_DEFAULT_PORT


def known_targets(state_dir: Path) -> list[dict]:
    entries = load_json(state_dir / TARGETS_STATE).get("targets") or []
    return [entry for entry in entries if isinstance(entry, dict) and entry.get("endpoint")]


def remember_target(adb_bin: str, state_dir: Path, serial: str, endpoint: str) -> None:
    hardware = hardware_serial(adb_bin, serial)
    default_port = split_endpoint(endpoint)[1] == ADB_DEFAULT_PORT
    kept = [entry for entry in known_targets(state_dir)
            if entry["endpoint"] != endpoint and not (
                entry.get("hardware") == hardware and (split_endpoint(entry["endpoint"])[1] == ADB_DEFAULT_PORT) == default_port)]
    entry = {"endpoint": endpoint, "hardware": hardware, "model": device_model(adb_bin, serial),
             "last_ok": datetime.now().isoformat(timespec="seconds")}
    write_json(state_dir / TARGETS_STATE, {"targets": ([entry] + kept)[:TARGETS_KEEP]})


def mdns_records(adb_bin: str) -> list[tuple[str, str, str]]:
    records: list[tuple[str, str, str]] = []
    for line in run_adb(adb_bin, "mdns", "services").splitlines():
        fields = line.split()
        if len(fields) >= 3 and fields[1].startswith("_") and ":" in fields[2]:
            records.append((fields[0], fields[1], fields[2]))
    return records


def mdns_endpoints(adb_bin: str) -> tuple[list[str], list[str]]:
    connect: list[str] = []
    pairing: list[str] = []
    for _name, service, endpoint in mdns_records(adb_bin):
        if MDNS_PAIRING_PATTERN.search(service):
            pairing.append(endpoint)
        elif MDNS_CONNECT_PATTERN.search(service) and endpoint not in connect:
            connect.append(endpoint)
    return connect, pairing


def show_mdns(adb_bin: str) -> None:
    log("mDNS services (devices broadcasting wireless debugging on this network)...")
    log_lines(run_adb(adb_bin, "mdns", "services"))


def describe_mdns(adb_bin: str) -> list[tuple[str, str, str]]:
    """Logs every wireless-debugging announcement with its role, or why none may be visible."""
    records = mdns_records(adb_bin)
    for name, service, endpoint in records:
        match = MDNS_SERIAL_PATTERN.match(name)
        device = f"device {match.group(1)}" if match else name
        if MDNS_PAIRING_PATTERN.search(service):
            role = "pairing dialog open (accepts a pairing code)"
        elif MDNS_CONNECT_PATTERN.search(service):
            role = "wireless debugging on (connect port)"
        else:
            role = service
        log(f"  mDNS: {device} at {endpoint} - {role}")
    if not records:
        log("  mDNS: no phone announces wireless debugging. Check: phone and computer on the same WiFi "
            "(no guest/client isolation), Wireless debugging switched on, the firewall allows adb (UDP 5353).")
        log_lines(run_adb(adb_bin, "mdns", "check"))
    return records


def remember_online(adb_bin: str, state_dir: Path) -> None:
    mdns_by_serial = {f"{name}.{service}": endpoint for name, service, endpoint in mdns_records(adb_bin)}
    for serial in online_serials(adb_bin):
        endpoint = serial if ":" in serial else mdns_by_serial.get(serial, "")
        if endpoint and is_network_serial(serial):
            remember_target(adb_bin, state_dir, serial, endpoint)


def connect_endpoint(adb_bin: str, endpoint: str, quiet: bool = False) -> str:
    output = run_adb(adb_bin, "connect", endpoint, timeout=ADB_CONNECT_TIMEOUT_SECONDS)
    if not quiet:
        log(f"Connecting to {endpoint}...")
        log_lines(output)
    return device_state(adb_bin, endpoint)


def connect_authorized(adb_bin: str, target: str) -> bool:
    if not target.strip():
        log(f"Connect target required: IP[:PORT] (default port {ADB_DEFAULT_PORT}).")
        return False
    endpoint = normalize_endpoint(target)
    state = connect_endpoint(adb_bin, endpoint)
    if state == "device":
        log(f"{endpoint} is authorized and online.")
        return True
    if not state:
        if endpoint_open(endpoint):
            log(f"{endpoint} is reachable but refused the adb session: this computer is not paired with the phone. "
                "Android 11+ wireless debugging needs a one-time pairing code (USB authorization does not carry over).")
        else:
            log(f"{endpoint} is not reachable from this computer (other WiFi/subnet, client isolation, "
                "firewall, or the phone toggled Wireless debugging and now uses a new port).")
        return False
    log(f"{endpoint} state: {state}. Confirm 'Allow USB debugging' ON THE PHONE (tick 'always allow')...")
    for _attempt in range(AUTHORIZE_TRIES):
        time.sleep(AUTHORIZE_POLL_SECONDS)
        if device_state(adb_bin, endpoint) == "device":
            log(f"{endpoint} authorized -> online.")
            return True
        run_adb(adb_bin, "connect", endpoint, timeout=ADB_CONNECT_TIMEOUT_SECONDS)
    log(f"{endpoint} was not authorized within {AUTHORIZE_TRIES * AUTHORIZE_POLL_SECONDS}s; re-run to retry (idempotent).")
    return False


def pair_device(adb_bin: str, target: str, code: str, interactive: bool) -> bool:
    if ":" not in target:
        log("Pair target must be IP:PAIR_PORT from 'Wireless debugging -> Pair device with pairing code'.")
        return False
    if not code and interactive:
        code = input(f"Pairing code for {target}: ").strip()
    if not code:
        log(f"Pairing code required. Run: {adb_bin} pair {target} <PAIRING_CODE>")
        return False
    log(f"Pairing with {target} (Android 11+ wireless debugging)...")
    output = run_adb(adb_bin, "pair", target, code, timeout=ADB_PAIR_TIMEOUT_SECONDS)
    log_lines(output)
    return "Successfully paired" in output


def local_subnets() -> list[str]:
    addresses: list[str] = []
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as probe:
            probe.connect(ROUTE_PROBE_ADDRESS)
            addresses.append(probe.getsockname()[0])
    except OSError:
        pass
    try:
        addresses += [info[4][0] for info in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET)]
    except OSError:
        pass
    if shutil.which("ip"):
        listing = subprocess.run(["ip", "-4", "-o", "addr", "show"], capture_output=True, text=True, check=False).stdout
        addresses += IP_LINE_PATTERN.findall(listing)
    prefixes: list[str] = []
    for text in addresses:
        try:
            address = ipaddress.ip_address(text)
        except ValueError:
            continue
        if address.is_loopback or address.is_link_local or address in CARRIER_NAT_NETWORK:
            continue
        prefix = ".".join(text.split(".")[:3])
        if prefix not in prefixes:
            prefixes.append(prefix)
    return prefixes


def endpoint_open(endpoint: str) -> bool:
    host, port = split_endpoint(endpoint)
    try:
        socket.create_connection((host, port), timeout=SCAN_TIMEOUT_SECONDS).close()
        return True
    except OSError:
        return False


def open_endpoints(endpoints: list[str]) -> list[str]:
    if not endpoints:
        return []
    with ThreadPoolExecutor(max_workers=SCAN_WORKERS) as pool:
        flags = list(pool.map(endpoint_open, endpoints))
    return [endpoint for endpoint, is_open in zip(endpoints, flags) if is_open]


def scan_lan(ports: list[int]) -> list[str]:
    hits: list[str] = []
    for prefix in local_subnets():
        log(f"Scanning {prefix}.0/24 for open adb port(s) {', '.join(str(port) for port in ports)}...")
        candidates = [f"{prefix}.{host}:{port}" for host in SCAN_HOST_RANGE for port in ports]
        hits += [endpoint for endpoint in open_endpoints(candidates) if endpoint not in hits]
    return hits


def scan_ports(state_dir: Path) -> list[int]:
    ports = [ADB_DEFAULT_PORT]
    for entry in known_targets(state_dir):
        port = split_endpoint(entry["endpoint"])[1]
        if port not in ports:
            ports.append(port)
    return ports


def scan_and_connect(adb_bin: str, state_dir: Path) -> None:
    show_mdns(adb_bin)
    hits = scan_lan([ADB_DEFAULT_PORT])
    for endpoint in hits:
        log(f"Found adb host: {endpoint}")
        if connect_authorized(adb_bin, endpoint):
            remember_online(adb_bin, state_dir)
    if not hits:
        log(f"No hosts with port {ADB_DEFAULT_PORT} open found. Android 11+: enable Wireless debugging and pair first.")


def wait_for_pairing(adb_bin: str, unpaired: list[str]) -> list[str]:
    """Polls mDNS briefly for the phone's pairing dialog; returns the pairing endpoints."""
    hosts = {split_endpoint(endpoint)[0] for endpoint in unpaired}
    log("On the phone: Developer options -> Wireless debugging -> 'Pair device with pairing code' and keep "
        f"the dialog open. Looking for it over mDNS for {PAIRING_DIALOG_WAIT_SECONDS}s (Ctrl+C skips to typing it)...")
    deadline = time.monotonic() + PAIRING_DIALOG_WAIT_SECONDS
    try:
        while time.monotonic() < deadline:
            pairing = mdns_endpoints(adb_bin)[1]
            preferred = [endpoint for endpoint in pairing if split_endpoint(endpoint)[0] in hosts]
            if preferred or pairing:
                log(f"Pairing dialog detected: {', '.join(preferred or pairing)}")
                return preferred or pairing
            log(f"  waiting for the pairing dialog ... {int(deadline - time.monotonic())}s left")
            time.sleep(PAIRING_DIALOG_POLL_SECONDS)
    except KeyboardInterrupt:
        log("Stopped waiting for the pairing dialog.")
    return []


def read_pairing_input(unpaired: list[str]) -> tuple[str, str]:
    """Asks for the pairing port and code shown in the phone dialog (many phones never announce it
    over mDNS); returns (IP:PORT, CODE) or empty strings when skipped."""
    host = split_endpoint(unpaired[0])[0] if unpaired else ""
    log("The phone's pairing dialog shows 'IP address & Port' and a 6-digit 'WLAN pairing code'.")
    example = "37421 123456" if host else "192.168.1.20:37421 123456"
    while True:
        try:
            reply = input(f"Type the pairing [IP:]PORT and CODE, e.g. {example} (empty skips): ").strip()
        except (EOFError, KeyboardInterrupt):
            return "", ""
        if not reply:
            return "", ""
        match = PAIRING_INPUT_PATTERN.match(reply)
        if match and (match.group(1) or host):
            return f"{match.group(1) or host}:{match.group(2)}", match.group(3)
        log(f"Not understood: '{reply}'. Use PORT CODE (host {host or 'unknown'}) or IP:PORT CODE.")


def pair_and_connect(adb_bin: str, endpoint: str, code: str, unpaired: list[str]) -> bool:
    """Pairs with endpoint, then connects to the phone's wireless-debugging port on the same host."""
    if not pair_device(adb_bin, endpoint, code, True):
        log("Pairing failed: the code expires when the dialog closes; reopen it and use the new port and code.")
        return False
    host = split_endpoint(endpoint)[0]
    deadline = time.monotonic() + PAIR_SERVICE_WAIT_SECONDS
    while time.monotonic() < deadline:
        candidates = [candidate for candidate in mdns_endpoints(adb_bin)[0] + unpaired
                      if split_endpoint(candidate)[0] == host]
        for candidate in dict.fromkeys(candidates):
            if connect_authorized(adb_bin, candidate):
                return True
        time.sleep(AUTHORIZE_POLL_SECONDS)
    log(f"Paired with {host}, but its wireless-debugging port did not answer; re-run the script to connect.")
    return False


def pair_nearby(adb_bin: str, pairing: list[str], interactive: bool, unpaired: list[str] | None = None) -> bool:
    unpaired = unpaired or []
    if not pairing and unpaired and interactive:
        pairing = wait_for_pairing(adb_bin, unpaired)
        if not pairing:
            endpoint, code = read_pairing_input(unpaired)
            if endpoint:
                return pair_and_connect(adb_bin, endpoint, code, unpaired)
    if not pairing:
        if unpaired:
            log(f"Found {', '.join(unpaired)} but this computer is not paired. Pair once: on the phone open "
                "Wireless debugging -> 'Pair device with pairing code', then run "
                f"{adb_bin} pair <IP>:<PAIR_PORT> <CODE> (or the Pair action), then re-run this script.")
        else:
            log("No device found over WiFi. On the phone enable Settings -> Developer options -> Wireless debugging "
                "(same WiFi as this computer); first-time Android 11+ devices also need 'Pair device with pairing code'. "
                "With a USB cable the script switches the phone to WiFi by itself.")
        return False
    for endpoint in pairing:
        if not interactive:
            log(f"A device is offering wireless pairing. Run: {adb_bin} pair {endpoint} <PAIRING_CODE>")
            continue
        if pair_and_connect(adb_bin, endpoint, "", unpaired):
            return True
    return False


def discover(adb_bin: str, state_dir: Path, interactive: bool) -> bool:
    attempted: set[str] = set()

    def attempt(endpoint: str) -> bool:
        if endpoint in attempted:
            return False
        attempted.add(endpoint)
        if not connect_authorized(adb_bin, endpoint):
            return False
        remember_online(adb_bin, state_dir)
        return True

    remembered = [entry["endpoint"] for entry in known_targets(state_dir)]
    reachable = open_endpoints(remembered)
    log(f"Step 1/{DISCOVERY_STEPS}: remembered endpoints: {len(remembered)} known, {len(reachable)} reachable"
        + (f" ({', '.join(remembered)})" if remembered else ""))
    for endpoint in reachable:
        if attempt(endpoint):
            return True
    log(f"Step 2/{DISCOVERY_STEPS}: mDNS (phones with Wireless debugging on announce themselves) ...")
    describe_mdns(adb_bin)
    connect_points, pairing_points = mdns_endpoints(adb_bin)
    unpaired: list[str] = []
    for endpoint in connect_points:
        if attempt(endpoint):
            return True
        if endpoint_open(endpoint):
            unpaired.append(endpoint)
    ports = scan_ports(state_dir)
    log(f"Step 3/{DISCOVERY_STEPS}: LAN scan of port(s) {', '.join(str(port) for port in ports)} on "
        f"{', '.join(prefix + '.0/24' for prefix in local_subnets()) or 'no local subnet'} "
        "(finds 'adb tcpip' phones; Android 11+ wireless debugging uses a random port that only mDNS reveals)")
    for endpoint in scan_lan(ports):
        log(f"Found adb host: {endpoint}")
        if attempt(endpoint):
            return True
    log(f"Step 4/{DISCOVERY_STEPS}: pairing")
    if not pair_nearby(adb_bin, pairing_points, interactive, unpaired):
        return False
    remember_online(adb_bin, state_dir)
    return True


def device_wifi_ip(adb_bin: str, serial: str) -> str:
    match = WIFI_ADDRESS_PATTERN.search(adb(adb_bin, serial, "shell", "ip", "-f", "inet", "addr", "show", "wlan0"))
    if match:
        return match.group(1)
    for line in adb(adb_bin, serial, "shell", "ip", "route").splitlines():
        match = WIFI_ROUTE_PATTERN.search(line) if "wlan" in line else None
        if match:
            return match.group(1)
    return adb(adb_bin, serial, "shell", "getprop", "dhcp.wlan0.ipaddress").strip()


def switch_to_wifi(adb_bin: str, state_dir: Path, serial: str, port: int) -> bool:
    hardware = hardware_serial(adb_bin, serial)
    for other in online_serials(adb_bin):
        if is_network_serial(other) and hardware_serial(adb_bin, other) == hardware:
            log(f"{serial} is already reachable over WiFi as {other}.")
            remember_online(adb_bin, state_dir)
            return True
    address = device_wifi_ip(adb_bin, serial)
    if not address:
        log(f"{serial} has no WiFi address (WiFi off or not connected); staying on USB.")
        return False
    endpoint = f"{address}:{port}"
    log(f"WiFi debugging is off for {serial}: enabling adb tcpip {port} and switching to {endpoint}...")
    log_lines(adb(adb_bin, serial, "tcpip", str(port), timeout=ADB_CONNECT_TIMEOUT_SECONDS))
    for _attempt in range(TCPIP_CONNECT_TRIES):
        time.sleep(1)
        if connect_endpoint(adb_bin, endpoint, quiet=True) == "device":
            remember_target(adb_bin, state_dir, endpoint, endpoint)
            log(f"Connected over WiFi: {endpoint}. The USB cable can be unplugged now.")
            return True
    log(f"Could not connect to {endpoint} (is this computer on the same WiFi?); staying on USB.")
    return False


def switch_usb_devices_to_wifi(adb_bin: str, state_dir: Path, port: int) -> bool:
    usb = [serial for serial in online_serials(adb_bin) if is_usb_serial(serial)]
    if not usb:
        log("No USB-connected device found for adb tcpip.")
        return False
    return all([switch_to_wifi(adb_bin, state_dir, serial, port) for serial in usb])


def resolve_device(adb_bin: str, state_dir: Path, interactive: bool) -> bool:
    run_adb(adb_bin, "start-server")
    devices = list_devices(adb_bin)
    for serial, state in devices:
        if state != "device" and is_usb_serial(serial):
            log(f"USB device {serial} is {state}: confirm 'Allow USB debugging' on the phone.")
    online = online_serials(adb_bin)
    usb = [serial for serial in online if is_usb_serial(serial)]
    if usb:
        for serial in usb:
            switch_to_wifi(adb_bin, state_dir, serial, ADB_DEFAULT_PORT)
        return True
    if online:
        log(f"Using already-connected device(s): {', '.join(online)}")
        remember_online(adb_bin, state_dir)
        return True
    log("No adb device attached: searching over WiFi (no USB cable needed)...")
    return discover(adb_bin, state_dir, interactive)
