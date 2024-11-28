import os
import sys
import subprocess
import time
import json
import platform
import hashlib
import re
from pathlib import Path
from pprint import pprint
from typing import Any, Dict, List, Optional, Tuple
from datetime import datetime, timedelta
import pysrt  # For subtitle reading

class Printer:
    """Utility class for colored and formatted printing"""
    
    # ANSI Color codes
    COLORS = {
        'red': '\033[91m',
        'green': '\033[92m',
        'yellow': '\033[93m',
        'blue': '\033[94m',
        'purple': '\033[95m',
        'cyan': '\033[96m',
        'white': '\033[97m',
        'end': '\033[0m'
    }

    @classmethod
    def _format_color(cls, text: str, color: str) -> str:
        """Format text with color"""
        color_code = cls.COLORS.get(color.lower(), '')
        if color_code:
            return f"{color_code}{text}{cls.COLORS['end']}"
        return text

    @classmethod
    def print(cls, message: str, color: str = 'white'):
        """Print text with color"""
        print(cls._format_color(message, color))

    @classmethod
    def success(cls, message: str):
        """Print success message in green"""
        cls.print(message, 'green')
    
    @classmethod
    def error(cls, message: str):
        """Print error message in red"""
        cls.print(message, 'red')
    
    @classmethod
    def warning(cls, message: str):
        """Print warning message in yellow"""
        cls.print(message, 'yellow')
    
    @classmethod
    def info(cls, message: str):
        """Print info message in cyan"""
        cls.print(message, 'cyan')
    
    @classmethod
    def debug(cls, message: str):
        """Print debug message in blue"""
        cls.print(message, 'blue') 
cp = Printer

class FileReader:
    """Universal file reader with encoding detection and various formats support"""
    
    # Comprehensive list of encodings to try
    ENCODINGS = [
        "utf-8",
        "utf-16",
        "utf-16le",
        "utf-16BE",
        "gbk",
        "gb2312",
        "us-ascii",
        "ascii",
        "IBM037",
        "IBM437",
        "IBM500",
        "ASMO-708",
        "DOS-720",
        "ibm737",
        "ibm775",
        "ibm850",
        "ibm852",
        "IBM855",
        "ibm857",
        "IBM00858",
        "IBM860",
        "ibm861",
        "DOS-862",
        "IBM863",
        "IBM864",
        "IBM865",
        "cp866",
        "ibm869",
        "IBM870",
        "windows-874",
        "cp875",
        "shift_jis",
        "ks_c_5601-1987",
        "big5",
        "IBM1026",
        "IBM01047",
        "IBM01140",
        "IBM01141",
        "IBM01142",
        "IBM01143",
        "IBM01144",
        "IBM01145",
        "IBM01146",
        "IBM01147",
        "IBM01148",
        "IBM01149",
        "windows-1250",
        "windows-1251",
        "Windows-1252",
        "windows-1253",
        "windows-1254",
        "windows-1255",
        "windows-1256",
        "windows-1257",
        "windows-1258",
        "Johab",
        "macintosh",
        "x-mac-japanese",
        "x-mac-chinesetrad",
        "x-mac-korean",
        "x-mac-arabic",
        "x-mac-hebrew",
        "x-mac-greek",
        "x-mac-cyrillic",
        "x-mac-chinesesimp",
        "x-mac-romanian",
        "x-mac-ukrainian",
        "x-mac-thai",
        "x-mac-ce",
        "x-mac-icelandic",
        "x-mac-turkish",
        "x-mac-croatian",
        "utf-32",
        "utf-32BE",
        "x-Chinese-CNS",
        "x-cp20001",
        "x-Chinese-Eten",
        "x-cp20003",
        "x-cp20004",
        "x-cp20005",
        "x-IA5",
        "x-IA5-German",
        "x-IA5-Swedish",
        "x-IA5-Norwegian",
        "x-cp20261",
        "x-cp20269",
        "IBM273",
        "IBM277",
        "IBM278",
        "IBM280",
        "IBM284",
        "IBM285",
        "IBM290",
        "IBM297",
        "IBM420",
        "IBM423",
        "IBM424",
        "x-EBCDIC-KoreanExtended",
        "IBM-Thai",
        "koi8-r",
        "IBM871",
        "IBM880",
        "IBM905",
        "IBM00924",
        "EUC-JP",
        "x-cp20936",
        "x-cp20949",
        "cp1025",
        "koi8-u",
        "iso-8859-1",
        "iso-8859-2",
        "iso-8859-3",
        "iso-8859-4",
        "iso-8859-5",
        "iso-8859-6",
        "iso-8859-7",
        "iso-8859-8",
        "iso-8859-9",
        "iso-8859-13",
        "iso-8859-15",
        "x-Europa",
        "iso-8859-8-i",
        "iso-2022-jp",
        "csISO2022JP",
        "iso-2022-kr",
        "x-cp50227",
        "euc-jp",
        "EUC-CN",
        "euc-kr",
        "hz-gb-2312",
        "GB18030",
        "x-iscii-de",
        "x-iscii-be",
        "x-iscii-ta",
        "x-iscii-te",
        "x-iscii-as",
        "x-iscii-or",
        "x-iscii-ka",
        "x-iscii-ma",
        "x-iscii-gu",
        "x-iscii-pa",
        "utf-7"
    ]
    
    def __init__(self, preferred_encoding: str = None):
        """Initialize with optional preferred encoding"""
        self.preferred_encoding = preferred_encoding
    
    def read_file(self, file_path: str, encoding: str = None, verbose: bool = False) -> Dict[str, Any]:
        """
        Read file with automatic encoding detection
        Returns dict with encoding, content and filename
        """
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"File not found: {file_path}")
            
        encodings_to_try = [encoding] if encoding else []
        if self.preferred_encoding:
            encodings_to_try.append(self.preferred_encoding)
        encodings_to_try.extend(self.ENCODINGS)
        
        last_error = None
        for enc in encodings_to_try:
            try:
                with open(file_path, 'r', encoding=enc) as f:
                    content = f.read()
                    if verbose:
                        cp.success(f"Successfully read {file_path} using {enc} encoding")
                    return {
                        "encoding": enc,
                        "content": content,
                        "file_path": file_path
                    }
            except UnicodeDecodeError as e:
                if verbose:
                    cp.warning(f"Failed to read with {enc} encoding: {str(e)}")
                last_error = e
                continue
                
        raise UnicodeDecodeError(f"Failed to read {file_path} with any supported encoding: {str(last_error)}")
    
    def detect_encoding(self, file_path: str, preferred_encoding: str = None) -> Optional[str]:
        """Detect file encoding"""
        try:
            result = self.read_file(file_path, preferred_encoding)
            return result["encoding"]
        except Exception:
            return None
    
    def read_with_encoding(self, file_path: str, encoding: str) -> Optional[str]:
        """Read file with specific encoding"""
        try:
            with open(file_path, 'r', encoding=encoding) as f:
                return f.read()
        except Exception as e:
            cp.error(f"Error reading file with {encoding} encoding: {str(e)}")
            return None
    
    def read_json(self, file_path: str, encoding: str = None) -> Dict:
        """Read and parse JSON file"""
        try:
            result = self.read_file(file_path, encoding)
            return json.loads(result["content"])
        except Exception as e:
            cp.warning(f"Failed to parse {file_path} as JSON: {str(e)}")
            return {}
    
    def read_lines(self, file_path: str, encoding: str = None, 
                  skip_empty: bool = True, trim: bool = True) -> List[str]:
        """Read file lines with options"""
        try:
            result = self.read_file(file_path, encoding)
            lines = result["content"].split('\n')
            
            if trim:
                lines = [line.strip() for line in lines]
            if skip_empty:
                lines = [line for line in lines if line]
                
            return lines
        except Exception as e:
            cp.warning(f"Failed to read lines from {file_path}: {str(e)}")
            return []
    
    def read_key_value(self, file_path: str, encoding: str = None, 
                      delimiter: str = '=', skip_comments: bool = True) -> Dict[str, str]:
        """Read key-value pairs from file"""
        result = {}
        try:
            lines = self.read_lines(file_path, encoding, True, True)
            
            for line in lines:
                if skip_comments and line.startswith('#'):
                    continue
                    
                try:
                    parts = line.split(delimiter, 1)
                    if len(parts) >= 2:
                        key = parts[0].strip()
                        if not key:
                            continue
                        value = parts[1].strip()
                        result[key] = value
                except Exception as e:
                    cp.warning(f"Skipping malformed line: {line}")
                    continue
                    
        except Exception as e:
            cp.warning(f"Failed to read key-value pairs from {file_path}: {str(e)}")
            
        return result
    
    def save_json(self, file_path: str, data: Any, pretty: bool = True, 
                 encoding: str = 'utf-8') -> bool:
        """Save data as JSON file"""
        try:
            content = json.dumps(data, indent=2 if pretty else None, 
                               ensure_ascii=False)
            return self.save_file(file_path, content, encoding)
        except Exception as e:
            cp.error(f"Failed to save JSON to {file_path}: {str(e)}")
            return False
    
    def save_file(self, file_path: str, content: str, encoding: str = 'utf-8') -> bool:
        """Save content to file"""
        try:
            # Ensure directory exists
            os.makedirs(os.path.dirname(file_path), exist_ok=True)
            
            with open(file_path, 'w', encoding=encoding) as f:
                f.write(content)
            return True
        except Exception as e:
            cp.error(f"Failed to save file {file_path}: {str(e)}")
            return False
    
    def append_file(self, file_path: str, content: str, 
                   add_newline: bool = True, encoding: str = 'utf-8') -> bool:
        """Append content to file"""
        try:
            if not os.path.exists(file_path):
                return self.save_file(file_path, content, encoding)
            
            with open(file_path, 'a', encoding=encoding) as f:
                if add_newline:
                    f.write(f"\n{content}")
                else:
                    f.write(content)
            return True
        except Exception as e:
            cp.error(f"Failed to append to file {file_path}: {str(e)}")
            return False
file_reader = FileReader() 

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

class AutoInstallRequire:
    def __init__(self, use_mirror: str = None):
        """
        Initialize package installer
        :param use_mirror: Optional mirror to use ('huawei', 'aliyun', '163', 'tencent', 'douban')
        """
        # Print configuration
        Config.print_config()
        
        self.root_dir = Config.ROOT_DIR
        self.requirements_file = Config.REQUIREMENTS_FILE
        self.cache_dir = Config.CACHE_DIR
        self.mirror = Config.MIRRORS.get(use_mirror) if use_mirror else None
        self.file_reader = FileReader()
        
        # Ensure cache directory exists
        os.makedirs(self.cache_dir, exist_ok=True)
        
        # Clean expired cache
        self._clean_expired_cache()
        
        # Print cache status
        self._print_cache_status()
        
        # Start installation process
        self._install_requirements()

    def _get_package_cache_path(self, package_name: str) -> str:
        """Get cache file path for a package"""
        return Config.get_cache_file(package_name)

    def _is_cached(self, package_name: str) -> bool:
        """Check if package is cached as installed"""
        cache_file = self._get_package_cache_path(package_name)
        if not os.path.exists(cache_file):
            return False
            
        # Check cache age
        cache_time = datetime.fromtimestamp(os.path.getmtime(cache_file))
        if datetime.now() - cache_time > timedelta(days=Config.CACHE_EXPIRATION_DAYS):
            cp.warning(f"Cache expired for package: {package_name}")
            os.remove(cache_file)
            return False
            
        return True

    def _clean_expired_cache(self):
        """Clean expired cache files"""
        if not os.path.exists(self.cache_dir):
            return
            
        cp.info("\nChecking cache expiration...")
        expiration_time = datetime.now() - timedelta(days=Config.CACHE_EXPIRATION_DAYS)
        cleaned = 0
        
        for file in os.listdir(self.cache_dir):
            file_path = os.path.join(self.cache_dir, file)
            if os.path.getmtime(file_path) < expiration_time.timestamp():
                os.remove(file_path)
                cleaned += 1
                
        if cleaned > 0:
            cp.warning(f"Cleaned {cleaned} expired cache files")

    def _print_cache_status(self):
        """Print cache status information"""
        cp.info("\nCache Status:")
        cached_packages = [f for f in os.listdir(self.cache_dir) if f.endswith('.installed')]
        cp.info(f"Total cached packages: {len(cached_packages)}")
        if cached_packages:
            cp.info("Cached packages:")
            for package in cached_packages:
                name = package.rsplit('_', 1)[0].replace('.installed', '')
                cp.info(f"  - {name}")

    def _cache_package(self, package_name: str):
        """Mark package as installed in cache"""
        with open(self._get_package_cache_path(package_name), 'w') as f:
            f.write(datetime.now().isoformat())

    def _find_penv_python(self) -> List[Tuple[str, str]]:
        """Find all Python and pip executables in penv directories"""
        python_paths = []
        
        for item in os.listdir(self.root_dir):
            if item.startswith('penv'):
                penv_dir = os.path.join(self.root_dir, item)
                if sys.platform == 'win32':
                    python_path = os.path.join(penv_dir, 'Scripts', 'python.exe')
                    pip_path = os.path.join(penv_dir, 'Scripts', 'pip.exe')
                else:
                    python_path = os.path.join(penv_dir, 'bin', 'python')  # 先尝试 python3
                    pip_path = os.path.join(penv_dir, 'bin', 'pip')
                
                if os.path.exists(python_path) and os.path.exists(pip_path):
                    cp.info(f"Found Python environment: {python_path}")
                    python_paths.append((python_path, pip_path))
        
        if not python_paths:
            cp.warning("No penv Python environments found")
        else:
            cp.info(f"Found {len(python_paths)} Python environment(s)")
        
        return python_paths

    def _get_pip_command(self) -> Tuple[str, str]:
        """Get Python and pip command to use"""
        penv_results = self._find_penv_python()
        
        cp.info("\nSearching for Python environments:")
        
        # Try each Python environment
        for python_path, pip_path in penv_results:
            try:
                # Test if this Python environment works
                cp.info(f"Testing Python environment:")
                cp.info(f"  Python: {python_path}")
                cp.info(f"  Pip: {pip_path}")
                
                # Get Python version
                version_result = subprocess.run(
                    [python_path, "--version"],
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    text=True,
                    check=True
                )
                cp.info(f"  Version: {version_result.stdout.strip()}")
                
                # Test Python
                subprocess.run(
                    [python_path, "-c", "print('test')"],
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    check=True
                )
                
                cp.success(f"\nSelected Python environment:")
                cp.success(f"  Python: {python_path}")
                cp.success(f"  Pip: {pip_path}")
                cp.success(f"  Version: {version_result.stdout.strip()}")
                return python_path, pip_path
                
            except subprocess.CalledProcessError:
                cp.warning(f"Python environment not working: {python_path}")
                continue
            except Exception as e:
                cp.warning(f"Error testing Python environment {python_path}: {str(e)}")
                continue
        
        # If no working penv found, use system Python
        system_python = sys.executable
        system_pip = f'"{system_python}" -m pip'
        
        try:
            # Get system Python version
            version_result = subprocess.run(
                [system_python, "--version"],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                check=True
            )
            cp.info(f"\nUsing system Python:")
            cp.info(f"  Python: {system_python}")
            cp.info(f"  Pip: {system_pip}")
            cp.info(f"  Version: {version_result.stdout.strip()}")
        except Exception as e:
            cp.warning(f"Error getting system Python version: {str(e)}")
        
        return system_python, system_pip

    def _check_package_installed(self, package: str) -> bool:
        """Check if a package is installed using pip list"""
        python_cmd, pip_cmd = self._get_pip_command()
        try:
            # Get package name without version
            package_name = package.split('==')[0].lower()
            
            # Use pip list to check if package is installed
            result = subprocess.run(
                f'{pip_cmd} list --format=json',
                shell=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True
            )
            
            if result.returncode != 0:
                cp.error(f"Error checking package {package_name}: {result.stderr}")
                return False
            
            # Parse JSON output
            installed_packages = json.loads(result.stdout)
            
            # Check if package is in the list (case insensitive)
            for pkg in installed_packages:
                if pkg['name'].lower() == package_name:
                    cp.info(f"Found installed package: {pkg['name']} (version {pkg['version']})")
                    return True
                
            cp.warning(f"Package not found: {package_name}")
            return False
            
        except Exception as e:
            cp.error(f"Error checking package {package}: {str(e)}")
            return False

    def _install_package(self, package: str) -> bool:
        """Install a single package"""
        _, pip_cmd = self._get_pip_command()
        mirror_arg = f"--index-url {self.mirror}" if self.mirror else ""
        return self._run_pip_command(f"{pip_cmd} install {package} {mirror_arg}")

    def _run_pip_command(self, command: str) -> bool:
        """Run a pip command"""
        try:
            cp.info(f"Running: {command}")
            process = subprocess.run(
                command,
                shell=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True
            )
            if process.returncode != 0:
                cp.error(f"Error: {process.stderr}")
                return False
            cp.success(process.stdout)
            return True
        except Exception as e:
            cp.error(f"Error executing command: {str(e)}")
            return False

    def _read_requirements(self) -> List[str]:
        """Read and clean requirements from file"""
        try:
            lines = self.file_reader.read_lines(self.requirements_file)
            return [line.strip() for line in lines if line.strip()]
        except Exception as e:
            cp.error(f"Error reading requirements: {str(e)}")
            return []

    def _install_requirements(self):
        """Install all required packages"""
        try:
            # Read requirements
            requirements = self._read_requirements()
            if not requirements:
                cp.warning("No requirements found or unable to read requirements file")
                return

            cp.info("\nChecking package status:")
            cp.info(f"Total requirements: {len(requirements)}")
            cp.info("Required packages:")
            for pkg in requirements:
                cp.info(f"  - {pkg}")

            # Find uncached packages
            uncached_packages = []
            for package in requirements:
                if not self._is_cached(package):
                    uncached_packages.append(package)

            if uncached_packages:
                cp.info("\nPackages to install:")
                for pkg in uncached_packages:
                    cp.info(f"  - {pkg}")
            else:
                cp.success("\nAll required packages are installed.")
                return

            # Upgrade pip first
            python_cmd, pip_cmd = self._get_pip_command()
            self._run_pip_command(f"{pip_cmd} install --upgrade pip")

            # Install uncached packages
            total = len(uncached_packages)
            for i, package in enumerate(uncached_packages, 1):
                cp.info(f"Installing package {i}/{total}: {package}")
                if self._install_package(package):
                    self._cache_package(package)
                    cp.success(f"Successfully installed {package}")
                else:
                    cp.error(f"Failed to install {package}")
                    return

            cp.success("All packages installed successfully")

        except Exception as e:
            cp.error(f"Error during package installation: {str(e)}")
# Check and install requirements, then run the application
if __name__ == "__main__":
    AutoInstallRequire()
