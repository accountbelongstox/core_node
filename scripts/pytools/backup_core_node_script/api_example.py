#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
API Usage Examples
Demonstrates how to use the File Sync Tool API programmatically
"""

import requests
import json
from typing import List, Dict


class FileSyncAPI:
    """
    Wrapper class for File Sync Tool API
    Makes it easy to interact with the server programmatically
    """

    def __init__(self, server_url: str):
        """
        Initialize API client

        Args:
            server_url: Server URL (e.g., http://192.168.1.100:8888)
        """
        self.server_url = server_url.rstrip('/')

    def get_file_tree(self) -> Dict:
        """
        Get complete file tree from server

        Returns:
            Dictionary with 'total_files' and 'files' list
        """
        response = requests.get(f"{self.server_url}/api/tree")
        response.raise_for_status()
        return response.json()

    def list_directory(self, path: str = "") -> Dict:
        """
        List contents of a directory

        Args:
            path: Directory path (empty for root)

        Returns:
            Dictionary with 'path' and 'items' list
        """
        response = requests.get(f"{self.server_url}/api/list", params={"path": path})
        response.raise_for_status()
        return response.json()

    def download_file(self, remote_path: str, local_path: str) -> bool:
        """
        Download a single file

        Args:
            remote_path: Path on server
            local_path: Local destination path

        Returns:
            True if successful, False otherwise
        """
        try:
            response = requests.get(
                f"{self.server_url}/api/download",
                params={"path": remote_path},
                stream=True
            )
            response.raise_for_status()

            with open(local_path, 'wb') as f:
                for chunk in response.iter_content(chunk_size=8192):
                    if chunk:
                        f.write(chunk)

            return True
        except Exception as e:
            print(f"Error downloading {remote_path}: {e}")
            return False

    def get_file_count(self) -> int:
        """Get total number of files on server"""
        data = self.get_file_tree()
        return data.get("total_files", 0)

    def search_files(self, pattern: str) -> List[Dict]:
        """
        Search for files matching a pattern

        Args:
            pattern: Search pattern (case-insensitive)

        Returns:
            List of matching file info dictionaries
        """
        data = self.get_file_tree()
        pattern_lower = pattern.lower()
        return [
            f for f in data.get("files", [])
            if pattern_lower in f["path"].lower()
        ]

    def get_files_by_extension(self, extension: str) -> List[Dict]:
        """
        Get all files with specific extension

        Args:
            extension: File extension (e.g., '.txt', '.jpg')

        Returns:
            List of matching file info dictionaries
        """
        if not extension.startswith('.'):
            extension = '.' + extension

        data = self.get_file_tree()
        return [
            f for f in data.get("files", [])
            if f["path"].lower().endswith(extension.lower())
        ]

    def calculate_total_size(self) -> int:
        """
        Calculate total size of all files on server

        Returns:
            Total size in bytes
        """
        data = self.get_file_tree()
        return sum(f.get("size", 0) for f in data.get("files", []))


# =============================================================================
# Usage Examples
# =============================================================================

def example_1_get_file_list():
    """Example 1: Get and display file list"""
    print("=" * 60)
    print("Example 1: Get File List")
    print("=" * 60)

    api = FileSyncAPI("http://192.168.1.100:8888")

    try:
        data = api.get_file_tree()
        print(f"\nTotal files: {data['total_files']}")
        print("\nFirst 10 files:")

        for i, file_info in enumerate(data['files'][:10], 1):
            size_mb = file_info['size'] / (1024 * 1024)
            print(f"  {i}. {file_info['path']} ({size_mb:.2f} MB)")

    except Exception as e:
        print(f"Error: {e}")


def example_2_search_files():
    """Example 2: Search for specific files"""
    print("\n" + "=" * 60)
    print("Example 2: Search Files")
    print("=" * 60)

    api = FileSyncAPI("http://192.168.1.100:8888")

    try:
        # Search for all .txt files
        txt_files = api.get_files_by_extension(".txt")
        print(f"\nFound {len(txt_files)} .txt files")

        # Search for files containing 'config'
        config_files = api.search_files("config")
        print(f"Found {len(config_files)} files containing 'config'")

        if config_files:
            print("\nConfig files:")
            for f in config_files[:5]:
                print(f"  - {f['path']}")

    except Exception as e:
        print(f"Error: {e}")


def example_3_download_specific_files():
    """Example 3: Download specific files"""
    print("\n" + "=" * 60)
    print("Example 3: Download Specific Files")
    print("=" * 60)

    api = FileSyncAPI("http://192.168.1.100:8888")

    try:
        # Find all .conf files
        conf_files = api.get_files_by_extension(".conf")
        print(f"\nFound {len(conf_files)} .conf files")

        # Download first 3
        for i, file_info in enumerate(conf_files[:3], 1):
            remote_path = file_info['path']
            local_path = f"./download_{i}.conf"

            print(f"\nDownloading: {remote_path}")
            success = api.download_file(remote_path, local_path)

            if success:
                print(f"  ✓ Saved to: {local_path}")
            else:
                print(f"  ✗ Failed")

    except Exception as e:
        print(f"Error: {e}")


def example_4_calculate_statistics():
    """Example 4: Calculate file statistics"""
    print("\n" + "=" * 60)
    print("Example 4: Calculate Statistics")
    print("=" * 60)

    api = FileSyncAPI("http://192.168.1.100:8888")

    try:
        # Get all files
        data = api.get_file_tree()
        files = data['files']

        # Calculate statistics
        total_files = len(files)
        total_size = sum(f['size'] for f in files)
        avg_size = total_size / total_files if total_files > 0 else 0

        # Group by extension
        extensions = {}
        for f in files:
            ext = f['path'].split('.')[-1].lower() if '.' in f['path'] else 'no_ext'
            extensions[ext] = extensions.get(ext, 0) + 1

        # Display
        print(f"\nTotal Files: {total_files}")
        print(f"Total Size: {total_size / (1024**3):.2f} GB")
        print(f"Average File Size: {avg_size / (1024**2):.2f} MB")

        print("\nTop 10 File Types:")
        sorted_ext = sorted(extensions.items(), key=lambda x: x[1], reverse=True)
        for ext, count in sorted_ext[:10]:
            print(f"  .{ext}: {count} files")

    except Exception as e:
        print(f"Error: {e}")


def example_5_list_directory():
    """Example 5: Navigate directory structure"""
    print("\n" + "=" * 60)
    print("Example 5: Navigate Directory Structure")
    print("=" * 60)

    api = FileSyncAPI("http://192.168.1.100:8888")

    try:
        # List root directory
        print("\nRoot Directory:")
        data = api.list_directory("")

        folders = [item for item in data['items'] if item['is_dir']]
        files = [item for item in data['items'] if not item['is_dir']]

        print(f"  Folders: {len(folders)}")
        for folder in folders[:5]:
            print(f"    📁 {folder['name']}")

        print(f"\n  Files: {len(files)}")
        for file in files[:5]:
            size_mb = file['size'] / (1024 * 1024)
            print(f"    📄 {file['name']} ({size_mb:.2f} MB)")

    except Exception as e:
        print(f"Error: {e}")


def main():
    """Run all examples"""
    print("\n")
    print("=" * 60)
    print("File Sync Tool - API Usage Examples")
    print("=" * 60)
    print("\nNOTE: Make sure server is running before running examples")
    print("Update server URL in examples if needed\n")

    try:
        example_1_get_file_list()
        example_2_search_files()
        example_3_download_specific_files()
        example_4_calculate_statistics()
        example_5_list_directory()

        print("\n" + "=" * 60)
        print("All examples completed!")
        print("=" * 60 + "\n")

    except KeyboardInterrupt:
        print("\n\nExamples interrupted by user")
    except Exception as e:
        print(f"\n\nError running examples: {e}")


if __name__ == "__main__":
    main()
