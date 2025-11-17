#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
DocumentOffline Controller Components

Controller layer for document offline downloads:
- CrawlController: Orchestrates the crawling and processing pipeline
- CLIController: Command-line interface for document downloads

Usage:
    from pycore.pyctl.document_offline.controller import (
        CrawlController, CLIController
    )

    # Option 1: Use CrawlController programmatically
    controller = CrawlController(
        domain_context,
        url_queue,
        file_mapper,
        resource_processor,
        html_processor,
        css_processor
    )

    result = controller.crawl(
        start_url='https://example.com/docs/',
        max_depth=3,
        max_pages=100,
        fetcher_type='http'
    )

    # Option 2: Use CLIController from command line
    # python -m pycore.pyctl.document_offline.controller.cli_controller \\
    #     --url https://example.com/docs/ \\
    #     --output ./downloads \\
    #     --depth 5 \\
    #     --max-pages 500
"""

from pycore.pyctl.document_offline.controller.crawl_controller import CrawlController
from pycore.pyctl.document_offline.controller.cli_controller import CLIController

__all__ = [
    'CrawlController',
    'CLIController'
]

__version__ = '1.0.0'
