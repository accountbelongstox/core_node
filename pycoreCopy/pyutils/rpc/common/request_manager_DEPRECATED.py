#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Request Manager - Shared request management for HTTP and WebSocket RPC

Manages RPC requests with retry logic, callbacks, and session tracking.
Shared between HTTP and WebSocket RPC implementations.

Reference: ncore/utils/rpc/common/request_manager.js
"""

import uuid
import time
import threading
from typing import Dict, Optional, Any, Callable, List

from pycore import ColorPrint


class RequestManager:
    """
    Request Manager - Manages RPC requests
    
    Features:
    - Request tracking with metadata
    - Retry logic
    - Callback registration
    - Session-based request grouping
    - Automatic cleanup
    
    Usage:
        manager = RequestManager()
        request_id = manager.create_request(session_id='session1')
        manager.register_callback(request_id, callback_function)
        manager.update_request_status(request_id, 'completed')
    """
    
    def __init__(self):
        """Initialize Request Manager"""
        self.requests: Dict[str, Dict[str, Any]] = {}
        self.callbacks: Dict[str, Dict[str, Any]] = {}
        self._lock = threading.RLock()
    
    def create_request(
        self,
        session_id: str,
        metadata: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        Create a new request
        
        Args:
            session_id: Session identifier
            metadata: Additional metadata
            
        Returns:
            Request ID
        """
        with self._lock:
            request_id = str(uuid.uuid4())
            
            self.requests[request_id] = {
                'id': request_id,
                'session_id': session_id,
                'created_at': time.time(),
                'status': 'pending',
                'retries': 0,
                'max_retries': 3,
                'retry_interval': 1.0,
                'metadata': metadata or {}
            }
            
            return request_id
    
    def get_request(self, request_id: str) -> Optional[Dict[str, Any]]:
        """Get request by ID"""
        with self._lock:
            return self.requests.get(request_id)
    
    def has_request(self, request_id: str) -> bool:
        """Check if request exists"""
        with self._lock:
            return request_id in self.requests
    
    def update_request_status(self, request_id: str, status: str):
        """Update request status"""
        with self._lock:
            request = self.requests.get(request_id)
            if request:
                request['status'] = status
                request['updated_at'] = time.time()
    
    def increment_retry(self, request_id: str) -> int:
        """Increment retry count"""
        with self._lock:
            request = self.requests.get(request_id)
            if request:
                request['retries'] += 1
                return request['retries']
            return 0
    
    def can_retry(self, request_id: str) -> bool:
        """Check if request can be retried"""
        with self._lock:
            request = self.requests.get(request_id)
            if request:
                return request['retries'] < request['max_retries']
            return False
    
    def register_callback(
        self,
        request_id: str,
        callback: Callable,
        context: Optional[Any] = None
    ) -> bool:
        """
        Register callback for request
        
        Args:
            request_id: Request ID
            callback: Callback function
            context: Optional context object
            
        Returns:
            True if registered
        """
        with self._lock:
            if not callable(callback):
                ColorPrint.red("[RequestManager] Callback must be callable")
                return False
            
            self.callbacks[request_id] = {
                'callback': callback,
                'context': context,
                'created_at': time.time()
            }
            
            return True
    
    async def execute_callback(
        self,
        request_id: str,
        data: Any,
        error: Optional[Exception] = None
    ) -> bool:
        """
        Execute callback for request
        
        Args:
            request_id: Request ID
            data: Response data
            error: Optional error
            
        Returns:
            True if executed
        """
        with self._lock:
            callback_info = self.callbacks.get(request_id)
            
            if not callback_info:
                ColorPrint.yellow(f"[RequestManager] No callback found for request {request_id}")
                return False
        
        try:
            callback = callback_info['callback']
            context = callback_info.get('context')
            
            if context:
                if error:
                    await callback(context, data, error)
                else:
                    await callback(context, data)
            else:
                if error:
                    await callback(data, error)
                else:
                    await callback(data)
            
            with self._lock:
                self.update_request_status(request_id, 'completed')
                self.callbacks.pop(request_id, None)
            
            return True
        
        except Exception as e:
            ColorPrint.red(f"[RequestManager] Callback execution error for {request_id}: {e}")
            return False
    
    def remove_request(self, request_id: str):
        """Remove request and its callback"""
        with self._lock:
            self.requests.pop(request_id, None)
            self.callbacks.pop(request_id, None)
    
    def get_requests_by_session(self, session_id: str) -> List[str]:
        """Get all request IDs for a session"""
        with self._lock:
            return [
                request_id
                for request_id, request in self.requests.items()
                if request.get('session_id') == session_id
            ]
    
    def remove_requests_by_session(self, session_id: str) -> int:
        """Remove all requests for a session"""
        with self._lock:
            request_ids = self.get_requests_by_session(session_id)
            for request_id in request_ids:
                self.remove_request(request_id)
            return len(request_ids)
    
    def cleanup(self, max_age: float = 1800.0) -> int:
        """
        Clean up old requests
        
        Args:
            max_age: Maximum age in seconds
            
        Returns:
            Number of requests cleaned
        """
        with self._lock:
            now = time.time()
            cleaned = 0
            expired_ids = []
            
            for request_id, request in self.requests.items():
                if now - request['created_at'] > max_age:
                    expired_ids.append(request_id)
            
            for request_id in expired_ids:
                self.remove_request(request_id)
                cleaned += 1
            
            return cleaned
    
    def get_stats(self) -> Dict[str, Any]:
        """Get request statistics"""
        with self._lock:
            stats = {
                'total': len(self.requests),
                'pending': 0,
                'completed': 0,
                'failed': 0,
                'callbacks': len(self.callbacks)
            }
            
            for request in self.requests.values():
                status = request.get('status', 'pending')
                if status == 'pending':
                    stats['pending'] += 1
                elif status == 'completed':
                    stats['completed'] += 1
                elif status == 'failed':
                    stats['failed'] += 1
            
            return stats


# Default global request manager instance
default_request_manager = RequestManager()

__all__ = ['RequestManager', 'default_request_manager']

