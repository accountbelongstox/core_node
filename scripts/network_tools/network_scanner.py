#!/usr/bin/env python3
"""
Network Scanner - Local IP Discovery and Port Scanning Tool

Discovers local IP addresses and scans network segments for accessible hosts.
Supports interactive IP selection and port connectivity testing.
"""

import socket
import threading
import time
import ipaddress
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
import subprocess
import platform

try:
    import psutil
    HAS_PSUTIL = True
except ImportError:
    HAS_PSUTIL = False
    print("Warning: psutil not available, using basic network interface detection")

def get_local_ip_addresses():
    """Get all local IP addresses with interface information"""
    local_ips = []
    
    if HAS_PSUTIL:
        # Use psutil for detailed interface information
        for interface_name, interface_info in psutil.net_if_addrs().items():
            if interface_name == 'lo' or 'Loopback' in interface_name:
                continue
                
            for addr_info in interface_info:
                if addr_info.family == socket.AF_INET:
                    ip = addr_info.address
                    if ip != '127.0.0.1' and not ip.startswith('169.254'):
                        # Get network mask
                        netmask = addr_info.netmask
                        prefix_length = sum([bin(int(x)).count('1') for x in netmask.split('.')])
                        
                        local_ips.append({
                            'ip': ip,
                            'interface': interface_name,
                            'netmask': netmask,
                            'prefix_length': prefix_length,
                            'network': str(ipaddress.IPv4Network(f"{ip}/{prefix_length}", strict=False))
                        })
    else:
        # Fallback method without psutil
        hostname = socket.gethostname()
        try:
            # Get all IP addresses associated with hostname
            addresses = socket.getaddrinfo(hostname, None)
            for addr in addresses:
                if addr[0] == socket.AF_INET:
                    ip = addr[4][0]
                    if ip != '127.0.0.1' and not ip.startswith('169.254'):
                        # Assume /24 network for fallback
                        prefix_length = 24
                        local_ips.append({
                            'ip': ip,
                            'interface': 'Unknown',
                            'netmask': '255.255.255.0',
                            'prefix_length': prefix_length,
                            'network': str(ipaddress.IPv4Network(f"{ip}/{prefix_length}", strict=False))
                        })
        except Exception:
            pass
    
    return local_ips

def show_ip_selection_menu(ip_list):
    """Show interactive IP selection menu"""
    if not ip_list:
        print("No IP addresses found!")
        return None
    
    selected_index = 0
    
    while True:
        # Clear screen
        if platform.system() == "Windows":
            subprocess.run("cls", shell=True)
        else:
            subprocess.run("clear", shell=True)
        
        print("=== Network Scanner - IP Selection ===")
        print()
        print("Local IP Addresses Found:")
        print()
        
        for i, ip_info in enumerate(ip_list):
            prefix = ">>> " if i == selected_index else "    "
            print(f"{prefix}{i + 1}. {ip_info['ip']} [{ip_info['interface']}] - Network: {ip_info['network']}")
        
        print()
        print("Use UP/DOWN arrows to select, ENTER to confirm, ESC or 'q' to exit")
        
        try:
            if platform.system() == "Windows":
                import msvcrt
                key = msvcrt.getch()
                if key == b'\xe0':  # Special key prefix on Windows
                    key = msvcrt.getch()
                    if key == b'H':  # Up arrow
                        selected_index = max(0, selected_index - 1)
                    elif key == b'P':  # Down arrow
                        selected_index = min(len(ip_list) - 1, selected_index + 1)
                elif key == b'\r':  # Enter
                    return ip_list[selected_index]
                elif key == b'\x1b' or key == b'q':  # ESC or 'q'
                    return None
            else:
                # Linux/Mac terminal input handling
                import termios, tty
                fd = sys.stdin.fileno()
                old_settings = termios.tcgetattr(fd)
                try:
                    tty.cbreak(fd)
                    key = sys.stdin.read(1)
                    if key == '\x1b':  # ESC sequence
                        key += sys.stdin.read(2)
                        if key == '\x1b[A':  # Up arrow
                            selected_index = max(0, selected_index - 1)
                        elif key == '\x1b[B':  # Down arrow
                            selected_index = min(len(ip_list) - 1, selected_index + 1)
                    elif key == '\n' or key == '\r':  # Enter
                        return ip_list[selected_index]
                    elif key == '\x1b' or key == 'q':  # ESC or 'q'
                        return None
                finally:
                    termios.tcsetattr(fd, termios.TCSADRAIN, old_settings)
        except Exception:
            # Fallback to simple input
            print()
            try:
                choice = input(f"Select IP (1-{len(ip_list)}) or 'q' to quit: ").strip()
                if choice.lower() == 'q':
                    return None
                choice_num = int(choice)
                if 1 <= choice_num <= len(ip_list):
                    return ip_list[choice_num - 1]
            except (ValueError, KeyboardInterrupt):
                return None

def test_port_connectivity(ip, port, timeout=0.5):
    """Test if a port is open on the given IP"""
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(timeout)
        result = sock.connect_ex((ip, port))
        sock.close()
        return result == 0
    except Exception:
        return False

def scan_network_segment(base_ip, prefix_length, port=80, timeout=0.5, max_workers=50):
    """Scan all hosts in the network segment"""
    try:
        network = ipaddress.IPv4Network(f"{base_ip}/{prefix_length}", strict=False)
    except Exception as e:
        print(f"Error creating network: {e}")
        return []
    
    print(f"Scanning network segment: {network}")
    print(f"Port: {port}")
    print(f"Timeout: {timeout}s")
    print()
    
    hosts_to_scan = list(network.hosts())
    if len(hosts_to_scan) > 254:
        print(f"Network too large ({len(hosts_to_scan)} hosts). Limiting to first 254 hosts.")
        hosts_to_scan = hosts_to_scan[:254]
    
    accessible_hosts = []
    completed = 0
    total_hosts = len(hosts_to_scan)
    
    def scan_host(host_ip):
        nonlocal completed
        host_str = str(host_ip)
        is_accessible = test_port_connectivity(host_str, port, timeout)
        
        completed += 1
        progress = (completed / total_hosts) * 100
        
        if is_accessible:
            print(f"✓ {host_str} - Port {port} OPEN [{progress:.1f}%]")
            return host_str
        else:
            print(f"✗ {host_str} - Port {port} CLOSED [{progress:.1f}%]")
            return None
    
    # Use ThreadPoolExecutor for concurrent scanning
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        future_to_host = {executor.submit(scan_host, host): host for host in hosts_to_scan}
        
        for future in as_completed(future_to_host):
            result = future.result()
            if result:
                accessible_hosts.append(result)
    
    return sorted(accessible_hosts, key=lambda x: ipaddress.IPv4Address(x))

def show_results(accessible_hosts, port=80):
    """Display scan results and generate URLs"""
    print("\n" + "="*50)
    print("=== Network Scan Results ===")
    print("="*50)
    
    if not accessible_hosts:
        print(f"No accessible hosts found on port {port}")
        return
    
    print(f"Accessible hosts on port {port}:")
    print()
    
    urls = []
    for host in accessible_hosts:
        if port == 80:
            url = f"http://{host}"
        else:
            url = f"http://{host}:{port}"
        urls.append(url)
        print(f"  {url}")
    
    print()
    print("URLs ready for copying:")
    url_list = "\n".join(urls)
    print(url_list)
    
    # Try to copy to clipboard
    try:
        if platform.system() == "Windows":
            subprocess.run(f'echo {url_list} | clip', shell=True, check=True)
            print("\n✓ URLs copied to clipboard!")
        elif platform.system() == "Darwin":  # macOS
            subprocess.run(['pbcopy'], input=url_list.encode(), check=True)
            print("\n✓ URLs copied to clipboard!")
        elif platform.system() == "Linux":
            try:
                subprocess.run(['xclip', '-selection', 'clipboard'], input=url_list.encode(), check=True)
                print("\n✓ URLs copied to clipboard!")
            except FileNotFoundError:
                try:
                    subprocess.run(['xsel', '--clipboard', '--input'], input=url_list.encode(), check=True)
                    print("\n✓ URLs copied to clipboard!")
                except FileNotFoundError:
                    print("\nNote: Could not copy to clipboard (xclip/xsel not available)")
    except Exception:
        print("\nNote: Could not copy to clipboard automatically")

def main():
    """Main function"""
    port = 80
    timeout = 0.5
    
    # Parse command line arguments
    if len(sys.argv) > 1:
        try:
            port = int(sys.argv[1])
        except ValueError:
            print("Invalid port number")
            return
    
    if len(sys.argv) > 2:
        try:
            timeout = float(sys.argv[2])
        except ValueError:
            print("Invalid timeout value")
            return
    
    try:
        print(f"=== Network Scanner - Port {port} Discovery ===")
        print()
        
        # Get local IP addresses
        local_ips = get_local_ip_addresses()
        
        if not local_ips:
            print("No active network interfaces found!")
            return
        
        print(f"Found {len(local_ips)} local IP address(es)")
        time.sleep(1)
        
        # Show selection menu
        selected_ip_info = show_ip_selection_menu(local_ips)
        
        if not selected_ip_info:
            print("Operation cancelled by user")
            return
        
        # Clear screen and show selection
        if platform.system() == "Windows":
            subprocess.run("cls", shell=True)
        else:
            subprocess.run("clear", shell=True)
        
        print(f"Selected IP: {selected_ip_info['ip']}")
        print(f"Network Segment: {selected_ip_info['network']}")
        print()
        
        # Scan the network segment
        accessible_hosts = scan_network_segment(
            selected_ip_info['ip'], 
            selected_ip_info['prefix_length'], 
            port, 
            timeout
        )
        
        # Show results
        show_results(accessible_hosts, port)
        
        print()
        input("Press Enter to exit...")
        
    except KeyboardInterrupt:
        print("\nOperation cancelled by user")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    main()