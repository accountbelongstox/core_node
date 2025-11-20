"""
pyMatrix Initialization Script

This script downloads and sets up all required dependencies:
- ADB (Android Debug Bridge) for device communication
- scrcpy-server v3.3.3 for Android screen mirroring

Usage:
    python init.py [--force] [--adb-only] [--server-only]

Options:
    --force         Force re-download even if files exist
    --adb-only      Only download ADB
    --server-only   Only download scrcpy-server
"""

import argparse
import hashlib
import platform
import shutil
import sys
import zipfile
from pathlib import Path
from typing import Optional

try:
    import requests
except ImportError:
    print("ERROR: 'requests' module not found. Installing...")
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "requests"])
    import requests


class PyMatrixInit:
    """pyMatrix initialization manager"""

    # ==================== Version Configuration ====================
    # Must match scrcpy_source version
    SCRCPY_VERSION = "3.3.3"
    ADB_VERSION = "36.0.0"

    # ==================== Download URLs ====================
    SCRCPY_SERVER_URL = f"https://github.com/Genymobile/scrcpy/releases/download/v{SCRCPY_VERSION}/scrcpy-server-v{SCRCPY_VERSION}"

    # ADB platform tools URLs (from scrcpy_source/app/deps/adb_*.sh)
    ADB_URLS = {
        "Windows": f"https://dl.google.com/android/repository/platform-tools_r{ADB_VERSION}-windows.zip",
        "Linux": f"https://dl.google.com/android/repository/platform-tools_r{ADB_VERSION}-linux.zip",
        "Darwin": f"https://dl.google.com/android/repository/platform-tools_r{ADB_VERSION}-darwin.zip",  # macOS
    }

    # SHA256 checksums (from scrcpy_source/app/deps/adb_*.sh)
    ADB_CHECKSUMS = {
        "Windows": "12c2841f354e92a0eb2fd7bf6f0f9bf8538abce7bd6b060ac8349d6f6a61107c",
        # Add Linux/macOS checksums if needed
    }

    def __init__(self, force: bool = False):
        """
        Initialize pyMatrix setup

        Args:
            force: Force re-download even if files exist
        """
        self.force = force
        self.project_root = Path(__file__).parent
        self.resources_dir = self.project_root / "resources"
        self.adb_dir = self.resources_dir / "adb"

        # Create directories
        self.resources_dir.mkdir(exist_ok=True)
        self.adb_dir.mkdir(exist_ok=True)

    def verify_checksum(self, file_path: Path, expected_sha256: str) -> bool:
        """
        Verify file SHA256 checksum

        Args:
            file_path: Path to file
            expected_sha256: Expected SHA256 hash

        Returns:
            True if checksum matches
        """
        sha256 = hashlib.sha256()
        with open(file_path, 'rb') as f:
            for chunk in iter(lambda: f.read(8192), b''):
                sha256.update(chunk)

        actual = sha256.hexdigest()
        if actual != expected_sha256:
            print(f"  ⚠️  Checksum mismatch!")
            print(f"     Expected: {expected_sha256}")
            print(f"     Actual:   {actual}")
            return False
        return True

    def download_file(self, url: str, dest_path: Path, description: str,
                     expected_checksum: Optional[str] = None) -> bool:
        """
        Download file with progress bar

        Args:
            url: Download URL
            dest_path: Destination file path
            description: File description for display
            expected_checksum: Optional SHA256 checksum for verification

        Returns:
            True if download successful
        """
        try:
            print(f"\n{'='*60}")
            print(f"Downloading {description}")
            print(f"{'='*60}")
            print(f"URL: {url}")
            print(f"Destination: {dest_path}")

            # Check if file exists and skip if not forcing
            if dest_path.exists() and not self.force:
                print(f"✅ {description} already exists (use --force to re-download)")

                # Verify checksum if provided
                if expected_checksum:
                    print(f"Verifying checksum...")
                    if self.verify_checksum(dest_path, expected_checksum):
                        print(f"✅ Checksum verified")
                    else:
                        print(f"⚠️  Checksum verification failed, re-downloading...")
                        dest_path.unlink()
                        return self.download_file(url, dest_path, description, expected_checksum)
                return True

            # Download with progress
            print(f"Downloading...")
            response = requests.get(url, stream=True)
            response.raise_for_status()

            total_size = int(response.headers.get('content-length', 0))
            downloaded = 0

            with open(dest_path, 'wb') as f:
                for chunk in response.iter_content(chunk_size=8192):
                    if chunk:
                        f.write(chunk)
                        downloaded += len(chunk)

                        if total_size > 0:
                            progress = (downloaded / total_size) * 100
                            bar_length = 50
                            filled = int(bar_length * downloaded / total_size)
                            bar = '█' * filled + '░' * (bar_length - filled)
                            print(f"\r[{bar}] {progress:.1f}% ({downloaded}/{total_size} bytes)", end='')

            print()  # New line after progress
            print(f"✅ Download complete")
            print(f"   Size: {dest_path.stat().st_size / 1024 / 1024:.2f} MB")

            # Verify checksum if provided
            if expected_checksum:
                print(f"Verifying checksum...")
                if self.verify_checksum(dest_path, expected_checksum):
                    print(f"✅ Checksum verified")
                else:
                    print(f"❌ Checksum verification failed!")
                    dest_path.unlink()
                    return False

            return True

        except requests.RequestException as e:
            print(f"\n❌ Download failed: {e}")
            if dest_path.exists():
                dest_path.unlink()
            return False
        except Exception as e:
            print(f"\n❌ Error: {e}")
            if dest_path.exists():
                dest_path.unlink()
            return False

    def download_scrcpy_server(self) -> bool:
        """
        Download scrcpy-server JAR

        Returns:
            True if successful
        """
        dest_file = self.resources_dir / "scrcpy-server.jar"

        success = self.download_file(
            self.SCRCPY_SERVER_URL,
            dest_file,
            f"scrcpy-server v{self.SCRCPY_VERSION}"
        )

        if success:
            print(f"\n{'='*60}")
            print(f"✅ scrcpy-server v{self.SCRCPY_VERSION} ready")
            print(f"   Location: {dest_file}")
            print(f"{'='*60}\n")

        return success

    def download_adb(self) -> bool:
        """
        Download ADB platform tools for current OS

        Returns:
            True if successful
        """
        system = platform.system()

        if system not in self.ADB_URLS:
            print(f"❌ Unsupported platform: {system}")
            print(f"   Supported: {', '.join(self.ADB_URLS.keys())}")
            return False

        # Determine platform-specific paths
        if system == "Windows":
            platform_dir = self.adb_dir / "windows"
            zip_name = f"platform-tools_r{self.ADB_VERSION}-windows.zip"
            adb_files = ["adb.exe", "AdbWinApi.dll", "AdbWinUsbApi.dll"]
        elif system == "Darwin":  # macOS
            platform_dir = self.adb_dir / "macos"
            zip_name = f"platform-tools_r{self.ADB_VERSION}-darwin.zip"
            adb_files = ["adb"]
        else:  # Linux
            platform_dir = self.adb_dir / "linux"
            zip_name = f"platform-tools_r{self.ADB_VERSION}-linux.zip"
            adb_files = ["adb"]

        platform_dir.mkdir(exist_ok=True)
        zip_path = self.resources_dir / zip_name

        # Check if ADB already exists
        adb_exe = platform_dir / adb_files[0]
        if adb_exe.exists() and not self.force:
            print(f"\n{'='*60}")
            print(f"✅ ADB already exists (use --force to re-download)")
            print(f"   Version: {self.ADB_VERSION}")
            print(f"   Location: {platform_dir}")
            print(f"{'='*60}\n")
            return True

        # Download ADB zip
        expected_checksum = self.ADB_CHECKSUMS.get(system)
        success = self.download_file(
            self.ADB_URLS[system],
            zip_path,
            f"ADB platform-tools v{self.ADB_VERSION} ({system})",
            expected_checksum
        )

        if not success:
            return False

        # Extract ADB files
        try:
            print(f"\nExtracting ADB files...")
            with zipfile.ZipFile(zip_path, 'r') as zip_ref:
                # Extract only required files
                for file in adb_files:
                    member_path = f"platform-tools/{file}"
                    try:
                        zip_ref.extract(member_path, self.resources_dir)
                        src = self.resources_dir / "platform-tools" / file
                        dst = platform_dir / file
                        shutil.move(str(src), str(dst))

                        # Make executable on Unix-like systems
                        if system != "Windows":
                            dst.chmod(0o755)

                        print(f"  ✅ Extracted: {file}")
                    except KeyError:
                        print(f"  ⚠️  File not found in zip: {member_path}")

            # Cleanup
            platform_tools_dir = self.resources_dir / "platform-tools"
            if platform_tools_dir.exists():
                shutil.rmtree(platform_tools_dir)
            zip_path.unlink()

            print(f"\n{'='*60}")
            print(f"✅ ADB v{self.ADB_VERSION} ready")
            print(f"   Location: {platform_dir}")
            print(f"   Files: {', '.join(adb_files)}")
            print(f"{'='*60}\n")

            return True

        except Exception as e:
            print(f"\n❌ Failed to extract ADB: {e}")
            return False

    def init_all(self) -> bool:
        """
        Initialize all dependencies

        Returns:
            True if all downloads successful
        """
        print("\n" + "="*60)
        print("pyMatrix Initialization")
        print(f"scrcpy version: {self.SCRCPY_VERSION}")
        print(f"ADB version: {self.ADB_VERSION}")
        print("="*60 + "\n")

        success = True

        # Download scrcpy-server
        if not self.download_scrcpy_server():
            success = False
            print("⚠️  scrcpy-server download failed")

        # Download ADB
        if not self.download_adb():
            success = False
            print("⚠️  ADB download failed")

        # Summary
        print("\n" + "="*60)
        if success:
            print("✅ All dependencies initialized successfully!")
            print("\nNext steps:")
            print("  1. Ensure USB debugging is enabled on your device")
            print("  2. Connect your device via USB")
            print("  3. Run: python poly_apps/pyMatrix/main.py")
        else:
            print("❌ Some dependencies failed to download")
            print("   Please check the errors above and try again")
        print("="*60 + "\n")

        return success


def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(
        description="pyMatrix initialization script - downloads all required dependencies"
    )
    parser.add_argument(
        '--force',
        action='store_true',
        help='Force re-download even if files exist'
    )
    parser.add_argument(
        '--adb-only',
        action='store_true',
        help='Only download ADB'
    )
    parser.add_argument(
        '--server-only',
        action='store_true',
        help='Only download scrcpy-server'
    )

    args = parser.parse_args()

    initializer = PyMatrixInit(force=args.force)

    if args.adb_only:
        success = initializer.download_adb()
    elif args.server_only:
        success = initializer.download_scrcpy_server()
    else:
        success = initializer.init_all()

    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
