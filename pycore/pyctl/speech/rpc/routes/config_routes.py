#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Config Management RPC Routes

Global configuration management for speech service.
Stores settings in database for persistence.

Endpoints:
- config.get: Get configuration value(s)
- config.set: Set configuration value
- config.get_all: Get all configurations
- config.reset: Reset to defaults
"""

from typing import Dict, Any

from pycore.pyfoundations import ColorPrint


def register_config_routes(rpc_server, service_instances: Dict[str, Any]):
    """
    Register configuration management routes

    Args:
        rpc_server: ThreadedRpcServer instance
        service_instances: Dict with service instances
    """

    def handle_config_get(params: Dict, request_id: str, context: Dict) -> Dict[str, Any]:
        """
        Get configuration value(s)

        Request Parameters:
            key (str, optional): Configuration key. If not provided, returns all configs
            namespace (str, optional): Config namespace (default: 'speech')

        Returns:
            {
                "success": true,
                "config": {...} or "value": "..."
            }
        """
        from pycore.pyutils.common import global_config

        key = params.get('key')
        namespace = params.get('namespace', 'speech')

        if key:
            # Get specific key
            value = global_config.get(key)
            return {
                'success': True,
                'key': key,
                'value': value
            }
        else:
            # Get all configs
            all_configs = global_config.get_all()
            return {
                'success': True,
                'config': all_configs
            }

    def handle_config_set(params: Dict, request_id: str, context: Dict) -> Dict[str, Any]:
        """
        Set configuration value

        Request Parameters:
            key (str, required): Configuration key
            value (any, required): Configuration value
            namespace (str, optional): Config namespace (default: 'speech')

        Returns:
            {
                "success": true,
                "message": "Configuration updated"
            }
        """
        from pycore.pyutils.common import global_config

        key = params.get('key')
        value = params.get('value')

        if not key:
            return {'success': False, 'error': 'key is required'}

        if value is None:
            return {'success': False, 'error': 'value is required'}

        # Set configuration
        try:
            global_config.set(key, value)
            ColorPrint.green(f"[Config] Set {key} = {value}")

            return {
                'success': True,
                'message': 'Configuration updated',
                'key': key,
                'value': value
            }
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def handle_config_get_all(params: Dict, request_id: str, context: Dict) -> Dict[str, Any]:
        """
        Get all configurations

        Returns:
            {
                "success": true,
                "config": {
                    "speech_default_language": "zh-CN",
                    "speech_default_device": null,
                    ...
                }
            }
        """
        from pycore.pyutils.common import global_config

        try:
            all_configs = global_config.get_all()
            return {
                'success': True,
                'config': all_configs
            }
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def handle_config_reset(params: Dict, request_id: str, context: Dict) -> Dict[str, Any]:
        """
        Reset configuration to defaults

        Request Parameters:
            key (str, optional): Specific key to reset. If not provided, resets all

        Returns:
            {
                "success": true,
                "message": "Configuration reset to defaults"
            }
        """
        from pycore.pyutils.common import global_config

        key = params.get('key')

        try:
            if key:
                # Reset specific key
                # Get default value from DEFAULT_CONFIG
                if hasattr(global_config, 'DEFAULT_CONFIG'):
                    default_value = global_config.DEFAULT_CONFIG.get(key)
                    if default_value is not None:
                        global_config.set(key, default_value)
                        return {
                            'success': True,
                            'message': f'Configuration key "{key}" reset to default',
                            'key': key,
                            'value': default_value
                        }
                    else:
                        return {'success': False, 'error': f'No default value for key: {key}'}
                else:
                    return {'success': False, 'error': 'Default configuration not available'}
            else:
                # Reset all to defaults
                if hasattr(global_config, 'reset_to_defaults'):
                    global_config.reset_to_defaults()
                    return {
                        'success': True,
                        'message': 'All configurations reset to defaults'
                    }
                else:
                    return {'success': False, 'error': 'Reset function not available'}

        except Exception as e:
            return {'success': False, 'error': str(e)}

    # Register routes
    rpc_server.route('config.get', handle_config_get)
    rpc_server.route('config.set', handle_config_set)
    rpc_server.route('config.get_all', handle_config_get_all)
    rpc_server.route('config.reset', handle_config_reset)

    ColorPrint.green("[Config Routes] Registered:")
    ColorPrint.blue("  - config.get")
    ColorPrint.blue("  - config.set")
    ColorPrint.blue("  - config.get_all")
    ColorPrint.blue("  - config.reset")


__all__ = ['register_config_routes']
