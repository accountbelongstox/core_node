import subprocess
import ipaddress
import socket
import time
import sys


def get_local_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
    finally:
        s.close()
    return ip

def scan_ip(ip, timeout_sec=0.5):
    cmd = ["adb", "connect", f"{ip}:5555"]
    try:
        out = subprocess.check_output(
            cmd,
            stderr=subprocess.STDOUT,
            timeout=timeout_sec,
            encoding="utf-8"
        )
        return out.strip()
    except subprocess.TimeoutExpired:
        return None
    except subprocess.CalledProcessError:
        return None


def main():
    local_ip = get_local_ip()
    print(f"Local IP: {local_ip}")

    # Determine subnet
    net = ipaddress.ip_network(local_ip + "/24", strict=False)
    print(f"\nScanning subnet: {net}")
    print(f"Total IPs: {net.num_addresses - 2}\n")

    ip_list = [str(ip) for ip in net.hosts()]

    total = len(ip_list)
    print("Start scanning...\n")

    for idx, ip in enumerate(ip_list, 1):
        print(f"[{idx}/{total}] Scanning {ip} ...", end="\r")
        sys.stdout.flush()

        result = scan_ip(ip)

        if result:
            print(f"\nFOUND device at: {ip}")
            print(f"ADB Response: {result}\n")

        time.sleep(0.01)  # small delay to avoid flooding adb

    print("\nScan completed.")


if __name__ == "__main__":
    main()
