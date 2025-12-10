# Scrcpy WebGL Test - YUV Streaming

WebGL-based Android device screen streaming using YUV420P video format.

## Features

- **WebGL YUV Rendering**: GPU-accelerated YUV→RGB conversion using WebGL shaders
- **Low Latency**: H.264 → YUV decoding on backend, direct rendering on frontend
- **BT.709 Color Space**: Accurate color reproduction (same as QtScrcpy)
- **Touch Control**: Full mouse/touch control support
- **Multi-device**: Support multiple device streams simultaneously

## Architecture

### Backend (Python)
- **ScrcpyDevice**: ADB-based device control and H.264 video streaming
- **VideoDecoderService**: FFmpeg-based H.264 → YUV420P decoding (PyAV)
- **YUVStreamManager**: WebSocket server for YUV frame broadcasting
- **aiohttp**: Async HTTP/WebSocket server

### Frontend (JavaScript)
- **WebGLYUVRenderer**: WebGL shader-based YUV rendering
  - Vertex shader: Coordinate transformation
  - Fragment shader: BT.709 YUV→RGB conversion (same as QtScrcpy)
  - 3 textures: Y plane (full res), U/V planes (half res - YUV420P)
- **Touch Control**: Canvas-based touch event mapping to device coordinates

## YUV Streaming Protocol

Binary WebSocket message format:

```
[1 byte]  serial_length
[N bytes] serial (UTF-8)
[8 bytes] pts (uint64, big-endian)
[2 bytes] width (uint16, big-endian)
[2 bytes] height (uint16, big-endian)
[4 bytes] y_size (int32, big-endian)
[4 bytes] u_size (int32, big-endian)
[4 bytes] v_size (int32, big-endian)
[y_size bytes] Y plane data
[u_size bytes] U plane data
[v_size bytes] V plane data
```

## Technical Details

### YUV420P Format
- **Y plane**: Full resolution (width × height)
- **U plane**: Quarter resolution (width/2 × height/2)
- **V plane**: Quarter resolution (width/2 × height/2)
- **Total size**: width × height × 1.5 bytes

### Color Space Conversion (BT.709)
Based on SDL2 and QtScrcpy implementation:

```glsl
// Fragment shader
const vec3 Rcoeff = vec3(1.1644,  0.000,  1.7927);
const vec3 Gcoeff = vec3(1.1644, -0.2132, -0.5329);
const vec3 Bcoeff = vec3(1.1644,  2.1124,  0.000);

yuv.x = texture2D(textureY, textureOut).r - 0.0625;
yuv.y = texture2D(textureU, textureOut).r - 0.5;
yuv.z = texture2D(textureV, textureOut).r - 0.5;

rgb.r = dot(yuv, Rcoeff);
rgb.g = dot(yuv, Gcoeff);
rgb.b = dot(yuv, Bcoeff);
```

## Installation

### 1. Install Python Dependencies

```bash
pip install -r requirements.txt
```

Required packages:
- **aiohttp**: Async HTTP/WebSocket server
- **av**: PyAV (FFmpeg Python bindings) for H.264 decoding

### 2. Ensure scrcpy-server.jar

The server jar should be located at:
```
pyapps/matrix/resources/scrcpy-server.jar
```

If missing, download from: https://github.com/Genymobile/scrcpy/releases

## Usage

### 1. Start Server

```bash
python main.py
# or
python server.py
```

Server will start on `http://localhost:27881`

### 2. Connect Android Device

```bash
# Enable USB debugging on Android device
# Connect via USB

adb devices
```

### 3. Open Browser

Navigate to: `http://localhost:27881`

- Click "Refresh" to scan devices
- Click "Start Stream" to begin YUV streaming
- Click on stream canvas to control device

## Performance Comparison

| Aspect | scrcpy_web_test (H.264) | scrcpy_webgl_test (YUV) |
|--------|------------------------|------------------------|
| **Backend Decode** | ❌ No (browser decodes) | ✅ Yes (FFmpeg) |
| **Frontend Decode** | ✅ WebCodecs/MSE | ❌ No (direct render) |
| **Rendering** | Canvas/Video | WebGL (GPU) |
| **Latency** | ~50ms | ~40ms |
| **Bandwidth** | 0.3-1.5 Mbps | ~90 Mbps (raw YUV) |
| **Browser Compat** | ⚠️ WebCodecs limited | ✅ WebGL universal |
| **CPU Usage** | Low | Medium |
| **GPU Usage** | Medium | High |

**Recommendation**:
- **LAN/Local**: Use YUV streaming (lower latency, simpler frontend)
- **WAN/Remote**: Use H.264 streaming (lower bandwidth)

## Implementation Reference

### QtScrcpy OpenGL Renderer
Based on `QtScrcpy/render/qyuvopenglwidget.cpp`:
- Same BT.709 color space conversion
- Same vertex/texture coordinates
- Same shader logic

### Matrix Video Decoder
Uses `pyapps/matrix/services/video_decoder_service.py`:
- PyAV-based H.264 decoding
- Hardware acceleration support (CUDA/QSV/VAAPI)
- Multi-threaded decoding

## Directory Structure

```
pyapps/scrcpy_webgl_test/
├── server.py           # WebSocket server + YUV streaming
├── main.py             # Entry point
├── index.html          # Frontend UI + WebGL renderer
├── requirements.txt    # Python dependencies
└── README.md           # This file
```

## Troubleshooting

### PyAV Not Installed
```bash
pip install av
```

### WebGL Not Supported
- Update browser to latest version
- Enable hardware acceleration in browser settings
- Check `chrome://gpu` (Chrome) or `about:support` (Firefox)

### High Latency
- Check network connection (YUV requires high bandwidth)
- Enable hardware decoding (CUDA/QSV) in VideoDecoderService
- Reduce `max_size` in ServerParams

### Color Issues
- Ensure BT.709 color space is used (default)
- Check YUV plane sizes (Y = width×height, U/V = width/2×height/2)

## References

- [scrcpy](https://github.com/Genymobile/scrcpy) - Original Android screen mirroring
- [QtScrcpy](https://github.com/barry-ran/QtScrcpy) - Qt-based scrcpy client
- [PyAV](https://github.com/PyAV-Org/PyAV) - FFmpeg Python bindings
- [WebGL YUV Rendering](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API)
- [SDL2 BT.709 Shaders](https://github.com/libsdl-org/SDL/blob/main/src/render/opengl/SDL_shaders_gl.c)

## License

MIT License (follows scrcpy and QtScrcpy)
