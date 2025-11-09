#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Legacy Adapter

Provides backwards compatibility with older API versions
Wraps new SpiderEngine with legacy interface
"""

from typing import Dict, Any, Optional
from pycore.pyutils.pybrowser.utils.logger import Logger

logger = Logger({'prefix': 'LegacyAdapter'})


class LegacyAdapter:
    """
    Legacy adapter for backwards compatibility

    Wraps new SpiderEngine API with legacy interface
    """

    def __init__(self):
        self.new_spider = None
        self.session = None
        self.is_initialized = False

    async def initialize(self, browser_type: str = 'chrome') -> 'LegacyAdapter':
        """
        Initialize adapter with browser

        Args:
            browser_type: Browser type ('chrome', 'edge', 'firefox')

        Returns:
            Self for chaining
        """
        try:
            from pycore.pyutils.pybrowser.core import SpiderEngine

            self.new_spider = SpiderEngine()
            await self.new_spider.initialize()

            self.session = await self.new_spider.create_session({
                'browser': browser_type
            })

            self.is_initialized = True
            logger.info('LegacyAdapter initialized')
            return self
        except Exception as error:
            logger.error(f'Failed to initialize LegacyAdapter: {error}')
            raise

    def get_page(self):
        """Get current page"""
        if not self.session:
            raise RuntimeError('Session not initialized. Call initialize() first.')
        return self.session.get_current_page()

    def get_browser(self):
        """Get browser instance"""
        if not self.session:
            raise RuntimeError('Session not initialized. Call initialize() first.')
        return self.session.get_browser()

    async def close(self):
        """Close adapter and cleanup resources"""
        try:
            if self.session:
                await self.session.close()
                self.session = None

            if self.new_spider:
                await self.new_spider.shutdown()
                self.new_spider = None

            self.is_initialized = False
            logger.info('LegacyAdapter closed')
        except Exception as error:
            logger.error(f'Failed to close LegacyAdapter: {error}')
            raise

    def get_info(self) -> Dict[str, Any]:
        """Get adapter information"""
        return {
            'isInitialized': self.is_initialized,
            'session': self.session.get_info() if self.session else None,
            'spider': self.new_spider.get_info() if self.new_spider else None
        }


class MigrationTool:
    """
    Tools for migrating old code to new API

    Provides config migration and code transformation utilities
    """

    @staticmethod
    def migrate_old_config(old_config: Dict[str, Any]) -> Dict[str, Any]:
        """
        Migrate old configuration to new format

        Args:
            old_config: Old configuration

        Returns:
            Migrated configuration
        """
        try:
            new_config = {
                'browser': old_config.get('browserType', 'chrome'),
                'headless': old_config.get('headless', True),
                'viewport': old_config.get('viewport', {'width': 1920, 'height': 1080}),
                'timeout': old_config.get('timeout', 30000),
                'retries': old_config.get('retries', 3),
                'delay': old_config.get('delay', 1000)
            }

            # Migrate browser-specific options
            if old_config.get('browserOptions'):
                new_config['browserOptions'] = old_config['browserOptions']

            # Migrate session options
            if old_config.get('sessionOptions'):
                new_config['sessionOptions'] = old_config['sessionOptions']

            logger.info('Old config migrated to new format')
            return new_config
        except Exception as error:
            logger.error(f'Failed to migrate old config: {error}')
            raise

    @staticmethod
    def migrate_old_code(old_code: str) -> str:
        """
        Migrate old code to new API

        Args:
            old_code: Old code string

        Returns:
            Migrated code
        """
        try:
            migrated_code = old_code

            # Replace class instantiation
            migrated_code = migrated_code.replace('PuppeteerSpider(', 'SpiderEngine(')

            # Replace initialization calls
            migrated_code = migrated_code.replace('.initialize(', '.createSession(')

            # Replace page access
            migrated_code = migrated_code.replace('.getPage()', '.getCurrentPage()')

            # Replace browser access
            migrated_code = migrated_code.replace('.getBrowser()', '.getBrowser()')

            # Replace instance manager calls
            migrated_code = migrated_code.replace('PuppeteerInstanceManager', 'SessionManager')

            # Replace global instances
            migrated_code = migrated_code.replace('GLOBAL_INSTANCES', 'SpiderRegistry')

            logger.info('Old code migrated to new API')
            return migrated_code
        except Exception as error:
            logger.error(f'Failed to migrate old code: {error}')
            raise

    @staticmethod
    def generate_migration_report(old_files: list) -> Dict[str, Any]:
        """
        Generate migration report for old files

        Args:
            old_files: List of file dictionaries with 'path' and 'content'

        Returns:
            Migration report
        """
        try:
            report = {
                'totalFiles': len(old_files),
                'migratedFiles': 0,
                'errors': [],
                'suggestions': []
            }

            for file_info in old_files:
                try:
                    migrated_code = MigrationTool.migrate_old_code(file_info.get('content', ''))
                    report['migratedFiles'] += 1
                except Exception as error:
                    report['errors'].append({
                        'file': file_info.get('path'),
                        'error': str(error)
                    })

            # Add suggestions
            report['suggestions'].extend([
                'Update imports to use new module structure',
                'Replace PuppeteerSpider with SpiderEngine',
                'Use session-based API instead of global instances',
                'Update plugin usage to new plugin system',
                'Migrate configuration to new config format'
            ])

            logger.info(f"Migration report generated: {report['migratedFiles']}/{report['totalFiles']} files migrated")
            return report
        except Exception as error:
            logger.error(f'Failed to generate migration report: {error}')
            raise

    @staticmethod
    def validate_migration(migrated_code: str) -> Dict[str, Any]:
        """
        Validate migrated code

        Args:
            migrated_code: Migrated code string

        Returns:
            Validation result with issues
        """
        try:
            issues = []

            # Check for old API usage
            if 'PuppeteerSpider' in migrated_code:
                issues.append('Found old PuppeteerSpider class usage')

            if 'PuppeteerInstanceManager' in migrated_code:
                issues.append('Found old PuppeteerInstanceManager usage')

            if 'GLOBAL_INSTANCES' in migrated_code:
                issues.append('Found old GLOBAL_INSTANCES usage')

            if '.initialize(' in migrated_code:
                issues.append('Found old initialize() method usage')

            if '.getPage()' in migrated_code:
                issues.append('Found old getPage() method usage')

            return {
                'isValid': len(issues) == 0,
                'issues': issues
            }
        except Exception as error:
            logger.error(f'Failed to validate migration: {error}')
            raise
