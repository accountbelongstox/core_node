# -*- coding: utf-8 -*-
"""
WebSocket RPC Server Example
Demonstrates how to use the PyWSRPC server
"""

import asyncio
from pycore.pyfoundations.color_print import ColorPrint
from pycore.pyutils.wsrpc import WsRpcServer


async def main():
    """Main server example"""

    # Create server with options
    server = WsRpcServer({
        'port': 8080,
        'host': '0.0.0.0',
        'debug': True,
        'auth': {
            'enabled': True,
            'handler': async_auth_handler
        },
        'rate_limit': {
            'enabled': True,
            'max_requests': 100,
            'window_ms': 60000
        },
        'compression': {
            'enabled': True,
            'threshold': 1024
        }
    })

    # Register routes
    server.route('echo', echo_handler)
    server.route('add', add_handler)
    server.route('get_time', get_time_handler)

    # Register event handlers
    server.on('connection', on_client_connected)
    server.on('disconnect', on_client_disconnected)
    server.on('custom_event', on_custom_event)

    # Add middleware
    server.use(logging_middleware)
    server.use_error(error_handler_middleware)

    # Add interceptors
    server.add_request_interceptor(request_interceptor)
    server.add_response_interceptor(response_interceptor)

    # Create namespaces
    server.create_namespace('chat')
    server.create_namespace('notifications')

    # Start server
    ColorPrint.print_header("WebSocket RPC Server Example")
    ColorPrint.green("Starting server on ws://0.0.0.0:8080")

    await server.start()

    try:
        # Keep server running
        while True:
            await asyncio.sleep(10)

            # Print statistics
            stats = server.get_all_stats()
            ColorPrint.print_section("Server Statistics")
            ColorPrint.blue(f"Connected clients: {stats['client_count']}")
            ColorPrint.blue(f"Total requests: {stats['performance']['total_requests']}")
            ColorPrint.blue(f"Success rate: {stats['performance']['success_rate']:.2f}%")

    except KeyboardInterrupt:
        ColorPrint.yellow("\nShutting down server...")
        await server.stop()


# Route handlers
async def echo_handler(params, client_id, context):
    """Echo handler - returns the input"""
    ColorPrint.blue(f"Echo request from {client_id}: {params}")
    return {'message': params.get('message'), 'client_id': client_id}


async def add_handler(params, client_id, context):
    """Add two numbers"""
    a = params.get('a', 0)
    b = params.get('b', 0)
    result = a + b
    ColorPrint.blue(f"Add request from {client_id}: {a} + {b} = {result}")
    return {'result': result}


async def get_time_handler(params, client_id, context):
    """Get current server time"""
    import time
    return {'timestamp': time.time(), 'formatted': time.strftime('%Y-%m-%d %H:%M:%S')}


# Authentication handler
async def async_auth_handler(credentials):
    """Custom authentication handler"""
    username = credentials.get('username')
    password = credentials.get('password')

    # Simple authentication logic
    if username == 'admin' and password == 'password':
        return {
            'success': True,
            'user': {
                'username': username,
                'role': 'admin'
            }
        }

    return {
        'success': False,
        'message': 'Invalid credentials'
    }


# Event handlers
async def on_client_connected(data):
    """Handle client connection"""
    ColorPrint.green(f"[EVENT] Client connected: {data['client_id']}")


async def on_client_disconnected(data):
    """Handle client disconnection"""
    ColorPrint.yellow(f"[EVENT] Client disconnected: {data['client_id']}")


async def on_custom_event(data, client_id):
    """Handle custom event"""
    ColorPrint.blue(f"[EVENT] Custom event from {client_id}: {data}")


# Middleware
async def logging_middleware(context, next_fn):
    """Logging middleware"""
    ColorPrint.gray(f"[MIDDLEWARE] Request: {context['route']} from {context['client_id']}")
    result = await next_fn()
    ColorPrint.gray(f"[MIDDLEWARE] Response: {context['route']} completed")
    return result


async def error_handler_middleware(error, context):
    """Error handler middleware"""
    ColorPrint.red(f"[ERROR MIDDLEWARE] Error in {context.get('route', 'unknown')}: {error}")
    # Return None to continue with default error handling
    return None


# Interceptors
async def request_interceptor(request):
    """Request interceptor - modify request before processing"""
    ColorPrint.gray(f"[INTERCEPTOR] Processing request: {request.get('route')}")
    return request


async def response_interceptor(response):
    """Response interceptor - modify response before sending"""
    ColorPrint.gray("[INTERCEPTOR] Processing response")
    return response


if __name__ == '__main__':
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        ColorPrint.yellow("\nServer stopped by user")
