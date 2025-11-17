#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
DocumentOffline Processor Components

Processing layer for document offline downloads:
- ResourceProcessor: Extract, download, and save resources (CSS, JS, images, fonts)
- HTMLProcessor: Process HTML content, coordinate resource downloads and URL rewriting
- CSSProcessor: Process CSS content, download resources and rewrite URLs

Usage:
    from pycore.pyctl.pybrowserauto.processor import (
        ResourceProcessor, HTMLProcessor, CSSProcessor
    )

    # Initialize components
    resource_processor = ResourceProcessor(file_mapper, domain_context)
    html_processor = HTMLProcessor(file_mapper, domain_context, resource_processor)
    css_processor = CSSProcessor(file_mapper, domain_context, resource_processor)

    # Process HTML
    result = html_processor.process_html(
        html_content='<html>...</html>',
        url='https://example.com/page.html',
        download_resources=True,
        rewrite_urls=True,
        save_html=True
    )

    # Process CSS
    css_result = css_processor.process_css(
        css_content='body { background: url(...); }',
        css_url='https://example.com/style.css',
        download_resources=True,
        rewrite_urls=True,
        save_css=True
    )
"""

from pycore.pyctl.pybrowserauto.processor.resource_processor import ResourceProcessor
from pycore.pyctl.pybrowserauto.processor.html_processor import HTMLProcessor
from pycore.pyctl.pybrowserauto.processor.css_processor import CSSProcessor

__all__ = [
    'ResourceProcessor',
    'HTMLProcessor',
    'CSSProcessor'
]

__version__ = '1.0.0'
