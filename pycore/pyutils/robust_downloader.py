#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Robust File Downloader

Supports:
- Multiple retry attempts with exponential backoff
- Partial/resume downloads (if server supports Range)
- Progress callback
- Timeout handling
- Automatic cleanup on failure
"""

import time
import urllib.request
import urllib.error
from pathlib import Path
from typing import Optional, Callable


class RobustDownloader:
    """
    Robust file downloader with retry and resume support
    """

    def __init__(
        self,
        max_retries: int = 5,
        timeout: int = 30,
        chunk_size: int = 8192,
        retry_delay: float = 1.0,
        max_retry_delay: float = 60.0
    ):
        """
        Initialize downloader

        Args:
            max_retries: Maximum retry attempts (default: 5)
            timeout: Download timeout in seconds (default: 30)
            chunk_size: Download chunk size in bytes (default: 8192)
            retry_delay: Initial retry delay in seconds (default: 1.0)
            max_retry_delay: Maximum retry delay in seconds (default: 60.0)
        """
        self.max_retries = max_retries
        self.timeout = timeout
        self.chunk_size = chunk_size
        self.retry_delay = retry_delay
        self.max_retry_delay = max_retry_delay

    def download(
        self,
        url: str,
        dest_path: Path,
        progress_callback: Optional[Callable[[int, int, int], None]] = None,
        resume: bool = True
    ) -> bool:
        """
        Download file from URL with retry support

        Args:
            url: Download URL
            dest_path: Destination file path
            progress_callback: Optional callback(downloaded, total, attempt)
            resume: Enable resume/partial download (default: True)

        Returns:
            True if download successful, False otherwise
        """
        dest_path = Path(dest_path)
        temp_path = dest_path.with_suffix(dest_path.suffix + '.download')

        # Create parent directory
        dest_path.parent.mkdir(parents=True, exist_ok=True)

        attempt = 0
        while attempt < self.max_retries:
            attempt += 1

            try:
                # Check existing partial download
                start_byte = 0
                if resume and temp_path.exists():
                    start_byte = temp_path.stat().st_size
                    print(f"[RobustDownloader] Resuming from {start_byte} bytes")

                # Create request with Range header for resume
                request = urllib.request.Request(url)
                if start_byte > 0:
                    request.add_header('Range', f'bytes={start_byte}-')

                # Open connection
                with urllib.request.urlopen(request, timeout=self.timeout) as response:
                    # Get total size
                    content_range = response.headers.get('Content-Range')
                    content_length = response.headers.get('Content-Length')

                    if content_range:
                        # Server supports Range, parse total size
                        # Format: "bytes start-end/total"
                        total_size = int(content_range.split('/')[-1])
                    elif content_length:
                        total_size = int(content_length)
                        if start_byte > 0:
                            # Server doesn't support Range, restart download
                            print(f"[RobustDownloader] Server doesn't support resume, restarting...")
                            if temp_path.exists():
                                temp_path.unlink()
                            start_byte = 0
                            total_size = int(content_length)
                    else:
                        total_size = 0

                    # Download file
                    downloaded = start_byte
                    mode = 'ab' if start_byte > 0 else 'wb'

                    with open(temp_path, mode) as f:
                        while True:
                            chunk = response.read(self.chunk_size)
                            if not chunk:
                                break

                            f.write(chunk)
                            downloaded += len(chunk)

                            # Progress callback
                            if progress_callback:
                                progress_callback(downloaded, total_size, attempt)

                    # Verify download completeness
                    if total_size > 0 and downloaded < total_size:
                        raise IOError(f"Incomplete download: {downloaded}/{total_size} bytes")

                    # Success - move temp to final destination
                    if dest_path.exists():
                        dest_path.unlink()
                    temp_path.rename(dest_path)

                    print(f"\n[RobustDownloader] ✓ Download complete: {dest_path.name} ({downloaded} bytes)")
                    return True

            except urllib.error.HTTPError as e:
                if e.code == 416:  # Range Not Satisfiable
                    # File already fully downloaded
                    if temp_path.exists() and temp_path.stat().st_size > 0:
                        if dest_path.exists():
                            dest_path.unlink()
                        temp_path.rename(dest_path)
                        print(f"[RobustDownloader] ✓ File already downloaded")
                        return True
                    else:
                        # Restart download
                        if temp_path.exists():
                            temp_path.unlink()
                        print(f"[RobustDownloader] Range error, restarting download...")
                        continue

                print(f"[RobustDownloader] HTTP error {e.code}: {e.reason}")

            except (urllib.error.URLError, IOError, OSError) as e:
                print(f"[RobustDownloader] Download error: {e}")

            except Exception as e:
                print(f"[RobustDownloader] Unexpected error: {e}")
                import traceback
                traceback.print_exc()

            # Retry with exponential backoff
            if attempt < self.max_retries:
                delay = min(self.retry_delay * (2 ** (attempt - 1)), self.max_retry_delay)
                print(f"[RobustDownloader] Retry {attempt}/{self.max_retries} in {delay:.1f}s...")
                time.sleep(delay)
            else:
                print(f"[RobustDownloader] ✗ Download failed after {self.max_retries} attempts")

        # Cleanup temp file on failure
        if temp_path.exists():
            temp_path.unlink()

        return False


def download_with_progress(
    url: str,
    dest_path: Path,
    max_retries: int = 5,
    show_progress: bool = True
) -> bool:
    """
    Convenience function to download with default progress display

    Args:
        url: Download URL
        dest_path: Destination file path
        max_retries: Maximum retry attempts (default: 5)
        show_progress: Show progress bar (default: True)

    Returns:
        True if download successful
    """
    downloader = RobustDownloader(max_retries=max_retries)

    def progress_callback(downloaded: int, total: int, attempt: int):
        if show_progress and total > 0:
            percent = (downloaded / total) * 100
            mb_downloaded = downloaded / 1024 / 1024
            mb_total = total / 1024 / 1024
            print(f"\r[Download] Attempt {attempt}/{max_retries}: {percent:.1f}% ({mb_downloaded:.1f}/{mb_total:.1f} MB)", end='')

    return downloader.download(url, dest_path, progress_callback)


__all__ = ['RobustDownloader', 'download_with_progress']
