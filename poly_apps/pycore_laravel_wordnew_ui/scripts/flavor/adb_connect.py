#!/usr/bin/env python3
from __future__ import annotations

import asyncio
import ipaddress
import json
import os
import re
import shutil
import socket
import subprocess
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from pathlib import Path


ADB_DEFAULT_PORT = 5555
# Console tools started from a console-less (detached) process get a new console window each run on
# Windows; adb is polled every few seconds by the live-debug collector, so it must never open one.
NO_WINDOW = {"creationflags": subprocess.CREATE_NO_WINDOW} if os.name == "nt" else {}
PROMPT_POLL_SECONDS = 0.1
ADB_KNOWN_STATES = ("device", "unauthorized", "offline")
ADB_CONNECT_TIMEOUT_SECONDS = 10
ADB_PAIR_TIMEOUT_SECONDS = 30
AUTHORIZE_TRIES = 30
AUTHORIZE_POLL_SECONDS = 2
TCPIP_CONNECT_TRIES = 10
PAIR_SERVICE_WAIT_SECONDS = 12
PAIRING_PORT_LOOKUP_SECONDS = 10
PAIRING_DIALOG_POLL_SECONDS = 2
SCAN_TIMEOUT_SECONDS = 1.2
SCAN_WORKERS = 128
SCAN_HOST_RANGE = range(1, 255)
TARGETS_STATE = "devices.json"
TARGETS_KEEP = 12
CHOICE_WAIT_SECONDS = 5
TAILNET_TIMEOUT_SECONDS = 5
TAILNET_ANDROID_OS = "android"
TAILSCALE_WINDOWS_BIN = Path(os.environ.get("ProgramFiles", r"C:\Program Files")) / "Tailscale" / "tailscale.exe"
VIA_LAN = "lan"
VIA_TAILNET = "tailnet"
DEFAULT_NETWORK = "default"
WINDOWS_SSID_PATTERN = re.compile(r"^\s*SSID\s*:\s*(.+?)\s*$", re.MULTILINE)
MDNS_CONNECT_PATTERN = re.compile(r"_adb(-tls-connect)?\._tcp")
MDNS_PAIRING_PATTERN = re.compile(r"_adb-tls-pairing\._tcp")
MDNS_SERIAL_PATTERN = re.compile(r"^adb-([^-]+)-")
DISCOVERY_STEPS = 5
# Typed pairing details as shown in the phone's pairing dialog: "[IP:]PORT CODE" or "CODE" alone
# (the pairing port is then looked up over mDNS).
PAIRING_INPUT_PATTERN = re.compile(r"^\s*(?:(?:(\d+\.\d+\.\d+\.\d+):)?(\d{2,5})\s+)?(\d{6})\s*$")
WIFI_ADDRESS_PATTERN = re.compile(r"inet (\d+\.\d+\.\d+\.\d+)/")
WIFI_ROUTE_PATTERN = re.compile(r"src (\d+\.\d+\.\d+\.\d+)")
IP_LINE_PATTERN = re.compile(r"inet (\d+\.\d+\.\d+\.\d+)/")
ROUTE_PROBE_ADDRESS = ("192.0.2.1", 9)
CARRIER_NAT_NETWORK = ipaddress.ip_network("100.64.0.0/10")
# Android 11+ wireless debugging listens on random ephemeral ports (one for pairing, one for
# connecting); when mDNS is silent they are found by scanning the LAN neighbours' port range.
WIRELESS_PORT_RANGE = range(32768, 61000)
WIRELESS_SCAN_CONCURRENCY = 1500
WIRELESS_SCAN_TIMEOUT_SECONDS = 0.6
NEIGHBOR_WAKE_PORT = 9
NEIGHBOR_WAKE_SETTLE_SECONDS = 1.5
WINDOWS_ARP_PATTERN = re.compile(r"^\s*(\d+\.\d+\.\d+\.\d+)\s+([0-9a-fA-F]{2}(?:-[0-9a-fA-F]{2}){5})\s", re.MULTILINE)
LINUX_NEIGH_PATTERN = re.compile(r"^(\d+\.\d+\.\d+\.\d+)\s.*lladdr\s", re.MULTILINE)
PAIRING_CODE_PATTERN = re.compile(r"^\d{6}$")
NETWORK_SERIAL_MARKERS = (":", "._adb")
EMULATOR_PREFIX = "emulator-"


def log(message: str) -> None:
    print(f"[debug] {message}", flush=True)


def timed_yes_no(prompt: str, seconds: int, default: bool) -> bool:
    """Asks prompt with a visible countdown; the default wins when nothing is typed in time.
    Windows stops the countdown at the first key; other platforms read the line once Enter is pressed."""
    choices = "Y/n" if default else "y/N"
    answer = ""
    deadline = time.monotonic() + seconds
    shown = -1
    try:
        if os.name == "nt":
            import msvcrt
            typed = ""
            while time.monotonic() < deadline or typed:
                if msvcrt.kbhit():
                    key = msvcrt.getwch()
                    if key in ("\r", "\n"):
                        answer = typed
                        break
                    typed = typed[:-1] if key == "\b" else typed + key
                    print(f"\r{prompt} [{choices}] {typed} ", end="", flush=True)
                    continue
                if not typed and int(deadline - time.monotonic()) != shown:
                    shown = int(deadline - time.monotonic())
                    print(f"\r{prompt} [{choices}] ({shown + 1}s) ", end="", flush=True)
                time.sleep(PROMPT_POLL_SECONDS)
        else:
            import select
            while time.monotonic() < deadline:
                if int(deadline - time.monotonic()) != shown:
                    shown = int(deadline - time.monotonic())
                    print(f"\r{prompt} [{choices}] ({shown + 1}s) ", end="", flush=True)
                if select.select([sys.stdin], [], [], PROMPT_POLL_SECONDS)[0]:
                    answer = sys.stdin.readline()
                    break
    except (EOFError, KeyboardInterrupt, OSError):
        answer = ""
    print(flush=True)
    answer = answer.strip().lower()
    return default if not answer else answer.startswith("y")


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
                                timeout=timeout, **NO_WINDOW)
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


def is_tailnet_host(host: str) -> bool:
    try:
        return ipaddress.ip_address(host) in CARRIER_NAT_NETWORK
    except ValueError:
        return False


def current_network() -> str:
    """Namespace of the network this computer is on: the WiFi SSID, else the first local /24."""
    ssid = ""
    try:
        if os.name == "nt":
            listing = subprocess.run(["netsh", "wlan", "show", "interfaces"], capture_output=True, text=True,
                                     errors="replace", check=False, timeout=TAILNET_TIMEOUT_SECONDS, **NO_WINDOW).stdout
            match = WINDOWS_SSID_PATTERN.search(listing)
            ssid = match.group(1) if match else ""
        elif shutil.which("iwgetid"):
            ssid = subprocess.run(["iwgetid", "-r"], capture_output=True, text=True, check=False,
                                  timeout=TAILNET_TIMEOUT_SECONDS).stdout.strip()
        elif shutil.which("nmcli"):
            listing = subprocess.run(["nmcli", "-t", "-f", "active,ssid", "dev", "wifi"], capture_output=True,
                                     text=True, check=False, timeout=TAILNET_TIMEOUT_SECONDS).stdout
            ssid = next((line[4:] for line in listing.splitlines() if line.startswith("yes:")), "")
    except (OSError, subprocess.TimeoutExpired):
        ssid = ""
    if ssid:
        return f"wifi:{ssid}"
    subnets = local_subnets()
    return f"lan:{subnets[0]}.0/24" if subnets else DEFAULT_NETWORK


def network_of(host: str) -> str:
    return VIA_TAILNET if is_tailnet_host(host) else current_network()


def saved_pairings(state_dir: Path, network: str) -> dict:
    pairings = (load_json(state_dir / TARGETS_STATE).get("pairings") or {}).get(network) or {}
    return pairings if isinstance(pairings, dict) else {}


def save_pairing(state_dir: Path, endpoint: str, code: str) -> None:
    """Stores the pairing code under the network namespace (one entry per phone host)."""
    host = split_endpoint(endpoint)[0]
    network = network_of(host)
    state = load_json(state_dir / TARGETS_STATE)
    state.setdefault("pairings", {}).setdefault(network, {})[host] = {
        "pair_endpoint": endpoint, "code": code, "updated": datetime.now().isoformat(timespec="seconds")}
    write_json(state_dir / TARGETS_STATE, state)
    log(f"Pairing code saved for {host} in network '{network}'.")


def device_tailnet_ip(adb_bin: str, serial: str) -> str:
    listing = adb(adb_bin, serial, "shell", "ip", "-f", "inet", "addr", "show")
    return next((text for text in IP_LINE_PATTERN.findall(listing) if is_tailnet_host(text)), "")


def remember_target(adb_bin: str, state_dir: Path, serial: str, endpoint: str) -> None:
    """Remembers the endpoint and, when the phone runs Tailscale/Headscale, the same port on its tailnet IP."""
    hardware = hardware_serial(adb_bin, serial)
    host, port = split_endpoint(endpoint)
    base = {"hardware": hardware, "model": device_model(adb_bin, serial),
            "last_ok": datetime.now().isoformat(timespec="seconds")}
    via = VIA_TAILNET if is_tailnet_host(host) else VIA_LAN
    fresh = [{"endpoint": endpoint, "via": via, "network": network_of(host), **base}]
    tailnet_ip = device_tailnet_ip(adb_bin, serial) if via == VIA_LAN else ""
    if tailnet_ip:
        fresh.append({"endpoint": f"{tailnet_ip}:{port}", "via": VIA_TAILNET, "network": VIA_TAILNET, **base})

    def replaced(entry: dict) -> bool:
        return any(entry["endpoint"] == item["endpoint"] or (
            entry.get("hardware") == hardware and entry.get("via", VIA_LAN) == item["via"]
            and (split_endpoint(entry["endpoint"])[1] == ADB_DEFAULT_PORT) == (port == ADB_DEFAULT_PORT)) for item in fresh)

    state = load_json(state_dir / TARGETS_STATE)
    state["targets"] = (fresh + [entry for entry in known_targets(state_dir) if not replaced(entry)])[:TARGETS_KEEP]
    write_json(state_dir / TARGETS_STATE, state)


def tailscale_bin() -> str:
    found = shutil.which("tailscale")
    if found:
        return found
    return str(TAILSCALE_WINDOWS_BIN) if os.name == "nt" and TAILSCALE_WINDOWS_BIN.is_file() else ""


def tailnet_peers() -> list[tuple[str, str, str]]:
    """Online tailnet peers as (IPv4, host name, OS); the same CLI serves Tailscale and Headscale tailnets."""
    binary = tailscale_bin()
    if not binary:
        return []
    try:
        output = subprocess.run([binary, "status", "--json"], capture_output=True, text=True, errors="replace",
                                check=False, timeout=TAILNET_TIMEOUT_SECONDS, **NO_WINDOW).stdout
        status = json.loads(output or "{}")
    except (OSError, subprocess.TimeoutExpired, json.JSONDecodeError):
        return []
    peers: list[tuple[str, str, str]] = []
    for peer in (status.get("Peer") or {}).values():
        if not isinstance(peer, dict) or not peer.get("Online"):
            continue
        address = next((ip for ip in peer.get("TailscaleIPs") or [] if "." in ip), "")
        if address:
            peers.append((address, peer.get("HostName") or "", (peer.get("OS") or "").lower()))
    return peers


def tailnet_endpoints(state_dir: Path) -> list[str]:
    """Reachable adb endpoints on the tailnet: remembered tailnet targets plus Android peers on known ports."""
    if not tailscale_bin():
        log("  tailnet: tailscale CLI not found (Tailscale, or a Headscale server via "
            "'tailscale up --login-server <URL>'); skipped.")
        return []
    peers = tailnet_peers()
    log(f"  tailnet: {len(peers)} online peer(s)"
        + (f" ({', '.join(f'{name or ip} [{os_name}]' for ip, name, os_name in peers)})" if peers else ""))
    ports = scan_ports(state_dir)
    candidates = [entry["endpoint"] for entry in known_targets(state_dir) if entry.get("via") == VIA_TAILNET]
    candidates += [f"{ip}:{port}" for ip, _name, os_name in peers if os_name in (TAILNET_ANDROID_OS, "") for port in ports]
    return open_endpoints(list(dict.fromkeys(candidates)))


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


def pair_device(adb_bin: str, target: str, code: str, interactive: bool, state_dir: Path | None = None) -> bool:
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
    paired = "Successfully paired" in output
    if paired and state_dir is not None:
        save_pairing(state_dir, target, code)
    return paired


def neighbor_hosts(host: str = "") -> list[str]:
    """LAN neighbours (ARP / ip neigh) of the local /24 subnets; a UDP datagram to every host fills the table first."""
    if host:
        return [host]
    prefixes = local_subnets()
    with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as waker:
        for prefix in prefixes:
            for number in SCAN_HOST_RANGE:
                try:
                    waker.sendto(b"", (f"{prefix}.{number}", NEIGHBOR_WAKE_PORT))
                except OSError:
                    continue
    time.sleep(NEIGHBOR_WAKE_SETTLE_SECONDS)
    if os.name == "nt":
        listing = subprocess.run(["arp", "-a"], capture_output=True, text=True, check=False, **NO_WINDOW).stdout
        found = [address for address, mac in WINDOWS_ARP_PATTERN.findall(listing) if mac.lower() != "ff-ff-ff-ff-ff-ff"]
    else:
        listing = subprocess.run(["ip", "-4", "neigh", "show"], capture_output=True, text=True, check=False).stdout
        found = LINUX_NEIGH_PATTERN.findall(listing)
    return [address for address in dict.fromkeys(found)
            if ".".join(address.split(".")[:3]) in prefixes and not address.endswith((".0", ".255"))]


async def _open_ports(hosts: list[str]) -> dict[str, list[int]]:
    limit = asyncio.Semaphore(WIRELESS_SCAN_CONCURRENCY)
    found: dict[str, list[int]] = {}

    async def probe(host: str, port: int) -> None:
        async with limit:
            try:
                _reader, writer = await asyncio.wait_for(asyncio.open_connection(host, port),
                                                         WIRELESS_SCAN_TIMEOUT_SECONDS)
            except (OSError, asyncio.TimeoutError):
                return
            writer.close()
            found.setdefault(host, []).append(port)

    await asyncio.gather(*(probe(host, port) for host in hosts for port in WIRELESS_PORT_RANGE))
    return {host: sorted(ports) for host, ports in found.items()}


def scan_wireless_ports(hosts: list[str]) -> dict[str, list[int]]:
    """Open ports in the wireless-debugging range per host (pairing and connect ports are both among them)."""
    if not hosts:
        return {}
    log(f"Scanning wireless-debugging ports {WIRELESS_PORT_RANGE.start}-{WIRELESS_PORT_RANGE.stop - 1} "
        f"on {len(hosts)} host(s): {', '.join(hosts)} ...")
    return asyncio.run(_open_ports(hosts))


def pair_by_code(adb_bin: str, state_dir: Path, code: str, host: str = "") -> bool:
    """Idempotent pairing from the 6-digit code alone: hosts already online are kept, the pairing port comes
    from mDNS or a port scan of the LAN neighbours, then the device's other open port is connected."""
    code = code.strip()
    if not PAIRING_CODE_PATTERN.match(code):
        log(f"Pairing code must be the 6 digits shown in 'Pair device with pairing code' (got '{code}').")
        return False
    run_adb(adb_bin, "start-server")
    online_hosts = {split_endpoint(serial)[0] for serial in online_serials(adb_bin) if is_network_serial(serial)
                    and ":" in serial}
    if host and host in online_hosts:
        log(f"{host} is already paired and online; nothing to do.")
        remember_online(adb_bin, state_dir)
        return True
    pairing = [endpoint for endpoint in mdns_endpoints(adb_bin)[1]
               if (not host or split_endpoint(endpoint)[0] == host) and split_endpoint(endpoint)[0] not in online_hosts]
    candidates: dict[str, list[int]] = {}
    for endpoint in pairing:
        candidate_host, port = split_endpoint(endpoint)
        candidates.setdefault(candidate_host, []).append(port)
    if not candidates:
        hosts = [candidate for candidate in neighbor_hosts(host) if candidate not in online_hosts]
        candidates = scan_wireless_ports(hosts)
    for candidate_host, ports in candidates.items():
        paired_port = next((port for port in ports
                            if pair_device(adb_bin, f"{candidate_host}:{port}", code, False, state_dir)), 0)
        if not paired_port:
            continue
        connect_ports = [port for port in ports if port != paired_port] or scan_wireless_ports([candidate_host]).get(
            candidate_host, [])
        connect_ports += [port for port in [split_endpoint(endpoint)[1] for endpoint in mdns_endpoints(adb_bin)[0]
                                            if split_endpoint(endpoint)[0] == candidate_host] if port not in connect_ports]
        for port in connect_ports:
            if port != paired_port and connect_authorized(adb_bin, f"{candidate_host}:{port}"):
                remember_online(adb_bin, state_dir)
                return True
        log(f"Paired with {candidate_host}:{paired_port}, but no connect port answered; re-run to connect.")
        return False
    if online_hosts:
        log(f"No new pairing dialog found; already online: {', '.join(sorted(online_hosts))}.")
        remember_online(adb_bin, state_dir)
        return True
    log("No phone with an open pairing dialog found (same WiFi? dialog still open? code expired?).")
    return False


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
    hits = scan_lan([ADB_DEFAULT_PORT]) + tailnet_endpoints(state_dir)
    for endpoint in hits:
        log(f"Found adb host: {endpoint}")
        if connect_authorized(adb_bin, endpoint):
            remember_online(adb_bin, state_dir)
    if not hits:
        log(f"No hosts with port {ADB_DEFAULT_PORT} open found. Android 11+: enable Wireless debugging and pair first.")


def pairing_port_for(adb_bin: str, host: str) -> str:
    """Looks up the pairing endpoint the phone announces over mDNS while its dialog is open."""
    deadline = time.monotonic() + PAIRING_PORT_LOOKUP_SECONDS
    while True:
        pairing = mdns_endpoints(adb_bin)[1]
        match = next((endpoint for endpoint in pairing if split_endpoint(endpoint)[0] == host), "")
        if match or not host and pairing:
            return match or pairing[0]
        if time.monotonic() >= deadline:
            return ""
        time.sleep(PAIRING_DIALOG_POLL_SECONDS)


def print_pairing_help(adb_bin: str, unpaired: list[str], pairing: list[str]) -> None:
    """Explains the one-time pairing and prints the exact manual commands."""
    host = split_endpoint(unpaired[0])[0] if unpaired else "<PHONE_IP>"
    pair_target = pairing[0] if pairing else f"{host}:<PAIR_PORT>"
    connect_target = unpaired[0] if unpaired else f"{host}:<CONNECT_PORT>"
    log("===== One-time pairing needed (this computer is not in the phone's paired list) =====")
    if unpaired:
        log(f"Phone found at {', '.join(unpaired)}; it refuses adb until this computer is paired once.")
    log("On the phone: Developer options -> Wireless debugging -> 'Pair device with pairing code'.")
    log("The dialog shows 'IP address & Port' (the PAIR_PORT, different from the connect port) and a 6-digit code.")
    command = f'& "{adb_bin}"' if os.name == "nt" else f'"{adb_bin}"'
    log("Manual commands (the code expires when the dialog closes):")
    log(f"  {command} pair {pair_target} <CODE>")
    log(f"  {command} connect {connect_target}")
    log("After pairing once, every later run connects by itself (the phone keeps this computer paired).")


def read_pairing_input(adb_bin: str, unpaired: list[str], state_dir: Path | None = None) -> tuple[str, str]:
    """Asks for the pairing details from the phone dialog; returns (IP:PORT, CODE) or empty when skipped.
    's' reuses the code saved for this network (accepted only while that phone dialog is still open)."""
    host = split_endpoint(unpaired[0])[0] if unpaired else ""
    network = network_of(host) if host else current_network()
    saved = saved_pairings(state_dir, network) if state_dir is not None else {}
    for saved_host, entry in saved.items():
        log(f"Saved pairing in '{network}': {saved_host} code {entry.get('code', '')} ({entry.get('updated', '')})")
    while True:
        try:
            reply = input("Type the 6-digit CODE (or PORT CODE, or IP:PORT CODE) from the phone dialog"
                          + ("; 's' reuses the saved code" if saved else "") + "; empty skips: ").strip()
        except (EOFError, KeyboardInterrupt):
            return "", ""
        if not reply:
            return "", ""
        if reply.lower() == "s" and saved:
            saved_host = host if host in saved else next(iter(saved))
            host = saved_host
            reply = str(saved[saved_host].get("code", ""))
        match = PAIRING_INPUT_PATTERN.match(reply)
        if not match:
            log(f"Not understood: '{reply}'. Examples: 123456 | 37421 123456 | 192.168.1.20:37421 123456")
            continue
        address, port, code = match.groups()
        address = address or host
        if port and address:
            return f"{address}:{port}", code
        log("Looking up the pairing port over mDNS (keep the dialog open)...")
        endpoint = pairing_port_for(adb_bin, address)
        if endpoint:
            log(f"Pairing port found: {endpoint}")
            return endpoint, code
        log("The phone does not announce its pairing port over mDNS; type PORT CODE (the port shown in the dialog).")


def pair_and_connect(adb_bin: str, endpoint: str, code: str, unpaired: list[str],
                     state_dir: Path | None = None) -> bool:
    """Pairs with endpoint, then connects to the phone's wireless-debugging port on the same host."""
    if not pair_device(adb_bin, endpoint, code, True, state_dir):
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


def pair_nearby(adb_bin: str, pairing: list[str], interactive: bool, unpaired: list[str] | None = None,
                state_dir: Path | None = None) -> bool:
    unpaired = unpaired or []
    if not pairing and not unpaired:
        log("No device found over WiFi. On the phone enable Settings -> Developer options -> Wireless debugging "
            "(same WiFi as this computer); first-time Android 11+ devices also need 'Pair device with pairing code'. "
            "With a USB cable the script switches the phone to WiFi by itself.")
        return False
    print_pairing_help(adb_bin, unpaired, pairing)
    if not interactive:
        log("Non-interactive run: pair with the commands above, then re-run this script.")
        return False
    endpoint, code = read_pairing_input(adb_bin, unpaired, state_dir)
    if not endpoint:
        log("Pairing skipped; run the commands above, then re-run this script.")
        return False
    return pair_and_connect(adb_bin, endpoint, code, unpaired, state_dir)


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
    log(f"Step 3/{DISCOVERY_STEPS}: tailnet (Tailscale/Headscale; remote phones, no mDNS across the tailnet) ...")
    for endpoint in tailnet_endpoints(state_dir):
        if attempt(endpoint):
            return True
    ports = scan_ports(state_dir)
    log(f"Step 4/{DISCOVERY_STEPS}: LAN scan of port(s) {', '.join(str(port) for port in ports)} on "
        f"{', '.join(prefix + '.0/24' for prefix in local_subnets()) or 'no local subnet'} "
        "(finds 'adb tcpip' phones; Android 11+ wireless debugging uses a random port that only mDNS reveals)")
    for endpoint in scan_lan(ports):
        log(f"Found adb host: {endpoint}")
        if attempt(endpoint):
            return True
    log(f"Step 5/{DISCOVERY_STEPS}: pairing")
    if not pair_nearby(adb_bin, pairing_points, interactive, unpaired, state_dir):
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


def scan_other_devices(adb_bin: str, state_dir: Path, interactive: bool) -> None:
    """Connects every further wireless-debugging phone found via mDNS, the tailnet and the LAN scan; offers pairing."""
    connected = set(online_serials(adb_bin))
    describe_mdns(adb_bin)
    connect_points, pairing_points = mdns_endpoints(adb_bin)
    candidates = list(dict.fromkeys(connect_points + tailnet_endpoints(state_dir) + scan_lan(scan_ports(state_dir))))
    unpaired: list[str] = []
    for endpoint in candidates:
        if endpoint in connected:
            continue
        if connect_authorized(adb_bin, endpoint):
            connected.add(endpoint)
        elif endpoint_open(endpoint):
            unpaired.append(endpoint)
    remember_online(adb_bin, state_dir)
    if unpaired or pairing_points:
        pair_nearby(adb_bin, pairing_points, interactive, unpaired, state_dir)
        remember_online(adb_bin, state_dir)
    log(f"Online device(s): {', '.join(online_serials(adb_bin)) or 'none'}")


def update_pairing(adb_bin: str, state_dir: Path) -> None:
    """Pairs again with a new code from the phone dialog and stores it under the current network."""
    print_pairing_help(adb_bin, [], mdns_endpoints(adb_bin)[1])
    endpoint, code = read_pairing_input(adb_bin, [], state_dir)
    if endpoint:
        pair_and_connect(adb_bin, endpoint, code, [], state_dir)
        remember_online(adb_bin, state_dir)


def offer_device_options(adb_bin: str, state_dir: Path, interactive: bool) -> None:
    """With a device already paired/online: a short Y window to scan other phones, then one to update the pairing code."""
    if not interactive:
        return
    network = current_network()
    if timed_yes_no(f"Press Y to scan '{network}' and the tailnet for other wireless-debugging devices",
                    CHOICE_WAIT_SECONDS, False):
        scan_other_devices(adb_bin, state_dir, interactive)
    saved = saved_pairings(state_dir, network)
    if timed_yes_no(f"Press Y to update the pairing code of network '{network}' ({len(saved)} saved)",
                    CHOICE_WAIT_SECONDS, False):
        update_pairing(adb_bin, state_dir)


def resolve_device(adb_bin: str, state_dir: Path, interactive: bool) -> bool:
    resolved = resolve_first_device(adb_bin, state_dir, interactive)
    if resolved:
        offer_device_options(adb_bin, state_dir, interactive)
    return resolved


def resolve_first_device(adb_bin: str, state_dir: Path, interactive: bool) -> bool:
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
