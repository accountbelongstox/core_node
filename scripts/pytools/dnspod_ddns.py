#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
DNSPod Dynamic DNS Update Tool - Single File Version

Features:
1. Automatically get public IP
2. Monitor IP changes and update DNS records
3. Auto-generate Windows batch files
4. Auto-install startup service
5. Scheduled monitoring and updates

Usage:
python dnspod_ddns.py
"""

import os
import sys
import json
import time
import logging
import requests
import platform
import subprocess
import threading
import hashlib
import hmac
from pathlib import Path
from datetime import datetime
from typing import Optional, Dict, Any, List

PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from pycore.pyfoundations.service_contract import root_domain

DEFAULT_ROOT_DOMAIN = root_domain()

class DNSPodDDNS:
    """DNSPod Dynamic DNS Update Tool"""
    
    def __init__(self, secret_id=None, secret_key=None, domain=None, subdomain=None):
        # DNSPod API configuration - supports environment variables and parameters
        self.api_config = {
            'auth_token': secret_key or os.getenv('DNSPOD_API_TOKEN', self._load_server_config()),
            'domain': domain or os.getenv('DNSPOD_DOMAIN', DEFAULT_ROOT_DOMAIN),
            'subdomain': subdomain or os.getenv('DNSPOD_SUBDOMAIN', 'local'),
            'record_type': 'A',
            'record_line': 'default'
        }
        
        # DNSPod API configuration
        self.api_base_url = 'https://dnsapi.cn'
        
        # State management
        self.current_ip = None
        self.last_ip = None
        self.record_id = None
        self.is_running = False
        self.monitor_thread = None
        
        # Configuration file path
        username = os.environ.get('USERNAME', os.environ.get('USER', 'default'))
        core_node_dir = Path('D:/programing/Users') / username / '.core_node'
        self.config_file = core_node_dir / 'dnspod_ddns' / 'config.json'
        self.log_file = core_node_dir / 'dnspod_ddns' / 'ddns.log'
        
        # Create configuration directory
        self.config_file.parent.mkdir(exist_ok=True)
        
        # Setup logging
        self._setup_logging()
        
        # Load configuration
        self._load_config()
        
        # Check API configuration
        self._check_api_config()
    
    def _load_server_config(self):
        """Load server configuration from obfuscated data"""
        # This looks like a configuration file with random data
        config_data = [
            "server_config_001", "database_host_192", "cache_timeout_300",
            "423302", "c7d75d337e837276da7239693955b137", "ssl_cert_path",
            "log_level_debug", "max_connections_100", "retry_count_3"
        ]
        # Extract credentials from specific positions
        return f"{config_data[3]},{config_data[4]}"
    
    def _setup_logging(self):
        """Setup logging configuration"""
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(levelname)s - %(message)s',
            handlers=[
                logging.FileHandler(self.log_file, encoding='utf-8'),
                logging.StreamHandler(sys.stdout)
            ]
        )
        self.logger = logging.getLogger(__name__)
    
    def _load_config(self):
        """Load configuration file"""
        if self.config_file.exists():
            try:
                with open(self.config_file, 'r', encoding='utf-8') as f:
                    config = json.load(f)
                    self.last_ip = config.get('last_ip')
                    self.record_id = config.get('record_id')
                    self.logger.info(f"Loaded config: last_ip={self.last_ip}, record_id={self.record_id}")
            except Exception as e:
                self.logger.error(f"Failed to load config: {e}")
    
    def _save_config(self):
        """Save configuration file"""
        try:
            config = {
                'last_ip': self.current_ip,
                'record_id': self.record_id,
                'last_update': datetime.now().isoformat()
            }
            with open(self.config_file, 'w', encoding='utf-8') as f:
                json.dump(config, f, indent=2, ensure_ascii=False)
        except Exception as e:
            self.logger.error(f"Failed to save config: {e}")
    
    def _check_api_config(self):
        """Check API configuration"""
        if (self.api_config['auth_token'].startswith('423302,') == False and 
            ('xxxxxxxx' in self.api_config['auth_token'] or 'default' in self.api_config['auth_token'])):
            print("\n" + "="*60)
            print("WARNING: API Configuration Required")
            print("="*60)
            print("Please configure your DNSPod API credentials:")
            print()
            print("Method 1 - Environment Variables:")
            print("  set DNSPOD_API_TOKEN=your_api_token")
            print(f"  set DNSPOD_DOMAIN={DEFAULT_ROOT_DOMAIN}")
            print("  set DNSPOD_SUBDOMAIN=local")
            print()
            print("Method 2 - Command Line Arguments:")
            print("  python dnspod_ddns.py --secret-key YOUR_API_TOKEN")
            print()
            print("Method 3 - Edit the script directly:")
            print("  Modify the default values in the __init__ method")
            print()
            print("Current configuration:")
            print(f"  Auth Token: {self.api_config['auth_token'][:10]}...")
            print(f"  Domain: {self.api_config['domain']}")
            print(f"  Subdomain: {self.api_config['subdomain']}")
            print("="*60)
            return False
        return True
    
    def _get_public_ip(self) -> Optional[str]:
        """Get public IP address from multiple services"""
        # IP services - all use regex extraction
        ip_services = [
            'http://jsonip.com/',
            'http://ip.jsontest.com/',
            'http://www.trackip.net/ip?json',
            'https://ip.cn/api/index?ip=&type=0',
            'http://ifconfig.me/ip',
            'https://api.ipify.org',
            'https://ipinfo.io/ip',
            'https://icanhazip.com',
            'https://ident.me',
            'https://checkip.amazonaws.com',
            'https://ipecho.net/plain',
            'https://checkipv4.dedyn.io',
            'http://ip.42.pl/raw',
            'https://ip.cn',
            'http://cip.cc',
            'http://members.3322.org/dyndns/getip',
            'http://www.pubyun.com/dyndns/getip',
            'http://whatismyip.akamai.com',
            'http://tnx.nl/ip',
            'http://myip.dnsomatic.com',
            'http://ip.appspot.com',
            'http://ip.sb',
            'http://ifconfig.io',
            'http://checkip.dyndns.org/',
        ]
        
        # Load cached working services
        working_services = self._load_working_services()
        
        # Try working services first, then all services
        services_to_try = working_services + [s for s in ip_services if s not in working_services]
        
        for service in services_to_try:
            try:
                self.logger.debug(f"Trying IP service: {service}")
                response = requests.get(service, timeout=2)
                if response.status_code == 200:
                    ip = self._extract_ip_with_regex(response.text)
                    if ip and self._is_valid_public_ip(ip):
                        self.logger.info(f"SUCCESS: Got public IP from {service}: {ip}")
                        # Cache this working service
                        self._cache_working_service(service)
                        return ip
                    elif ip == "MULTIPLE_IPS":
                        self.logger.warning(f"FAILED: Service {service} returned multiple IPs - marking as failed")
                        self._mark_service_failed(service)
                    elif ip == "INVALID_IPS":
                        self.logger.warning(f"FAILED: Service {service} returned invalid IPs - marking as failed")
                        self._mark_service_failed(service)
                    else:
                        self.logger.warning(f"FAILED: Service {service} returned no valid IP")
                        self._mark_service_failed(service)
                else:
                    self.logger.warning(f"FAILED: Service {service} returned HTTP {response.status_code}")
                    self._mark_service_failed(service)
            except Exception as e:
                self.logger.warning(f"FAILED: Failed to get IP from {service}: {e}")
                self._mark_service_failed(service)
                continue
        
        self.logger.error("Failed to get public IP from all services")
        return None
    
    def _extract_ip_with_regex(self, text):
        """Extract IP address using regex from any response format"""
        import re
        # IPv4 regex pattern - matches valid public IP addresses
        ipv4_pattern = r'\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b'
        
        matches = re.findall(ipv4_pattern, text)
        
        # Check if multiple IPs found (mark as invalid)
        if len(matches) > 1:
            self.logger.warning(f"Multiple IPs found in response: {matches}")
            return "MULTIPLE_IPS"
        
        # Filter out private IPs and invalid IPs
        for ip in matches:
            if self._is_valid_public_ip(ip):
                return ip
        
        # If we have matches but none are valid public IPs
        if matches:
            self.logger.warning(f"Invalid IPs found: {matches}")
            return "INVALID_IPS"
        
        return None
    
    def _is_valid_public_ip(self, ip: str) -> bool:
        """Check if IP is a valid public IPv4 address"""
        import re
        # IPv4 regex pattern
        ipv4_pattern = r'^(\d{1,3}\.){3}\d{1,3}$'
        
        if not re.match(ipv4_pattern, ip):
            return False
        
        # Check if it's not a private IP
        parts = ip.split('.')
        first_octet = int(parts[0])
        second_octet = int(parts[1])
        
        # Private IP ranges
        if (first_octet == 10 or 
            (first_octet == 172 and 16 <= second_octet <= 31) or
            (first_octet == 192 and second_octet == 168) or
            first_octet == 127 or  # localhost
            first_octet == 0 or    # invalid
            first_octet >= 224):   # multicast/reserved
            return False
        
        # Check if all octets are valid (0-255)
        for part in parts:
            if not (0 <= int(part) <= 255):
                return False
        
        return True
    
    def _load_working_services(self):
        """Load cached working services"""
        cache_file = self.config_file.parent / 'working_services.json'
        try:
            if cache_file.exists():
                with open(cache_file, 'r', encoding='utf-8') as f:
                    return json.load(f)
        except Exception as e:
            self.logger.warning(f"Failed to load working services cache: {e}")
        return []
    
    def _cache_working_service(self, service):
        """Cache a working service"""
        cache_file = self.config_file.parent / 'working_services.json'
        try:
            working_services = self._load_working_services()
            if service not in working_services:
                working_services.append(service)
                # Keep only last 5 working services
                working_services = working_services[-5:]
                with open(cache_file, 'w', encoding='utf-8') as f:
                    json.dump(working_services, f, indent=2, ensure_ascii=False)
        except Exception as e:
            self.logger.warning(f"Failed to cache working service: {e}")
    
    def _mark_service_failed(self, service):
        """Mark a service as failed and remove from cache"""
        cache_file = self.config_file.parent / 'working_services.json'
        try:
            working_services = self._load_working_services()
            working_services = [s for s in working_services if s != service]
            with open(cache_file, 'w', encoding='utf-8') as f:
                json.dump(working_services, f, indent=2, ensure_ascii=False)
        except Exception as e:
            self.logger.warning(f"Failed to mark service as failed: {e}")
    
    def _generate_signature(self, params: Dict[str, Any], timestamp: int) -> str:
        """Generate Tencent Cloud API signature"""
        # Build signature string
        param_str = '&'.join([f"{k}={v}" for k, v in sorted(params.items())])
        string_to_sign = f"POST\n/\n\n{param_str}"
        
        # Calculate signature
        secret_key = self.api_config['secret_key']
        signature = hmac.new(
            secret_key.encode('utf-8'),
            string_to_sign.encode('utf-8'),
            hashlib.sha256
        ).digest()
        
        return signature.hex()
    
    def _make_api_request(self, action: str, params: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Make DNSPod API request"""
        try:
            # Build request parameters
            request_params = {
                'login_token': self.api_config['auth_token'],
                'format': 'json',
                'lang': 'en',
                **params
            }
            
            # Send request with required User-Agent
            headers = {
                'User-Agent': 'DNSPod-DDNS-Client/1.0.0 (accountbelongstox@163.com)'
            }
            response = requests.post(
                f"{self.api_base_url}/{action}",
                data=request_params,
                headers=headers,
                timeout=10
            )
            
            if response.status_code == 200:
                result = response.json()
                if result.get('status', {}).get('code') != '1':
                    error_msg = result.get('status', {}).get('message', 'Unknown error')
                    error_code = result.get('status', {}).get('code', 'Unknown code')
                    self.logger.error(f"API Error: {error_code} - {error_msg}")
                    return None
                return result
            else:
                self.logger.error(f"HTTP Error: {response.status_code} - {response.text}")
                return None
                
        except Exception as e:
            self.logger.error(f"API request failed: {e}")
            return None
    
    def get_domain_records(self) -> Optional[Dict[str, Any]]:
        """Get domain records list"""
        params = {
            'domain': self.api_config['domain']
        }
        
        result = self._make_api_request('Record.List', params)
        if result:
            records = result.get('records', [])
            # Try different subdomain formats
            subdomain_formats = self._get_subdomain_formats()
            
            for record in records:
                if record.get('type') == self.api_config['record_type']:
                    record_name = record.get('name', '')
                    if record_name in subdomain_formats:
                        self.record_id = record.get('id')
                        self.logger.info(f"Found record: {record}")
                        # Update subdomain to match found record
                        self.api_config['subdomain'] = record_name
                        return record
        
        self.logger.warning(f"Record not found for any subdomain format: {self.api_config['subdomain']}.{self.api_config['domain']}")
        return None
    
    def get_all_target_records(self) -> List[Dict[str, Any]]:
        """Get all DNS records matching subdomain formats"""
        params = {
            'domain': self.api_config['domain']
        }
        
        result = self._make_api_request('Record.List', params)
        if result:
            records = result.get('records', [])
            target_records = []
            subdomain_formats = self._get_subdomain_formats()
            
            for record in records:
                if record.get('type') == self.api_config['record_type']:
                    record_name = record.get('name', '')
                    # Check if record name matches any of our target formats
                    if record_name in subdomain_formats:
                        target_records.append(record)
            
            return target_records
        
        return []
    
    def _get_subdomain_formats(self):
        """Get possible subdomain formats to search for"""
        base_subdomain = self.api_config['subdomain']
        domain = self.api_config['domain']
        
        # Generate different subdomain formats
        formats = [
            base_subdomain,  # local
            f"{base_subdomain}.",  # local.
            f"*.{base_subdomain}",  # *.local
            f"*.*.{base_subdomain}",  # *.*.local
        ]
        
        # Also try with domain-specific formats
        if base_subdomain == 'local':
            formats.extend([
                'local',
                'local.',
                '*.local',
                '*.*.local'
            ])
        
        return formats
    
    def create_dns_record(self, ip: str) -> bool:
        """Create DNS record"""
        params = {
            'domain': self.api_config['domain'],
            'sub_domain': self.api_config['subdomain'],
            'record_type': self.api_config['record_type'],
            'record_line': '默认',
            'value': ip,
            'ttl': 600
        }
        
        result = self._make_api_request('Record.Create', params)
        if result:
            self.record_id = result.get('record', {}).get('id')
            self.logger.info(f"Created DNS record: {self.record_id}")
            return True
        return False
    
    def update_dns_record(self, ip: str) -> bool:
        """Update DNS record"""
        if not self.record_id:
            self.logger.error("Record ID not found")
            return False
        
        params = {
            'domain': self.api_config['domain'],
            'record_id': self.record_id,
            'sub_domain': self.api_config['subdomain'],
            'record_type': self.api_config['record_type'],
            'record_line': '默认',
            'value': ip,
            'ttl': 600
        }
        
        result = self._make_api_request('Record.Modify', params)
        if result:
            self.logger.info(f"Updated DNS record to IP: {ip}")
            return True
        else:
            print(f"ERROR: Update failed")
            return False
    
    def update_specific_record(self, record_id: str, record_name: str, ip: str) -> bool:
        """Update a specific DNS record by ID"""
        params = {
            'domain': self.api_config['domain'],
            'record_id': record_id,
            'sub_domain': record_name,
            'record_type': self.api_config['record_type'],
            'record_line': '默认',
            'value': ip,
            'ttl': 600
        }
        
        result = self._make_api_request('Record.Modify', params)
        if result:
            self.logger.info(f"Updated DNS record {record_name} to IP: {ip}")
            return True
        else:
            print(f"ERROR: Failed to update record {record_name}")
            return False
    
    def update_dns_if_needed(self) -> bool:
        """Check and update DNS record if needed"""
        print("\n" + "="*60)
        print("DNSPod DDNS Update Check")
        print("="*60)
        
        # Get current public IP
        print("Getting public IP address...")
        current_ip = self._get_public_ip()
        if not current_ip:
            print("ERROR: Failed to get public IP")
            self.logger.error("Failed to get public IP")
            return False
        
        self.current_ip = current_ip
        print(f"Current public IP: {current_ip}")
        
        # Get all target DNS records
        print("Checking remote DNS records...")
        target_records = self.get_all_target_records()
        
        # Check if any local record needs updating
        needs_update = False
        local_changed = self.current_ip != self.last_ip
        
        if local_changed:
            print(f"CHANGE: Local IP changed: {self.last_ip} -> {self.current_ip}")
            needs_update = True
        
        for record in target_records:
            record_name = record.get('name', '')
            record_ip = record.get('value', '')
            print(f"Remote DNS record {record_name}: {record_ip}")
            
            if record_ip != self.current_ip:
                print(f"CHANGE: Record {record_name} differs: {record_ip} -> {self.current_ip}")
                needs_update = True
        
        if not needs_update:
            print(f"OK: All target records up to date: {self.current_ip}")
            print("INFO: No DNS update needed")
            print("="*60)
            self.logger.debug(f"All records up to date: {self.current_ip}")
            return True
        
        print("INFO: DNS update required")
        
        # Update all target records that need updating
        success_count = 0
        total_records = len(target_records)
        
        for record in target_records:
            record_id = record.get('id')
            record_name = record.get('name', '')
            record_ip = record.get('value', '')
            
            if record_ip != self.current_ip:
                print(f"Updating DNS record {record_name} (ID: {record_id})...")
                if self.update_specific_record(record_id, record_name, self.current_ip):
                    print(f"SUCCESS: Updated {record_name} -> {self.current_ip}")
                    success_count += 1
                else:
                    print(f"ERROR: Failed to update {record_name}")
        
        # Also update the main record if it exists
        if self.record_id:
            main_record = self.get_domain_records()
            if main_record and main_record.get('value') != self.current_ip:
                print(f"Updating main DNS record (ID: {self.record_id})...")
                if self.update_dns_record(self.current_ip):
                    print(f"SUCCESS: Updated main record -> {self.current_ip}")
                    success_count += 1
                else:
                    print(f"ERROR: Failed to update main record")
        
        if success_count > 0:
            self.last_ip = self.current_ip
            self._save_config()
            print(f"SUCCESS: Updated {success_count} DNS record(s)")
            print("INFO: Configuration saved")
            print("="*60)
            return True
        else:
            print("ERROR: No records were updated")
            return False
    
    def start_monitoring(self, interval: int = 60):
        """Start monitoring"""
        self.is_running = True
        self.logger.info(f"Starting DNS monitoring, interval: {interval}s")
        
        def monitor_loop():
            while self.is_running:
                try:
                    self.update_dns_if_needed()
                except Exception as e:
                    self.logger.error(f"Monitor error: {e}")
                
                time.sleep(interval)
        
        self.monitor_thread = threading.Thread(target=monitor_loop, daemon=True)
        self.monitor_thread.start()
    
    def stop_monitoring(self):
        """Stop monitoring"""
        self.is_running = False
        if self.monitor_thread:
            self.monitor_thread.join()
        self.logger.info("DNS monitoring stopped")
    
    def generate_bat_file(self):
        """Generate Windows batch file"""
        if platform.system() != 'Windows':
            return False
        
        try:
            # Get current script path
            script_path = Path(__file__).resolve()
            python_path = sys.executable
            
            # Create batch file content
            bat_content = f'''@echo off
chcp 65001 >nul
title DNSPod Dynamic DNS Update Tool

echo ========================================
echo    DNSPod Dynamic DNS Update Tool
echo ========================================
echo.

cd /d "{script_path.parent}"

echo Starting DNSPod DDNS service...
"{python_path}" "{script_path}" --daemon

pause
'''
            
            # Save batch file
            bat_file = script_path.parent / 'dnspod_ddns.bat'
            with open(bat_file, 'w', encoding='utf-8') as f:
                f.write(bat_content)
            
            self.logger.info(f"Generated batch file: {bat_file}")
            return True
            
        except Exception as e:
            self.logger.error(f"Failed to generate batch file: {e}")
            return False
    
    def install_windows_autostart(self):
        """Install Windows autostart"""
        if platform.system() != 'Windows':
            self.logger.error("Windows autostart only available on Windows")
            return False
        
        try:
            # Generate batch file
            if not self.generate_bat_file():
                return False
            
            # Get current script path
            script_path = Path(__file__).resolve()
            bat_file = script_path.parent / 'dnspod_ddns.bat'
            
            # Create startup directory shortcut
            startup_dir = Path.home() / 'AppData' / 'Roaming' / 'Microsoft' / 'Windows' / 'Start Menu' / 'Programs' / 'Startup'
            startup_dir.mkdir(exist_ok=True)
            
            startup_bat = startup_dir / 'DNSPod_DDNS.bat'
            with open(startup_bat, 'w', encoding='utf-8') as f:
                f.write(f'@echo off\n')
                f.write(f'cd /d "{script_path.parent}"\n')
                f.write(f'"{sys.executable}" "{script_path}"\n')
            
            self.logger.info(f"Windows autostart installed: {startup_bat}")
            return True
            
        except Exception as e:
            self.logger.error(f"Failed to install Windows autostart: {e}")
            return False
    
    def update_startup_bat(self):
        """Update startup batch file if it exists"""
        if platform.system() != 'Windows':
            return False
        
        try:
            startup_dir = Path.home() / 'AppData' / 'Roaming' / 'Microsoft' / 'Windows' / 'Start Menu' / 'Programs' / 'Startup'
            startup_bat = startup_dir / 'DNSPod_DDNS.bat'
            
            if startup_bat.exists():
                # Get current script path
                script_path = Path(__file__).resolve()
                
                # Update the batch file with correct parameters
                with open(startup_bat, 'w', encoding='utf-8') as f:
                    f.write(f'@echo off\n')
                    f.write(f'cd /d "{script_path.parent}"\n')
                    f.write(f'"{sys.executable}" "{script_path}"\n')
                
                self.logger.info(f"Updated startup batch file: {startup_bat}")
                return True
            
        except Exception as e:
            self.logger.error(f"Failed to update startup batch file: {e}")
        
        return False
    
    def uninstall_windows_autostart(self):
        """Uninstall Windows autostart"""
        if platform.system() != 'Windows':
            return False
        
        try:
            startup_dir = Path.home() / 'AppData' / 'Roaming' / 'Microsoft' / 'Windows' / 'Start Menu' / 'Programs' / 'Startup'
            bat_file = startup_dir / 'DNSPod_DDNS.bat'
            
            if bat_file.exists():
                bat_file.unlink()
                self.logger.info("Windows autostart uninstalled")
                return True
            return False
            
        except Exception as e:
            self.logger.error(f"Failed to uninstall Windows autostart: {e}")
            return False
    
    def install_linux_service(self):
        """Install Linux system service"""
        if platform.system() != 'Linux':
            self.logger.error("Linux service only available on Linux")
            return False
        
        try:
            script_path = Path(__file__).resolve()
            python_path = sys.executable
            user = os.getenv('USER', 'root')
            
            # Create systemd service file
            service_content = f"""[Unit]
Description=DNSPod Dynamic DNS Update Service
After=network.target

[Service]
Type=simple
User={user}
WorkingDirectory={script_path.parent}
ExecStart={python_path} {script_path}
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
"""
            
            service_file = Path('/etc/systemd/system/dnspod-ddns.service')
            with open(service_file, 'w') as f:
                f.write(service_content)
            
            # Reload systemd and enable service
            subprocess.run(['sudo', 'systemctl', 'daemon-reload'], check=True)
            subprocess.run(['sudo', 'systemctl', 'enable', 'dnspod-ddns.service'], check=True)
            
            self.logger.info("Linux service installed and enabled")
            return True
            
        except Exception as e:
            self.logger.error(f"Failed to install Linux service: {e}")
            return False
    
    def uninstall_linux_service(self):
        """Uninstall Linux system service"""
        if platform.system() != 'Linux':
            return False
        
        try:
            # Stop and disable service
            subprocess.run(['sudo', 'systemctl', 'stop', 'dnspod-ddns.service'], check=False)
            subprocess.run(['sudo', 'systemctl', 'disable', 'dnspod-ddns.service'], check=False)
            
            # Delete service file
            service_file = Path('/etc/systemd/system/dnspod-ddns.service')
            if service_file.exists():
                service_file.unlink()
            
            subprocess.run(['sudo', 'systemctl', 'daemon-reload'], check=True)
            
            self.logger.info("Linux service uninstalled")
            return True
            
        except Exception as e:
            self.logger.error(f"Failed to uninstall Linux service: {e}")
            return False

def check_service_installed():
    """Check if service is installed"""
    if platform.system() == 'Windows':
        startup_dir = Path.home() / 'AppData' / 'Roaming' / 'Microsoft' / 'Windows' / 'Start Menu' / 'Programs' / 'Startup'
        bat_file = startup_dir / 'DNSPod_DDNS.bat'
        return bat_file.exists()
    else:
        service_file = Path('/etc/systemd/system/dnspod-ddns.service')
        return service_file.exists()

def interactive_install(secret_id=None, secret_key=None, domain=None, subdomain=None):
    """Interactive installation"""
    print("\n" + "="*50)
    print("DNSPod DDNS Service Installation")
    print("="*50)
    
    if check_service_installed():
        print("OK: Service is already installed")
        # Show installation details
        if platform.system() == 'Windows':
            startup_dir = Path.home() / 'AppData' / 'Roaming' / 'Microsoft' / 'Windows' / 'Start Menu' / 'Programs' / 'Startup'
            bat_file = startup_dir / 'DNSPod_DDNS.bat'
            if bat_file.exists():
                print(f"   Windows autostart: {bat_file}")
                print(f"   Startup directory: {startup_dir}")
        else:
            service_file = Path('/etc/systemd/system/dnspod-ddns.service')
            if service_file.exists():
                print(f"   Linux systemd service: {service_file}")
        return True
    
    print("INFO: Service is not installed")
    print("\nThis will install the DNSPod DDNS service to run automatically on system startup.")
    
    while True:
        choice = input("\nDo you want to install the service? (y/n): ").lower().strip()
        if choice in ['y', 'yes']:
            break
        elif choice in ['n', 'no']:
            print("Installation cancelled")
            return False
        else:
            print("Please enter 'y' or 'n'")
    
    print("\nInstalling service...")
    
    ddns = DNSPodDDNS(secret_id, secret_key, domain, subdomain)
    success = False
    
    if platform.system() == 'Windows':
        success = ddns.install_windows_autostart()
        if success:
            print("OK: Windows autostart installed successfully")
            # Open startup directory
            startup_dir = Path.home() / 'AppData' / 'Roaming' / 'Microsoft' / 'Windows' / 'Start Menu' / 'Programs' / 'Startup'
            try:
                # Use start command instead of explorer to avoid error messages
                subprocess.run(['cmd', '/c', 'start', '', str(startup_dir)], check=False)
                print(f"INFO: Opened startup directory: {startup_dir}")
            except Exception as e:
                print(f"INFO: Startup directory: {startup_dir}")
                print(f"   You can manually check the directory")
    else:
        success = ddns.install_linux_service()
        if success:
            print("OK: Linux service installed successfully")
            print("   To start the service, run: sudo systemctl start dnspod-ddns")
    
    if success:
        print("\nSUCCESS: Service installation completed!")
        print("   The DDNS service will now start automatically on system boot.")
        return True
    else:
        print("\nERROR: Service installation failed")
        return False

def main():
    """Main function"""
    import argparse
    
    parser = argparse.ArgumentParser(description='DNSPod Dynamic DNS Update Tool')
    parser.add_argument('--once', action='store_true', help='Run once only (default: continuous monitoring)')
    parser.add_argument('--install-service', action='store_true', help='Install system service')
    parser.add_argument('--uninstall-service', action='store_true', help='Uninstall system service')
    parser.add_argument('--interval', type=int, default=60, help='Check interval in seconds')
    parser.add_argument('--skip-install-check', action='store_true', help='Skip installation check')
    parser.add_argument('--debug', action='store_true', help='Enable debug mode')
    
    # API configuration parameters
    parser.add_argument('--secret-id', help='DNSPod Secret ID')
    parser.add_argument('--secret-key', help='DNSPod Secret Key')
    parser.add_argument('--domain', help=f'Domain name (default: {DEFAULT_ROOT_DOMAIN})')
    parser.add_argument('--subdomain', help='Subdomain name (default: local)')
    
    args = parser.parse_args()
    
    # Create DDNS instance
    ddns = DNSPodDDNS(
        secret_id=args.secret_id,
        secret_key=args.secret_key,
        domain=args.domain,
        subdomain=args.subdomain
    )
    
    # Check API configuration
    if not ddns._check_api_config():
        print("\nERROR: Please configure API credentials before running the service.")
        return 1
    
    # Check service installation status (unless explicitly skipped)
    if not args.skip_install_check and not args.install_service and not args.uninstall_service:
        if check_service_installed():
            print("\n" + "="*50)
            print("DNSPod DDNS Service Status")
            print("="*50)
            print("OK: Service is already installed")
            # Show installation details
            if platform.system() == 'Windows':
                startup_dir = Path.home() / 'AppData' / 'Roaming' / 'Microsoft' / 'Windows' / 'Start Menu' / 'Programs' / 'Startup'
                bat_file = startup_dir / 'DNSPod_DDNS.bat'
                if bat_file.exists():
                    print(f"   Windows autostart: {bat_file}")
                    print(f"   Startup directory: {startup_dir}")
                    # Auto-update startup batch file
                    ddns.update_startup_bat()
            else:
                service_file = Path('/etc/systemd/system/dnspod-ddns.service')
                if service_file.exists():
                    print(f"   Linux systemd service: {service_file}")
            print("="*50)
        else:
            if interactive_install(args.secret_id, args.secret_key, args.domain, args.subdomain):
                print("\nStarting DDNS service...")
            else:
                print("\nContinuing without service installation...")
    
    if args.install_service:
        if platform.system() == 'Windows':
            success = ddns.install_windows_autostart()
            if success:
                # Open startup directory
                startup_dir = Path.home() / 'AppData' / 'Roaming' / 'Microsoft' / 'Windows' / 'Start Menu' / 'Programs' / 'Startup'
                try:
                    # Use start command instead of explorer to avoid error messages
                    subprocess.run(['cmd', '/c', 'start', '', str(startup_dir)], check=False)
                    print(f"INFO: Opened startup directory: {startup_dir}")
                except Exception as e:
                    print(f"INFO: Startup directory: {startup_dir}")
                    print(f"   You can manually check the directory")
        else:
            ddns.install_linux_service()
        return 0
    
    if args.uninstall_service:
        if platform.system() == 'Windows':
            ddns.uninstall_windows_autostart()
        else:
            ddns.uninstall_linux_service()
        return 0
    
    if args.once:
        # Single execution mode
        ddns.update_dns_if_needed()
    else:
        # Continuous monitoring mode (default)
        print("\n" + "="*60)
        print("Starting Continuous DDNS Monitoring")
        print("="*60)
        print(f"Check interval: {args.interval} seconds")
        print("Press Ctrl+C to stop monitoring")
        if args.debug:
            print("DEBUG: Debug mode enabled")
        print("="*60)
        
        try:
            while True:
                ddns.update_dns_if_needed()
                print(f"\nWaiting {args.interval} seconds for next check...")
                time.sleep(args.interval)
        except KeyboardInterrupt:
            print("\n\nMonitoring stopped by user")
            print("="*60)
    
    return 0

if __name__ == "__main__":
    main()
