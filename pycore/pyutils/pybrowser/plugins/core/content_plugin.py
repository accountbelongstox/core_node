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

    def initialize(self, session: Any):
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

    def cleanup(self):
        """Cleanup plugin resources"""
        try:
            self.is_initialized = False
            ColorPrint.info('ContentPlugin cleaned up')
        except Exception as error:
            ColorPrint.red(f'Failed to cleanup ContentPlugin: {error}')

    def extract_text(self, page: Any) -> str:
        """
        Extract text content from page

        Args:
            page: Page instance

        Returns:
            Text content
        """
        try:
            return page.evaluate('return document.body.innerText;')
        except Exception as error:
            ColorPrint.red(f'Failed to extract text: {error}')
            raise

    def extract_html(self, page: Any) -> str:
        """
        Extract HTML content from page

        Args:
            page: Page instance

        Returns:
            HTML content
        """
        try:
            return page.get_content()
        except Exception as error:
            ColorPrint.red(f'Failed to extract HTML: {error}')
            raise

    def extract_images(self, page: Any) -> List[Dict[str, Any]]:
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
            return page.evaluate(script)
        except Exception as error:
            ColorPrint.red(f'Failed to extract images: {error}')
            raise

    def extract_links(self, page: Any) -> List[Dict[str, Any]]:
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
            return page.evaluate(script)
        except Exception as error:
            ColorPrint.red(f'Failed to extract links: {error}')
            raise

    def extract_forms(self, page: Any) -> List[Dict[str, Any]]:
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
            return page.evaluate(script)
        except Exception as error:
            ColorPrint.red(f'Failed to extract forms: {error}')
            raise

    def extract_meta(self, page: Any) -> Dict[str, str]:
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
            return page.evaluate(script)
        except Exception as error:
            ColorPrint.red(f'Failed to extract meta: {error}')
            raise

    def extract_all(self, page: Any) -> Dict[str, Any]:
        """
        Extract all content types from page (synchronous)

        Args:
            page: Page instance

        Returns:
            Dictionary with all extracted content
        """
        try:
            from datetime import datetime

            # Extract all content synchronously
            return {
                'text': self.extract_text(page),
                'html': self.extract_html(page),
                'images': self.extract_images(page),
                'links': self.extract_links(page),
                'forms': self.extract_forms(page),
                'meta': self.extract_meta(page),
                'url': page.get_url(),
                'title': page.get_title(),
                'timestamp': datetime.now().isoformat()
            }
        except Exception as error:
            ColorPrint.red(f'Failed to extract all content: {error}')
            raise
