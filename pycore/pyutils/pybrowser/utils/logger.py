#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Logger, Validator, RetryHandler, PerformanceMonitor

Utility classes for logging, validation, retries, and performance monitoring
"""

import time
import asyncio
from typing import Dict, Any, Callable, List
from datetime import datetime

from pycore.pyfoundations.color_print import ColorPrint


class Logger:
    def __init__(self, options: Dict[str, Any] = None):
        options = options or {}
        self.level = options.get('level', 'info')
        self.levels = {
            'error': 0,
            'warn': 1,
            'info': 2,
            'debug': 3
        }
        self.enabled = options.get('enabled', True)
        self.prefix = options.get('prefix', '')

    def log(self, level: str, message: str, *args):
        if not self.enabled or self.levels.get(level, 2) > self.levels.get(self.level, 2):
            return

        timestamp = datetime.now().isoformat()
        prefix = f'[{self.prefix}]' if self.prefix else ''
        log_message = f'{timestamp} {prefix} [{level.upper()}] {message}'

        if level == 'error':
            ColorPrint.red(log_message, *args)
        elif level == 'warn':
            ColorPrint.yellow(log_message, *args)
        elif level == 'info':
            ColorPrint.green(log_message, *args)
        else:
            ColorPrint.debug(log_message, *args)

    def error(self, message: str, *args):
        self.log('error', message, *args)

    def warn(self, message: str, *args):
        self.log('warn', message, *args)

    def info(self, message: str, *args):
        self.log('info', message, *args)

    def debug(self, message: str, *args):
        self.log('debug', message, *args)

    def set_level(self, level: str):
        if level in self.levels:
            self.level = level

    def set_enabled(self, enabled: bool):
        self.enabled = enabled

    def set_prefix(self, prefix: str):
        self.prefix = prefix


class Validator:
    @staticmethod
    def is_string(value):
        return isinstance(value, str)

    @staticmethod
    def is_number(value):
        return isinstance(value, (int, float)) and not isinstance(value, bool)

    @staticmethod
    def is_boolean(value):
        return isinstance(value, bool)

    @staticmethod
    def is_object(value):
        return isinstance(value, dict)

    @staticmethod
    def is_array(value):
        return isinstance(value, list)

    @staticmethod
    def is_function(value):
        return callable(value)

    @staticmethod
    def is_url(url):
        try:
            from urllib.parse import urlparse
            result = urlparse(url)
            return all([result.scheme, result.netloc])
        except Exception:
            return False

    @staticmethod
    def is_email(email):
        import re
        email_regex = r'^[^\s@]+@[^\s@]+\.[^\s@]+$'
        return bool(re.match(email_regex, email))

    @staticmethod
    def is_not_empty(value):
        if isinstance(value, str):
            return len(value.strip()) > 0
        if isinstance(value, list):
            return len(value) > 0
        if isinstance(value, dict):
            return len(value) > 0
        return value is not None

    @staticmethod
    def validate_config(config: Dict[str, Any], schema: Dict[str, Dict[str, Any]]):
        errors = []

        for key, rules in schema.items():
            value = config.get(key)

            if rules.get('required') and (value is None or value is None):
                errors.append(f'Required field \'{key}\' is missing')
                continue

            if value is not None:
                if 'type' in rules and not isinstance(value, rules['type']):
                    errors.append(f'Field \'{key}\' must be of type {rules["type"].__name__}')

                if 'min' in rules and value < rules['min']:
                    errors.append(f'Field \'{key}\' must be at least {rules["min"]}')

                if 'max' in rules and value > rules['max']:
                    errors.append(f'Field \'{key}\' must be at most {rules["max"]}')

                if 'pattern' in rules and not rules['pattern'].match(str(value)):
                    errors.append(f'Field \'{key}\' does not match required pattern')

                if 'validator' in rules and not rules['validator'](value):
                    errors.append(f'Field \'{key}\' failed custom validation')

        return {
            'isValid': len(errors) == 0,
            'errors': errors
        }


class RetryHandler:
    def __init__(self, options: Dict[str, Any] = None):
        options = options or {}
        self.max_attempts = options.get('maxAttempts', 3)
        self.delay = options.get('delay', 1000) / 1000
        self.backoff = options.get('backoff', 1.5)
        self.max_delay = options.get('maxDelay', 10000) / 1000
        self.retry_condition = options.get('retryCondition', lambda error: True)

    async def execute(self, fn: Callable, *args):
        last_error = None
        current_delay = self.delay

        for attempt in range(1, self.max_attempts + 1):
            try:
                if asyncio.iscoroutinefunction(fn):
                    result = await fn(*args)
                else:
                    result = fn(*args)
                return result
            except Exception as error:
                last_error = error

                if attempt == self.max_attempts or not self.retry_condition(error):
                    raise error

                ColorPrint.yellow(f'Attempt {attempt} failed, retrying in {current_delay}s: {str(error)}')
                await self.sleep(current_delay)

                current_delay = min(current_delay * self.backoff, self.max_delay)

        raise last_error

    async def sleep(self, seconds: float):
        await asyncio.sleep(seconds)

    @staticmethod
    def create(options: Dict[str, Any] = None):
        return RetryHandler(options)


class PerformanceMonitor:
    def __init__(self):
        self.metrics = {}
        self.timers = {}

    def start_timer(self, name: str):
        self.timers[name] = time.time() * 1000

    def end_timer(self, name: str):
        start_time = self.timers.get(name)
        if start_time:
            duration = (time.time() * 1000) - start_time
            del self.timers[name]
            self.record_metric(name, duration)
            return duration
        return None

    def record_metric(self, name: str, value: float):
        if name not in self.metrics:
            self.metrics[name] = []

        self.metrics[name].append({
            'value': value,
            'timestamp': time.time() * 1000
        })

    def get_metric(self, name: str):
        values = self.metrics.get(name, [])
        if len(values) == 0:
            return None

        numbers = [v['value'] for v in values]
        return {
            'count': len(numbers),
            'min': min(numbers),
            'max': max(numbers),
            'avg': sum(numbers) / len(numbers),
            'latest': numbers[-1]
        }

    def get_all_metrics(self):
        result = {}
        for name in self.metrics:
            result[name] = self.get_metric(name)
        return result

    def clear_metrics(self):
        self.metrics.clear()
        self.timers.clear()


__all__ = [
    'Logger',
    'Validator',
    'RetryHandler',
    'PerformanceMonitor'
]
