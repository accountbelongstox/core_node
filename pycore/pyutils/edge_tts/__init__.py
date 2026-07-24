#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
TTS (Text-to-Speech) Utility Library

Provides comprehensive text-to-speech functionality including:
- Edge TTS integration (Windows/Linux compatible)
- Document parsing and sentence extraction
- Language detection and word extraction
- Thread-safe task queue
- Translation with MD5 caching
- File and web content parsing
"""

from pycore.pyutils.edge_tts.config import TTSConfig
from pycore.pyutils.common.tts_models import DocumentModel, SentenceModel, WordModel, ItemType, ItemStatus
from pycore.pyutils.common.tts_queue_ops import TTSQueueOps
from pycore.pyutils.edge_tts.edge_tts_client import EdgeTTSClient, get_edge_tts_client
from pycore.pyutils.edge_tts.processor import TTSProcessor
from pycore.pyutils.edge_tts.translator import TTSTranslator
from pycore.pyutils.edge_tts.parser import TTSFileParser
from pycore.pyutils.edge_tts.thread_manager import TTSThreadManager, get_tts_thread_manager
from pycore.pyutils.edge_tts.worker_thread_base import BaseTTSWorkerThread
from pycore.pyutils.edge_tts.edge_tts_worker_thread import EdgeTTSWorkerThread

__all__ = [
    'TTSConfig',
    'DocumentModel',
    'SentenceModel',
    'WordModel',
    'ItemType',
    'ItemStatus',
    'TTSQueueOps',
    'EdgeTTSClient',
    'get_edge_tts_client',
    'TTSProcessor',
    'TTSTranslator',
    'TTSFileParser',
    'TTSThreadManager',
    'get_tts_thread_manager',
    'BaseTTSWorkerThread',
    'EdgeTTSWorkerThread',
]
