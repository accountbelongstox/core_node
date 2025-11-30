import os
import platform
from pathlib import Path

SYSTEM_NAME = platform.system()
SYSTEM_VERSION = platform.version()
IS_WINDOWS = SYSTEM_NAME == 'Windows'
IS_LINUX = SYSTEM_NAME == 'Linux'
IS_MAC = SYSTEM_NAME == 'Darwin'
PLATFORM_NAME = platform.platform()

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
PYCORE_ROOT_DIR = os.path.abspath(os.path.join(CURRENT_DIR, '../..'))
ROOT_DIR = PYCORE_ROOT_DIR
PROJECT_ROOT = ROOT_DIR

USER_HOME_DIR = str(Path.home())
USER_PROFILE = USER_HOME_DIR

if IS_WINDOWS:
    SEVEN_ZIP_PATHS = [
        os.path.join(PYCORE_ROOT_DIR, 'pycore', 'base', 'library', 'win32', '7za.exe'),
        r'D:\applications\7-Zip\7z.exe',
        r'C:\Program Files\7-Zip\7z.exe',
        r'C:\Program Files (x86)\7-Zip\7z.exe',
    ]
    DEFAULT_TEMP_DIR = os.getenv('TEMP', r'C:\Windows\Temp')
    APPLICATIONS_DIR = r'D:\applications'
    LANG_COMPILER_DIR = r'D:\lang_compiler'
else:
    SEVEN_ZIP_PATHS = [
        os.path.join(PYCORE_ROOT_DIR, 'pycore', 'base', 'library', 'linux', '7z'),
        '/usr/bin/7z',
        '/usr/local/bin/7z',
        '/usr/bin/7za',
        '/usr/local/bin/7za',
    ]
    DEFAULT_TEMP_DIR = '/tmp'
    APPLICATIONS_DIR = '/opt/applications'
    LANG_COMPILER_DIR = '/opt/lang_compiler'

BACKUP_DIR_NAME = 'CoreNodeBackup'
LOCAL_CORE_NODE_DIR = os.path.join(USER_HOME_DIR, '.core_node')
GLOBAL_VAR_DIR = os.path.join(LOCAL_CORE_NODE_DIR, '.global_vars')
CACHE_DIR = os.path.join(LOCAL_CORE_NODE_DIR, 'cache')
INSTALLER_SCRIPTS_DIR = os.path.join(LOCAL_CORE_NODE_DIR, 'installer_scripts')

CPU_COUNT = os.cpu_count() or 4
MAX_CONCURRENT_ZIP_TASKS = max(2, min(CPU_COUNT // 2, 6))
DEFAULT_ZIP_THREADS = MAX_CONCURRENT_ZIP_TASKS

SUPPORTED_ARCHIVE_FORMATS = ['.7z', '.zip', '.tar', '.gz', '.bz2', '.xz']
DEFAULT_ARCHIVE_FORMAT = '.7z'
DEFAULT_COMPRESSION_LEVEL = 5

BACKUP_METADATA_FILENAME = 'backup_metadata.json'
BACKUP_INDEX_FILENAME = 'backup_index.json'

WIN10_IDENTIFIER = '10.0'
WIN11_IDENTIFIER = '10.0.22000'

def get_windows_version():
    if not IS_WINDOWS:
        return None
    version = platform.version()
    if version.startswith(WIN11_IDENTIFIER):
        return 'Windows11'
    elif version.startswith(WIN10_IDENTIFIER):
        return 'Windows10'
    else:
        return 'WindowsOther'

def get_seven_zip_executable():
    for path in SEVEN_ZIP_PATHS:
        if os.path.exists(path):
            return path
    if IS_WINDOWS:
        import shutil
        system_7z = shutil.which('7z') or shutil.which('7za')
        if system_7z:
            return system_7z
    return None

SEVEN_ZIP_EXECUTABLE = get_seven_zip_executable()

def ensure_directory(dir_path):
    os.makedirs(dir_path, exist_ok=True)
    return dir_path

def get_available_drives():
    if not IS_WINDOWS:
        return []
    import string
    from ctypes import windll
    drives = []
    bitmask = windll.kernel32.GetLogicalDrives()
    for letter in string.ascii_uppercase:
        if bitmask & 1:
            drives.append(f'{letter}:')
        bitmask >>= 1
    return drives
