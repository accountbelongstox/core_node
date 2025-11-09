#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Content Plugin

Extract various types of content from pages
"""

from typing import Dict, Any, List
from pycore.pyfoundations.color_print import ColorPrint
from pycore.pyutils.pybrowser.interfaces.iplugin import IPlugin


class ContentPlugin(IPlugin):
    """Plugin for extracting page content"""

    def __init__(self):
        super().__init__()
        self.name = 'content'
        self.version = '1.0.0'

    async def initialize(self, session: Any):
        """
        Initialize plugin with session

        Args:
            session: Session instance
        """
        try:
            self.session = session
            self.is_initialized = True
            ColorPrint.info(f"ContentPlugin initialized for session: {session.id}")
        except Exception as error:
            ColorPrint.red(f'Failed to initialize ContentPlugin: {error}')
            raise

    async def cleanup(self):
        """Cleanup plugin resources"""
        try:
            self.is_initialized = False
            ColorPrint.info('ContentPlugin cleaned up')
        except Exception as error:
            ColorPrint.red(f'Failed to cleanup ContentPlugin: {error}')

    async def extract_text(self, page: Any) -> str:
        """
        Extract text content from page

        Args:
            page: Page instance

        Returns:
            Text content
        """
        try:
            return await page.evaluate('return document.body.innerText;')
        except Exception as error:
            ColorPrint.red(f'Failed to extract text: {error}')
            raise

    async def extract_html(self, page: Any) -> str:
        """
        Extract HTML content from page

        Args:
            page: Page instance

        Returns:
            HTML content
        """
        try:
            return await page.get_content()
        except Exception as error:
            ColorPrint.red(f'Failed to extract HTML: {error}')
            raise

    async def extract_images(self, page: Any) -> List[Dict[str, Any]]:
        """
        Extract image information from page

        Args:
            page: Page instance

        Returns:
            List of image dictionaries
        """
        try:
            script = """
            return Array.from(document.querySelectorAll('img')).map(img => ({
                src: img.src,
                alt: img.alt,
                width: img.width,
                height: img.height
            }));
            """
            return await page.evaluate(script)
        except Exception as error:
            ColorPrint.red(f'Failed to extract images: {error}')
            raise

    async def extract_links(self, page: Any) -> List[Dict[str, Any]]:
        """
        Extract links from page

        Args:
            page: Page instance

        Returns:
            List of link dictionaries
        """
        try:
            script = """
            return Array.from(document.querySelectorAll('a')).map(link => ({
                href: link.href,
                text: link.textContent.trim(),
                title: link.title
            }));
            """
            return await page.evaluate(script)
        except Exception as error:
            ColorPrint.red(f'Failed to extract links: {error}')
            raise

    async def extract_forms(self, page: Any) -> List[Dict[str, Any]]:
        """
        Extract form information from page

        Args:
            page: Page instance

        Returns:
            List of form dictionaries
        """
        try:
            script = """
            return Array.from(document.querySelectorAll('form')).map(form => ({
                action: form.action,
                method: form.method,
                inputs: Array.from(form.querySelectorAll('input')).map(input => ({
                    type: input.type,
                    name: input.name,
                    value: input.value,
                    placeholder: input.placeholder
                }))
            }));
            """
            return await page.evaluate(script)
        except Exception as error:
            ColorPrint.red(f'Failed to extract forms: {error}')
            raise

    async def extract_meta(self, page: Any) -> Dict[str, str]:
        """
        Extract meta tags from page

        Args:
            page: Page instance

        Returns:
            Dictionary of meta tag content
        """
        try:
            script = """
            const meta = Array.from(document.querySelectorAll('meta'));
            const result = {};

            meta.forEach(metaTag => {
                const name = metaTag.getAttribute('name') || metaTag.getAttribute('property');
                const content = metaTag.getAttribute('content');

                if (name && content) {
                    result[name] = content;
                }
            });

            return result;
            """
            return await page.evaluate(script)
        except Exception as error:
            ColorPrint.red(f'Failed to extract meta: {error}')
            raise

    async def extract_all(self, page: Any) -> Dict[str, Any]:
        """
        Extract all content types from page

        Args:
            page: Page instance

        Returns:
            Dictionary with all extracted content
        """
        try:
            import asyncio
            from datetime import datetime

            results = await asyncio.gather(
                self.extract_text(page),
                self.extract_html(page),
                self.extract_images(page),
                self.extract_links(page),
                self.extract_forms(page),
                self.extract_meta(page),
                page.get_url(),
                page.get_title()
            )

            return {
                'text': results[0],
                'html': results[1],
                'images': results[2],
                'links': results[3],
                'forms': results[4],
                'meta': results[5],
                'url': results[6],
                'title': results[7],
                'timestamp': datetime.now().isoformat()
            }
        except Exception as error:
            ColorPrint.red(f'Failed to extract all content: {error}')
            raise
