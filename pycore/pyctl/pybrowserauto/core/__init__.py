#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
DocumentOffline Core Components

Core functionality for document offline downloads:
- DomainContext: URL validation and scope management
- URLQueue: Thread-safe URL queue with deduplication
- FileMapper: URL to file path mapping
- URLRewriter: URL rewriting for offline viewing

Usage:
    from pycore.pyctl.document_offline.core import (
        DomainContext, URLQueue, FileMapper, URLRewriter
    )

    # Initialize domain context
    context = DomainContext('https://example.com/docs/', scope_mode='path')

    # Create URL queue
    queue = URLQueue()
    queue.enqueue('https://example.com/docs/page1.html', depth=0)

    # Create file mapper
    mapper = FileMapper('/downloads', 'https://example.com')
    filepath = mapper.url_to_filepath('https://example.com/docs/page1.html')

    # Create URL rewriter
    rewriter = URLRewriter('https://example.com/docs/page1.html', mapper)
    rewritten_html = rewriter.rewrite_html(html_content)
"""

from pycore.pyctl.document_offline.core.domain_context import DomainContext
from pycore.pyctl.document_offline.core.url_queue import URLQueue
from pycore.pyctl.document_offline.core.file_mapper import FileMapper
from pycore.pyctl.document_offline.core.url_rewriter import URLRewriter

__all__ = [
    'DomainContext',
    'URLQueue',
    'FileMapper',
    'URLRewriter'
]

__version__ = '1.0.0'
