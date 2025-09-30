#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import random
import time
from typing import Union


class RandomUtils:
    @staticmethod
    def random_int(min_val: int, max_val: int) -> int:
        """Generate random integer between min_val and max_val (inclusive)"""
        return random.randint(min_val, max_val)
    
    @staticmethod
    def random_float(min_val: float, max_val: float) -> float:
        """Generate random float between min_val and max_val"""
        return random.uniform(min_val, max_val)
    
    @staticmethod
    def random_range(min_val: Union[int, float], max_val: Union[int, float]) -> Union[int, float]:
        """Generate random number in range, return int if both inputs are int, float otherwise"""
        if isinstance(min_val, int) and isinstance(max_val, int):
            return random.randint(min_val, max_val)
        return random.uniform(float(min_val), float(max_val))
    
    @staticmethod
    def random_choice(choices: list):
        """Choose random element from list"""
        return random.choice(choices)
    
    @staticmethod
    def random_bool() -> bool:
        """Generate random boolean"""
        return random.choice([True, False])
    
    @staticmethod
    def random_delay(min_seconds: float = 0.1, max_seconds: float = 1.0):
        """Sleep for random duration"""
        delay = random.uniform(min_seconds, max_seconds)
        time.sleep(delay)
        return delay 