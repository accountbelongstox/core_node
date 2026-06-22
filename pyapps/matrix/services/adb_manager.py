"""
ADB Installer - ADB 自动扫描、安装和管理

Responsibilities:
- Scan system for existing ADB installations
- Auto-download and install ADB on Windows/Linux
- Verify ADB availability
- Manage ADB path configuration

Note: This is different from pycore.ADBManager which provides ADB command execution.
This class focuses on ADB installation and path management.
"""

import os
import platform
import subprocess
import shutil
import zipfile
from pathlib import Path
from typing import Optional, List, Tuple
import urllib.request
import tempfile


class ADBInstaller:
    """ADB 管理器"""

    # Android SDK Platform Tools 下载链接（官方）
    PLATFORM_TOOLS_URLS = {
        'Windows': 'https://dl.google.com/android/repository/platform-tools-latest-windows.zip',
        'Linux': 'https://dl.google.com/android/repository/platform-tools-latest-linux.zip',
        'Darwin': 'https://dl.google.com/android/repository/platform-tools-latest-darwin.zip'
    }

    def __init__(self, resources_dir: Optional[Path] = None):
        """
        初始化 ADB 管理器

        Args:
            resources_dir: 资源目录路径（用于存放 ADB）
        """
        self.system = platform.system()
        self.resources_dir = resources_dir or (Path(__file__).parent / "resources")
        self.adb_exe = "adb.exe" if self.system == 'Windows' else "adb"

    def get_local_adb_path(self) -> Optional[Path]:
        """
        获取本地 ADB 路径（resources 目录）

        Returns:
            ADB 可执行文件路径，不存在返回 None
        """
        if self.system == 'Windows':
            adb_path = self.resources_dir / "adb" / "windows" / "adb.exe"
        elif self.system == 'Darwin':
            adb_path = self.resources_dir / "adb" / "macos" / "adb"
        else:
            adb_path = self.resources_dir / "adb" / "linux" / "adb"

        return adb_path if adb_path.exists() else None

    def scan_system_adb(self) -> List[str]:
        """
        扫描系统中已安装的 ADB

        Returns:
            找到的 ADB 路径列表
        """
        found_paths = []

        # 1. 检查 PATH 环境变量
        adb_in_path = shutil.which(self.adb_exe)
        if adb_in_path:
            found_paths.append(adb_in_path)

        # 2. 扫描常见安装路径
        common_paths = self._get_common_adb_paths()
        for path in common_paths:
            adb_full_path = Path(path) / self.adb_exe
            if adb_full_path.exists() and str(adb_full_path) not in found_paths:
                found_paths.append(str(adb_full_path))

        return found_paths

    def _get_common_adb_paths(self) -> List[str]:
        """获取常见的 ADB 安装路径"""
        paths = []

        if self.system == 'Windows':
            # Windows 常见路径
            user_home = Path.home()
            paths.extend([
                f"{user_home}\\AppData\\Local\\Android\\Sdk\\platform-tools",
                "C:\\Program Files (x86)\\Android\\android-sdk\\platform-tools",
                "C:\\Android\\android-sdk\\platform-tools",
                "C:\\adb",
            ])
        elif self.system == 'Linux':
            # Linux 常见路径
            user_home = Path.home()
            paths.extend([
                f"{user_home}/Android/Sdk/platform-tools",
                "/usr/bin",
                "/usr/local/bin",
                "/opt/android-sdk/platform-tools",
            ])
        elif self.system == 'Darwin':
            # macOS 常见路径
            user_home = Path.home()
            paths.extend([
                f"{user_home}/Library/Android/sdk/platform-tools",
                "/usr/local/bin",
                "/opt/android-sdk/platform-tools",
            ])

        return paths

    def verify_adb(self, adb_path: str) -> Tuple[bool, Optional[str]]:
        """
        验证 ADB 可用性

        Args:
            adb_path: ADB 可执行文件路径

        Returns:
            (是否可用, 版本信息或错误信息)
        """
        try:
            result = subprocess.run(
                [adb_path, "version"],
                capture_output=True,
                text=True,
                timeout=5
            )
            if result.returncode == 0:
                # 提取版本信息
                version_line = result.stdout.split('\n')[0]
                return True, version_line
            else:
                return False, f"Error: {result.stderr}"
        except FileNotFoundError:
            return False, "File not found"
        except subprocess.TimeoutExpired:
            return False, "Command timeout"
        except Exception as e:
            return False, str(e)

    def download_and_install_adb(self, target_dir: Optional[Path] = None) -> Tuple[bool, str]:
        """
        下载并安装 ADB（仅适用于 Windows/Linux/macOS）

        Args:
            target_dir: 安装目标目录（默认为 resources/adb/{platform}）

        Returns:
            (是否成功, 消息)
        """
        if target_dir is None:
            system_name = self.system.lower()
            if system_name == 'darwin':
                system_name = 'macos'
            target_dir = self.resources_dir / "adb" / system_name

        # 创建目标目录
        target_dir.mkdir(parents=True, exist_ok=True)

        # 获取下载链接
        download_url = self.PLATFORM_TOOLS_URLS.get(self.system)
        if not download_url:
            return False, f"Unsupported platform: {self.system}"

        try:
            print(f"Downloading ADB from: {download_url}")
            print("This may take a few minutes...")

            # 下载到临时文件
            with tempfile.NamedTemporaryFile(delete=False, suffix='.zip') as tmp_file:
                tmp_path = Path(tmp_file.name)

                # 显示下载进度
                def report_progress(block_num, block_size, total_size):
                    if total_size > 0:
                        downloaded = block_num * block_size
                        percent = min(downloaded * 100.0 / total_size, 100)
                        print(f"\rDownload progress: {percent:.1f}%", end='', flush=True)

                urllib.request.urlretrieve(download_url, tmp_path, reporthook=report_progress)
                print()  # 换行

            # 解压
            print(f"Extracting to: {target_dir}")
            with zipfile.ZipFile(tmp_path, 'r') as zip_ref:
                # 解压 platform-tools 目录内容
                for member in zip_ref.namelist():
                    if member.startswith('platform-tools/'):
                        # 去掉 platform-tools/ 前缀
                        target_path = target_dir / member.replace('platform-tools/', '', 1)
                        if member.endswith('/'):
                            target_path.mkdir(parents=True, exist_ok=True)
                        else:
                            target_path.parent.mkdir(parents=True, exist_ok=True)
                            with zip_ref.open(member) as source, open(target_path, 'wb') as target:
                                shutil.copyfileobj(source, target)

            # 删除临时文件
            tmp_path.unlink()

            # 设置可执行权限（Linux/macOS）
            if self.system in ['Linux', 'Darwin']:
                adb_path = target_dir / 'adb'
                if adb_path.exists():
                    os.chmod(adb_path, 0o755)

            adb_path = target_dir / self.adb_exe
            if adb_path.exists():
                return True, f"ADB installed successfully at: {adb_path}"
            else:
                return False, "Installation completed but ADB executable not found"

        except Exception as e:
            return False, f"Failed to download/install ADB: {str(e)}"

    def try_install_via_package_manager(self) -> Tuple[bool, str]:
        """
        尝试通过包管理器安装 ADB（仅 Linux）

        Returns:
            (是否成功, 消息)
        """
        if self.system != 'Linux':
            return False, "Package manager installation only supported on Linux"

        try:
            # 尝试检测包管理器并安装
            package_managers = [
                ('apt-get', 'sudo apt-get update && sudo apt-get install -y adb'),
                ('yum', 'sudo yum install -y android-tools'),
                ('dnf', 'sudo dnf install -y android-tools'),
                ('pacman', 'sudo pacman -S --noconfirm android-tools'),
            ]

            for pm, install_cmd in package_managers:
                if shutil.which(pm):
                    print(f"Found package manager: {pm}")
                    print(f"Attempting to install ADB: {install_cmd}")
                    result = subprocess.run(
                        install_cmd,
                        shell=True,
                        capture_output=True,
                        text=True
                    )
                    if result.returncode == 0:
                        return True, f"ADB installed successfully via {pm}"
                    else:
                        return False, f"Installation failed: {result.stderr}"

            return False, "No supported package manager found"

        except Exception as e:
            return False, f"Package manager installation failed: {str(e)}"

    def auto_setup_adb(self) -> Tuple[bool, str, Optional[str]]:
        """
        自动设置 ADB（扫描 -> 安装 -> 验证）

        Returns:
            (是否成功, 消息, ADB 路径)
        """
        print("=" * 60)
        print("ADB Auto Setup")
        print("=" * 60)

        # 1. 检查本地 ADB
        print("\n[1/4] Checking local ADB...")
        local_adb = self.get_local_adb_path()
        if local_adb:
            is_valid, version_or_error = self.verify_adb(str(local_adb))
            if is_valid:
                print(f"✓ Local ADB found and verified: {local_adb}")
                print(f"  {version_or_error}")
                return True, "Local ADB available", str(local_adb)
            else:
                print(f"✗ Local ADB exists but invalid: {version_or_error}")

        # 2. 扫描系统 ADB
        print("\n[2/4] Scanning system for ADB...")
        system_adbs = self.scan_system_adb()
        if system_adbs:
            print(f"✓ Found {len(system_adbs)} ADB installation(s):")
            for adb_path in system_adbs:
                is_valid, version_or_error = self.verify_adb(adb_path)
                if is_valid:
                    print(f"  ✓ {adb_path}")
                    print(f"    {version_or_error}")
                    return True, f"Using system ADB: {adb_path}", adb_path
                else:
                    print(f"  ✗ {adb_path} (invalid: {version_or_error})")

        print("✗ No valid system ADB found")

        # 3. 尝试自动安装
        print("\n[3/4] Attempting to install ADB...")

        if self.system == 'Linux':
            # Linux: 优先尝试包管理器
            print("Trying package manager installation...")
            success, message = self.try_install_via_package_manager()
            if success:
                # 重新扫描
                adb_in_path = shutil.which('adb')
                if adb_in_path:
                    return True, message, adb_in_path

        # Windows/Linux/macOS: 下载官方 platform-tools
        print("Downloading official Android Platform Tools...")
        success, message = self.download_and_install_adb()
        if success:
            local_adb = self.get_local_adb_path()
            if local_adb:
                return True, message, str(local_adb)

        # 4. 安装失败，提供手动安装指引
        print("\n[4/4] Auto-installation failed")
        print("=" * 60)
        print("Manual Installation Required")
        print("=" * 60)

        manual_instructions = self._get_manual_install_instructions()
        print(manual_instructions)

        return False, "Auto-installation failed. Please install manually.", None

    def _get_manual_install_instructions(self) -> str:
        """获取手动安装指引"""
        if self.system == 'Windows':
            return """
Please install ADB manually using one of these methods:

Method 1: Download Android Platform Tools
  1. Visit: https://developer.android.com/tools/releases/platform-tools
  2. Download 'platform-tools-latest-windows.zip'
  3. Extract to: {resources_dir}\\adb\\windows\\
  4. Restart pyMatrix

Method 2: Install Android Studio
  1. Download from: https://developer.android.com/studio
  2. Install Android Studio
  3. ADB will be available in SDK platform-tools
  4. Restart pyMatrix (auto-scan will find it)

Method 3: Use Chocolatey (if installed)
  choco install adb
""".format(resources_dir=self.resources_dir)

        elif self.system == 'Linux':
            return """
Please install ADB manually using one of these methods:

Method 1: Package Manager
  Ubuntu/Debian:  sudo apt-get install adb
  Fedora/RHEL:    sudo dnf install android-tools
  Arch:           sudo pacman -S android-tools

Method 2: Download Platform Tools
  1. Visit: https://developer.android.com/tools/releases/platform-tools
  2. Download 'platform-tools-latest-linux.zip'
  3. Extract to: {resources_dir}/adb/linux/
  4. chmod +x {resources_dir}/adb/linux/adb
  5. Restart pyMatrix

Method 3: Install Android Studio
  1. Download from: https://developer.android.com/studio
  2. Install and configure SDK
  3. Restart pyMatrix
""".format(resources_dir=self.resources_dir)

        elif self.system == 'Darwin':
            return """
Please install ADB manually using one of these methods:

Method 1: Homebrew (recommended)
  brew install android-platform-tools

Method 2: Download Platform Tools
  1. Visit: https://developer.android.com/tools/releases/platform-tools
  2. Download 'platform-tools-latest-darwin.zip'
  3. Extract to: {resources_dir}/adb/macos/
  4. chmod +x {resources_dir}/adb/macos/adb
  5. Restart pyMatrix

Method 3: Install Android Studio
  1. Download from: https://developer.android.com/studio
  2. Install and configure SDK
  3. Restart pyMatrix
""".format(resources_dir=self.resources_dir)

        return "Unsupported platform"


# 简化的 ADBInstaller 类供 main.py 使用
class ADBQuickSetup:
    """ADB 快速设置工具（简化版）"""

    @staticmethod
    def setup_and_verify(resources_dir: Optional[Path] = None) -> Tuple[bool, str, Optional[str]]:
        """
        设置并验证 ADB

        Returns:
            (是否成功, 消息, ADB 路径)
        """
        manager = ADBInstaller(resources_dir)
        return manager.auto_setup_adb()


if __name__ == "__main__":
    # 测试
    success, message, adb_path = ADBQuickSetup.setup_and_verify()
    print("\n" + "=" * 60)
    if success:
        print(f"✓ Success: {message}")
        print(f"  ADB Path: {adb_path}")
    else:
        print(f"✗ Failed: {message}")
