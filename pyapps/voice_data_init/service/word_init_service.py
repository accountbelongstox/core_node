#!/usr/bin/env python3
"""
Word Initialization Service
Handles local vocabulary file loading and synchronization
"""

from pathlib import Path
from typing import List, Set, Dict, Any

from pycore.pyfoundations.color_print import ColorPrint
from pycore.database import database_manager
from pycore.database.models import TableKeys, VoiceDictionariesModel
from pycore.pyfoundations.pygvar import CACHE_DIR


class WordInitService:
    """
    Service for initializing vocabulary data

    Handles:
    - Loading words from vocabulary files
    - Comparing with database records
    - Inserting new words into database
    - Synchronizing with remote server (if configured)
    """

    def __init__(self, db_name: str = "voice_main"):
        """
        Initialize word init service

        Args:
            db_name: Database name to use
        """
        self.db_name = db_name
        self.vocabulary_dir = Path(CACHE_DIR) / "voice_data" / "vocabulary"
        self.vocabulary_dir.mkdir(parents=True, exist_ok=True)

    def get_unique_content_lines(self, directory: Path) -> List[str]:
        """
        Get unique content lines from all text files in directory

        Args:
            directory: Directory containing vocabulary files

        Returns:
            List of unique words/phrases
        """
        unique_contents = set()

        if not directory.exists():
            ColorPrint.yellow(f"Vocabulary directory does not exist: {directory}")
            return []

        for txt_file in directory.glob("*.txt"):
            with open(txt_file, 'r', encoding='utf-8') as f:
                for line in f:
                    content = line.strip()
                    if content and not content.startswith('#'):
                        unique_contents.add(content)

        ColorPrint.green(f"Found {len(unique_contents)} unique words from {directory}")
        return sorted(list(unique_contents))

    def get_existing_contents(self) -> Set[str]:
        """
        Get all existing content from database

        Returns:
            Set of existing content strings
        """
        with database_manager.get_connection(self.db_name) as conn:
            existing = VoiceDictionariesModel.get_all_contents(conn)
            return set(existing)

    def get_diff_contents(self, file_contents: List[str]) -> List[str]:
        """
        Get difference between file contents and database

        Args:
            file_contents: List of contents from files

        Returns:
            List of new contents not in database
        """
        existing = self.get_existing_contents()
        file_set = set(file_contents)
        diff = file_set - existing

        ColorPrint.green(f"Database has {len(existing)} words")
        ColorPrint.green(f"Files have {len(file_set)} words")
        ColorPrint.yellow(f"Difference: {len(diff)} new words")

        return sorted(list(diff))

    def initialize_by_local(self):
        """
        Initialize database from local vocabulary files

        Returns:
            Number of words processed
        """
        ColorPrint.blue("Starting local word initialization...")

        words_array = self.get_unique_content_lines(self.vocabulary_dir)

        if not words_array:
            ColorPrint.yellow("No words found in vocabulary directory")
            return 0

        diff_words = self.get_diff_contents(words_array)

        if not diff_words:
            ColorPrint.green("No new words to add")
            return 0

        ColorPrint.blue(f"Inserting {len(diff_words)} new words...")

        with database_manager.get_connection(self.db_name) as conn:
            VoiceDictionariesModel.batch_insert_contents(conn, diff_words)

        ColorPrint.green(f"Successfully inserted {len(diff_words)} words")

        existing_after = self.get_existing_contents()
        ColorPrint.green(f"Total words in database: {len(existing_after)}")

        return len(diff_words)

    def initialize_by_api(self, api_url: str, client_token: str) -> Dict[str, Any]:
        """
        Synchronize local database with remote server via API

        Args:
            api_url: Remote API base URL
            client_token: Client authentication token

        Returns:
            Dictionary with sync results
        """
        ColorPrint.blue("Starting API synchronization...")

        with database_manager.get_connection(self.db_name) as conn:
            all_contents = VoiceDictionariesModel.get_all_contents(conn)

        ColorPrint.green(f"Total local words: {len(all_contents)}")

        headers = {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Client-Token': client_token
        }

        find_url = f"{api_url}/find_non_existing_dictionary"

        ColorPrint.blue(f"Checking missing entries with server: {find_url}")

        from pycore.pyfoundations.third_party import requests

        response = requests.post(
            find_url,
            json={'contents': all_contents},
            headers=headers
        )

        if response.status_code != 200:
            ColorPrint.red(f"API request failed: {response.status_code}")
            return {
                'success': False,
                'error': f"HTTP {response.status_code}"
            }

        data = response.json()
        missing_entries = data.get('missing_entries', [])
        missing_count = len(missing_entries)

        ColorPrint.yellow(f"Server is missing {missing_count} entries")

        if missing_count == 0:
            ColorPrint.green("Server is up to date")
            return {
                'success': True,
                'uploaded': 0,
                'total': len(all_contents)
            }

        add_url = f"{api_url}/add_dictionary"
        batch_size = 2000
        uploaded_count = 0

        for i in range(0, missing_count, batch_size):
            batch = missing_entries[i:i + batch_size]

            with database_manager.get_connection(self.db_name) as conn:
                entries = []
                for content in batch:
                    entry = VoiceDictionariesModel.get_by_content(conn, content)
                    if entry:
                        entries.append(entry)

            if entries:
                ColorPrint.blue(f"Uploading batch {i // batch_size + 1} ({len(entries)} entries)...")

                response = requests.post(
                    add_url,
                    json={'entries': entries},
                    headers=headers
                )

                if response.status_code == 200:
                    uploaded_count += len(entries)
                    ColorPrint.green(f"Uploaded {uploaded_count}/{missing_count}")

        ColorPrint.green(f"API sync complete. Uploaded {uploaded_count} entries")

        return {
            'success': True,
            'uploaded': uploaded_count,
            'total': len(all_contents)
        }

    def initialize_server(self):
        """
        Server-side initialization

        Runs local initialization first
        """
        ColorPrint.blue("=== Server Initialization ===")
        self.initialize_by_local()
        ColorPrint.green("Server initialization complete")
