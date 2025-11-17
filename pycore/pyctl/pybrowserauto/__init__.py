#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
DocumentOffline - Offline Document Downloader

High-level document offline download system.
Downloads websites for offline viewing with resource processing.

Sub-modules:
- core: Core components (DomainContext, URLQueue, FileMapper, URLRewriter)
- processor: Processing layer (ResourceProcessor, HTMLProcessor, CSSProcessor)
- controller: Controller layer (CrawlController, CLIController)

Usage:
    # Option 1: Use CLI controller
    from pycore.pyctl.document_offline.controller import CLIController
    cli = CLIController()
    cli.run(['--url', 'https://example.com', '--output', './downloads'])

    # Option 2: Use programmatic controller
    from pycore.pyctl.document_offline.controller import CrawlController
    from pycore.pyctl.document_offline.core import (
        DomainContext, URLQueue, FileMapper
    )
    from pycore.pyctl.document_offline.processor import (
        ResourceProcessor, HTMLProcessor, CSSProcessor
    )

    # Initialize components
    domain_context = DomainContext('https://example.com/docs/', scope_mode='path')
    url_queue = URLQueue()
    file_mapper = FileMapper('./downloads', 'https://example.com')
    resource_processor = ResourceProcessor(file_mapper, domain_context)
    html_processor = HTMLProcessor(file_mapper, domain_context, resource_processor)
    css_processor = CSSProcessor(file_mapper, domain_context, resource_processor)

    # Create controller
    controller = CrawlController(
        domain_context, url_queue, file_mapper,
        resource_processor, html_processor, css_processor
    )

    # Start crawl
    result = controller.crawl(
        start_url='https://example.com/docs/',
        max_depth=3,
        max_pages=100,
        fetcher_type='http'
    )
"""

# Only export classes, not instances
# Let applications initialize components themselves

__all__ = []

__version__ = '1.0.0'
