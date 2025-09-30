#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Enhanced Error Handler Base Class
Provides comprehensive error handling, recovery, and reporting functionality
No dependencies on other project modules
"""

import os
import sys
import time
import traceback
import functools
from typing import Dict, List, Optional, Any, Callable
from datetime import datetime
from dataclasses import dataclass, field


@dataclass
class ErrorInfo:
    """Information about an error occurrence"""
    error_type: str
    error_message: str
    timestamp: datetime = field(default_factory=datetime.now)
    traceback_info: str = ""
    context: Dict[str, Any] = field(default_factory=dict)
    retry_count: int = 0
    recovered: bool = False
    recovery_method: str = ""


class ErrorHandler:
    """
    Enhanced error handler with retry, recovery, and detailed reporting
    Base class with no external dependencies
    """
    
    def __init__(self, max_retries: int = 3, retry_delay: float = 2.0, 
                 detailed_logging: bool = True, auto_recovery: bool = True):
        """Initialize error handler"""
        self.max_retries = max_retries
        self.retry_delay = retry_delay
        self.detailed_logging = detailed_logging
        self.auto_recovery = auto_recovery
        
        # Error tracking
        self.error_history: List[ErrorInfo] = []
        self.error_counts: Dict[str, int] = {}
        
        # Recovery strategies
        self.recovery_strategies: Dict[str, Callable] = {}
        
        print(f"[ERROR_HANDLER] Initialized with max_retries={max_retries}, retry_delay={retry_delay}s")
    
    def register_recovery_strategy(self, error_type: str, recovery_func: Callable):
        """Register a recovery strategy for a specific error type"""
        self.recovery_strategies[error_type] = recovery_func
        print(f"[ERROR_HANDLER] Registered recovery strategy for {error_type}")
    
    def handle_error(self, error: Exception, context: Dict[str, Any] = None, 
                    operation_name: str = "unknown") -> ErrorInfo:
        """Handle an error with detailed logging and tracking"""
        error_type = type(error).__name__
        error_message = str(error)
        
        if context is None:
            context = {}
        
        # Create error info
        error_info = ErrorInfo(
            error_type=error_type,
            error_message=error_message,
            traceback_info=traceback.format_exc() if self.detailed_logging else "",
            context=context
        )
        
        # Track error
        self.error_history.append(error_info)
        self.error_counts[error_type] = self.error_counts.get(error_type, 0) + 1
        
        # Log error
        self._log_error(error_info, operation_name)
        
        # Attempt recovery if enabled
        if self.auto_recovery and error_type in self.recovery_strategies:
            try:
                recovery_func = self.recovery_strategies[error_type]
                recovery_result = recovery_func(error, context)
                
                if recovery_result:
                    error_info.recovered = True
                    error_info.recovery_method = recovery_func.__name__
                    print(f"[ERROR_RECOVERY] ✓ Recovered from {error_type} using {recovery_func.__name__}")
                else:
                    print(f"[ERROR_RECOVERY] ✗ Recovery failed for {error_type}")
            except Exception as recovery_error:
                print(f"[ERROR_RECOVERY] ✗ Recovery strategy failed: {recovery_error}")
        
        return error_info
    
    def _log_error(self, error_info: ErrorInfo, operation_name: str):
        """Log error information"""
        timestamp = error_info.timestamp.strftime("%Y-%m-%d %H:%M:%S")
        
        print(f"[ERROR] {timestamp} - {operation_name}")
        print(f"[ERROR] Type: {error_info.error_type}")
        print(f"[ERROR] Message: {error_info.error_message}")
        
        if error_info.context:
            print(f"[ERROR] Context: {error_info.context}")
        
        if self.detailed_logging and error_info.traceback_info:
            print(f"[ERROR] Traceback:")
            for line in error_info.traceback_info.split('\n')[:10]:  # Limit traceback lines
                if line.strip():
                    print(f"[ERROR]   {line}")
    
    def retry_with_backoff(self, func: Callable, *args, **kwargs) -> Any:
        """Execute function with retry and exponential backoff"""
        last_error = None
        
        for attempt in range(self.max_retries + 1):
            try:
                if attempt > 0:
                    delay = self.retry_delay * (2 ** (attempt - 1))  # Exponential backoff
                    print(f"[RETRY] Attempt {attempt + 1}/{self.max_retries + 1} after {delay}s delay")
                    time.sleep(delay)
                
                result = func(*args, **kwargs)
                
                if attempt > 0:
                    print(f"[RETRY] ✓ Success on attempt {attempt + 1}")
                
                return result
                
            except Exception as e:
                last_error = e
                error_info = self.handle_error(e, {"attempt": attempt + 1, "function": func.__name__})
                error_info.retry_count = attempt
                
                if attempt < self.max_retries:
                    print(f"[RETRY] ✗ Attempt {attempt + 1} failed: {e}")
                else:
                    print(f"[RETRY] ✗ All {self.max_retries + 1} attempts failed")
        
        # All retries failed
        raise last_error
    
    def safe_execute(self, func: Callable, default_return=None, 
                    context: Dict[str, Any] = None) -> Any:
        """Safely execute function with error handling"""
        try:
            return func()
        except Exception as e:
            self.handle_error(e, context, func.__name__)
            return default_return
    
    def get_error_summary(self) -> Dict[str, Any]:
        """Get summary of error history"""
        total_errors = len(self.error_history)
        recovered_errors = sum(1 for e in self.error_history if e.recovered)
        
        recent_errors = [e for e in self.error_history 
                        if (datetime.now() - e.timestamp).total_seconds() < 3600]  # Last hour
        
        return {
            "total_errors": total_errors,
            "recovered_errors": recovered_errors,
            "recovery_rate": recovered_errors / total_errors if total_errors > 0 else 0,
            "recent_errors": len(recent_errors),
            "error_types": dict(self.error_counts),
            "most_common_error": max(self.error_counts.items(), key=lambda x: x[1])[0] if self.error_counts else None
        }
    
    def print_error_report(self):
        """Print comprehensive error report"""
        summary = self.get_error_summary()
        
        print("=" * 60)
        print("[ERROR_REPORT] Error Handler Summary")
        print("-" * 30)
        print(f"Total Errors: {summary['total_errors']}")
        print(f"Recovered Errors: {summary['recovered_errors']}")
        print(f"Recovery Rate: {summary['recovery_rate']:.1%}")
        print(f"Recent Errors (1h): {summary['recent_errors']}")
        
        if summary['most_common_error']:
            print(f"Most Common Error: {summary['most_common_error']}")
        
        print("\nError Types:")
        for error_type, count in summary['error_types'].items():
            print(f"  {error_type}: {count}")
        
        if self.error_history:
            print(f"\nRecent Errors:")
            for error in self.error_history[-5:]:  # Last 5 errors
                timestamp = error.timestamp.strftime("%H:%M:%S")
                status = "✓ Recovered" if error.recovered else "✗ Failed"
                print(f"  {timestamp} - {error.error_type}: {error.error_message[:50]}... {status}")
        
        print("=" * 60)
    
    def clear_error_history(self):
        """Clear error history"""
        cleared_count = len(self.error_history)
        self.error_history.clear()
        self.error_counts.clear()
        print(f"[ERROR_HANDLER] Cleared {cleared_count} errors from history")


def with_error_handling(error_handler: ErrorHandler, default_return=None, 
                       context: Dict[str, Any] = None):
    """Decorator for automatic error handling"""
    def decorator(func: Callable):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            try:
                return func(*args, **kwargs)
            except Exception as e:
                error_handler.handle_error(e, context, func.__name__)
                return default_return
        return wrapper
    return decorator


def with_retry(error_handler: ErrorHandler):
    """Decorator for automatic retry with error handling"""
    def decorator(func: Callable):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            return error_handler.retry_with_backoff(func, *args, **kwargs)
        return wrapper
    return decorator


# Global error handler instance
GLOBAL_ERROR_HANDLER = ErrorHandler()


def main():
    """Test function"""
    error_handler = ErrorHandler(max_retries=2, retry_delay=1.0)
    
    # Test error handling
    def failing_function():
        raise ValueError("Test error")
    
    def sometimes_failing_function():
        import random
        if random.random() < 0.7:
            raise ConnectionError("Random connection error")
        return "Success!"
    
    # Test safe execution
    result = error_handler.safe_execute(failing_function, "default_value")
    print(f"Safe execute result: {result}")
    
    # Test retry
    try:
        result = error_handler.retry_with_backoff(sometimes_failing_function)
        print(f"Retry result: {result}")
    except Exception as e:
        print(f"Retry failed: {e}")
    
    # Print error report
    error_handler.print_error_report()


if __name__ == "__main__":
    main()
