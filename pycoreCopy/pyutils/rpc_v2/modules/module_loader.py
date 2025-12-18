#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
模块加载器 - 预加载和缓存模块实例

功能:
1. 启动时预加载标记为preload的模块
2. 缓存模块实例,避免频繁初始化第三方库
3. 单例模式管理,确保全局只有一个实例
"""

import importlib
import asyncio
from typing import Dict, Any, Optional

from pycore import ColorPrint
from .module_registry import SUPPORTED_MODULES, get_module_info


class ModuleLoader:
    """模块加载器 - 管理模块的加载、缓存和实例化"""
    
    def __init__(self, debug: bool = False):
        self.debug = debug
        self._loaded_modules: Dict[str, Any] = {}      # 缓存已加载的模块
        self._instances: Dict[str, Any] = {}            # 缓存模块实例
        self._context_managers: Dict[str, Any] = {}     # 缓存上下文管理器
        
        if self.debug:
            ColorPrint.blue("[ModuleLoader] Initialized")
    
    def preload_modules(self):
        """预加载所有标记为preload的模块"""
        preload_count = 0
        
        for module_name, config in SUPPORTED_MODULES.items():
            if config.get("preload", False):
                try:
                    self.load_module(module_name)
                    preload_count += 1
                    if self.debug:
                        ColorPrint.green(f"[ModuleLoader] Preloaded module: {module_name}")
                except Exception as e:
                    ColorPrint.red(f"[ModuleLoader] Failed to preload module {module_name}: {e}")
        
        ColorPrint.blue(f"[ModuleLoader] Preloaded {preload_count} modules")
    
    def load_module(self, module_name: str) -> Any:
        """
        加载模块(带缓存)
        
        Args:
            module_name: 模块名称
            
        Returns:
            加载的模块对象
            
        Raises:
            ValueError: 模块不在注册表中
            ImportError: 模块导入失败
        """
        # 检查缓存
        if module_name in self._loaded_modules:
            if self.debug:
                ColorPrint.blue(f"[ModuleLoader] Using cached module: {module_name}")
            return self._loaded_modules[module_name]
        
        # 获取配置
        config = get_module_info(module_name)
        if not config:
            raise ValueError(
                f"Module '{module_name}' not in registry. "
                f"Supported modules: {list(SUPPORTED_MODULES.keys())}"
            )
        
        module_path = config["module_path"]
        
        # 导入模块
        if self.debug:
            ColorPrint.blue(f"[ModuleLoader] Loading module: {module_name} from {module_path}")
        
        try:
            module = importlib.import_module(module_path)
            self._loaded_modules[module_name] = module
            
            if self.debug:
                ColorPrint.green(f"[ModuleLoader] Loaded module: {module_name}")
            
            return module
        except ImportError as e:
            ColorPrint.red(f"[ModuleLoader] Failed to import {module_path}: {e}")
            raise
    
    def get_instance(self, module_name: str) -> Any:
        """
        获取模块实例(单例模式)
        
        Args:
            module_name: 模块名称
            
        Returns:
            模块实例
            
        Raises:
            ValueError: 模块不在注册表中
            AttributeError: 模块没有指定的类
        """
        config = get_module_info(module_name)
        if not config:
            raise ValueError(f"Module '{module_name}' not in registry")
        
        # 检查是否使用单例
        is_singleton = config.get("singleton", True)
        
        # 如果是单例且已缓存,返回缓存实例
        if is_singleton and module_name in self._instances:
            if self.debug:
                ColorPrint.blue(f"[ModuleLoader] Using cached instance: {module_name}")
            return self._instances[module_name]
        
        # 加载模块
        module = self.load_module(module_name)
        
        # 获取类
        class_name = config.get("class_name")
        if not class_name:
            raise ValueError(f"Module '{module_name}' has no class_name specified")
        
        try:
            cls = getattr(module, class_name)
        except AttributeError:
            raise AttributeError(
                f"Module '{config['module_path']}' has no class '{class_name}'"
            )
        
        # 创建实例
        if self.debug:
            ColorPrint.blue(f"[ModuleLoader] Creating instance of {class_name}")
        
        instance = cls()
        
        # 如果是单例,缓存实例
        if is_singleton:
            self._instances[module_name] = instance
            if self.debug:
                ColorPrint.green(f"[ModuleLoader] Cached instance: {module_name}")
        
        return instance
    
    async def get_async_context(self, module_name: str) -> Any:
        """
        获取异步上下文管理器(用于async with)
        
        Args:
            module_name: 模块名称
            
        Returns:
            异步上下文管理器
        """
        instance = self.get_instance(module_name)
        
        # 如果实例支持异步上下文管理器
        if hasattr(instance, '__aenter__') and hasattr(instance, '__aexit__'):
            # 对于需要context的模块(如GoogleTranslator),每次调用都创建新的context
            if self.debug:
                ColorPrint.blue(f"[ModuleLoader] Entering async context for {module_name}")
            return instance
        
        # 如果不支持,直接返回实例
        return instance
    
    def unload_module(self, module_name: str):
        """
        卸载模块(清除缓存)
        
        Args:
            module_name: 模块名称
        """
        if module_name in self._instances:
            del self._instances[module_name]
            if self.debug:
                ColorPrint.blue(f"[ModuleLoader] Unloaded instance: {module_name}")
        
        if module_name in self._loaded_modules:
            del self._loaded_modules[module_name]
            if self.debug:
                ColorPrint.blue(f"[ModuleLoader] Unloaded module: {module_name}")
    
    def clear_cache(self):
        """清除所有缓存"""
        self._instances.clear()
        self._loaded_modules.clear()
        self._context_managers.clear()
        
        if self.debug:
            ColorPrint.blue("[ModuleLoader] Cleared all caches")
    
    def get_loaded_modules(self) -> list[str]:
        """获取已加载的模块列表"""
        return list(self._loaded_modules.keys())
    
    def get_cached_instances(self) -> list[str]:
        """获取已缓存的实例列表"""
        return list(self._instances.keys())


# 全局单例
_module_loader: Optional[ModuleLoader] = None


def get_module_loader(debug: bool = False) -> ModuleLoader:
    """
    获取全局模块加载器单例
    
    Args:
        debug: 是否启用调试模式
        
    Returns:
        ModuleLoader实例
    """
    global _module_loader
    
    if _module_loader is None:
        _module_loader = ModuleLoader(debug=debug)
    
    return _module_loader


__all__ = ['ModuleLoader', 'get_module_loader']
