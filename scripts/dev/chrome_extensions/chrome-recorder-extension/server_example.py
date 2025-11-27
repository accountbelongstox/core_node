#!/usr/bin/env python3
"""
Chrome Remote Control - Example Server

This is a simple example server that demonstrates how to:
1. Receive polling requests from the Chrome extension
2. Send commands to the extension
3. Receive audio streams via WebSocket
4. Receive command results and screenshots

Usage:
    pip install flask flask-cors websockets asyncio
    python server_example.py

The server will run on:
    - HTTP API: http://localhost:8080
    - WebSocket: ws://localhost:8081
"""

import asyncio
import json
import os
import time
import threading
from datetime import datetime
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# Store connected devices and pending commands
devices = {}
pending_commands = {}
command_results = {}
screenshots = {}

# Command queue for each device
def get_pending_command(device_id):
    """Get and remove pending command for a device"""
    if device_id in pending_commands and pending_commands[device_id]:
        return pending_commands[device_id].pop(0)
    return None

def add_command(device_id, command, params=None):
    """Add a command to the queue for a device"""
    if device_id not in pending_commands:
        pending_commands[device_id] = []
    pending_commands[device_id].append({
        'command': command,
        'params': params or {},
        'timestamp': time.time()
    })

# HTTP API Endpoints

@app.route('/health', methods=['GET'])
@app.route('/api/health', methods=['GET'])
def health():
    """Health check endpoint for service discovery"""
    return jsonify({
        'status': 'ok',
        'service': 'Browser Bridge Server',
        'version': '1.0',
        'devices': len(devices),
    })

@app.route('/poll', methods=['POST'])
@app.route('/api/poll', methods=['POST'])
def poll():
    """Extension polls this endpoint for new commands"""
    data = request.json
    device_id = data.get('deviceId')
    status = data.get('status', {})
    
    # Update device status
    devices[device_id] = {
        'lastSeen': time.time(),
        'status': status
    }
    
    # Get pending command
    cmd = get_pending_command(device_id)
    if cmd:
        print(f"[{datetime.now().strftime('%H:%M:%S')}] Sending command to {device_id}: {cmd['command']}")
        return jsonify(cmd)
    
    return jsonify({'command': None})

@app.route('/result', methods=['POST'])
@app.route('/api/result', methods=['POST'])
def result():
    """Extension sends command results here"""
    data = request.json
    device_id = data.get('deviceId')
    command = data.get('command')
    result = data.get('result')
    
    print(f"[{datetime.now().strftime('%H:%M:%S')}] Result from {device_id}: {command} -> {result.get('success')}")
    
    # Store result
    if device_id not in command_results:
        command_results[device_id] = []
    command_results[device_id].append({
        'command': command,
        'result': result,
        'timestamp': time.time()
    })
    
    # Handle screenshot
    if command == 'screenshot' and result.get('success'):
        screenshots[device_id] = result.get('data', {}).get('screenshot')
    
    return jsonify({'status': 'ok'})

@app.route('/api/audio', methods=['POST'])
def receive_audio():
    """Receive audio chunks via HTTP"""
    device_id = request.form.get('deviceId', 'unknown')
    chunk_index = request.form.get('chunkIndex', '0')
    audio_file = request.files.get('audio')
    
    if audio_file:
        # Save audio chunk
        os.makedirs('audio_chunks', exist_ok=True)
        filename = f"audio_chunks/{device_id}_{chunk_index}.webm"
        audio_file.save(filename)
        print(f"[{datetime.now().strftime('%H:%M:%S')}] Saved audio chunk: {filename}")
    
    return jsonify({'status': 'ok'})

# Management API

@app.route('/api/devices', methods=['GET'])
def list_devices():
    """List all connected devices"""
    result = []
    for device_id, info in devices.items():
        result.append({
            'deviceId': device_id,
            'lastSeen': info['lastSeen'],
            'status': info['status'],
            'online': time.time() - info['lastSeen'] < 30
        })
    return jsonify(result)

@app.route('/api/send', methods=['POST'])
def send_command():
    """Send a command to a device"""
    data = request.json
    device_id = data.get('deviceId')
    command = data.get('command')
    params = data.get('params', {})
    
    if not device_id or not command:
        return jsonify({'error': 'deviceId and command required'}), 400
    
    add_command(device_id, command, params)
    print(f"[{datetime.now().strftime('%H:%M:%S')}] Queued command for {device_id}: {command}")
    
    return jsonify({'status': 'queued'})

@app.route('/api/results/<device_id>', methods=['GET'])
def get_results(device_id):
    """Get command results for a device"""
    results = command_results.get(device_id, [])
    return jsonify(results[-50:])  # Last 50 results

@app.route('/api/screenshot/<device_id>', methods=['GET'])
def get_screenshot(device_id):
    """Get latest screenshot for a device"""
    screenshot = screenshots.get(device_id)
    if screenshot:
        return jsonify({'screenshot': screenshot})
    return jsonify({'error': 'No screenshot available'}), 404

# Simple Web UI

@app.route('/')
def index():
    return '''
    <!DOCTYPE html>
    <html>
    <head>
        <title>Chrome Remote Control - Server</title>
        <style>
            body { font-family: Arial; max-width: 1200px; margin: 0 auto; padding: 20px; background: #1a1a2e; color: #fff; }
            h1 { color: #00d4ff; }
            .section { background: rgba(255,255,255,0.1); padding: 20px; margin: 20px 0; border-radius: 8px; }
            input, select, button { padding: 10px; margin: 5px; border-radius: 4px; border: none; }
            button { background: #00d4ff; color: #000; cursor: pointer; }
            button:hover { background: #00b8e6; }
            .device { background: rgba(0,255,136,0.2); padding: 10px; margin: 5px 0; border-radius: 4px; }
            .offline { background: rgba(255,68,68,0.2); }
            pre { background: #000; padding: 10px; border-radius: 4px; overflow-x: auto; }
            #log { height: 300px; overflow-y: auto; }
        </style>
    </head>
    <body>
        <h1>Chrome Remote Control Server</h1>
        
        <div class="section">
            <h2>Connected Devices</h2>
            <div id="devices"></div>
            <button onclick="refreshDevices()">Refresh</button>
        </div>
        
        <div class="section">
            <h2>Send Command</h2>
            <select id="deviceSelect"></select>
            <select id="commandSelect">
                <option value="open_url">Open URL</option>
                <option value="close_url">Close URL</option>
                <option value="switch_tab">Switch Tab</option>
                <option value="screenshot">Screenshot</option>
                <option value="get_html">Get HTML</option>
                <option value="get_console">Get Console</option>
                <option value="get_tabs">Get Tabs</option>
                <option value="reload">Reload Page</option>
            </select>
            <input type="text" id="params" placeholder='{"url": "https://google.com"}' style="width: 300px;">
            <button onclick="sendCommand()">Send</button>
        </div>
        
        <div class="section">
            <h2>Results Log</h2>
            <pre id="log"></pre>
            <button onclick="clearLog()">Clear</button>
        </div>
        
        <script>
            function refreshDevices() {
                fetch('/api/devices')
                    .then(r => r.json())
                    .then(devices => {
                        const container = document.getElementById('devices');
                        const select = document.getElementById('deviceSelect');
                        container.innerHTML = '';
                        select.innerHTML = '';
                        
                        devices.forEach(d => {
                            const div = document.createElement('div');
                            div.className = 'device' + (d.online ? '' : ' offline');
                            div.innerHTML = `<strong>${d.deviceId}</strong> - ${d.online ? 'Online' : 'Offline'} (Last seen: ${new Date(d.lastSeen * 1000).toLocaleTimeString()})`;
                            container.appendChild(div);
                            
                            const option = document.createElement('option');
                            option.value = d.deviceId;
                            option.textContent = d.deviceId;
                            select.appendChild(option);
                        });
                    });
            }
            
            function sendCommand() {
                const deviceId = document.getElementById('deviceSelect').value;
                const command = document.getElementById('commandSelect').value;
                let params = {};
                try {
                    const paramsText = document.getElementById('params').value;
                    if (paramsText) params = JSON.parse(paramsText);
                } catch(e) { alert('Invalid JSON'); return; }
                
                fetch('/api/send', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ deviceId, command, params })
                }).then(r => r.json()).then(d => {
                    addLog('Sent: ' + command + ' to ' + deviceId);
                });
            }
            
            function addLog(msg) {
                const log = document.getElementById('log');
                log.textContent = new Date().toLocaleTimeString() + ' - ' + msg + '\\n' + log.textContent;
            }
            
            function clearLog() {
                document.getElementById('log').textContent = '';
            }
            
            // Poll for results
            setInterval(() => {
                const deviceId = document.getElementById('deviceSelect').value;
                if (!deviceId) return;
                
                fetch('/api/results/' + deviceId)
                    .then(r => r.json())
                    .then(results => {
                        if (results.length > 0) {
                            const latest = results[results.length - 1];
                            addLog('Result: ' + latest.command + ' -> ' + JSON.stringify(latest.result).substring(0, 100));
                        }
                    });
            }, 3000);
            
            refreshDevices();
            setInterval(refreshDevices, 5000);
        </script>
    </body>
    </html>
    '''

# WebSocket Server for realtime communication
async def websocket_handler(websocket, path):
    """Handle WebSocket connections for realtime communication"""
    device_id = None
    print(f"[WS] New connection from {websocket.remote_address}")
    
    try:
        async for message in websocket:
            try:
                # Try to parse as JSON (control messages)
                data = json.loads(message)
                msg_type = data.get('type')
                
                if msg_type == 'register':
                    device_id = data.get('deviceId')
                    print(f"[WS] Device registered: {device_id}")
                    
                elif msg_type == 'command_result':
                    print(f"[WS] Command result: {data.get('command')} -> {data.get('result', {}).get('success')}")
                    
                elif msg_type == 'screenshot':
                    print(f"[WS] Screenshot received (length: {len(data.get('data', ''))})")
                    if device_id:
                        screenshots[device_id] = data.get('data')
                        
            except json.JSONDecodeError:
                # Binary data (audio)
                if isinstance(message, bytes):
                    print(f"[WS] Audio chunk received: {len(message)} bytes")
                    # Save audio chunk
                    os.makedirs('audio_chunks', exist_ok=True)
                    timestamp = int(time.time() * 1000)
                    with open(f'audio_chunks/ws_{device_id or "unknown"}_{timestamp}.webm', 'wb') as f:
                        f.write(message)
                        
    except Exception as e:
        print(f"[WS] Connection error: {e}")
    finally:
        print(f"[WS] Connection closed: {device_id or 'unknown'}")

def run_websocket_server():
    """Run WebSocket server in a separate thread"""
    import websockets
    
    async def main():
        async with websockets.serve(websocket_handler, "0.0.0.0", 9001):
            print("[WS] WebSocket server running on ws://0.0.0.0:9001")
            await asyncio.Future()  # Run forever
    
    asyncio.run(main())

if __name__ == '__main__':
    print("=" * 50)
    print("Browser Bridge - Example Server")
    print("=" * 50)
    print("")
    print("HTTP API: http://localhost:9000")
    print("WebSocket: ws://localhost:9001")
    print("Web UI: http://localhost:9000")
    print("")
    print("The extension will auto-discover this server on your network!")
    print("")
    print("=" * 50)
    
    # Start WebSocket server in background thread
    ws_thread = threading.Thread(target=run_websocket_server, daemon=True)
    ws_thread.start()
    
    # Run Flask server
    app.run(host='0.0.0.0', port=9000, debug=False)

