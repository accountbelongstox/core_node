"""
AI Collaboration MCP Server Package
Multi-AI collaboration service with role management, logging, and Q&A
"""

from .constants import AICollaborationConstants
from .storage import StorageManager
from .role_manager import RoleManager
from .message_queue import MessageQueue
from .qa_system import QASystem

__version__ = "1.0.0"
__all__ = [
    'AICollaborationConstants',
    'StorageManager',
    'RoleManager',
    'MessageQueue',
    'QASystem'
]
