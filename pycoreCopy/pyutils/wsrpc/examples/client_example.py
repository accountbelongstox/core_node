# -*- coding: utf-8 -*-
"""
WebSocket RPC Client Example
Demonstrates how to use the PyWSRPC client
"""

import asyncio
from pycore.pyfoundations.color_print import ColorPrint
from pycore.pyutils.wsrpc import WsRpcClient


async def main():
    """Main client example"""

    # Create client with options
    client = WsRpcClient('ws://localhost:8080', {
        'debug': True,
        'reconnect': True,
        'max_reconnect_attempts': 5,
        'on_connected': on_connected,
        'on_disconnected': on_disconnected,
        'on_authenticated': on_authenticated,
        'on_error': on_error
    })

    # Register client routes (for server to call)
    client.route('notification', handle_notification)
    client.route('ping', handle_ping)

    # Register event handlers
    client.on('custom_event', handle_custom_event)
    client.on('latency', handle_latency)

    # Add interceptors
    client.add_request_interceptor(request_interceptor)
    client.add_response_interceptor(response_interceptor)

    try:
        ColorPrint.print_header("WebSocket RPC Client Example")

        # Connect to server
        ColorPrint.blue("Connecting to server...")
        await client.connect()

        # Wait for connection
        await asyncio.sleep(1)

        # Authenticate
        ColorPrint.blue("\nAuthenticating...")
        try:
            auth_result = await client.authenticate({
                'username': 'admin',
                'password': 'password'
            })
            ColorPrint.green(f"Authentication successful! Token: {auth_result.get('token')[:20]}...")
        except Exception as e:
            ColorPrint.red(f"Authentication failed: {e}")
            return

        # Subscribe to namespaces
        ColorPrint.blue("\nSubscribing to namespaces...")
        client.subscribe('chat')
        client.subscribe('notifications', 'important')

        # Make RPC calls
        ColorPrint.print_section("Making RPC Calls")

        # Echo test
        echo_result = await client.call('echo', {'message': 'Hello, Server!'})
        ColorPrint.green(f"Echo result: {echo_result}")

        # Add test
        add_result = await client.call('add', {'a': 10, 'b': 20})
        ColorPrint.green(f"Add result: {add_result}")

        # Get time test
        time_result = await client.call('get_time')
        ColorPrint.green(f"Server time: {time_result}")

        # Emit custom event
        ColorPrint.blue("\nEmitting custom event...")
        await client.emit('custom_event', {'message': 'Test event from client'})

        # Keep client running
        ColorPrint.print_section("Client Running")
        ColorPrint.blue("Press Ctrl+C to stop...")

        while True:
            await asyncio.sleep(5)

            # Make periodic calls
            try:
                result = await client.call('get_time')
                ColorPrint.gray(f"Periodic time check: {result['formatted']}")
            except Exception as e:
                ColorPrint.red(f"Error in periodic call: {e}")

    except KeyboardInterrupt:
        ColorPrint.yellow("\nDisconnecting...")
        await client.disconnect()
    except Exception as error:
        ColorPrint.red(f"Client error: {error}")
        await client.disconnect()


# Connection callbacks
async def on_connected():
    """Called when connected to server"""
    ColorPrint.green("[CALLBACK] Connected to server!")


async def on_disconnected():
    """Called when disconnected from server"""
    ColorPrint.yellow("[CALLBACK] Disconnected from server")


async def on_authenticated(result):
    """Called when authenticated"""
    ColorPrint.green(f"[CALLBACK] Authenticated! Expires in: {result.get('expires_in')}ms")


async def on_error(error):
    """Called on error"""
    ColorPrint.red(f"[CALLBACK] Error occurred: {error}")


# Route handlers (for server calls)
async def handle_notification(params):
    """Handle notification from server"""
    ColorPrint.blue(f"[NOTIFICATION] {params.get('message')}")
    return {'received': True}


async def handle_ping(params):
    """Handle ping from server"""
    ColorPrint.gray("[PING] Received ping from server")
    return {'pong': True, 'timestamp': asyncio.get_event_loop().time()}


# Event handlers
async def handle_custom_event(data):
    """Handle custom event"""
    ColorPrint.blue(f"[EVENT] Custom event: {data}")


async def handle_latency(data):
    """Handle latency event"""
    ColorPrint.gray(f"[LATENCY] {data['latency']:.2f}ms")


# Interceptors
async def request_interceptor(request):
    """Request interceptor"""
    ColorPrint.gray(f"[INTERCEPTOR] Sending request: {request.get('route')}")
    return request


async def response_interceptor(response):
    """Response interceptor"""
    ColorPrint.gray("[INTERCEPTOR] Received response")
    return response


if __name__ == '__main__':
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        ColorPrint.yellow("\nClient stopped by user")
