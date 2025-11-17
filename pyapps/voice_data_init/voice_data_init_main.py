#!/usr/bin/env python3
"""
Voice Data Init - Main Entry Point
Initializes vocabulary database from various sources

This application handles:
- Loading words from local vocabulary files
- Importing legacy databases
- Validating word entries
- Synchronizing with remote servers
"""

import sys
from pathlib import Path

from pycore.pyfoundations.color_print import ColorPrint

from pyapps.voice_data_init.controller.init_controller import InitController


def start():
    """
    Main entry point for voice data initialization

    Command line arguments:
        --local: Initialize from local files only
        --import-old <url>: Import old database from URL
        --validate [provider]: Validate words (providers: dictionary_api, openai)
        --sync <api_url> <token>: Sync with remote server
        --stats: Show database statistics
        --full: Run full initialization workflow
    """
    ColorPrint.blue("Starting Voice Data Init")

    controller = InitController()

    args = sys.argv[1:]

    if not args or '--help' in args or '-h' in args:
        print_help()
        return

    if '--stats' in args:
        controller.setup_database()
        controller.get_statistics()
        return

    if '--local' in args:
        controller.setup_database()
        controller.initialize_words_local()
        controller.get_statistics()
        return

    if '--import-old' in args:
        controller.setup_database()
        idx = args.index('--import-old')
        db_url = args[idx + 1] if idx + 1 < len(args) else None
        controller.import_old_databases(db_url)
        controller.get_statistics()
        return

    if '--validate' in args:
        controller.setup_database()
        idx = args.index('--validate')
        provider = args[idx + 1] if idx + 1 < len(args) and not args[idx + 1].startswith('--') else 'dictionary_api'
        openai_key = None

        if provider == 'openai' and '--openai-key' in args:
            key_idx = args.index('--openai-key')
            openai_key = args[key_idx + 1] if key_idx + 1 < len(args) else None

        controller.check_word_validity(provider, openai_key)
        controller.get_statistics()
        return

    if '--sync' in args:
        controller.setup_database()
        idx = args.index('--sync')
        if idx + 2 < len(args):
            api_url = args[idx + 1]
            token = args[idx + 2]
            controller.sync_with_server(api_url, token)
        else:
            ColorPrint.red("--sync requires <api_url> and <token>")
        return

    if '--full' in args:
        config = {}

        if '--old-db-url' in args:
            idx = args.index('--old-db-url')
            if idx + 1 < len(args):
                config['old_db_url'] = args[idx + 1]

        if '--api-url' in args and '--client-token' in args:
            url_idx = args.index('--api-url')
            token_idx = args.index('--client-token')
            if url_idx + 1 < len(args) and token_idx + 1 < len(args):
                config['api_url'] = args[url_idx + 1]
                config['client_token'] = args[token_idx + 1]

        if '--openai-key' in args:
            idx = args.index('--openai-key')
            if idx + 1 < len(args):
                config['openai_key'] = args[idx + 1]
                config['validity_provider'] = 'openai'

        controller.run_full_initialization(config)
        return

    ColorPrint.yellow("No valid command specified. Use --help for usage information.")
    print_help()


def print_help():
    """
    Print help information
    """
    help_text = """
Voice Data Init - Vocabulary Database Initialization Tool

Usage:
    python voice_data_init_main.py [COMMAND] [OPTIONS]

Commands:
    --local
        Initialize database from local vocabulary files

    --import-old [URL]
        Import old/legacy database
        URL: Optional download URL for database archive

    --validate [PROVIDER]
        Validate word entries
        PROVIDER: dictionary_api (default) or openai

    --sync <API_URL> <TOKEN>
        Synchronize with remote server
        API_URL: Remote API endpoint
        TOKEN: Client authentication token

    --stats
        Show database statistics

    --full
        Run full initialization workflow
        Combine with other options:
            --old-db-url <URL>
            --api-url <URL>
            --client-token <TOKEN>
            --openai-key <KEY>

Options:
    --openai-key <KEY>
        OpenAI API key (required for OpenAI validation)

    -h, --help
        Show this help message

Examples:
    # Initialize from local files
    python voice_data_init_main.py --local

    # Import old database
    python voice_data_init_main.py --import-old http://example.com/old_db.7z

    # Validate words using dictionary API
    python voice_data_init_main.py --validate

    # Validate using OpenAI
    python voice_data_init_main.py --validate openai --openai-key sk-xxx

    # Sync with server
    python voice_data_init_main.py --sync https://api.example.com my-token

    # Full workflow
    python voice_data_init_main.py --full --old-db-url http://example.com/old.7z --api-url https://api.example.com --client-token my-token

    # Show statistics
    python voice_data_init_main.py --stats
"""
    ColorPrint.green(help_text)


def main():
    """
    Wrapper for start function
    """
    start()


if __name__ == '__main__':
    main()
