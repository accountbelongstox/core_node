import os
import platform
import hashlib
import re
from datetime import datetime

class Config:
    @staticmethod
    def _get_safe_filename(s: str) -> str:
        """Convert string to safe filename"""
        return re.sub(r'[^a-zA-Z0-9-_]', '_', s)

    @staticmethod
    def _get_system_info() -> str:
        """Get formatted system information"""
        system = platform.system()
        version = platform.release()
        machine = platform.machine()
        processor = platform.processor()
        
        # Create system info string
        system_str = f"{system}_{version}_{machine}_{processor}"
        return Config._get_safe_filename(system_str)

    @staticmethod
    def _get_system_id() -> str:
        """Generate a unique system identifier"""
        system_info = [
            platform.system(),
            platform.release(),
            platform.machine(),
            platform.processor(),
            os.getenv('USERNAME', ''),
            os.getenv('COMPUTERNAME', '')
        ]
        system_str = '|'.join(system_info)
        return hashlib.md5(system_str.encode()).hexdigest()

    # Get the root directory (two levels up from this file)
    ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '../..'))
    
    # Requirements file path
    REQUIREMENTS_FILE = os.path.join(ROOT_DIR, '.pycore_installed_requirements')
    
    # Cache directory for installed packages with system info
    CACHE_DIR = None  # Will be set after class definition
    
    # Cache expiration time (in days)
    CACHE_EXPIRATION_DAYS = 2
    
    # Available pip mirrors
    MIRRORS = {
        'huawei': 'https://mirrors.huaweicloud.com/repository/pypi/simple',
        'aliyun': 'https://mirrors.aliyun.com/pypi/simple',
        '163': 'https://mirrors.163.com/pypi/simple',
        'tencent': 'https://mirrors.cloud.tencent.com/pypi/simple',
        'douban': 'https://pypi.doubanio.com/simple'
    }
    
    @classmethod
    def get_cache_file(cls, package_name: str) -> str:
        """Get cache file path with system ID"""
        return os.path.join(cls.CACHE_DIR, f"{package_name.lower()}.installed")
    
    @classmethod
    def print_config(cls):
        """Print all configuration information"""
        from .libs.printer import Printer as cp
        
        cp.info("\nConfiguration Information:")
        cp.info(f"Root Directory: {cls.ROOT_DIR}")
        cp.info(f"Requirements File: {cls.REQUIREMENTS_FILE}")
        cp.info(f"Cache Directory: {cls.CACHE_DIR}")
        cp.info(f"Cache Expiration: {cls.CACHE_EXPIRATION_DAYS} days")
        cp.info(f"System Info: {cls._get_system_info()}")
        cp.info(f"System ID: {cls._get_system_id()}")
        
        cp.info("\nAvailable Mirrors:")
        for name, url in cls.MIRRORS.items():
            cp.info(f"  - {name}: {url}")

# Set CACHE_DIR after class is defined
Config.CACHE_DIR = os.path.join(
    Config.ROOT_DIR, 
    '.cache', 
    f"{Config._get_system_info()}_{Config._get_system_id()}_installed_pip_package"
)