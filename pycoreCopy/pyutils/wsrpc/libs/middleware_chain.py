# -*- coding: utf-8 -*-
"""
Middleware Chain
Provides middleware chain functionality for request/response processing
"""

from typing import List, Callable, Any, Optional, Dict
from pycore.pyfoundations.color_print import ColorPrint


class MiddlewareChain:
    """Manages middleware execution chain"""

    def __init__(self):
        """Initialize middleware chain"""
        self.middlewares: List[Callable] = []
        self.error_handlers: List[Callable] = []

    def use(self, middleware: Callable) -> 'MiddlewareChain':
        """
        Add middleware to the chain

        Args:
            middleware: Middleware function

        Returns:
            Self for chaining
        """
        if not callable(middleware):
            ColorPrint.red("Middleware must be callable")
            return self

        self.middlewares.append(middleware)
        ColorPrint.debug(f"Middleware registered, total: {len(self.middlewares)}")
        return self

    def use_error(self, error_handler: Callable) -> 'MiddlewareChain':
        """
        Add error handler to the chain

        Args:
            error_handler: Error handler function

        Returns:
            Self for chaining
        """
        if not callable(error_handler):
            ColorPrint.red("Error handler must be callable")
            return self

        self.error_handlers.append(error_handler)
        ColorPrint.debug(f"Error handler registered, total: {len(self.error_handlers)}")
        return self

    async def execute(self, context: Dict, handler: Callable) -> Any:
        """
        Execute middleware chain

        Args:
            context: Request context
            handler: Final handler function

        Returns:
            Handler result
        """
        middlewares = list(self.middlewares)
        index = 0

        async def next_middleware():
            nonlocal index
            if index >= len(middlewares):
                return await handler(context)

            middleware = middlewares[index]
            index += 1

            try:
                return await middleware(context, next_middleware)
            except Exception as error:
                return await self._handle_error(error, context)

        try:
            return await next_middleware()
        except Exception as error:
            return await self._handle_error(error, context)

    async def _handle_error(self, error: Exception, context: Dict) -> Any:
        """
        Handle error through error handlers

        Args:
            error: Exception that occurred
            context: Request context

        Returns:
            Error handler result or raises error
        """
        for error_handler in self.error_handlers:
            try:
                result = await error_handler(error, context)
                if result is not None:
                    return result
            except Exception as handler_error:
                ColorPrint.red(f"Error in error handler: {handler_error}")

        raise error

    def clear(self):
        """Clear all middlewares and error handlers"""
        self.middlewares.clear()
        self.error_handlers.clear()
        ColorPrint.debug("Middleware chain cleared")

    def count(self) -> Dict[str, int]:
        """
        Get count of middlewares and error handlers

        Returns:
            Dictionary with counts
        """
        return {
            'middlewares': len(self.middlewares),
            'error_handlers': len(self.error_handlers)
        }
