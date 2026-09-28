#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
URL Rewriter

Rewrites URLs in HTML/CSS content from absolute to relative paths for offline viewing.
"""

import re
from urllib.parse import urljoin, urlparse
from typing import Optional
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint


class URLRewriter:
    """
    URL rewriter for HTML/CSS content

    Converts absolute URLs to relative paths for offline viewing.

    Features:
    - Rewrite HTML attributes (src, href, data-src, etc.)
    - Rewrite CSS url() references
    - Rewrite inline styles
    - Preserve external URLs (optional)
    - Handle both absolute and relative URLs
    """

    def __init__(self, base_url: str, file_mapper):
        """
        Initialize URL rewriter

        Args:
            base_url: Base URL of the page being processed
            file_mapper: FileMapper instance for path conversion
        """
        self.base_url = base_url
        self.file_mapper = file_mapper
        self.rewrite_count = 0

    def rewrite_html(self, html_content: str, preserve_external: bool = True) -> str:
        """
        Rewrite URLs in HTML content

        Args:
            html_content: HTML content to rewrite
            preserve_external: If True, keep external URLs unchanged (default: True)

        Returns:
            HTML content with rewritten URLs
        """
        self.rewrite_count = 0

        # Rewrite common HTML attributes
        attributes = ['src', 'href', 'data-src', 'data-href', 'poster', 'data-original']

        for attr in attributes:
            # Pattern: attr="url" or attr='url'
            pattern = f'{attr}=(["\'])([^"\']+)\\1'
            html_content = re.sub(
                pattern,
                lambda m: self._rewrite_html_attr(m, attr, preserve_external),
                html_content
            )

        # Rewrite inline styles with url()
        html_content = re.sub(
            r'style=(["\'])([^"\']*url\([^)]+\)[^"\']*)\\1',
            lambda m: self._rewrite_inline_style(m, preserve_external),
            html_content,
            flags=re.IGNORECASE
        )

        ColorPrint.blue(f'[URLRewriter] Rewrote {self.rewrite_count} URLs in HTML')
        return html_content

    def rewrite_css(self, css_content: str, css_url: str, preserve_external: bool = True) -> str:
        """
        Rewrite URLs in CSS content

        Args:
            css_content: CSS content to rewrite
            css_url: URL of the CSS file (for resolving relative URLs)
            preserve_external: If True, keep external URLs unchanged (default: True)

        Returns:
            CSS content with rewritten URLs
        """
        self.rewrite_count = 0

        # Pattern: url("...") or url('...') or url(...)
        pattern = r'url\((["\']?)([^)]+)\1\)'

        css_content = re.sub(
            pattern,
            lambda m: self._rewrite_css_url(m, css_url, preserve_external),
            css_content,
            flags=re.IGNORECASE
        )

        ColorPrint.blue(f'[URLRewriter] Rewrote {self.rewrite_count} URLs in CSS')
        return css_content

    def _rewrite_html_attr(self, match, attr: str, preserve_external: bool) -> str:
        """Rewrite single HTML attribute"""
        quote = match.group(1)
        original_url = match.group(2)

        # Skip empty, data URIs, and anchors
        if not original_url or original_url.startswith(('data:', '#', 'javascript:', 'mailto:')):
            return match.group(0)

        # Resolve to absolute URL
        absolute_url = urljoin(self.base_url, original_url)

        # Check if external URL
        if preserve_external and not self._is_same_origin(absolute_url):
            return match.group(0)  # Keep unchanged

        # Convert to relative path
        relative_path = self.file_mapper.get_resource_path(
            self.base_url,
            absolute_url
        )

        self.rewrite_count += 1

        return f'{attr}={quote}{relative_path}{quote}'

    def _rewrite_inline_style(self, match, preserve_external: bool) -> str:
        """Rewrite inline style attribute"""
        quote = match.group(1)
        style_content = match.group(2)

        # Rewrite url() in inline style
        def rewrite_url(url_match):
            url_quote = url_match.group(1) or ''
            original_url = url_match.group(2)

            # Skip data URIs
            if original_url.startswith('data:'):
                return url_match.group(0)

            # Resolve to absolute URL
            absolute_url = urljoin(self.base_url, original_url)

            # Check if external
            if preserve_external and not self._is_same_origin(absolute_url):
                return url_match.group(0)

            # Convert to relative path
            relative_path = self.file_mapper.get_resource_path(
                self.base_url,
                absolute_url
            )

            self.rewrite_count += 1

            if url_quote:
                return f'url({url_quote}{relative_path}{url_quote})'
            else:
                return f'url({relative_path})'

        style_content = re.sub(
            r'url\((["\']?)([^)]+)\1\)',
            rewrite_url,
            style_content,
            flags=re.IGNORECASE
        )

        return f'style={quote}{style_content}{quote}'

    def _rewrite_css_url(self, match, css_url: str, preserve_external: bool) -> str:
        """Rewrite single CSS url()"""
        url_quote = match.group(1) or ''
        original_url = match.group(2)

        # Skip data URIs
        if original_url.startswith('data:'):
            return match.group(0)

        # Resolve to absolute URL (relative to CSS file)
        absolute_url = urljoin(css_url, original_url)

        # Check if external
        if preserve_external and not self._is_same_origin(absolute_url):
            return match.group(0)

        # Convert to relative path (relative to CSS file)
        relative_path = self.file_mapper.get_resource_path(
            css_url,
            absolute_url
        )

        self.rewrite_count += 1

        if url_quote:
            return f'url({url_quote}{relative_path}{url_quote})'
        else:
            return f'url({relative_path})'

    def _is_same_origin(self, url: str) -> bool:
        """Check if URL is same-origin as base"""
        base_parsed = urlparse(self.base_url)
        url_parsed = urlparse(url)

        # Must have scheme and netloc
        if not url_parsed.scheme or not url_parsed.netloc:
            # Relative URL, treat as same-origin
            return True

        base_origin = f'{base_parsed.scheme}://{base_parsed.netloc}'
        url_origin = f'{url_parsed.scheme}://{url_parsed.netloc}'

        return base_origin == url_origin

    def get_rewrite_count(self) -> int:
        """
        Get number of URLs rewritten in last operation

        Returns:
            Rewrite count
        """
        return self.rewrite_count


__all__ = ['URLRewriter']
