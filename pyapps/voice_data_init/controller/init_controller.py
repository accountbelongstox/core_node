#!/usr/bin/env python3
"""
Initialization Controller
Main controller for voice data initialization
"""

from pycore.pyfoundations.color_print import ColorPrint
from pycore.database import database_manager, DATABASE_AVAILABLE
from pycore.database.models import TableKeys, VoiceDictionariesModel, VoiceCacheDbDoneModel

from pyapps.voice_data_init.service.word_init_service import WordInitService
from pyapps.voice_data_init.service.olddb_import_service import OldDbImportService
from pyapps.voice_data_init.service.word_validity_service import WordValidityService


class InitController:
    """
    Main controller for data initialization

    Orchestrates:
    - Database setup
    - Word initialization
    - Old database import
    - Validity checking
    """

    def __init__(self, db_name: str = "voice_main"):
        """
        Initialize controller

        Args:
            db_name: Database name to use
        """
        self.db_name = db_name
        self.word_service = WordInitService(db_name)
        self.olddb_service = OldDbImportService(db_name)
        self.validity_service = WordValidityService(db_name)

    def setup_database(self):
        """
        Setup database and tables
        """
        ColorPrint.blue("=== Database Setup ===")

        if not DATABASE_AVAILABLE:
            ColorPrint.red("Database system not available")
            return False

        database_manager.register_database(self.db_name)

        database_manager.load_tables(
            table_keys=[TableKeys.VOICE_DICTIONARIES, TableKeys.VOICE_CACHE_DB_DONE],
            models=[VoiceDictionariesModel, VoiceCacheDbDoneModel],
            db_name=self.db_name
        )

        ColorPrint.green("Database setup complete")
        return True

    def initialize_words_local(self):
        """
        Initialize words from local files
        """
        ColorPrint.blue("\n=== Local Word Initialization ===")
        count = self.word_service.initialize_by_local()
        ColorPrint.green(f"Initialized {count} words from local files")
        return count

    def import_old_databases(self, db_url: str = None):
        """
        Import old/legacy databases

        Args:
            db_url: Optional URL to download database from
        """
        ColorPrint.blue("\n=== Old Database Import ===")
        self.olddb_service.start_old_db_input(db_url)

    def check_word_validity(self, provider: str = "dictionary_api", openai_key: str = None, limit: int = 100):
        """
        Check word validity

        Args:
            provider: Validity check provider
            openai_key: OpenAI API key (if using OpenAI)
            limit: Maximum number of words to check
        """
        ColorPrint.blue("\n=== Word Validity Check ===")
        self.validity_service.check_all_unvalidated(provider, openai_key, limit)

    def sync_with_server(self, api_url: str, client_token: str):
        """
        Synchronize with remote server

        Args:
            api_url: Remote API URL
            client_token: Client authentication token
        """
        ColorPrint.blue("\n=== Server Synchronization ===")
        result = self.word_service.initialize_by_api(api_url, client_token)

        if result['success']:
            ColorPrint.green(f"Sync successful: {result['uploaded']} uploaded, {result['total']} total")
        else:
            ColorPrint.red(f"Sync failed: {result.get('error', 'Unknown error')}")

        return result

    def run_full_initialization(self, config: dict = None):
        """
        Run full initialization workflow

        Args:
            config: Configuration dictionary with optional keys:
                - old_db_url: URL to download old database
                - api_url: Remote API URL
                - client_token: Client token
                - openai_key: OpenAI API key
                - validity_provider: Validity check provider
                - validity_limit: Max words to validate
        """
        if config is None:
            config = {}

        ColorPrint.blue("=" * 60)
        ColorPrint.blue("Voice Data Initialization - Full Workflow")
        ColorPrint.blue("=" * 60)

        if not self.setup_database():
            ColorPrint.red("Database setup failed, aborting")
            return

        self.initialize_words_local()

        if 'old_db_url' in config:
            self.import_old_databases(config['old_db_url'])

        validity_provider = config.get('validity_provider', 'dictionary_api')
        validity_limit = config.get('validity_limit', 100)
        openai_key = config.get('openai_key')

        self.check_word_validity(validity_provider, openai_key, validity_limit)

        if 'api_url' in config and 'client_token' in config:
            self.sync_with_server(config['api_url'], config['client_token'])

        ColorPrint.blue("=" * 60)
        ColorPrint.green("Initialization Complete!")
        ColorPrint.blue("=" * 60)

    def get_statistics(self):
        """
        Get database statistics

        Returns:
            Dictionary with statistics
        """
        with database_manager.get_connection(self.db_name) as conn:
            total_words = VoiceDictionariesModel.count(conn)
            translated = VoiceDictionariesModel.count(conn, where={"is_translation": True})
            with_voice = VoiceDictionariesModel.count(conn, where={"is_exist_local": True})
            validated = VoiceDictionariesModel.count(conn, where={"is_valid": True})
            invalid = VoiceDictionariesModel.count(conn, where={"is_valid": False})
            unvalidated = VoiceDictionariesModel.count(conn, where={"is_valid": None})

        stats = {
            'total_words': total_words,
            'translated': translated,
            'with_voice': with_voice,
            'validated': validated,
            'invalid': invalid,
            'unvalidated': unvalidated
        }

        ColorPrint.blue("\n=== Database Statistics ===")
        ColorPrint.green(f"Total words: {stats['total_words']}")
        ColorPrint.green(f"Translated: {stats['translated']}")
        ColorPrint.green(f"With voice: {stats['with_voice']}")
        ColorPrint.green(f"Validated: {stats['validated']}")
        ColorPrint.yellow(f"Invalid: {stats['invalid']}")
        ColorPrint.yellow(f"Unvalidated: {stats['unvalidated']}")

        return stats
