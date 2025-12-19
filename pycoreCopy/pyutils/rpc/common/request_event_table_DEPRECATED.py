#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Request Event Table - Stores request processing state

Manages request events with status tracking, client association,
and result storage for both HTTP and WebSocket requests.

Features:
- Request ID storage
- Status tracking (pending, processing, completed, failed)
- Client association (WebSocket client_id or HTTP session)
- Result storage
- Retry tracking
"""

import time
import threading
from typing import Dict, Optional, Any, List
from dataclasses import dataclass, field
from enum import Enum

from pycore import ColorPrint


class RequestStatus(Enum):
    """Request processing status"""
    PENDING = 'pending'
    PROCESSING = 'processing'
    COMPLETED = 'completed'
    FAILED = 'failed'
    NOTIFIED = 'notified'  # Successfully notified client
    ACK_PENDING = 'ack_pending'  # Waiting for client ACK confirmation
    ACK_RECEIVED = 'ack_received'  # Client confirmed receipt
    STORED = 'stored'  # Stored in inventory table after notification failure


@dataclass
class RequestEvent:
    """Request event data structure"""
    request_id: str
    route: str
    params: Dict[str, Any]
    client_id: Optional[str] = None
    client_type: str = 'unknown'  # 'websocket' or 'http'
    status: RequestStatus = RequestStatus.PENDING
    created_at: float = field(default_factory=time.time)
    started_at: Optional[float] = None
    completed_at: Optional[float] = None
    result: Optional[Any] = None
    error: Optional[str] = None
    retry_count: int = 0
    max_retries: int = 3
    retry_interval: float = 3.0
    last_notify_attempt: Optional[float] = None
    notify_attempts: int = 0


class RequestEventTable:
    """
    Request Event Table - Manages request processing events
    
    Stores all incoming requests with their processing state,
    allowing tracking, retry, and inventory storage.
    
    Usage:
        table = RequestEventTable(max_size=10000000)
        event = table.create_event(request_id, route, params, client_id, 'websocket')
        table.update_status(request_id, RequestStatus.PROCESSING)
        table.set_result(request_id, result)
    """
    
    def __init__(self, max_size: int = 10000000):
        """
        Initialize Request Event Table
        
        Args:
            max_size: Maximum number of events to store
        """
        self.max_size = max_size
        self.events: Dict[str, RequestEvent] = {}
        self._lock = threading.RLock()
        self._cleanup_running = False
    
    def create_event(
        self,
        request_id: str,
        route: str,
        params: Dict[str, Any],
        client_id: Optional[str] = None,
        client_type: str = 'unknown'
    ) -> RequestEvent:
        """
        Create a new request event
        
        Args:
            request_id: Request ID
            route: Route name
            params: Request parameters
            client_id: Client ID (WebSocket client_id or HTTP session_id)
            client_type: Client type ('websocket' or 'http')
            
        Returns:
            Created RequestEvent
        """
        with self._lock:
            # Check size limit
            if len(self.events) >= self.max_size:
                self._cleanup_oldest()
            
            event = RequestEvent(
                request_id=request_id,
                route=route,
                params=params,
                client_id=client_id,
                client_type=client_type,
                status=RequestStatus.PENDING
            )
            
            self.events[request_id] = event
            
            return event
    
    def get_event(self, request_id: str) -> Optional[RequestEvent]:
        """Get event by request ID"""
        with self._lock:
            return self.events.get(request_id)
    
    def has_event(self, request_id: str) -> bool:
        """Check if event exists"""
        with self._lock:
            return request_id in self.events
    
    def update_status(self, request_id: str, status: RequestStatus):
        """Update event status"""
        with self._lock:
            event = self.events.get(request_id)
            if event:
                event.status = status
                if status == RequestStatus.PROCESSING and not event.started_at:
                    event.started_at = time.time()
                elif status in [RequestStatus.COMPLETED, RequestStatus.FAILED]:
                    event.completed_at = time.time()
    
    def set_result(self, request_id: str, result: Any, error: Optional[str] = None):
        """
        Set request result
        
        Args:
            request_id: Request ID
            result: Result data
            error: Error message if failed
        """
        with self._lock:
            event = self.events.get(request_id)
            if event:
                event.result = result
                event.error = error
                if error:
                    event.status = RequestStatus.FAILED
                else:
                    event.status = RequestStatus.COMPLETED
                event.completed_at = time.time()
    
    def increment_notify_attempt(self, request_id: str) -> int:
        """Increment notification attempt count"""
        with self._lock:
            event = self.events.get(request_id)
            if event:
                event.notify_attempts += 1
                event.last_notify_attempt = time.time()
                return event.notify_attempts
            return 0
    
    def can_retry_notify(self, request_id: str) -> bool:
        """Check if notification can be retried"""
        with self._lock:
            event = self.events.get(request_id)
            if event:
                return event.notify_attempts < event.max_retries
            return False
    
    def mark_notified(self, request_id: str):
        """Mark event as successfully notified"""
        with self._lock:
            event = self.events.get(request_id)
            if event:
                event.status = RequestStatus.NOTIFIED
    
    def mark_stored(self, request_id: str):
        """Mark event as stored in inventory"""
        with self._lock:
            event = self.events.get(request_id)
            if event:
                event.status = RequestStatus.STORED
    
    def get_events_by_client(self, client_id: str) -> List[RequestEvent]:
        """Get all events for a client"""
        with self._lock:
            return [
                event for event in self.events.values()
                if event.client_id == client_id
            ]
    
    def get_pending_notifications(self, client_id: Optional[str] = None) -> List[RequestEvent]:
        """
        Get events that need notification
        
        Args:
            client_id: Optional client ID filter
            
        Returns:
            List of events that are completed but not notified
        """
        with self._lock:
            events = []
            for event in self.events.values():
                if event.status == RequestStatus.COMPLETED:
                    if client_id is None or event.client_id == client_id:
                        events.append(event)
            return events
    
    def delete_event(self, request_id: str) -> bool:
        """Delete event"""
        with self._lock:
            if request_id in self.events:
                del self.events[request_id]
                return True
            return False
    
    def _cleanup_oldest(self):
        """Remove oldest event when size limit reached"""
        if not self.events:
            return
        
        oldest_id = min(
            self.events.keys(),
            key=lambda k: self.events[k].created_at
        )
        del self.events[oldest_id]
    
    def cleanup(self, max_age: float = 3600.0) -> int:
        """
        Clean up old events
        
        Args:
            max_age: Maximum age in seconds
            
        Returns:
            Number of events cleaned
        """
        with self._lock:
            now = time.time()
            cleaned = 0
            expired_ids = []
            
            for request_id, event in self.events.items():
                # Clean up old notified/stored events
                if event.status in [RequestStatus.NOTIFIED, RequestStatus.STORED]:
                    if now - event.completed_at > max_age:
                        expired_ids.append(request_id)
                # Clean up very old pending/processing events (stuck requests)
                elif event.status in [RequestStatus.PENDING, RequestStatus.PROCESSING]:
                    if now - event.created_at > max_age * 2:
                        expired_ids.append(request_id)
            
            for request_id in expired_ids:
                del self.events[request_id]
                cleaned += 1
            
            # Also check size limit
            while len(self.events) > self.max_size:
                self._cleanup_oldest()
                cleaned += 1
            
            return cleaned
    
    def get_stats(self) -> Dict[str, Any]:
        """Get event table statistics"""
        with self._lock:
            stats = {
                'total': len(self.events),
                'max_size': self.max_size,
                'by_status': {},
                'by_client_type': {}
            }
            
            for event in self.events.values():
                status = event.status.value
                stats['by_status'][status] = stats['by_status'].get(status, 0) + 1
                
                client_type = event.client_type
                stats['by_client_type'][client_type] = stats['by_client_type'].get(client_type, 0) + 1
            
            return stats


# Default global request event table
default_request_event_table = RequestEventTable(max_size=10000000)

__all__ = ['RequestEventTable', 'RequestEvent', 'RequestStatus', 'default_request_event_table']

