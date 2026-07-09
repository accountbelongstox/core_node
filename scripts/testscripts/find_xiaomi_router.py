#!/usr/bin/env python3
"""Scan a local subnet (default 192.168.1.0/24) and list ALL live hosts.

Every responsive IP is printed with: MAC, MAC vendor (from arp-scan/nmap),
reverse-DNS name, HTTP page title, and a Xiaomi flag. The vendor field is the
real way to spot a Xiaomi router - arp-scan/nmap resolve the OUI to a vendor
string like "Xiaomi Communications Co Ltd" / "Asustek" / "Tp-Link Technologies".

A host is Xiaomi-flagged when its vendor string mentions Xiaomi/XiaoQiang/Redmi,
or its MAC OUI is in the Xiaomi registry. (Phones/IoT share these, so a flag is
a lead, not proof it is THE router - cross-check with the gateway column and the
HTTP title, which for stock MiWiFi firmware reads "MiWiFi" / "小米路由器".)

Host discovery degrades by privilege:
  arp-scan (root) -> scapy (root) -> nmap -sn -> ping-sweep + /proc/net/arp
Only arp-scan/scapy need root; nmap gets MACs if it has cap_net_raw (typical on
Kali). Without MACs you still get every live IP, just no vendor column.

Usage:
  python3 find_xiaomi_router.py                     # 192.168.1.0/24, auto iface
  sudo python3 find_xiaomi_router.py                # ARP discovery (best: MACs+vendor for all)
  python3 find_xiaomi_router.py --subnet 192.168.0.0/24 --interface wlan0
  python3 find_xiaomi_router.py --no-http --no-rdns # fastest: IP/MAC/vendor only
"""

import argparse
import ipaddress
import os
import re
import socket
import ssl
import subprocess
import sys
import threading
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor

# ---- top-level configuration / variables -------------------------------------
DEFAULT_SUBNET = "192.168.1.0/24"
HTTP_TIMEOUT = 1.8
HTTP_BODY_BYTES = 16384
SSDP_TIMEOUT = 3.0
SSDP_MULTICAST = ("239.255.255.250", 1900)
RDNS_TIMEOUT = 1.5
PING_WORKERS = 64
PROBE_WORKERS = 32
UA = "Mozilla/5.0 (X11; Linux x86_64) find-xiaomi-router"

# HTTP probe targets: (scheme, port). Probed on every live host (parallel).
HTTP_PROBES = [("http", 80), ("http", 8080), ("https", 443)]

# Case-insensitive substrings marking a Xiaomi router admin page/banner.
HTTP_INDICATORS = ["miwifi", "xiaoqiang", "mi-router", "miwifi.com", "xiaomi", "小米路由器"]
SSDP_INDICATORS = ["miwifi", "xiaoqiang", "xiaomi", "mi-router"]

# Vendor-string fragments that mark a Xiaomi device (from arp-scan/nmap OUI text).
VENDOR_XIAOMI = ["xiaomi", "xiaoqiang", "redmi", "mi communication", "mi mobile"]

# OUI prefixes (first 3 octets, uppercase) registered to Xiaomi. Vendor string
# from arp-scan/nmap is preferred; this is the fallback when vendor is unknown.
XIAOMI_OUIS = {
    "64:09:80", "0C:1D:AF", "18:59:36", "F8:A4:2F", "04:CF:8C", "14:6B:9C",
    "34:CE:00", "8C:BE:BE", "78:11:DC", "7C:1C:4E", "DC:2C:6E", "50:64:2B",
    "88:C3:97", "0C:4B:54", "5C:02:14", "9C:F6:DD", "B0:48:7A", "C4:0B:CB",
    "C8:3A:35", "D4:97:0B", "E0:B5:2F", "EC:88:92", "F0:B4:29", "00:0C:43",
    "94:65:2D", "A4:50:46", "08:60:6E", "28:6C:07", "4C:63:EB", "68:DB:CA",
    "AC:9E:17", "B0:E2:35", "C0:EE:FB", "CC:B1:1A", "D8:0D:17", "6C:5A:B0",
    "A0:69:D9", "B8:27:0B", "D4:DA:21",
}

TITLE_RE = re.compile(r"<title[^>]*>(.*?)</title>", re.IGNORECASE | re.DOTALL)
HOST_RE = re.compile(r"Nmap scan report for (\d+\.\d+\.\d+\.\d+)")
NMAP_MAC_RE = re.compile(r"MAC Address: ([0-9A-Fa-f:]{17})(?: \((.*)\))?")
ARPSCAN_RE = re.compile(r"^(\d+\.\d+\.\d+\.\d+)\s+([0-9A-Fa-f:]{17})\s+(.*)$")


# ---- small helpers -----------------------------------------------------------
def is_root() -> bool:
    return hasattr(os, "geteuid") and os.geteuid() == 0


def detect_interface() -> str:
    try:
        out = subprocess.run(["ip", "route", "show", "default"],
                             capture_output=True, text=True, timeout=3).stdout.strip()
    except Exception:
        return ""
    for line in out.splitlines():
        parts = line.split()
        if "dev" in parts:
            return parts[parts.index("dev") + 1]
    return ""


def default_gateway() -> str:
    try:
        out = subprocess.run(["ip", "route", "show", "default"],
                             capture_output=True, text=True, timeout=3).stdout.strip()
    except Exception:
        return ""
    for line in out.splitlines():
        parts = line.split()
        if len(parts) >= 3 and parts[0] == "default":
            return parts[2]
    return ""


def oui_of(mac: str) -> str:
    parts = mac.split(":")
    return ":".join(parts[:3]).upper() if len(parts) >= 3 else ""


def is_xiaomi(mac: str, vendor: str) -> bool:
    vl = (vendor or "").lower()
    if any(frag in vl for frag in VENDOR_XIAOMI):
        return True
    return bool(mac) and oui_of(mac) in XIAOMI_OUIS


def normalize_mac(mac: str) -> str:
    return mac.strip().upper()


# ---- host discovery (privilege-graded) ---------------------------------------
def discover_arp_scan(subnet: str, iface: str):
    """arp-scan: fast, needs root. Returns {ip: {mac, vendor}}."""
    cmd = ["arp-scan", "--interface", iface, subnet, "--retry", "2", "--timeout", "400"]
    try:
        out = subprocess.run(cmd, capture_output=True, text=True, timeout=60).stdout
    except Exception:
        return {}
    hosts = {}
    for line in out.splitlines():
        m = ARPSCAN_RE.match(line.strip())
        if m:
            hosts[m.group(1)] = {"mac": normalize_mac(m.group(2)), "vendor": m.group(3).strip()}
    return hosts


def discover_scapy(subnet: str):
    """scapy ARP sweep: needs root. Returns {ip: {mac, vendor:""}}."""
    try:
        from scapy.all import ARP, Ether, srp  # noqa: WPS433 local import
    except Exception:
        return {}
    try:
        ans, _ = srp(Ether(dst="ff:ff:ff:ff:ff:ff") / ARP(psub=subnet), timeout=3, verbose=0)
    except Exception:
        return {}
    return {rcv.psrc: {"mac": normalize_mac(rcv.hwsrc), "vendor": ""} for _, rcv in ans}


def discover_nmap(subnet: str):
    """nmap -sn: MACs+vendor with cap_net_raw, else still finds live IPs."""
    try:
        out = subprocess.run(["nmap", "-sn", "-n", subnet],
                             capture_output=True, text=True, timeout=120).stdout
    except Exception:
        return {}
    hosts = {}
    cur_ip = ""
    for line in out.splitlines():
        mh = HOST_RE.search(line)
        if mh:
            cur_ip = mh.group(1)
            hosts.setdefault(cur_ip, {"mac": "", "vendor": ""})
            continue
        mm = NMAP_MAC_RE.search(line)
        if mm and cur_ip:
            hosts[cur_ip] = {"mac": normalize_mac(mm.group(1)),
                             "vendor": (mm.group(2) or "").strip()}
    return hosts


def _ping_one(ip: str) -> bool:
    try:
        rc = subprocess.run(["ping", "-c1", "-W1", ip],
                            capture_output=True, timeout=2).returncode
    except Exception:
        return False
    return rc == 0


def discover_ping_arp(subnet: str):
    """Unprivileged fallback: ping-sweep then read /proc/net/arp (no vendor)."""
    net = ipaddress.ip_network(subnet, strict=False)
    ips = [str(ip) for ip in net.hosts()]
    hosts = {}
    with ThreadPoolExecutor(max_workers=PING_WORKERS) as pool:
        for ip, alive in zip(ips, pool.map(_ping_one, ips)):
            if alive:
                hosts[ip] = {"mac": "", "vendor": ""}
    try:
        with open("/proc/net/arp", "r", encoding="utf-8") as fh:
            lines = fh.readlines()[1:]
    except Exception:
        lines = []
    for line in lines:
        parts = line.split()
        if len(parts) >= 4 and parts[0] in hosts and parts[3] != "00:00:00:00:00:00":
            hosts[parts[0]]["mac"] = normalize_mac(parts[3])
    return hosts


def discover_hosts(subnet: str, iface: str):
    """Try discovery methods in order of preference; stop at the first that works."""
    methods = []
    if iface:
        methods.append(("arp-scan", lambda: discover_arp_scan(subnet, iface)))
    methods.append(("scapy", lambda: discover_scapy(subnet)))
    methods.append(("nmap", lambda: discover_nmap(subnet)))
    methods.append(("ping+arp", lambda: discover_ping_arp(subnet)))
    for name, fn in methods:
        try:
            hosts = fn()
        except Exception as exc:  # pragma: no cover - defensive
            print(f"  [discover:{name}] failed: {exc}", file=sys.stderr)
            continue
        if hosts:
            print(f"  [discover] {name}: {len(hosts)} live host(s)")
            return hosts, name
        print(f"  [discover:{name}] no hosts", file=sys.stderr)
    return {}, "none"


# ---- per-host signal probes --------------------------------------------------
def probe_http(ip: str):
    """Probe HTTP/HTTPS admin ports; return {server, title, hits}."""
    server = ""
    title = ""
    hits = []
    for scheme, port in HTTP_PROBES:
        url = f"{scheme}://{ip}:{port}/"
        ctx = ssl._create_unverified_context() if scheme == "https" else None
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=HTTP_TIMEOUT, context=ctx) as resp:
                headers = dict(resp.headers)
                data = resp.read(HTTP_BODY_BYTES)
        except urllib.error.HTTPError as exc:
            headers = dict(exc.headers)
            try:
                data = exc.read(HTTP_BODY_BYTES)
            except Exception:
                data = b""
        except Exception:
            continue
        server = headers.get("Server", "") or server
        text = data.decode("utf-8", "ignore")
        mt = TITLE_RE.search(text)
        if mt:
            title = mt.group(1).strip()
        blob = (text + " " + server + " " + title).lower()
        for ind in HTTP_INDICATORS:
            if ind.lower() in blob and ind not in hits:
                hits.append(ind)
    return {"server": server, "title": title, "hits": hits}


def reverse_dns(ip: str, timeout: float = RDNS_TIMEOUT) -> str:
    """Bounded PTR lookup via a daemon thread (gethostbyaddr has no timeout arg)."""
    box = [""]
    def _worker():
        try:
            box[0] = socket.gethostbyaddr(ip)[0]
        except Exception:
            box[0] = ""
    t = threading.Thread(target=_worker, daemon=True)
    t.start()
    t.join(timeout)
    return box[0]


# ---- orchestration -----------------------------------------------------------
def main():
    parser = argparse.ArgumentParser(description="List all live hosts on a LAN.")
    parser.add_argument("--subnet", default=DEFAULT_SUBNET,
                        help=f"CIDR to scan (default {DEFAULT_SUBNET})")
    parser.add_argument("--interface", default="",
                        help="network interface for arp-scan (default: auto)")
    parser.add_argument("--no-http", action="store_true", help="skip HTTP title probing")
    parser.add_argument("--no-rdns", action="store_true", help="skip reverse DNS")
    parser.add_argument("--no-ssdp", action="store_true", help="skip SSDP probe")
    args = parser.parse_args()

    try:
        ipaddress.ip_network(args.subnet, strict=False)
    except ValueError as exc:
        print(f"invalid subnet: {exc}", file=sys.stderr)
        return 2

    iface = args.interface or detect_interface()
    gateway_ip = default_gateway()
    print(f"subnet={args.subnet} interface={iface or '(auto)'} "
          f"gateway={gateway_ip or '(none)'} root={is_root()}\n")

    hosts, method = discover_hosts(args.subnet, iface)
    if not hosts:
        print("no live hosts found - try running as root for ARP discovery, "
              "or pass --interface <iface>.", file=sys.stderr)
        return 1

    # Parallel per-host enrichment: HTTP title + reverse DNS.
    http_results = {}
    rdns_results = {}
    with ThreadPoolExecutor(max_workers=PROBE_WORKERS) as pool:
        if not args.no_http:
            fut_http = {pool.submit(probe_http, ip): ip for ip in hosts}
        if not args.no_rdns:
            fut_rdns = {pool.submit(reverse_dns, ip): ip for ip in hosts}
        for fut, ip in (list(fut_http.items()) if not args.no_http else []):
            try:
                http_results[ip] = fut.result(timeout=HTTP_TIMEOUT * len(HTTP_PROBES) + 1)
            except Exception:
                http_results[ip] = {"server": "", "title": "", "hits": []}
        for fut, ip in (list(fut_rdns.items()) if not args.no_rdns else []):
            try:
                rdns_results[ip] = fut.result(timeout=RDNS_TIMEOUT + 0.5)
            except Exception:
                rdns_results[ip] = ""

    # Sort by IP (numeric), gateway first.
    def ip_key(item):
        ip = item[0]
        return (0 if ip == gateway_ip else 1, [int(o) for o in ip.split(".")])
    rows = sorted(hosts.items(), key=ip_key)

    print("%-16s %-8s %-26s %-22s %-3s %s" %
          ("IP", "XIAOMI", "MAC", "VENDOR", "GW", "HOSTNAME / HTTP TITLE"))
    print("-" * 110)
    xiaomi_ips = []
    for ip, info in rows:
        mac = info.get("mac", "")
        vendor = info.get("vendor", "")
        xiao = is_xiaomi(mac, vendor)
        if xiao:
            xiaomi_ips.append(ip)
        hr = http_results.get(ip, {"title": "", "hits": []})
        rdns = rdns_results.get(ip, "")
        title = hr.get("title", "")
        name_part = rdns or ""
        if title:
            name_part = (name_part + "  |  " if name_part else "") + title
        gw = "*" if ip == gateway_ip else ""
        print("%-16s %-8s %-26s %-22s %-3s %s" %
              (ip, "YES" if xiao else "",
               mac or "?", (vendor or "?")[:26], gw, name_part or "-"))

    print("\n" + "=" * 110)
    print(f"total live hosts: {len(hosts)}  (discovery: {method})")
    if xiaomi_ips:
        print("Xiaomi-flagged host(s): " + ", ".join(xiaomi_ips))
        print("Tip: the router is usually the gateway (GW=*) or the host whose "
              "HTTP title is 'MiWiFi' / '小米路由器'.")
    else:
        print("No Xiaomi-flagged host. Look at the VENDOR column for 'Xiaomi', "
              "or run with sudo so arp-scan fills in vendors for every device.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
