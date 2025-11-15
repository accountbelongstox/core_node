import socket
import ipaddress
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import List, Optional

SCAN_TIMEOUT = 0.5
MAX_SCAN_THREADS = 50

def get_local_ip():
    """Get local IP address"""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        local_ip = s.getsockname()[0]
        s.close()
        return local_ip
    except:
        return None

def get_network_segment(local_ip):
    """Get network segment from local IP (e.g., 192.168.1.0/24)"""
    if not local_ip:
        return None
    try:
        ip_obj = ipaddress.IPv4Address(local_ip)
        network = ipaddress.IPv4Network(f"{ip_obj}/24", strict=False)
        return str(network)
    except:
        return None

def test_port(ip, port, timeout):
    """Test if port is open on given IP"""
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(timeout)
        result = sock.connect_ex((ip, port))
        sock.close()
        return result == 0
    except:
        return False

def scan_lan_hosts(network_segment, port, timeout=0.5, service_name="service"):
    """Scan LAN segment for available hosts with given port"""
    if not network_segment:
        return []
    
    try:
        network = ipaddress.IPv4Network(network_segment, strict=False)
        network_prefix = str(network).split('/')[0].rsplit('.', 1)[0]
    except:
        return []
    
    print(f"\n[SCAN] Scanning network segment: {network_segment}")
    print(f"[SCAN] Port: {port}")
    print(f"[SCAN] Service: {service_name}")
    print(f"[SCAN] Timeout: {timeout}s per IP")
    print(f"[SCAN] Scanning {network_prefix}.1-255...")
    print()
    
    start_time = time.time()
    active_hosts = []
    completed = 0
    total_hosts = 254
    
    def scan_host(host_num):
        nonlocal completed
        ip = f"{network_prefix}.{host_num}"
        is_active = test_port(ip, port, timeout)
        completed += 1
        progress = (completed / total_hosts) * 100
        
        if is_active:
            print(f"[SCAN] ✓ {ip}:{port} - {service_name.upper()} FOUND [{progress:.1f}%]")
            return ip
        else:
            if completed % 10 == 0 or completed == total_hosts:
                print(f"[SCAN] Progress: {completed}/{total_hosts} ({progress:.1f}%)")
            return None
    
    with ThreadPoolExecutor(max_workers=MAX_SCAN_THREADS) as executor:
        futures = {executor.submit(scan_host, host_num): host_num 
                  for host_num in range(1, 256)}
        
        for future in as_completed(futures):
            result = future.result()
            if result:
                active_hosts.append(result)
    
    elapsed = time.time() - start_time
    print()
    print(f"[SCAN] Scan complete in {elapsed:.2f}s")
    print(f"[SCAN] Found {len(active_hosts)} active {service_name}(s)")
    
    return sorted(active_hosts, key=lambda x: ipaddress.IPv4Address(x))

