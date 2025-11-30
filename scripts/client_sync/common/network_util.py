import socket
import ipaddress
import time
import platform
import subprocess
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

def get_all_available_ips():
    """
    Get all available IP addresses on this machine
    
    PURPOSE: Detect all network interfaces and their IP addresses
    RETURNS: Sorted list of all IP addresses found on this machine
    """
    ips = set()
    
    hostname = socket.gethostname()
    try:
        host_ips = socket.gethostbyname_ex(hostname)[2]
        ips.update(host_ips)
    except:
        pass
    
    try:
        host_ips = socket.gethostbyname_ex("localhost")[2]
        ips.update(host_ips)
    except:
        pass
    
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        local_ip = s.getsockname()[0]
        ips.add(local_ip)
        s.close()
    except:
        pass
    
    if platform.system() == "Windows":
        try:
            result = subprocess.run(["ipconfig"], capture_output=True, text=True, timeout=5)
            for line in result.stdout.split("\n"):
                if "IPv4" in line or "IP Address" in line:
                    parts = line.split(":")
                    if len(parts) > 1:
                        ip = parts[1].strip()
                        if ip and ip != "0.0.0.0":
                            try:
                                socket.inet_aton(ip)
                                ips.add(ip)
                            except:
                                pass
        except:
            pass
    else:
        try:
            result = subprocess.run(["hostname", "-I"], capture_output=True, text=True, timeout=5)
            for ip in result.stdout.strip().split():
                if ip:
                    try:
                        socket.inet_aton(ip)
                        ips.add(ip)
                    except:
                        pass
        except:
            pass
    
    return sorted(list(ips))

def is_client_host(host_ip, port, timeout=0.3):
    """
    Check if a host is a client by attempting a connection test
    
    PURPOSE: Distinguish clients from servers
    METHOD: Try to connect to the host
    - Clients listen and accept connections (will accept our connection)
    - Servers don't listen (connection will fail or timeout)
    
    RETURNS: True if host appears to be a client, False otherwise
    """
    try:
        test_sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        test_sock.settimeout(timeout)
        result = test_sock.connect_ex((host_ip, port))
        test_sock.close()
        
        # If connection succeeds, it's likely a client (listening on port)
        # If connection fails, it's likely not a client (could be a server or nothing)
        return result == 0
    except:
        return False

class HostIdentifier:
    """
    Public class for identifying server and client hosts on the network
    
    PURPOSE: Provide structured methods to distinguish between servers and clients
    USAGE: Create an instance and use methods to identify host types
    """
    
    def __init__(self, port, timeout=0.3):
        """
        Initialize HostIdentifier
        
        Args:
            port: Port number to check (typically SYNC_PORT)
            timeout: Connection timeout in seconds (default: 0.3)
        """
        self.port = port
        self.timeout = timeout
    
    def is_client(self, host_ip):
        """
        Check if a host is a client
        
        METHOD: Attempts to connect to the host
        - Clients listen and accept connections (connection succeeds)
        - Servers don't listen (connection fails or times out)
        
        Args:
            host_ip: IP address of the host to check
            
        Returns:
            bool: True if host is a client, False otherwise
        """
        try:
            test_sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            test_sock.settimeout(self.timeout)
            result = test_sock.connect_ex((host_ip, self.port))
            test_sock.close()
            
            # If connection succeeds, it's likely a client (listening on port)
            return result == 0
        except:
            return False
    
    def is_server(self, host_ip):
        """
        Check if a host is a server
        
        METHOD: Attempts to connect to the host
        - Servers don't listen (connection fails or times out)
        - Clients listen (connection succeeds, so this returns False)
        
        Args:
            host_ip: IP address of the host to check
            
        Returns:
            bool: True if host is a server, False otherwise
        """
        return not self.is_client(host_ip)
    
    def identify_host(self, host_ip):
        """
        Identify the type of host (server or client)
        
        Args:
            host_ip: IP address of the host to identify
            
        Returns:
            str: "client" if host is a client, "server" if host is a server, "unknown" if cannot determine
        """
        if self.is_client(host_ip):
            return "client"
        elif self.is_server(host_ip):
            return "server"
        else:
            return "unknown"
    
    def filter_hosts(self, host_ips, exclude_local_ips=None, exclude_type=None):
        """
        Filter a list of host IPs by type
        
        Args:
            host_ips: List of IP addresses to filter
            exclude_local_ips: Set of local IP addresses to exclude (optional)
            exclude_type: Type to exclude - "client" or "server" (optional)
            
        Returns:
            dict: Dictionary with keys "clients" and "servers" containing filtered lists
        """
        if exclude_local_ips is None:
            exclude_local_ips = set()
        
        clients = []
        servers = []
        
        for host_ip in host_ips:
            # Skip local IPs
            if host_ip in exclude_local_ips:
                continue
            
            host_type = self.identify_host(host_ip)
            
            if host_type == "client":
                if exclude_type != "client":
                    clients.append(host_ip)
            elif host_type == "server":
                if exclude_type != "server":
                    servers.append(host_ip)
        
        return {
            "clients": clients,
            "servers": servers
        }

