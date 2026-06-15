#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
CSS Processor

Processes CSS content: extracts resources, rewrites URLs, and saves for offline viewing.
"""

import re
from pathlib import Path
from urllib.parse import urljoin
from typing import Dict, Optional, List
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint


class CSSProcessor:
    """
    CSS content processor

    Processes CSS files for offline viewing.

    Features:
    - Extract resources from CSS (images, fonts via url())
    - Download resources
    - Rewrite URLs to relative paths
    - Save processed CSS to local filesystem
    - Handle @import rules
    - Track processing statistics
    """

    def __init__(self, file_mapper, domain_context, resource_processor):
        """
        Initialize CSS processor

        Args:
            file_mapper: FileMapper instance
            domain_context: DomainContext instance
            resource_processor: ResourceProcessor instance
        """
        self.file_mapper = file_mapper
        self.domain_context = domain_context
        self.resource_processor = resource_processor
        self.processed_count = 0
        self.saved_files = []

    def extract_resources(self, css_content: str, css_url: str) -> List[str]:
        """
        Extract all resource URLs from CSS content

        Args:
            css_content: CSS content
            css_url: URL of the CSS file (for resolving relative URLs)

        Returns:
            List of absolute resource URLs
        """
        resources = []

        # Pattern: url("...") or url('...') or url(...)
        url_pattern = r'url\((["\']?)([^)]+)\1\)'

        matches = re.findall(url_pattern, css_content, flags=re.IGNORECASE)

        for match in matches:
            url_quote = match[0]  # Quote character (", ', or empty)
            url_value = match[1]  # URL value

            # Skip data URIs
            if url_value.startswith('data:'):
                continue

            # Skip absolute URLs from other origins (if preserve_external)
            # For now, we'll collect all URLs

            # Resolve to absolute URL
            absolute_url = urljoin(css_url, url_value.strip())
            resources.append(absolute_url)

        # Extract @import URLs
        import_pattern = r'@import\s+(?:url\()?(["\']?)([^)"\';]+)\1\)?'
        import_matches = re.findall(import_pattern, css_content, flags=re.IGNORECASE)

        for match in import_matches:
            import_url = match[1].strip()

            # Skip data URIs
            if import_url.startswith('data:'):
                continue

            # Resolve to absolute URL
            absolute_url = urljoin(css_url, import_url)

            # Only include CSS files from same origin
            if self.domain_context.is_internal_link(absolute_url):
                resources.append(absolute_url)

        # Remove duplicates
        unique_resources = list(set(resources))

        ColorPrint.blue(f'[CSSProcessor] Extracted {len(unique_resources)} unique resources from CSS')
        return unique_resources

    def process_css(
        self,
        css_content: str,
        css_url: str,
        download_resources: bool = True,
        rewrite_urls: bool = True,
        save_css: bool = True,
        resource_timeout: int = 30000,
        resource_headers: Optional[Dict] = None
    ) -> Dict:
        """
        Process CSS content: extract resources, rewrite URLs, save

        Args:
            css_content: CSS content to process
            css_url: URL of the CSS file
            download_resources: If True, download resources (default: True)
            rewrite_urls: If True, rewrite URLs to relative paths (default: True)
            save_css: If True, save processed CSS to filesystem (default: True)
            resource_timeout: Timeout for resource downloads in milliseconds
            resource_headers: Optional custom headers for resource downloads

        Returns:
            Processing result dictionary
        """
        ColorPrint.green(f'[CSSProcessor] Processing CSS: {css_url}')

        result = {
            'url': css_url,
            'success': False,
            'resources_extracted': 0,
            'resources_downloaded': 0,
            'resources_failed': 0,
            'urls_rewritten': 0,
            'css_saved': False,
            'css_path': None,
            'imported_css': [],
            'error': None
        }

        # Step 1: Extract resources
        ColorPrint.blue('[CSSProcessor] Step 1: Extract resources from CSS')
        resources = self.extract_resources(css_content, css_url)
        result['resources_extracted'] = len(resources)

        # Separate imported CSS files from other resources
        imported_css = []
        other_resources = []

        for resource_url in resources:
            if resource_url.lower().endswith(('.css', '.scss', '.sass', '.less')):
                imported_css.append(resource_url)
            else:
                other_resources.append(resource_url)

        result['imported_css'] = imported_css

        ColorPrint.blue(f'[CSSProcessor] Found {len(imported_css)} imported CSS, {len(other_resources)} other resources')

        # Step 2: Download resources
        downloaded = 0
        failed = 0

        if download_resources:
            ColorPrint.blue('[CSSProcessor] Step 2: Download resources')

            for resource_url in other_resources:
                success, content, error = self.resource_processor.download_resource(
                    resource_url,
                    timeout=resource_timeout,
                    headers=resource_headers
                )

                if success and content:
                    # Save resource
                    saved_path = self.resource_processor.save_resource(
                        resource_url,
                        content,
                        content_type=None
                    )

                    if saved_path:
                        downloaded += 1
                else:
                    failed += 1

            result['resources_downloaded'] = downloaded
            result['resources_failed'] = failed

            ColorPrint.green(
                f'[CSSProcessor] Resources: {downloaded} downloaded, {failed} failed'
            )

        # Step 3: Rewrite URLs
        processed_css = css_content
        if rewrite_urls:
            ColorPrint.blue('[CSSProcessor] Step 3: Rewrite URLs to relative paths')

            from pycore.pyctl.pybrowserauto.core import URLRewriter
            rewriter = URLRewriter(css_url, self.file_mapper)
            processed_css = rewriter.rewrite_css(css_content, css_url, preserve_external=True)

            result['urls_rewritten'] = rewriter.get_rewrite_count()

            ColorPrint.green(f'[CSSProcessor] Rewrote {result["urls_rewritten"]} URLs')

        # Step 4: Save processed CSS
        if save_css:
            ColorPrint.blue('[CSSProcessor] Step 4: Save processed CSS')

            filepath = self.file_mapper.get_absolute_path(css_url, content_type='text/css')
            self.file_mapper.ensure_directory(filepath)

            # Write CSS file
            filepath.write_text(processed_css, encoding='utf-8')

            result['css_saved'] = True
            result['css_path'] = str(filepath)

            self.saved_files.append(str(filepath))

            ColorPrint.green(f'[CSSProcessor] Saved CSS: {filepath}')

        # Mark success
        result['success'] = True
        self.processed_count += 1

        ColorPrint.green(f'[CSSProcessor] Successfully processed: {css_url}')

        return result

    def process_and_save(
        self,
        css_content: str,
        css_url: str,
        options: Optional[Dict] = None
    ) -> Dict:
        """
        Simplified processing: process CSS and save with default options

        Args:
            css_content: CSS content
            css_url: URL of the CSS file
            options: Optional processing options

        Returns:
            Processing result dictionary
        """
        options = options or {}

        return self.process_css(
            css_content=css_content,
            css_url=css_url,
            download_resources=options.get('download_resources', True),
            rewrite_urls=options.get('rewrite_urls', True),
            save_css=options.get('save_css', True),
            resource_timeout=options.get('resource_timeout', 30000),
            resource_headers=options.get('resource_headers', None)
        )

    def get_stats(self) -> Dict:
        """
        Get processor statistics

        Returns:
            Statistics dictionary
        """
        return {
            'processed_count': self.processed_count,
            'saved_files': len(self.saved_files)
        }

    def clear_cache(self):
        """Clear processing caches"""
        self.saved_files.clear()
        ColorPrint.blue('[CSSProcessor] Cache cleared')


__all__ = ['CSSProcessor']
