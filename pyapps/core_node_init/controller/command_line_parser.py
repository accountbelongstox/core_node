"""
Command Line Parser for Core Node Init

Handles parsing of command line arguments for the application.
"""

import sys
from typing import Dict, Any, List, Optional

from pycore import ColorPrint


class CommandLineParser:
    """
    Command line argument parser for Core Node Init application
    """

    def __init__(self):
        self.supported_commands = ['download', 'list', 'status', 'help', 'image', 'audio', 'url']

    def parse_arguments(self, args: Optional[List[str]] = None) -> Dict[str, Any]:
        """
        Parse command line arguments

        Args:
            args: List of arguments to parse (defaults to sys.argv[1:])

        Returns:
            Dictionary with parsed command, target, and options
        """
        if args is None:
            args = sys.argv[1:]

        parsed_args = {
            'command': 'download',  # Default to download command
            'target': None,
            'options': {}
        }

        i = 0
        while i < len(args):
            arg = args[i]

            # Skip app= and apps= parameters
            if arg.startswith('app=') or arg.startswith('apps='):
                i += 1
                continue

            if arg.startswith('--'):
                # Handle options
                option_name = arg[2:]

                # Check if next arg is the value
                if i + 1 < len(args) and not args[i + 1].startswith('--'):
                    parsed_args['options'][option_name] = args[i + 1]
                    i += 2
                else:
                    parsed_args['options'][option_name] = True
                    i += 1
            else:
                # First non-option argument
                if not parsed_args.get('command') or parsed_args['command'] == 'download':
                    if arg in self.supported_commands:
                        parsed_args['command'] = arg
                    else:
                        parsed_args['target'] = arg
                        parsed_args['command'] = 'download'
                elif not parsed_args.get('target'):
                    parsed_args['target'] = arg

                i += 1

        return parsed_args

    def display_help(self):
        """Display help message"""
        help_text = """
Core Node Init - Download Manager (Python v2)

Usage:
  python -m pyapps.core_node_init.main [command] [target] [options]

Commands:
  download <target>    Download specified application
  image <selector>     Download image from CSS selector
  audio <selector>     Download audio from CSS selector
  url <url>            Download file from direct URL
  list                 List available download targets
  status              Show download status
  help                Show this help message

Targets:
  cursor              Download Cursor IDE
  vscode              Download Visual Studio Code

Options:
  --force             Force download even if file exists
  --headless          Run browser in headless mode
  --timeout <ms>      Set timeout in milliseconds
  --wait              Wait for manual download completion
  --no-wait           Don't wait for download completion

Examples:
  python -m pyapps.core_node_init.main download cursor
  python -m pyapps.core_node_init.main download vscode --force
  python -m pyapps.core_node_init.main image "img.download-image"
  python -m pyapps.core_node_init.main audio "audio.download-audio"
  python -m pyapps.core_node_init.main url "https://example.com/file.zip"
  python -m pyapps.core_node_init.main list
  python -m pyapps.core_node_init.main status
"""
        ColorPrint.print_info(help_text)
