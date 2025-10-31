"""WebSocket routes for real-time communication"""

# Setup path
try:
    from .. import _path_setup
except ImportError:
    import sys
    from pathlib import Path
    sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent))

import json
import asyncio
from typing import Dict, Set
from datetime import datetime
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from fastapi.websockets import WebSocketState

from pycore.pyutils.api import WebSocketManager
from poly_apps.pyMatrix.services import DeviceService, VideoStreamService, ControlService, GroupService

router = APIRouter(prefix="/ws", tags=["websocket"])

# WebSocket connection managers
video_manager = WebSocketManager()
control_manager = WebSocketManager()
group_manager = WebSocketManager()


def create_wsrpc_message(msg_type: str, data: any) -> str:
    """Create WSRPC message matching frontend format"""
    return json.dumps({
        "type": msg_type,
        "timestamp": int(datetime.now().timestamp() * 1000),  # milliseconds
        "data": data
    })


@router.websocket("/video/{serial}")
async def video_stream_endpoint(websocket: WebSocket, serial: str):
    """
    Video streaming WebSocket endpoint

    Receives: Control commands (JSON)
    Sends:
        - Video frames (binary H.264/fMP4)
        - Video metadata (JSON)
    """
    await websocket.accept()

    try:
        # Register connection
        await video_manager.connect(serial, websocket)

        # Send connection confirmation
        await websocket.send_text(create_wsrpc_message("video.connected", {
            "serial": serial,
            "message": "Video stream connected"
        }))

        # Get device service
        device_service = DeviceService.instance()
        video_service = VideoStreamService.instance()

        # Check if device is connected
        if not device_service.is_connected(serial):
            await websocket.send_text(create_wsrpc_message("error", {
                "message": f"Device {serial} not connected"
            }))
            await websocket.close()
            return

        # Start video streaming task
        stream_task = asyncio.create_task(
            video_service.stream_to_websocket(serial, websocket)
        )

        # Listen for control messages
        try:
            while True:
                data = await websocket.receive()

                if "text" in data:
                    # Handle JSON control messages
                    try:
                        message = json.loads(data["text"])
                        msg_type = message.get("type")
                        msg_data = message.get("data", {})

                        if msg_type == "video.quality":
                            # Change video quality
                            await video_service.set_quality(serial, msg_data)
                        elif msg_type == "video.pause":
                            await video_service.pause(serial)
                        elif msg_type == "video.resume":
                            await video_service.resume(serial)

                    except json.JSONDecodeError:
                        pass

        except WebSocketDisconnect:
            pass
        finally:
            # Cancel streaming task
            stream_task.cancel()
            try:
                await stream_task
            except asyncio.CancelledError:
                pass

    except Exception as e:
        print(f"Video stream error for {serial}: {e}")
    finally:
        await video_manager.disconnect(serial, websocket)


@router.websocket("/control/{serial}")
async def device_control_endpoint(websocket: WebSocket, serial: str):
    """
    Device control WebSocket endpoint

    Receives: Touch/Key events (JSON)
    Sends: Control acknowledgments (JSON)
    """
    await websocket.accept()

    try:
        # Register connection
        await control_manager.connect(serial, websocket)

        # Send connection confirmation
        await websocket.send_text(create_wsrpc_message("control.connected", {
            "serial": serial,
            "message": "Control connection established"
        }))

        # Get services
        device_service = DeviceService.instance()
        control_service = ControlService.instance()

        # Check if device is connected
        if not device_service.is_connected(serial):
            await websocket.send_text(create_wsrpc_message("error", {
                "message": f"Device {serial} not connected"
            }))
            await websocket.close()
            return

        # Listen for control messages
        while True:
            try:
                data = await websocket.receive_text()
                message = json.loads(data)

                msg_type = message.get("type")
                msg_data = message.get("data", {})

                # Handle different control message types
                if msg_type == "control.touch":
                    success = await control_service.send_touch_event(serial, msg_data)
                    if not success:
                        await websocket.send_text(create_wsrpc_message("error", {
                            "message": "Failed to send touch event"
                        }))

                elif msg_type == "control.key":
                    success = await control_service.send_key_event(serial, msg_data)
                    if not success:
                        await websocket.send_text(create_wsrpc_message("error", {
                            "message": "Failed to send key event"
                        }))

                elif msg_type == "control.text":
                    text = msg_data.get("text", "")
                    success = await control_service.send_text(serial, text)
                    if not success:
                        await websocket.send_text(create_wsrpc_message("error", {
                            "message": "Failed to send text"
                        }))

                elif msg_type == "control.swipe":
                    success = await control_service.send_swipe(serial, msg_data)
                    if not success:
                        await websocket.send_text(create_wsrpc_message("error", {
                            "message": "Failed to send swipe"
                        }))

            except WebSocketDisconnect:
                break
            except json.JSONDecodeError:
                await websocket.send_text(create_wsrpc_message("error", {
                    "message": "Invalid JSON message"
                }))
            except Exception as e:
                print(f"Control error: {e}")
                await websocket.send_text(create_wsrpc_message("error", {
                    "message": str(e)
                }))

    except Exception as e:
        print(f"Device control error for {serial}: {e}")
    finally:
        await control_manager.disconnect(serial, websocket)


@router.websocket("/group")
async def group_control_endpoint(websocket: WebSocket):
    """
    Group control WebSocket endpoint

    Receives: Group commands (JSON)
    Sends: Group state updates (JSON)
    """
    await websocket.accept()

    # Generate connection ID
    connection_id = f"group_{id(websocket)}"

    try:
        # Register connection
        await group_manager.connect(connection_id, websocket)

        # Send connection confirmation
        await websocket.send_text(create_wsrpc_message("group.connected", {
            "message": "Group control connected"
        }))

        # Get group service
        group_service = GroupService.instance()

        # Listen for group messages
        while True:
            try:
                data = await websocket.receive_text()
                message = json.loads(data)

                msg_type = message.get("type")
                msg_data = message.get("data", {})

                # Handle group control messages
                if msg_type == "group.create":
                    group_id = msg_data.get("groupId")
                    host_serial = msg_data.get("hostSerial")
                    result = await group_service.create_group(group_id, host_serial)

                    await websocket.send_text(create_wsrpc_message("group.created", {
                        "groupId": group_id,
                        "success": result
                    }))

                elif msg_type == "group.add_slave":
                    group_id = msg_data.get("groupId")
                    slave_serial = msg_data.get("slaveSerial")
                    result = await group_service.add_slave(group_id, slave_serial)

                    await websocket.send_text(create_wsrpc_message("group.slave_added", {
                        "groupId": group_id,
                        "slaveSerial": slave_serial,
                        "success": result
                    }))

                elif msg_type == "group.remove_slave":
                    group_id = msg_data.get("groupId")
                    slave_serial = msg_data.get("slaveSerial")
                    result = await group_service.remove_slave(group_id, slave_serial)

                    await websocket.send_text(create_wsrpc_message("group.slave_removed", {
                        "groupId": group_id,
                        "slaveSerial": slave_serial,
                        "success": result
                    }))

                elif msg_type == "group.enable":
                    group_id = msg_data.get("groupId")
                    result = await group_service.enable_group(group_id)

                    await websocket.send_text(create_wsrpc_message("group.enabled", {
                        "groupId": group_id,
                        "success": result
                    }))

                elif msg_type == "group.disable":
                    group_id = msg_data.get("groupId")
                    result = await group_service.disable_group(group_id)

                    await websocket.send_text(create_wsrpc_message("group.disabled", {
                        "groupId": group_id,
                        "success": result
                    }))

                elif msg_type == "group.get_state":
                    group_id = msg_data.get("groupId")
                    state = await group_service.get_state(group_id)

                    await websocket.send_text(create_wsrpc_message("group.state", {
                        "groupId": group_id,
                        "state": state
                    }))

            except WebSocketDisconnect:
                break
            except json.JSONDecodeError:
                await websocket.send_text(create_wsrpc_message("error", {
                    "message": "Invalid JSON message"
                }))
            except Exception as e:
                print(f"Group control error: {e}")
                await websocket.send_text(create_wsrpc_message("error", {
                    "message": str(e)
                }))

    except Exception as e:
        print(f"Group control connection error: {e}")
    finally:
        await group_manager.disconnect(connection_id, websocket)


# Broadcast helpers for services
async def broadcast_group_state(group_id: str, state: dict):
    """Broadcast group state update to all group control connections"""
    message = create_wsrpc_message("group.state_update", {
        "groupId": group_id,
        "state": state
    })

    # Broadcast to all group connections
    connections = group_manager.get_connections("*")
    for ws in connections:
        if ws.client_state == WebSocketState.CONNECTED:
            try:
                await ws.send_text(message)
            except:
                pass
