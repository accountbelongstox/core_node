# Quick Start Guide

## Prerequisites

1. **Python 3.8+**
2. **Android device with USB debugging enabled**
3. **ADB installed and in PATH**
4. **FFmpeg libraries** (for PyAV)

## Installation Steps

### 1. Install Python Dependencies

```bash
cd pyapps/scrcpy_webgl_test
pip install -r requirements.txt
```

This will install:
- `aiohttp` - Async web server
- `av` - PyAV (FFmpeg Python bindings)

### 2. Verify FFmpeg Installation

```bash
python -c "import av; print('PyAV version:', av.__version__)"
```

If this fails, install FFmpeg:

**Windows**:
```bash
# Using Chocolatey
choco install ffmpeg

# Or download from: https://ffmpeg.org/download.html
```

**macOS**:
```bash
brew install ffmpeg
```

**Linux**:
```bash
sudo apt install ffmpeg libavcodec-dev libavformat-dev libavutil-dev
```

### 3. Connect Android Device

```bash
# Enable USB debugging on Android:
# Settings → About Phone → Tap "Build number" 7 times
# Settings → Developer Options → Enable "USB debugging"

# Connect device via USB
adb devices
# Should show: <serial>    device
```

## Running the Application

### Start Server

```bash
cd pyapps/scrcpy_webgl_test
python main.py
```

You should see:
```
======================================================================
Scrcpy WebGL Test Server - YUV Streaming
======================================================================
Server starting on http://localhost:27881
WebSocket endpoint: ws://localhost:27881/ws
API endpoint: http://localhost:27881/api/devices
======================================================================
Features:
  - H.264 → YUV420P decoding (PyAV/FFmpeg)
  - WebGL YUV rendering (BT.709 color space)
  - Touch control support
======================================================================
```

### Open Browser

1. Navigate to: `http://localhost:27881`
2. Click "🔄 Refresh" to scan for connected devices
3. Click "Start Stream" on your device
4. You should see the device screen rendered in WebGL canvas

## Testing

### 1. Verify WebGL Support

Open browser console and run:
```javascript
const canvas = document.createElement('canvas');
const gl = canvas.getContext('webgl');
console.log('WebGL supported:', !!gl);
```

Should output: `WebGL supported: true`

### 2. Check Stream Stats

Stream stats are displayed in the bottom-right corner of each stream:
- **Frames**: Total frames rendered
- **FPS**: Current frames per second
- **Time**: Elapsed streaming time

### 3. Test Touch Control

- **Click**: Tap on device
- **Click + Drag**: Swipe gesture
- **Double-click**: Double tap

## Troubleshooting

### PyAV Import Error

```
ModuleNotFoundError: No module named 'av'
```

**Solution**:
```bash
pip install av
```

If this fails, you may need to install FFmpeg first (see Installation Steps above).

### WebGL Not Supported

```
Error: WebGL not supported
```

**Solution**:
- Update browser to latest version
- Enable hardware acceleration: `chrome://settings` → "Use hardware acceleration"
- Check GPU status: `chrome://gpu`

### No Devices Found

```
0 devices
```

**Solution**:
```bash
# Check ADB connection
adb devices

# If device shows "unauthorized", check phone for authorization prompt
# If no devices, check USB cable and USB debugging setting
```

### Decoder Creation Failed

```
[VideoDecoder] ✗ Failed to create decoder: ...
```

**Solution**:
- Ensure FFmpeg is properly installed
- Try software decoding (default)
- For hardware acceleration, install CUDA/QSV drivers

### High Latency

**Solution**:
- Ensure device is connected via USB (not WiFi)
- Check network bandwidth (YUV requires ~90 Mbps for 1080p)
- Consider using scrcpy_web_test (H.264) for lower bandwidth

## Performance Tips

### Reduce Resolution

Edit `server.py` line 179:
```python
params = ServerParams(
    max_size=720,  # Try 480 or 360 for lower bandwidth
    max_fps=60,
    bit_rate=8_000_000,
    control=True,
)
```

### Enable Hardware Acceleration

Edit `server.py` to enable GPU decoding:

**NVIDIA CUDA**:
```python
self.decoder_service.create_decoder(serial, hwaccel='cuda')
```

**Intel QSV**:
```python
self.decoder_service.create_decoder(serial, hwaccel='qsv')
```

**Windows DXVA2**:
```python
self.decoder_service.create_decoder(serial, hwaccel='dxva2')
```

### Monitor Performance

Open browser DevTools:
- **Console**: Check for errors
- **Performance**: Profile rendering FPS
- **Network**: Monitor WebSocket traffic

## Next Steps

- Compare with `scrcpy_web_test` (H.264 streaming)
- Read `IMPLEMENTATION_COMPARISON.md` for technical details
- Read `README.md` for architecture overview
- Explore WebGL shader code in `index.html`

## Port Configuration

Default port: `27881`

To change, edit `server.py` line 663:
```python
web.run_app(app, host='0.0.0.0', port=27881)  # Change port here
```

## Multiple Devices

The application supports streaming from multiple devices simultaneously:
1. Connect multiple Android devices via USB
2. Click "🔄 Refresh" to see all devices
3. Click "Start Stream" on each device
4. All streams will appear in the grid

## Stopping the Server

Press `Ctrl+C` in the terminal running the server.

The server will:
- Stop all active streams
- Close all decoders
- Clean up resources

## Files Reference

- `server.py` - Backend WebSocket server + YUV streaming logic
- `index.html` - Frontend UI + WebGL YUV renderer
- `main.py` - Entry point
- `README.md` - Full documentation
- `IMPLEMENTATION_COMPARISON.md` - Comparison with H.264 version

## Support

For issues or questions:
1. Check browser console for JavaScript errors
2. Check server terminal for Python errors
3. Verify all prerequisites are installed
4. Compare with working `scrcpy_web_test` setup
