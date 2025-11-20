"""
File Transfer Client Module
Downloads files from FileTransferServer with resume support
"""

import time
from pathlib import Path
from typing import Dict

try:
    import requests
except ImportError:
    print("Warning: requests not installed, client mode will be disabled")
    print("Please run: pip install requests")
    requests = None


class FileTransferClient:
    """File Transfer Client - Download files from server with resume support"""

    def __init__(self, server_url: str, target_dir: Path):
        if requests is None:
            raise ImportError("requests library not installed. Please run: pip install requests")

        self.server_url = server_url.rstrip('/')
        self.target_dir = target_dir

        # Configure session with retry and timeout settings
        self.session = requests.Session()
        self.session.headers.update({'User-Agent': 'FileTransferClient/1.0'})

        # Configure connection pool
        adapter = requests.adapters.HTTPAdapter(
            pool_connections=10,
            pool_maxsize=10,
            max_retries=0  # We handle retries manually
        )
        self.session.mount('http://', adapter)
        self.session.mount('https://', adapter)

    def download_file_map(self) -> Dict:
        """Download file map from server"""
        try:
            print(f"Downloading file map from {self.server_url}/api/files...")
            response = self.session.get(f"{self.server_url}/api/files", timeout=30)
            response.raise_for_status()

            file_map = response.json()
            print(f"✓ File map downloaded: {len(file_map['files'])} files")
            return file_map

        except Exception as e:
            print(f"Failed to download file map: {e}")
            raise

    def download_file(self, rel_path: str, file_info: Dict, max_retries: int = 3) -> bool:
        """Download single file with resume support and retry mechanism"""
        for attempt in range(max_retries):
            try:
                target_path = self.target_dir / rel_path
                target_path.parent.mkdir(parents=True, exist_ok=True)

                expected_size = file_info['size']

                # Check if file exists and is complete
                if target_path.exists():
                    current_size = target_path.stat().st_size

                    # File size matches, skip download
                    if current_size == expected_size:
                        print(f"  ✓ File already downloaded (size matches): {rel_path}")
                        return True

                    # File incomplete, resume download
                    elif current_size < expected_size:
                        print(f"  Resuming download from byte {current_size}...")
                    else:
                        # File size is larger, delete and re-download
                        print(f"  File corrupted (size mismatch), re-downloading...")
                        target_path.unlink()
                        current_size = 0
                else:
                    current_size = 0

                # Download file
                url = f"{self.server_url}/download/{rel_path}"
                headers = {}

                if current_size > 0:
                    headers['Range'] = f'bytes={current_size}-'
                    mode = 'ab'  # Append mode
                else:
                    mode = 'wb'  # Write mode

                print(f"  Downloading: {rel_path} ({self._format_size(expected_size)})")
                if attempt > 0:
                    print(f"  Retry attempt {attempt + 1}/{max_retries}")

                # Increase timeout for large files
                timeout = 60 if expected_size < 100 * 1024 * 1024 else 300  # 60s or 5min

                response = self.session.get(url, headers=headers, stream=True, timeout=timeout)
                response.raise_for_status()

                # Download with progress
                downloaded = current_size
                chunk_size = 262144  # 256KB chunks for better performance
                start_time = time.time()
                last_progress_time = start_time
                progress_interval = 10 * 1024 * 1024  # Show progress every 10MB

                # Use larger buffer for file writing (256KB)
                with open(target_path, mode, buffering=262144) as f:
                    for chunk in response.iter_content(chunk_size=chunk_size):
                        if chunk:
                            f.write(chunk)
                            downloaded += len(chunk)

                            # Show progress every 5 seconds or every 10MB
                            current_time = time.time()
                            if (current_time - last_progress_time >= 5.0) or (downloaded % progress_interval < chunk_size):
                                progress = (downloaded / expected_size * 100) if expected_size > 0 else 0
                                elapsed = current_time - start_time
                                speed = (downloaded - current_size) / elapsed if elapsed > 0 else 0
                                print(f"    Progress: {progress:.1f}% ({self._format_size(downloaded)}/{self._format_size(expected_size)}) - {self._format_size(speed)}/s")
                                last_progress_time = current_time

                # Verify downloaded file (size only)
                final_size = target_path.stat().st_size
                if final_size != expected_size:
                    print(f"  ✗ Size mismatch after download (expected: {expected_size}, got: {final_size})")
                    if attempt < max_retries - 1:
                        print(f"  Retrying...")
                        continue
                    return False

                elapsed = time.time() - start_time
                speed = (final_size - current_size) / elapsed if elapsed > 0 else 0
                print(f"  ✓ Downloaded successfully in {elapsed:.1f}s (avg {self._format_size(speed)}/s)")
                return True

            except (requests.exceptions.ConnectionError, requests.exceptions.Timeout,
                    requests.exceptions.ChunkedEncodingError) as e:
                print(f"  ✗ Connection error: {e}")
                if attempt < max_retries - 1:
                    wait_time = 2 ** attempt  # Exponential backoff: 1s, 2s, 4s
                    print(f"  Waiting {wait_time}s before retry...")
                    time.sleep(wait_time)
                    continue
                else:
                    print(f"  ✗ Failed after {max_retries} attempts")
                    return False

            except Exception as e:
                print(f"  ✗ Failed to download {rel_path}: {e}")
                if attempt < max_retries - 1:
                    print(f"  Retrying...")
                    time.sleep(1)
                    continue
                return False

        return False

    def download_all(self):
        """Download all files from server"""
        print(f"\n{'='*60}")
        print(f"Starting File Transfer Client")
        print(f"{'='*60}")
        print(f"Server: {self.server_url}")
        print(f"Target: {self.target_dir}")
        print(f"{'='*60}\n")

        try:
            # Download file map
            file_map = self.download_file_map()
            total_files = len(file_map['files'])

            if total_files == 0:
                print("No files to download!")
                return

            print(f"\nStarting download of {total_files} files...\n")

            # Download each file
            success = 0
            failed = 0
            skipped = 0

            for idx, (rel_path, file_info) in enumerate(file_map['files'].items(), 1):
                print(f"\n[{idx}/{total_files}] {rel_path}")

                if self.download_file(rel_path, file_info):
                    success += 1
                else:
                    failed += 1

            # Summary
            print(f"\n{'='*60}")
            print(f"Download Completed")
            print(f"{'='*60}")
            print(f"  Total: {total_files}")
            print(f"  Success: {success}")
            print(f"  Failed: {failed}")
            print(f"{'='*60}")

        except Exception as e:
            print(f"\nDownload failed: {e}")

    def _format_size(self, size_bytes: int) -> str:
        """Format file size"""
        for unit in ['B', 'KB', 'MB', 'GB']:
            if size_bytes < 1024.0:
                return f"{size_bytes:.1f}{unit}"
            size_bytes /= 1024.0
        return f"{size_bytes:.1f}TB"
