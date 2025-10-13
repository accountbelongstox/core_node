#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Task Thread Manager
Manages background task threads for ROSBOT operations and other tasks
"""
import os
import sys
import time
import threading
import queue
from typing import Dict, Any, Callable, Optional
from enum import Enum
from providor.common_imports import ColorPrint


class TaskStatus(Enum):
    """Task execution status"""
    DISABLED = "disabled"
    ENABLED = "enabled"
    RUNNING = "running"
    ERROR = "error"


class TaskThread:
    """Individual task thread"""
    
    def __init__(self, name: str, task_func: Callable, interval: float = 1.0):
        self.name = name
        self.task_func = task_func
        self.interval = interval
        self.status = TaskStatus.DISABLED
        self.thread: Optional[threading.Thread] = None
        self.stop_event = threading.Event()
        self.last_run = 0.0
        self.error_count = 0
        self.lock = threading.Lock()
        
        ColorPrint.blue(f"[TaskThread] Created task thread: {name}")
    
    def start(self):
        """Start the task thread"""
        with self.lock:
            if self.thread is None or not self.thread.is_alive():
                self.stop_event.clear()
                self.thread = threading.Thread(target=self._run, daemon=True)
                self.thread.start()
                ColorPrint.green(f"[TaskThread] Started task thread: {self.name}")
    
    def stop(self):
        """Stop the task thread"""
        with self.lock:
            self.stop_event.set()
            if self.thread and self.thread.is_alive():
                self.thread.join(timeout=2.0)
                ColorPrint.yellow(f"[TaskThread] Stopped task thread: {self.name}")
    
    def set_status(self, status: TaskStatus):
        """Set task status"""
        with self.lock:
            self.status = status
            ColorPrint.blue(f"[TaskThread] Task '{self.name}' status: {status.value}")
    
    def _run(self):
        """Main task thread loop"""
        ColorPrint.blue(f"[TaskThread] Task thread '{self.name}' started")
        
        while not self.stop_event.is_set():
            try:
                current_time = time.time()
                
                # Check if task should run
                if (self.status == TaskStatus.ENABLED and 
                    current_time - self.last_run >= self.interval):
                    
                    self.status = TaskStatus.RUNNING
                    self.task_func()
                    self.last_run = current_time
                    self.error_count = 0
                    self.status = TaskStatus.ENABLED
                
                # Sleep for a short time to prevent busy waiting
                time.sleep(0.1)
                
            except Exception as e:
                self.error_count += 1
                self.status = TaskStatus.ERROR
                ColorPrint.red(f"[TaskThread] Error in task '{self.name}': {e}")
                
                # Disable task after 5 consecutive errors
                if self.error_count >= 5:
                    ColorPrint.red(f"[TaskThread] Task '{self.name}' disabled after {self.error_count} errors")
                    self.status = TaskStatus.DISABLED
                    break
                
                time.sleep(1.0)  # Wait before retrying
        
        ColorPrint.yellow(f"[TaskThread] Task thread '{self.name}' ended")


class TaskThreadManager:
    """Manages all task threads"""
    
    def __init__(self):
        self.tasks: Dict[str, TaskThread] = {}
        self.lock = threading.Lock()
        self.running = False
        
        ColorPrint.blue("[TaskThreadManager] Initialized")
    
    def register_task(self, name: str, task_func: Callable, interval: float = 1.0) -> bool:
        """Register a new task thread"""
        with self.lock:
            if name in self.tasks:
                ColorPrint.yellow(f"[TaskThreadManager] Task '{name}' already exists")
                return False
            
            self.tasks[name] = TaskThread(name, task_func, interval)
            ColorPrint.blue(f"[TaskThreadManager] Registered task: {name}")
            return True
    
    def start_task(self, name: str) -> bool:
        """Start a specific task thread"""
        with self.lock:
            if name not in self.tasks:
                ColorPrint.yellow(f"[TaskThreadManager] Task '{name}' not found")
                return False
            
            task = self.tasks[name]
            task.start()
            return True
    
    def stop_task(self, name: str) -> bool:
        """Stop a specific task thread"""
        with self.lock:
            if name not in self.tasks:
                ColorPrint.yellow(f"[TaskThreadManager] Task '{name}' not found")
                return False
            
            task = self.tasks[name]
            task.stop()
            return True
    
    def set_task_status(self, name: str, status: TaskStatus) -> bool:
        """Set task status"""
        with self.lock:
            if name not in self.tasks:
                ColorPrint.yellow(f"[TaskThreadManager] Task '{name}' not found")
                return False
            
            task = self.tasks[name]
            task.set_status(status)
            return True
    
    def set_task_interval(self, name: str, interval: float) -> bool:
        """Set task interval"""
        with self.lock:
            if name not in self.tasks:
                ColorPrint.yellow(f"[TaskThreadManager] Task '{name}' not found")
                return False
            
            task = self.tasks[name]
            task.interval = interval
            ColorPrint.blue(f"[TaskThreadManager] Task '{name}' interval set to {interval}s")
            return True
    
    def start_all(self):
        """Start all registered task threads"""
        with self.lock:
            for task in self.tasks.values():
                task.start()
            self.running = True
            ColorPrint.green("[TaskThreadManager] All task threads started")
    
    def stop_all(self):
        """Stop all task threads"""
        with self.lock:
            for task in self.tasks.values():
                task.stop()
            self.running = False
            ColorPrint.yellow("[TaskThreadManager] All task threads stopped")
    
    def get_task_status(self, name: str) -> Optional[TaskStatus]:
        """Get task status"""
        with self.lock:
            if name not in self.tasks:
                return None
            return self.tasks[name].status


# Global instance
_task_manager = None


def get_task_manager() -> TaskThreadManager:
    """Get global task thread manager instance"""
    global _task_manager
    if _task_manager is None:
        _task_manager = TaskThreadManager()
    return _task_manager


def register_task(name: str, task_func: Callable, interval: float = 1.0) -> bool:
    """Register a new task thread"""
    return get_task_manager().register_task(name, task_func, interval)


def start_task(name: str) -> bool:
    """Start a specific task thread"""
    return get_task_manager().start_task(name)


def stop_task(name: str) -> bool:
    """Stop a specific task thread"""
    return get_task_manager().stop_task(name)


def set_task_status(name: str, status: TaskStatus) -> bool:
    """Set task status"""
    return get_task_manager().set_task_status(name, status)


def set_task_interval(name: str, interval: float) -> bool:
    """Set task interval"""
    return get_task_manager().set_task_interval(name, interval)


def start_all_tasks():
    """Start all registered task threads"""
    get_task_manager().start_all()


def stop_all_tasks():
    """Stop all task threads"""
    get_task_manager().stop_all()


def get_task_status(name: str) -> Optional[TaskStatus]:
    """Get task status"""
    return get_task_manager().get_task_status(name)
