#!/usr/bin/env python3
"""
Voice Data Init - Usage Examples
Demonstrates how to use the voice data initialization application
"""

from pycore.pyfoundations.color_print import ColorPrint
from pyapps.voice_data_init.controller.init_controller import InitController


def example_1_basic_initialization():
    """
    Example 1: Basic local initialization
    Load words from local vocabulary files
    """
    ColorPrint.blue("\n=== Example 1: Basic Local Initialization ===")

    controller = InitController()

    controller.setup_database()

    controller.initialize_words_local()

    controller.get_statistics()


def example_2_import_old_database():
    """
    Example 2: Import old database
    Download and import legacy database
    """
    ColorPrint.blue("\n=== Example 2: Import Old Database ===")

    controller = InitController()

    controller.setup_database()

    old_db_url = "http://example.com/old_dictionary.7z"

    controller.import_old_databases(old_db_url)

    controller.get_statistics()


def example_3_validate_words():
    """
    Example 3: Validate words using dictionary API
    Check word validity without API key
    """
    ColorPrint.blue("\n=== Example 3: Validate Words ===")

    controller = InitController()

    controller.setup_database()

    controller.check_word_validity(
        provider="dictionary_api",
        limit=50
    )

    controller.get_statistics()


def example_4_validate_with_openai():
    """
    Example 4: Validate words using OpenAI
    Requires OpenAI API key
    """
    ColorPrint.blue("\n=== Example 4: Validate with OpenAI ===")

    controller = InitController()

    controller.setup_database()

    openai_key = "sk-your-openai-api-key-here"

    controller.check_word_validity(
        provider="openai",
        openai_key=openai_key,
        limit=20
    )

    controller.get_statistics()


def example_5_sync_with_server():
    """
    Example 5: Synchronize with remote server
    Upload local data to remote API
    """
    ColorPrint.blue("\n=== Example 5: Sync with Server ===")

    controller = InitController()

    controller.setup_database()

    api_url = "https://api.example.com"
    client_token = "your-client-token"

    controller.sync_with_server(api_url, client_token)

    controller.get_statistics()


def example_6_full_workflow():
    """
    Example 6: Complete workflow
    Run all initialization steps
    """
    ColorPrint.blue("\n=== Example 6: Full Workflow ===")

    controller = InitController()

    config = {
        'old_db_url': 'http://example.com/old_db.7z',
        'api_url': 'https://api.example.com',
        'client_token': 'your-token',
        'validity_provider': 'dictionary_api',
        'validity_limit': 100
    }

    controller.run_full_initialization(config)


def example_7_programmatic_usage():
    """
    Example 7: Programmatic usage
    Use individual services directly
    """
    ColorPrint.blue("\n=== Example 7: Programmatic Usage ===")

    from pyapps.voice_data_init.service.word_init_service import WordInitService

    service = WordInitService()

    vocab_files = service.get_unique_content_lines(service.vocabulary_dir)
    ColorPrint.green(f"Found {len(vocab_files)} unique words in files")

    diff = service.get_diff_contents(vocab_files)
    ColorPrint.yellow(f"{len(diff)} new words need to be added")


def example_8_database_queries():
    """
    Example 8: Direct database queries
    Query vocabulary data directly
    """
    ColorPrint.blue("\n=== Example 8: Database Queries ===")

    from pycore.database import database_manager
    from pycore.database.models import VoiceDictionariesModel

    controller = InitController()
    controller.setup_database()

    with database_manager.get_connection("voice_main") as conn:
        untranslated = VoiceDictionariesModel.get_untranslated(conn, limit=10)
        ColorPrint.green(f"Untranslated words: {len(untranslated)}")

        for word in untranslated[:5]:
            ColorPrint.yellow(f"  - {word['content']}")

        without_voice = VoiceDictionariesModel.get_without_voice(conn, limit=10)
        ColorPrint.green(f"Words without voice: {len(without_voice)}")

        unvalidated = VoiceDictionariesModel.get_unvalidated(conn, limit=10)
        ColorPrint.green(f"Unvalidated words: {len(unvalidated)}")


def main():
    """
    Run all examples
    """
    ColorPrint.blue("=" * 60)
    ColorPrint.blue("Voice Data Init - Usage Examples")
    ColorPrint.blue("=" * 60)

    ColorPrint.yellow("\nNote: These are examples. Uncomment the one you want to run.")
    ColorPrint.yellow("Some examples require configuration (URLs, API keys, etc.)\n")

    ColorPrint.green("Run specific example:")
    print("python example_usage.py")


if __name__ == '__main__':
    main()
