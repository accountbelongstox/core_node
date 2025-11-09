"""
Application Controller for Core Node Init

Handles the initialization and management of the spider engine and browser automation.
"""

import sys
import asyncio
from typing import Optional, Dict, Any

from pycore import ColorPrint
from pycore.pyutils.pybrowser import create_spider_engine, SpiderEngine
from pycore.pyutils.pybrowser.core.session_manager import Session

from pyapps.core_node_init.config import config
from pyapps.core_node_init.controller.download_plugin import CoreNodeInitDownloadPlugin


class ApplicationController:
    """
    Main application controller for managing browser automation and downloads
    """

    def __init__(self):
        self.spider_engine: Optional[SpiderEngine] = None
        self.session: Optional[Session] = None
        self.download_plugin = None
        self.initialized = False

    async def initialize(self):
        """Initialize the application controller"""
        if self.initialized:
            ColorPrint.print_warn('ApplicationController already initialized')
            return

        ColorPrint.print_info('Initializing Core Node Init application (Python v2)...')

        try:
            # Initialize spider engine
            self.spider_engine = create_spider_engine()
            await self.spider_engine.initialize()

            # Create browser session
            self.session = await self.spider_engine.create_session({
                'browser': config.browser.browser_type,
                'browser_options': {
                    'headless': config.browser.headless,
                    'args': config.browser.args,
                    'timeout': config.browser.timeout,
                    'devtools': config.browser.devtools,
                    'ignore_default_args': False,
                    'ignore_https_errors': config.browser.ignore_https_errors
                }
            })

            # Initialize download plugin
            self.download_plugin = CoreNodeInitDownloadPlugin()
            await self.download_plugin.initialize(self.session)

            self.initialized = True
            ColorPrint.print_success('Core Node Init application initialized successfully')

        except Exception as error:
            ColorPrint.print_error(f'Failed to initialize application: {error}')
            raise

    def list_targets(self):
        """List available download targets"""
        ColorPrint.print_info('Available download targets:')

        if not self.download_plugin:
            ColorPrint.print_error('Download plugin not initialized')
            return

        targets = self.download_plugin.list_targets()
        for target in targets:
            ColorPrint.print_info(f"  {target['key'].ljust(10)} - {target['name']}: {target['description']}")

    async def show_status(self):
        """Show download status"""
        ColorPrint.print_info('Download status check...')

        if not self.download_plugin:
            ColorPrint.print_error('Download plugin not initialized')
            return

        try:
            status = await self.download_plugin.get_download_status()

            ColorPrint.print_info('Download Status:')
            for target, info in status.items():
                status_text = 'Downloaded' if info.get('downloaded') else 'Not Downloaded'
                file_info = f" ({info.get('file')})" if info.get('file') else ''
                ColorPrint.print_info(f"  {target.ljust(10)} - {status_text}{file_info}")

        except Exception as error:
            ColorPrint.print_error(f'Failed to get download status: {error}')

    async def execute_download(self, target: str, options: Optional[Dict[str, Any]] = None):
        """Execute application download"""
        if not target:
            ColorPrint.print_error('Download target is required')
            return False

        if not self.download_plugin:
            ColorPrint.print_error('Download plugin not initialized')
            return False

        try:
            result = await self.download_plugin.download_application(target, options or {})
            return result.get('success', False)

        except Exception as error:
            ColorPrint.print_error(f'Download error: {error}')
            return False

    async def execute_image_download(self, selector: str, options: Optional[Dict[str, Any]] = None):
        """Execute image download"""
        if not selector:
            ColorPrint.print_error('Image selector is required')
            return False

        if not self.download_plugin:
            ColorPrint.print_error('Download plugin not initialized')
            return False

        try:
            result = await self.download_plugin.download_image(selector, options or {})
            return result.get('success', False)

        except Exception as error:
            ColorPrint.print_error(f'Image download error: {error}')
            return False

    async def execute_audio_download(self, selector: str, options: Optional[Dict[str, Any]] = None):
        """Execute audio download"""
        if not selector:
            ColorPrint.print_error('Audio selector is required')
            return False

        if not self.download_plugin:
            ColorPrint.print_error('Download plugin not initialized')
            return False

        try:
            result = await self.download_plugin.download_audio(selector, options or {})
            return result.get('success', False)

        except Exception as error:
            ColorPrint.print_error(f'Audio download error: {error}')
            return False

    async def execute_url_download(self, url: str, options: Optional[Dict[str, Any]] = None):
        """Execute URL download"""
        if not url:
            ColorPrint.print_error('URL is required')
            return False

        if not self.download_plugin:
            ColorPrint.print_error('Download plugin not initialized')
            return False

        try:
            result = await self.download_plugin.download_from_url(url, options or {})
            return result.get('success', False)

        except Exception as error:
            ColorPrint.print_error(f'URL download error: {error}')
            return False

    async def cleanup(self):
        """Cleanup resources"""
        try:
            if self.download_plugin:
                await self.download_plugin.cleanup()

            if self.session and self.spider_engine:
                await self.spider_engine.close_session(self.session.id)

            if self.spider_engine:
                await self.spider_engine.shutdown()

            self.initialized = False
            ColorPrint.print_info('Cleanup complete')

        except Exception as error:
            ColorPrint.print_error(f'Cleanup error: {error}')

    async def run_cli_mode(self):
        """
        Run application in CLI mode for command-line operations
        """
        try:
            from pyapps.core_node_init.controller.command_line_parser import CommandLineParser

            parser = CommandLineParser()
            args = parser.parse_arguments()

            if args['command'] == 'help':
                parser.display_help()
                ColorPrint.print_info('Core Node Init application completed successfully')
                return

            if args['command'] == 'list':
                await self.initialize()
                self.list_targets()
                await self.cleanup()
                ColorPrint.print_info('Core Node Init application completed successfully')
                return

            await self.initialize()

            ColorPrint.print_info(f"Command: {args['command']}, Target: {args.get('target', 'none')}")

            success = True

            if args['command'] == 'download':
                if not args.get('target'):
                    ColorPrint.print_info('No target specified, downloading both VSCode and Cursor...')

                    vscode_success = await self.execute_download('vscode', args.get('options', {}))
                    cursor_success = await self.execute_download('cursor', args.get('options', {}))

                    success = vscode_success and cursor_success

                    if success:
                        ColorPrint.print_info('Both VSCode and Cursor downloads completed successfully')
                    else:
                        ColorPrint.print_error('One or more downloads failed')
                else:
                    success = await self.execute_download(args['target'], args.get('options', {}))

            elif args['command'] == 'image':
                success = await self.execute_image_download(args.get('target'), args.get('options', {}))

            elif args['command'] == 'audio':
                success = await self.execute_audio_download(args.get('target'), args.get('options', {}))

            elif args['command'] == 'url':
                success = await self.execute_url_download(args.get('target'), args.get('options', {}))

            elif args['command'] == 'status':
                await self.show_status()

            else:
                parser.display_help()

            await self.cleanup()

            if success:
                ColorPrint.print_info('Core Node Init application completed successfully')
            else:
                ColorPrint.print_error('Core Node Init application completed with errors')
                sys.exit(1)

        except Exception as error:
            ColorPrint.print_error(f'Fatal error in CLI mode: {error}')
            await self.cleanup()
            sys.exit(1)
