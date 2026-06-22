"""
Unified WebSocket Endpoint - Single WebSocket for all Matrix operations

Protocol:
    - JSON messages for requests/responses
    - Binary messages for video frames
    - Request/Response matching via message ID
    - Subscribe/Publish for real-time events
"""

import json
import struct
import asyncio
from typing import Dict, Set, Optional
from datetime import datetime

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from fastapi.websockets import WebSocketState

from pycore import ColorPrint
from pycore.pyutils.api import WebSocketManager

# Import namespace handlers
from pyapps.matrix.api.unified_ws_handlers import (
    HandlerRegistry,
    DeviceHandler,
    ScreenHandler,
    FileHandler,
    RecordingHandler,
    GroupHandler,
    ConfigHandler,
    ControlHandler,
    VideoHandler,
    SystemHandler,
)

# Import services for video streaming
from pyapps.matrix.services import DeviceService, VideoStreamService

# Create router
router = APIRouter(prefix="/ws", tags=["unified-websocket"])

# WebSocket manager
ws_manager = WebSocketManager()

# Handler registry (singleton)
_handler_registry: Optional[HandlerRegistry] = None


def get_handler_registry() -> HandlerRegistry:
    """Get or create handler registry"""
    global _handler_registry
    if _handler_registry is None:
        _handler_registry = HandlerRegistry()
        # Register all namespace handlers
        _handler_registry.register('system', SystemHandler())
        _handler_registry.register('device', DeviceHandler())
        _handler_registry.register('screen', ScreenHandler())
        _handler_registry.register('file', FileHandler())
        _handler_registry.register('recording', RecordingHandler())
        _handler_registry.register('group', GroupHandler())
        _handler_registry.register('config', ConfigHandler())
        _handler_registry.register('control', ControlHandler())
        _handler_registry.register('video', VideoHandler())

        ColorPrint.green(f"[UnifiedWS] Registered {len(_handler_registry.handlers)} namespace handlers")

    return _handler_registry


# Client state management
class ClientState:
    """Manage client subscriptions and state"""

    def __init__(self, websocket: WebSocket):
        self.websocket = websocket
        self.subscriptions: Dict[str, Set[str]] = {}  # namespace -> set of subscription IDs
        self.video_streams: Set[str] = set()  # Set of device serials for video streams
        self.pending_requests: Dict[str, asyncio.Future] = {}  # request_id -> Future

    def add_subscription(self, namespace: str, subscription_id: str):
        """Add a subscription"""
        if namespace not in self.subscriptions:
            self.subscriptions[namespace] = set()
        self.subscriptions[namespace].add(subscription_id)

    def remove_subscription(self, namespace: str, subscription_id: str):
        """Remove a subscription"""
        if namespace in self.subscriptions:
            self.subscriptions[namespace].discard(subscription_id)

    def is_subscribed(self, namespace: str) -> bool:
        """Check if subscribed to namespace"""
        return namespace in self.subscriptions and len(self.subscriptions[namespace]) > 0

    def add_video_stream(self, serial: str):
        """Add video stream"""
        self.video_streams.add(serial)

    def remove_video_stream(self, serial: str):
        """Remove video stream"""
        self.video_streams.discard(serial)

    async def cleanup(self):
        """Cleanup client state"""
        # Stop all video streams
        video_service = VideoStreamService.instance()
        for serial in self.video_streams:
            await video_service.stop(serial)

        # Clear subscriptions
        self.subscriptions.clear()
        self.video_streams.clear()


# Client registry
clients: Dict[WebSocket, ClientState] = {}


def create_message(msg_type: str, data: any, namespace: str = "", action: str = "", msg_id: str = "") -> str:
    """Create standardized WebSocket message"""
    message = {
        "type": msg_type,
        "timestamp": int(datetime.now().timestamp() * 1000)
    }

    if msg_id:
        message["id"] = msg_id
    if namespace:
        message["namespace"] = namespace
    if action:
        message["action"] = action
    if data is not None:
        message["data"] = data

    return json.dumps(message)


@router.websocket("")
async def unified_websocket(websocket: WebSocket):
    """
    Unified WebSocket endpoint

    Handles all Matrix operations through a single WebSocket connection:
    - Device management
    - Screen control
    - File operations
    - Recording/Screenshot
    - Group control
    - Configuration
    - Device control (touch/key events)
    - Video streaming

    Message Format:
        {
            "id": "req-001",           # Request ID (for request/response matching)
            "type": "request",         # request|response|event|subscribe|unsubscribe|error
            "namespace": "device",     # Namespace: system|device|screen|file|recording|group|config|control|video
            "action": "list",          # Action within namespace
            "data": {...},             # Request/response data
            "timestamp": 1733200000000 # Milliseconds since epoch
        }
    """
    await websocket.accept()

    # Register client
    client_state = ClientState(websocket)
    clients[websocket] = client_state
    await ws_manager.connect("unified", websocket)

    # Get handler registry
    registry = get_handler_registry()

    ColorPrint.green(f"[UnifiedWS] Client connected (total: {len(clients)})")

    # Send welcome message
    await websocket.send_text(create_message(
        "event",
        {
            "message": "Connected to Matrix Unified WebSocket",
            "version": "1.1.0",
            "protocol": "unified-websocket"
        },
        namespace="system",
        action="connected"
    ))

    try:
        while True:
            data = await websocket.receive()

            # Handle binary messages (video frames)
            if "bytes" in data:
                # Binary messages are handled separately (video frames pass-through)
                continue

            # Handle text messages (JSON)
            if "text" in data:
                message = json.loads(data["text"])
                msg_type = message.get("type")
                msg_id = message.get("id")
                namespace = message.get("namespace")
                action = message.get("action")
                msg_data = message.get("data")

                ColorPrint.blue(f"[UnifiedWS] {msg_type} -> {namespace}.{action}")

                # Handle request
                if msg_type == "request":
                    await handle_request(websocket, client_state, registry, msg_id, namespace, action, msg_data)

                # Handle subscribe
                elif msg_type == "subscribe":
                    await handle_subscribe(websocket, client_state, msg_id, namespace, action, msg_data)

                # Handle unsubscribe
                elif msg_type == "unsubscribe":
                    await handle_unsubscribe(websocket, client_state, msg_id, namespace, action, msg_data)

    except WebSocketDisconnect:
        ColorPrint.yellow(f"[UnifiedWS] Client disconnected")
    except Exception as e:
        ColorPrint.red(f"[UnifiedWS] Error: {e}")
    finally:
        # Cleanup
        await client_state.cleanup()
        await ws_manager.disconnect("unified", websocket)
        clients.pop(websocket, None)
        ColorPrint.blue(f"[UnifiedWS] Client cleaned up (remaining: {len(clients)})")


async def handle_request(
    websocket: WebSocket,
    client_state: ClientState,
    registry: HandlerRegistry,
    msg_id: str,
    namespace: str,
    action: str,
    data: Optional[Dict]
):
    """Handle a request message"""
    if not namespace or not action:
        await websocket.send_text(create_message(
            "error",
            None,
            namespace=namespace,
            action=action,
            msg_id=msg_id
        ))
        return

    # Get namespace handler
    handler = registry.get(namespace)
    if not handler:
        error_data = {
            "error": {
                "code": "NAMESPACE_NOT_FOUND",
                "message": f"Namespace {namespace} not found"
            }
        }
        await websocket.send_text(create_message("error", error_data, namespace, action, msg_id))
        return

    # Execute handler
    result = await handler.handle(action, data, websocket)

    # Check if result contains error
    if 'error' in result:
        await websocket.send_text(create_message("error", result, namespace, action, msg_id))
    else:
        await websocket.send_text(create_message("response", result, namespace, action, msg_id))


async def handle_subscribe(
    websocket: WebSocket,
    client_state: ClientState,
    msg_id: str,
    namespace: str,
    action: str,
    data: Optional[Dict]
):
    """Handle a subscribe message"""
    if namespace == "video" and action == "stream":
        # Subscribe to video stream
        serial = data.get("serial") if data else None
        if not serial:
            await websocket.send_text(create_message(
                "error",
                {"error": {"code": "MISSING_SERIAL", "message": "Serial required for video subscription"}},
                namespace,
                action,
                msg_id
            ))
            return

        # Start video stream
        device_service = DeviceService.instance()
        if not device_service.is_connected(serial):
            await websocket.send_text(create_message(
                "error",
                {"error": {"code": "DEVICE_NOT_CONNECTED", "message": f"Device {serial} not connected"}},
                namespace,
                action,
                msg_id
            ))
            return

        # Add to client state
        client_state.add_video_stream(serial)
        client_state.add_subscription(namespace, f"video:{serial}")

        # Send subscription confirmation
        device_info = device_service.get_device(serial).get_device_info()
        await websocket.send_text(create_message(
            "response",
            {
                "success": True,
                "subscribed": True,
                "serial": serial,
                "codec": "h264",
                "width": device_info.resolution.width,
                "height": device_info.resolution.height
            },
            namespace,
            action,
            msg_id
        ))

        # Start streaming video frames in background task
        asyncio.create_task(stream_video_to_client(websocket, serial))

    else:
        # Generic subscription (for future event subscriptions)
        client_state.add_subscription(namespace, f"{namespace}:{action}")
        await websocket.send_text(create_message(
            "response",
            {"success": True, "subscribed": True},
            namespace,
            action,
            msg_id
        ))


async def handle_unsubscribe(
    websocket: WebSocket,
    client_state: ClientState,
    msg_id: str,
    namespace: str,
    action: str,
    data: Optional[Dict]
):
    """Handle an unsubscribe message"""
    if namespace == "video" and action == "stream":
        serial = data.get("serial") if data else None
        if serial:
            client_state.remove_video_stream(serial)
            client_state.remove_subscription(namespace, f"video:{serial}")

            # Stop video streaming
            video_service = VideoStreamService.instance()
            await video_service.stop(serial)

    else:
        client_state.remove_subscription(namespace, f"{namespace}:{action}")

    await websocket.send_text(create_message(
        "response",
        {"success": True, "unsubscribed": True},
        namespace,
        action,
        msg_id
    ))


async def stream_video_to_client(websocket: WebSocket, serial: str):
    """Stream video frames to client"""
    video_service = VideoStreamService.instance()

    try:
        # This will stream until connection closes or error occurs
        await video_service.stream_to_websocket(serial, websocket)
    except Exception as e:
        ColorPrint.red(f"[UnifiedWS] Video streaming error for {serial}: {e}")
