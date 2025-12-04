"""Base handler for unified WebSocket namespaces"""

from typing import Dict, Any, Optional, Callable
from fastapi import WebSocket
from abc import ABC, abstractmethod


class BaseHandler(ABC):
    """
    Base handler for WebSocket namespace

    Each namespace (device, screen, file, etc.) implements this interface.
    """

    def __init__(self):
        self.actions: Dict[str, Callable] = {}
        self._register_actions()

    @abstractmethod
    def _register_actions(self):
        """
        Register action handlers

        Example:
            self.actions['list'] = self.handle_list
            self.actions['get'] = self.handle_get
        """
        pass

    async def handle(self, action: str, data: Optional[Dict[str, Any]], websocket: WebSocket) -> Dict[str, Any]:
        """
        Handle a request

        Args:
            action: Action name (e.g., 'list', 'get', 'create')
            data: Request data
            websocket: WebSocket connection

        Returns:
            Response data dict
        """
        handler = self.actions.get(action)

        if not handler:
            return {
                'error': {
                    'code': 'ACTION_NOT_FOUND',
                    'message': f'Action {action} not found in namespace {self.__class__.__name__}'
                }
            }

        try:
            return await handler(data or {}, websocket)
        except Exception as e:
            return {
                'error': {
                    'code': 'HANDLER_ERROR',
                    'message': str(e)
                }
            }


class HandlerRegistry:
    """Registry for namespace handlers"""

    def __init__(self):
        self.handlers: Dict[str, BaseHandler] = {}

    def register(self, namespace: str, handler: BaseHandler):
        """Register a namespace handler"""
        self.handlers[namespace] = handler

    def get(self, namespace: str) -> Optional[BaseHandler]:
        """Get a namespace handler"""
        return self.handlers.get(namespace)

    def has(self, namespace: str) -> bool:
        """Check if namespace is registered"""
        return namespace in self.handlers
