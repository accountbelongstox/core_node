# -*- coding: utf-8 -*-
"""
Interceptor Manager
Manages request/response/error interceptors
"""

from typing import List, Callable, Optional, Any, Dict
from pycore.pyfoundations.color_print import ColorPrint


class InterceptorManager:
    """Manages interceptors for requests, responses, and errors"""

    def __init__(self):
        """Initialize interceptor manager"""
        self.request_interceptors: List[Dict] = []
        self.response_interceptors: List[Dict] = []
        self.error_interceptors: List[Dict] = []

    def add_request_interceptor(self, on_fulfilled: Callable, on_rejected: Optional[Callable] = None) -> int:
        """
        Add request interceptor

        Args:
            on_fulfilled: Function to call on successful request
            on_rejected: Function to call on rejected request

        Returns:
            Interceptor ID
        """
        interceptor_id = len(self.request_interceptors)
        self.request_interceptors.append({
            'id': interceptor_id,
            'on_fulfilled': on_fulfilled,
            'on_rejected': on_rejected
        })
        ColorPrint.debug(f"Request interceptor added: {interceptor_id}")
        return interceptor_id

    def add_response_interceptor(self, on_fulfilled: Callable, on_rejected: Optional[Callable] = None) -> int:
        """
        Add response interceptor

        Args:
            on_fulfilled: Function to call on successful response
            on_rejected: Function to call on rejected response

        Returns:
            Interceptor ID
        """
        interceptor_id = len(self.response_interceptors)
        self.response_interceptors.append({
            'id': interceptor_id,
            'on_fulfilled': on_fulfilled,
            'on_rejected': on_rejected
        })
        ColorPrint.debug(f"Response interceptor added: {interceptor_id}")
        return interceptor_id

    def add_error_interceptor(self, handler: Callable) -> int:
        """
        Add error interceptor

        Args:
            handler: Function to handle errors

        Returns:
            Interceptor ID
        """
        interceptor_id = len(self.error_interceptors)
        self.error_interceptors.append({
            'id': interceptor_id,
            'handler': handler
        })
        ColorPrint.debug(f"Error interceptor added: {interceptor_id}")
        return interceptor_id

    async def execute_request_interceptors(self, request: Any) -> Any:
        """
        Execute request interceptors

        Args:
            request: Request data

        Returns:
            Modified request data
        """
        result = request

        for interceptor in self.request_interceptors:
            try:
                if interceptor['on_fulfilled']:
                    result = await interceptor['on_fulfilled'](result)
            except Exception as error:
                if interceptor['on_rejected']:
                    result = await interceptor['on_rejected'](error)
                else:
                    ColorPrint.red(f"Request interceptor error: {error}")
                    raise

        return result

    async def execute_response_interceptors(self, response: Any) -> Any:
        """
        Execute response interceptors

        Args:
            response: Response data

        Returns:
            Modified response data
        """
        result = response

        for interceptor in self.response_interceptors:
            try:
                if interceptor['on_fulfilled']:
                    result = await interceptor['on_fulfilled'](result)
            except Exception as error:
                if interceptor['on_rejected']:
                    result = await interceptor['on_rejected'](error)
                else:
                    ColorPrint.red(f"Response interceptor error: {error}")
                    raise

        return result

    async def execute_error_interceptors(self, error: Exception, context: Optional[Dict] = None) -> Any:
        """
        Execute error interceptors

        Args:
            error: Exception that occurred
            context: Optional context data

        Returns:
            Modified error or result
        """
        context = context or {}
        result = error

        for interceptor in self.error_interceptors:
            try:
                handler_result = await interceptor['handler'](result, context)
                if handler_result is not None:
                    result = handler_result
            except Exception as handler_error:
                ColorPrint.red(f"Error interceptor failed: {handler_error}")

        return result

    def remove_request_interceptor(self, interceptor_id: int):
        """
        Remove request interceptor

        Args:
            interceptor_id: Interceptor ID to remove
        """
        self.request_interceptors = [
            i for i in self.request_interceptors if i['id'] != interceptor_id
        ]
        ColorPrint.debug(f"Request interceptor removed: {interceptor_id}")

    def remove_response_interceptor(self, interceptor_id: int):
        """
        Remove response interceptor

        Args:
            interceptor_id: Interceptor ID to remove
        """
        self.response_interceptors = [
            i for i in self.response_interceptors if i['id'] != interceptor_id
        ]
        ColorPrint.debug(f"Response interceptor removed: {interceptor_id}")

    def remove_error_interceptor(self, interceptor_id: int):
        """
        Remove error interceptor

        Args:
            interceptor_id: Interceptor ID to remove
        """
        self.error_interceptors = [
            i for i in self.error_interceptors if i['id'] != interceptor_id
        ]
        ColorPrint.debug(f"Error interceptor removed: {interceptor_id}")

    def clear_all(self):
        """Clear all interceptors"""
        self.request_interceptors.clear()
        self.response_interceptors.clear()
        self.error_interceptors.clear()
        ColorPrint.debug("All interceptors cleared")

    def get_count(self) -> Dict[str, int]:
        """
        Get count of interceptors

        Returns:
            Dictionary with counts
        """
        return {
            'request': len(self.request_interceptors),
            'response': len(self.response_interceptors),
            'error': len(self.error_interceptors)
        }
