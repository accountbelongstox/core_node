#!/usr/bin/env python3
"""
Word Validity Check Service
Validates words using various providers (OpenAI, dictionary APIs, etc.)
"""

from typing import Dict, List, Optional
from pathlib import Path
import json

from pycore.pyfoundations.color_print import ColorPrint
from pycore.pyfoundations.third_party import get_third_package_requests

requests = get_third_package_requests()
from pycore.database import database_manager
from pycore.database.models import VoiceDictionariesModel
from pycore.pygvar import CACHE_DIR


class WordValidityService:
    """
    Service for checking word validity

    Handles:
    - Loading cached validity data
    - Checking words via OpenAI
    - Checking words via dictionary APIs
    - Updating database with results
    """

    def __init__(self, db_name: str = "voice_main"):
        """
        Initialize validity service

        Args:
            db_name: Database name to use
        """
        self.db_name = db_name
        self.validity_cache_file = Path(CACHE_DIR) / "voice_data" / "word_validity_cache.json"
        self.validity_cache_file.parent.mkdir(parents=True, exist_ok=True)
        self.validity_cache = {}
        self.load_validity_cache()

    def load_validity_cache(self):
        """
        Load cached validity data from file
        """
        if self.validity_cache_file.exists():
            with open(self.validity_cache_file, 'r', encoding='utf-8') as f:
                self.validity_cache = json.load(f)
            ColorPrint.green(f"Loaded {len(self.validity_cache)} cached validity records")
        else:
            ColorPrint.yellow("No validity cache file found")

    def save_validity_cache(self):
        """
        Save validity cache to file
        """
        with open(self.validity_cache_file, 'w', encoding='utf-8') as f:
            json.dump(self.validity_cache, f, indent=2)
        ColorPrint.green(f"Saved {len(self.validity_cache)} validity records to cache")

    def check_validity_openai(self, content: str, api_key: str) -> Dict:
        """
        Check word validity using OpenAI

        Args:
            content: Word or phrase to check
            api_key: OpenAI API key

        Returns:
            Dictionary with is_valid and provider
        """
        if content in self.validity_cache:
            ColorPrint.yellow(f"Using cached result for: {content}")
            return self.validity_cache[content]

        ColorPrint.blue(f"Checking validity with OpenAI: {content}")

        headers = {
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json'
        }

        payload = {
            'model': 'gpt-3.5-turbo',
            'messages': [
                {
                    'role': 'user',
                    'content': f'Is "{content}" a valid English word? Please respond with only "true" or "false".'
                }
            ],
            'temperature': 0
        }

        response = requests.post(
            'https://api.openai.com/v1/chat/completions',
            headers=headers,
            json=payload
        )

        if response.status_code != 200:
            ColorPrint.red(f"OpenAI API error: {response.status_code}")
            return {'is_valid': False, 'provider': 'openai', 'error': f"HTTP {response.status_code}"}

        data = response.json()
        answer = data['choices'][0]['message']['content'].lower()

        is_valid = 'true' in answer

        result = {
            'is_valid': is_valid,
            'provider': 'openai'
        }

        self.validity_cache[content] = result

        return result

    def check_validity_dictionary_api(self, content: str) -> Dict:
        """
        Check word validity using free dictionary API

        Args:
            content: Word to check

        Returns:
            Dictionary with is_valid and provider
        """
        if content in self.validity_cache:
            return self.validity_cache[content]

        ColorPrint.blue(f"Checking validity with Dictionary API: {content}")

        url = f"https://api.dictionaryapi.dev/api/v2/entries/en/{content}"

        response = requests.get(url)

        is_valid = response.status_code == 200

        result = {
            'is_valid': is_valid,
            'provider': 'dictionary_api'
        }

        self.validity_cache[content] = result

        return result

    def check_all_unvalidated(self, provider: str = "dictionary_api", openai_key: Optional[str] = None, limit: int = 100):
        """
        Check all unvalidated words in database

        Args:
            provider: Validity check provider ('openai' or 'dictionary_api')
            openai_key: OpenAI API key (required if provider is 'openai')
            limit: Maximum number of words to check
        """
        ColorPrint.blue("=== Word Validity Check ===")

        with database_manager.get_connection(self.db_name) as conn:
            unvalidated = VoiceDictionariesModel.get_unvalidated(conn, limit=limit)

        ColorPrint.green(f"Found {len(unvalidated)} unvalidated words")

        if not unvalidated:
            ColorPrint.green("All words are validated")
            return

        checked_count = 0

        for entry in unvalidated:
            content = entry['content']

            if provider == 'openai':
                if not openai_key:
                    ColorPrint.red("OpenAI API key required for OpenAI provider")
                    break
                result = self.check_validity_openai(content, openai_key)
            else:
                result = self.check_validity_dictionary_api(content)

            is_valid = result['is_valid']
            provider_name = result['provider']

            with database_manager.get_connection(self.db_name) as conn:
                VoiceDictionariesModel.update_validity(conn, content, is_valid, provider_name)

            checked_count += 1
            status = "VALID" if is_valid else "INVALID"
            ColorPrint.green(f"[{checked_count}/{len(unvalidated)}] {content}: {status}")

        self.save_validity_cache()

        ColorPrint.green(f"Validity check complete: {checked_count} words processed")
